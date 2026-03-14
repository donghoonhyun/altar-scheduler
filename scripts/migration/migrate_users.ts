/**
 * migrate_users.ts
 * Firestore /users 컬렉션 이관
 *
 * 전략:
 * - Source(altar-scheduler-dev) /users/{uid} → Target(ordo-eb11a) /users/{mappedUid}
 * - Ordo users 스키마에 정의된 필드만 복사 (무관 필드 제외)
 * - Target에 이미 users/{mappedUid} 문서가 존재하면 건너뜀 (Ordo 데이터 보호)
 * - 신규 사용자만 생성
 *
 * Ordo users 스키마 허용 필드:
 *   uid, email, user_name, baptismal_name, user_category, phone,
 *   created_at, updated_at, fcm_tokens (마이그 시 제외), managerParishes (마이그 시 제외)
 */
import { sourceDB, targetDB } from './init_migration';
import { loadUidMap, uidMap } from './migrate_auth';
import { Timestamp } from 'firebase-admin/firestore';

// Ordo users 스키마에서 허용하는 필드 목록
// fcm_tokens, managerParishes는 이관하지 않음 (운영 중 자동 관리 필드)
const ALLOWED_USER_FIELDS = new Set([
  'uid',
  'email',
  'user_name',
  'baptismal_name',
  'user_category', // source에 없으면 그냥 없는 채로 생성
  'phone',
  'created_at',
  'updated_at',
]);

type UserCategory = 'Father' | 'Sister' | 'Layman';
const VALID_USER_CATEGORIES: UserCategory[] = ['Father', 'Sister', 'Layman'];

function transformUserDoc(
  srcData: FirebaseFirestore.DocumentData,
  srcUid: string,
  targetUid: string
): FirebaseFirestore.DocumentData | null {
  const result: FirebaseFirestore.DocumentData = {};

  // 허용 필드만 복사
  for (const field of ALLOWED_USER_FIELDS) {
    if (srcData[field] !== undefined) {
      result[field] = srcData[field];
    }
  }

  // uid는 반드시 target uid로 덮어씀
  result['uid'] = targetUid;

  // user_category 유효성 검증 (없거나 잘못된 값이면 제외)
  if (result['user_category'] && !VALID_USER_CATEGORIES.includes(result['user_category'])) {
    console.warn(`    ⚠️  user_category 값 무효: "${result['user_category']}" → 제외`);
    delete result['user_category'];
  }

  // email 없으면 이관 불가
  if (!result['email']) {
    console.warn(`    ⚠️  [SKIP] uid=${srcUid}: email 없음`);
    return null;
  }

  // updated_at이 없으면 현재 시각으로
  if (!result['updated_at']) {
    result['updated_at'] = Timestamp.now();
  }

  return result;
}

export async function migrateUsers(dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`👤 [/users 이관] DryRun=${dryRun}`);
  console.log(`${'='.repeat(60)}`);

  // UID 매핑 로드 (auth 이관 이후에 실행되므로 이미 로드됐을 수 있음)
  loadUidMap();

  const snapshot = await sourceDB.collection('users').get();
  if (snapshot.empty) {
    console.log('  (source /users 컬렉션 비어 있음)');
    return;
  }

  console.log(`  source /users 문서 수: ${snapshot.size}`);

  const stats = { total: 0, created: 0, skipped_exists: 0, skipped_no_email: 0, errors: 0 };
  const BATCH_SIZE = 400;
  let batch = targetDB.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    stats.total++;
    const srcUid = doc.id;
    const srcData = doc.data();

    // UID 매핑 적용
    const targetUid = uidMap[srcUid] ?? srcUid;

    // Target에 이미 존재하는지 확인
    const targetRef = targetDB.collection('users').doc(targetUid);
    const existing = await targetRef.get();

    if (existing.exists) {
      stats.skipped_exists++;
      console.log(`  ⏭️  [SKIP-EXISTS] users/${targetUid} (${srcData['email'] ?? srcUid})`);
      continue;
    }

    // 데이터 변환
    const transformed = transformUserDoc(srcData, srcUid, targetUid);
    if (!transformed) {
      stats.skipped_no_email++;
      continue;
    }

    if (!dryRun) {
      batch.set(targetRef, transformed);
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = targetDB.batch();
        batchCount = 0;
        console.log(`    ... ${stats.created + batchCount}개 처리 중`);
      }
    } else {
      console.log(`  📋 [DRYRUN] 생성 예정: users/${targetUid} (${transformed['email']})`);
    }

    stats.created++;
  }

  // 남은 배치 커밋
  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log('\n📊 [/users 이관 결과]');
  console.log(`  전체:               ${stats.total}`);
  console.log(`  신규 생성:           ${stats.created}`);
  console.log(`  이미 존재(건너뜀):    ${stats.skipped_exists}`);
  console.log(`  이메일 없어 건너뜀:   ${stats.skipped_no_email}`);
  console.log(`  오류:               ${stats.errors}`);
}
