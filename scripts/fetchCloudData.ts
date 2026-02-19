
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force NO emulator for this script
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

const PROJECT_ID = 'ordo-eb11a';

// Global variables
let db: FirebaseFirestore.Firestore;
let auth: ReturnType<typeof getAuth>;

// Move initialization inside a function to catch credential errors
function initFirebase() {
    // Try to find the service account in the sibling Ordo directory first
    const serviceAccountPath = path.join(__dirname, '../../Ordo/service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        console.log('Found service-account.json in Ordo directory, using it for authentication...');
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        console.log('Using Key for Project:', serviceAccount.project_id);
        initializeApp({
            credential: cert(serviceAccount),
            // projectId: PROJECT_ID, // cert() provides the project ID
        });
    } else {
        console.warn('Ordo service-account.json not found. Warning: Might fail if not authenticated via gcloud.');
        initializeApp({
            projectId: PROJECT_ID,
        });
    }
    db = getFirestore();
    auth = getAuth();
}

const DATA_DIR = path.join(__dirname, 'data');
const FIRESTORE_FILE = path.join(DATA_DIR, 'cloud-firestore-dump.json');
const AUTH_FILE = path.join(DATA_DIR, 'cloud-auth-dump.json');

// Helper to serialize Firestore data (handle Timestamps)
function serializeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp) {
    return { __type__: 'Timestamp', seconds: data.seconds, nanoseconds: data.nanoseconds };
  }
  if (data instanceof Date) {
    return { __type__: 'Date', value: data.toISOString() };
  }
  if (Array.isArray(data)) {
    return data.map(serializeData);
  }
  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      result[key] = serializeData(data[key]);
    }
    return result;
  }
  return data;
}

// Recursive function to read collections
async function readCollection(collectionRef: FirebaseFirestore.CollectionReference): Promise<any> {
    const snapshot = await collectionRef.get();
    const result: any = {};

    for (const doc of snapshot.docs) {
        const docData = serializeData(doc.data());
        const subCollections = await doc.ref.listCollections();
        const subResult: any = {};

        for (const subCol of subCollections) {
            subResult[subCol.id] = await readCollection(subCol);
        }

        result[doc.id] = {
            data: docData,
            subCollections: subResult
        };
    }
    return result;
}

async function exportFirestore() {
    console.log(`Starting Firestore Export from ${PROJECT_ID}...`);
    const rootCollections = await db.listCollections();
    const dump: any = {};

    for (const col of rootCollections) {
        console.log(`Reading collection: ${col.id}`);
        dump[col.id] = await readCollection(col);
    }

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(FIRESTORE_FILE, JSON.stringify(dump, null, 2));
    console.log(`Firestore data exported to ${FIRESTORE_FILE}`);
}

async function exportAuth() {
    console.log(`Starting Auth Export...`);
    let users = [];
    let nextPageToken;
    do {
        const result = await auth.listUsers(1000, nextPageToken);
        users.push(...result.users);
        nextPageToken = result.pageToken;
    } while (nextPageToken);

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(AUTH_FILE, JSON.stringify(users, null, 2));
    console.log(`Auth data (${users.length} users) exported to ${AUTH_FILE}`);
}

async function main() {
    try {
        initFirebase();
        console.log('Ensure you are authenticated via "gcloud auth application-default login" if this fails.');
        await exportFirestore();
        await exportAuth();
        console.log('Cloud Data Fetch Complete!');
    } catch (error: any) {
        console.error('Export failed:', error);
        if (error.message && error.message.includes('Could not load the default credentials')) {
            console.error('\n!!! AUTHENTICATION ERROR !!!');
            console.error('You need to authenticate to allow this script to access the cloud database.');
            console.error('Please run: gcloud auth application-default login');
            console.error('Or set the GOOGLE_APPLICATION_CREDENTIALS environment variable to a service account key path.\n');
        }
        process.exit(1);
    }
}

main();
