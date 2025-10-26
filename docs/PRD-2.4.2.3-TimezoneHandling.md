# 2.4.2.3 Timezone Handling (최종 버전 – 2025-10, event_date 기준)

---

## 🧭 목적

본 문서는 **`mass_events.event_date`** 가 `string(yyyymmdd)` 형태로 변경됨에 따라,  
이제 Firestore에는 UTC Timestamp 대신 **현지 기준(Local) 날짜 문자열**을 저장하고,  
Timezone(`server_groups.timezone`)은 **UI 표시 및 요일/주차 계산용**으로만 활용하는 정책을 정의한다.

---

## 📌1. 저장 정책 (Firestore 기준)

| 항목 | 규칙 |
|------|------|
| 데이터 타입 | string (형식: `YYYYMMDD`) |
| 기준 시각 | 해당 본당의 현지(Local) 자정 기준 |
| 변환 방식 | `dayjs(selectedDate).format("YYYYMMDD")` |
| 예시 | `"20251024"` → 2025년 10월 24일 |
| Timezone | 저장 시점에는 변환하지 않음 (UI 표시 시만 사용) |

### 🔹 예시 코드

```ts
const tz = serverGroup.timezone || "Asia/Seoul";
const event_date = dayjs(selectedDate).format("YYYYMMDD");

await setDoc(doc(db, `server_groups/${sg}/mass_events/${eventId}`), {
  title,
  event_date,
  required_servers,
  status: "MASS-NOTCONFIRMED",
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
});
```

---

## 📌2. 클라이언트(UI) 표시 규칙

- Firestore에서 읽은 event_date 값은 그대로 "YYYYMMDD" 형식 문자열이다.
- UI에서는 본당의 timezone(server_groups.timezone)을 참고하여
  요일·주차 계산, 캘린더 렌더링 시에만 tz 기준으로 변환한다.

🔹 표시용 변환 함수 예시

```ts
  import dayjs from "dayjs";
  import tz from "dayjs/plugin/timezone";
  dayjs.extend(tz);

  const tzValue = serverGroup.timezone || "Asia/Seoul";
  const dateObj = dayjs.tz(event_date, "YYYYMMDD", tzValue);
  const label = dateObj.format("M월 D일 (ddd)");
```

✅ Timezone은 Firestore 저장 시에는 쓰이지 않으며, 오직 UI 계산(요일, 주차, 라벨) 에만 사용된다.

### 🔹 예시

| 본당 | timezone | Firestore 저장 Timestamp | 의미 |
|------|-----------|---------------------------|------|
| 범어성당 (한국) | Asia/Seoul | `2025-09-02T00:00:00+09:00` | 9월 2일 자정 (KST) |
| 사이판 성당 | Pacific/Saipan | `2025-09-02T00:00:00+10:00` | 9월 2일 자정 (Saipan) |
| 괌 성당 | Pacific/Guam | `2025-09-02T00:00:00+10:00` | 9월 2일 자정 (Guam) |

---

## 📌3. Cloud Function 동작 규칙

- Cloud Functions(createMassEvent, copyPrevMonthMassEvents, autoServerAssignment) 등에서도
  날짜는 모두 문자열(event_date) 기준으로 처리한다.
- 주차 계산, 첫째주/둘째주 판별 등 일정 계산 시에는 server_groups.timezone을 참조해 변환한다.

```ts
  import dayjs from "dayjs";
  import timezone from "dayjs/plugin/timezone";
  dayjs.extend(timezone);

  const tz = groupSnap.data()?.timezone || "Asia/Seoul";
  const localDay = dayjs.tz(ev.event_date, "YYYYMMDD", tz);
  const weekOfMonth = localDay.week() - dayjs(localDay).startOf("month").week() + 1;
```

## 📌4. Seed Script 및 마이그레이션 규칙

- Seed Script 및 Migration Script는 Firestore에 UTC Timestamp를 저장하지 않는다.
- event_date 문자열만 유지하며, 모든 데이터는 현지 기준으로 이미 확정된 상태이다.

🔹 예시

```ts
// scripts/utils/seedUtils.ts
batch.set(ref, {
  title: ev.title,
  event_date: ev.event_date, // ex: "20251005"
  required_servers: ev.required_servers,
  created_at: new Date(),
  updated_at: new Date(),
});

```

## 📌5. 데이터 흐름 요약

🔹 Firestore ↔ UI 간 변환 흐름

```lua
sequenceDiagram
  participant UI as Client(UI)
  participant CF as Cloud Function
  participant DB as Firestore

  UI->>CF: createMassEvent({ event_date: "20251024" })
  CF->>DB: { event_date: "20251024" }
  DB-->>CF: event_date="20251024"
  CF-->>UI: success (eventId)
  UI->>UI: dayjs.tz("20251024", tz).format("M월 D일 (ddd)")
                                                                            |                     |
```

## 📌6. Timezone 계층 요약

```lua
| 계층  | 역할                       | 예시                                    | 설명                       |
| --- | ------------------------ | ------------------------------------- | ------------------------ |
| 1️⃣ | `server_groups.timezone` | `"Asia/Seoul"`, `"Pacific/Saipan"`    | 본당의 현지 기준 timezone       |
| 2️⃣ | Firestore 저장             | `"YYYYMMDD"`                          | 현지 기준 날짜 문자열 (UTC 변환 없음) |
| 3️⃣ | Cloud Function           | `dayjs.tz(event_date, "YYYYMMDD", tz)` | 요일·주차 계산용                |
| 4️⃣ | UI 표시                    | `"10월 24일 (금)"`                       | 사용자 친화적 표기용              |
| 5️⃣ | fallback                 | `"Asia/Seoul"`                        | timezone 누락 시 기본값        |

```

## 📌7. Validation Rules

```lua
| 항목                  | 규칙                                    |
| ------------------- | ------------------------------------- |
| 입력값(`event_date`)    | `"YYYYMMDD"` 형식                       |
| Firestore 저장 시      | 문자열 그대로 저장 (UTC 변환 없음)                |
| Cloud Function 계산 시 | `dayjs.tz(event_date, "YYYYMMDD", tz)` |
| Timezone 누락 시       | `'Asia/Seoul'` 사용                     |
| Seed Script         | 동일한 규칙 적용                             |

```

## ✅ 결론

- mass_events.event_date 는 현지(Local) 기준의 날짜 문자열로 Firestore에 저장된다.
- Timezone은 더 이상 저장 변환에 사용되지 않으며, 오직 UI 및 서버 계산 시점(요일/주차 표시) 에만 사용된다.
- 모든 모듈은 "YYYYMMDD" 문자열을 일관된 기준으로 사용한다.
- UTC Timestamp 기반 로직(fromLocalDateToFirestore, toLocalDateFromFirestore)은 폐기한다.

---
