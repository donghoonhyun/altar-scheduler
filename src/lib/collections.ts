/**
 * Firestore Collection Paths
 * Ordo 통합 (app_datas/ordo-altar)
 */
export const COLLECTIONS = {
  // Shared (Ordo Common)
  USERS: 'users',

  // Master Data (Full Path)
  // Ordo App과 동일한 마스터 데이터 구조를 사용합니다. (2026-02-26 경로 이전)
  MASTER_ROOT: 'master_datas',
  MASTER_DOC: 'shared',

  DIOCESES: 'master_datas/shared/dioceses',
  PARISHES: 'master_datas/shared/parishes',
  APPS: 'master_datas/shared/apps',

  // App Specific
  SERVER_GROUPS: 'app_datas/ordo-altar/server_groups',
  MEMBERSHIPS: 'app_datas/ordo-altar/memberships',

  // System Collections
  NOTIFICATIONS: 'notifications',
  FCM_LOGS: 'logs/fcm_logs/items',
  SETTINGS: 'app_datas/ordo-altar/settings',
  SMS_LOGS: 'app_datas/ordo-altar/sms_logs',
} as const;
