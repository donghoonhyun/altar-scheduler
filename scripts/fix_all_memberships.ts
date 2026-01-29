
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
}

const db = getFirestore();

async function fixAllMemberships() {
  console.log('🚀 Starting global membership fix (All Incorrect Data)...');

  try {
    const membershipsSnap = await db.collection('memberships').get();
    let updatedCount = 0;
    let checkedCount = 0;

    console.log(`Found ${membershipsSnap.size} membership documents.`);

    for (const doc of membershipsSnap.docs) {
      checkedCount++;
      const data = doc.data();
      const updates: any = {};
      let needsUpdate = false;

      // 1. Standardize Role (String -> Array)
      let currentRoles: string[] = [];
      if (typeof data.role === 'string') {
        currentRoles = [data.role];
        updates.role = currentRoles;
        needsUpdate = true;
        console.log(`[${doc.id}] 🛠 Converting role string "${data.role}" to array`);
      } else if (Array.isArray(data.role)) {
        currentRoles = data.role;
      } else {
        currentRoles = [];
      }

      // 2. Fix 'active' status
      const isActiveMissing = data.active === undefined;
      const isActiveFalse = data.active === false;

      // Check key roles
      const isAdminOrPlanner = currentRoles.some(r => ['admin', 'planner', 'superadmin'].includes(r));
      const hasServerRole = currentRoles.includes('server');

      // (A) Admin/Planner Logic
      if (isAdminOrPlanner) {
        // If Active is missing -> Fix to true
        if (isActiveMissing) {
          updates.active = true;
          needsUpdate = true;
          console.log(`[${doc.id}] 🛠 Admin/Planner missing 'active' -> Setting active: true`);
        }
        // If Active is false?
        // Let's assume for now that if they are admin/planner in memberships request, 
        // and they are NOT a server with pending status, they should be active.
        // But to be safe, only fix missing ones unless we know for sure.
        // Wait, the user said "data shows empty fields or false".
        // Let's fix 'false' for Admins ONLY IF they don't have a linked 'server' member doc that is false.
        // If they are pure admin (no server role), active: false is likely wrong (blocked).
        if (isActiveFalse && !hasServerRole) {
            updates.active = true;
            needsUpdate = true;
            console.log(`[${doc.id}] 🛠 Admin/Planner (no server role) active: false -> Setting active: true`);
        }
      }
      
      // (B) Server Role Logic
      if (hasServerRole) {
        const sgId = data.server_group_id;
        const uid = data.uid;

        if (sgId && sgId !== 'global') {
          // Check linked 'members' doc
          const memberDocRef = db.collection('server_groups').doc(sgId).collection('members').doc(uid);
          const memberSnap = await memberDocRef.get();

          if (memberSnap.exists) {
            const memberData = memberSnap.data();
            const memberActive = memberData?.active === true;
            
            // Sync: If member is active, membership MUST be active
            if (memberActive && (isActiveFalse || isActiveMissing)) {
                updates.active = true;
                needsUpdate = true;
                console.log(`[${doc.id}] 🛠 Linked Member ACTIVE (${memberData?.name_kor}), but membership inactive -> Fixing active: true`);
            }
            // If member is INACTIVE, and membership is ACTIVE -> Should we fix to false?
            // Only if NOT admin/planner.
            if (!memberActive && data.active === true && !isAdminOrPlanner) {
                updates.active = false;
                needsUpdate = true;
                console.log(`[${doc.id}] 🛠 Linked Member INACTIVE, but membership active -> Fixing active: false`);
            }
            // If member is INACTIVE, and membership is varying/missing -> Ensure membership is false (if not admin)
            if (!memberActive && isActiveMissing && !isAdminOrPlanner) {
                updates.active = false;
                needsUpdate = true;
                // console.log(`[${doc.id}] Linked Member INACTIVE, membership missing active -> Setting active: false`);
            }

          } else {
             // Member doc missing
             // If they are ONLY server, this is a broken state (orphaned).
             // We can't act easily. Leave it.
          }
        }
      }

      // Execute Update
      if (needsUpdate) {
        // Add updated_at for tracking
        // updates.updated_at = admin.firestore.FieldValue.serverTimestamp(); // Use client SDK style? No, admin SDK.
        // Actually, just leave timestamp alone to avoid noise, or set it?
        // Let's set it to be safe.
        // updates.updated_at = new Date();
        await doc.ref.update(updates);
        updatedCount++;
      }
    }

    console.log(`✅ Fix complete. Scanned ${checkedCount}, Fixed ${updatedCount} documents.`);

  } catch (error) {
    console.error('❌ Error during fix:', error);
  }
}

fixAllMemberships().catch(console.error);
