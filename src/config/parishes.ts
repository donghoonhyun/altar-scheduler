// src/config/parishes.ts
export interface Parish {
  code: string;
  name_kor: string;
  diocese: string;
  name_eng?: string;
}

export const PARISHES: Parish[] = [
  { code: "DAEGU-BEOMEO", name_kor: "대구 범어성당", diocese: "대구교구", name_eng: "Beomeo Cathedral" },
  { code: "SUWON-SINBONG", name_kor: "수지 신봉성당", diocese: "수원교구", name_eng: "Sinbong Cathedral" },
  // ... 확장
];

// ✅ 빠른 검색을 위한 맵
export const PARISH_MAP: Record<string, Parish> = Object.fromEntries(
  PARISHES.map((p) => [p.code, p])
);
