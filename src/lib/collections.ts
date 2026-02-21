/**
 * Firestore Collection Paths
 * Ordo 통합 (app_altar/v1)
 */
export const COLLECTIONS = {
  // Shared (Ordo Common)
  USERS: 'users',
  
  // Master Data (Full Path)
  // Ordo App과 동일한 마스터 데이터 구조를 사용합니다.
  MASTER_ROOT: 'sources',
  MASTER_DOC: 'master_datas',
  
  DIOCESES: 'sources/master_datas/dioceses',
  PARISHES: 'sources/master_datas/parishes',
  APPS: 'sources/master_datas/apps',

  // App Specific (v1)
  SERVER_GROUPS: 'app_altar/v1/server_groups',
  MEMBERSHIPS: 'app_altar/v1/memberships',
  COUNTERS: 'app_altar/v1/counters',
  
  // System Collections
  NOTIFICATIONS: 'notifications',
  FCM_LOGS: 'logs/fcm_logs/items',
  SETTINGS: 'app_altar/v1/settings',
  SMS_LOGS: 'app_altar/v1/sms_logs',
} as const;
