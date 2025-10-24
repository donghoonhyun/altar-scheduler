# 2.4.2.3 Timezone Handling (최종 버전 – 2025-10)

---

## 🧭 목적

각 본당(server_group)은 서로 다른 표준시(Timezone)을 사용할 수 있으므로,  
모든 미사 일정(`mass_events.date`)은 해당 본당의 **현지 자정(Local Midnight)** 기준으로  
Firestore에 **UTC Timestamp** 형태로 저장해야 한다.  

클라이언트(UI)와 서버(Cloud Function)는 동일한 Timezone을 참조하여  
오프셋 오차 없이 동일한 날짜가 표시되도록 한다.

---

## 📌1. Firestore 저장 규칙

### 🔹 기본 개념
- Firestore에 저장되는 `date` 필드는 UTC Timestamp 형식이다.  
- 의미상으로는 “해당 본당의 현지 자정(Local Midnight)”을 가리킨다.  
- `server_groups/{id}.timezone` 필드가 Timezone 기준이며, 없을 경우 `'Asia/Seoul'`을 기본값으로 사용한다.

### 🔹 저장 규칙

| 항목 | 규칙 |
|------|------|
| 데이터 타입 | Firestore Timestamp |
| 저장 기준 | 현지 자정(Local Midnight) 기준 UTC Timestamp |
| 변환 방식 | `Timestamp.fromDate(dayjs(date).tz(tz, true).startOf('day').toDate())` |
| 기준 필드 | `server_groups/{id}.timezone` |
| 기본값 | `'Asia/Seoul'` |

### 🔹 예시

| 본당 | timezone | Firestore 저장 Timestamp | 의미 |
|------|-----------|---------------------------|------|
| 범어성당 (한국) | Asia/Seoul | `2025-09-02T00:00:00+09:00` | 9월 2일 자정 (KST) |
| 사이판 성당 | Pacific/Saipan | `2025-09-02T00:00:00+10:00` | 9월 2일 자정 (Saipan) |
| 괌 성당 | Pacific/Guam | `2025-09-02T00:00:00+10:00` | 9월 2일 자정 (Guam) |

---

## 📌2. 클라이언트 (UI) 표시 규칙

### 🔹 원칙

UI는 Firestore의 UTC Timestamp를 읽을 때,  
`server_group.timezone`을 기준으로 변환하여 **현지 시각(Local Time)** 으로 표시한다.  
Timezone 정보가 없을 경우 `'Asia/Seoul'`을 fallback으로 사용한다.

### 🔹 변환 유틸

```ts
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
// MassCalendar.tsx
const tz = serverGroup.timezone || 'Asia/Seoul';
const localDayjs = toLocalDateFromFirestore(event.date, tz);
const label = localDayjs.format('YYYY-MM-DD');
```

## 📌3. 클라이언트 (저장 시) 규칙

🔹 원칙

미사 일정 생성 시, 사용자가 클릭한 날짜(Date)는 현지 자정 기준으로 변환되어야 한다.
변환 후 Cloud Function으로 전달할 때 "YYYY-MM-DD[T]00:00:00" 형식의 문자열로 전달한다.
변환 함수: fromLocalDateToFirestore, toLocalDateFromFirestore

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

## 📌4. Cloud Function 규칙

🔹 원칙

서버에서도 동일한 Timezone 기준으로 변환해야 하며,
Firestore에는 UTC Timestamp 형태로 저장한다.
Timezone은 server_groups/{id}.timezone 에서 읽는다.

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

## 📌5. Seed Script 규칙

🔹 원칙

미사 일정 시드(seedMassEvents) 생성 시에도 같은 규칙을 따른다.
date 필드는 "YYYY-MM-DDT00:00:00" 형태의 문자열로 유지하며,
Firestore 저장 시 UTC Timestamp로 변환한다.

🔹 예시

```ts
// scripts/utils/seedUtils.ts
const localDate = new Date(ev.date); // "2025-09-02T00:00:00"
batch.set(ref, {
  ...ev,
  date: Timestamp.fromDate(localDate),
  created_at: new Date(),
  updated_at: new Date(),
});
```

## 📌6. Mass Events 기준 Timezone 변환 예시 (실데이터 연동 정책)

🔹 Firestore ↔ UI 간 변환 흐름

```ts
| 구분                 | 처리 주체                       | 데이터 형식                                                      | 변환 방식                                                                             | 비고                  |
| ------------------ | --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------- |
| **Firestore 저장 시** | Cloud Function / Planner UI | `Timestamp (UTC)`                                           | `fromLocalDateToFirestore(localDayjs, 'Asia/Seoul')`                              | UTC 기준 Timestamp 저장 |
| **UI 표시 시 (조회)**   | `useMassEvents` 훅           | `'YYYY-MM-DD' (string)`                                     | `toLocalDateFromFirestore(firestoreTimestamp, 'Asia/Seoul').format('YYYY-MM-DD')` | 현지 시각 문자열 변환        |
| **내부 계산 시**        | `dayjs` 객체                  | `dayjs(localString).tz('Asia/Seoul')`                       | 달력·툴바 등 비교용                                                                       |                     |
| **DB ↔ UI 변환 유틸**  | `/lib/dateUtils.ts`         | `fromLocalDateToFirestore()` / `toLocalDateFromFirestore()` | 통합 관리                                                                             |                     |
```

🔹 실제 적용 예시

```ts
| 필드     | Firestore 저장 값                         | UI 표시 값                        |
| ------ | -------------------------------------- | ------------------------------ |
| `date` | `2025-10-24T00:00:00Z` (UTC Timestamp) | `"2025-10-24"` (문자열, Local 기준) |
```

✅ UI(MassEventPlanner, Dashboard, MassCalendar)에서는 'YYYY-MM-DD' 문자열로 처리하되,
Firestore에는 변환된 UTC Timestamp가 저장되어 있으며, 두 변환은 dateUtils.ts 내 유틸 함수로 일관 관리한다.

## 📌7. Timezone 계층 요약

```ts
| 계층  | 소스                       | 예시                                       | 설명                |
| --- | ------------------------ | ---------------------------------------- | ----------------- |
| 1️⃣ | `server_groups.timezone` | `"Asia/Seoul"`, `"Pacific/Saipan"`       | 본당별 기준 timezone   |
| 2️⃣ | Firestore 저장             | `Timestamp` (`2025-09-02T00:00:00Z`)     | 현지 자정 기준 UTC      |
| 3️⃣ | Cloud Function           | `dayjs(date).tz(tz,true).startOf('day')` | 서버 저장 변환          |
| 4️⃣ | 클라이언트 입력                 | `fromLocalDateToFirestore(date, tz)`     | 현지 자정 변환          |
| 5️⃣ | 클라이언트 표시                 | `toLocalDateFromFirestore(ts, tz)`       | 현지 날짜 복원          |
| 6️⃣ | fallback                 | `'Asia/Seoul'`                           | timezone 누락 시 기본값 |
```

## 📌8. 데이터 흐름 요약

```mermaid
sequenceDiagram
  participant UI as Client(UI)
  participant CF as Cloud Function
  participant DB as Firestore

  UI->>CF: createMassEvent({ date: "2025-09-02T00:00:00", tz })
  CF->>DB: Timestamp.fromDate(dayjs(date).tz(tz,true).startOf('day'))
  DB-->>CF: date = 2025-09-02T00:00:00+09:00 (UTC 저장)
  CF-->>UI: success (eventId)
  UI->>UI: toLocalDateFromFirestore(Timestamp, tz)
```

## 📌9. Validation Rules

```lua
| 항목               | 규칙                                                           |
| ---------------- | ------------------------------------------------------------ |
| 입력값(`date`)      | `"YYYY-MM-DD"` 또는 `"YYYY-MM-DDT00:00:00"` 형식                 |
| 저장 시             | `Timestamp.fromDate(dayjs(date).tz(tz,true).startOf('day'))` |
| 표시 시             | `dayjs.unix(seconds).utc().tz(tz)`                           |
| timezone 필드 누락 시 | `'Asia/Seoul'` 적용                                            |
| Cloud Function   | Firestore 트랜잭션 기반 처리                                         |
| Seed Script      | 동일한 변환 규칙 적용                                                 |
```

## ✅ 결론

- 모든 Timezone 계산의 기준은 server_groups.timezone 필드이다.
- Firestore에는 UTC Timestamp(현지 자정 기준) 으로 저장한다.
- UI에서는 문자열('YYYY-MM-DD') 변환 후 표시한다.
- Cloud Function, UI, Seed Script 모두 동일한 유틸(dateUtils.ts)을 사용한다.
- fallback 기본값은 'Asia/Seoul' 이다.

## Appendix A. 표준 dateUtils.ts (2025.10 통합버전)

Firestore ↔ UI ↔ Cloud Function 간의 Timezone 처리 일관성을 보장하기 위한 공식 유틸리티 모듈.
다음 4가지 타입을 모두 지원한다:

- Firestore Timestamp
- JS Date
- string (YYYY-MM-DD, ISO)
- JSON Timestamp-like object ({ _seconds,_nanoseconds })

모든 변환은 복사단의 timezone 속성(예: Asia/Seoul) 기준으로 처리되며,
Cloud Function 저장 시에도 동일한 유틸을 재사용 가능하다.

---
