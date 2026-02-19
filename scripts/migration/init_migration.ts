import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const admin = require('firebase-admin');

console.log('Current Key File Dir:', __dirname);
const sourcePath = path.resolve(__dirname, '../service-account.json');
const targetPath = path.resolve(__dirname, '../../../Ordo/service-account.json');
console.log('Source Key Path:', sourcePath);
console.log('Target Key Path:', targetPath);

let sourceServiceAccount, targetServiceAccount;
try {
  sourceServiceAccount = require(sourcePath);
  console.log('✅ Loaded Source Key');
} catch (e) {
  console.error('❌ Failed to load Source Key:', e);
  process.exit(1);
}

try {
  targetServiceAccount = require(targetPath);
  console.log('✅ Loaded Target Key');
} catch (e) {
  console.error('❌ Failed to load Target Key:', e);
  process.exit(1);
}

// -------------------------------------------------------------
// 2. Firebase App 초기화 (Source & Target)
// -------------------------------------------------------------

// (A) Source: Altar Scheduler
const sourceApp = admin.initializeApp(
  {
    credential: admin.credential.cert(sourceServiceAccount),
    // databaseURL: 'https://altar-scheduler-dev.firebaseio.com',
  },
  'sourceApp'
);

// (B) Target: Ordo
const targetApp = admin.initializeApp(
  {
    credential: admin.credential.cert(targetServiceAccount),
    // databaseURL: 'https://ordo-eb11a.firebaseio.com',
  },
  'targetApp'
);

// -------------------------------------------------------------
// 3. Firestore & Auth 인스턴스
// -------------------------------------------------------------
const sourceDB = sourceApp.firestore();
const targetDB = targetApp.firestore();

const sourceAuth = sourceApp.auth();
const targetAuth = targetApp.auth();

export { sourceDB, targetDB, sourceAuth, targetAuth };
