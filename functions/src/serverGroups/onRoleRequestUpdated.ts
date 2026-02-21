import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { REGION_V1 } from '../config';
import { TRIGGER_PATHS } from '../firestorePaths';

/**
 * 플래너 권한 요청 상태 변경 시 트리거
 * - 승인(approved) 시: 사용자의 글로벌 프로필 정보(users 컬렉션)를 최신 신청 정보로 업데이트
 */
export const onRoleRequestUpdated = functions.region(REGION_V1).firestore
  .document(TRIGGER_PATHS.ROLE_REQUEST)
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    // 상태가 'approved'로 변경된 경우에만 실행
    if (newData.status === 'approved' && oldData.status !== 'approved') {
      const { uid, user_name, baptismal_name, phone } = newData;

      if (!uid) {
        console.error('No UID in role request');
        return;
      }

      console.log(`[RoleRequest Approved] Updating user profile for ${uid}`);

      try {
        // 사용자 글로벌 프로필 업데이트 (Admin SDK 사용으로 권한 무시)
        await admin.firestore().collection('users').doc(uid).set({
          user_name,
          baptismal_name,
          phone,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`Successfully updated user profile for ${uid}`);
      } catch (error) {
        console.error(`Failed to update user profile for ${uid}:`, error);
      }
    }
  });
