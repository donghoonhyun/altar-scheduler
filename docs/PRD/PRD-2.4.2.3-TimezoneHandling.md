# 2.4.2.3 Timezone Handling (개정안 – 2025-11, Asia/Seoul 단일 기준)

---

## 🕓 1. 개요

Altar Scheduler는 **대한민국 내 본당**을 기준으로 동작하며,  
모든 미사 일정 및 날짜 계산은 **대한민국 표준시(Asia/Seoul, UTC+9)** 기준으로 통일한다.

이전 버전에서의 국가별 timezone(예: Pacific/Saipan, Pacific/Guam 등) 처리 로직은  
모두 폐기되었으며, timezone 필드도 더 이상 사용하지 않는다.

---

## 📘 2. Firestore 저장 정책

| 항목 | 규칙 |
|------|------|
| 데이터 형식 | `string("YYYYMMDD")` |
| 기준 시각 | Asia/Seoul (KST) |
| 변환 로직 | `dayjs(selectedDate).format("YYYYMMDD")` |
| 예시 | `"20251101"` → 2025년 11월 1일 |
| Timezone 필드 | 사용하지 않음 (`server_groups.timezone` 삭제됨) |

```ts
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

## 📅 3. UI 표시 규칙

- Firestore에 저장된 event_date는 "YYYYMMDD" 형식의 문자열이다.
- UI에서는 단순히 dayjs(event_date, "YYYYMMDD") 로 변환하여 표시한다.
- timezone 변환(dayjs.tz, fromLocalDateToFirestore, toLocalDateFromFirestore) 등은 더 이상 사용하지 않는다.

```ts
const label = dayjs(event_date, "YYYYMMDD").format("M월 D일 (ddd)");
```

---

## ⚙️ 4. Cloud Functions 및 서버 환경

- Cloud Functions 환경은 항상 Asia/Seoul 기준으로 설정한다.
- process.env.TZ = "Asia/Seoul"; 을 functions/index.ts 최상단에 명시한다.
- 모든 일정 계산(주차, 요일, 복사 스케줄 등)은 동일한 기준으로 처리한다.

---

## 🧩 5. 데이터 일관성 규칙

| 항목    | 처리 방식                                                           |
| ----- | --------------------------------------------------------------- |
| 저장    | `"YYYYMMDD"` 문자열 (KST)                                          |
| 조회    | 그대로 문자열로 사용                                                     |
| 표시    | `dayjs(...).format("M월 D일 (ddd)")`                              |
| 변환 함수 | 불필요 (`fromLocalDateToFirestore`, `toLocalDateFromFirestore` 제거) |

## ✅ 6. 결론

- 전역 timezone 필드 제거 : server_groups.timezone 삭제
- UTC 변환 폐지 : 모든 데이터는 KST 기준으로만 해석
- 단일 기준 유지 : Firebase Functions, Firestore, UI 전부 동일 기준
- 기존 timezone 관련 유틸 제거 : dateUtils에서 관련 함수 전부 삭제 또는 비활성화
