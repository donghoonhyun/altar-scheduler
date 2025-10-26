// /scripts/utils/seedUtils.ts
import dayjs from 'dayjs';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * 🔹 미사 이벤트 시드 데이터 타입
 * - event_date: YYYYMMDD 문자열 (필수)
 * - required_servers: 필요 복사 인원 수
 */
export interface MassEventSeed {
  server_group_id?: string; // ✅ 그룹 ID (선택)
  id?: string; // ✅ 문서 ID (선택)
  event_date: string; // ✅ 현지 기준 문자열 ("YYYYMMDD")
  required_servers: number;
  title?: string;
  status?: string;
  member_ids?: string[];
  names?: string[]; // 로그 참고용
}

/**
 * 📌 title 생성 함수
 * - 일요일: "주일 11시 미사"
 * - 평일/토요일: "수 19:30 미사"
 */
function formatMassTitle(date: Date, customTitle?: string): string {
  if (customTitle) return customTitle;

  const d = dayjs(date);
  const weekday = d.day(); // 0=일, 1=월...
  const hh = d.hour();
  const mm = d.minute();

  const timeLabel = mm === 0 ? `${hh}시` : `${hh}:${String(mm).padStart(2, '0')}`;
  const weekLabel = weekday === 0 ? '주일' : ['일', '월', '화', '수', '목', '금', '토'][weekday];

  return `${weekLabel} ${timeLabel} 미사`;
}

/**
 * 📌 특정 달 + 추가 이벤트 배열을 Firestore에 저장
 *  - event_date: YYYYMMDD 문자열로 저장
 *  - extra 배열은 외부 파일(/scripts/data/massEvents_YYYYMM.ts)에서 import 가능
 */
export async function seedMassEvents(
  serverGroupId: string,
  year: number,
  month: number,
  extra: MassEventSeed[] = []
) {
  const db = getFirestore();
  const sgRef = db.collection('server_groups').doc(serverGroupId);

  const baseEvents: MassEventSeed[] = []; // generateMassEventsForMonth 제거 (테스트 전용)
  const allEvents = [...baseEvents, ...extra];

  let seq = 1;
  for (const ev of allEvents) {
    // ✅ event_date: string 보장
    const event_date =
      typeof ev.event_date === 'string' ? ev.event_date : dayjs(ev.event_date).format('YYYYMMDD');

    const eventId = `ME${String(seq).padStart(6, '0')}`;

    // 로그 표시용 Date 객체
    const dateObj = dayjs(event_date, 'YYYYMMDD').toDate();
    const title = formatMassTitle(dateObj, ev.title);

    await sgRef
      .collection('mass_events')
      .doc(eventId)
      .set({
        server_group_id: serverGroupId,
        title,
        event_date, // ✅ Firestore에는 문자열로 저장
        required_servers: ev.required_servers,
        status: ev.status || 'MASS-NOTCONFIRMED',
        member_ids: Array.isArray(ev.member_ids) ? ev.member_ids : [],
        created_at: new Date(),
        updated_at: new Date(),
      });

    // ✅ 확인용 로그 출력
    const readableDate = dayjs(event_date, 'YYYYMMDD').format('YYYY-MM-DD (ddd)');
    const nameList = ev.names && ev.names.length ? ev.names.join(', ') : '—';
    console.log(
      `✅ ${eventId} → ${readableDate} ${title} (${ev.required_servers}명) [${nameList}]`
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
