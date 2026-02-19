/**
 * Firestore Collection Paths
 * Ordo 통합 (app_altar/v1)
 */
export const COLLECTIONS = {
  // Shared (Ordo Common)
  USERS: 'users',
  
  // Master Data (Full Path)
  PARISHES: 'sources/master_datas/parishes',

  // App Specific (v1)
  SERVER_GROUPS: 'app_altar/v1/server_groups',
  MEMBERSHIPS: 'app_altar/v1/memberships',
  COUNTERS: 'app_altar/v1/counters',
  
  // System Collections
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'app_altar/v1/settings',
  SMS_LOGS: 'app_altar/v1/sms_logs',
} as const;
