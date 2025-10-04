// scripts/utils/seedUtils.ts
import dayjs from 'dayjs';
import { getFirestore } from 'firebase-admin/firestore';

export interface MassEventSeed {
  date: Date;
  required_servers: number;
  title?: string;
}

/**
 * 📌 기본 패턴: 매달 요일 반복 일정 생성
 * - 일요일: 9시(2), 11시(4), 17시(2), 19:30(2)
 * - 토요일: 19:30(2)
 * - 수요일: 19시(1)
 */
export function generateMassEventsForMonth(year: number, month: number): MassEventSeed[] {
  const baseDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const daysInMonth = baseDate.daysInMonth();
  const events: MassEventSeed[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = baseDate.date(d);
    const weekday = date.day(); // 0=일, 1=월 ... 6=토

    if (weekday === 3) {
      events.push({ date: date.hour(19).minute(0).toDate(), required_servers: 1 });
    }
    if (weekday === 6) {
      events.push({ date: date.hour(19).minute(30).toDate(), required_servers: 2 });
    }
    if (weekday === 0) {
      events.push({ date: date.hour(9).minute(0).toDate(), required_servers: 2 });
      events.push({ date: date.hour(11).minute(0).toDate(), required_servers: 4 });
      events.push({ date: date.hour(17).minute(0).toDate(), required_servers: 2 });
      events.push({ date: date.hour(19).minute(30).toDate(), required_servers: 2 });
    }
  }

  return events;
}

/**
 * 📌 title 생성 함수
 * - 일요일: "주일 11시 미사"
 * - 평일/토요일: "수 19:30 미사"
 */
function formatMassTitle(date: Date, customTitle?: string): string {
  if (customTitle) return customTitle;

  const d = dayjs(date);
  const weekday = d.day(); // 0=일
  const hh = d.hour();
  const mm = d.minute();

  const timeLabel = mm === 0 ? `${hh}시` : `${hh}:${String(mm).padStart(2, '0')}`;
  const weekLabel = weekday === 0 ? '주일' : ['일', '월', '화', '수', '목', '금', '토'][weekday];

  return `${weekLabel} ${timeLabel} 미사`;
}

/**
 * 📌 특정 달 + 추가 이벤트 배열을 Firestore에 저장
 */
export async function seedMassEvents(
  serverGroupId: string,
  year: number,
  month: number,
  extra: MassEventSeed[] = []
) {
  const db = getFirestore();
  const sgRef = db.collection('server_groups').doc(serverGroupId);

  const baseEvents = generateMassEventsForMonth(year, month);
  const allEvents = [...baseEvents, ...extra];

  let seq = 1;
  for (const ev of allEvents) {
    const eventId = `ME${String(seq).padStart(6, '0')}`;
    const title = formatMassTitle(ev.date, ev.title);

    await sgRef.collection('mass_events').doc(eventId).set({
      server_group_id: serverGroupId,
      title,
      date: ev.date,
      required_servers: ev.required_servers,
      status: 'MASS-NOTCONFIRMED',
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log(
      `✅ ${eventId} → ${dayjs(ev.date).format('YYYY-MM-DD HH:mm')} ${title} (${
        ev.required_servers
      }명)`
    );
    seq++;
  }

  // counter 업데이트
  await db
    .collection('counters')
    .doc('mass_events')
    .set({ last_seq: seq - 1, updated_at: new Date() }, { merge: true });

  console.log(`📌 counters/mass_events.last_seq = ${seq - 1}`);
}
