import * as admin from "firebase-admin";

// Firebase Admin 초기화 (중복 방지)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ===========================
// Cloud Functions Export 모음
// ===========================

// 📌 ServerGroups
export { createServerGroup } from "./serverGroups/createServerGroup";

// 📌 MassEvents
export { createMassEvent } from "./massEvents/createMassEvent";

// 📌 Notifications
export { createNotification } from "./notifications/createNotification";

// 📌 이후 필요시 Roles, Memberships 등도 여기서 export
// export { grantPlanner } from "./roles/grantPlanner";
// export { revokePlanner } from "./roles/revokePlanner";
