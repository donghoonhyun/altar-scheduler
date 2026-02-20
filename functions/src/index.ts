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
export { createNotification as altar_createNotification } from './notifications/createNotification';
export { onSurveyOpened as altar_onSurveyOpened } from './notifications/onSurveyOpened';
export { onSurveyClosed as altar_onSurveyClosed } from './notifications/onSurveyClosed';
export { sendTestNotification as altar_sendTestNotification } from './notifications/sendTestNotification';
export { onUserCreated as altar_onUserCreated } from './notifications/onUserCreated';
export { onMemberCreated as altar_onMemberCreated, onRoleRequestCreated as altar_onRoleRequestCreated, onMemberUpdated as altar_onMemberUpdated } from './notifications/onMemberEvents';
export { onMonthlyStatusChanged as altar_onMonthlyStatusChanged } from './notifications/onMonthlyStatusChanged';
export { onDailyMassReminder as altar_onDailyMassReminder, manualDailyMassReminder as altar_manualDailyMassReminder } from './notifications/onDailyMassReminder';
export { sendSurveyNotification as altar_sendSurveyNotification } from './notifications/sendSurveyNotification';



// 📌 SMS
export { sendSms as altar_sendSms } from './sms/sendSms';

// 📌 이후 필요시 Roles, Memberships 등도 여기서 export
// export { grantPlanner } from "./roles/grantPlanner";
// export { revokePlanner } from "./roles/revokePlanner";
