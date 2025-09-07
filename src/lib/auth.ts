// src/lib/auth.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import type { User } from "firebase/auth";

import { firebaseConfig } from "../config/firebaseConfig";

// Firebase 초기화
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/** Google 로그인 (Popup) */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In error:", error);
    return null;
  }
}

/** 로그아웃 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/** Auth 상태 구독 */
export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
