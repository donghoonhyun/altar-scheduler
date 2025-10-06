// src/lib/firestore.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, connectFirestoreEmulator, Timestamp } from 'firebase/firestore';
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
export const db = getFirestore(app);

if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log('✅ Firestore Emulator 연결됨');
}

// --------------------------------------------------------
// 🔹 Timezone-safe 변환 유틸 (PRD 2.4.2.3 준수)
// --------------------------------------------------------

// ✅ Firestore Timestamp-like 객체 타입 정의
interface FirestoreTimestampLike {
  _seconds?: number;
  seconds?: number;
  _nanoseconds?: number;
  nanoseconds?: number;
}

/**
 * ✅ Firestore Timestamp → dayjs 변환 (timezone 반영)
 * Firestore에는 “현지 자정(Local Midnight) 기준 UTC Timestamp”가 저장되어 있으므로
 * UI에서는 UTC→timezone 변환만 수행하여 현지 시간으로 복원한다.
 */
export function toLocalDateFromFirestore(
  date: Timestamp | FirestoreTimestampLike | Date | string | null | undefined,
  tz: string = 'Asia/Seoul'
): dayjs.Dayjs {
  if (!date) return dayjs.tz(tz);

  // ✅ 문자열(ISO 포맷) → 현지 해석
  if (typeof date === 'string') {
    const parsed = dayjs.tz(date, tz);
    return parsed.isValid() ? parsed : dayjs.tz(tz);
  }

  // ✅ Firestore Timestamp / Emulator mock
  if (typeof date === 'object' && date !== null) {
    const ts = date as FirestoreTimestampLike;
    const sec = ts._seconds ?? ts.seconds;
    if (typeof sec === 'number' && !isNaN(sec)) {
      // 🔸 PRD 규칙: UTC → 현지 복원
      return dayjs.unix(sec).utc().tz(tz);
    }
  }

  // ✅ JS Date 객체
  if (date instanceof Date && !isNaN(date.getTime())) {
    return dayjs(date).utc().tz(tz);
  }

  return dayjs.tz(tz);
}

/**
 * ✅ 현지 날짜 → Firestore 저장용 Date (Timestamp.fromDate()와 함께 사용)
 * 입력: "YYYY-MM-DDT00:00:00" 형식 or Date/dayjs 객체
 * 변환: 해당 timezone의 자정(Local Midnight) → UTC Timestamp 기준 Date 반환
 */
export function fromLocalDateToFirestore(
  localDate: string | Date | dayjs.Dayjs,
  tz: string = 'Asia/Seoul'
): Date {
  // 🔸 PRD 규칙: 현지 자정(Local Midnight)을 UTC Timestamp 기준으로 변환
  const localMidnight = dayjs(localDate).tz(tz, true).startOf('day');
  return localMidnight.toDate();
}

// --------------------------------------------------------
// 🔹 복사 이름 조인 헬퍼 (MassCalendar / Planner 용)
// --------------------------------------------------------
export async function getMemberNamesByIds(
  serverGroupId: string,
  memberIds: string[]
): Promise<string[]> {
  if (!memberIds || memberIds.length === 0) return [];

  const names: string[] = [];
  await Promise.all(
    memberIds.map(async (id) => {
      const ref = doc(db, `server_groups/${serverGroupId}/members/${id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as { name_kor?: string; baptismal_name?: string };
        const fullName =
          data.baptismal_name && data.name_kor
            ? `${data.name_kor} ${data.baptismal_name}`
            : data.name_kor ?? '';
        if (fullName) names.push(fullName);
      }
    })
  );

  return names;
}
