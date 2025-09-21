// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator,
} from "firebase/functions";

import { firebaseConfig } from "../config/firebaseConfig";

// Firebase App 초기화
export const app = initializeApp(firebaseConfig);

// Auth 인스턴스
export const auth = getAuth(app);

// Firestore 인스턴스
export const db = getFirestore(app);

// Functions 인스턴스
export const functions = getFunctions(app);

// ✅ 개발 환경이면 Emulator 연결
if (location.hostname === "localhost" || import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001); // ✅ 추가
  console.log("✅ Auth/Firestore/Functions Emulator 연결됨");
}
