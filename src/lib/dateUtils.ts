/**
 * 🕒 dateUtils.ts
 *
 * 목적:
 *   - Firestore Timestamp, Date, dayjs 간 상호 변환 유틸
 *   - 모든 Firestore ↔ UI 간 시간대(Timezone) 일관성 유지
 *   - PRD-2.4.2.3 Timezone Handling 정책 준수
 */

import { Timestamp } from 'firebase/firestore';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = 'Asia/Seoul';

/**
 * ✅ Firestore Timestamp → dayjs 변환
 * @param ts - Firestore Timestamp 또는 Date 또는 string
 * @param tz - 변환 기준 타임존 (기본값: 'Asia/Seoul')
 * @returns dayjs 객체
 */
export function toLocalDateFromFirestore(
  ts: Timestamp | Date | string,
  tz: string = DEFAULT_TZ
): Dayjs {
  if (ts instanceof Timestamp) {
    return dayjs(ts.toDate()).tz(tz);
  }
  if (ts instanceof Date) {
    return dayjs(ts).tz(tz);
  }
  if (typeof ts === 'string') {
    return dayjs(ts).tz(tz);
  }
  throw new Error('Invalid timestamp type for toLocalDateFromFirestore()');
}

/**
 * ✅ dayjs 또는 Date → Firestore Timestamp 변환
 * @param date - dayjs, Date, string 형식
 * @param tz - 변환 기준 타임존 (기본값: 'Asia/Seoul')
 * @returns Date 객체 (Firestore Timestamp.fromDate()에 바로 사용 가능)
 */
export function fromLocalDateToFirestore(
  date: Dayjs | Date | string,
  tz: string = DEFAULT_TZ
): Date {
  if (dayjs.isDayjs(date)) {
    return date.tz(tz).toDate();
  }
  if (date instanceof Date) {
    return dayjs(date).tz(tz).toDate();
  }
  if (typeof date === 'string') {
    return dayjs(date).tz(tz).toDate();
  }
  throw new Error('Invalid date type for fromLocalDateToFirestore()');
}

/**
 * ✅ Firestore Timestamp → ISO 문자열 변환
 * @param ts - Firestore Timestamp
 * @returns 'YYYY-MM-DD' 형식의 문자열
 */
export function toISOStringFromTimestamp(ts: Timestamp): string {
  return ts.toDate().toISOString().substring(0, 10);
}

/**
 * ✅ dayjs 포맷 유틸 (for UI 표시용)
 * @param date - dayjs 객체
 * @param format - 출력 형식 (기본값: YYYY-MM-DD)
 */
export function formatDayjs(date: Dayjs, format: string = 'YYYY-MM-DD'): string {
  return date.tz(DEFAULT_TZ).format(format);
}
