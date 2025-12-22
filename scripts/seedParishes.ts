import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'altar-scheduler-dev' });

const db = getFirestore();

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('🔥 Auth Emulator 연결:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

const PARISHES = [
  { code: "DAEGU-BEOMEO", name_kor: "대구 범어성당", diocese: "대구교구", name_eng: "Beomeo Cathedral" },
  { code: "SUWON-SINBONG", name_kor: "수지 신봉성당", diocese: "수원교구", name_eng: "Sinbong Cathedral" },
];

async function seedParishes() {
  console.log('✅ Firebase Admin 연결됨 (Emulator, altar-scheduler-dev)');

  const batch = db.batch();
  
  for (const parish of PARISHES) {
    const ref = db.collection('parishes').doc(parish.code);
    batch.set(ref, {
      ...parish,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }, { merge: true });
    console.log(`> Queued parish: ${parish.name_kor} (${parish.code})`);
  }

  await batch.commit();
  console.log(`✅ ${PARISHES.length}개 성당 데이터 Firestore 업로드 완료`);
}

seedParishes().catch((err) => {
  console.error('❌ 시드 작업 실패:', err);
  process.exit(1);
});
