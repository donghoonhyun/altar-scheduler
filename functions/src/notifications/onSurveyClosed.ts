import * as functions from 'firebase-functions/v1';
import { REGION_V1 } from '../config';

/**
 * 📣 설문 종료/마감 알림 (FCM)
 */
export const onSurveyClosed = functions.region(REGION_V1).firestore
  .document('server_groups/{sgId}/availability_surveys/{month}')
  .onUpdate(async () => {
    // 🛑 [Manual Mode] 자동 발송 중지 (User Request)
    console.log(`[onSurveyClosed] Auto-notification disabled. Use manual trigger.`);
    return null;
  });
