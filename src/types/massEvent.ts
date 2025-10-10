import type { MassStatus } from './firestore';

// Firestore용 (DB에서 읽고/저장할 때)
export interface MassEventDB {
  id: string;
  date: string;
  title: string;
  required_servers: number;
  status?: MassStatus;
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
  date: string | { _seconds: number; _nanoseconds: number };
  required_servers: number;
  servers?: string[];
  status?: MassStatus;
}
