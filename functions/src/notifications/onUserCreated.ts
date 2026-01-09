import * as functions from 'firebase-functions/v1'; // Or v2
import * as admin from 'firebase-admin';
import { REGION_V1 } from '../config';
import { sendNotificationToUids } from './utils';

export const onUserCreated = functions.region(REGION_V1).firestore
  .document('users/{userId}')
  .onCreate(async (snap) => {
    const newUser = snap.data();
    const name = newUser.user_name || '이름 없음';
    
    // Find Superadmins
    const db = admin.firestore();
    // Assuming 'global' group id for superadmins
    // or we scan all memberships with role superadmin?
    // User said "(uid)_global". Let's try to query by groupId 'global' if field exists.
    // If field doesn't exist, we might have to rely on docId convention or a separate 'roles' collection.
    // Let's assume 'groupId' field is stored in membership.
    
    const adminSnaps = await db.collection('memberships')
        .where('groupId', '==', 'global')
        .where('role', 'array-contains', 'superadmin')
        .get();

    const adminUids: string[] = [];
    adminSnaps.forEach(doc => {
        // userId is typically part of docId user_group or stored as field.
        // Let's assume 'uid' or 'userId' field exists.
        // If not, parse ID? 'uid_global'.
        const data = doc.data();
        if (data.userId) adminUids.push(data.userId);
        else if (data.uid) adminUids.push(data.uid);
        else {
             // Fallback: parse from doc.id "UID_global"
             const parts = doc.id.split('_global');
             if (parts.length > 0) adminUids.push(parts[0]);
        }
    });

    if (adminUids.length > 0) {
        await sendNotificationToUids(
            adminUids,
            '새로운 회원이 가입했습니다.',
            `${name}님이 새로 가입했습니다. 확인해주세요.`,
            '/superadmin/users' // Link to superadmin users page
        );
    }
});
