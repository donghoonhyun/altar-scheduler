/**
 * Firestore Path Constants
 * ─────────────────────────────────────────────────────────────────────────────
 * Altar Scheduler의 모든 Firestore 경로를 이 파일에서 중앙 관리합니다.
 *
 * 🌳 컬렉션 구조:
 *   app_datas/ordo-altar/
 *    ├── memberships/{membershipId}
 *    ├── counters/{counterId}
 *    └── server_groups/{sgId}/
 *         ├── members/{memberId}
 *         ├── del_members/{memberId}
 *         ├── mass_events/{eventId}
 *         ├── role_requests/{requestId}
 *         ├── month_status/{monthId}
 *         ├── availability_surveys/{month}
 *         └── ai_insights/{month}
 */

// ── Root ─────────────────────────────────────────────────────────────────────
const APP_ROOT = 'app_datas/ordo-altar';

// ── Top-level Collections ────────────────────────────────────────────────────
export const COL_MEMBERSHIPS    = `${APP_ROOT}/memberships`;
export const COL_COUNTERS       = `${APP_ROOT}/counters`;
export const COL_SERVER_GROUPS  = `${APP_ROOT}/server_groups`;
export const COL_SETTINGS       = `${APP_ROOT}/settings`; // 앱 설정 (슈퍼어드민만 수정)

// ── Global Collections (앱 공통, app_altar 하위가 아님) ─────────────────────
export const COL_NOTIFICATIONS  = 'notifications';   // 알림 큐 (FCM 비동기 처리 대상)

// ── Logs (통합 로그 경로) ────────────────────────────────────────────────────
// fcm 로그는 logs/fcm_logs 문서 하위 서브컬렉션(items)에 저장합니다.
export const COL_FCM_LOGS = 'logs/fcm_logs/items';

// ── Server Group Sub-Collections (동적 함수) ────────────────────────────────
/**
 * 특정 Server Group 아래의 서브컬렉션 경로를 반환하는 헬퍼 함수들
 */
export const paths = {
  /** app_datas/ordo-altar/server_groups/{sgId} */
  serverGroup: (sgId: string) =>
    `${APP_ROOT}/server_groups/${sgId}`,

  /** app_datas/ordo-altar/server_groups/{sgId}/members */
  members: (sgId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/members`,

  /** app_datas/ordo-altar/server_groups/{sgId}/members/{memberId} */
  member: (sgId: string, memberId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/members/${memberId}`,

  /** app_datas/ordo-altar/server_groups/{sgId}/del_members */
  delMembers: (sgId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/del_members`,

  /** app_datas/ordo-altar/server_groups/{sgId}/mass_events */
  massEvents: (sgId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/mass_events`,

  /** app_datas/ordo-altar/server_groups/{sgId}/mass_events/{eventId} */
  massEvent: (sgId: string, eventId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/mass_events/${eventId}`,

  /** app_datas/ordo-altar/server_groups/{sgId}/role_requests */
  roleRequests: (sgId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/role_requests`,

  /** app_datas/ordo-altar/server_groups/{sgId}/role_requests/{requestId} */
  roleRequest: (sgId: string, requestId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/role_requests/${requestId}`,

  /** app_datas/ordo-altar/server_groups/{sgId}/month_status */
  monthStatuses: (sgId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/month_status`,

  /** app_datas/ordo-altar/server_groups/{sgId}/month_status/{monthId} */
  monthStatus: (sgId: string, monthId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/month_status/${monthId}`,

  /** app_datas/ordo-altar/server_groups/{sgId}/availability_surveys */
  surveys: (sgId: string) =>
    `${APP_ROOT}/server_groups/${sgId}/availability_surveys`,

  /** app_datas/ordo-altar/server_groups/{sgId}/availability_surveys/{month} */
  survey: (sgId: string, month: string) =>
    `${APP_ROOT}/server_groups/${sgId}/availability_surveys/${month}`,

  /** app_datas/ordo-altar/server_groups/{sgId}/availability_surveys/{month}/responses */
  surveyResponses: (sgId: string, month: string) =>
    `${APP_ROOT}/server_groups/${sgId}/availability_surveys/${month}/responses`,

  /** app_datas/ordo-altar/server_groups/{sgId}/ai_insights/{month} */
  aiInsight: (sgId: string, month: string) =>
    `${APP_ROOT}/server_groups/${sgId}/ai_insights/${month}`,

  /** app_datas/ordo-altar/server_groups/{sgId}/ai_insights/{month}/history */
  aiInsightHistory: (sgId: string, month: string) =>
    `${APP_ROOT}/server_groups/${sgId}/ai_insights/${month}/history`,
};

// ── Firestore Trigger Patterns (Cloud Function 트리거용) ─────────────────────
// NOTE: Cloud Functions v1 트리거는 실제 경로 문자열을 template literal로 사용
export const TRIGGER_PATHS = {
  /** server_groups/{groupId}/members/{memberId} 트리거용 */
  MEMBER:         `${APP_ROOT}/server_groups/{groupId}/members/{memberId}`,
  ROLE_REQUEST:   `${APP_ROOT}/server_groups/{groupId}/role_requests/{requestId}`,
  MONTH_STATUS:   `${APP_ROOT}/server_groups/{groupId}/month_status/{monthId}`,
  SURVEY:         `${APP_ROOT}/server_groups/{sgId}/availability_surveys/{month}`,
} as const;
