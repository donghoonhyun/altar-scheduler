import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { sendMulticastNotification } from '../utils/fcmUtils';
import { REGION_V1 } from '../config';

/**
 * 📣 설문 종료/마감 알림 (FCM)
 * Trigger: server_groups/{sgId}/mass_events/{eventId} 문서 Write (status가 'CONFIRMED'로 변경될 때? 
 * 혹은 availability_surveys/{month} 상태가 'CLOSED' / 'CONFIRMED'로 바뀔 때?)
 * 
 * 요구사항: [미사일정관리]/server-groups/SG00001/mass-events
 * 정확한 트리거 지점이 '설문 종료' 버튼을 눌러 availability_surveys 문서의 status를 바꾸는 것인지,
 * 아니면 스케줄 확정(Publish)을 의미하는 것인지 확인 필요.
 * 
 * 보통 '설문 종료'는 availability_surveys/{month} 문서를 업데이트함.
 */
export const onSurveyClosed = functions.region(REGION_V1).firestore
  .document('server_groups/{sgId}/availability_surveys/{month}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // 상태가 'CLOSED' 혹은 'CONFIRMED'로 변경된 경우 감지
    // (기존 상태가 무엇이었든, 새로 CLOSED/CONFIRMED가 되었고 이전과는 다를 때)
    const newStatus = afterData.status;
    const oldStatus = beforeData.status;

    if (newStatus === oldStatus) return null;

    // 설문 마감 (DEADLINE_EXCEEDED or CLOSED) or 확정 (CONFIRMED)
    // 요구사항: "설문 종료 때" -> 보통 'CLOSED' 상태
    if (newStatus !== 'CLOSED' && newStatus !== 'CONFIRMED') {
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
        console.log(`[onSurveyClosed] 🚫 Skipped notification. Target ${month} is not next month (${nextYm})`);
        return null;
    }
    const memberIds: string[] = afterData.member_ids || [];

    if (memberIds.length === 0) return null;

    console.log(`[onSurveyClosed] Survey ${newStatus} for ${sgId}/${month}. Targets: ${memberIds.length}`);

    try {
      // 1) 대상 멤버들의 parent_uid 수집
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

      if (parentUids.size === 0) return null;

      // 2) 메시지 발송
      const monthStr = month.length === 6 ? parseInt(month.substring(4, 6)).toString() : month;
      
      let title = '🔒 미사 배정 설문 마감';
      let body = `${monthStr}월 미사 배정 설문이 종료되었습니다.`;

      if (newStatus === 'CONFIRMED') {
        title = '✅ 미사 배정 확정';
        body = `${monthStr}월 복사 배정표가 확정되었습니다. 확인해주세요!`;
      }

      await sendMulticastNotification(Array.from(parentUids), {
        title,
        body,
        data: {
          type: 'SURVEY_CLOSED',
          serverGroupId: sgId,
          month: month,
          status: newStatus
        },
        clickAction: `/server-groups/${sgId}` // 메인 페이지로 이동
      });

      // ✅ [Log] 알림 발송 이력 저장
      await db.doc(`server_groups/${sgId}/availability_surveys/${month}`).update({
        notifications: admin.firestore.FieldValue.arrayUnion({
            type: 'app_push',
            sent_at: admin.firestore.Timestamp.now(),
            recipient_count: parentUids.size,
            status: 'success',
            title: title,
            body: body
        })
      });

      return null;

    } catch (err) {
      console.error('[onSurveyClosed] Error:', err);
      return null;
    }
  });
