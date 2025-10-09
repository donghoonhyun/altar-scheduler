# PRD 2.4.4 MassEvent Planner

## 🧩 섹션 개요

본 섹션은 **MassEventPlanner 페이지**의 기능, 데이터 흐름, Drawer 인터랙션 및 Firestore 연동 정책을 정의한다.
이 페이지는 복사단의 미사 일정을 생성·수정·삭제하고, `MassCalendar` 컴포넌트를 통해 일정 현황을 시각적으로 표시한다.

---

## 🧩 구성 구조

```
MassEventPlanner
 ├── 상단 제목 및 안내 문구
 ├── MassCalendar (달력 형태 일정 표시)
 └── MassEventDrawer (일정 추가/수정/삭제 Drawer)
```

---

## 🧩 주요 기능 요약

| 기능       | 설명                                                                                      |
| -------- | --------------------------------------------------------------------------------------- |
| 미사 일정 조회 | `useMassEvents(serverGroupId)` 훅을 통해 실시간(`onSnapshot`)으로 Firestore `mass_events` 컬렉션 구독 |
| 일정 추가    | 빈 날짜 셀 클릭 시 Drawer를 열어 신규 미사 일정 등록                                                      |
| 일정 수정    | 기존 일정 클릭 시 해당 이벤트의 상세 정보로 Drawer 열기                                                     |
| 일정 삭제    | Drawer 내 삭제 버튼을 통해 Firestore 문서 제거                                                      |
| 실시간 반영   | Drawer 저장/삭제 후 별도 `refetch()` 불필요, 리스너 자동 반영                                            |

---

## 🧩 데이터 구조

Firestore 컬렉션 경로:
`server_groups/{serverGroupId}/mass_events/{eventId}`

| 필드명                | 타입          | 설명                                                                    |
| ------------------ | ----------- | --------------------------------------------------------------------- |
| `title`            | `string`    | 미사명 (예: 주일 10시 미사)                                                    |
| `date`             | `Timestamp` | 미사 일시 (Timezone 정책 준수)                                                |
| `required_servers` | `number`    | 필요 복사 인원수                                                             |
| `member_ids`       | `string[]`  | 배정된 복사 ID 목록                                                          |
| `status`           | `string`    | 미사 일정 상태 (`MASS-NOTCONFIRMED`, `SURVEY-CONFIRMED`, `FINAL-CONFIRMED`) |
| `updated_at`       | `Timestamp` | 수정 일시 (Cloud Function 자동 기록)                                          |

---

## 🧩 UI / UX 규칙

| 컴포넌트                        | 규칙                                                   |
| --------------------------- | ---------------------------------------------------- |
| **달력(MassCalendar)**        | `events` prop을 통해 실시간 구독 데이터 표시                      |
| **Drawer(MassEventDrawer)** | 선택된 날짜/이벤트에 따라 모드 전환 (신규 or 수정)                      |
| **저장 후 동작**                 | Drawer 닫기 + Firestore 리스너 자동 갱신 (manual refresh 불필요) |
| **삭제 후 동작**                 | Drawer 닫기 + Firestore onSnapshot으로 자동 반영             |

---

## 🧩 이벤트 핸들링 흐름

### ① 날짜 클릭 시 (새 일정 생성)

```ts
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

## 🧩 상태 전이 규칙

| 이전 상태               | 전이 후 상태            | 전이 조건      |
| ------------------- | ------------------ | ---------- |
| `MASS-NOTCONFIRMED` | `SURVEY-CONFIRMED` | 설문 결과로 확정됨 |
| `SURVEY-CONFIRMED`  | `FINAL-CONFIRMED`  | 관리자 승인 완료  |
| `FINAL-CONFIRMED`   | (변경 불가)            | 잠금 상태 유지   |

Drawer에서는 상태 전이에 따라 버튼/아이콘 색상이 다르게 표시된다.

---

## 🧩 시간대 처리

* 모든 날짜 필드는 `dateUtils.toLocalDateFromFirestore()`를 사용하여 변환.
* Firestore 저장 시 `fromLocalDateToFirestore()` 사용.
* 표준 타임존: `Asia/Seoul`.

---

## 🧩 실시간 데이터 반영 로직

* Firestore `onSnapshot`을 통해 변경사항 즉시 감지.
* `setEvents()`로 UI 자동 갱신.
* Drawer에서 저장/삭제 시 `refetch()` 호출 불필요.
* 성능상 200건 이하 컬렉션 기준에서 안정 동작.

---

## 🧩 Props 정의

```ts
interface MassEventPlannerProps {
  serverGroupId: string;
}
```

---

## 🧩 관련 문서

| 섹션                                              | 관련 파일                                   |
| ----------------------------------------------- | --------------------------------------- |
| `2.4.2.2 Firestore Hooks 구조 (Realtime Version)` | `src/hooks/useMassEvents.ts`            |
| `2.4.7 MassEvent Calendar UI`                   | `src/pages/components/MassCalendar.tsx` |
| `2.4.2.3 Timezone Handling`                     | `src/lib/dateUtils.ts`                  |
| `2.3.7 Dashboard Rendering Flow`                | `src/pages/Dashboard.tsx`               |

---

## 🧩 결론

`MassEventPlanner`는 Firestore 실시간 리스너(`onSnapshot`)를 기반으로 하며,
사용자는 Drawer를 통해 미사 일정을 직관적으로 추가·수정·확정할 수 있다.
UI 변경 사항은 별도의 새로고침 없이 즉시 반영되며, 모든 시간 정보는 `Asia/Seoul` 기준으로 처리된다.
