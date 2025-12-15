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
} from 'firebase/auth';

import { auth } from './firebase';
export { auth };

/* ---------------- Google ---------------- */

// Google Provider
const googleProvider = new GoogleAuthProvider();

/* ---------------- Google ---------------- */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Popup 로그인 실패:', err);
    throw err; // 리다이렉트 대신 에러 전파 (UI에서 경고)
  }
}



export async function checkRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (err) {
    console.error('Redirect 로그인 에러:', err);
    throw err; // 에러를 상위로 전파하여 UI에서 처리
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
