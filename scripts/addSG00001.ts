import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// 실제 프로젝트 ID 명시
const PROJECT_ID = 'altar-scheduler-dev';

// Firebase Admin 초기화
// 로컬에서 gcloud auth application-default login 으로 로그인되어 있다면 applicationDefault() 사용 가능
// 아니면 서비스 계정 키가 필요할 수 있음. 일단 applicationDefault 시도.
initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const db = getFirestore();

const TEST_PARISH_CODE = 'DAEGU-BEOMEO';
const TEST_SERVER_GROUP_ID = 'SG00001';

async function addServerGroup() {
  console.log(`🚀 Adding server_groups/${TEST_SERVER_GROUP_ID} to ${PROJECT_ID}...`);

  const sgRef = db.collection('server_groups').doc(TEST_SERVER_GROUP_ID);
  
  // 기존 문서가 있는지 확인 후 덮어쓸지 결정 (여기서는 set으로 덮어씀)
  await sgRef.set({
    server_group_id: TEST_SERVER_GROUP_ID,
    parish_code: TEST_PARISH_CODE,
    name: '🎒초등부 복사단',
    timezone: 'Asia/Seoul',
    locale: 'ko-KR',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`✅ Document server_groups/${TEST_SERVER_GROUP_ID} created successfully!`);
}

addServerGroup().catch((err) => {
  console.error('❌ Failed to add document:', err);
  process.exit(1);
});
