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
 ├── Header: 📩 복사 일정 설문
 ├── Body:
 │   ├── 설문 기간 설정 (Start Date, End Date) - 가로 배치
 │   ├── 설문 대상자 정렬 탭 (이름 / 학년) - Segmented Control
 │   ├── 설문 대상자 선택 (Checkbox list, max-height: 560px)
 │       └── 학년 정렬 시 가로 구분선 표시
 │   ├── (시작 성공 시) 공유 URL + [URL 복사] 버튼
 └── Footer:
     ├── [닫기] 버튼 + [설문 시작] 버튼 (가로 배치)
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

### 3.1 플래너 대리 입력/수정 (Proxy Submission)

플래너나 관리자가 복사(Server)를 대신하여 직접 설문 내용을 입력하거나 수정해야 할 경우가 있다. (예: 스마트폰 사용이 어려운 경우, 구두로 일정을 통보받은 경우 등)

#### UI/UX 동작
1. **진입점**: `SendSurveyDrawer` 의 하단 복사 명단 리스트.
2. **동작**:
   - 각 복사 이름 우측의 **[수정] (연필 아이콘)** 버튼 클릭.
   - **새 창(또는 새 탭)** 으로 해당 복사의 설문 페이지(`/survey/:sgId/:month?uid=:targetUid`)가 열림.
   - 새 창의 헤더에는 [뒤로가기] 대신 **[창 닫기(X)]** 버튼이 표시됨 (Planner Workflow 보호).
3. **권한**:
   - 로그인한 사용자가 **Planner** 또는 **Admin** 권한을 가진 경우에만 타인(`targetUid`)의 설문 페이지에 접근 및 제출 가능.
   - 권한이 없는 경우(일반 Server) 타인의 UID로 접근 시 "대상자가 아닙니다" 경고 표시.

---
 
 ## 🧩 3.5 설문 관리 페이지 (SurveyManagement)
 
 ### 경로
 `/server-groups/{serverGroupId}/surveys`
 
 ### 주요 기능
 
 1. **설문 목록 조회**:
    - 생성된 모든 가용성 설문(`availability_surveys`)을 최신순(YYYYMM 내림차순)으로 표시.
    - 각 카드에 설문 기간, 상태(OPEN/CLOSED), 응답률(%) 표시.
 
 2. **새로고침**:
    - 우측 상단 [새로고침] 버튼 제공 (수동 데이터 갱신).
 
 3. **상세 응답 현황 (Drawer)**:
    - 설문 카드 클릭 시 우측 Drawer 오픈.
    - **통계**: 총 대상자 수 표시.
    - **응답자 목록**: 
      - 제출 완료(푸른색 배경) / 미제출(구분) 상태 표시.
      - 이름, 세례명, 학년 정보 표시.
      - 제출 완료자의 경우 '불참' 일정 개수 표시 등 요약 정보 제공.
 
 ---

## 🧩 4. 복사용 설문 페이지 (`/survey/:serverGroupId/:yyyymm`)

### UI 및 기능

| 항목            | 설명                                      |
| ------------- | --------------------------------------- |
| 🕳 달력 표시      | 해당 월의 모든 확정 미사 일정(`mass_events`) 표시     |
| 🔗 URL 파라미터   | `?uid=xxx`: 플래너가 특정 복사를 대리하여 접속 시 사용 |
| 🔙 헤더 네비게이션 | 일반 진입 시 [뒤로가기(←)], 새 창(Popup) 진입 시 [닫기(X)] 버튼 표시 |
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

## 🧩 11. Notifications (FCM)

설문 진행 단계에 따라 FCM(푸시 알림)이 발송된다. 모든 Cloud Functions는 `asia-northeast3` (Seoul) 리전에서 실행된다.

### 11.1 공통 유틸리티 (`fcmUtils.ts`)
모든 알림 발송 로직은 `sendMulticastNotification` 함수로 공통화하여 관리한다.
*   **Input**: `parentUids` (수신자 UID 목록), `payload` (제목, 본문, 데이터, 링크)
*   **Process**:
    1.  `users/{uid}` 문서에서 `fcm_tokens` 필드를 조회.
    2.  모든 토큰을 수집 후 중복 제거 (`Set` 사용).
    3.  `admin.messaging().sendEachForMulticast`를 사용하여 일괄 발송.
    4.  WebPush 규격(`webpush.fcmOptions.link`)을 포함하여 알림 클릭 시 딥링크 이동 지원.
*   **Benefit**: 개별 함수에서 토큰 조회 로직을 중복 구현할 필요가 없음.

### 11.2 설문 시작 알림 (`onSurveyOpened`)
*   **Trigger**: `server_groups/{sgId}/availability_surveys/{month}` 문서 생성/수정 (Write)
*   **Target**: 해당 그룹의 모든 멤버(부모 계정)
*   **Message**:
    *   Title: "📋 미사 배정 설문 시작"
    *   Body: "{N}월 미사 배정 설문이 시작되었습니다. 앱에서 참여해주세요!"
    *   Action: 설문 페이지로 이동 (`/survey/{sgId}/{month}`)

### 11.3 설문 마감 및 확정 알림 (`onSurveyClosed`)
*   **Trigger**: `availability_surveys/{month}` 문서의 `status` 변경 (Update)
*   **Logic**:
    *   Status가 `CLOSED`로 변경 시: "🔒 미사 배정 설문 마감" 알림
    *   Status가 `CONFIRMED`로 변경 시: "✅ 미사 배정 확정" 알림
*   **Message (Confirmed)**:
    *   Title: "✅ 미사 배정 확정"
    *   Body: "{N}월 복사 배정표가 확정되었습니다. 확인해주세요!"
    *   Action: 메인 페이지로 이동 (`/server-groups/{sgId}`)

---

## 🧩 12. UI/Logic Refinements & Member Filtering (2025.01)

복사 관리 및 설문 현황 조회 시 사용자 경험을 개선하고 데이터 정합성을 높이기 위해 다음 규칙을 적용한다.

### 12.1 멤버 필터링 및 정렬 (Member Filtering)
모든 설문 관련 화면(설문 관리, 달력 보기, 복사별 보기 등)에서 멤버 목록은 다음 규칙에 따라 필터링된다.

1.  **Active Members (정상 목록)**:
    *   Firestore `members` 컬렉션의 `active` 필드가 `true`인 멤버만 메인 목록 및 통계(대상자/응답자 수)에 포함한다.
    *   기존 `status` 필드보다 `active` boolean 필드를 우선하여 판단한다.

2.  **Inactive / Deleted with History (하단 분리 목록)**:
    *   `active`가 `false`(또는 undefined)이거나 문서가 삭제된(`정보없음`) 멤버는 메인 목록에서 제외한다.
    *   단, **설문 제출 이력(Response)이 존재하는 경우**에는 목록 최하단에 별도 그룹("제외된 명단 / 활동종료")으로 분리하여 표시한다.
    *   설문 이력이 없는 비활동 멤버는 화면에 표시하지 않는다.

3.  **Deleted Members Handling**:
    *   멤버 문서가 물리적으로 삭제되어 참조할 수 없는 경우, 이름을 "정보없음(삭제됨?)"으로 표시하고 하단 분리 목록에 포함시킨다.

### 12.2 세례명 표시 (Baptismal Name Display)
동명이인 구분 및 신자 친화적인 UI를 위해 이름 표시 시 세례명을 병기한다.

*   **Format**: `이름 (세례명)` 또는 별도 행에 표시.
*   **적용 화면**:
    *   설문 진행 페이지 상단 헤더
    *   설문 현황 Drawer (응답자 목록)
    *   복사별 설문 현황 테이블 (`/by-server`)
    *   달력 보기 명단 카드 (Drawer)

### 12.3 통계 집계 (Stats Calculation)
*   **총 대상자 수**: `active: true` 인 멤버 수.
*   **응답자 수**: 응답을 제출한 멤버 중 `active: true` 인 멤버 수.
*   **응답률**: (Active 응답자 / Active 대상자) * 100.
*   *비활동 멤버의 응답은 통계 수치에는 포함하지 않으나, 하단 목록에서 데이터 확인은 가능하다.*
