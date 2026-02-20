import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { REGION_V1 } from '../config';
import { sendMulticastNotification } from '../utils/fcmUtils';

// Trigger for: Server Application (Members) AND Planner Role Request (RoleRequests)

// 1. New Member Application (server application)
export const onMemberCreated = functions.region(REGION_V1).firestore
  .document('server_groups/{groupId}/members/{memberId}')
  .onCreate(async (snap, context) => {
      const { groupId } = context.params;
      
      // Find Group Admins
      const db = admin.firestore();
      const adminSnaps = await db.collection('memberships')
        .where('groupId', '==', groupId)
        .where('role', 'array-contains', 'admin')
        .get();

      const adminUids: string[] = [];
      adminSnaps.forEach(doc => {
          const data = doc.data();
          if (data.userId) adminUids.push(data.userId); // Preferred
          else if (data.uid) adminUids.push(data.uid);
          else {
             // Fallback: parse "UID_GROUPID"
             // This is risky if UID contains underscore.
             // Try to use field if possible.
             // If missing, we might skip or try split.
             const parts = doc.id.split(`_${groupId}`);
             if (parts.length > 0) adminUids.push(parts[0]);
          }
      });
      
      if (adminUids.length > 0) {
          await sendMulticastNotification(
              adminUids,
              {
                  title: '신규 복사단원 입단 신청',
                  body: '새로운 복사단원 신청이 있습니다. 승인 대기중입니다.',
                  clickAction: `/server-groups/${groupId}/admin/members`,
                  feature: 'MEMBER_APPLICATION',
                  serverGroupId: groupId
              }
          );
      }
  });

// 2. Planner Role Request
export const onRoleRequestCreated = functions.region(REGION_V1).firestore
  .document('server_groups/{groupId}/role_requests/{requestId}')
  .onCreate(async (snap, context) => {
      const { groupId } = context.params;
      const requestData = snap.data();
      const userName = requestData.user_name || '사용자';

      // Find Group Admins (Reuse logic or just copy)
      const db = admin.firestore();
      const adminSnaps = await db.collection('memberships')
        .where('groupId', '==', groupId)
        .where('role', 'array-contains', 'admin')
        .get();

      const adminUids: string[] = [];
      adminSnaps.forEach(doc => {
          const data = doc.data();
          if (data.userId) adminUids.push(data.userId);
          else if (data.uid) adminUids.push(data.uid);
          else {
             const parts = doc.id.split(`_${groupId}`);
             if (parts.length > 0) adminUids.push(parts[0]);
          }
      });

      if (adminUids.length > 0) {
          await sendMulticastNotification(
              adminUids,
              {
                  title: '플래너 권한 신청',
                  body: `${userName}님이 플래너 권한을 요청했습니다.`,
                  clickAction: `/server-groups/${groupId}/admin/role-approval`,
                  feature: 'ROLE_REQUEST',
                  serverGroupId: groupId
              }
          );
      }
  });

// 3. Member Approved (active: false -> true)
export const onMemberUpdated = functions.region(REGION_V1).firestore
  .document('server_groups/{groupId}/members/{memberId}')
  .onUpdate(async (change, context) => {
      const { groupId } = context.params;
      const beforeData = change.before.data();
      const afterData = change.after.data();

      // Check if it was just approved (active was false, now true)
      if (beforeData.active === false && afterData.active === true) {
          const targetUid = afterData.parent_uid || afterData.uid;
          const memberName = afterData.name_kor || '복사단원';

          if (targetUid) {
              await sendMulticastNotification(
                  [targetUid],
                  {
                      title: '복사단 가입 승인',
                      body: `${memberName} 님의 복사단 가입이 승인되었습니다!`,
                      clickAction: `/server-groups/${groupId}`,
                      feature: 'MEMBER_APPLICATION',
                      serverGroupId: groupId
                  }
              );
          }
      }
  });
