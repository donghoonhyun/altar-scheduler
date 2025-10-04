## 2.4.2.3 Timezone Handling (최종 구현 명세)

### 🎯 목적
- 모든 미사 일정(`mass_events.date`)을 **본당의 현지 자정(local midnight)** 기준으로 Firestore에 저장하고,  
  클라이언트(UI)에서도 동일한 날짜로 표시되도록 한다.  
- UTC 변환으로 인한 ±1일 오차 문제를 완전히 방지한다.  
- Firestore Timestamp ↔️ UI 렌더링 시 **PRD 표준 변환 함수**(`fromLocalDateToFirestore`, `toLocalDateFromFirestore`)를 사용한다.
- 각 본당(server_groups) 문서에는 이미 timezone 필드가 존재하며, IANA 표준 식별자(예: "Asia/Seoul", "America/Los_Angeles")를 사용한다.

---

### 🧩 1. 저장 로직 (Cloud Function: `createMassEvent`)
#### ✅ 입력 포맷
- 클라이언트는 `"YYYY-MM-DDT00:00:00"` 형태의 ISO 자정 문자열을 전달한다.
  ```json
  {
    "serverGroupId": "SG00001",
    "title": "주일 11시 미사",
    "date": "2025-09-26T00:00:00",
    "requiredServers": 4
  }
  ```

#### ✅ 변환 로직
- Cloud Function 내부에서 다음 규칙으로 변환한다.
  ```ts
  const localMidnight = dayjs(date).tz(tz, true).startOf('day');
  const timestamp = Timestamp.fromDate(localMidnight.toDate());
  ```
  - `tz(tz, true)` : 입력 문자열을 해당 timezone의 현지 시각으로 그대로 유지  
  - `startOf('day')` : 자정(00:00:00) 기준 고정  
  - `Timestamp.fromDate()` : Firestore 저장용 UTC Timestamp 생성

#### ✅ Firestore 저장 예시
```json
"date": "Fri Sep 26 2025 00:00:00 GMT+0900 (한국 표준시)"
```

---

### 🧭 2. 조회 및 표시 로직 (클라이언트: `MassCalendar`)
#### ✅ 변환 함수
Firestore Timestamp를 현지 타임존으로 되돌린다.
```ts
export function toLocalDateFromFirestore(
  date: Timestamp | { _seconds?: number; seconds?: number },
  tz: string = "Asia/Seoul"
): dayjs.Dayjs {
  const seconds = (date as any)._seconds ?? (date as any).seconds;
  return dayjs.unix(seconds).utc().tz(tz);
}
```

#### ✅ UI 렌더링 결과
- Firestore에 `"Fri Sep 26 2025 00:00:00 GMT+0900"` 저장된 값은  
  화면상 **“9월 26일 칸”**에 정확히 표시된다.

---

### 🧩 3. 클라이언트 → 서버 전송 규칙
- 클라이언트에서 Cloud Function 호출 시 다음과 같이 처리한다:
  ```ts
  const formattedDate = dayjs(date).format("YYYY-MM-DD[T]00:00:00");
  await createMassEvent({
    serverGroupId,
    title,
    date: formattedDate,
    requiredServers,
  });
  ```
- `toISOString()` 사용 금지 (UTC 변환 발생으로 하루 당겨짐)
- `dayjs(...).format("YYYY-MM-DD[T]00:00:00")` 사용 필수

---

### ⚙️ 4. 규칙 요약

| 구분 | 규칙 |
|------|------|
| 클라이언트 → 서버 전달 | `"YYYY-MM-DDT00:00:00"` |
| 서버 변환 기준 | `dayjs(date).tz(tz, true).startOf('day')` |
| Firestore 저장 | UTC Timestamp (해당 본당 자정 기준) |
| 클라이언트 표시 | `.utc().tz(timezone)` |
| 기본 타임존 | `"Asia/Seoul"` |

---

### 🧩 5. 주요 이슈 및 해결 내역

| 번호 | 문제 | 원인 | 해결 |
|------|------|------|------|
| ① | 하루 빠르게 저장됨 | `toISOString()`이 UTC 변환 수행 | ✅ 클라이언트 → `"YYYY-MM-DDT00:00:00"` |
| ② | 하루 밀려 표시됨 | UTC ↔ KST 변환 누락 | ✅ `.utc().tz(timezone)` 적용 |
| ③ | “Value for argument 'seconds'…” 오류 | Invalid Date 전달 | ✅ 중복 `T00:00:00` 제거 |
| ④ | 에뮬레이터 vs 실DB 필드명 불일치 | `_seconds` / `seconds` 차이 | ✅ 두 경우 모두 처리 |

---

### 🧾 6. End-to-End 예시

| 단계 | 처리 기준 | 입력값 | Firestore 저장 | UI 표시 |
|------|-------------|-----------|----------------|----------|
| 클라이언트 입력 | `"2025-09-26"` 선택 | → `"2025-09-26T00:00:00"` 전송 | `"Fri Sep 26 2025 00:00:00 GMT+0900"` | ✅ 9월 26일 칸 |
| 서버 변환 | `dayjs(date).tz("Asia/Seoul", true)` | `"2025-09-26T00:00:00"` | UTC 2025-09-25T15:00:00Z | |
| 표시 변환 | `.utc().tz("Asia/Seoul")` | Timestamp(1758831600) | | ✅ 26일 |

---

### ✅ 최종 상태

- Firestore `date` 필드는 항상 **현지 자정 기준 UTC Timestamp** 로 저장됨  
- 클라이언트에서는 동일한 날짜로 정확히 표시됨  
- **PRD 2.4.2.3 Timezone Handling 표준**에 따라 모든 미사 일정 데이터의 일관성 보장 ✅
