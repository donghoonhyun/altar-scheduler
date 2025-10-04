// src/lib/firestore.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, Timestamp } from 'firebase/firestore';
import { firebaseConfig } from '../config/firebaseConfig';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// --------------------------------------------------------
// 🔹 Firebase 초기화
// --------------------------------------------------------
const app = initializeApp(firebaseConfig);

// Firestore 인스턴스
export const db = getFirestore(app);

// ✅ 개발 환경이면 Firestore Emulator 연결
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log('✅ Firestore Emulator 연결됨');
}

// --------------------------------------------------------
// 🔹 Timezone-safe 변환 유틸 (PRD 2.4.2.3 준수)
// --------------------------------------------------------

/**
 * ✅ Firestore Timestamp → dayjs 변환 (timezone 반영)
 */
export function toLocalDateFromFirestore(
  date:
    | Timestamp
    | { _seconds?: number; seconds?: number; _nanoseconds?: number; nanoseconds?: number }
    | Date
    | string
    | null
    | undefined,
  tz: string = 'Asia/Seoul'
): dayjs.Dayjs {
  // ✅ 완전 방어
  if (!date || (typeof date === 'number' && isNaN(date))) {
    console.warn('⚠️ Invalid date value passed to toLocalDateFromFirestore:', date);
    return dayjs.tz(tz);
  }

  // ✅ 문자열 (예: "2025-09-12")
  if (typeof date === 'string') {
    const parsed = dayjs.tz(date, tz);
    return parsed.isValid() ? parsed : dayjs.tz(tz);
  }

  // ✅ Firestore Timestamp or Emulator mock
  if (typeof date === 'object' && date !== null) {
    const obj = date as {
      _seconds?: number;
      seconds?: number;
      _nanoseconds?: number;
      nanoseconds?: number;
    };

    const seconds: number | undefined = obj._seconds ?? obj.seconds;
    if (typeof seconds === 'number' && !isNaN(seconds)) {
      // ✅ as number 으로 명시해주면 TS 오류 사라짐
      return dayjs
        .unix(seconds as number)
        .utc()
        .tz(tz);
    }
  }

  // ✅ JS Date
  if (date instanceof Date && !isNaN(date.getTime())) {
    return dayjs(date).utc().tz(tz);
  }

  // ✅ fallback
  return dayjs.tz(tz);
}

/**
 * ✅ dayjs → Firestore Timestamp 변환용
 * (createMassEvent 등 Cloud Function이나 클라이언트 저장 시)
 */
export function fromLocalDateToFirestore(
  localDate: string | Date | dayjs.Dayjs,
  tz: string = 'Asia/Seoul'
): Date {
  const d = dayjs(localDate).tz(tz).startOf('day');
  return d.toDate(); // Firestore에 Timestamp.fromDate()로 저장
}
