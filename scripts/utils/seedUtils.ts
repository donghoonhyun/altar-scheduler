// /scripts/utils/seedUtils.ts
import dayjs from 'dayjs';
import { getFirestore } from 'firebase-admin/firestore';

export interface MassEventSeed {
  date: Date | string; // ✅ 문자열 or Date 모두 허용
  required_servers: number;
  title?: string;
  status?: string;
  member_ids?: string[];
  names?: string[]; // ✅ 참고용
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
 *  - extra 배열은 외부 파일(/scripts/data/massEvents_YYYYMM.ts)에서 import 가능
 *  - date 필드가 string이면 Date로 변환 처리
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
    // ✅ 문자열 → Date 변환 지원
    const dateObj = typeof ev.date === 'string' ? new Date(ev.date) : ev.date;
    const eventId = `ME${String(seq).padStart(6, '0')}`;
    const title = formatMassTitle(dateObj, ev.title);

    await sgRef
      .collection('mass_events')
      .doc(eventId)
      .set({
        server_group_id: serverGroupId,
        title,
        date: dateObj,
        required_servers: ev.required_servers,
        status: ev.status || 'MASS-NOTCONFIRMED',
        member_ids: Array.isArray(ev.member_ids) ? ev.member_ids : [], // ✅ 명시적 확인
        created_at: new Date(),
        updated_at: new Date(),
      });

    // ✅ 로그에는 names 표시 (사람이 확인하기 좋음)
    // const nameList = ev.names && ev.names.length ? ev.names.join(', ') : '—';
    // console.log(
    //   `✅ ${eventId} → ${dayjs(dateObj).format('YYYY-MM-DD HH:mm')} ${title} (${
    //     ev.required_servers
    //   }명) => [${nameList}]` + `(members: ${ev.member_ids?.length || 0})`
    // );

    seq++;
  }

  // counter 업데이트
  await db
    .collection('counters')
    .doc('mass_events')
    .set({ last_seq: seq - 1, updated_at: new Date() }, { merge: true });

  console.log(`📌 counters/mass_events.last_seq = ${seq - 1}`);
}
