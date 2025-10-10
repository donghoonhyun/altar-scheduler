/**
 * 🕒 dateUtils.ts (2025.10 통합표준)
 *
 * 목적:
 *   - Firestore Timestamp, Date, string 간 상호 변환 유틸
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

/* -------------------------------------------------------------------------- */
/* 🔹 내부 타입 정의 */
/* -------------------------------------------------------------------------- */
export interface FirestoreLikeTimestamp {
  _seconds?: number;
  _nanoseconds?: number;
  seconds?: number;
  nanoseconds?: number;
}

/* -------------------------------------------------------------------------- */
/* 🔹 타입가드: Firestore Timestamp-like 객체 판별 */
/* -------------------------------------------------------------------------- */
function isFirestoreLikeTimestamp(obj: unknown): obj is FirestoreLikeTimestamp {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (('_seconds' in obj && typeof (obj as FirestoreLikeTimestamp)._seconds === 'number') ||
      ('seconds' in obj && typeof (obj as FirestoreLikeTimestamp).seconds === 'number'))
  );
}

/* -------------------------------------------------------------------------- */
/* ✅ Firestore Timestamp → dayjs 변환 (읽기용)
 * Firestore.Timestamp, Date, string, Firestore-like object 모두 지원
 * -------------------------------------------------------------------------- */
export function toLocalDateFromFirestore(
  ts: Timestamp | Date | string | FirestoreLikeTimestamp,
  tz: string = DEFAULT_TZ
): Dayjs {
  if (!ts) throw new Error('Invalid timestamp (null or undefined)');

  // ✅ Firestore Timestamp 객체
  if (ts instanceof Timestamp) {
    return dayjs(ts.toDate()).tz(tz);
  }

  // ✅ Firestore-like 객체 (_seconds / seconds)
  if (isFirestoreLikeTimestamp(ts)) {
    const seconds = ts._seconds ?? ts.seconds!;
    return dayjs(seconds * 1000).tz(tz);
  }

  // ✅ JS Date
  if (ts instanceof Date) {
    return dayjs(ts).tz(tz);
  }

  // ✅ 문자열 (ISO 또는 YYYY-MM-DD)
  if (typeof ts === 'string') {
    return dayjs(ts).tz(tz);
  }

  throw new Error('Invalid timestamp type for toLocalDateFromFirestore()');
}

/* -------------------------------------------------------------------------- */
/* ✅ dayjs 또는 Date → Firestore Timestamp 변환 (쓰기용)
 * Firestore Timestamp.fromDate()에 직접 사용할 수 있는 Date 반환
 * PRD-2.4.2.3 TimezoneHandling 정책 준수 (KST 00:00 고정)
 * -------------------------------------------------------------------------- */
export function fromLocalDateToFirestore(
  date: Dayjs | Date | string,
  tz: string = DEFAULT_TZ
): Date {
  const local = dayjs(date).tz(tz).startOf('day');

  // ✅ UTC 변환 금지, 한국시간(UTC+9)을 그대로 유지
  return local.utcOffset(9, true).toDate();
}

/* -------------------------------------------------------------------------- */
/* ✅ Firestore Timestamp → ISO 문자열 (YYYY-MM-DD)
 * UI 표시용으로 주로 사용됨
 * -------------------------------------------------------------------------- */
export function toISOStringFromTimestamp(ts: Timestamp): string {
  return ts.toDate().toISOString().substring(0, 10);
}

/* -------------------------------------------------------------------------- */
/* ✅ dayjs 포맷 유틸 (for UI 표시용)
 * @param date - dayjs 객체
 * @param format - 출력 형식 (기본값: YYYY-MM-DD)
 * -------------------------------------------------------------------------- */
export function formatDayjs(date: Dayjs, format: string = 'YYYY-MM-DD'): string {
  return date.tz(DEFAULT_TZ).format(format);
}

/* -------------------------------------------------------------------------- */
/* ✅ dayjs → Firestore Timestamp 변환 (Cloud Function 등에서 사용)
 * -------------------------------------------------------------------------- */
export function makeFirestoreTimestamp(
  date: string | Date | Dayjs,
  tz: string = DEFAULT_TZ
): Timestamp {
  const d = fromLocalDateToFirestore(date, tz);
  return Timestamp.fromDate(d);
}
