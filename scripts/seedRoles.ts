// scripts/seedRoles.ts
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: "altar-scheduler-dev" });

const auth = getAuth();
const db = getFirestore();

// ⚡ 테스트용 성당 코드
const TEST_PARISH_CODE = "DAEGU-BEOMEO";
// ⚡ 테스트용 서버그룹 코드 (5자리 zero-padding)
const TEST_SERVER_GROUP_ID = "SG00001";

// 샘플 유저 정의
const USERS = [
  {
    uid: "admin-test-uid",
    email: "admin@test.com",
    password: "123456",
    displayName: "Admin User",
    roleDocs: [
      {
        collection: "system_roles",
        docId: "admin-test-uid",
        data: { role: "admin" },
      },
    ],
  },
  {
    uid: "manager-test-uid",
    email: "manager@test.com",
    password: "123456",
    displayName: "Manager User",
    roleDocs: [
      {
        collection: "parish_roles",
        docId: `manager-test-uid_${TEST_PARISH_CODE}`,
        data: { parish_code: TEST_PARISH_CODE, role: "manager" },
      },
    ],
  },
  {
    uid: "planner-test-uid",
    email: "planner@test.com",
    password: "123456",
    displayName: "Planner User",
    roleDocs: [
      {
        collection: "memberships",
        docId: `planner-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: "planner",
        },
      },
    ],
  },
  {
    uid: "server-test-uid",
    email: "server@test.com",
    password: "123456",
    displayName: "Server User",
    roleDocs: [
      {
        collection: "memberships",
        docId: `server-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: "server",
        },
      },
    ],
  },
];

async function seed() {
  console.log("✅ Firebase Admin 연결됨 (Emulator, altar-scheduler-dev)");

  for (const u of USERS) {
    // 1. Auth 계정 생성/확인
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

    // 2. roles 문서 생성
    for (const r of u.roleDocs) {
      await db.collection(r.collection).doc(r.docId).set({
        ...r.data,
        created_at: new Date(),
      });
      console.log(`✅ Firestore 문서 생성: ${r.collection}/${r.docId}`);
    }

    // 3. users 프로필 생성
    await db.collection("users").doc(u.uid).set({
      uid: u.uid,
      email: u.email,
      display_name: u.displayName,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  // 4. server_groups 문서도 생성 (테스트용 SG00001)
  await db.collection("server_groups").doc(TEST_SERVER_GROUP_ID).set({
    server_group_id: TEST_SERVER_GROUP_ID,
    parish_code: TEST_PARISH_CODE,
    name: "범어성당 복사단 1그룹",
    active: true, // ✅ 활성화 여부 필드 추가
    created_at: new Date(),
    updated_at: new Date(),
  });
  console.log(`✅ server_groups/${TEST_SERVER_GROUP_ID} 문서 생성`);

  console.log("🎉 모든 시드 작업 완료");
}

seed().catch((err) => {
  console.error("❌ 시드 작업 실패:", err);
  process.exit(1);
});
