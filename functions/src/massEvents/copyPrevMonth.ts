import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

dayjs.extend(utc);
dayjs.extend(timezone);

interface MassEventDoc {
  title: string;
  date: FirebaseFirestore.Timestamp | Date;
  required_servers: number;
  member_ids?: string[];
  created_at?: Date;
  updated_at?: Date;
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
    const currMonth = dayjs.tz(currentMonth, 'Asia/Seoul').startOf('month');
    const prevMonth = currMonth.subtract(1, 'month');

    const batch = db.batch();

    // ✅ (NEW) 전월 상태 확인
    const prevMonthKey = prevMonth.format('YYYYMM'); // ex: 202509
    const statusRef = db.doc(`server_groups/${serverGroupId}/month_status/${prevMonthKey}`);
    const statusSnap = await statusRef.get();

    if (!statusSnap.exists) {
      return { ok: false, message: `${prevMonth.format('M월')} 상태 문서가 존재하지 않습니다.` };
    }

    const statusData = statusSnap.data() || {};
    const monthStatus = statusData.status;

    if (monthStatus !== 'MASS-CONFIRMED') {
      return {
        ok: false,
        message: `${prevMonth.format(
          'M월'
        )} 상태가 확정(MASS-CONFIRMED)이 아닙니다. 전월이 확정 상태일 때만 복사 가능합니다.`,
      };
    }

    // 🔹 1. 기존 일정 삭제
    const currSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('date', '>=', Timestamp.fromDate(currMonth.toDate()))
      .where('date', '<', Timestamp.fromDate(currMonth.endOf('month').add(1, 'day').toDate()))
      .get();
    currSnap.forEach((doc) => batch.delete(doc.ref));

    // 🔹 2. 전월 첫 주 일요일 포함 주간 계산
    let firstSunday = prevMonth.startOf('month');
    while (firstSunday.day() !== 0) {
      firstSunday = firstSunday.add(1, 'day');
    }
    const baseWeekStart = firstSunday;
    const baseWeekEnd = firstSunday.add(6, 'day');

    // 🔹 3. 기준 주간 가져오기
    const baseSnap = await db
      .collection(`server_groups/${serverGroupId}/mass_events`)
      .where('date', '>=', Timestamp.fromDate(baseWeekStart.toDate()))
      .where('date', '<', Timestamp.fromDate(baseWeekEnd.add(1, 'day').toDate()))
      .get();

    if (baseSnap.empty) {
      return { ok: false, message: `${prevMonth.format('YYYY년 M월')} 첫 주 일정이 없습니다.` };
    }

    // 🔹 4. 요일별 분류
    const baseEvents: Record<number, MassEventDoc[]> = {};
    baseSnap.forEach((snap) => {
      const raw = snap.data();
      const ev: MassEventDoc = {
        title: raw.title,
        date: raw.date.toDate(),
        required_servers: raw.required_servers,
        member_ids: raw.member_ids || [],
        created_at: new Date(),
        updated_at: new Date(),
      };
      const dateObj = ev.date instanceof admin.firestore.Timestamp ? ev.date.toDate() : ev.date;
      const dow = dayjs(dateObj).tz('Asia/Seoul').day();
      if (!baseEvents[dow]) baseEvents[dow] = [];
      baseEvents[dow].push(ev);
    });

    // 🔹 5. 복사
    for (
      let d = currMonth.clone();
      d.isBefore(currMonth.endOf('month').add(1, 'day'));
      d = d.add(1, 'day')
    ) {
      const dow = d.day();
      const dayEvents = baseEvents[dow];
      if (!dayEvents) continue;

      for (const ev of dayEvents) {
        const dateToSave = Timestamp.fromDate(d.tz('Asia/Seoul', true).toDate());
        const ref = db.collection(`server_groups/${serverGroupId}/mass_events`).doc();
        batch.set(ref, {
          title: ev.title,
          date: dateToSave,
          required_servers: ev.required_servers,
          member_ids: [],
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();
    return {
      ok: true,
      message: `${prevMonth.format('M월')} 패턴을 ${currMonth.format('M월')} 전체로 복사 완료`,
    };
  }
);
