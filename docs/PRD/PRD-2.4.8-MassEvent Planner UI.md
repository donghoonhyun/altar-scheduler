# PRD 2.4.8 MassEvent Planner

## 🧩 1. 섹션 개요

본 섹션은 **MassEventPlanner 페이지**의 기능, 데이터 흐름, Drawer 인터랙션 및 Firestore 연동 정책을 정의한다.
이 페이지는 복사단의 미사 일정을 생성·수정·삭제하고, `MassCalendar` 컴포넌트를 통해 일정 현황을 시각적으로 표시한다.
상단에는 각 월의 상태에 따라 다르게 활성화되는 tools bar 버튼들이 배치된다.
버튼은 [미사일정 Preset]  [미사 일정 확정]  [가용성 설문 링크 보내기]  [설문 종료] [자동 배정]  [월 상태변경] 등의 일괄 처리 버튼이다.

---

## 🧩 2. 구성 구조

```ts
MassEventPlanner
├── 상단 제목 및 Tool Bar 버튼 라인
│ ├── [미사일정 Preset]
│ ├── [미사일정 확정]
│ ├── [가용성 설문 링크 보내기]
│ ├── [설문 종료]
│ ├── [자동 배정]
│ └── [월 상태변경]
├── MassCalendar (달력 형태 일정 표시)
│ └── 상태/범례 표시
├── MassEventDrawer (일정 추가/수정/삭제 Drawer)
└── MonthStatusDrawer (월별 상태 일괄 변경 Drawer)
```

---

## 🧩 3. 주요 기능 요약

| 기능       | 설명                                                                                      |
| -------- | --------------------------------------------------------------------------------------- |
| 미사 일정 조회 | `useMassEvents(serverGroupId)` 훅을 통해 실시간(`onSnapshot`)으로 Firestore `mass_events` 컬렉션 구독 |
| 일정 추가    | 빈 날짜 셀 클릭 시 Drawer를 열어 신규 미사 일정 등록                                                      |
| 일정 수정    | 기존 일정 클릭 시 해당 이벤트의 상세 정보로 Drawer 열기                                                     |
| 일정 삭제    | Drawer 내 삭제 버튼을 통해 Firestore 문서 제거                                                      |
| 실시간 반영   | Drawer 저장/삭제 후 별도 `refetch()` 불필요, 리스너 자동 반영                                            |

---

## 🧩 4. 데이터 구조

Firestore 컬렉션 경로:
`server_groups/{serverGroupId}/mass_events/{eventId}`

| 필드명                | 타입          | 설명                                                                    |
| ------------------ | ----------- | --------------------------------------------------------------------- |
| `title`            | `string`    | 미사명 (예: 주일 10시 미사)                                                    |
| `date`             | `Timestamp` | 미사 일시 (Timezone 정책 준수)                                                |
| `required_servers` | `number`    | 필요 복사 인원수                                                             |
| `member_ids`       | `string[]`  | 배정된 복사 ID 목록                                                          |
| `status`           | `string`    | 미사 일정 상태 (`MASS-NOTCONFIRMED`,`MASS-CONFIRMED`, `SURVEY-CONFIRMED`, `FINAL-CONFIRMED`) |
| `updated_at`       | `Timestamp` | 수정 일시 (Cloud Function 자동 기록)                                          |

---

## 🧩 5. UI / UX 규칙

```lua
| 컴포넌트                        | 규칙                                                   |
| --------------------------- | ---------------------------------------------------- |
| **달력(MassCalendar)**        | `events` prop을 통해 실시간 구독 데이터 표시                      |
| **Drawer(MassEventDrawer)** | 선택된 날짜/이벤트에 따라 모드 전환 (신규 or 수정)                      |
| **저장 후 동작**                 | Drawer 닫기 + Firestore 리스너 자동 갱신 (manual refresh 불필요) |
| **삭제 후 동작**                 | Drawer 닫기 + Firestore onSnapshot으로 자동 반영             |
```

### 5.1 렌더링 흐름

1. useMassEvents(serverGroupId) → 미사 일정 실시간 구독
2. useMonthStatus(serverGroupId, currentMonth) → 월 상태 구독
3. 상단 툴바 표시
4. MassCalendar 렌더링 (monthStatus 전달)
5. 이벤트 클릭 시 MassEventDrawer 오픈

### 5.2 상단 헤더 배치 규칙

- 목적: 사용자가 현재 보고 있는 월 상태(Status) 와 대상 월(YYYY년 M월) 을 명확히 인지할 수 있도록, 상단 헤더를 좌측 제목 + 중앙 월 상태 카드 구성으로 통일한다.

```lua
| 구분                     | 위치               | 설명                                          |
| ---------------------- | ---------------- | ------------------------------------------- |
| **제목 (`📅 미사 일정 관리`)** | 좌측 정렬            | 페이지 제목으로, 항상 “📅” 아이콘과 함께 표시                |
| **상태+년월 카드**           | 상단 영역 중앙 기준으로 정렬 | 현재 월 상태와 YYYY년 M월을 한 줄로 표시                  |
| **Toolbar 버튼 라인**      | 제목 아래, 우측 정렬     | 월 상태에 따라 버튼 활성/비활성 제어 (`useMonthStatus` 기반) |
```

---

## 🧩 6. 데이터 흐름 및 상호작용

- 달력 이동 :         MassCalendar → onMonthChange() 호출 → Planner의 currentMonth 갱신
- 월상태 변경 :       Planner → MonthStatusDrawer 호출 시 현재 월 전달 (currentMonth)
- Drawer 쿼리 기준 :  전달받은 currentMonth.startOf('month') ~ endOf('month') 범위
- 상태 필터링 :       ToggleGroup 선택값(filterStatus)에 따라 UI 실시간 필터링

### 6.1 Props 정의

```ts
interface MassEventPlannerProps {
  serverGroupId: string;
}
```

## 🧩 7. 이벤트 핸들링 흐름

### ① 날짜 클릭 시 (새 일정 생성)

```lua
onDayClick(date: Date) => {
  setSelectedDate(date);
  setSelectedEventId(undefined);
  setDrawerOpen(true);
}
```

### ② 기존 일정 클릭 시 (수정 모드)

```ts
onDayClick(date: Date, eventId: string) => {
  setSelectedDate(null);
  setSelectedEventId(eventId);
  setDrawerOpen(true);
}
```

### ③ Drawer 닫기 시

```ts
onClose() => {
  setDrawerOpen(false);
  // Firestore 리스너가 이미 최신 데이터 제공 → refetch 불필요
}
```

---

## 🧩 8. 상태 전이 규칙

| 이전 상태            | 전이 후 상태         | 전이 조건      |
| ------------------- | ------------------ | ---------- |
| `MASS-NOTCONFIRMED` | `MASS-CONFIRMED`   | 미사일정 확정됨 |
| `MASS-CONFIRMED`    | `SURVEY-CONFIRMED` | 설문마감 결과확정됨 |
| `SURVEY-CONFIRMED`  | `FINAL-CONFIRMED`  | 관리자 승인 완료  |
| `FINAL-CONFIRMED`   | (변경 불가)         | 잠금 상태 유지   |

Drawer에서는 상태 전이에 따라 버튼/아이콘 색상이 다르게 표시된다.

---

## 🧩 시간대 처리

- 모든 날짜 필드는 `dateUtils.toLocalDateFromFirestore()`를 사용하여 변환.
- Firestore 저장 시 `fromLocalDateToFirestore()` 사용.
- 표준 타임존: server_group의 time_zone필드 속성값에 따름(예:`Asia/Seoul`).

---

## 🧩 실시간 데이터 반영 로직

- Firestore `onSnapshot`을 통해 변경사항 즉시 감지.
- `setEvents()`로 UI 자동 갱신.
- Drawer에서 저장/삭제 시 `refetch()` 호출 불필요.
- 성능상 200건 이하 컬렉션 기준에서 안정 동작.

---

- monthStatus: useMonthStatus(serverGroupId, currentMonth) 훅을 통해 가져와서 MassCalendar에 전달
- MassCalendar: `<MassCalendar monthStatus={monthStatus} ... />` 형태로 호출
- MonthStatusDrawer: Planner Toolbar의 [월 상태변경] 버튼을 통해 호출

## 🧩 기술 의존성

- `@radix-ui/react-toggle-group`
- `shadcn/ui` 컴포넌트 (toggle-group, dialog, button 등)
- `dayjs` (timezone plugin 포함)
- Firestore SDK (writeBatch, query, where, getDocs)

---

## 🧩 관련 문서

| 섹션                                              | 관련 파일                                   |
| ----------------------------------------------- | --------------------------------------- |
| `2.4.2.2 Firestore Hooks 구조 (Realtime Version)` | `src/hooks/useMassEvents.ts`            |
| `2.4.7 MassEvent Calendar UI`                   | `src/pages/components/MassCalendar.tsx` |
| `2.4.2.3 Timezone Handling`                     | `src/lib/dateUtils.ts`                  |
| `2.3.7 Dashboard Rendering Flow`                | `src/pages/Dashboard.tsx`               |
| `2.4.2.3 Timezone Handling`                    | `PRD-2.4.2.3-TimezoneHandling.md`         |
| `2.4.9 MassEvent Drawer`                       | `PRD-2.4.9-MassEvent Drawer UI.md`        |
| `2.5.5 Auto ServerAssignment`                  | `PRD-2.5.5-Auto ServerAssignment Logic.md`|

---

## 🧩 Tool Bar Buttons (PRD 2.5의 연계 확장 버전)

### 📍버튼 구성 및 순서

- ① [미사일정 Preset], ② [미사 일정 확정], ③ [가용성 설문 링크 보내기], ④ [설문 종료], ⑤ [자동 배정], ⑦ [월 상태변경]

### 📍버튼별 정의

버튼명: 코드명 / 버튼 활성화 조건 / 설명

- 미사일정 Preset:
- 미사일정 확정: btnConfirmMass / monthStatus === 'MASS-NOTCONFIRMED' / 해당 월 상태를 MASS-CONFIRMED로 변경
- 가용성 설문 링크 보내기: btnSendSurveyLink / monthStatus === 'MASS-CONFIRMED' / 설문 URL 생성 및 공유 Drawer 열기
- 설문 종료: btnCloseSurvey / monthStatus === 'MASS-CONFIRMED' / 자동배정 가능 상태인 SURVEY-CONFIRMED로 변경
- 자동 배정: btnAutoAssign / monthStatus === 'SURVEY-CONFIRMED' / Cloud Function 기반 Auto Assignment 수행 (PRD-2.5.5 참조)
- 월 상태변경: btnChangeMonthStatus / currentMonth가 금월 또는 다음월일 때 / MonthStatusDrawer 열기, 상태 일괄 변경 기능 수행

### 📍① [미사일정 Preset] 동작 시퀀스

TBD

### 📍UI 스타일 규칙

항목 규칙
버튼 Variant outline 또는 secondary (비활성 시 gray-300)
아이콘 lucide-react: 📋 Copy / 🔒 Lock / 🔁 Repeat / ⚙️ Settings 등
Layout flex gap-2 justify-end mb-4 로 정렬
경고 모달 Dialog + AlertDialog 조합, 확인/취소 버튼 제공
로딩 피드백 LoadingSpinner 컴포넌트 표시 (비동기 복사 중)

---

## 🧩 결론

- MassEventPlanner는 달력(MassCalendar) 과 Drawer(MonthStatusDrawer) 간의 월 동기화를 완전하게 지원하며, 모든 상태 필터는 타입 안정성을 유지한 ToggleGroup 기반 UI로 제공된다.
- 전월 미사일정 복사 버튼을 포함한 전체 툴바 로직은 월 상태값(monthStatus)을 기준으로 UI/UX가 자동 제어되며, 각 버튼은 Firestore와 실시간 리스너(onSnapshot)에 의해 동기화되어 MassCalendar와 완전하게 연동된다.
- Firestore 변경 사항은 실시간 반영되며, UI는 접근성 표준(DialogTitle, DialogDescription)을 충족한다.

## 🧩 최근 반영 내역 (2025-10-09)

1. 상단 기능버튼 라인 추가
  . [월 상태변경] 버튼 → MonthStatusDrawer 호출
  . Drawer는 부모 MassEventPlanner의 currentMonth 정보를 전달받아 표시
2. MonthStatusDrawer 개선
  . Prop: currentMonth: dayjs.Dayjs 추가
  . Drawer 제목에 (YYYY년 M월) 표시
  . Firestore 일괄 상태변경 시 해당 월 기준 쿼리 수행
  . 접근성 경고(DialogTitle, DialogDescription) 해결
  . useMassEvents() 종속 제거 → 부모 상태 기준 동기화
3. MassCalendar 개선
  . onMonthChange(newMonth) 이벤트 추가 → 부모와 월 상태 동기화
  . 상태 필터를 Shadcn ToggleGroup 기반으로 리디자인
  . 선택 시 색상 테마 자동 변경 (gray / blue / amber / green)
  . 타입: MassStatus | 'ALL' (any 제거)
  . 필터 UI는 상단 중앙에 고정 배치 가능 (sticky 옵션 지원)
4. 공통 개선 사항
  . @radix-ui/react-toggle-group 추가 설치 및 toggle-group.tsx 생성
  . ESLint, TypeScript 경고 모두 제거
  . UI 상태 일관성 확보 (Planner ↔ Drawer 월 동기화 완전 일치)
