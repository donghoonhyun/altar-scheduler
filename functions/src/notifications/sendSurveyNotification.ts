import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { sendMulticastNotification } from '../utils/fcmUtils';
import { REGION_V1 } from '../config';

interface SendSurveyNotiData {
    serverGroupId: string;
    month: string; // YYYYMM
    type: 'SURVEY_OPENED' | 'SURVEY_CLOSED' | 'FINAL_CONFIRMED';
    title?: string;
    body?: string;
}

/**
 * 📣 설문 관련 수동 알림 발송 (Callable)
 * - 설문 시작, 마감, 최종 확정 등
 */
export const sendSurveyNotification = functions.region(REGION_V1).https.onCall(async (data: SendSurveyNotiData, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const { serverGroupId, month, type, title: customTitle, body: customBody } = data;
    const db = admin.firestore();

    // 2. Get Survey Data
    const surveyRef = db.doc(`server_groups/${serverGroupId}/availability_surveys/${month}`);
    const surveySnap = await surveyRef.get();
    
    if (!surveySnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Survey not found');
    }

    const surveyData = surveySnap.data();
    const memberIds: string[] = surveyData?.member_ids || [];

    if (memberIds.length === 0) {
        return { success: false, message: 'No target members' };
    }

    // 3. Get Parent UIDs
    const parentUids = new Set<string>();
    const memberPromises = memberIds.map(async (mid) => {
        const memSnap = await db.doc(`server_groups/${serverGroupId}/members/${mid}`).get();
        if (memSnap.exists) {
            const mData = memSnap.data();
            if (mData?.parent_uid) {
                parentUids.add(mData.parent_uid);
            }
        }
    });
    await Promise.all(memberPromises);

    if (parentUids.size === 0) {
        return { success: false, message: 'No parent UIDs found' };
    }

    // 4. Prepare Message Content
    let title = '';
    let body = '';
    let clickAction = '';
    let feature = '';
    let triggerStatus = '';

    // month format: YYYYMM -> MM월
    const monthStr = month.length === 6 ? parseInt(month.substring(4, 6)).toString() : month;

    if (type === 'SURVEY_OPENED') {
        title = customTitle || '📋 미사 배정 설문 시작';
        body = customBody || `${monthStr}월 미사 배정 설문이 시작되었습니다. 앱에서 참여해주세요!`;
        clickAction = `/survey/${serverGroupId}/${month}`;
        feature = 'SURVEY_OPENED';
        triggerStatus = 'OPEN';
    } else if (type === 'SURVEY_CLOSED') {
        title = customTitle || '🔒 미사 배정 설문 마감';
        body = customBody || `${monthStr}월 미사 배정 설문이 종료되었습니다.`;
        clickAction = `/server-groups/${serverGroupId}`;
        feature = 'SURVEY_CLOSED';
        triggerStatus = 'CLOSED';
    } else if (type === 'FINAL_CONFIRMED') {
        title = customTitle || '✅ 미사 배정 확정';
        body = customBody || `${monthStr}월 복사 배정표가 확정되었습니다. 확인해주세요!`;
        clickAction = `/server-groups/${serverGroupId}`;
        feature = 'FINAL_CONFIRMED';
        triggerStatus = 'FINAL_CONFIRMED';
    } else {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid notification type');
    }

    // 5. Send Notification
    const result = await sendMulticastNotification(Array.from(parentUids), {
        title,
        body,
        data: {
            type,
            serverGroupId,
            month
        },
        clickAction,
        feature,
        serverGroupId,
        triggered_by: context.auth.uid,
        triggered_by_name: context.auth.token.name || context.auth.token.email || 'Unknown',
        trigger_status: triggerStatus
    });

    // 6. Log to survey document (Legacy history)
    await surveyRef.update({
        notifications: admin.firestore.FieldValue.arrayUnion({
            type: 'app_push',
            sent_at: admin.firestore.Timestamp.now(),
            recipient_count: parentUids.size,
            status: 'success',
            title,
            body,
            triggered_by: context.auth.uid
        })
    });

    return { 
        success: true, 
        sent_count: result.successCount,
        failed_count: result.failureCount
    };
});
