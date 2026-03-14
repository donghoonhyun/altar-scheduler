/**
 * migrate_collections.ts
 * Firestore /memberships, /server_groups 이관
 *
 * 이관 대상:
 *   Source /memberships          → Target app_datas/ordo-altar/memberships
 *   Source /server_groups        → Target app_datas/ordo-altar/server_groups (서브컬렉션 포함)
 *
 * 제외 대상:
 *   /parishes, /system_notification_logs, /system_settings, /system_sms_logs, /counters
 *
 * 전략:
 *   - 이미 Target에 존재하는 문서는 merge(update)
 *   - UID 매핑 적용 (uid, user_id, parent_uid, member_id 필드)
 *   - 서브컬렉션 재귀 이관
 *   - DryRun=true 시 실제 쓰기 없이 카운트만
 */
import { sourceDB, targetDB } from './init_migration';
import { loadUidMap, uidMap } from './migrate_auth';
import { Timestamp } from 'firebase-admin/firestore';

const TARGET_ROOT = 'app_datas/ordo-altar';

// 이관 컬렉션 매핑: source 경로 → target 경로
const COLLECTION_MAPPING: Record<string, string> = {
  'memberships': `${TARGET_ROOT}/memberships`,
  'server_groups': `${TARGET_ROOT}/server_groups`,
};

// 제외 컬렉션 (명시적으로 제외)
const EXCLUDED_COLLECTIONS = new Set([
  'parishes',
  'system_notification_logs',
  'system_settings',
  'system_sms_logs',
  'counters',
  'users', // users는 migrate_users.ts에서 별도 처리
]);

// memberships 문서 ID 재매핑: "{srcUid}_{sgId}" → "{targetUid}_{sgId}"
function remapMembershipDocId(srcDocId: string): string {
  // 형식: {uid}_{server_group_id}
  const underscoreIdx = srcDocId.indexOf('_');
  if (underscoreIdx === -1) return srcDocId;

  const srcUid = srcDocId.substring(0, underscoreIdx);
  const rest = srcDocId.substring(underscoreIdx); // "_SG00001" 등
  const targetUid = uidMap[srcUid] ?? srcUid;
  return `${targetUid}${rest}`;
}

// UID 관련 필드 매핑 적용
function applyUidMapping(data: FirebaseFirestore.DocumentData): FirebaseFirestore.DocumentData {
  const result = { ...data };

  const uidFields = ['uid', 'user_id', 'parent_uid', 'updated_by', 'executed_by'];
  for (const field of uidFields) {
    if (result[field] && typeof result[field] === 'string' && uidMap[result[field]]) {
      result[field] = uidMap[result[field]];
    }
  }

  // member_ids: string[] 배열 내 UID 매핑
  if (Array.isArray(result['member_ids'])) {
    result['member_ids'] = result['member_ids'].map((id: string) => uidMap[id] ?? id);
  }

  // not_available_members: string[] 배열 내 UID 매핑
  if (Array.isArray(result['not_available_members'])) {
    result['not_available_members'] = result['not_available_members'].map((id: string) => uidMap[id] ?? id);
  }

  return result;
}

// server_groups 서브컬렉션 중 멤버 UID 관련 처리가 필요한 것들
// memberId가 member_id(복사 고유 ID)인 경우 UID 매핑 불필요할 수 있으나
// parent_uid는 매핑 필요
function getTargetDocId(
  colPath: string,
  srcDocId: string
): string {
  // memberships 최상위 문서 ID 재매핑
  if (colPath === 'memberships') {
    return remapMembershipDocId(srcDocId);
  }
  return srcDocId;
}

// 서브컬렉션 재귀 이관
async function migrateCollectionRecursive(
  srcColPath: string,
  tgtColPath: string,
  dryRun: boolean,
  depth: number,
  stats: { docs: number; batched: number }
): Promise<void> {
  const snapshot = await sourceDB.collection(srcColPath).get();
  if (snapshot.empty) return;

  const indent = '  '.repeat(depth + 1);
  const BATCH_SIZE = 400;
  let batch = targetDB.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    stats.docs++;
    const srcDocId = doc.id;

    // 최상위 컬렉션명 추출 (경로에서 첫 번째 세그먼트)
    const topLevelCol = srcColPath.split('/')[0];
    const targetDocId = getTargetDocId(topLevelCol, srcDocId);

    const transformedData = applyUidMapping(doc.data());
    const targetRef = targetDB.collection(tgtColPath).doc(targetDocId);

    if (!dryRun) {
      batch.set(targetRef, transformedData, { merge: true });
      batchCount++;
      stats.batched++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = targetDB.batch();
        batchCount = 0;
        process.stdout.write(`${indent}  ... ${stats.batched}건 처리 중\r`);
      }
    } else {
      // DryRun: 상위 레벨만 로그 (depth 0, 1)
      if (depth <= 1) {
        console.log(`${indent}📋 [DRYRUN] ${tgtColPath}/${targetDocId}`);
      }
    }

    // 서브컬렉션 재귀 처리
    const subcols = await doc.ref.listCollections();
    for (const subcol of subcols) {
      const subSrcPath = `${srcColPath}/${srcDocId}/${subcol.id}`;
      const subTgtPath = `${tgtColPath}/${targetDocId}/${subcol.id}`;
      await migrateCollectionRecursive(subSrcPath, subTgtPath, dryRun, depth + 1, stats);
    }
  }

  // 남은 배치 커밋
  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }
}

export async function migrateCollections(dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 [컬렉션 이관] DryRun=${dryRun}`);
  console.log(`${'='.repeat(60)}`);

  // UID 매핑 로드
  loadUidMap();

  // Target 루트 문서 확인/생성 (app_datas/ordo-altar)
  if (!dryRun) {
    await targetDB.doc(TARGET_ROOT).set(
      { updated_at: Timestamp.now() },
      { merge: true }
    );
    console.log(`  ✅ Target 루트 문서 확인: ${TARGET_ROOT}`);
  }

  const totalStats = { docs: 0, batched: 0 };

  for (const [srcCol, tgtPath] of Object.entries(COLLECTION_MAPPING)) {
    if (EXCLUDED_COLLECTIONS.has(srcCol)) {
      console.log(`\n  ⏭️  [SKIP] ${srcCol} (제외 대상)`);
      continue;
    }

    console.log(`\n  📂 이관 시작: /${srcCol} → ${tgtPath}`);
    const colStats = { docs: 0, batched: 0 };
    await migrateCollectionRecursive(srcCol, tgtPath, dryRun, 0, colStats);
    totalStats.docs += colStats.docs;
    totalStats.batched += colStats.batched;
    console.log(`     완료: ${colStats.docs}개 문서 처리`);
  }

  console.log('\n📊 [컬렉션 이관 결과]');
  console.log(`  전체 문서 수:  ${totalStats.docs}`);
  if (!dryRun) {
    console.log(`  실제 쓰기 수:  ${totalStats.batched}`);
  }
}
