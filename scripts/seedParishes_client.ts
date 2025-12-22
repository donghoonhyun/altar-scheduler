import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../src/config/firebaseConfig';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PARISHES = [
  { code: "DAEGU-BEOMEO", name_kor: "대구 범어성당", diocese: "대구교구", name_eng: "Beomeo Cathedral" },
  { code: "SUWON-SINBONG", name_kor: "수지 신봉성당", diocese: "수원교구", name_eng: "Sinbong Cathedral" },
];

async function seedParishes() {
  console.log('🚀 Seeding parishes to LIVE Firestore (using client SDK)...');
  
  for (const parish of PARISHES) {
    const ref = doc(db, 'parishes', parish.code);
    await setDoc(ref, {
      ...parish,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }, { merge: true });
    
    console.log(`✅ Uploaded: ${parish.name_kor} (${parish.code})`);
  }

  console.log('🎉 All parishes seeded successfully!');
  process.exit(0);
}

seedParishes().catch((err) => {
  console.error('❌ Error seeding parishes:', err);
  process.exit(1);
});
