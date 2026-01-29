import * as admin from 'firebase-admin';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  clickAction?: string;
  feature?: string; // e.g. 'TEST_SEND', 'MASS_REMINDER', 'SURVEY_OPEN', etc.
  serverGroupId?: string; // Optional: associated server group ID
  triggered_by?: string; // Operator UID
  triggered_by_name?: string; // Operator Name
  trigger_status?: string; // e.g. 'SURVEY_OPENED', 'FINAL-CONFIRMED'
}

/**
 * 📣 다중 사용자에게 FCM 푸시 알림 발송 (공통 유틸리티)
 * @param parentUids 알림을 받을 부모(사용자) UID 배열
 * @param payload 알림 제목, 내용, 데이터
 */
export async function sendMulticastNotification(
  parentUids: string[],
  payload: NotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
  if (parentUids.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const db = admin.firestore();

  // 1) parentUids -> fcm_tokens 수집
  const tokens: string[] = [];
  
  // 많은 양의 uid를 처리할 때는 배치나 chunk 처리가 필요할 수 있으나, 여기선 Promise.all 사용
  const userPromises = parentUids.map(async (uid) => {
    try {
      const userSnap = await db.doc(`users/${uid}`).get();
      if (userSnap.exists) {
        const uData = userSnap.data();
        if (uData?.fcm_tokens && Array.isArray(uData.fcm_tokens)) {
          tokens.push(...uData.fcm_tokens);
        }
      }
    } catch (e) {
      console.error(`Error fetching tokens for user ${uid}`, e);
    }
  });

  await Promise.all(userPromises);

  if (tokens.length === 0) {
    console.log('[sendMulticastNotification] No FCM tokens found.');
    return { successCount: 0, failureCount: 0 };
  }

  // 2) 중복 제거
  const uniqueTokens = Array.from(new Set(tokens));

  // 3) 메시지 구성
  const message: admin.messaging.MulticastMessage = {
    tokens: uniqueTokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
  };

  // 웹 푸시 링크 클릭 처리를 위한 옵션 추가
  if (payload.clickAction) {
    // Legacy support
    if (!message.data) message.data = {};
    message.data.click_action = payload.clickAction;

    // Modern webpush specs
    message.webpush = {
        fcmOptions: {
            link: payload.clickAction
        }
    };
  }

  // 4) 발송
  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[sendMulticastNotification] Sent to ${uniqueTokens.length} devices. Success: ${response.successCount}, Failed: ${response.failureCount}`);
    
    // 🔔 Log to FireStore (System History)
    console.log('[sendMulticastNotification] Attempting to write log to system_notification_logs...');
    try {
        const logData = {
            created_at: new Date(), // Use JS Date object instead of serverTimestamp for safety
            feature: payload.feature || 'unknown',
            server_group_id: payload.serverGroupId || null,
            title: payload.title,
            body: payload.body,
            data: payload.data || null,
            target_uids: parentUids,
            target_device_count: uniqueTokens.length,
            success_count: response.successCount,
            failure_count: response.failureCount,
            click_action: payload.clickAction || null,
            status: 'success',
            triggered_by: payload.triggered_by || null,
            triggered_by_name: payload.triggered_by_name || null,
            trigger_status: payload.trigger_status || null,
        };
        
        const ref = await db.collection('system_notification_logs').add(logData);
        console.log(`[sendMulticastNotification] Log written successfully. Doc ID: ${ref.id}`);
    } catch (logErr) {
        console.error('[sendMulticastNotification] Logging failed. Error details:', JSON.stringify(logErr, Object.getOwnPropertyNames(logErr)));
    }
    
    // (TODO: 실패한 토큰 정리 로직 추가 가능)
    
    return {
        successCount: response.successCount,
        failureCount: response.failureCount
    };
  } catch (error) {
    console.error('[sendMulticastNotification] Transmit error:', error);
    throw error;
  }
}
