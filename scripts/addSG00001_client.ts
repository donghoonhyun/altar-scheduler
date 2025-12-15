import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../src/config/firebaseConfig';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const TEST_PARISH_CODE = 'DAEGU-BEOMEO';
const TEST_SERVER_GROUP_ID = 'SG00001';

async function addServerGroup() {
  console.log('🔄 Logging in with test account...');
  try {
    await signInWithEmailAndPassword(auth, 'planner@test.com', '123456');
    console.log('✅ Logged in as planner@test.com');
  } catch (e: any) {
    console.log(`⚠️ Login failed (${e.code}). Trying to create user...`);
    try {
        await createUserWithEmailAndPassword(auth, 'planner@test.com', '123456');
        console.log('✅ User created and logged in!');
    } catch (createErr: any) {
        console.error('❌ Failed to create user or login:', createErr.code);
        process.exit(1);
    }
  }


  console.log(`🚀 Adding server_groups/${TEST_SERVER_GROUP_ID}...`);

  const sgRef = doc(db, 'server_groups', TEST_SERVER_GROUP_ID);

  await setDoc(sgRef, {
    server_group_id: TEST_SERVER_GROUP_ID,
    parish_code: TEST_PARISH_CODE,
    name: '범어성당 복사단 1그룹',
    timezone: 'Asia/Seoul',
    locale: 'ko-KR',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`✅ Document server_groups/${TEST_SERVER_GROUP_ID} created successfully!`);
}

addServerGroup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed to add document:', err);
    process.exit(1);
  });
