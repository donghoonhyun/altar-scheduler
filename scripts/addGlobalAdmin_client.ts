import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../src/config/firebaseConfig';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_UID = 'CqpbZdWNnUMv8dEFdvHlZ5MjtX93';
const DOC_ID = `${TARGET_UID}_global`;

async function addGlobalAdmin() {
  console.log(`🚀 Adding global admin membership for ${TARGET_UID}...`);

  const ref = doc(db, 'memberships', DOC_ID);
  
  await setDoc(ref, {
    uid: TARGET_UID,
    server_group_id: 'global',
    parish_code: 'system',
    role: ['superadmin'],
    created_at: new Date(),
    updated_at: new Date()
  });

  console.log(`✅ Membership document created: memberships/${DOC_ID}`);
  console.log(`TYPE: Global Superadmin`);
  process.exit(0);
}

addGlobalAdmin().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
