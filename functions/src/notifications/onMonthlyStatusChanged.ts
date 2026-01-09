import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { REGION_V1 } from '../config';
import { sendNotificationToUids } from './utils';

export const onMonthlyStatusChanged = functions.region(REGION_V1).firestore
  .document('server_groups/{groupId}/months/{monthId}')
  .onUpdate(async (change, context) => {
      const { groupId, monthId } = context.params; // monthId format "YYYY-MM"
      const before = change.before.data();
      const after = change.after.data();

      // Check if status changed
      if (before.status === after.status) return;

      const newStatus = after.status;
      
      // Target statuses: 'OPEN' (미사확정/설문진행), 'CLOSED' (설문종료), 'CONFIRMED' (최종확정)
      // Assuming English codes are used in DB.
      // Dashboard uses: 'OPEN', 'CLOSED', 'CONFIRMED' (typically).
      // Let's verify status codes from context if possible, but standard is uppercase.
      
      let title = '';
      let body = '';
      let shouldSend = false;

      // Extract Month/Year readable
      // monthId "2024-03"
      const [year, month] = monthId.split('-');
      const monthStr = `${year}년 ${parseInt(month)}월`;

      if (newStatus === 'OPEN') {
          title = '📅 설문 시작 알림';
          body = `${monthStr} 미사 배정 설문이 시작되었습니다. 가능 여부를 제출해주세요.`;
          shouldSend = true;
      } else if (newStatus === 'CLOSED') {
          title = '⏳ 설문 마감 알림';
          body = `${monthStr} 설문이 마감되었습니다. 곧 배정 결과가 공지됩니다.`;
          shouldSend = true;
      } else if (newStatus === 'CONFIRMED') {
          title = '✅ 배정 완료 알림';
          body = `${monthStr} 미사 배정이 완료되었습니다. 나의 배정 현황을 확인하세요.`;
          shouldSend = true;
      }

      if (shouldSend) {
          const db = admin.firestore();
          
          // Fetch All Members of the group
          // Usually roles: 'server', 'planner', 'admin' should all know?
          // Especially 'server' needs to know.
          // Get all memberships for groupId
          const membershipSnaps = await db.collection('memberships')
            .where('groupId', '==', groupId)
            .get();
          
          const recipientUids: string[] = [];
          membershipSnaps.forEach(doc => {
              const data = doc.data();
              // Filter out invalid/inactive?
              // Assuming all memberships in this collection are active users of the group.
              if (data.userId) recipientUids.push(data.userId);
              else if (data.uid) recipientUids.push(data.uid);
               else {
                const parts = doc.id.split(`_${groupId}`);
                if (parts.length > 0) recipientUids.push(parts[0]);
             }
          });

          if (recipientUids.length > 0) {
              await sendNotificationToUids(
                  recipientUids,
                  title,
                  body,
                  `/server-groups/${groupId}/main` // Link to main or dashboard
              );
          }
      }
  });
