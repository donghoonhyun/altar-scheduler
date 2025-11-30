/**
 * ✅ copyPrevMonthMassEvents_fixed.ts
 * ---------------------------------------------------------
 * - PRD-2.5.1 CopyPrevMonthMassEvents.md 규격 완전 준수 버전
 * - 문제 해결: "전월 전체 일정이 shift 복사"되는 현상 방지
 * - 기준: 전월 첫 번째 일요일이 포함된 주(일~토) 7일만 base로 사용
 * - 모든 날짜계산: Asia/Seoul 고정 (process.env.TZ='Asia/Seoul')
 * ---------------------------------------------------------
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { FieldValue } from 'firebase-admin/firestore';

dayjs.extend(isSameOrBefore);
process.env.TZ = 'Asia/Seoul';

interface MassEventDoc {
  title: string;
  event_date: string; // "YYYYMMDD"
  required_servers: number;
  member_ids?: string[];
}

interface MembershipDoc {
  role: 'planner' | 'server';
  server_group_id: string;
}

export const copyPrevMonthMassEvents = onCall(
  { region: 'asia-northeast3' },
  async (
    request: CallableRequest<{ serverGroupId: string; currentMonth: string }>
  ): Promise<{ ok: boolean; message: string }> => {
    const { serverGroupId, currentMonth } = request.data;
    const auth = request.auth;

    if (!auth) throw new Error('unauthenticated');
    if (!serverGroupId || !currentMonth)
      throw new Error('invalid arguments: serverGroupId and currentMonth required');

    const db = admin.firestore();
    const membershipDocId = `${auth.uid}_${serverGroupId}`;
    const membershipSnap = await db.collection('memberships').doc(membershipDocId).get();
    const membership = membershipSnap.data() as MembershipDoc | undefined;
    if (!membership || membership.role !== 'planner') {
      throw new Error('forbidden: planner role required');
    }
    const currMonth = dayjs(`${currentMonth}-01`); // ✅ KST 기준 (UTC 변환 없음)
    const prevMonth = currMonth.subtract(1, 'month');

    console.log(
      `📅 기준월 current=${currMonth.format('YYYY-MM')} / prev=${prevMonth.format('YYYY-MM')}`
    );

    // 1️⃣ 전월 상태 확인
    const prevMonthKey = prevMonth.format('YYYYMM');
    const statusRef = db.doc(`server_groups/${serverGroupId}/month_status/${prevMonthKey}`);
    const statusSnap = await statusRef.get();

    if (!statusSnap.exists) {
      return { ok: false, message: `${prevMonth.format('M월')} 상태 문서가 없습니다.` };
    }
    const statusVal = statusSnap.data()?.status;
    if (statusVal === 'MASS-NOTCONFIRMED') {
      return { ok: false, message: `${prevMonth.format('M월')} 상태가 미확정 상태입니다.` };
    }

    // 2️⃣ 당월 기존 일정 삭제
    const currStart = currMonth.startOf('month').format('YYYYMMDD');
    const currEnd = currMonth.endOf('month').format('YYYYMMDD');
    const currSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('event_date', '>=', currStart)
      .where('event_date', '<=', currEnd)
      .get();
    const batch = db.batch();
    currSnap.forEach((doc) => batch.delete(doc.ref));
    console.log(`🗑️ ${currSnap.size}건의 ${currMonth.format('M월')} 기존 일정 삭제 예정`);

    // 3️⃣ 기준 주간 계산: 전월의 첫 번째 일요일이 포함된 주(일~토)
    let firstSunday = prevMonth.startOf('month');
    while (firstSunday.day() !== 0) {
      firstSunday = firstSunday.add(1, 'day');
    }
    const baseWeekStart = firstSunday.startOf('day');
    const baseWeekEnd = firstSunday.add(6, 'day').endOf('day');

    console.log(
      `🧭 기준 주간: ${baseWeekStart.format('YYYY-MM-DD')} ~ ${baseWeekEnd.format('YYYY-MM-DD')}`
    );

    // 4️⃣ base 주간 일정만 가져오기
    const baseSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('event_date', '>=', baseWeekStart.format('YYYYMMDD'))
      .where('event_date', '<=', baseWeekEnd.format('YYYYMMDD'))
      .get();

    if (baseSnap.empty) {
      return { ok: false, message: `${prevMonth.format('M월')} 기준 주간 일정이 없습니다.` };
    }

    const base: Record<number, MassEventDoc[]> = {};
    baseSnap.forEach((doc) => {
      const data = doc.data() as MassEventDoc;
      const dow = dayjs(data.event_date, 'YYYYMMDD').day(); // 0=일, 6=토
      if (!base[dow]) base[dow] = [];
      base[dow].push(data);
    });

    Object.entries(base).forEach(([dow, arr]) => {
      const label = ['일', '월', '화', '수', '목', '금', '토'][Number(dow)];
      console.log(`📦 base 패턴: ${label}요일 ${arr.length}건`);
    });

    // 5️⃣ 당월 1일~말일까지 복사
    let copiedCount = 0;
    for (
      let d = currMonth.startOf('month');
      d.isSameOrBefore(currMonth.endOf('month'));
      d = d.add(1, 'day')
    ) {
      const dow = d.day();
      const events = base[dow];
      if (!events || events.length === 0) continue;

      console.log(
        `📆 ${d.format('YYYY-MM-DD')} (${['일', '월', '화', '수', '목', '금', '토'][dow]}) → 복사 ${
          events.length
        }건`
      );

      for (const ev of events) {
        const newDate = d.format('YYYYMMDD');
        const newRef = db.collection(`server_groups/${serverGroupId}/mass_events`).doc();
        batch.set(newRef, {
          title: ev.title,
          event_date: newDate,
          required_servers: ev.required_servers,
          member_ids: [],
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        copiedCount++;
      }
    }

    await batch.commit();
    console.log(`✅ 복사 완료 (${copiedCount}건)`);

    return {
      ok: true,
      message: `${prevMonth.format('M월')} 첫째 주 패턴(${baseWeekStart.format(
        'MM/DD'
      )}~${baseWeekEnd.format('MM/DD')})을 ${currMonth.format(
        'M월'
      )} 전체에 복사 완료 (${copiedCount}건)`,
    };
  }
);
