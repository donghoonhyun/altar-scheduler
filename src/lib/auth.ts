// src/lib/auth.ts
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User,
} from "firebase/auth";

import { app } from "./firebase";

// Auth 인스턴스
export const auth = getAuth(app);

// ✅ 개발 환경이면 Auth Emulator 연결
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  console.log("✅ Auth Emulator 연결됨");
}

// Google Provider
const googleProvider = new GoogleAuthProvider();

/* ---------------- Google ---------------- */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.warn("Popup 실패, redirect로 시도:", err);
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
}

export async function checkRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (err) {
    console.error("Redirect 로그인 에러:", err);
    return null;
  }
}

/* ---------------- Email/Password ---------------- */
export async function signInWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

/* ---------------- Session & Logout ---------------- */
export async function signOutUser() {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
