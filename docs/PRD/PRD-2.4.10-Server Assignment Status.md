# PRD 2.4.10 Server Assignment Status UI

## 🧩 섹션 개요

본 섹션은 **복사별 배정 현황(Server Assignment Status)** 페이지의 구조, UI 요소, 데이터 표현 방식 및 동작 흐름을 정의한다.
이 화면은 플래너가 특정 월의 모든 미사 일정과 복사들의 배정 현황, 불참 여부를 한눈에 파악하고 관리하기 위해 제공된다.

---

## 🧩 구성 구조

```
ServerAssignmentStatus (Page)
 ├── 상단 헤더
 │     ├── 뒤로가기 버튼
 │     └── 타이틀: "복사별 배정 현황"
 │
 ├── 월 네비게이션
 │     ├── 이전 달 (<)
 │     ├── 현재 월 표시 (YYYY년 M월)
 │     └── 다음 달 (>)
 │
 └── 데이터 그리드 (Table)
       ├── Sticky Header (Top): 날짜 및 미사 제목
       │     └── 요일별 색상 구분 (토: 파랑, 일: 빨강)
       │
       └── Sticky Column (Left): 복사 명단
             └── 이름 / 세례명
       
       └── Data Cells (Grid): 배정 상태 표시
             ├── 배정됨: "주"(주복사-남색) / "부"(부복사-하늘색)
             ├── 불참: "✕" (빨강, 배경 연한 빨강)
             ├── 충돌: 배정되었으나 불참 설문인 경우 (빨강 경고 스타일)
             └── 미배정/가능: 빈 칸
```

---

## 🧩 주요 기능

| 기능 | 설명 |
| --- | --- |
| **월간 이동** | 이전/다음 달 버튼으로 조회할 대상 월을 변경하고 데이터를 다시 로드한다. |
| **현황 조회** | 선택된 월의 활성 복사 목록과 미사 일정을 매트릭스 형태로 조회한다. |
| **미사 헤더** | 날짜(M/D), 요일((월)), 미사 제목을 표시한다. 토/일요일은 배경색으로 구분한다. |
| **배정 상태 표시** | 각 복사가 해당 미사에 배정되었는지(주/부)를 시각적으로 구분하여 표시한다. |
| **불참 정보 표시** | 설문 조사 결과를 바탕으로 '참석 불가'인 경우 붉은색 ✕ 아이콘으로 표시한다. |
| **충돌 경고** | 불참이라고 설문했으나 실제 배정된 경우, 붉은색 배경과 텍스트로 충돌을 경고한다. |
| **스크롤 편의** | 데이터가 많을 경우를 대비해 가로/세로 스크롤을 제공하며, 날짜 헤더와 이름 컬럼은 고정(Sticky)된다. |

---

## 🧩 데이터 그리드 규칙

| 요소 | 스타일 / 규칙 |
| --- | --- |
| **Header Row** | `M/D (요일)` + 미사 제목 뱃지. <br>일요일: `bg-red-50 text-red-500` <br>토요일: `bg-blue-50 text-blue-500` <br>평일: `bg-gray-50 text-gray-400` |
| **Name Column** | Sticky Left. 이름(진하게) + 세례명(연하게) 표시. `border-r`로 구분. |
| **Cell: 주복사** | `bg-blue-600 text-white font-bold` (텍스트: "주") |
| **Cell: 부복사** | `bg-blue-100 text-blue-800 border-blue-200` (텍스트: "부") |
| **Cell: 불참** | `bg-red-50 text-red-600 font-extrabold text-lg` (텍스트: "✕") |
| **Cell: 충돌** | `bg-red-50 text-red-600 border-red-200 border` (텍스트: "주"/"부", 툴팁에 "불참 설문" 명시) |
| **구분선** | 날짜 간 세로 구분선(`border-r`) 표시. 동일 날짜의 연속된 미사 사이에는 구분선 제거. |

---

## 🧩 데이터 연동

* **Members**: `server_groups/{groupId}/members` (Active only)
* **Mass Events**: `server_groups/{groupId}/mass_events` (Query by Date Range)
* **Survey Responses**: `server_groups/{groupId}/availability_surveys/{YYYYMM}` (Unavailable lists)

---

## 🧩 UX 고려사항

* **가독성**: 좁은 화면에서도 많은 정보를 볼 수 있도록 폰트 크기 최적화 (`text-xs`, `text-[10px]`).
* **탐색**: 스크롤 시에도 '누구의' 배정인지, '언제'의 배정인지 놓치지 않도록 Sticky Position 적극 활용.
* **직관성**: 색상 코딩(파랑=배정, 빨강=불가/경고)을 통해 상태를 즉각적으로 인지 가능하게 함.
