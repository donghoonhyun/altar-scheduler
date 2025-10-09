# 2.4.2.3 Timezone Handling (최종 버전 – 2025-10)

- 🧭 목적
각 본당(server_group)은 서로 다른 표준시(Timezone)를 사용할 수 있으므로,
모든 미사 일정(mass_events.date)은 해당 본당의 현지 자정(Local Midnight) 기준으로
Firestore에 UTC Timestamp 형태로 저장해야 한다.
클라이언트(UI)와 서버(Cloud Function)는 동일한 Timezone을 참조해
오프셋 오차 없이 동일한 날짜가 표시되도록 한다.

## 📌2.4.2.3.1 Firestore 저장 규칙

🔹 기본 개념

Firestore에 저장되는 date 필드는 UTC Timestamp 형식이다.

그러나 의미상으로는 “해당 본당의 현지 자정(Local Midnight)”을 가리킨다.

server_groups/{id}.timezone 필드가 Timezone 기준이다.
(없을 경우 'Asia/Seoul'을 기본값으로 사용한다.)

🔹 저장 규칙
항목 규칙
데이터 타입 Firestore Timestamp
저장 기준 현지 자정(Local Midnight) 기준 UTC Timestamp
변환 방식 Timestamp.fromDate(dayjs(date).tz(tz, true).startOf('day').toDate())
기준 필드 server_groups/{id}.timezone
기본값 'Asia/Seoul'
🔹 예시
본당 timezone Firestore에 저장되는 Timestamp 의미
범어성당 (한국) Asia/Seoul 2025-09-02T00:00:00+09:00 9월 2일 자정 (KST)
사이판 성당 Pacific/Saipan 2025-09-02T00:00:00+10:00 9월 2일 자정 (Saipan)
괌 성당 Pacific/Guam 2025-09-02T00:00:00+10:00 9월 2일 자정 (Guam)
2.4.2.3.2 클라이언트 (UI) 표시 규칙
🔹 원칙

UI는 Firestore의 UTC Timestamp를 읽어들일 때,
server_group.timezone을 기준으로 변환해야 한다.

변환 결과는 현지 시각(Local Time)으로 표시한다.

Asia/Seoul을 fallback으로 사용한다.

🔹 변환 유틸
// src/lib/firestore.ts
export function toLocalDateFromFirestore(
  date: Timestamp | FirestoreTimestampLike | Date | string | null | undefined,
  tz: string = 'Asia/Seoul'
): dayjs.Dayjs {
  if (!date) return dayjs.tz(tz);
  const seconds = (date as any)._seconds ?? (date as any).seconds;
  if (typeof seconds === 'number') {
    return dayjs.unix(seconds).utc().tz(tz); // UTC → 현지
  }
  if (date instanceof Date) {
    return dayjs(date).utc().tz(tz);
  }
  return dayjs.tz(tz);
}

🔹 사용 예시
// MassCalendar.tsx
const tz = serverGroup.timezone || 'Asia/Seoul';
const localDayjs = toLocalDateFromFirestore(event.date, tz);
const label = localDayjs.format('YYYY-MM-DD');

## 📌2.4.2.3.3 클라이언트 (저장 시) 규칙

🔹 원칙

미사 일정 생성 시, 사용자가 클릭한 날짜(Date)는 현지 자정 기준으로 변환되어야 한다.

변환 후 Cloud Function으로 전달할 때 "YYYY-MM-DD[T]00:00:00" 형식의 문자열로 전달한다.

🔹 변환 유틸
// src/lib/firestore.ts
export function fromLocalDateToFirestore(
  localDate: string | Date | dayjs.Dayjs,
  tz: string = 'Asia/Seoul'
): Date {
  const localMidnight = dayjs(localDate).tz(tz, true).startOf('day');
  return localMidnight.toDate(); // UTC Timestamp 기준 Date 반환
}

🔹 사용 예시
// MassEventDrawer.tsx
const tz = serverGroup.timezone || 'Asia/Seoul';
const localMidnight = fromLocalDateToFirestore(selectedDate, tz);
const formattedDate = dayjs(localMidnight).format('YYYY-MM-DD[T]00:00:00');

await createMassEvent({
  serverGroupId,
  title,
  date: formattedDate, // 현지 자정 문자열
  requiredServers,
});

2.4.2.3.4 Cloud Function 규칙
🔹 원칙

서버에서도 동일한 Timezone 기준으로 변환해야 하며,
Firestore에 UTC Timestamp 형태로 저장한다.

timezone은 server_groups/{id}.timezone에서 읽어온다.

🔹 구현 예시
// functions/src/massEvents/createMassEvent.ts
const groupRef = db.collection('server_groups').doc(serverGroupId);
const groupSnap = await groupRef.get();
const tz = groupSnap.data()?.timezone || 'Asia/Seoul';

const localMidnight = dayjs(date).tz(tz, true).startOf('day');
const timestamp = Timestamp.fromDate(localMidnight.toDate());

t.set(eventRef, {
  server_group_id: serverGroupId,
  title,
  date: timestamp,
  required_servers: requiredServers,
  status: 'MASS-NOTCONFIRMED',
  created_at: FieldValue.serverTimestamp(),
  updated_at: FieldValue.serverTimestamp(),
});

## 📌2.4.2.3.5 Seed Script 규칙

🔹 원칙

미사 일정 시드(seedMassEvents) 생성 시에도 같은 규칙을 따른다.

date 필드는 “YYYY-MM-DDT00:00:00” 형태의 문자열로 유지하며,
Firestore 저장 시 UTC Timestamp로 변환한다.

🔹 예시
// scripts/utils/seedUtils.ts
const localDate = new Date(ev.date); // "2025-09-02T00:00:00"
batch.set(ref, {
  ...ev,
  date: Timestamp.fromDate(localDate),
  created_at: new Date(),
  updated_at: new Date(),
});

## 📌2.4.2.3.6 Timezone 계층 요약

계층	소스	예시	설명
1️⃣ server_groups.timezone	Firestore 필드	"Asia/Seoul", "Pacific/Saipan"	본당별 기준 timezone
2️⃣ Firestore 저장	UTC Timestamp	2025-09-02T00:00:00+09:00	현지 자정 기준 UTC
3️⃣ Cloud Function	server_group.timezone 참조	dayjs(date).tz(tz,true).startOf('day')	서버 저장 변환
4️⃣ 클라이언트 입력	Drawer.tsx	fromLocalDateToFirestore(date, tz)	현지 자정 변환
5️⃣ 클라이언트 표시	MassCalendar.tsx	toLocalDateFromFirestore(ts, tz)	현지 날짜 복원
6️⃣ fallback	모든 레벨	'Asia/Seoul'	timezone 누락 시 기본값
2.4.2.3.7 데이터 흐름 요약
sequenceDiagram
  participant UI as Client(UI)
  participant CF as Cloud Function
  participant DB as Firestore

  UI->>CF: createMassEvent({ date: "2025-09-02T00:00:00", tz })
  CF->>DB: Timestamp.fromDate(dayjs(date).tz(tz,true).startOf('day'))
  DB-->>CF: date = 2025-09-02T00:00:00+09:00 (UTC 저장)
  CF-->>UI: success (eventId)
  UI->>UI: toLocalDateFromFirestore(Timestamp, tz)

## 📌2.4.2.3.8 Validation Rules

항목	규칙
입력값(date)	"YYYY-MM-DD" 또는 "YYYY-MM-DDT00:00:00" 형식
저장 시	Timestamp.fromDate(dayjs(date).tz(tz,true).startOf('day'))
표시 시	dayjs.unix(seconds).utc().tz(tz)
timezone 필드 누락 시	'Asia/Seoul' 적용
Cloud Function 내부	Firestore 트랜잭션 사용
Seed Script	동일한 규칙 사용

## ✅ 결론

모든 Timezone 계산의 기준은 server_groups.timezone 필드이다.

Firestore에는 항상 UTC Timestamp(현지 자정 기준) 으로 저장한다.

클라이언트와 서버 모두 동일한 tz를 사용해야 한다.

fallback 기본값은 'Asia/Seoul'.

Seed, Cloud Function, UI 표시까지 모두 동일한 변환 규칙을 적용해야 한다.

## Appendix A. 표준 dateUtils.ts (2025.10 통합버전)

이 섹션은 Firestore ↔ UI ↔ Cloud Function 간의 timezone 처리 일관성을 보장하기 위한
공식 유틸리티 모듈이며, 다음 4가지 타입을 모두 지원한다.

- Firestore Timestamp
- JS Date
- string (YYYY-MM-DD, ISO)
- JSON Timestamp-like object ({ _seconds, _nanoseconds })

모든 변환은 Asia/Seoul 기준으로 처리됨
any 사용 제거 및 타입가드 기반 안전성 확보
Cloud Function 저장 시에도 동일 유틸을 재사용 가능