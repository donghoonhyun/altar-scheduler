# PRD 2.4.9 MassEvent Drawer

## 🧩 섹션 개요

본 섹션은 **MassEventDrawer 컴포넌트**의 구조, UI 요소, 상태 관리, Firestore 연동 및 상호작용 흐름을 정의한다.
이 Drawer는 미사 일정의 추가·수정·삭제를 담당하며, `MassEventPlanner` 및 `Dashboard` 내에서 호출된다.

---

## 🧩 구성 구조

```
MassEventDrawer
 ├── 헤더: 📝 일정 제목 및 날짜/요일 표시
 ├── 본문: 일정 입력 폼
 │     ├── 미사명(title)
 │     ├── 필요 인원(required_servers)
 │     ├── 배정된 복사 (기존 배정 표시 - 수정 시에만)
 │     │     └── 주복사 표시 (파란색 배지)
 │     └── 배정 복사 선택(members) - 미확정 상태가 아닐 때만
 │           ├── 리스트 헤더: 새로고침 / 설문 불가 제외 필터
 │           ├── 학년별 그룹핑
 │           ├── 복사 정보: 이름 + 배정 횟수 배지
 │           ├── 불참 설문 복사 표시 (주황색)
 │           └── 주복사 선택 (라디오 버튼)
 └── 하단 버튼영역: 저장 / 삭제 / 닫기
```

---

## 🧩 주요 기능

| 기능     | 설명                                                               |
| ------ | ---------------------------------------------------------------- |
| 일정 추가  | 새로운 날짜 클릭 시 빈 Drawer를 열어 미사명, 필요 인원을 입력 후 저장           |
| 일정 수정  | 기존 이벤트 클릭 시 해당 데이터로 Drawer를 열고 복사 배정 및 주복사 지정 가능                  |
| 일정 삭제  | 현재 일정 문서를 Firestore에서 삭제 (`deleteDoc()`)                         |
| 배정된 복사 표시 | 기존에 배정된 복사 목록을 상단에 표시, 주복사는 파란색 배지로 강조 |
| 주복사 지정 | 배정된 복사 중 한 명을 주복사로 지정 (필수) |
| 월간 배정 횟수 표시 | 복사 목록에서 각 복사의 **이번 달 총 배정 횟수**를 배지(예: `①`)로 표시 (1회 이상인 경우만) |
| 불참 설문 복사 표시 | 설문에서 해당 일정을 불참으로 표시한 복사를 주황색으로 강조 |
| 불참 복사 필터링 | '설문 불가 제외' 체크박스 선택 시, 불참으로 응답한 복사를 목록에서 숨김 |
| 불참 복사 선택 경고 | 불참 설문한 복사 선택 시 경고 메시지 표시 (선택은 가능) |
| 데이터 새로고침 | '새로고침' 버튼으로 멤버 및 설문 데이터를 실시간으로 다시 불러옴 |
| 실시간 반영 | Firestore `onSnapshot` 기반으로 수정 즉시 UI 반영됨                         |

---

## 🧩 내부 상태 관리

| 상태명        | 타입            | 설명                                                                              |
| ---------- | ------------- | ------------------------------------------------------------------------------- |
| `title` | string | 미사 제목 |
| `requiredServers` | number | 필요 복사 인원 수 |
| `memberIds` | string[] | 배정된 복사 ID 목록 |
| `mainMemberId` | string | 주복사 ID |
| `hideUnavailable` | boolean | 불참 복사 숨김 여부 (필터) |
| `unavailableMembers` | Set<string> | 설문에서 불참으로 표시한 복사 ID 집합 |
| `loading`  | boolean       | Firestore 업데이트 중 표시                                                             |
| `errorMsg`    | string | Firestore 작업 실패 시 메시지                                                           |
| `showUnavailableWarning` | boolean | 불참 복사 선택 시 경고 표시 여부 |

---

## 🧩 Firestore 연동

* **저장(create/update)**: `setDoc()` 사용, 기존 문서 존재 시 병합(`merge: true`)
* **삭제(delete)**: `deleteDoc()` 사용
* **경로**: `server_groups/{serverGroupId}/mass_events/{eventId}`
* **시간 필드**: `updated_at`은 `serverTimestamp()`로 기록
* **설문 데이터**: `availability_surveys/{yyyymm}` 문서에서 불참 복사 정보 조회

---

## 🧩 입력 폼 필드 정의

| 필드명                | 입력형태        | 검증 규칙                                                      |
| ------------------ | ----------- | ---------------------------------------------------------- |
| `title`            | TextInput   | 필수, 미사 제목                                                  |
| `required_servers` | Radio Buttons | 1~6명 중 선택                                                    |
| `member_ids`          | Checkbox (학년별 그룹) | 복사단 멤버 목록에서 선택, required_servers와 정확히 일치해야 함                                             |
| `main_member_id`           | Radio Button      | 배정된 복사 중 한 명을 주복사로 지정 (필수) |

---

## 🧩 UI / UX 규칙

| 요소        | 규칙                                                                   |
| --------- | -------------------------------------------------------------------- |
| **헤더**    | 📝 아이콘 + 제목 + 날짜/요일 표시, 하단에 설명 텍스트 및 구분선 |
| **배정된 복사** | 파란색 배경 영역에 배정된 복사 표시, 주복사는 파란색 배지(`bg-blue-600`)로 강조 |
| **입력 폼**  | 세로 정렬(`flex-col`), 섹션 간 간격(`gap-4`) 유지                               |
| **복사 리스트** | 최대 높이 제한(`max-h-[600px]`) 및 스크롤 영역 제공 |
| **리스트 헤더** | '배정 복사 선택' 타이틀 우측에 **필터 체크박스**와 **새로고침 버튼** 배치 |
| **복사 선택** | 학년별 그룹핑, 이름 우측에 **배정 횟수 배지**(하늘색, `bg-blue-100`) 표시 |
| **불참 표시** | 불참 설문 복사는 주황색(`text-orange-600`) 텍스트로 표시 |
| **주복사 선택** | 선택된 복사에만 라디오 버튼 표시, 파란색 텍스트로 "주복사" 표시 |
| **경고 메시지** | 불참 복사 선택 시 상단에 주황색 경고 메시지 3초간 표시 (`animate-pulse`) |
| **저장 버튼** | 파란색(`bg-blue-600 hover:bg-blue-700`), 상태별 라벨 변경 (예: '저장' / '수정') |
| **삭제 버튼** | 빨간색 테두리(`text-red-600 border-red-400`), 삭제 확인 후 실행                 |
| **취소 버튼** | 회색 테두리(`variant="outline"`)                                  |

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
