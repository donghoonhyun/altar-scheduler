/**
 * Firebase Cloud Functions - Entry Point
 * -------------------------------------
 * Altar Scheduler (성당 복사 스케쥴러)
 * 모든 Function은 이 파일에서 export 되어야 Firebase 배포 시 포함됨.
 */

import * as admin from 'firebase-admin';

// Firebase Admin 초기화 (중복 방지)
if (!admin.apps.length) {
  if (process.env.FUNCTIONS_EMULATOR) {
    admin.initializeApp({
      projectId: 'altar-scheduler-dev',
    });
    console.log('🔥 admin.initializeApp() (emulator mode) (index.ts)');
  } else {
    admin.initializeApp();
    console.log('✅ admin.initializeApp() (production mode) (index.ts)');
  }
} else {
  console.log('⚠️ admin 이미 초기화됨 (index.ts) (index.ts)');
}

// ===========================
// Cloud Functions Export 모음
// ===========================

// 📌 ServerGroups
export { createServerGroup as altar_createServerGroup } from './serverGroups/createServerGroup';
export { onRoleRequestUpdated as altar_onRoleRequestUpdated } from './serverGroups/onRoleRequestUpdated';

// 📌 MassEvents
export { autoAssignMassEvents as altar_autoAssignMassEvents } from './massEvents/autoAssignMassEvents';
export { analyzeMonthlyAssignments as altar_analyzeMonthlyAssignments } from './massEvents/analyzeMonthlyAssignments';

// 📌 Notifications
// 📌 Notification Queue (비동기 FCM 배치 처리)
export { enqueueDailyMassReminder as altar_enqueueDailyMassReminder } from './notifications/enqueueDailyMassReminder';
export { processNotificationQueue as admin_processNotificationQueue } from './notifications/processNotificationQueue';
export { enqueueNotification as admin_enqueueNotification } from './notifications/enqueueNotification';
export { enqueueNotification as admin_manualSendNotification } from './notifications/enqueueNotification';

// 📌 SMS
export { sendSms as altar_sendSms } from './sms/sendSms';

// 📌 이후 필요시 Roles, Memberships 등도 여기서 export
// export { grantPlanner } from "./roles/grantPlanner";
// export { revokePlanner } from "./roles/revokePlanner";
