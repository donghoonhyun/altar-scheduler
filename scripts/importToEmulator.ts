
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we are connecting to the emulator
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error('❌ Error: Emulator environment variables not set.');
    console.error('   Please run this script with emulator variables, e.g.:');
    console.error('   export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"');
    console.error('   export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"');
    console.error('   tsx scripts/importToEmulator.ts');
    process.exit(1);
}

const PROJECT_ID = 'ordo-eb11a';

initializeApp({
    projectId: PROJECT_ID,
});

const db = getFirestore();
const auth = getAuth();

const DATA_DIR = path.join(__dirname, 'data');
const FIRESTORE_FILE = path.join(DATA_DIR, 'cloud-firestore-dump.json');
const AUTH_FILE = path.join(DATA_DIR, 'cloud-auth-dump.json');

// Data from seedRoles.ts to ensure development access
const TEST_PARISH_CODE = 'DAEGU-BEOMEO';
const TEST_SERVER_GROUP_ID = 'SG00001';

const CRITICAL_USERS = [
  {
    uid: 'pongso-hyun-uid',
    email: 'pongso.hyun@gmail.com',
    password: '123456',
    userName: '현동훈',
    baptismalName: '알퐁소',
    roleDocs: [
      {
        collection: 'app_altar/v1/memberships',
        docId: `pongso-hyun-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: 'pongso-hyun-uid',
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: ['admin', 'planner'],
          active: true,
        },
      },
      {
        collection: 'app_altar/v1/memberships',
        docId: `pongso-hyun-uid_global`,
        data: {
          uid: 'pongso-hyun-uid',
          server_group_id: 'global',
          parish_code: 'system',
          role: ['superadmin'],
          active: true,
        },
      },
    ],
  },
];

async function ensureCriticalUsers() {
    console.log('\n--- Ensuring Critical Development Users ---');
    
    for (const u of CRITICAL_USERS) {
        // 1. Auth
        try {
             // Try to create first
             await auth.createUser({
                uid: u.uid,
                email: u.email,
                password: u.password,
                displayName: u.userName,
                emailVerified: true,
             });
             console.log(`✅ Created Auth User: ${u.email}`);
        } catch (e: any) {
            if (e.code === 'auth/uid-already-exists') {
                // If exists, update password to ensure we can login
                await auth.updateUser(u.uid, {
                    password: u.password,
                    displayName: u.userName,
                    emailVerified: true,
                });
                console.log(`✅ Updated Auth User: ${u.email} (Reset password to ${u.password})`);
            } else if (e.code === 'auth/email-already-exists') {
                 // Fetch by email to get UID, then update
                 // This handles case where cloud dump has same email but different UID
                 try {
                     const existingUser = await auth.getUserByEmail(u.email);
                     console.log(`⚠️ Email ${u.email} already exists with UID ${existingUser.uid}. Updating that user...`);
                     
                     if (existingUser.uid !== u.uid) {
                         console.log(`   !!! UID Mismatch. Deleting ${existingUser.uid} and recreating as ${u.uid}...`);
                         await auth.deleteUser(existingUser.uid);
                         await auth.createUser({
                            uid: u.uid,
                            email: u.email,
                            password: u.password,
                            displayName: u.userName,
                            emailVerified: true,
                         });
                         console.log(`   ✅ Recreated with correct UID: ${u.uid}`);
                     } else {
                         await auth.updateUser(existingUser.uid, {
                            password: u.password,
                            displayName: u.userName,
                            emailVerified: true,
                         });
                         console.log(`   ✅ Updated existing user password.`);
                     }
                 } catch (innerE) {
                     console.error('Error handling existing email:', innerE);
                 }
            } else {
                console.error(`Failed to ensure user ${u.email}:`, e);
            }
        }

        // 2. Firestore (User Profile)
        const userData: any = {
            uid: u.uid,
            email: u.email,
            user_name: u.userName,
            created_at: new Date(),
            updated_at: new Date(),
        };
        if (u.baptismalName) {
            userData.baptismal_name = u.baptismalName;
        }
        await db.collection('users').doc(u.uid).set(userData, { merge: true });
        console.log(`✅ Synced User Profile: users/${u.uid}`);

        // 3. Firestore (Memberships/Roles)
        for (const r of u.roleDocs) {
            await db
                .collection(r.collection)
                .doc(r.docId)
                .set({
                    ...r.data,
                    updated_at: new Date(),
                }, { merge: true }); // Merge to keep other fields if any
            console.log(`✅ Synced Role: ${r.collection}/${r.docId}`);
        }
    }
}

function deserializeData(data: any): any {
    if (data === null || data === undefined) return data;
    if (data.__type__ === 'Timestamp') {
        return new Timestamp(data.seconds, data.nanoseconds);
    }
    if (data.__type__ === 'Date') {
        return new Date(data.value);
    }
    if (Array.isArray(data)) {
        return data.map(deserializeData);
    }
    if (typeof data === 'object') {
        const result: any = {};
        for (const key in data) {
            result[key] = deserializeData(data[key]);
        }
        return result;
    }
    return data;
}

async function startImport() {
    console.log(`Connecting to Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    
    // 1. Import Auth
    if (fs.existsSync(AUTH_FILE)) {
        const users = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
        console.log(`Found ${users.length} users to import.`);
        
        let successCount = 0;
        let failCount = 0;

        for (const u of users) {
             const userImport = {
                uid: u.uid,
                email: u.email,
                emailVerified: u.emailVerified,
                displayName: u.displayName,
                photoURL: u.photoURL,
                phoneNumber: u.phoneNumber,
                disabled: u.disabled,
                password: '123456', // Set default password for development
             };
             
             try {
                // Try to create or update
                try {
                    await auth.createUser(userImport);
                    successCount++;
                } catch (e: any) {
                    if (e.code === 'auth/uid-already-exists') {
                        await auth.updateUser(u.uid, userImport);
                        successCount++;
                    } else {
                        throw e;
                    }
                }
             } catch (e) {
                 console.error(`Failed to import user ${u.email}:`, e);
                 failCount++;
             }
        }
        console.log(`Auth Import: ${successCount} processed, ${failCount} failed.`);
    } else {
        console.log(`No auth dump found at ${AUTH_FILE}`);
    }

    // 2. Import Firestore
    if (fs.existsSync(FIRESTORE_FILE)) {
        console.log('Starting Firestore Import...');
        const dump = JSON.parse(fs.readFileSync(FIRESTORE_FILE, 'utf8'));
        await importCollections(db, dump);
        console.log('Firestore Import Complete.');
    } else {
        console.log(`No firestore dump found at ${FIRESTORE_FILE}`);
    }

    await ensureCriticalUsers();
}

async function importCollections(parentRef: any, collectionsMap: any) {
    // collectionsMap is: { "collectionName": { "docId": { data: {}, subCollections: {} } } }
    for (const colId in collectionsMap) {
        const docsMap = collectionsMap[colId];
        console.log(` -> Importing collection: ${colId} (${Object.keys(docsMap).length} docs)`);
        
        const batchSize = 400;
        let batch = db.batch();
        let count = 0;

        for (const docId in docsMap) {
            const entry = docsMap[docId];
            const data = deserializeData(entry.data);
            
            // Determine the reference
            const docRef = parentRef.collection(colId).doc(docId);
            
            batch.set(docRef, data);
            count++;

            if (count % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
            }

            if (entry.subCollections && Object.keys(entry.subCollections).length > 0) {
                // Recursively import subcollections for this document
                // Currently batch is open, but recursion might use its own batches.
                // It is safer to commit current batch before recursion or use independent batches.
                // Since this is a simple script, let's commit first to avoid complexity.
                if (count % batchSize !== 0) {
                     await batch.commit();
                     batch = db.batch();
                }
                await importCollections(docRef, entry.subCollections);
            }
        }
        
        if (count % batchSize !== 0) {
            await batch.commit();
        }
    }
}

startImport().then(() => {
    console.log('Done.');
    process.exit(0);
}).catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
