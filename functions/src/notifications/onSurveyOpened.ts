import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { sendMulticastNotification } from '../utils/fcmUtils';
import { REGION_V1 } from '../config';

/**
 * 📢 설문 시작 알림 (FCM)
 * Trigger: server_groups/{sgId}/availability_surveys/{month} 문서 Write
 */
export const onSurveyOpened = functions.region(REGION_V1).firestore
  .document('server_groups/{sgId}/availability_surveys/{month}')
  .onWrite(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // 1) 문서 삭제된 경우 제외
    if (!afterData) return null;

    // 2) 상태가 'OPEN'으로 변경된 경우만 진행
    //    (처음 생성 시 OPEN인 경우 또는 CLOSED -> OPEN 변경)
    const wasOpen = beforeData?.status === 'OPEN';
    const isOpen = afterData.status === 'OPEN';

    if (wasOpen || !isOpen) {
      return null;
    }

    const { sgId, month } = context.params;

    // ✅ [제한] 알림은 "다음 달" 설문에 대해서만 발송 (테스트/과거 데이터 방지)
    // KST 기준 현재 날짜 계산
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currYear = kstNow.getUTCFullYear();
    const currMonth = kstNow.getUTCMonth() + 1; // 1-12

    // 다음 달 계산
    let nextYear = currYear;
    let nextMonth = currMonth + 1;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    const nextYm = `${nextYear}${String(nextMonth).padStart(2, '0')}`;

    if (month !== nextYm) {
        console.log(`[onSurveyOpened] 🚫 Skipped notification. Target ${month} is not next month (${nextYm})`);
        return null;
    }
    const memberIds: string[] = afterData.member_ids || [];

    if (memberIds.length === 0) {
      console.log(`[onSurveyOpened] No members targeted for ${sgId}/${month}`);
      return null;
    }

    console.log(`[onSurveyOpened] Survey OPENED for ${sgId}/${month}. Targets: ${memberIds.length} members.`);

    try {
      // 3) 대상 멤버들의 parent_uid 수집
      //    (memberId -> server_groups/{sgId}/members/{memberId} -> parent_uid)
      const db = admin.firestore();
      const parentUids = new Set<string>();
      
      const memberPromises = memberIds.map(async (mid) => {
        const memSnap = await db.doc(`server_groups/${sgId}/members/${mid}`).get();
        if (memSnap.exists) {
          const mData = memSnap.data();
          if (mData?.parent_uid) {
            parentUids.add(mData.parent_uid);
          }
        }
      });
      
      await Promise.all(memberPromises);
      
      if (parentUids.size === 0) {
        console.log('[onSurveyOpened] No parent UIDs found.');
        return null;
      }

      // 4) 공통 유틸리티로 발송
      // month 포맷: YYYYMM -> MM월
      const monthStr = month.length === 6 ? parseInt(month.substring(4, 6)).toString() : month;

      await sendMulticastNotification(
        Array.from(parentUids),
        {
          title: '📋 미사 배정 설문 시작',
          body: `${monthStr}월 미사 배정 설문이 시작되었습니다. 앱에서 참여해주세요!`,
          data: {
             type: 'SURVEY_OPENED',
             serverGroupId: sgId,
             month: month
          },
          clickAction: `/survey/${sgId}/${month}`
        }
      );

      // ✅ [Log] 알림 발송 이력 저장
      await db.doc(`server_groups/${sgId}/availability_surveys/${month}`).update({
        notifications: admin.firestore.FieldValue.arrayUnion({
            type: 'app_push',
            sent_at: admin.firestore.Timestamp.now(),
            recipient_count: parentUids.size,
            status: 'success',
            title: '📋 미사 배정 설문 시작',
            body: `${monthStr}월 미사 배정 설문이 시작되었습니다. 앱에서 참여해주세요!`
        })
      });

      return null;

    } catch (err) {
      console.error('[onSurveyOpened] Error:', err);
      return null;
    }
});
