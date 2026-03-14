/**
 * Firebase Cloud Functions - Entry Point
 * -------------------------------------
 * Altar Scheduler (성당 복사 스케쥴러)
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
}

// 📌 ServerGroups
export { createServerGroup as altar_createServerGroup } from './serverGroups/createServerGroup';
export { onRoleRequestUpdated as altar_onRoleRequestUpdated } from './serverGroups/onRoleRequestUpdated';

// 📌 MassEvents
export { autoAssignMassEvents as altar_autoAssignMassEvents } from './massEvents/autoAssignMassEvents';
export { analyzeMonthlyAssignments as altar_analyzeMonthlyAssignments } from './massEvents/analyzeMonthlyAssignments';

// 📌 Notifications (Core migrated to OrdoAdmin)
export { enqueueDailyMassReminder as altar_enqueueDailyMassReminder } from './notifications/enqueueDailyMassReminder';

// 📌 SMS
export { sendSms as altar_sendSms } from './sms/sendSms';
