/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COL_FCM_LOGS, COL_MEMBERSHIPS, COL_NOTIFICATIONS } from '../../firestorePaths';

export const db = admin.firestore();
const MAX_FCM_TOKENS_PER_USER = 20;
const DEFAULT_APP_ID = 'ordo-altar';
const REMOVABLE_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/mismatched-credential',
]);

export interface FcmPayload {
  title: string;
  body: string;
  clickAction?: string;
  data?: Record<string, string>;
}

export interface FcmResult {
  success_count: number;
  failure_count: number;
  errors: { uid: string; token: string; error: string }[];
  invalid_tokens: string[];
  no_token_uids: string[];
}

export interface CreateQueuedNotificationInput {
  title: string;
  body: string;
  clickAction: string;
  targetUids: string[];
  feature: string;
  serverGroupId?: string;
  triggerStatus?: string;
  fcmData?: Record<string, string>;
  context: functions.https.CallableContext;
}

export async function createQueuedNotification({
  title,
  body,
  clickAction,
  targetUids,
  feature,
  serverGroupId,
  triggerStatus,
  fcmData,
  context,
}: CreateQueuedNotificationInput): Promise<admin.firestore.DocumentReference> {
  const notifRef = db.collection(COL_NOTIFICATIONS).doc();
  const payload: Record<string, unknown> = {
    title,
    body,
    click_action: clickAction,
    target_uids: targetUids,
    app_id: DEFAULT_APP_ID,
    feature,
    fcm_status: 'pending',
    retry_count: 0,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    triggered_by: context.auth?.uid || null,
    triggered_by_name: getTriggeredByName(context),
  };

  if (serverGroupId) payload.server_group_id = serverGroupId;
  if (triggerStatus) payload.trigger_status = triggerStatus;
  if (fcmData) payload.fcm_data = fcmData;

  await notifRef.set(payload);
  return notifRef;
}

export async function resolveApproverUids(
  serverGroupId: string,
  excludeUid?: string
): Promise<string[]> {
  const membershipSnap = await db
    .collection(COL_MEMBERSHIPS)
    .where('server_group_id', '==', serverGroupId)
    .where('active', '==', true)
    .get();

  const approverUids = new Set<string>();
  membershipSnap.forEach((mDoc) => {
    const mData = mDoc.data() || {};
    const roles = Array.isArray(mData.role)
      ? mData.role
      : typeof mData.role === 'string'
        ? [mData.role]
        : [];
    if (!roles.includes('admin') && !roles.includes('planner')) return;

    const uidFromData =
      typeof mData.uid === 'string' && mData.uid.length > 0 ? mData.uid : null;
    const uidFromDoc =
      typeof mDoc.id === 'string' && mDoc.id.includes('_')
        ? mDoc.id.split('_')[0]
        : mDoc.id;
    const uid = uidFromData || uidFromDoc;
    if (uid) approverUids.add(uid);
  });

  if (excludeUid) approverUids.delete(excludeUid);
  return Array.from(approverUids);
}

export async function sendFcmDirect(
  uids: string[],
  payload: FcmPayload
): Promise<FcmResult> {
  const result: FcmResult = {
    success_count: 0,
    failure_count: 0,
    errors: [],
    invalid_tokens: [],
    no_token_uids: [],
  };

  const tokenMap: { uid: string; token: string }[] = [];
  const matchedUids = new Set<string>();
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 10) {
    chunks.push(uids.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const snap = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();

    snap.forEach((doc) => {
      matchedUids.add(doc.id);
      const d = doc.data();
      if (d.fcm_tokens && Array.isArray(d.fcm_tokens)) {
        const sanitizedTokens = sanitizeTokens(d.fcm_tokens);
        if (sanitizedTokens.changed) {
          void doc.ref.update({
            fcm_tokens: sanitizedTokens.tokens,
            last_fcm_update: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        sanitizedTokens.tokens.forEach((t: string) =>
          tokenMap.push({ uid: doc.id, token: t })
        );
      }
    });
  }

  if (tokenMap.length === 0) {
    result.no_token_uids = Array.from(new Set(uids));
    result.failure_count = result.no_token_uids.length;
    result.errors = result.no_token_uids.map((uid) => ({
      uid,
      token: '',
      error: matchedUids.has(uid) ? 'messaging/no-fcm-token' : 'messaging/user-not-found',
    }));
    return result;
  }

  const seen = new Set<string>();
  const unique = tokenMap.filter((t) => {
    if (seen.has(t.token)) return false;
    seen.add(t.token);
    return true;
  });

  const tokens = unique.map((t) => t.token);
  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data || {},
    webpush: payload.clickAction ? { fcmOptions: { link: payload.clickAction } } : undefined,
  };

  if (payload.clickAction) {
    message.data = { ...message.data, click_action: payload.clickAction };
  }

  const response = await admin.messaging().sendEachForMulticast(message);
  result.success_count = response.successCount;
  result.failure_count = response.failureCount;

  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      result.errors.push({
        uid: unique[idx].uid,
        token: unique[idx].token,
        error: resp.error?.code || 'unknown',
      });

      const errCode = resp.error?.code || 'unknown';
      if (REMOVABLE_ERROR_CODES.has(errCode)) {
        result.invalid_tokens.push(unique[idx].token);
      }
    }
  });

  if (result.invalid_tokens.length > 0) {
    await cleanupInvalidTokens(result.invalid_tokens);
  }

  return result;
}

export async function ensureSuperAdmin(uid: string): Promise<void> {
  const userSnap = await db.collection('users').doc(uid).get();
  const roles = Array.isArray(userSnap.data()?.roles) ? userSnap.data()?.roles : [];
  if (!roles.includes('superadmin')) {
    throw new functions.https.HttpsError(
      'permission-denied',
      '슈퍼어드민만 실행할 수 있습니다.'
    );
  }
}

export function getTriggeredByName(context: functions.https.CallableContext): string {
  return context.auth?.token?.name || context.auth?.token?.email || 'Unknown';
}

export { COL_FCM_LOGS, COL_NOTIFICATIONS };

function sanitizeTokens(rawTokens: unknown[]): { tokens: string[]; changed: boolean } {
  const filtered = rawTokens.filter(
    (t): t is string => typeof t === 'string' && t.length > 0
  );
  const deduped = Array.from(new Set(filtered));
  const trimmed = deduped.slice(-MAX_FCM_TOKENS_PER_USER);
  const changed = trimmed.length !== rawTokens.length || trimmed.some((t, i) => t !== rawTokens[i]);
  return { tokens: trimmed, changed };
}

async function cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
  const deduped = Array.from(new Set(invalidTokens));
  for (const token of deduped) {
    const snap = await db
      .collection('users')
      .where('fcm_tokens', 'array-contains', token)
      .get();

    for (const doc of snap.docs) {
      await doc.ref.update({
        fcm_tokens: admin.firestore.FieldValue.arrayRemove(token),
        last_fcm_update: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}
