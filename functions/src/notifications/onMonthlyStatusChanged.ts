import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { REGION_V1 } from '../config';
import { sendNotificationToUids } from './utils';

export const onMonthlyStatusChanged = functions.region(REGION_V1).firestore
  .document('server_groups/{groupId}/month_status/{monthId}')
  .onUpdate(async (change, context) => {
      const { groupId, monthId } = context.params; // monthId format "YYYYMM" (e.g. 202402)
      const before = change.before.data();
      const after = change.after.data();

      // Check if status changed
      if (before.status === after.status) return;

      const newStatus = after.status;
      
      let title = '';
      let body = '';
      let shouldSend = false;

      // Extract Month Readably
      // monthId is usually "YYYYMM" in `month_status`
      // But ensure format.
      let monthStr = monthId;
      if (monthId.length === 6) {
          const m = parseInt(monthId.substring(4, 6));
          monthStr = `${m}월`;
      }

      // Check Status
      if (newStatus === 'FINAL-CONFIRMED') {
          title = '✅ 배정 최종 확정';
          body = `${monthStr} 미사 배정이 최종 확정되었습니다 (수정 완료). 앱에서 확인하세요.`;
          shouldSend = true;
      }
      // Add other statuses if needed, e.g. MASS-CONFIRMED?
      
      if (shouldSend) {
          // ... Same sending logic ...
          const db = admin.firestore();
          
          // Fetch All Members of the group (Using Members collection, better than memberships if possible, but memberships contains UIDs)
          // Use 'memberships' collection as in original code logic
          const membershipSnaps = await db.collection('memberships')
            .where('groupId', '==', groupId)
            .get();
          
          const recipientUids: string[] = [];
          membershipSnaps.forEach(doc => {
              const data = doc.data();
              if (data.userId) recipientUids.push(data.userId); // userId is active field
              else if (data.uid) recipientUids.push(data.uid);
          });
          
          const uniqueUids = [...new Set(recipientUids)];

          if (uniqueUids.length > 0) {
              await sendNotificationToUids(
                  uniqueUids,
                  title,
                  body,
                  `/server-groups/${groupId}/main`
              );
              console.log(`[onMonthlyStatusChanged] Sent ${newStatus} notification to ${uniqueUids.length} users.`);
              
              // ✅ Log to system_notification_logs for history tracking
              await db.collection('system_notification_logs').add({
                  created_at: admin.firestore.FieldValue.serverTimestamp(),
                  title,
                  body,
                  feature: 'MONTH_STATUS',
                  status: 'success',
                  target_uids: uniqueUids,
                  success_count: uniqueUids.length,
                  server_group_id: groupId,
                  month_id: monthId, // Added for filtering
                  trigger_status: newStatus
              });
          }
      }
  });
