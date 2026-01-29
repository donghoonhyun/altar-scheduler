import type { Timestamp } from 'firebase/firestore';

// ===============================
// 🔹 Users (users/{uid})
// ===============================
export interface UserDoc {
  uid: string;
  email: string;
  user_name: string;
  baptismal_name?: string;
  managerParishes?: string[];
  role?: 'manager' | 'server' | 'admin';
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

// ===============================
// 🔹 Server Groups (server_groups/{serverGroupId})
// ===============================
export interface ServerGroupDoc {
  id: string;
  parish_code: string;
  name: string;
  active: boolean;
  sms_reminder_template?: string;
  sms_service_active?: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Members (server_groups/{sg}/members/{memberId})
// ===============================
export interface MemberDoc {
  id: string;
  uid?: string;
  parent_uid?: string;
  guardian_name?: string;
  name_kor: string;
  baptismal_name: string;
  grade: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'M1' | 'M2' | 'M3' | 'H1' | 'H2' | 'H3';
  phone_guardian?: string;
  phone_student?: string;
  start_year?: string; // e.g. "2023"
  notes?: string;
  active: boolean;
  request_confirmed?: boolean;
  is_moved?: boolean; // ✅ [New] 타 복사단 이동 여부
  moved_at?: Timestamp;
  moved_by_uid?: string;
  moved_by_name?: string;
  moved_to_sg_id?: string;
  moved_from_sg_id?: string; // ✅ [New] 어디서 왔는지
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Memberships (memberships/{uid}_{serverGroupId})
// ===============================
export interface MembershipDoc {
  id: string;
  uid: string;
  server_group_id: string;
  parish_code: string;
  role: string | string[]; // 'admin' | 'planner' | 'server' or array containing them
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Mass Events (server_groups/{sg}/mass_events/{eventId})
// ===============================
export type MassStatus =
  | 'MASS-NOTCONFIRMED'
  | 'MASS-CONFIRMED'
  | 'SURVEY-CONFIRMED'
  | 'FINAL-CONFIRMED';

export interface MassEventDoc {
  id: string;
  title: string;
  event_date: string;
  required_servers: number;
  status: MassStatus;
  member_ids?: string[];
  main_member_id?: string;
  history?: ChangeLog[];
  notifications?: NotificationDoc[]; // Existing notifications field
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChangeLog {
  id: string;
  type: 'update' | 'create';
  timestamp: Timestamp;
  editor_uid?: string;
  editor_name?: string;
  changes: string[];
}

// ===============================
// 🔹 Availability Surveys
// ===============================
export type AvailabilityResponse = 'AVAILABLE' | 'UNAVAILABLE';

export interface AvailabilitySurveyResponseDoc {
  id: string;
  responses: Record<string, AvailabilityResponse>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Schedules
// ===============================
export interface ScheduleDoc {
  id: string;
  assignments: Record<string, string[]>;
}

// ===============================
// 🔹 Replacement Requests
// ===============================
export type ReplacementStatus = 'pending' | 'approved' | 'rejected';

export interface ReplacementRequestDoc {
  id: string;
  requester_uid: string;
  target_event_id: string;
  status: ReplacementStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ===============================
// 🔹 Notifications
// ===============================
export interface NotificationDoc {
  id: string;
  type: string;
  message: string;
  created_at: Timestamp;
}

// ===============================
// 🌱 시드 / Import용 타입
// ===============================
export interface MassEventSeed {
  id: string; // ME000001
  server_group_id: string;
  title: string;
  date: string; // 'YYYY-MM-DDT00:00:00'
  required_servers: number;
  status: MassStatus;
  member_ids?: string[];
  names?: string[];
}

export interface CreateServerGroupRequest {
  parishCode: string;
  name: string;
  active: boolean;
}

export interface CreateServerGroupResponse {
  serverGroupId: string;
}

export interface AvailabilityDoc {
  member_id: string;
  mass_id: string;
  available: boolean;
}
