import { sourceDB, targetDB } from './init_migration';
import { uidMap } from './migrate_users';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// -------------------------------------------------------------
// 0. Configuration: Target Paths
// -------------------------------------------------------------
const TARGET_ROOT = 'app_datas/ordo-altar';

const COLLECTION_MAPPING: Record<string, string> = {
  // Source Collection -> Target Collection (Relative to dbRoot or under 'v1')
  'users': 'users', // Shared Collection (Root Level)
  'parishes': 'parishes', // Shared Collection (Root Level) - checking conflicts might be needed
  'server_groups': `${TARGET_ROOT}/server_groups`,
  'memberships': `${TARGET_ROOT}/memberships`,
  'counters': `${TARGET_ROOT}/counters`,
  'system_notification_logs': `${TARGET_ROOT}/notifications`,
  'system_settings': `${TARGET_ROOT}/settings`,
  'system_sms_logs': `${TARGET_ROOT}/sms_logs`,
};

// -------------------------------------------------------------
// 1. Core Migration Function
// -------------------------------------------------------------
export async function migrateFirestoreData() {
  console.log('🚀 Starting Firestore Migration...');

  // 1-1. Migrate App-Specific Collections
  // Ensure the root document exists so it can be discovered by export scripts
  console.log('📦 Ensuring root document [app_datas/ordo-altar] exists...');
  await targetDB.doc('app_datas/ordo-altar').set({
      created_at: Timestamp.now(),
      description: 'Root document for Altar Scheduler (ordo-altar)'
  }, { merge: true });

  for (const [sourceCol, targetPath] of Object.entries(COLLECTION_MAPPING)) {
    console.log(`\n📦 Migrating Collection: [${sourceCol}] -> [${targetPath}]`);
    await migrateCollection(sourceCol, targetPath);
  }

  // 1-2. Migrate Shared Data (Optional - Parishes/Users)
  // Parishes: Ordo에 이미 있으면 Skip, 없으면 추가. (충돌 방지 로직 필요)
  // Users: Auth 마이그레이션에서 처리함. 추가 프로필 정보가 있다면 여기서 이관.
}


async function migrateCollection(sourcePath: string, targetPath: string) {
  const snapshot = await sourceDB.collection(sourcePath).get();
  
  if (snapshot.empty) {
    console.log(`   (Empty collection: ${sourcePath})`);
    return;
  }

  let count = 0;
  const batchSize = 400; // Firestore batch limit is 500
  let batch = targetDB.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;

    // ---------------------------------------------------------
    // 2. Data Transformation (UID Check, Field Rename)
    // ---------------------------------------------------------
    const transformedData = transformData(data);

    // Map Document ID if it's in uidMap (mainly for 'users' collection or specific ID docs)
    // For 'users' collection, docId IS the UID.
    const targetDocId = uidMap[docId] || docId;

    const targetRef = targetDB.collection(targetPath).doc(targetDocId);
    batch.set(targetRef, transformedData, { merge: true }); // Use merge: true for safety
    count++;

    if (count % batchSize === 0) {
      await batch.commit();
      batch = targetDB.batch();
      console.log(`   Migrated ${count} documents...`);
    }

    // ---------------------------------------------------------
    // 3. Migrate Subcollections (Recursive)
    // ---------------------------------------------------------
    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      const subSourcePath = `${sourcePath}/${docId}/${subcol.id}`;
      // Use mapped ID for subcollection path
      const subTargetPath = `${targetPath}/${targetDocId}/${subcol.id}`;
      // console.log(`   -> Subcollection: ${subcol.id}`);
      await migrateCollection(subSourcePath, subTargetPath);
    }
  }

  if (count % batchSize !== 0) {
    await batch.commit();
  }
  console.log(`✅ Collection [${sourcePath}] Done. Total: ${count}`);
}


// -------------------------------------------------------------
// Helper: Data Transformation
// -------------------------------------------------------------
function transformData(data: FirebaseFirestore.DocumentData): FirebaseFirestore.DocumentData {
  const newData = { ...data };

  // 1. UID Reference Update (fk_uid -> mapped_uid)
  // data 내에 uid 필드가 있거나, user_id 등의 필드가 있다면 매핑 확인
  // 예: newData['uid'] = uidMap[data['uid']] || data['uid'];
  // 현재는 Auth Migration에서 UID를 최대한 유지하려 했으므로,
  // 1차적으로는 그대로 둠. 만약 UID 충돌로 바뀐 유저가 있다면 uidMap을 참조해야 함.

  if (newData.uid && uidMap[newData.uid]) {
    newData.uid = uidMap[newData.uid];
  }
  if (newData.user_id && uidMap[newData.user_id]) {
    newData.user_id = uidMap[newData.user_id];
  }
  
  // 2. Timestamp Handling (Optional Check)
  // Firestore Timestamp 객체는 그대로 유지됨.

  return newData;
}
