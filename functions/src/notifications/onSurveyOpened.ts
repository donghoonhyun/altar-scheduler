import * as functions from 'firebase-functions/v1';
import { REGION_V1 } from '../config';

/**
 * 📢 설문 시작 알림 (FCM)
 * Trigger: server_groups/{sgId}/availability_surveys/{month} 문서 Write
 */
export const onSurveyOpened = functions.region(REGION_V1).firestore
  .document('server_groups/{sgId}/availability_surveys/{month}')
  .onWrite(async () => {
    // 🛑 [Manual Mode] 자동 발송 중지 (User Request)
    // "설문시작, 종료를 처리하면 ... 알림이 난발되는 문제가 있어 ... 사용자가 필요할때 버튼으로 발송하는 방식"
    console.log(`[onSurveyOpened] Auto-notification disabled. Use manual trigger.`);
    return null;
});
