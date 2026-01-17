import type { MassStatus } from './firestore';

// Firestore용 (DB에서 읽고/저장할 때)
export interface MassEventDB {
  id: string;
  date: string;
  title: string;
  required_servers: number;
}

export interface MassEvent {
  id: string;
  title: string;
  date: string;
  required_servers: number; // ✅ 추가
  // ...기타 필드
}

// 달력 표시용
export interface MassEventCalendar {
  id: string;
  title: string;
  event_date: string; // Firestore 저장용 "YYYYMMDD"
  required_servers: number;
  member_ids?: string[];
  main_member_id?: string; // ✅ 추가: 주복사 ID
  servers?: string[];
  created_at?: Date;
  updated_at?: Date;

  /** 🔹 UI 표시용 YYYY-MM-DD 포맷 (optional) */
  formatted_date?: string;
}
