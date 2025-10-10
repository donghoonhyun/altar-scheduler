import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore'; // ✅ FieldValue 사용
import { SERVERS } from './data/servers_with_id';
import { seedMassEvents } from './utils/seedUtils';
import { EXTRA_EVENTS } from './data/massEvents_SG00001_202509'; // 없으면 빈 배열 []

initializeApp({ projectId: 'altar-scheduler-dev' });

const auth = getAuth();
const db = getFirestore();

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('🔥 Auth Emulator 연결:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
  // firebase-admin v11 이상에서는 아래 코드 필요 없지만 보호용으로 추가해도 무방
  // auth.useEmulator(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
}

const TEST_PARISH_CODE = 'DAEGU-BEOMEO';
const TEST_SERVER_GROUP_ID = 'SG00001';

const USERS = [
  {
    uid: 'planner-test-uid',
    email: 'planner@test.com',
    password: '123456',
    displayName: 'Planner User',
    roleDocs: [
      {
        collection: 'memberships',
        docId: `planner-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: 'planner-test-uid',
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: 'planner',
        },
      },
    ],
  },
  {
    uid: 'server-test-uid',
    email: 'server@test.com',
    password: '123456',
    displayName: 'Server User',
    roleDocs: [
      {
        collection: 'memberships',
        docId: `server-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: 'server-test-uid',
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: 'server',
        },
      },
    ],
  },
];

async function seed() {
  console.log('✅ Firebase Admin 연결됨 (Emulator, altar-scheduler-dev)');

  // 1️⃣ USERS
  for (const u of USERS) {
    try {
      await auth.getUser(u.uid);
      console.log(`ℹ️ 이미 존재하는 유저: ${u.email}`);
    } catch {
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      });
      console.log(`✅ Auth 사용자 생성: ${u.email}`);
    }

    for (const r of u.roleDocs) {
      await db
        .collection(r.collection)
        .doc(r.docId)
        .set({
          ...r.data,
          created_at: new Date(),
          updated_at: new Date(),
        });
      console.log(`> Firestore memberships 문서 생성: ${r.docId}`);
    }

    await db.collection('users').doc(u.uid).set({
      uid: u.uid,
      email: u.email,
      display_name: u.displayName,
      created_at: new Date(),
      updated_at: new Date(),
    });
    console.log(`> Firestore users 문서 생성: ${u.uid}`);
  }

  // 2️⃣ server_groups
  const sgRef = db.collection('server_groups').doc(TEST_SERVER_GROUP_ID);
  await sgRef.set({
    server_group_id: TEST_SERVER_GROUP_ID,
    parish_code: TEST_PARISH_CODE,
    name: '범어성당 복사단 1그룹',
    timezone: 'Asia/Seoul',
    locale: 'ko-KR',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  console.log(`✅ server_groups/${TEST_SERVER_GROUP_ID} 문서 생성`);

  // 3️⃣ members
  const batch = db.batch();
  SERVERS.forEach((s) => {
    const mRef = sgRef.collection('members').doc(s.member_id);
    batch.set(mRef, {
      ...s,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });
  await batch.commit();
  console.log(`✅ ${SERVERS.length}명 복사단원 추가 완료`);

  // 4️⃣ mass_events (2025-09)
  console.log('📌 2025-09 미사일정 시드 시작...');
  await seedMassEvents(TEST_SERVER_GROUP_ID, 2025, 9, EXTRA_EVENTS);

  // 5️⃣ month_status (202509)
  const monthKey = '202509';
  const monthStatusRef = db
    .collection('server_groups')
    .doc(TEST_SERVER_GROUP_ID)
    .collection('month_status')
    .doc(monthKey);

  await monthStatusRef.set({
    status: 'MASS-NOTCONFIRMED',
    lock: false,
    note: '시드 초기 상태',
    updated_by: 'seed@system',
    updated_at: FieldValue.serverTimestamp(), // ✅ Admin SDK 방식
  });

  console.log(`✅ month_status/${monthKey} 문서 생성 (MASS-NOTCONFIRMED)`);

  console.log('🎉 모든 시드 작업 완료');
}

seed().catch((err) => {
  console.error('❌ 시드 작업 실패:', err);
  process.exit(1);
});
