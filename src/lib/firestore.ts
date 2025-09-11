// src/lib/firestore.ts
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { firebaseConfig } from "../config/firebaseConfig";

// Firebase App (이미 firebase.ts에서 initialize 했다면 import 해서 써도 됨)
const app = initializeApp(firebaseConfig);

// Firestore 인스턴스
export const db = getFirestore(app);

// ✅ 개발 환경이면 Firestore Emulator 연결
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  console.log("✅ Firestore Emulator 연결됨");
}
