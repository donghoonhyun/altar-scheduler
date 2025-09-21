# Firestore Collections Structure (Altar Scheduler)

## 1. 권한 SSOT

system_roles/{uid}                  # 전역 Admin
parish_roles/{uid}_{parish_code}    # 본당 단위 Manager
memberships/{uid}_{server_group_id} # 복사단 단위 Planner/Server (전역 SSOT)

## 2. 복사단 (server_groups)

server_groups/{server_group_id}
  parish_code: string        # src/config/parishes.ts 카탈로그 참조
  name: string
  timezone: string
  locale: string
  active: boolean            # true/false (사용/미사용)
  created_at: timestamp
  updated_at: timestamp

### 2.1 Members
  
  server_groups/{sg}/members/{member_id}  
    uid: string                # 연결된 user_id (optional)
    name_kor: string
    baptismal_name: string
    grade: string              # E1~E6 / M1~M3 / H1~H3
    phone_guardian?: string
    phone_student?: string
    notes?: string
    created_at: timestamp
    updated_at: timestamp

### 2.2 Memberships (Cache)

  server_groups/{sg}/memberships/{uid}    # 선택적 캐시/미러. UI 표시/조회 최적화용.
  
### 2.3 Mass Events

  server_groups/{sg}/mass_events/{event_id}  
    date: timestamp
    title: string
    status: string             # MASS-NOTCONFIRMED / MASS-CONFIRMED / SURVEY-CONFIRMED / FINAL-CONFIRMED
    required_servers: int
    created_at: timestamp
    updated_at: timestamp

### 2.4 Availability Surveys

  server_groups/{sg}/availability_surveys/{month_id}/responses/{member_id}
    responses: {
    [event_id: string]: "AVAILABLE" | "UNAVAILABLE"
    }
    created_at: timestamp
    updated_at: timestamp

### 2.5 Schedules

  schedules/{month_id}
    assignments: object        # 복사 배정 결과

### 2.6 Replacement Requests (<- 일단 구현안함)

  server_groups/{sg}/replacement_requests/{req_id}  
    requester_uid: string
    target_event_id: string
    status: string             # pending/approved/rejected
    created_at: timestamp
    updated_at: timestamp

### 2.7 Notifications

  server_groups/{sg}/notifications/{notif_id}
    type: string
    message: string
    created_at: timestamp

## 3. 사용자 계정 프로필 (권한 SSOT 아님)

users/{uid}
  uid: string
  email: string
  display_name: string
  managerParishes?: string[]   # 캐시용
  created_at: timestamp
  updated_at: timestamp
