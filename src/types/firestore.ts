import type { Timestamp } from "firebase/firestore";

// ===============================
// 🔹 Users (users/{uid})
// ===============================
export interface UserDoc {
  uid: string;
  email: string;
  display_name: string;
  managerParishes?: string[]; // 캐시용
  role?: "manager" | "server" | "admin"; // (구버전 호환)
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

// ===============================
// 🔹 Server Groups (server_groups/{serverGroupId})
// ===============================
export interface ServerGroupDoc {
  id: string;             // Firestore document id
  parish_code: string;    // 본당 코드
  name: string;           // 복사단 이름
  timezone: string;       // ex) "Asia/Seoul"
  locale: string;         // ex) "ko-KR"
  active: boolean;        // 사용 여부
  created_at: Timestamp;  // 생성 시각
  updated_at: Timestamp;  // 수정 시각
}

// ===============================
// 🔹 Members (server_groups/{sg}/members/{memberId})
// ===============================
export interface MemberDoc {
  id: string;
  uid?: string; // 연결된 user_id (optional)
  name_kor: string;
  baptismal_name: string;
  grade:
    | "E1"
    | "E2"
    | "E3"
    | "E4"
    | "E5"
    | "E6"
    | "M1"
    | "M2"
    | "M3"
    | "H1"
    | "H2"
    | "H3";
  phone_guardian?: string;
  phone_student?: string;
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Memberships (memberships/{uid}_{serverGroupId})
// ===============================
export interface MembershipDoc {
  id: string; // uid_serverGroupId
  uid: string;
  server_group_id: string;
  parish_code: string;
  role: "planner" | "server";
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Mass Events (server_groups/{sg}/mass_events/{eventId})
// ===============================
export type MassStatus =
  | "MASS-NOTCONFIRMED"
  | "MASS-CONFIRMED"
  | "SURVEY-CONFIRMED"
  | "FINAL-CONFIRMED";

export interface MassEventDoc {
  id: string;
  title: string;         // 미사명
  date: Timestamp;       // 미사 시간
  required_servers: number;
  status: MassStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Availability Surveys (server_groups/{sg}/availability_surveys/{monthId}/responses/{memberId})
// ===============================
export type AvailabilityResponse = "AVAILABLE" | "UNAVAILABLE";

export interface AvailabilitySurveyResponseDoc {
  id: string; // memberId
  responses: Record<string, AvailabilityResponse>; // eventId → 상태
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Schedules (server_groups/{sg}/schedules/{monthId})
// ===============================
export interface ScheduleDoc {
  id: string; // monthId
  assignments: Record<string, string[]>; // eventId → memberIds[]
}

// ===============================
// 🔹 Replacement Requests (server_groups/{sg}/replacement_requests/{reqId})
// ===============================
export type ReplacementStatus = "pending" | "approved" | "rejected";

export interface ReplacementRequestDoc {
  id: string;
  requester_uid: string;
  target_event_id: string;
  status: ReplacementStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Notifications (server_groups/{sg}/notifications/{notifId})
// ===============================
export interface NotificationDoc {
  id: string;
  type: string;
  message: string;
  created_at: Timestamp;
}
