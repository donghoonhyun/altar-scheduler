import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COL_MEMBERSHIPS } from '../firestorePaths';

interface ActiveMembership {
  serverGroupId: string;
  roles: string[];
}

/**
 * 호출자의 승인된(active === true) membership 목록을 조회한다.
 * 판정 기준은 클라이언트 src/state/session.ts 와 동일하게 유지한다.
 */
async function getActiveMemberships(uid: string): Promise<ActiveMembership[]> {
  const snap = await admin
    .firestore()
    .collection(COL_MEMBERSHIPS)
    .where('uid', '==', uid)
    .get();

  return snap.docs
    .map((doc) => doc.data())
    .filter((data) => data.active === true && data.role)
    .map((data) => ({
      serverGroupId: data.server_group_id,
      roles: Array.isArray(data.role) ? data.role : [data.role],
    }));
}

/**
 * 해당 복사단의 admin/planner 이거나 superadmin 이어야 한다.
 * (RoleGuard require="planner" 와 같은 기준)
 */
export async function assertCanManageServerGroup(uid: string, serverGroupId: string): Promise<void> {
  const memberships = await getActiveMemberships(uid);

  const allowed = memberships.some(
    (m) =>
      m.roles.includes('superadmin') ||
      (m.serverGroupId === serverGroupId &&
        (m.roles.includes('admin') || m.roles.includes('planner')))
  );

  if (!allowed) {
    throw new functions.https.HttpsError(
      'permission-denied',
      '이 복사단의 플래너 또는 어드민 권한이 필요합니다.'
    );
  }
}

/** superadmin 이어야 한다. */
export async function assertSuperAdmin(uid: string): Promise<void> {
  const memberships = await getActiveMemberships(uid);

  if (!memberships.some((m) => m.roles.includes('superadmin'))) {
    throw new functions.https.HttpsError('permission-denied', '슈퍼어드민 권한이 필요합니다.');
  }
}
