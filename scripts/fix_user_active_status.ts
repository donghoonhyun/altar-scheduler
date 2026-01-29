import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// Note: Ensure scripts/service-account.json exists and is valid for the target project
const serviceAccountPath = path.resolve(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found at:', serviceAccountPath);
  console.error('Please download your service account key from Firebase Console -> Project Settings -> Service accounts');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
}

const db = getFirestore();

const TARGET_UID = 'm6QWKeSxZ6WMxpCcZV6TgwZKkpg1';

async function fixUser() {
  console.log(`Starting fix for user: ${TARGET_UID}`);

  // 1. Fix Memberships
  // Update 'active' to true, and standardize 'role' to array
  const membershipsSnap = await db.collection('memberships')
    .where('uid', '==', TARGET_UID)
    .get();

  if (membershipsSnap.empty) {
    console.log('⚠️ No memberships found for this user in "memberships" collection.');
    // Note: If the dump analysis was correct (missing data), this might show "No memberships found".
    // But if the live DB has them, this will find them.
  } else {
    const batch = db.batch();
    membershipsSnap.docs.forEach(doc => {
      const data = doc.data();
      const currentRole = data.role;
      let newRole = currentRole;

      // Standardize role to string[]
      if (typeof currentRole === 'string') {
        newRole = [currentRole];
      } else if (!Array.isArray(currentRole)) {
        newRole = ['server']; // Fallback
      }

      // Ensure 'server' role exists (optional, but safe for this user context)
      // The user mentioned "SG00001" and "SG00002", both imply 'server' role context typically.
      // But if they are planner, we shouldn't force 'server'. 
      // User said "The role for SG1 is 'server', for SG2 is ['server']". So we preserve 'server'.
      
      console.log(`Updating membership ${doc.id}: active=true, role=${JSON.stringify(newRole)}`);
      batch.update(doc.ref, { 
          active: true, 
          role: newRole 
      });
    });
    await batch.commit();
    console.log('✅ Memberships updated.');
  }

  // 2. Fix Members (across all groups)
  // Update 'active' to true for any member record linked to this parent_uid
  const membersSnap = await db.collectionGroup('members')
    .where('parent_uid', '==', TARGET_UID)
    .get();

  if (membersSnap.empty) {
    console.log('⚠️ No linked members found (via parent_uid) in any "members" subcollection.');
  } else {
    const batch = db.batch();
    membersSnap.docs.forEach(doc => {
      console.log(`Updating member ${doc.ref.path}: active=true`);
      batch.update(doc.ref, { active: true });
    });
    await batch.commit();
    console.log('✅ Linked Members updated.');
  }
}

fixUser().catch(console.error);
