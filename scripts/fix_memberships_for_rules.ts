/**
 * Firestore 규칙 강화(1단계) 사전 데이터 정리 — memberships
 *
 * 규칙은 멤버십 문서를 `{uid}_{server_group_id}` ID 로만 찾을 수 있고, 권한을 active 로 판정한다.
 * 이 스크립트는 그 전제에 맞지 않는 문서만 고친다.
 *
 *   A) 문서 ID 가 `{uid}_{server_group_id}` 가 아닌 멤버십 → 표준 ID 문서로 옮긴다
 *      (표준 ID 문서가 이미 있으면 역할을 합치고, 옛 문서는 삭제)
 *   B) 활동 중인 자녀(member.active === true)가 있는데 멤버십이 비활성인 보호자 → active: true
 *      (역할이 ['server'] 뿐인 문서만. 다른 역할이 섞인 비활성 문서는 건드리지 않고 목록만 출력)
 *
 * 이름·전화번호 등 개인정보는 읽지도 출력하지도 않는다. 변경 전 문서는 backup/ 에 JSON 으로 남긴다.
 *
 * 사용법:
 *   드라이런 (기본):  npx tsx scripts/fix_memberships_for_rules.ts
 *   실제 실행:        DRY_RUN=false npx tsx scripts/fix_memberships_for_rules.ts
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const admin = require('firebase-admin');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const EXPECTED_PROJECT = 'ordo-eb11a';
const APP_ROOT = 'app_datas/ordo-altar';

const candidates = [
  path.resolve(__dirname, 'service-account.json'),
  path.resolve(__dirname, '../../Ordo/service-account.json'),
];
const serviceAccountPath = candidates.find((p) => fs.existsSync(p) && require(p).project_id === EXPECTED_PROJECT);
if (!serviceAccountPath) {
  console.error(`❌ ${EXPECTED_PROJECT} 용 service-account.json 을 찾지 못했습니다.`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
const db: FirebaseFirestore.Firestore = admin.firestore();
const { FieldValue } = admin.firestore;

type Data = FirebaseFirestore.DocumentData;
const mask = (uid: unknown) => (typeof uid === 'string' && uid.length > 6 ? `${uid.slice(0, 4)}…` : String(uid));
const rolesOf = (d: Data): string[] => (Array.isArray(d.role) ? d.role : d.role ? [d.role] : []);

interface Plan {
  kind: 'create' | 'update' | 'delete';
  id: string;
  data?: Data;
  note: string;
}

async function main() {
  console.log(`\n프로젝트: ${EXPECTED_PROJECT}   MODE: ${DRY_RUN ? '🔍 DRY RUN (쓰기 없음)' : '⚡ EXECUTE'}\n`);

  const colRef = db.collection(`${APP_ROOT}/memberships`);
  const snap = await colRef.get();

  // 계획을 반영해 가며 보는 메모리 상의 상태
  const state = new Map<string, Data>();
  snap.forEach((doc) => state.set(doc.id, doc.data()));
  const original = new Map(state);

  const plans: Plan[] = [];
  const touched = new Set<string>();

  // ── A) 비표준 ID → 표준 ID ───────────────────────────────────────────────────
  console.log('■ A) 문서 ID ≠ {uid}_{server_group_id}');
  for (const [id, d] of original) {
    const canonicalId = `${d.uid}_${d.server_group_id}`;
    if (id === canonicalId) continue;

    const label = `${mask(d.uid)}_${d.server_group_id}`;
    const existing = state.get(canonicalId);
    touched.add(id);
    touched.add(canonicalId);

    if (!existing) {
      state.set(canonicalId, { ...d });
      plans.push({ kind: 'create', id: canonicalId, data: { ...d, updated_at: FieldValue.serverTimestamp() }, note: '표준 ID 로 복사' });
      console.log(`  · ${label}: 표준 문서 없음 → 생성  role=${JSON.stringify(rolesOf(d))} active=${d.active}`);
    } else {
      const mergedRoles = [...rolesOf(existing), ...rolesOf(d).filter((r) => !rolesOf(existing).includes(r))];
      const mergedActive = existing.active === true || d.active === true;
      const patch: Data = {};
      if (JSON.stringify(mergedRoles) !== JSON.stringify(rolesOf(existing))) patch.role = mergedRoles;
      if (mergedActive !== existing.active) patch.active = mergedActive;
      // 표준 문서에 없는 부가 필드(parish_code 등)만 채운다
      for (const [k, v] of Object.entries(d)) {
        if (!(k in existing) && !['uid', 'server_group_id', 'role', 'active'].includes(k)) patch[k] = v;
      }

      console.log(
        `  · ${label}: 표준 문서 있음 → 병합  표준 role=${JSON.stringify(rolesOf(existing))}/active=${existing.active}` +
          `  옛 문서 role=${JSON.stringify(rolesOf(d))}/active=${d.active}  ⇒ role=${JSON.stringify(mergedRoles)}/active=${mergedActive}`
      );
      if (Object.keys(patch).length > 0) {
        state.set(canonicalId, { ...existing, ...patch });
        plans.push({ kind: 'update', id: canonicalId, data: { ...patch, updated_at: FieldValue.serverTimestamp() }, note: '옛 문서와 병합' });
      }
    }

    state.delete(id);
    plans.push({ kind: 'delete', id, note: '표준 ID 로 옮긴 옛 문서 삭제' });
  }
  if (!plans.length) console.log('  (대상 없음)');

  // ── B) 활동 자녀가 있는 보호자의 멤버십 활성화 ───────────────────────────────
  console.log('\n■ B) 활동 자녀가 있는데 멤버십이 비활성인 보호자');
  const groupSnap = await db.collection(`${APP_ROOT}/server_groups`).get();
  let activated = 0;
  const needReview: string[] = [];
  const missing: string[] = [];

  for (const g of groupSnap.docs) {
    const membersSnap = await g.ref.collection('members').where('active', '==', true).select('parent_uid').get();
    const parents = new Set<string>();
    membersSnap.forEach((m) => {
      const parentUid = m.get('parent_uid');
      if (parentUid) parents.add(parentUid);
    });

    let countInGroup = 0;
    for (const parentUid of parents) {
      const id = `${parentUid}_${g.id}`;
      const d = state.get(id);
      if (!d) {
        missing.push(`${mask(parentUid)}_${g.id}`);
        continue;
      }
      if (d.active === true) continue;

      const roles = rolesOf(d);
      if (roles.length === 1 && roles[0] === 'server') {
        state.set(id, { ...d, active: true });
        touched.add(id);
        plans.push({ kind: 'update', id, data: { active: true, updated_at: FieldValue.serverTimestamp() }, note: '보호자 멤버십 활성화' });
        countInGroup++;
      } else {
        needReview.push(`${mask(parentUid)}_${g.id}  role=${JSON.stringify(roles)}`);
      }
    }
    if (countInGroup) console.log(`  · ${g.id}: ${countInGroup}명 active false → true`);
    activated += countInGroup;
  }
  if (!activated) console.log('  (대상 없음)');
  if (needReview.length) {
    console.log(`  ⚠ 역할이 ['server'] 뿐이 아니라서 건드리지 않은 비활성 멤버십 ${needReview.length}건 (수동 확인 필요):`);
    needReview.forEach((s) => console.log(`     - ${s}`));
  }
  if (missing.length) {
    console.log(`  ⚠ 멤버십 문서가 아예 없는 보호자 ${missing.length}명 (건드리지 않음):`);
    missing.forEach((s) => console.log(`     - ${s}`));
  }

  // ── 요약 ────────────────────────────────────────────────────────────────────
  const count = (k: Plan['kind']) => plans.filter((p) => p.kind === k).length;
  console.log(`\n■ 계획: 생성 ${count('create')} · 수정 ${count('update')} · 삭제 ${count('delete')}  (전체 문서 ${snap.size} → ${state.size})`);

  if (DRY_RUN) {
    console.log('\n🔍 드라이런이므로 아무것도 쓰지 않았습니다.\n');
    return;
  }
  if (!plans.length) {
    console.log('\n변경할 것이 없습니다.\n');
    return;
  }

  // 변경 전 상태 백업 (uid·역할만 있는 문서, 개인정보 없음)
  const backupDir = path.resolve(__dirname, '../backup');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `phase1-memberships-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const before: Record<string, Data | null> = {};
  touched.forEach((id) => (before[id] = original.get(id) ?? null));
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2), 'utf-8');
  console.log(`\n💾 변경 전 문서 ${touched.size}건 백업: ${backupPath}`);

  const batch = db.batch();
  for (const p of plans) {
    const ref = colRef.doc(p.id);
    if (p.kind === 'create') batch.create(ref, p.data!);
    else if (p.kind === 'update') batch.update(ref, p.data!);
    else batch.delete(ref);
  }
  await batch.commit();
  console.log(`✅ 적용 완료 (한 번의 배치로 ${plans.length}건)\n`);
}

main().catch((e) => {
  console.error('❌ 실패:', e);
  process.exit(1);
});
