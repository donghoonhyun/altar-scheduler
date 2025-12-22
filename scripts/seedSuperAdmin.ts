import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ projectId: 'altar-scheduler-dev' });
const db = getFirestore();

const TARGET_UID = 'pongso-hyun-uid'; // 현동훈 (개발자)

async function seedSuperAdmin() {
  console.log(`Build Super Admin for UID: ${TARGET_UID}`);

  // memberships/uid_global
  const docId = `${TARGET_UID}_global`;
  const ref = db.collection('memberships').doc(docId);

  await ref.set({
    uid: TARGET_UID,
    server_group_id: 'global', // 시스템 전역을 의미하는 가상 그룹 ID
    parish_code: 'system',
    role: ['superadmin'],
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });

  console.log(`✅ Super Admin 권한 부여 완료: memberships/${docId}`);
}

seedSuperAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
