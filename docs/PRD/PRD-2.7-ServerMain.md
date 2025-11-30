# PRD-2.7 ServerMain (복사 메인 페이지, v2025-11 개정)

본 문서는 **복사(Server)** 사용자가 로그인 후 접근하는  
**메인 페이지(ServerMain)** 의 기능과 동작 규칙을 정의한다.

2025-11 개정 버전에서는 기존의 “회원=복사 1:1 구조”를 폐지하고,  
**회원 1명 → 복수 복사(Member) 관리**,  
**복사단 우선 선택**,  
**복사별 필터링**,  
**Pending 상태 완전 폐지**를 반영하여 UI/로직을 재설계한다.

---

## 1. 개요

| 항목 | 설명 |
|------|------|
| 역할 | 복사(Server) 또는 복사 부모 계정의 메인 화면 |
| 핵심 개념 | 복수 복사(memberId)를 통합 관리 |
| 우선 선택 | 반드시 하나의 **복사단(server_group)** 을 먼저 선택 |
| 표시 내용 | 달력(Calendar), 복사 리스트, 배정 정보 |
| 제한 | active=false(미승인 복사)는 기능 제한, 단 Pending 페이지 없음 |

---

## 2. ServerMain 전체 구조(필수 개정 사항)

ServerMain 페이지는 다음 UI 구조를 **항상 동일하게 유지**한다.

[ 1. 복사단 선택 Dropdown ] ← 최상단
[ 2. 나의 복사버튼  리스트 + (+ 복사 추가) ]
[ 3. 월별 일정 달력 (Multi-member) ]

- 내 복사 전체 일정 표시
- 복사 버튼 check/uncheck 으로 필터링

[ 4. Mini Drawer (날짜 클릭 시) ]

---

## 3. UI 상세 설명

### 3.1 복사단 선택 dropdown (필수)

- 사용자가 가진 복사(member)의 server_group 목록을 자동 수집 후 dropdown 표시.
- 복사단이 1개인 경우에는 그대로 표시하고,
- 복사단이 n개인 경우에는 처음에는 선택하게 하고 그 이후에는 이전에 최종으로 선택했던 복사단을 디폴트로 표시함.
- 필수 선택 요소이며, 복수 복사단을 운영하는 경우 우선적으로 선택해야 함.
- 선택된 server_groupId 로 모든 데이터 fetch 기준이 됨.

예:
[ 대구 범어성당 복사단 ▼ ]
[ 수원 죽전성당 복사단 ▼ ]

---

### 3.2 나의 복사 버튼 리스트

복사단이 선택되면, 해당 복사단에 속한 **내 복사들**을 버튼(활성화/비활성화)으로 표시한다.

예:
[ 지안(클라라) ] [ 민준(요셉) ] [ + 복사 추가 ] <- 실제 버튼이 아니라 활성화/비활성화로 구분함

#### 버튼 상태 규칙

| 상태 | 표시 | 기능 |
|------|------|------|
| active=true | 활성화, 클릭 가능 | 필터링 / 강조 표시 |
| active=false | `지안(승인대기중)` | 클릭 안됨 |

#### 기능 필터링

- 버튼이 `checked=true` 이면 해당 복사의 일정만 달력에서 강조 표시.
- 여러 복사를 체크해서 동시에 표시 가능.

---

### 3.3 월별 일정 달력(Calendar)

#### 표시 규칙

- 승인된 복사가 하나도 없는 경우 달력의 미사일정 정보 등 모든 정보를 표시하지 않음.
- 선택된 복사단(server_group)의 모든 mass_events 표시.
- 일정(event)이 `member_ids` 에 내 복사 중 하나라도 포함하면 달력에 “내 일정”으로 강조.

#### 필터링 규칙

- 선택된 복사단의 미사 일정 전체 표시
  → 그중 "체크된 복사"의 memberIds 와 일치하는 일정 강조

#### 강조 정책

| 유형 | 표시 방식 |
|------|-----------|
| 체크된 복사의 일정 | 색상 강조 / border 강조 |
| 체크되지 않은 복사의 일정 | 표시되지만 흐리게(faded) |
| active=false 복사 | 매칭되어도 강조하지 않음 |

---

### 3.4 MassEventMiniDrawer (날짜 클릭 시)

#### Drawer 표시 내용

- 해당 날짜의 모든 mass_events 리스트
- 이벤트별 배정 현황

#### 배정 이름 표시 정책

| 상태 | 복사명 표시 |
|------|-------------|
| MASS-NOTCONFIRMED | Drawer 비활성 |
| MASS-CONFIRMED | ❌ 비공개 (배정 대기 중) |
| SURVEY-CONFIRMED | ❌ 비공개 (배정 대기 중) |
| FINAL-CONFIRMED | ✅ 배정 복사명 전체 공개 |

#### 미승인(active=false) 복사 처리

- “배정 복사명”에 포함되어도 표시하지 않음.
- “배정 대기 중” 상태에서는 항상 비공개.

---

## 4. 접근 제어(RoleGuard)

Pending 페이지는 폐지됨.  
접근 제어는 다음 규칙만 적용한다.

| 조건 | 결과 |
|------|-------|
| 로그인 안 됨 | `/login` |
| 선택된 복사단의 Planner | Dashboard |
| 선택된 복사단의 내 복사(active=true) 존재 | ServerMain 정상 접근 |
| 선택된 복사단에 active=true 복사 없음 | ServerMain 접근 가능 (단 모든 복사 '승인대기중') |
| 그 외 | `/forbidden` |

### 특징

- “승인대기중”은 ServerMain UI에서만 표시됨  
- 접근은 항상 허용되며 기능 제한만 적용됨

---

## 5. 실시간 데이터 구독

## 5.1 mass_events

- server_groups/{sg}/mass_events
  → event_date 기준 월간 쿼리
  → onSnapshot 실시간 반영

---

### 5.2 month_status

- server_groups/{sg}/month_status/{yyyymm}
  → onSnapshot 구독
  → 달력/Drawer 상태 변화 기반

---

## 5.3 members (내 복사)

- server_groups/{sg}/members
  where parent_uid == currentUser.uid
  → active 상태 실시간 확인

---

## 6. 상태별 UI 동작 요약

| 월 상태 | 달력 표시 | Drawer 표시 | 복사명 표시 |
|---------|-----------|-------------|-------------|
| MASS-NOTCONFIRMED | 회색/비활성 | Drawer 비활성 | - |
| MASS-CONFIRMED | 미사 존재 표시 | 열리지만 비공개 | “배정 대기 중” |
| SURVEY-CONFIRMED | 동일 | 비공개 | “배정 대기 중” |
| FINAL-CONFIRMED | 본인 일정 강조 | 전체 공개 | 배정 복사명 표시 |

---

## 7. 시간/날짜 처리

| 항목 | 내용 |
|------|------|
| 저장 | `"YYYYMMDD"` 문자열 |
| 표시 | `dayjs(event_date, "YYYYMMDD")` |
| Timezone | Asia/Seoul 고정 |
| 변환 함수 | 일반 dayjs 사용, timezone 변환 없음 |

---

## 8. 연계 문서

- PRD-2.1.1-SignUp SignIn.md  
- PRD-2.4.2.3-TimezoneHandling.md  
- PRD-2.5.5-Auto ServerAssignment Logic.md  
- PRD-2.4.7-MassEvent Calendar UI.md  
- PRD-2.13-App-UIUX.md  

---

## ✔ 요약

ServerMain은 다음의 원칙을 따른다:

1. **복사단을 먼저 선택**  
2. **내 복사를 버튼(활성화/비활성화)으로 선택/필터링**  
3. **달력에는 내 복사단의 일정이 모두 표시**  
4. **미승인(active=false)은 기능 제한 + “승인대기중” 표시**  
5. **Pending 페이지 없음 → 모든 것은 UI에서 명확히 표시**

---
