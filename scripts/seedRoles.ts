import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { SERVERS } from './data/servers_with_id';
import { seedMassEvents } from './utils/seedUtils';
import { EXTRA_EVENTS } from './data/massEvents_SG00001_202511'; // 없으면 빈 배열 []

initializeApp({ projectId: 'altar-scheduler-dev' });

const auth = getAuth();
const db = getFirestore();

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('🔥 Auth Emulator 연결:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

const TEST_PARISH_CODE = 'DAEGU-BEOMEO';
const TEST_SERVER_GROUP_ID = 'SG00001';

// 0️⃣ PARISH DATA
const PARISHES = [
  { code: "DAEGU-BEOMEO", name_kor: "대구 범어성당", diocese: "대구교구", name_eng: "Beomeo Cathedral", timezone: "Asia/Seoul", locale: "ko-KR", sms_service_active: true },
  { code: "SUWON-SINBONG", name_kor: "수지 신봉성당", diocese: "수원교구", name_eng: "Sinbong Cathedral", timezone: "Asia/Seoul", locale: "ko-KR" },
];

const USERS = [
  {
    uid: 'pongso-hyun-uid',
    email: 'pongso.hyun@gmail.com',
    password: '123456',
    userName: '현동훈',
    baptismalName: '알퐁소',
    roleDocs: [
      {
        collection: 'memberships',
        docId: `pongso-hyun-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: 'pongso-hyun-uid',
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: ['admin', 'planner'],
          active: true,
        },
      },
      {
        collection: 'memberships',
        docId: `pongso-hyun-uid_global`,
        data: {
          uid: 'pongso-hyun-uid',
          server_group_id: 'global',
          parish_code: 'system',
          role: ['superadmin'],
          active: true,
        },
      },
    ],
  },
  {
    uid: 'planner-test-uid',
    email: 'planner@test.com',
    password: '123456',
    userName: '김아녜스 수녀님',
    roleDocs: [
      {
        collection: 'memberships',
        docId: `planner-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: 'planner-test-uid',
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: ['planner'],
          active: true,
        },
      },
    ],
  },
  {
    uid: 'server-test-uid',
    email: 'server@test.com',
    password: '123456',
    userName: '홍길동 베드로',
    roleDocs: [
      {
        collection: 'memberships',
        docId: `server-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: 'server-test-uid',
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: ['server'],
          active: true,
        },
      },
    ],
  },
];

const SMS_LOGS = [
  {
    created_at: new Date('2025-10-01T10:00:00'),
    sender_uid: 'pongso-hyun-uid',
    sender_email: 'pongso.hyun@gmail.com',
    receiver: '01012345678',
    message: '테스트 문자 1',
    status: 'success',
    result: {
      groupId: 'GINTALIGO_1',
      to: '01012345678',
      from: '01011112222',
      type: 'SMS',
      statusMessage: '정상접수',
      messageId: 'MID_1'
    },
    error: null,
    group_id: 'GINTALIGO_1',
    parish_code: TEST_PARISH_CODE,
    server_group_id: TEST_SERVER_GROUP_ID,
  },
  {
    created_at: new Date('2025-10-02T14:30:00'),
    sender_uid: 'pongso-hyun-uid',
    sender_email: 'pongso.hyun@gmail.com',
    receiver: '01098765432',
    message: '테스트 문자 2 (실패)',
    status: 'failed',
    result: null,
    error: '잔액 부족',
    group_id: null,
    parish_code: TEST_PARISH_CODE,
    server_group_id: TEST_SERVER_GROUP_ID,
  },
    {
    created_at: new Date('2025-10-03T09:15:00'),
    sender_uid: 'pongso-hyun-uid',
    sender_email: 'pongso.hyun@gmail.com',
    receiver: '01055556666',
    message: '테스트 문자 3',
    status: 'success',
    result: {
      groupId: 'GINTALIGO_2',
      to: '01055556666',
      from: '01011112222',
      type: 'SMS',
      statusMessage: '정상접수',
      messageId: 'MID_2'
    },
    error: null,
    group_id: 'GINTALIGO_2',
    parish_code: TEST_PARISH_CODE,
    server_group_id: TEST_SERVER_GROUP_ID,
  },
  // Added for mass event notification tracking test (11/01 Mass)
  {
    created_at: new Date('2025-10-31T20:00:05'),
    sender_uid: 'pongso-hyun-uid',
    sender_email: 'pongso.hyun@gmail.com',
    receiver: '01012345678', // Park Beomseo
    message: '[알림] 내일 미사 복사 배정 안내',
    status: 'success',
    result: {
      groupId: 'G_SMS_001',
      to: '01012345678',
      from: '01011112222',
      type: 'SMS',
      statusMessage: '정상접수',
      messageId: 'MID_TEST_1'
    },
    error: null,
    group_id: 'G_SMS_001',
    parish_code: TEST_PARISH_CODE,
    server_group_id: TEST_SERVER_GROUP_ID,
  },
  {
    created_at: new Date('2025-10-31T20:00:06'),
    sender_uid: 'pongso-hyun-uid',
    sender_email: 'pongso.hyun@gmail.com',
    receiver: '01056781234', // Lee Jion
    message: '[알림] 내일 미사 복사 배정 안내',
    status: 'success',
    result: {
      groupId: 'G_SMS_001',
      to: '01056781234',
      from: '01011112222',
      type: 'SMS',
      statusMessage: '정상접수',
      messageId: 'MID_TEST_2'
    },
    error: null,
    group_id: 'G_SMS_001',
    parish_code: TEST_PARISH_CODE,
    server_group_id: TEST_SERVER_GROUP_ID,
  },
];

async function seed() {
  console.log('✅ Firebase Admin 연결됨 (Emulator, altar-scheduler-dev)');

  // 0️⃣ PARISHES
  const parishBatch = db.batch();
  for (const parish of PARISHES) {
    const ref = db.collection('parishes').doc(parish.code);
    parishBatch.set(ref, {
      ...parish,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }, { merge: true });
    console.log(`> Queued parish: ${parish.name_kor} (${parish.code})`);
  }
  await parishBatch.commit();
  console.log(`✅ ${PARISHES.length}개 성당 데이터 생성 완료`);

  // 1️⃣ USERS
  for (const u of USERS) {
    try {
      await auth.getUser(u.uid);
      console.log(`ℹ️ 이미 존재하는 유저: ${u.email} (UID: ${u.uid}) -> 비밀번호 업데이트 중...`);
      await auth.updateUser(u.uid, {
        password: u.password,
        displayName: u.userName,
      });
      console.log(`✅ Auth 사용자 업데이트 완료: ${u.email}`);
    } catch {
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        password: u.password,
        displayName: u.userName,
      });
      console.log(`✅ Auth 사용자 신규 생성: ${u.email}`);
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

    const userData: any = {
      uid: u.uid,
      email: u.email,
      user_name: u.userName,
      created_at: new Date(),
      updated_at: new Date(),
    };
    if ((u as any).baptismalName) {
      userData.baptismal_name = (u as any).baptismalName;
    }

    await db.collection('users').doc(u.uid).set(userData);
    console.log(`> Firestore users 문서 생성: ${u.uid}`);
  }

  // 2️⃣ server_groups
  const sgRef = db.collection('server_groups').doc(TEST_SERVER_GROUP_ID);
  await sgRef.set({
    server_group_id: TEST_SERVER_GROUP_ID,
    parish_code: TEST_PARISH_CODE,
    name: '🎒초등부 복사단',
    active: true,
    sms_service_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  console.log(`✅ server_groups/${TEST_SERVER_GROUP_ID} 문서 생성`);

  // 2.1 Counters
  await db.collection('counters').doc('server_groups').set({ last_seq: 1 });
  console.log('✅ counters/server_groups (last_seq: 1) 초기화 완료');

  // 3️⃣ members
  const batch = db.batch();
  SERVERS.forEach((s) => {
    const mRef = sgRef.collection('members').doc(s.member_id);
    batch.set(mRef, {
      ...s,
      active: true,
      start_year: ['2021', '2022', '2023', '2024', '2025'][Math.floor(Math.random() * 5)],
      created_at: new Date(),
      updated_at: new Date(),
    });
  });
  await batch.commit();
  console.log(`✅ ${SERVERS.length}명 복사단원 추가 완료`);

  // 4️⃣ mass_events (2025-11)
  console.log('📌 2025-11 미사일정 시드 시작...');
  await seedMassEvents(TEST_SERVER_GROUP_ID, 2025, 11, EXTRA_EVENTS);
  console.log('✅ mass_events 시드 완료');

  // 5️⃣ month_status (202511)
  const monthKey = '202511';
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
    updated_at: FieldValue.serverTimestamp(),
  });

  console.log(`✅ month_status/${monthKey} 문서 생성 (MASS-NOTCONFIRMED)`);

  // 6️⃣ mass_presets (from 2025-11 1st week: 20251102~20251108)
  console.log('📌 미사 프리셋 시드 시작...');
  const presetWeekdays: Record<string, any[]> = {
    '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': []
  };

  // 2025년 11월 2일(일) ~ 8일(토)이 첫번째 온전한 주
  const DATE_DOW_MAP: Record<string, string> = {
    '20251102': '0', // Sun
    '20251103': '1', // Mon
    '20251104': '2', // Tue
    '20251105': '3', // Wed
    '20251106': '4', // Thu
    '20251107': '5', // Fri
    '20251108': '6', // Sat
  };

  EXTRA_EVENTS.forEach((e) => {
    const dow = DATE_DOW_MAP[e.event_date];
    if (dow) {
      presetWeekdays[dow].push({
        title: e.title,
        required_servers: e.required_servers,
      });
    }
  });

  await db
    .collection('server_groups')
    .doc(TEST_SERVER_GROUP_ID)
    .collection('mass_presets')
    .doc('default')
    .set({
      weekdays: presetWeekdays,
      updated_at: FieldValue.serverTimestamp(),
    });
  console.log('✅ mass_presets/default 문서 생성');

  // 7️⃣ system_sms_logs
  console.log('📌 SMS 로그 시드 시작...');
  const smsBatch = db.batch();
  for (const log of SMS_LOGS) {
    const ref = db.collection('system_sms_logs').doc();
    smsBatch.set(ref, log);
  }
  await smsBatch.commit();
  console.log(`✅ ${SMS_LOGS.length}개 SMS 로그 생성 완료`);

  console.log('🎉 모든 시드 작업 완료');
}

seed().catch((err) => {
  console.error('❌ 시드 작업 실패:', err);
  process.exit(1);
});
