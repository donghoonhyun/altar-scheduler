/**
 * membership uid 버그 수정 스크립트
 *
 * 문제: MoveMembersDrawer에서 복사/이동 시 membership uid로
 *       parent_uid 대신 member doc의 auto-generated ID를 사용하여
 *       부모 사용자가 대상 복사단을 헤더에서 볼 수 없는 버그
 *
 * 수정 내용:
 *   1. 모든 SG의 members에서 parent_uid를 가진 멤버를 스캔
 *      → {parent_uid}_{sgId} membership이 없으면 생성
 *   2. uid가 users 컬렉션에 존재하지 않는 고아 membership 삭제
 *
 * 사용법:
 *   드라이런 (기본):  npx tsx scripts/fix_membership_parent_uid.ts
 *   실제 실행:        DRY_RUN=false npx tsx scripts/fix_membership_parent_uid.ts
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const admin = require('firebase-admin');

const DRY_RUN = process.env.DRY_RUN !== 'false';

const serviceAccountPath = path.resolve(__dirname, '../../Ordo/service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db: FirebaseFirestore.Firestore = admin.firestore();

const MEMBERSHIPS_PATH = 'app_datas/ordo-altar/memberships';
const SERVER_GROUPS_PATH = 'app_datas/ordo-altar/server_groups';

console.log('');
console.log('══════════════════════════════════════════════════════');
console.log('  membership parent_uid 버그 수정 (ordo-eb11a)');
console.log('══════════════════════════════════════════════════════');
console.log(`  MODE: ${DRY_RUN ? '🔍 DRY RUN (읽기 전용)' : '⚡ EXECUTE (실제 쓰기/삭제)'}`);
console.log('══════════════════════════════════════════════════════');
console.log('');

async function main() {
  // ── Step 1: 실제 users 목록 수집 (users 컬렉션) ─────────────────
  console.log('[Step 1] users 컬렉션 로드 중...');
  const usersSnap = await db.collection('users').get();
  const validUids = new Set<string>(usersSnap.docs.map(d => d.id));
  console.log(`  → ${validUids.size}명의 유저 확인\n`);

  // ── Step 2: 모든 server_groups 조회 ─────────────────────────────
  console.log('[Step 2] server_groups 목록 로드 중...');
  const sgSnap = await db.collection(SERVER_GROUPS_PATH).get();
  console.log(`  → ${sgSnap.size}개 복사단\n`);

  // ── Step 3: 기존 memberships 전체 로드 (중복 생성 방지) ──────────
  console.log('[Step 3] 기존 memberships 로드 중...');
  const existingMembershipsSnap = await db.collection(MEMBERSHIPS_PATH).get();
  const existingMembershipIds = new Set<string>(existingMembershipsSnap.docs.map(d => d.id));
  console.log(`  → ${existingMembershipIds.size}개 기존 membership\n`);

  // ── Step 4: 각 SG의 members 스캔 → 누락된 parent membership 생성 ─
  console.log('[Step 4] 누락된 parent membership 탐색 및 생성...');
  let missingCount = 0;
  let createdCount = 0;

  for (const sgDoc of sgSnap.docs) {
    const sgId = sgDoc.id;
    const sgData = sgDoc.data();
    const parishCode = sgData.parish_code || '';

    const membersSnap = await db.collection(SERVER_GROUPS_PATH).doc(sgId).collection('members').get();

    for (const memberDoc of membersSnap.docs) {
      const m = memberDoc.data();
      const parentUid = m.parent_uid;
      if (!parentUid) continue; // 직접 가입 멤버는 건너뜀

      const correctMembershipId = `${parentUid}_${sgId}`;

      if (!existingMembershipIds.has(correctMembershipId)) {
        missingCount++;
        const memberName = m.name_kor || memberDoc.id;
        console.log(`  [누락] ${correctMembershipId}`);
        console.log(`         멤버: ${memberName} (doc: ${memberDoc.id}), SG: ${sgId}, active: ${m.active}`);

        if (!DRY_RUN) {
          await db.collection(MEMBERSHIPS_PATH).doc(correctMembershipId).set({
            uid: parentUid,
            server_group_id: sgId,
            role: ['server'],
            active: m.active === true,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            parish_code: m.parish_code || parishCode,
          });
          createdCount++;
          console.log(`         ✅ 생성 완료`);
        }
      }
    }
  }

  console.log(`\n  → 누락 ${missingCount}개 탐지, ${DRY_RUN ? '(dry-run) 생성 안함' : `${createdCount}개 생성`}\n`);

  // ── Step 5: uid가 users 컬렉션에 없는 고아 membership 탐색/삭제 ──
  console.log('[Step 5] 고아 membership 탐색 (uid가 실제 유저가 아닌 것)...');
  let orphanCount = 0;
  let deletedCount = 0;

  for (const msDoc of existingMembershipsSnap.docs) {
    const data = msDoc.data();
    const uid = data.uid;

    // uid가 없거나 users 컬렉션에 없으면 고아
    if (!uid || !validUids.has(uid)) {
      orphanCount++;
      console.log(`  [고아] ${msDoc.id}`);
      console.log(`         uid: ${uid || '(없음)'}, sg: ${data.server_group_id}`);

      if (!DRY_RUN) {
        await msDoc.ref.delete();
        deletedCount++;
        console.log(`         🗑️  삭제 완료`);
      }
    }
  }

  console.log(`\n  → 고아 ${orphanCount}개 탐지, ${DRY_RUN ? '(dry-run) 삭제 안함' : `${deletedCount}개 삭제`}\n`);

  // ── 완료 ──────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════');
  if (DRY_RUN) {
    console.log('  🔍 DRY RUN 완료. 실제 반영하려면:');
    console.log('     DRY_RUN=false npx tsx scripts/fix_membership_parent_uid.ts');
  } else {
    console.log(`  ✅ 완료: membership ${createdCount}개 생성, ${deletedCount}개 삭제`);
  }
  console.log('══════════════════════════════════════════════════════');
  console.log('');
}

main().catch(console.error);
