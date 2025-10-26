import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { FieldValue } from 'firebase-admin/firestore';

dayjs.extend(utc);
dayjs.extend(timezone);

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

    if (!auth) throw new Error('unauthenticated');
    if (!serverGroupId || !currentMonth)
      throw new Error('invalid arguments: serverGroupId and currentMonth required');

    const db = admin.firestore();

    // 1️⃣ Timezone 가져오기
    const sgSnap = await db.doc(`server_groups/${serverGroupId}`).get();
    const tz = sgSnap.data()?.timezone || 'Asia/Seoul';

    const currMonth = dayjs.tz(currentMonth, tz).startOf('month');
    const prevMonth = currMonth.subtract(1, 'month');
    const batch = db.batch();

    // 2️⃣ 전월 상태 확인
    const prevMonthKey = prevMonth.format('YYYYMM');
    const statusRef = db.doc(`server_groups/${serverGroupId}/month_status/${prevMonthKey}`);
    const statusSnap = await statusRef.get();

    if (!statusSnap.exists) {
      return { ok: false, message: `${prevMonth.format('M월')} 상태 문서가 없습니다.` };
    }
    if (statusSnap.data()?.status !== 'MASS-CONFIRMED') {
      return { ok: false, message: `${prevMonth.format('M월')} 상태가 MASS-CONFIRMED가 아닙니다.` };
    }

    // 3️⃣ 당월 기존 일정 삭제
    const currStart = currMonth.format('YYYYMM01');
    const currEnd = currMonth.endOf('month').format('YYYYMMDD');

    const currSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('event_date', '>=', currStart)
      .where('event_date', '<=', currEnd)
      .get();

    currSnap.forEach((doc) => batch.delete(doc.ref));

    // 4️⃣ 전월 "첫 번째 일요일이 포함된 주(일~토)" 찾기
    // 👉 즉, month.startOf('month') 부터 탐색해서 처음으로 day() === 0 (일요일) 인 날을 찾음
    let firstSunday = prevMonth.startOf('month');
    while (firstSunday.day() !== 0) firstSunday = firstSunday.add(1, 'day');

    const baseWeekStart = firstSunday.clone(); // 일요일
    const baseWeekEnd = firstSunday.clone().add(6, 'day'); // 토요일

    // 5️⃣ 기준 주간 일정 가져오기
    const baseStartKey = baseWeekStart.format('YYYYMMDD');
    const baseEndKey = baseWeekEnd.format('YYYYMMDD');

    const baseSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('event_date', '>=', baseStartKey)
      .where('event_date', '<=', baseEndKey)
      .get();

    if (baseSnap.empty) {
      return { ok: false, message: `${prevMonth.format('M월')} 기준 주간 일정이 없습니다.` };
    }

    // 6️⃣ 요일별 base 패턴 저장
    const base: Record<number, MassEventDoc[]> = {};
    baseSnap.forEach((snap) => {
      const raw = snap.data() as MassEventDoc;
      const dow = dayjs.tz(raw.event_date, 'YYYYMMDD', tz).day(); // 0~6
      if (!base[dow]) base[dow] = [];
      base[dow].push(raw);
    });

    console.log(
      '📅 기준 주간:',
      baseWeekStart.format('YYYY-MM-DD'),
      '~',
      baseWeekEnd.format('YYYY-MM-DD')
    );
    Object.entries(base).forEach(([dow, arr]) => {
      const label = ['일', '월', '화', '수', '목', '금', '토'][parseInt(dow)];
      console.log(`🗓️ ${label}요일 일정 ${arr.length}건`);
    });

    // 7️⃣ 당월 1일부터 말일까지 loop 돌며 요일 매칭 복사
    let copiedCount = 0;
    for (
      let d = currMonth.clone();
      d.isBefore(currMonth.endOf('month').add(1, 'day'));
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
      message: `${prevMonth.format('M월')} 기준 주간(첫 일요일 포함 주) 패턴을 ${currMonth.format(
        'M월'
      )}에 복사 완료 (${copiedCount}건)`,
    };
  }
);
