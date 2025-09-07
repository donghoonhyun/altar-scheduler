// src/types/auth.ts

// 전역 관리자
export interface SystemRole {
  uid: string;
}

// 본당 단위 매니저
export interface ParishRole {
  uid: string;
  parish_code: string;
}

// 복사단 단위 권한 (Planner/Server)
export interface Membership {
  uid: string;
  server_group_id: string;
  role: "planner" | "server";
}
