# PRD 2.4.9 MassEvent Drawer

## 🧩 섹션 개요

본 섹션은 **MassEventDrawer 컴포넌트**의 구조, UI 요소, 상태 관리, Firestore 연동 및 상호작용 흐름을 정의한다.
이 Drawer는 미사 일정의 추가·수정·삭제를 담당하며, `MassEventPlanner` 및 `Dashboard` 내에서 호출된다.

---

## 🧩 구성 구조

```
MassEventDrawer
 ├── 헤더: 일정 제목 및 상태 표시
 ├── 본문: 일정 입력 폼
 │     ├── 미사명(title)
 │     ├── 미사일자(date)
 │     ├── 필요 복사 수(required_servers)
 │     ├── 배정 복사 선택(members)
 │     ├── 상태(status)
 └── 하단 버튼영역: 저장 / 삭제 / 닫기
```

---

## 🧩 주요 기능

| 기능     | 설명                                                               |
| ------ | ---------------------------------------------------------------- |
| 일정 추가  | 새로운 날짜 클릭 시 빈 Drawer를 열어 미사명, 일자, 복사 수, 배정 복사를 입력 후 저장           |
| 일정 수정  | 기존 이벤트 클릭 시 해당 데이터로 Drawer를 열고 상태 및 복사 목록 수정 가능                  |
| 일정 삭제  | 현재 일정 문서를 Firestore에서 삭제 (`deleteDoc()`)                         |
| 상태 변경  | 관리자가 설문 확정(`SURVEY-CONFIRMED`), 최종 확정(`FINAL-CONFIRMED`)으로 변경 가능 |
| 실시간 반영 | Firestore `onSnapshot` 기반으로 수정 즉시 UI 반영됨                         |

---

## 🧩 내부 상태 관리

| 상태명        | 타입            | 설명                                                                              |
| ---------- | ------------- | ------------------------------------------------------------------------------- |
| `formData` | 객체            | Drawer 내부 입력 폼 상태 (`title`, `date`, `required_servers`, `member_ids`, `status`) |
| `loading`  | boolean       | Firestore 업데이트 중 표시                                                             |
| `error`    | string | null | Firestore 작업 실패 시 메시지                                                           |

---

## 🧩 Firestore 연동

* **저장(create/update)**: `setDoc()` 사용, 기존 문서 존재 시 병합(`merge: true`)
* **삭제(delete)**: `deleteDoc()` 사용
* **경로**: `server_groups/{serverGroupId}/mass_events/{eventId}`
* **시간 필드**: `updated_at`은 `serverTimestamp()`로 기록

---

## 🧩 입력 폼 필드 정의

| 필드명                | 입력형태        | 검증 규칙                                                      |
| ------------------ | ----------- | ---------------------------------------------------------- |
| `title`            | TextInput   | 필수, 2~30자                                                  |
| `date`             | DatePicker  | 필수, `Asia/Seoul` 기준, `dateUtils` 변환 사용                     |
| `required_servers` | NumberInput | 1~10 범위                                                    |
| `members`          | MultiSelect | 복사단 멤버 목록에서 선택                                             |
| `status`           | Select      | `MASS-NOTCONFIRMED`, `SURVEY-CONFIRMED`, `FINAL-CONFIRMED` |

---

## 🧩 UI / UX 규칙

| 요소        | 규칙                                                                   |
| --------- | -------------------------------------------------------------------- |
| **헤더**    | 미사명(`title`) 표시, 오른쪽에 상태 아이콘 표시                                      |
| **입력 폼**  | 세로 정렬(`flex-col`), 섹션 간 간격(`gap-3`) 유지                               |
| **저장 버튼** | 파란색(`bg-blue-600 hover:bg-blue-700`), 상태별 라벨 변경 (예: '추가하기' / '수정하기') |
| **삭제 버튼** | 빨간색(`bg-red-500 hover:bg-red-600`), 삭제 확인 모달 표시 후 실행                 |
| **닫기 버튼** | 회색(`bg-gray-300 hover:bg-gray-400`)                                  |

---

### 🧩 동작 시퀀스

### ① 새 일정 추가

```
사용자 → 빈 날짜 클릭 → Drawer 오픈
입력 후 '저장' 클릭 → Firestore setDoc() 호출 → Drawer 닫힘 → 실시간 UI 갱신
```

### ② 일정 수정

```
기존 일정 클릭 → 해당 데이터 로드 → 수정 후 저장 → Firestore 업데이트 → Drawer 닫힘 → 실시간 반영
```

### ③ 일정 삭제

```
삭제 버튼 클릭 → 확인 모달 → Firestore deleteDoc() → Drawer 닫힘 → 실시간 반영
```

---

## 🧩 시간대 처리

* 모든 날짜는 `dateUtils` 모듈을 통해 변환

  * 읽기 시: `toLocalDateFromFirestore()`
  * 저장 시: `fromLocalDateToFirestore()`
* 표준 타임존: `Asia/Seoul`

---

## 🧩 실시간 반영

* Firestore `onSnapshot()`에 의해 변경사항이 즉시 `MassCalendar`에 반영됨
* 별도의 `refetch()` 호출 불필요
* Drawer 닫힘 후에도 `useMassEvents()` 훅이 자동으로 최신 데이터를 유지

---

## 🧩 관련 문서

| 섹션                                              | 관련 파일                                   |
| ----------------------------------------------- | --------------------------------------- |
| `2.4.2.2 Firestore Hooks 구조 (Realtime Version)` | `src/hooks/useMassEvents.ts`            |
| `2.4.7 MassEvent Calendar UI`                    | `src/pages/components/MassCalendar.tsx` |
| `2.4.8 MassEvent Planner UI`                     | `src/pages/MassEventPlanner.tsx`        |
| `2.4.2.3 Timezone Handling`                      | `src/lib/dateUtils.ts`                  |

---

## 🧩 결론

`MassEventDrawer`는 미사 일정의 CRUD를 담당하는 핵심 UI 컴포넌트이며,
Firestore의 실시간 리스너(`onSnapshot`) 구조와 연동되어 UI 변경을 즉각 반영한다.
모든 시간 데이터는 `Asia/Seoul` 기준으로 처리되며, 상태 전이(`SURVEY → FINAL`)는 관리자 권한에서만 허용된다.
