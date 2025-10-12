# PRD 2.6 복사 가용성 설문 (Availability) (PRD-2.6-Availability Survey.md)

## 🧩 1. 섹션 개요

본 섹션은 복사(Server)들이 월 단위로 자신의 **가용성(Availability)** 을 입력하는 설문 기능을 정의한다.
설문은 각 복사단(`server_groups/{id}`)의 확정된 미사 일정(`mass_events`)을 기준으로 진행된다.
복사는 참석 불가 일정만 선택하여 제출하며, 불가 일정만 Firestore에 저장된다.
모든 일정이 참석 가능한 경우에는 달력 수정 없이 "모든 일정에 참석 가능합니다" 체크 후 제출한다.

### 1.1 설문 업무 절차

① MassEventPlanner 화면에서 [설문 진행] 버튼을 누르면 drawer 가 우측에 열려서 상세 업무를 진행함.
② drawer 에서 설문대상자를 확인.(default로 전체 members를 보여주고 선택하여 제외 할 수 있도록 함)
③ 설문일정 설정: '설문시작일(default 오늘)'~'설문종료일(default 일주일뒤)' 지정, 달력기능으로 선택.
④ [설문 시작] 버튼을 누름.
⑤ validation check :
  . Status 상태가 `MASS-CONFIRMED` 인지 확인함. 아닌 경우 alert+return.
  . 필수입력항목 체크.
⑥ validation check를 통과하면 복사에게 알려줄 url을 화면에 표시하고 옆에 [URL 복사] 버튼을 배치함.
⑦ planner는 이 url을 카카오톡 등의 별도의 도구를 통해 복사들에게 공유.
⑧ 복사 개인은 해당 url을 클릭하여 App의 설문 화면 달력에서 확정된 미사일정 중 본인이 '불가'한 날짜를 선택하고 제출함.
  불가하지 않는 미사일정은 모두 가능한 것으로 내부적으로 인식하면 됨.
  화면 달력 미사일정 카드의 default 상태는 모두 '참석가능' 으로 표시하고 '불가' 한 날만 토글로 체크하여 '불가'로 변경시킴.

---

## 🧩 2. 주요 목표 및 설계 원칙

| 항목         | 설명                                              |
| ---------- | ----------------------------------------------- |
| 📅 설문 대상   | `month_status = MASS-CONFIRMED` 상태일 때만 설문 시작 가능 |
| 👤 대상자 관리  | Drawer 기본값 = 전체 members / 필요 시 일부 제외 가능         |
| 🗓️ 응답 방식  | 불가 일정만 저장 (`false`), 나머지는 내부적으로 가능(true) 처리     |
| 💾 데이터 타입  | `"UNAVAILABLE"` → boolean(`false`)              |
| 🧢 추가 필드   | event_id별 `event_date (yyyymmdd)` 추가            |
| 🧍 설문 마감   | Planner가 MassEventPlanner 화면에서 직접 수행            |
| ✅ 모두 참석 옵션 | “모든 일정에 참석 가능합니다” 체크 후 제출 가능                    |
| ⚙️ 빈 응답 허용 | 모두 참석 시 `responses` 및 `dates` = `null` 저장 허용    |

---

## 🧩 3. 플레너용 Drawer (SendSurveyDrawer)

### 구조

```lua
SendSurveyDrawer
 ├── Header: 📩 가용성 설문 시작
 ├── Body:
 │   ├── 설문 기간 설정 (DateRangePicker)
 │   ├── 설문 대상자 선택 (Checkbox list)
 │   ├── [설문 시작] 버튼
 │   ├── (시작 성공 시) 공유 URL + [URL 복사] 버튼
 └── Footer:
     ├── [닫기] 버튼
```

### 동작 시퀀스

1. Planner가 [설문 진행] 버튼 클릭 → Drawer 오픈
2. 복사단의 활성 members 목록을 모두 로드 (기본 전체 선택)
3. 필요 시 일부 제외 가능
4. 설문기간 선택 (기본: 오늘 ~ 7일 뒤)
5. [설문 시작] 클릭 시 Firestore 문서 생성:

```ts
await setDoc(doc(db, `server_groups/${sg}/availability_surveys/${yyyymm}`), {
  start_date: fromLocalDateToFirestore(startDate, tz),
  end_date: fromLocalDateToFirestore(endDate, tz),
  member_ids: selectedMembers,
  created_at: serverTimestamp(),
  status: "OPEN",
}, { merge: true });
```

6. 성공 시 Drawer 내에 공유 URL 표시

```lua
https://altar-scheduler.web.app/survey/:serverGroupId/:yyyymm
```

---

## 🧩 4. 복사용 설문 페이지 (`/survey/:serverGroupId/:yyyymm`)

### UI 및 기능

| 항목            | 설명                                      |
| ------------- | --------------------------------------- |
| 🕳 달력 표시      | 해당 월의 모든 확정 미사 일정(`mass_events`) 표시     |
| ✅ 기본 상태       | 모든 일정 = 참석 가능 (AVAILABLE)               |
| 🚫 불가 토그      | 클릭/터치 시 “불가(false)” 로 토그                |
| 🧾 모두 참석 체크박스 | 달력에서 아무 불가 선택이 없을 때만 활성화됨               |
| 💾 제출 조건      | 불가 일정 ≥ 1 또는 모두 참석 체크 ✅                 |
| 🔁 수정 가능      | 설문 마감 전(`SURVEY-CONFIRMED` 이전)까지 재제출 가능 |

---

## 🧩 5. Firestore 데이터 구조

### 📘 설문 메타정보

```lua
server_groups/{sg}/availability_surveys/{yyyymm}
  ├── start_date: Timestamp
  ├── end_date: Timestamp
  ├── member_ids: string[]
  ├── created_at: Timestamp
  └── status: "OPEN" | "CLOSED"
```

### 📘 설문 응답

```lua
server_groups/{sg}/availability_surveys/{yyyymm}/responses/{member_id}
  ├── responses: Record<event_id, false> | null
  ├── dates: Record<event_id, string(yyyymmdd)> | null
  ├── created_at: Timestamp
  └── updated_at: Timestamp
```

#### 예시 1 — 일부 불가 선택

```json
{
  "responses": { "ME00005": false, "ME00007": false },
  "dates": { "ME00005": "20251005", "ME00007": "20251019" },
  "created_at": "2025-10-12T01:00:00Z",
  "updated_at": "2025-10-12T01:02:00Z"
}
```

#### 예시 2 — 모두 참석

```json
{
  "responses": null,
  "dates": null,
  "created_at": "2025-10-12T01:00:00Z",
  "updated_at": "2025-10-12T01:01:00Z"
}
```

---

## 🧩 6. 제출 조건 검증

| 조건                      | 결과                                   |
| ----------------------- | ------------------------------------ |
| 불가 일정 ≥ 1개              | ✅ 제출 가능                              |
| 불가 일정 0개 + “모두 참석” 체크 ✅ | ✅ 제출 가능                              |
| 불가 일정 0개 + “모두 참석” 미체크  | ❌ 제출 불가 (“모든 일정 참석 시 체크박스를 선호해주세요.”) |

---

## 🧩 7. 설문 마감 (Planner 동작)

Planner가 `MassEventPlanner` 화면의 [설문 종료] 버튼 클릭 시 실행됨. 복사는 직접 설문을 마감할 수 없음.

```ts
await setDoc(doc(db, `server_groups/${sg}/month_status/${yyyymm}`), {
  status: "SURVEY-CONFIRMED",
  updated_by: currentUser.email,
  updated_at: serverTimestamp(),
}, { merge: true });
```

Cloud Function(`onSurveyClosed`)이 호출되어 불가 응답자를 제외한 `available_members` 계산 후 각 `mass_events` 문서 업데이트.

---

## 🧩 8. Cloud Function 처리 개요

```ts
// onSurveyClosed (Cloud Function)
for each event_id in mass_events:
  unavailable_members = responses where responses[event_id] === false
  available_members = all_active_members - unavailable_members
  update mass_events[event_id].available_members = available_members
```

* `responses === null` → 모든 일정 가능으로 간주
* `responses[eventId] === false` → 불가로 인식
* `dates` 필드는 유지보수 및 로그용

---

## 🧩 9. UI / UX 가이드라인

| 요소     | 규칙                             |
| ------ | ------------------------------ |
| Drawer | 우측 슬라이드형 (`max-w-md`, fade-in) |
| 버튼     | `variant="outline" size="      |

---

## 🧩 10. 관련문서

| 관련 섹션                        | 파일                                         |
| ---------------------------- | ------------------------------------------ |
| 2.4.8 MassEvent Planner      | `PRD-2.4.8-MassEvent Planner UI.md`        |
| 2.5.5 Auto ServerAssignment  | `PRD-2.5.5-Auto ServerAssignment Logic.md` |
| 3.4.2 Firestore doc Modeling | `PRD-3.4.2-Firestore doc Modeling.md`      |
| 2.4.2.3 Timezone Handling    | `PRD-2.4.2.3-TimezoneHandling.md`          |
| 2.13 App UI & UX             | `PRD-2.13-App-UIUX.md`                     |

---
