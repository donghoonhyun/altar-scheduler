# PRD 3.4.2 Firestore Collections Structure (Altar Scheduler)

```lua
server_groups/{serverGroupId}
 ├── members/{memberId}
 ├── mass_events/{eventId}
 │    ├── title: string
 │    ├── date: Timestamp
 │    ├── required_servers: number
 │    ├── member_ids: string[]
 │    ├── created_at: Timestamp
 │    ├── updated_at: Timestamp
 │    └── (status 제거됨 ❌)
 ├── month_status/{yyyymm}
 │    ├── status: string                     // ex: MASS-NOTCONFIRMED / MASS-CONFIRMED / SURVEY-CONFIRMED / FINAL-CONFIRMED
 │    ├── updated_by: string                 // email or uid
 │    ├── updated_at: Timestamp
 │    ├── note?: string
 │    └── lock?: boolean                     // autoAssign 후 편집 잠금
 ├── availability_surveys/{yyyymm}/responses/{memberId}
 │    ├── responses: Record<eventId, "AVAILABLE"|"UNAVAILABLE">
 │    ├── created_at: Timestamp
 │    └── updated_at: Timestamp
 └── notifications/{notifId}
```

## 1. 권한 SSOT

```typescript
system_roles/{uid}                  // 전역 Admin
parish_roles/{uid}_{parish_code}    // 본당 단위 Manager
memberships/{uid}_{server_group_id} // 복사단 단위 Planner/Server (전역 SSOT)
```

## 2. 복사단 (server_groups)

```lua
server_groups/{server_group_id}
  parish_code: string          // src/config/parishes.ts 카탈로그 참조
  name: string
  timezone: string             // 예: "Asia/Seoul", "Pacific/Saipan"
  locale: string               // 다국어 확장 대비
  active: boolean              // true/false(사용/미사용)
  created_at: timestamp
  updated_at: timestamp
```

### 2.1 Members

```lua  
server_groups/{sg}/members/{member_id}  
  uid: string                # 연결된 Firebase Auth UID
  email : string
  name_kor: string
  baptismal_name: string
  grade: string              # E1~E6 / M1~M3 / H1~H3
  phone_guardian?: string
  phone_student?: string
  notes?: string
  active : boolean           # 기본 false → 관리자 승인 필요
  created_at: timestamp
  updated_at: timestamp
```

### 2.2 Memberships (Cache용 선택적)

```lua
server_groups/{sg}/memberships/{uid}
  role: "planner" | "server"
  linked_uid: string
  active: boolean
```

### 2.3 month_status (server_group별 월별 상태status 관리)

```lua
server_groups/{sg}/month_status/{yyyymm}
  status: string               // MASS-NOTCONFIRMED / MASS-CONFIRMED / SURVEY-CONFIRMED / FINAL-CONFIRMED
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
  date: timestamp               // 현지 자정 기준 (Timezone 정책 준수)
  title: string                 // 예: "주일 10시 미사"
  required_servers: number      // 필요 복사 인원수
  member_ids: string[]          // 배정된 복사 ID 목록
  created_at: timestamp
  updated_at: timestamp
```

### 2.5 Availability Surveys (가용성 설문 응답)

```lua
server_groups/{sg}/availability_surveys/{yyyymm}/responses/{member_id}
  responses: {
    [event_id: string]: "AVAILABLE" | "UNAVAILABLE"
  }
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
  display_name: string
  managerParishes?: string[]   # 캐시용
  created_at: timestamp
  updated_at: timestamp
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
