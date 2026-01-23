# PRD 3.4.2 Firestore Collections Structure (Altar Scheduler)

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
 └── notifications/{notifId}
      ├── message: string
      ├── created_at: Timestamp
      └── type?: string
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
  - seq number : counters컬렉션의 server_groups 카운터로 생성됨

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
  created_at: timestamp
  updated_at: timestamp
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

## 3. 사용자 계정 프로필 (권한 SSOT 아님)

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
