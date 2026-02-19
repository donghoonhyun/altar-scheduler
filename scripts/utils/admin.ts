import type { ServiceAccount } from 'firebase-admin';
import * as admin from 'firebase-admin';

// ✅ Service Account 절대 경로 (필요시 경로 수정)
const serviceAccount = require('../service-account.json') as ServiceAccount;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: 'https://altar-scheduler-dev.firebaseio.com',
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
