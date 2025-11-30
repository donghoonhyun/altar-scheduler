# PRD-2.1.1-SignUp SignIn.md (사용자 가입 및 승인 절차, v2025-11 개정)

본 문서는 Altar Scheduler 시스템의 **회원가입(SignUp)**, **로그인(SignIn)**,  
**복사(Server Member) 등록 및 승인 절차**, 그리고  
**ServerMain 초기 구조(복사단 선택 및 복사 필터링)** 를 정의한다.

2025-11 개정 버전부터 기존의 “회원 = 복사 1:1 구조”를 폐기하고  
**회원 1명 → 여러 복사(N명) 관리 가능한 구조**로 완전히 재설계한다.

---

## 1. 개요(Overview)

- 회원가입은 **계정(user)** 정보만 입력 (복사 정보 없음).
- 로그인 후 ServerMain 화면에서 **복사(Server Member) 여러 명 추가 등록** 가능.
- 각 복사는 server_groups/{sg}/members/{memberId} 로 auto-id 생성.
- ServerMain 화면은 항상 **복사단 선택 → 복사 선택 → 달력 표시** 순서로 동작.
- 달력은 "내가 등록한 모든 복사"의 스케줄을 함께 보여주고,
  복사 버튼으로 개별 filtering 가능.
- 가입방식 : 이메일입력 방식, 구글 OAuth 두가지 제공. 이후 카카오톡, 네이버, Apple 추가 예정

---

## 2. 회원가입(SignUp)

### 2.1 입력 항목

| 필드 | 설명 |
|------|------|
| 이름(user_name) | 회원명 |
| 세례명(baptismal_name) | 회원 세례명 |
| 이메일(email) | 로그인 계정 |
| 비밀번호(password) | Firebase Auth |
| 전화번호(phone?) | 선택 |

> 회원가입 시 **성당/복사단/복사 정보는 입력하지 않음**  
> → 복사 정보는 로그인 후 직접 추가

### 2.2 가입 로그인 절차 Flow

```ts
[1] OAuth 로그인 (Google)
→ [2] users/{uid} 존재 여부 체크
       존재하면 → 그대로 로그인 후 Home
       없으면 → 세례명/이름 입력 페이지(CompleteProfile)
→ [3] users/{uid} 생성
→ [4] ServerMain 진입
```

### 2.3 가입방식 상세

#### 2.3.1 email password 방식

#### 2.3.1 OAuth (Google) 방식

---

### 2.4 Firestore 생성 문서

#### `users/{uid}`

```json
{
  "uid": "xxxxx",
  "user_name": "홍길동",
  "baptismal_name": "도미니코",
  "email": "user@test.com",
  "phone": "010-xxxx-xxxx",
  "created_at": "<Timestamp>",
  "updated_at": "<Timestamp>"
}
```

---

## 3. 복사(Server Member) 등록 (회원가입 이후)

회원은 로그인 후 ServerMain 화면에서 복사 정보를 원하는 만큼 등록할 수 있다.

### 3.1 복사(Server Member) 생성 입력 항목

| 필드                      | 설명 |
| ----------------------- | -- |
| 성당/복사단(server_group_id) | 필수 |
| 복사 이름(name_kor)         | 필수 |
| 복사 세례명(baptismal_name)  | 필수 |
| 학년(grade: E1~H3)        | 필수 |

### 3.2 Firestore 문서 구조

복사등록시 아래 두군데 저장되어야 함.

(1)복사단 멤버정보

```ts
server_groups/{sg}/members/{memberId}
{
  "member_id": "<auto_id>",
  "parent_uid": "회원 uid",   // /users 컬렉션의 uid
  "name_kor": "김지안",
  "baptismal_name": "클라라",
  "grade": "E3",
  "active": false,
  "created_at": "<Timestamp>",
  "updated_at": "<Timestamp>"
}
```

- memberId는 auto-id
- 생성 직후 active:false 이며 Planner 승인 필요

(2)가입User의 복사단 별 권한(Role)정보 (주의:등록한 복사정보는 저장하지 않음)

```ts
memberships/{uid}_{server_group_id}
{
  uid: xxx
  server_group_id: SG00001
  role: "server"|"planner"
  active: false
  created_at: "<Timestamp>",
  updated_at: "<Timestamp>"
}
```

---

## 4. 승인 절차 (Planner)

| 동작              | 결과                 |
| --------------- | ------------------ |
| 승인(active=true) | 복사가 일정/설문 기능 사용 가능 |
| 거절/삭제           | member 문서 삭제       |

- 승인 주체: 해당 server_group의 Planner
- UI 위치: ServerList.tsx
- 리스트는 Firestore onSnapshot 기반 실시간 갱신.

---

## 5. 로그인(SignIn) 및 권한(RoleGuard)

### 5.1 역할(Role)

- Planner
- Server(복사)

### 5.2 Server 권한 판정 규칙 (개정 핵심)

- 기존의 “uid = memberId” 방식 폐기
  → 아래 조건으로 서버 권한 판정:

```ts
  선택된 server_group 안에서
    parent_uid == currentUser.uid
    AND active == true
  인 member 문서가 1개 이상 존재하면 server 권한 부여
```

- 즉, 회원(user.uid)은 단순 계정이고,
  복사(memberId)는 별도 엔티티
- Server 권한은 “회원이 보유한 복사 중 승인된 것이 있는가” 여부로 판단.

---

## 6. ServerMain UI / 초기 구조 (개정 핵심)

ServerMain은 다음 구조를 항상 유지한다:

### 6.1 화면 레이아웃

1) [성당/복사단 선택 드롭다운]   ← 항상 최상단
2) [나의 복사 버튼 목록]
   예: [지안(클라라)] [민준(요셉)] [+복사 추가]
   - 버튼은 check/uncheck 가능 (디폴트는 모두 checked, 필터링 기능)
   - active:false 는 “승인대기” 표시/태그
   - 복사명 별로 다른 색깔/강조테두리로 구분하고, 아래 달력의 일정에도 복사명과 같은 색으로 구분해 줌
   - 복사명 unchecked 시 : 하단 달력에 복사별 색깔은 그대로 두고, 강조테두리 표시만 없애는 방식
3) [달력(Multi-member Calendar)]
   - 선택된 복사단의 mass_events 표시
   - 내가 등록한 모든 복사의 일정을 구분 표시(색과 강조테두리)
   - 복사 버튼으로 필터링 가능 (특정 복사만 강조해서 보기)

### 6.2 복사 추가(add-member)

AddMember 페이지
 ├─ 사용자가 성당 선택 (PARISHES)
 ├─ 해당 성당의 복사단 server_groups 로딩
 ├─ 복사 정보 입력(이름/세례명/학년)
 ├─ server_groups/{sg}/members 에 복사의 정보 생성
 |    - active: false
 └─ memberships/{uid}_{serverGroupId} 문서 생성 또는 업데이트
      - role: "server"
      - active: false

- 사용자가 복사 추가(AddMember)를 완료하면,
  session.currentServerGroupId = selectedGroup 으로 갱신하여
  ServerMain은 해당 복사단을 기준으로 렌더링한다.

---

## 7. Multi-member Calendar 필터링 규칙

- 예시:

```ts
내 복사 = [
  { memberId: "m1", checked: true },
  { memberId: "m2", checked: false }
]
```

- 렌더링 알고리즘:

1. 선택된 server_group의 mass_events 읽기
2. event.member_ids 와 내 memberIds 를 비교
3. checked=true 인 복사만 달력 이벤트 강조/표시
4. 여러 명 포함 가능

---

## 8. Pending 상태(/pending) (->폐지)

### 8.1 변경된 Pending 개념

본 시스템에서 “Pending” 상태 페이지 및 URL(/pending)은 완전히 제거한다.

- 회원(user)은 가입 후 즉시 기본 접근 허용.
- 복사(member)만 승인(active) 여부를 가진다.
- Server Main 페이지의 미승인(active:false) 복사는 [복사명 + ' 승인대기중']로 표시
- 기능제한:
  승인된 복사가 하나도 없는 경우에는 servermain 페이지에서 아무 정보도 표시해주면 안됨.
  [+복사추가] 버튼과 기본 레이아웃만 표시함.

---

## 9. RoleGuard 세부 동작 (개정)

개정된 규칙

| 조건                               | 이동 경로                              |
| -------------------------------- | ---------------------------------- |
| 로그인 안 됨                          | `/login`                           |
| 선택된 server_group 에 Planner 권한 있음 | Dashboard                          |
| 선택된 server_group 에 Server 권한 있음  | ServerMain                         |
| Server 권한 없음(=승인된 복사 없음)         | ServerMain (단, 모든 복사는 승인대기 상태로 표시) |
| 그 외                              | `/forbidden`                       |

- groupRolesLoaded 유지

기존 session.ts 의 Firestore 초기 로딩 로직은 동일하되,
“서버 권한” 판정만 새로운 기준을 적용한다.

---

## 10. Firestore Data Model 요약

```ts
users/{uid}                               # 회원 정보
server_groups/{sg}/members/{memberId}     # 복사 정보
```

- users = 회원 계정
- members = 복사(자녀/본인)
- 회원 1명 → member 여러 개
- memberId는 uid와 다른 auto-id

---

## 11. UX 요약

- 회원가입 → 매우 단순(이름/이메일/비번)
- 로그인 후 → 복사단 선택
- [+복사추가] 로 자녀 여러 명 등록 가능,
  복사추가 클릭시 추가 페이지(/add-member)로 이동해서 등록신청 후 server-main으로 돌아옴
- 복사 active:true 이후 기능 사용 가능
- 달력은 multi-member view + 필터링

---
