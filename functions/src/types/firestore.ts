// functions/src/types/firestore.ts
// Cloud Function 타입 정의

// ✅ 복사단 생성 요청
export interface CreateServerGroupRequest {
  parishCode: string;   // 본당 코드
  name: string;         // 복사단 이름
  timezone: string;     // ex) "Asia/Seoul"
  locale: string;       // ex) "ko-KR"
  active: boolean;      // 사용 여부
}

// ✅ 복사단 생성 응답
export interface CreateServerGroupResponse {
  serverGroupId: string; // 새로 발급된 복사단 ID (SG00001 등)
}
