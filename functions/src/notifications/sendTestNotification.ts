import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { COMMON_OPTIONS_V2 } from '../config';

interface SendTestNotificationRequest {
  targetUid: string;
  iconUrl?: string; // ✅ Receive absolute icon path
}

export const sendTestNotification = onCall(
  COMMON_OPTIONS_V2,
  async (request: CallableRequest<SendTestNotificationRequest>): Promise<{ success: boolean; message: string; successCount?: number; failureCount?: number }> => {
    // 1. Validate Auth (Admin only?)
    // For now, allow any authenticated user to test, or restrict to admin.
    // Given the context (User Support), likely admin.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { targetUid, iconUrl } = request.data;
    if (!targetUid) {
      throw new HttpsError('invalid-argument', 'Target UID is required.');
    }

    const db = admin.firestore();
    
    // 2. Get User's FCM Tokens
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found.');
    }

    const userData = userDoc.data();
    const tokens: string[] = userData?.fcm_tokens || [];

    if (tokens.length === 0) {
      return { success: false, message: 'No registered devices (FCM tokens) found for this user.' };
    }

    // 3. Send Message
    // ✅ Switch to Data-Only Payload
    // This forces the Service Worker to handle the display, fixing the "Chrome Icon" issue on Android.
    // The Service Worker is now configured to explicitly call showNotification with these data fields.
    // 3. Send Message
    // ✅ Revert to Standard Notification Payload (Restores PC functionality)
    // ✅ Use Absolute Icon URL for both Icon and Badge (Attempt to fix Mobile Icon)
    const notificationIcon = iconUrl || 'https://altar-scheduler-dev.web.app/pwa-icon.png';

    const payload: admin.messaging.MulticastMessage = {
      notification: {
        title: '🔔[Altar Scheduler] 알림 테스트',
        body: '테스트 메시지(FCM)를 정상적으로 수신하였습니다.',
      },
      webpush: {
        notification: {
          title: '🔔[Altar Scheduler] 알림 테스트',
          body: '테스트 메시지(FCM)를 정상적으로 수신하였습니다.',
          icon: notificationIcon,
          badge: notificationIcon, // Badge for Android Status Bar
        },
        fcmOptions: {
          link: '/', 
        },
      },
      tokens: tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(payload);
      
      // Optional: Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            // Check for invalid-registration-token errors to remove them
            if (error?.code === 'messaging/invalid-registration-token' || 
                error?.code === 'messaging/registration-token-not-registered') {
                invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
           await db.collection('users').doc(targetUid).update({
               fcm_tokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
           });
           console.log(`Removed ${invalidTokens.length} invalid tokens for user ${targetUid}`);
        }
      }

      return { 
          success: true, 
          message: `Sent to ${tokens.length} devices. Success: ${response.successCount}, Failure: ${response.failureCount}`,
          successCount: response.successCount,
          failureCount: response.failureCount
      };

    } catch (error) {
      console.error('Error sending test notification:', error);
      throw new HttpsError('internal', 'Failed to send notification: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
);
