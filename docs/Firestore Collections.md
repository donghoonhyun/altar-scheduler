# Firestore Collections Structure (Altar Scheduler)

## 권한 SSOT

system_roles/{uid}                  # 전역 Admin
parish_roles/{uid}_{parish_code}    # 본당 단위 Manager
memberships/{uid}_{server_group_id} # 복사단 단위 Planner/Server (전역 SSOT)

## 복사단 (최상위 운영 단위)

server_groups/{server_group_id}
  parish_code: string        # src/config/parishes.ts 카탈로그 참조
  name: string
  timezone: string
  locale: string
  active: boolean
  created_at: timestamp
  updated_at: timestamp

  members/{member_id}
    uid: string
    name_kor: string
    baptismal_name: string
    grade: string              # E1~E6 / M1~M3 / H1~H3
    phone_guardian?: string
    phone_student?: string
    notes?: string
    created_at: timestamp
    updated_at: timestamp

  memberships/{uid}            # (선택적 캐시/미러, UI 편의용)

  mass_events/{event_id}
    date: timestamp
    title: string
    status: string             # MASS-NOTCONFIRMED / MASS-CONFIRMED / SURVEY-CONFIRMED / FINAL-CONFIRMED
    required_servers: int
    created_at: timestamp
    updated_at: timestamp

  availability_surveys/{month_id}/responses/{member_id}
    availability: string       # PREFERRED / AVAILABLE / UNAVAILABLE
    created_at: timestamp
    updated_at: timestamp

  schedules/{month_id}
    assignments: object        # 복사 배정 결과

  replacement_requests/{req_id}
    requester_uid: string
    target_event_id: string
    status: string             # pending/approved/rejected
    created_at: timestamp
    updated_at: timestamp

  notifications/{notif_id}
    type: string
    message: string
    created_at: timestamp

## 사용자 계정 프로필 (권한 SSOT 아님)

users/{uid}
  uid: string
  email: string
  display_name: string
  managerParishes?: string[]   # 캐시용
  created_at: timestamp
  updated_at: timestamp
