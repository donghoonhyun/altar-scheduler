import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";

// ── 클라우드 Functions 리전 (배포 시 사용) ──────────────────────────
// 서울(Gen2) → "asia-northeast3"
// 도쿄(Gen1, 무료 Spark 가능) → "asia-northeast1"
const CLOUD_FUNCTIONS_REGION = "asia-northeast3";

// ── 환경변수에서 Firebase Config 불러오기 ──────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,
  appId: import.meta.env.VITE_FIREBASE_APP_ID!,
};
for (const [k, v] of Object.entries(firebaseConfig)) {
  if (!v) console.error(`[firebaseConfig] Missing required: ${k}`);
}

// ── 초기화 ──────────────────────────────────────────────────────────
export const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);
export const googleProvider = new GoogleAuthProvider();

// Firestore
export const db = getFirestore(app);

// ── Functions 인스턴스 생성: 로컬 vs 배포 ───────────────────────────
let functions; // functions 인스턴스를 선언
type CreateParishInput = { name: string; time_zone?: string };
type CreateParishOutput = { parish_id: string };
export let createParishFn: (
  data: CreateParishInput
) => Promise<{ data: CreateParishOutput }>;

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  // 로컬 개발: region 없는 인스턴스 + 에뮬레이터 연결 (리전 명시)
  // ✨ 핵심 변경 사항: 로컬에서도 CLOUD_FUNCTIONS_REGION을 명시적으로 전달합니다.
  functions = getFunctions(app, CLOUD_FUNCTIONS_REGION);
  connectFunctionsEmulator(functions, "localhost", 5001); //127.0.0.1

  connectFirestoreEmulator(db, "localhost", 8080); //127.0.0.1

  console.log("[firebase] Connected to local emulators.");

  // 로컬 환경에서 httpsCallable 함수를 생성
  createParishFn = httpsCallable<CreateParishInput, CreateParishOutput>(
    functions,
    "createParish"
  );
} else {
  // 실제 배포: 지정 리전으로 연결
  functions = getFunctions(app, CLOUD_FUNCTIONS_REGION);

  // 배포 환경에서 httpsCallable 함수를 생성
  createParishFn = httpsCallable<CreateParishInput, CreateParishOutput>(
    functions,
    "createParish"
  );
}

export { functions };
