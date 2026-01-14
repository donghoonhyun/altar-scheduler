import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
  EmulatorMockTokenOptions,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getMessaging } from 'firebase/messaging';
import { firebaseConfig } from '../config/firebaseConfig';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const hostname = location.hostname;
const isDev =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.startsWith('192.168.') ||
  import.meta.env.DEV;

// ✅ 개발환경용 Firestore 인스턴스 미리 생성
let db: Firestore;
const auth = getAuth(app);
const functions = getFunctions(app, 'asia-northeast3');
const messaging = getMessaging(app);

// ✅ Emulator 연결
if (isDev) {
  // Auth
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

  // Firestore
  db = getFirestore(app);
  connectFirestoreEmulator(db, 'localhost', 8080);

  // Functions
  connectFunctionsEmulator(functions, 'localhost', 5001);

  console.log('🔥 Auth/Firestore/Functions Emulator 연결됨! (firebase.ts)');
} else {
  // Production
  db = getFirestore(app);
  console.log('🌐 Production Firebase 연결됨!');
}

export { app, auth, db, functions, messaging };
