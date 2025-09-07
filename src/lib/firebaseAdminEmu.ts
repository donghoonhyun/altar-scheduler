import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// 에뮬레이터 전용 Firebase 설정 (실제 키는 필요 없음)
const firebaseConfig = {
  apiKey: "AIzaSyCBJ3pm_7AwssS03bB43_Hv6DVXkqPsiuk",
  authDomain: "localhost",
  projectId: "altar-scheduler-dev", // 프론트/백 동일한 projectId 사용
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ Firestore Emulator 연결 (포트는 firebase.json 설정 확인, 기본 8080)
connectFirestoreEmulator(db, "127.0.0.1", 8080);

export { db };
