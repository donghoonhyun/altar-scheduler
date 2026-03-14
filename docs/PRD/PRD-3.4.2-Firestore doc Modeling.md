# PRD 3.4.2 Firestore Collections Structure (Altar Scheduler)

## ⚠️ 컬렉션 경로 변경 이력 (2026-02-23)

|기존 경로|변경된 경로|
|---|---|
|`app_altar/v1/`|`app_datas/ordo-altar/`|
|`users_verbum/{uid}/saved_verses`|`app_datas/ordo-verbum/users/{uid}/saved_verses`|
|`daily_verses/{verseId}`|`ordo_contents/daily_contents/daily_verses/{verseId}`|
|`dashboard_news/{newsId}`|`ordo_contents/dashboard_news/items/{newsId}`|

경로 상수 파일:

- altar-scheduler: [src/lib/collections.ts](../../src/lib/collections.ts) (`COLLECTIONS` 객체)
- altar-scheduler Functions: [functions/src/firestorePaths.ts](../../functions/src/firestorePaths.ts) (`APP_ROOT`, `paths`)
- Ordo/Verbum: `src/lib/constants/collections.ts` (`COLLECTIONS`, `PATHS`)

---

- 🎯Firestore Collections Overview

```lua
users/{uid}     // 회원가입 authentication uid
 ├── uid: string,
 ├── email: string,
 ├── user_name: string,
 ├── baptismal_name: string,
 ├── user_category: "Father" | "Sister" | "Layman", // 신자구분
 └── created_at, updated_at

memberships/{uid}_{server_group_id}
 ├── active: boolean, // 유효성 여부
 ├── uid: string,
 ├── server_group_id: string,
 ├── role: "planner" | "server",
 └── created_at, updated_at

server_groups/{serverGroupId} (Document)
 ├── name: string
 ├── timezone: string              // ex: "Asia/Seoul"
 ├── created_at, updated_at
 │
 ├── members/{memberId} (Document)  // 복사명단, docid=autogen.
 │    ├── active: boolean     // 활동 상태 (true: 활동중, false: 비활동 or 승인대기)
 │    ├── parent_id: string         // 등록신청한 User의 uid (주로 부모 또는 본인)
 │    ├── name_kor: string
 │    ├── baptismal_name: string
 │    ├── email: string
 │    ├── grade: string (E1~H3) 
 │    ├── request_confirmed: boolean // 승인 확정 여부 (true: 확정, false: 승인대기)
 │    │    // [State Definition]
 │    │    // 1. Pending (승인대기) : active=false && request_confirmed=false
 │    │    // 2. Active (활동중)    : active=true  && request_confirmed=true
 │    │    // 3. Inactive (비활동)  : active=false && request_confirmed=true
 │    └── created_at, updated_at
 │
 ├── mass_events/{eventId} (Document) // event_id는 auto-generated
 │    ├── title: string
 │    ├── event_date: string        // ex: "20251024" (현지 기준 날짜)
 │    ├── required_servers: number
 │    ├── member_ids: string[]     // 배정된 복사 UID 목록 
 │    └── created_at, updated_at
 │
 ├── month_status/{yyyymm} (Document)
 │    ├── status: string           // MASS-NOTCONFIRMED / MASS-CONFIRMED / SURVEY-CONFIRMED / FINAL-CONFIRMED
 │    ├── updated_by: string
 │    ├── updated_at: Timestamp
 │    ├── note?: string
 │    └── lock?: boolean
 │
 ├── availability_surveys/{yyyymm}/responses/{memberId}
 │    ├── responses: Record<eventId, false> | null
 │    ├── dates: Record<eventId, string(yyyymmdd)> | null 
 │    └── created_at, updated_at
 │
 ├── ai_insights/{yyyymm}
 │    ├── content: string
 │    ├── model: string
 │    └── history/ (Subcollection)
 │
 └── notifications/{notifId}
      ├── message: string
      ├── created_at: Timestamp
      └── type?: string

system_settings/{settingId}
   └── (e.g., ai_config)

```

## 1. 권한 SSOT

### 1.1 memberships

```ts
  memberships/{uid}_{server_group_id} 
```

- 정의 : user가 속해 있는 복사단 단위 역할정의(Planner/Server, 전역 SSOT)
- 용도 : 복사(또는 부모)가 회원 가입 이후 복사등록 시, 회원uid + 복사단id로 저장되고,
        조회는 화면에서 복사단을 선택하는 콤보 등에서 주로 사용함
- 주의 : memberships의 uid는 가입 때 uid이고 server의 member_id 아님.

## 2. 복사단 (server_groups)

```lua
server_groups/{server_group_id} // auto-generated 아님.rule based
  active: boolean              // true/false(사용/미사용)
  parish_code: string          // src/config/parishes.ts 카탈로그 참조
  name: string    
  timezone: string             // 'Asia/Seoul'
  locale: string               // 'ko-KR'
  created_at: timestamp
  updated_at: timestamp
```

- server_group_id 채번 규칙
  - 'SG' + 5자리 number seq number : ex: SG00001
  - seq number : `/settings/counters` 문서의 `seq_server_groups` 필드 (Ordo 글로벌 카운터)

### 2.1 Members

```lua  
server_groups/{sg}/members/{member_id}  
  active : boolean           # 기본 false → 관리자 승인 필요
  member_id: string          # 복사(server)의 UID
  parent_uid: string         # 가입 회원정보(users/{uid})의 UID (FK)
  email : string
  name_kor: string
  baptismal_name: string
  grade: string              # E1~E6 / M1~M3 / H1~H3
  phone_guardian?: string
  phone_student?: string  
  notes?: string
  created_at: timestamp
  updated_at: timestamp
  history_logs: HistoryLog[] # 변경 이력
    [{
       date: timestamp
       action: string   # "정보 수정", "삭제", "복구" 등
       changes: string[] 
       editor: string
    }]
```

### 2.1.1 Deleted Members (Soft Delete)

```lua
server_groups/{sg}/del_members/{member_id}
  (members 구조와 동일)
  deleted_at: timestamp
  deleted_by_uid: string
  deleted_by_name: string
  active: false
```

### 2.2 Mass_Presets

```lua
server_groups/{sg}/mass_presets/
```

```json 예시
{
  "weekdays": {
    "0": [ { "title": "주일 10시 미사", "required_servers": 3 } ],
    "1": [],
    "2": [],
    "3": [ { "title": "평일 수 미사", "required_servers": 2 } ],
    "4": [],
    "5": [ { "title": "평일 금 미사", "required_servers": 1 } ],
    "6": []
  },
  "updated_at": "Timestamp"
}
```

### 2.3 month_status (server_group별 월별 상태status 관리)

```lua
server_groups/{sg}/month_status/{yyyymm}
  status: string               // "MASS-NOTCONFIRMED" / "MASS-CONFIRMED" / "SURVEY-CONFIRMED" / "FINAL-CONFIRMED"
  updated_by: string           // 마지막 수정자 email or uid
  updated_at: timestamp        // Firestore serverTimestamp()
  note?: string                // 상태 변경 사유 등
  lock?: boolean               // 자동배정 이후 편집 잠금 여부
```

```lua
| 이전 상태             | 다음 상태            | 트리거                    | 설명       |
| ----------------- | ---------------- | ---------------------- | -------- |
| MASS-NOTCONFIRMED | MASS-CONFIRMED   | “미사 일정 확정” 버튼          | 설문 준비 상태 |
| MASS-CONFIRMED    | SURVEY-CONFIRMED | “설문 종료” 버튼             | 설문 마감    |
| SURVEY-CONFIRMED  | FINAL-CONFIRMED  | “최종 확정” (AutoAssign 후) | 완전 확정    |
| FINAL-CONFIRMED   | -                | -                      | 변경 불가    |
```

### 2.4 Mass Events

```lua
server_groups/{sg}/mass_events/{event_id}
  event_date: timestamp          // "YYYYMMDD" (KST 기준)
  title: string                 // 예: "주일 10시 미사"
  required_servers: number      // 필요 복사 인원수
  member_ids: string[]          // 배정된 복사 ID 목록
  main_member_id: string        // 주복사 ID (member_ids 중 한 명)
  not_available_members: string[] // 설문에 따른 참석 불가능한 복사들 ID목록
  add_type: string              // 생성 방식: 'preset' (Preset초기화) | 'manual' (Drawer 직접 추가)
  created_at: timestamp
  updated_at: timestamp

- event_id 채번 규칙: Firestore auto-ID (addDoc / doc(collection(...)) 사용)
  - ~~ME000001 형태 시퀀스 채번 폐지~~
  - ~~counters/mass_events 문서 폐지~~
```
  
### 2.5 Availability Surveys (가용성 설문 & 응답)

```lua
server_groups/{sg}/availability_surveys/{yyyymm}
  member_ids: string[]          // 설문 응답대상자 ID 목록
  responses: {
    [member_id: string]: {
      unavailable: string[] // 설문 응답자별 미참석 event_id 목록
    }
  }
  status: string               // "OPEN" / "CLOSED"
  start_date: timestamp        // 설문 시작일
  end_date: timestamp          // 설문 종료일
  created_at: timestamp
  updated_at: timestamp
```

### 2.6 Auto Assignment Logs (선택적)

- 자동배정 수행 시 감사 로그용으로 생성 가능 (Cloud Function 기록용)

```lua
server_groups/{sg}/auto_assign_logs/{yyyymm}
  executed_by: string           // uid or email
  executed_at: timestamp
  total_events: number
  assigned_members: string[]
  note?: string
```

### 2.8 Notifications

```lua
server_groups/{sg}/notifications/{notif_id}
  type: string
  message: string
  created_at: timestamp
```

## 3. 생태계 통합 RBAC (`user_app_roles`)

> 상세 설계: [PRD-3.4.5-UserAppRoles-RBAC.md](PRD-3.4.5-UserAppRoles-RBAC.md)

```lua
user_app_roles/{uid}                  // docId = Firebase Auth uid
  global_role?: 'superadmin'          // 생태계 전역 슈퍼어드민 여부 (없으면 일반 사용자)
  apps: {
    [appId: string]: {
      installed_at: Timestamp         // 앱 설치(등록) 일시
      last_accessed?: Timestamp       // 마지막 접근 일시 (선택)
    }
  }
  updated_at: Timestamp
```

- **appId 예시**: `ordo-altar`, `ordo-verbum`, `ordo-admin`
- `global_role` 필드는 Cloud Function(Admin SDK)으로만 쓰기 가능. 클라이언트 직접 쓰기 rules 차단.
- 기존 `users/{uid}/installed_apps/` 서브컬렉션을 대체 (마이그레이션 후 제거 예정)

---

## 3.1 사용자 계정 프로필 (권한 SSOT 아님)

```lua
users/{uid}
  uid: string
  email: string
  user_name: string
  baptismal_name: string
  user_category: "Father" | "Sister" | "Layman"   # UI 표시: 신부님 / 수녀님 / 평신도
  phone?: string
  managerParishes?: string[]   # 캐시용
  created_at: timestamp
  updated_at: timestamp
  fcm_tokens?: string[]        // FSA(FCM) 토큰 목록 (Multi-device support)
```

## 6. System Logs (Root Level)

### 6.1 SMS Logs

```lua
system_sms_logs/{logId}
  receiver: string       // 수신번호
  status: string         // success / failed
  message: string
  created_at: timestamp
```

### 6.2 System Notification Logs (App Push)

```lua
system_notification_logs/{logId}
  title: string
  body: string
  target_uids: string[]          // 수신 대상 User UIDs (Snapshot)
  target_device_count: number    // 실제 발송된 기기 토큰 수
  success_count: number
  failure_count: number
  status: string                 // "success"
  created_at: timestamp
  data?: object                  // 추가 메타데이터
```

## 7. System Settings & AI

### 7.1 System Settings (root level)

- 전역 시스템 설정 관리

```lua
system_settings/ai_config
  prompt_analyze_monthly_assignments: {
      template: string          // AI 프롬프트 템플릿
      updated_at: timestamp
  }
  // 향후 prompt_daily_briefing 등으로 확장 가능
```

### 7.2 AI Assignment Analysis (server_group level)

- 월별 배정 결과 분석 데이터

```lua
server_groups/{sg}/ai_insights/{yyyymm}
  content: string               // Markdown 형식의 분석 결과
  model: string                 // 사용된 모델명 (ex: "gemini-2.5-flash")
  total_count: number           // 분석 실행 횟수
  created_at: timestamp         // 마지막 분석 일시
  
  history/ (Subcollection)      // 분석 이력 (재분석 시 쌓임)
    {docId}: auto-generated
      content: string
      model: string
      created_at: timestamp
```

## 4. 클라이언트 연계 포인트 (UI기준)

```lua
| 기능 구역     | Firestore Path                                  | 읽기/쓰기 방식               | 비고          |
| --------- | ----------------------------------------------- | ---------------------- | ----------- |
| 달력 이벤트 표시 | `mass_events`                                   | onSnapshot (read-only) | 일정 표시       |
| 월 상태 표시   | `month_status/{yyyymm}`                         | onSnapshot + setDoc    | 월단위 상태 변경   |
| 설문 응답     | `availability_surveys/{yyyymm}/responses/{uid}` | setDoc({merge:true})   | 복사용         |
| 자동배정 결과   | `mass_events.member_ids`                        | updateDoc()            | CF 기반       |
| 상태 변경 버튼  | `month_status/{yyyymm}.status`                  | setDoc({merge:true})   | Planner만 가능 |
```

## 5. Security Rules 설계 요약

```lua
| 대상                     | Planner            | Server             | Function             |
| ---------------------- | ------------------ | ------------------ | -------------------- |
| `mass_events`          | read/write         | read               | read/write (trigger) |
| `month_status`         | read/write         | read               | read/write           |
| `availability_surveys` | read/write(본인 응답만) | read/write(본인 응답만) | read/write           |
| `auto_assign_logs`     | read               | read               | write                |
| `notifications`        | read               | read               | write                |
```
