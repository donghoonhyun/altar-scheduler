// ===============================
// 🔹 Users (users/{uid})
// ===============================
export interface UserDoc {
  parish_id?: string; // 소속 본당 ID
  name?: string; // 사용자 이름
  role: "manager" | "server" | "admin";
  created_at?: string;
  updated_at?: string;
}

// ===============================
// 🔹 Parishes (parishes/{parishId})
// ===============================
export interface ParishDoc {
  name: string; // 본당 이름
  time_zone: string; // "Asia/Seoul" 등
  created_at?: string;
  updated_at?: string;
}

// ===============================
// 🔹 Managers (managers/{uid})
// ===============================
export interface ManagerDoc {
  parish_id: string;
  name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

// ===============================
// 🔹 Servers (parishes/{parishId}/servers/{serverId})
// ===============================
export interface ServerDoc {
  name_kor: string; // 이름 (한글)
  baptismal_name: string; // 세례명
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
    | "H3"; // 학년
  phone_guardian?: string;
  phone_student?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ===============================
// 🔹 Mass Events (parishes/{parishId}/mass_events/{eventId})
// ===============================
export type MassStatus =
  | "MASS-NOTCONFIRMED"
  | "MASS-CONFIRMED"
  | "SURVEY-CONFIRMED"
  | "FINAL-CONFIRMED";

export interface MassEventDoc {
  title: string; // 미사명
  date: string; // YYYY-MM-DD
  month: number; // 달력 필터용
  requiredServers: number; // 필요 인원
  servers: string[]; // 배정된 복사 ID 또는 이름
  status: MassStatus;
}

// ===============================
// 🔹 Availability (parishes/{parishId}/availability/{serverId})
// ===============================
export type AvailabilityStatus = "PREFERRED" | "AVAILABLE" | "UNAVAILABLE";

export interface AvailabilityDoc {
  availability: Record<string, AvailabilityStatus>; // key = date (YYYY-MM-DD)
  server_name: string; // 복사 이름
  submitted: boolean; // 제출 여부
}
