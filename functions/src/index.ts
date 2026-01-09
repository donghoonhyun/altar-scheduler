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
export { createServerGroup } from './serverGroups/createServerGroup';

// 📌 MassEvents
export { createMassEvent } from './massEvents/createMassEvent';
export { copyPrevMonthMassEvents } from './massEvents/copyPrevMonth';

// 📌 Notifications
export { createNotification } from './notifications/createNotification';
export { onSurveyOpened } from './notifications/onSurveyOpened';
export { onSurveyClosed } from './notifications/onSurveyClosed';
export { sendTestNotification } from './notifications/sendTestNotification';
export { onUserCreated } from './notifications/onUserCreated';
export { onMemberCreated, onRoleRequestCreated } from './notifications/onMemberEvents';
export { onMonthlyStatusChanged } from './notifications/onMonthlyStatusChanged';

// 📌 이후 필요시 Roles, Memberships 등도 여기서 export
// export { grantPlanner } from "./roles/grantPlanner";
// export { revokePlanner } from "./roles/revokePlanner";
