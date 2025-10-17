# 2.1.1 PRD-2.1.1-SignUp SignIn (사용자 가입 및 승인 절차)

## 2.1.1.1 회원가입 (SignUp)

- 신규 사용자는 `/signup` 화면에서 이메일/비밀번호를 이용해 회원가입한다.
- 입력 항목: 이름(한글), 세례명, 학년(초/중/고), 성당 선택, 복사단 선택.
- 가입 시 Firestore 문서 생성:
  - `users/{uid}`
  - `server_groups/{serverGroupId}/members/{uid}`
- 신규 회원의 `members.active = false` 가 기본값이며, 관리자의 승인 전까지 활동 불가.

### ① 승인 대기 상태 (Pending)

- `active:false` 회원은 로그인은 가능하지만 접근이 제한된다.
- `RoleGuard`가 Firestore `members.active=false`를 감지하면 `/pending` 으로 리다이렉트한다.
- `/pending` 페이지에는 “승인 대기 중” 안내와 로그아웃 버튼만 표시된다.

### ② RoleGuard 동작 규칙

| 조건 | 이동 경로 |
|------|-----------|
| 로그인 안 됨 | `/login` |
| `members.active = false` | `/pending` |
| `members` 문서 없음 | `/forbidden` |
| `members.active = true` | 접근 허용 |

- Firestore `collectionGroup("members")` 쿼리로 현재 uid 멤버 상태를 조회한다.
- `isPending =true` 감지 시 `/pending` 자동 리다이렉트.

### ③ AppRoutes 구조 변경

- 기존의 `Object.keys(session.groupRoles).length > 0` 조건을 제거하여  
  `RoleGuard` 및 `/pending` 경로가 항상 렌더되도록 변경.
- 로그인 후 기본 라우트:
  . `/login`, `/signup`, `/pending`, `/forbidden` → 공통 라우트
  . `/server-groups/*` → `RoleGuard` 보호 적용
  . `active:false` → `/pending`, `active:true` → Dashboard 진입

### ④ Firestore 필드 보완

```lua
| Collection | Document ID | 주요 필드 | 비고 |
|-------------|--------------|------------|------|
| `server_groups/{sg}/members/{uid}` | UID | `active:boolean`, `grade`, `baptismal_name` 등 | `active:false` 기본값 |
| `users/{uid}` | UID | `display_name`, `email`, `created_at` | 인증 계정 정보 |
| `server_groups` | SG ID | `parish_code`, `name`, `timezone` 등 | 복사단 단위 정보 |
```

### ⑤ 승인 후 처리

- 승인 즉시 사용자는 default로 role=server 를 가지며, `/pending` → `ServerMain.tsx`(복사 메인페이지) 로 자동 전환된다.
- 플래너(관리자)는 UI에서 `ServerList.tsx` 에서 `active:false` 회원 목록을 보고 “승인( active:true )” 또는 “삭제(거절)” 처리.

---

## 2.1.1.2 로그인과 권한처리 (LogIn & Auth. )

### RoleGuard & Session Authorization Flow

- 개요: 로그인 직후 `session.groupRoles` 초기화 이전에 `RoleGuard` 또는 `AppRoutes`가 먼저 렌더되어  
  사용자가 `/forbidden` 페이지로 잘못 이동하는 현상이 반복적으로 발생하였다.  
  이를 완화하기 위해 인증 흐름과 세션 로딩 절차를 다음과 같이 개선해야함.

- 개선 내용:

(1) 세션 상태 확장: `session.ts` 에 `groupRolesLoaded` 필드를 추가.

  ```ts
  groupRolesLoaded: boolean  // memberships / members 데이터가 Firestore로부터 완전히 로드된 상태 표시
  ```

- false → 초기 상태, Firestore 로드 중
- true → roles 정보 로드 완료 후
- 로그인 실패, 오류 발생 시에도 true 로 강제 전환하여 무한 로딩 방지

(2) RoleGuard 로직 개선.

| 구분                              | 동작                             |
| ------------------------------- | ------------------------------ |
| `session.loading` or `!checked` | “세션 동기화 중...” 표시               |
| Firestore members.active=false  | `/pending` 이동                  |
| groupRolesLoaded=false          | “세션 동기화 중...” 표시 (redirect 금지) |
| role 불일치                        | `/forbidden` 이동                |
| 조건 통과                           | children 렌더                    |

  → 즉, Firestore / session 로드 완료 전에는 절대 redirect를 실행하지 않음.

(3) AppRoutes 로직 개선

ServerMainWrapper 내부에서도 동일하게 !groupRolesLoaded 상태에서는
“세션 동기화 중...” 표시만 출력하도록 변경.
planner / server 모두 최초 로그인 시 Forbidden 없이 정상 페이지로 진입하도록 조정.

(4) session.ts 내부 로직

| 단계             | 처리 내용                                                         |
| -------------- | ------------------------------------------------------------- |
| 로그인            | `memberships`(planner) + `members(active=true)`(server) 동시 로드 |
| Firestore 완료 후 | `groupRoles`, `serverGroups`, `groupRolesLoaded=true`         |
| 오류 발생 시        | 안전하게 `groupRolesLoaded=true` 로 마무리                            |
| 로그아웃           | 초기 세션으로 복귀                                                    |

## 아직 개발환경에서는 문제가 완전히 조치된 것이 아니므로 추후 추가 개선해야함
