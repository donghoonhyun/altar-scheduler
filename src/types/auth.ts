// src/types/auth.ts

// ✅ 복사단 단위 권한 (Planner/Server)
export type Role = "planner" | "server";

export interface Membership {
  uid: string;
  server_group_id: string;   // SG00001 같은 복사단 ID
  parish_code: string;       // 소속 본당 코드
  role: Role;                // "planner" | "server"
  created_at: string;        // ISO Timestamp
  updated_at: string;        // ISO Timestamp
}
