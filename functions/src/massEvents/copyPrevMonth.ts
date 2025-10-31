import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';
import { FieldValue } from 'firebase-admin/firestore';

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);

interface MassEventDoc {
  title: string;
  event_date: string; // "YYYYMMDD"
  required_servers: number;
  member_ids?: string[];
}

export const copyPrevMonthMassEvents = onCall(
  { region: 'asia-northeast3' },
  async (
    request: CallableRequest<{ serverGroupId: string; currentMonth: string }>
  ): Promise<{ ok: boolean; message: string }> => {
    const { serverGroupId, currentMonth } = request.data;
    const auth = request.auth;

    console.log('📥 [copyPrevMonthMassEvents] 호출됨', {
      serverGroupId,
      currentMonth,
      authUid: auth?.uid,
    });

    if (!auth) throw new Error('unauthenticated');
    if (!serverGroupId || !currentMonth)
      throw new Error('invalid arguments: serverGroupId and currentMonth required');

    const db = admin.firestore();

    // ✅ 1️⃣ currentMonth / prevMonth 계산 (UTC → KST 고정)
    const currMonth = dayjs.utc(`${currentMonth}-01`).add(9, 'hour'); // 예: 2025-10-01 00:00 KST
    const prevMonth = currMonth.subtract(1, 'month');
    const batch = db.batch();

    console.log(
      `📅 현재월: ${currMonth.format('YYYY-MM-DD')} / 전월: ${prevMonth.format('YYYY-MM-DD')}`
    );

    // ✅ 2️⃣ 전월 상태 확인
    const prevMonthKey = prevMonth.format('YYYYMM');
    const statusRef = db.doc(`server_groups/${serverGroupId}/month_status/${prevMonthKey}`);
    const statusSnap = await statusRef.get();

    if (!statusSnap.exists) {
      return { ok: false, message: `${prevMonth.format('M월')} 상태 문서가 없습니다.` };
    }

    const statusVal = statusSnap.data()?.status;
    console.log(`📘 전월 상태: ${statusVal}`);
    if (statusVal === 'MASS-NOTCONFIRMED') {
      return { ok: false, message: `${prevMonth.format('M월')} 상태가 미확정 상태입니다.` };
    }

    // ✅ 3️⃣ 당월 기존 일정 삭제
    const currStart = currMonth.format('YYYYMM01');
    const currEnd = currMonth.endOf('month').format('YYYYMMDD');
    const currSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('event_date', '>=', currStart)
      .where('event_date', '<=', currEnd)
      .get();

    console.log(`🗑️ 당월(${currMonth.format('M월')}) 일정 ${currSnap.size}건 삭제 예정`);
    currSnap.forEach((doc) => batch.delete(doc.ref));

    // ✅ 4️⃣ 전월 첫 번째 일요일이 있는 주(일~토) 계산
    let firstSunday = prevMonth.startOf('month');
    while (firstSunday.day() !== 0) {
      firstSunday = firstSunday.add(1, 'day');
    }
    const baseWeekStart = firstSunday.clone();
    const baseWeekEnd = firstSunday.clone().add(6, 'day');

    console.log(
      `🧭 기준 주간: ${baseWeekStart.format('YYYY-MM-DD')} ~ ${baseWeekEnd.format('YYYY-MM-DD')}`
    );

    // ✅ 5️⃣ 전월 전체 중 기준 주간 일정만 필터링
    const allPrevSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('event_date', '>=', prevMonth.startOf('month').format('YYYYMM01'))
      .where('event_date', '<=', prevMonth.endOf('month').format('YYYYMMDD'))
      .get();

    if (allPrevSnap.empty) {
      return { ok: false, message: `${prevMonth.format('M월')} 미사 일정이 없습니다.` };
    }

    const base: Record<number, MassEventDoc[]> = {};
    const baseStartNum = parseInt(baseWeekStart.format('YYYYMMDD'));
    const baseEndNum = parseInt(baseWeekEnd.format('YYYYMMDD'));

    allPrevSnap.forEach((snap) => {
      const ev = snap.data() as MassEventDoc;
      const eventNum = parseInt(ev.event_date);
      if (eventNum < baseStartNum || eventNum > baseEndNum) return; // 기준 주간 밖은 제외

      const dow = dayjs(ev.event_date, 'YYYYMMDD').day();
      if (!base[dow]) base[dow] = [];
      base[dow].push(ev);
    });

    console.log('📦 요일별 base 패턴 확정:');
    Object.entries(base).forEach(([dow, arr]) => {
      const label = ['일', '월', '화', '수', '목', '금', '토'][parseInt(dow)];
      console.log(`   ${label}요일 ${arr.length}건`);
    });

    // ✅ 6️⃣ 당월 1일부터 말일까지 반복 복사
    let copiedCount = 0;
    for (
      let d = currMonth.clone().startOf('month');
      d.isSameOrBefore(currMonth.endOf('month'));
      d = d.add(1, 'day')
    ) {
      const dow = d.day();
      const events = base[dow];
      if (!events) continue;

      for (const ev of events) {
        const newDate = d.format('YYYYMMDD');
        const ref = db.collection(`server_groups/${serverGroupId}/mass_events`).doc();

        batch.set(ref, {
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

    console.log(
      `✅ 복사 완료: ${prevMonth.format('YYYY-MM')} → ${currMonth.format(
        'YYYY-MM'
      )} (${copiedCount}건)`
    );

    return {
      ok: true,
      message: `${prevMonth.format('M월')} 기준 주간(첫 일요일이 있는 주) 패턴을 ${currMonth.format(
        'M월'
      )}에 복사 완료 (${copiedCount}건)`,
    };
  }
);
