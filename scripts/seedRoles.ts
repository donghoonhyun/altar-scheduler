// scripts/seedRoles.ts
import "dotenv/config";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// ✅ Auth Emulator 강제 연결
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

// ✅ Firebase Client SDK (Firestore용)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "fake-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "altar-scheduler-dev",
  appId: process.env.VITE_FIREBASE_APP_ID || "fake-app-id",
};
const clientApp = initializeClientApp(firebaseConfig);
const db = getFirestore(clientApp);

// ✅ Firestore Emulator 연결
if (process.env.USE_FIRESTORE_EMULATOR === "true") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  console.log("✅ Firestore Emulator에 연결되었습니다.");
}

// ✅ Firebase Admin SDK (Auth Emulator)
const adminApp = initializeAdminApp({ projectId: "altar-scheduler-dev" });
const adminAuth = getAdminAuth(adminApp);

// 샘플 계정 목록
const USERS = [
  {
    uid: "admin-test-uid",
    email: "admin@test.com",
    password: "123456",
    displayName: "Admin User",
    roleDoc: {
      collection: "system_roles",
      docId: "admin-test-uid",
      data: { role: "admin" },
    },
  },
  {
    uid: "manager-test-uid",
    email: "manager@test.com",
    password: "123456",
    displayName: "Manager User",
    roleDoc: {
      collection: "parish_roles",
      docId: "manager-test-uid_SMP001",
      data: { parish_code: "SMP001", role: "manager" },
    },
  },
  {
    uid: "planner-test-uid",
    email: "planner@test.com",
    password: "123456",
    displayName: "Planner User",
    roleDoc: {
      collection: "memberships",
      docId: "planner-test-uid_SG001",
      data: { server_group_id: "SG001", role: "planner" },
    },
  },
  {
    uid: "server-test-uid",
    email: "server@test.com",
    password: "123456",
    displayName: "Server User",
    roleDoc: {
      collection: "memberships",
      docId: "server-test-uid_SG001",
      data: { server_group_id: "SG001", role: "server" },
    },
  },
];

async function seed() {
  for (const u of USERS) {
    // 🔹 Auth 계정 생성 (이미 있으면 업데이트)
    try {
      await adminAuth.createUser({
        uid: u.uid,
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      });
      console.log(`✅ Auth 사용자 생성: ${u.uid}`);
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err) {
        const code = (err as { code: string }).code;
        if (
          code === "auth/uid-already-exists" ||
          code === "auth/email-already-exists"
        ) {
          console.log(`ℹ️ 이미 존재하는 사용자: ${u.uid}, 업데이트 시도`);
          await adminAuth.updateUser(u.uid, {
            email: u.email,
            password: u.password,
            displayName: u.displayName,
          });
        } else {
          console.error(`❌ 사용자 생성 실패 (${u.uid}):`, err);
        }
      } else {
        console.error("❌ 알 수 없는 오류:", err);
      }
    }

    // 🔹 Firestore roles 문서 생성
    await setDoc(doc(db, u.roleDoc.collection, u.roleDoc.docId), {
      ...u.roleDoc.data,
      created_at: new Date(),
    });
    console.log(
      `✅ Firestore 문서 생성: ${u.roleDoc.collection}/${u.roleDoc.docId}`
    );

    // 🔹 Firestore users 문서 생성 (항상 덮어쓰기)
    await setDoc(
      doc(db, "users", u.uid),
      {
        uid: u.uid, // ✅ uid 필드 포함
        email: u.email,
        displayName: u.displayName,
        created_at: new Date(),
      },
      { merge: false } // ✅ 무조건 새로 덮어쓰기
    );
    console.log(`✅ Firestore 문서 생성(덮어쓰기): users/${u.uid}`);
  }

  console.log("🎉 Seed 완료: Auth + Roles + Users");
}

seed().catch(console.error);
