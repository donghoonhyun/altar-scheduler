# PRD 2.4.7 MassEvent Calendar UI

## 🧩 섹션 개요

본 섹션은 **MassCalendar 컴포넌트**의 시각적 구성(UI) 및 사용자 인터랙션(UX) 규칙을 정의한다.
현재 달의 월별 상태(month_status/{yyyymm}.status) 를 상단에 배지 형태로 표시한다.
이 컴포넌트는 각 복사단의 미사 일정(`mass_events`)을 달력 형태로 표시하며, 클릭 이벤트를 처리한다.

---

## 🧩 구조 요약

```lua
MassCalendar
├── 상단 헤더
│ ├── (좌) 📅 YYYY년 M월
│ ├── (중) 🔒 확정됨 [StatusBadge]
│ ├── (우) 범례 Legend (🔒 확정됨 / 🗳️ 설문마감 / 🛡️ 최종확정) <-작게 표시, 색깔구분 추가
│ └── (우) 오늘
├── 요일 헤더 (일~토)
└── 날짜 셀 (일별 카드)
├── 미사명(title)
└── 복사명 목록(servers)
```

---

## 🧩 날짜 셀 디자인 규칙

| 영역                  | 내용                   | 스타일                                        |
| ------------------- | -------------------- | ------------------------------------------ |
| **미사명(title)**      | 상단 중앙 정렬, bold 해제    | `text-sm text-gray-800 dark:text-gray-200` |
| **복사명 목록(servers)** | 하단 1~2줄로 표시          | `text-xs text-gray-600 dark:text-gray-300` |

---

## 🧩 상태별 아이콘 및 색상

| 상태 코드            | 아이콘        | 색상          | 의미           |
| ------------------- | ------------ | ------------ | ------------- |
| `MASS-NOTCONFIRMED` | ⏱️ (Clock)   | `gray-400`   | 미확정(기본상태) |
| `MASS-CONFIRMED`    | 🔒 (Lock)    | `blue-500`   | 확정           |
| `SURVEY-CONFIRMED`  | 🗳️ (BallotBox)  | `amber-500`  | 설문마감       |
| `FINAL-CONFIRMED`   | 🛡️ (shieldCheck)  | `green-500`  | 최종확정       |

- `status` 필드 변경 시, 실시간(`onSnapshot`)으로 즉시 갱신된다.
- StatusBadge 는 아이콘+텍스트 결합으로 표시하며 한글 라벨 사용
- 배지를 클릭하면 MonthStatusDrawer 가 열려 월 상태를 변경할 수 있다

---

## 🧩 날짜 셀 스타일

| 조건                  | 적용 스타일                                             |
| ------------------- | -------------------------------------------------- |
| **오늘(isToday)**     | `bg-blue-100 border-blue-300 shadow-inner`         |
| **일요일(isSunday)**   | 날짜 숫자 붉은색(red) + 배경색(옅은 분홍색)                             |
| **토요일(isSaturday)** | 날짜 숫자 파란색(`text-blue-600 font-semibold`) + 배경색(옅은 바란색)  |
| **일반 평일**           | `bg-white hover:bg-blue-50 dark:hover:bg-gray-700` |
| **이벤트 없는 날**        | `opacity-60 cursor-default bg-gray-50`             |

---

## 🧩 복사명 강조 규칙

- 현재 로그인 사용자(`highlightServerName`)가 복사명 목록에 포함된 경우:
  . 해당 이름을 **굵게(red-600)** 처리, 배경색으로도 표시
  . 예: `홍길동` → **홍길동**

---

## 🧩 클릭 인터랙션

| 대상                   | 이벤트                         | 동작                          |
| -------------------- | --------------------------- | --------------------------- |
| **날짜 셀 전체**          | `onDayClick(date)`          | 새 일정 추가 Drawer 열기           |
| **이벤트 카드(미사명 클릭)**   | `onDayClick(date, eventId)` | 해당 일정 수정 Drawer 열기          |
| **Disabled(이벤트 없음)** | 클릭 무효                       | `cursor-default opacity-60` |

---

## 🧩 컴포넌트 Props 명세

```ts
interface MassCalendarProps {
  events?: MassEventCalendar[];
  highlightServerName?: string;
  onDayClick?: (date: Date, eventId?: string) => void;
  timezone?: string; // 기본값: 'Asia/Seoul'
  monthStatus?: MassMonthStatus; // 'MASS-CONFIRMED' 등
}
```

---

## 🧩 데이터 표시 규칙

- `events` 배열은 `MassEventCalendar` 타입 기반으로, 날짜별 그룹핑(`YYYY-MM-DD`) 처리.
- `dateUtils.toLocalDateFromFirestore()`를 사용하여 Firestore Timestamp, Date, string 모두 변환 가능.
- 각 날짜별 셀에는 해당 날짜의 이벤트가 1개 이상 존재할 수 있음.

---

## 🧩 렌더링 플로우

1️⃣ 현재 월(`currentMonth`) 기준으로 달력 테이블 구성
2️⃣ `events`를 `YYYY-MM-DD` 키로 그룹핑
3️⃣ 각 날짜 셀에 미사명, 복사명 표시
4️⃣ `onDayClick()` 이벤트로 Drawer 열기

---

## 🧩 다크모드 대응

| 요소       | 라이트모드              | 다크모드                     |
| -------- | ------------------ | ------------------------ |
| 배경색      | `bg-white`         | `bg-gray-800`            |
| 텍스트      | `text-gray-800`    | `text-gray-200`          |
| hover 효과 | `hover:bg-blue-50` | `dark:hover:bg-gray-700` |

---

## 🧩 관련 문서 연결

| 섹션                                      | 관련 파일                            |
| --------------------------------------- | -------------------------------- |
| `2.3.7 Dashboard Rendering Flow`        | `src/pages/Dashboard.tsx`        |
| `2.4.2.2 Firestore Hooks 구조 (Realtime)` | `src/hooks/useMassEvents.ts`     |
| `2.4.2.3 Timezone Handling`             | `src/lib/dateUtils.ts`           |
| `2.4.4 MassEvent Planner`               | `src/pages/MassEventPlanner.tsx` |

---

## 🧩 결론

- 이 설계에 따라 `MassCalendar`는 Firestore의 실시간 데이터(`onSnapshot`)를 기반으로,
- 미사 일정 상태·복사명·강조 규칙을 반영하는 반응형 달력 컴포넌트로 구현된다.
- MassCalendar는 월별 상태를 상단 아이콘 + 한글 라벨 + 범례로 통합 표시한다.
- 월단위 상태와 Planner 툴바 동기화가 완전하게 일치한다.
- StatusBadge → MonthStatusDrawer 인터랙션 및 onSnapshot 갱신 정책 유지.
- 본 규칙은 `Dashboard` 및 `MassEventPlanner`에서 동일하게 적용된다.
