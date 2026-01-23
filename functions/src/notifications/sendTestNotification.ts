import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';

import { COMMON_OPTIONS_V2 } from '../config';
import { sendMulticastNotification } from '../utils/fcmUtils';

interface SendTestNotificationRequest {
  targetUid: string;
  iconUrl?: string;
}

export const sendTestNotification = onCall(
  COMMON_OPTIONS_V2,
  async (request: CallableRequest<SendTestNotificationRequest>): Promise<{ success: boolean; message: string; successCount?: number; failureCount?: number }> => {
    // 1. Validate Auth
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { targetUid } = request.data;
    if (!targetUid) {
      throw new HttpsError('invalid-argument', 'Target UID is required.');
    }

    // 2. Prepare Payload
    // Using the utility ensures logging to system_notification_logs
    const title = '🔔[Altar Scheduler] 알림 테스트';
    const body = '테스트 메시지(FCM)를 정상적으로 수신하였습니다.';

    try {
        const result = await sendMulticastNotification([targetUid], {
            title,
            body,
            feature: 'TEST_SEND', // 🏷️ Identify origin
            data: {
                testId: `test-${Date.now()}`,
                timestamp: new Date().toISOString(),
                sender: 'SuperAdmin',
                type: 'TEST_NOTIFICATION'
            },
            clickAction: '/'
        });

      return { 
          success: true, 
          message: `Sent to user ${targetUid}. Success: ${result.successCount}, Failure: ${result.failureCount}`,
          successCount: result.successCount,
          failureCount: result.failureCount
      };

    } catch (error) {
      console.error('Error sending test notification:', error);
      throw new HttpsError('internal', 'Failed to send notification: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
);
