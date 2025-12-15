import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../src/config/firebaseConfig';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const TEST_SERVER_GROUP_ID = 'SG00001';

async function addPlannerRole() {
  console.log('🔄 Logging in as planner@test.com...');
  
  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, 'planner@test.com', '123456');
    console.log('✅ Logged in successfully!');
  } catch (e: any) {
    console.error('❌ Login failed:', e.code);
    process.exit(1);
  }

  const user = userCredential.user;
  const membershipId = `${user.uid}_${TEST_SERVER_GROUP_ID}`;

  console.log(`🚀 Adding membership for user ${user.uid} as planner...`);

  const memRef = doc(db, 'memberships', membershipId);

  await setDoc(memRef, {
    uid: user.uid,
    server_group_id: TEST_SERVER_GROUP_ID,
    role: 'planner',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`✅ Membership ${membershipId} created! Role: PLANNER`);
}

addPlannerRole()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed to add planner role:', err);
    process.exit(1);
  });
