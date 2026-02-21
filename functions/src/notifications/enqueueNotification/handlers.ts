/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { paths } from '../../firestorePaths';
import {
  COL_FCM_LOGS,
  createQueuedNotification,
  db,
  ensureSuperAdmin,
  resolveApproverUids,
  sendFcmDirect,
} from './core';

export const ACTIONS = [
  'retry',
  'force_send',
  'enqueue_test',
  'enqueue_survey',
  'enqueue_member_approved',
  'enqueue_member_requested',
  'get_target_devices',
  'delete_failed_devices',
  'delete_notification',
] as const;

export type NotificationAction = (typeof ACTIONS)[number];

interface ActionContext {
  data: any;
  context: functions.https.CallableContext;
  notificationId?: string;
  notifRef?: admin.firestore.DocumentReference;
  notifData?: FirebaseFirestore.DocumentData;
}

interface ActionHandlerDef {
  requiresNotification: boolean;
  handle: (ctx: ActionContext) => Promise<any>;
}

export const ACTION_HANDLER_MAP: Record<NotificationAction, ActionHandlerDef> = {
  get_target_devices: { requiresNotification: true, handle: handleGetTargetDevices },
  delete_failed_devices: { requiresNotification: true, handle: handleDeleteFailedDevices },
  enqueue_test: { requiresNotification: false, handle: handleEnqueueTest },
  enqueue_survey: { requiresNotification: false, handle: handleEnqueueSurvey },
  enqueue_member_approved: { requiresNotification: false, handle: handleEnqueueMemberApproved },
  enqueue_member_requested: { requiresNotification: false, handle: handleEnqueueMemberRequested },
  delete_notification: { requiresNotification: true, handle: handleDeleteNotification },
  retry: { requiresNotification: true, handle: handleRetry },
  force_send: { requiresNotification: true, handle: handleForceSend },
};

export function parseAction(data: any): NotificationAction {
  const rawAction = typeof data?.action === 'string' ? data.action : 'retry';
  if (!ACTIONS.includes(rawAction as NotificationAction)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `지원하지 않는 action입니다: ${rawAction}`
    );
  }
  return rawAction as NotificationAction;
}

export function validatePayload(action: NotificationAction, data: any): void {
  if (action === 'enqueue_test') requireString(data?.targetUid, 'targetUid는 필수입니다.');

  if (action === 'enqueue_survey') {
    requireString(data?.serverGroupId, 'serverGroupId는 필수입니다.');
    requireString(data?.month, 'month는 필수입니다.');
    requireString(data?.type, 'type는 필수입니다.');
  }

  if (action === 'enqueue_member_approved') {
    requireString(data?.targetUid, 'targetUid는 필수입니다.');
    requireString(data?.serverGroupId, 'serverGroupId는 필수입니다.');
    requireString(data?.memberName, 'memberName은 필수입니다.');
  }

  if (action === 'enqueue_member_requested') {
    requireString(data?.serverGroupId, 'serverGroupId는 필수입니다.');
    requireString(data?.memberName, 'memberName은 필수입니다.');
  }

  if (ACTION_HANDLER_MAP[action].requiresNotification) {
    requireString(data?.notificationId, 'notificationId는 필수입니다.');
  }
}

function requireString(value: unknown, message: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', message);
  }
}

async function handleGetTargetDevices({ context, notifData }: ActionContext) {
  await ensureSuperAdmin(context.auth!.uid);
  const targetUids: string[] = notifData?.target_uids || [];
  if (targetUids.length === 0) return { success: true, devices: [] };

  const failedTokenErrorMap = new Map<string, string>();
  const notifErrors = Array.isArray(notifData?.fcm_result?.errors) ? notifData.fcm_result.errors : [];
  notifErrors.forEach((e: any) => {
    if (e?.token && e?.error) failedTokenErrorMap.set(e.token, e.error);
  });

  const userDocs: admin.firestore.QueryDocumentSnapshot[] = [];
  for (let i = 0; i < targetUids.length; i += 10) {
    const chunk = targetUids.slice(i, i + 10);
    const snap = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    userDocs.push(...snap.docs);
  }

  const devices: Array<{ uid: string; user_name: string; token: string; failed: boolean; error_code: string | null }> = [];
  userDocs.forEach((doc) => {
    const d = doc.data() || {};
    const userName = d.name || d.displayName || d.email || doc.id;
    const tokensRaw: unknown[] = Array.isArray(d.fcm_tokens) ? d.fcm_tokens : [];
    const tokens = sanitizeTokens(tokensRaw).tokens;
    tokens.forEach((token) => {
      const errorCode = failedTokenErrorMap.get(token) || null;
      devices.push({ uid: doc.id, user_name: userName, token, failed: !!errorCode, error_code: errorCode });
    });
  });

  return { success: true, devices };
}

async function handleDeleteFailedDevices({ data, context, notifData }: ActionContext) {
  await ensureSuperAdmin(context.auth!.uid);
  const notifErrors = Array.isArray(notifData?.fcm_result?.errors) ? notifData.fcm_result.errors : [];
  const failedTokensFromNotif = Array.from(
    new Set(
      notifErrors
        .map((e: any) => e?.token)
        .filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
    )
  );
  const reqTokens = Array.isArray(data.tokens)
    ? data.tokens.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
    : [];
  const tokensToDelete =
    reqTokens.length > 0 ? reqTokens.filter((t: string) => failedTokensFromNotif.includes(t)) : failedTokensFromNotif;

  if (tokensToDelete.length === 0) return { success: true, removed_count: 0, message: '삭제할 실패 토큰이 없습니다.' };

  const removed: Array<{ uid: string; token: string }> = [];
  for (const token of tokensToDelete) {
    const snap = await db.collection('users').where('fcm_tokens', 'array-contains', token).get();
    for (const userDoc of snap.docs) {
      await userDoc.ref.update({ fcm_tokens: admin.firestore.FieldValue.arrayRemove(token) });
      removed.push({ uid: userDoc.id, token });
    }
  }
  return { success: true, removed_count: removed.length, removed, message: `실패 기기 토큰 ${removed.length}건을 삭제했습니다.` };
}

async function handleEnqueueTest({ data, context }: ActionContext) {
  const notifRef = await createQueuedNotification({
    title: '🔔[Altar Scheduler] 알림 테스트',
    body: '테스트 메시지(FCM)를 정상적으로 수신하였습니다.',
    clickAction: '/',
    targetUids: [data.targetUid],
    feature: 'TEST_SEND',
    context,
  });
  return {
    success: true,
    message: `테스트 알림이 대기열에 등록되었습니다. 대상자에게 알림이 곧 보내집니다. (notificationId=${notifRef.id})`,
    notificationId: notifRef.id,
  };
}

async function handleEnqueueSurvey({ data, context }: ActionContext) {
  const { serverGroupId, month, type, title: customTitle, body: customBody } = data;
  const surveyRef = db.doc(paths.survey(serverGroupId, month));
  const surveySnap = await surveyRef.get();
  if (!surveySnap.exists) throw new functions.https.HttpsError('not-found', 'Survey not found');

  const surveyData = surveySnap.data();
  const memberIds: string[] = surveyData?.member_ids || [];
  if (memberIds.length === 0) return { success: false, message: 'No target members' };

  const parentUids = new Set<string>();
  await Promise.all(
    memberIds.map(async (mid) => {
      const memSnap = await db.doc(paths.member(serverGroupId, mid)).get();
      if (memSnap.exists) {
        const mData = memSnap.data();
        if (mData?.parent_uid) parentUids.add(mData.parent_uid);
      }
    })
  );
  if (parentUids.size === 0) return { success: false, message: 'No parent UIDs found' };

  const monthStr = month.length === 6 ? parseInt(month.substring(4, 6), 10).toString() : month;
  let title = '';
  let body = '';
  let clickAction = '';
  let feature = '';
  let triggerStatus = '';

  if (type === 'SURVEY_OPENED') {
    title = customTitle || '📋 미사 배정 설문 시작';
    body = customBody || `${monthStr}월 미사 배정 설문이 시작되었습니다. 앱에서 참여해주세요!`;
    clickAction = `/survey/${serverGroupId}/${month}`;
    feature = 'SURVEY_OPENED';
    triggerStatus = 'OPEN';
  } else if (type === 'SURVEY_CLOSED') {
    title = customTitle || '🔒 미사 배정 설문 마감';
    body = customBody || `${monthStr}월 미사 배정 설문이 종료되었습니다.`;
    clickAction = `/server-groups/${serverGroupId}`;
    feature = 'SURVEY_CLOSED';
    triggerStatus = 'CLOSED';
  } else if (type === 'FINAL_CONFIRMED') {
    title = customTitle || '✅ 미사 배정 확정';
    body = customBody || `${monthStr}월 복사 배정표가 확정되었습니다. 확인해주세요!`;
    clickAction = `/server-groups/${serverGroupId}`;
    feature = 'FINAL_CONFIRMED';
    triggerStatus = 'FINAL_CONFIRMED';
  } else {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid notification type');
  }

  const notifRef = await createQueuedNotification({
    title,
    body,
    clickAction,
    targetUids: Array.from(parentUids),
    feature,
    serverGroupId,
    triggerStatus,
    context,
  });

  await surveyRef.update({
    notifications: admin.firestore.FieldValue.arrayUnion({
      type: 'app_push',
      sent_at: admin.firestore.Timestamp.now(),
      recipient_count: parentUids.size,
      status: 'success',
      title,
      body,
      triggered_by: context.auth!.uid,
    }),
  });

  return {
    success: true,
    message: `알림이 대기열에 등록되었습니다. 대상자에게 알림이 곧 보내집니다. (대상 ${parentUids.size}명)`,
    notificationId: notifRef.id,
    queued_count: parentUids.size,
  };
}

async function handleEnqueueMemberApproved({ data, context }: ActionContext) {
  const notifRef = await createQueuedNotification({
    title: '✅ 복사단 가입 승인',
    body: `${data.memberName} 복사님의 가입이 승인되었습니다.`,
    clickAction: `/server-groups/${data.serverGroupId}`,
    targetUids: [data.targetUid],
    feature: 'MEMBER_APPLICATION',
    serverGroupId: data.serverGroupId,
    context,
  });
  return {
    success: true,
    message: `승인 알림이 대기열에 등록되었습니다. 대상자에게 알림이 곧 보내집니다. (notificationId=${notifRef.id})`,
    notificationId: notifRef.id,
  };
}

async function handleEnqueueMemberRequested({ data, context }: ActionContext) {
  const targetUids = await resolveApproverUids(data.serverGroupId, context.auth?.uid);
  if (targetUids.length === 0) {
    return { success: false, message: '알림 대상 관리자/플래너를 찾지 못했습니다.' };
  }
  const notifRef = await createQueuedNotification({
    title: '📝 복사 가입 신청',
    body: `${data.memberName} 복사의 가입 요청이 접수되었습니다. 승인 대기 중입니다.`,
    clickAction: `/server-groups/${data.serverGroupId}/servers`,
    targetUids,
    feature: 'MEMBER_REQUEST',
    serverGroupId: data.serverGroupId,
    context,
  });
  return {
    success: true,
    message: `가입 요청 알림이 대기열에 등록되었습니다. 대상자에게 알림이 곧 보내집니다. (대상 ${targetUids.length}명)`,
    notificationId: notifRef.id,
    queued_count: targetUids.length,
  };
}

async function handleDeleteNotification({ context, notificationId, notifRef }: ActionContext) {
  await ensureSuperAdmin(context.auth!.uid);
  await notifRef!.delete();
  return { success: true, message: `알림 ${notificationId}을(를) 삭제했습니다.` };
}

async function handleRetry({ context, notificationId, notifRef }: ActionContext) {
  await notifRef!.update({
    fcm_status: 'pending',
    retry_count: 0,
    last_error: null,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    manual_retry_by: context.auth!.uid,
    manual_retry_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {
    success: true,
    message: `알림 ${notificationId}이(가) 재발송 대기열에 추가되었습니다. 대상자에게 알림이 곧 보내집니다.`,
  };
}

async function handleForceSend({ context, notificationId, notifRef, notifData }: ActionContext) {
  const targetUids: string[] = notifData?.target_uids || [];
  if (targetUids.length === 0) return { success: false, message: '발송 대상이 없습니다.' };

  await notifRef!.update({
    fcm_status: 'processing',
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    const result = await sendFcmDirect(targetUids, {
      title: notifData?.title || '',
      body: notifData?.body || '',
      clickAction: notifData?.click_action || '/',
      data: notifData?.fcm_data || {},
    });

    const status =
      result.failure_count === 0 ? 'sent' : result.success_count > 0 ? 'partial' : 'failed';

    await notifRef!.update({
      fcm_status: status,
      fcm_sent_at: admin.firestore.FieldValue.serverTimestamp(),
      fcm_result: {
        success_count: result.success_count,
        failure_count: result.failure_count,
        errors: result.errors.slice(0, 20),
      },
      retry_count: admin.firestore.FieldValue.increment(1),
      last_error:
        result.no_token_uids.length > 0
          ? `NO_FCM_TOKENS: ${result.no_token_uids.length} uid(s)`
          : null,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      manual_retry_by: context.auth!.uid,
      manual_retry_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection(COL_FCM_LOGS).add({
      notification_id: notificationId,
      batch_id: `manual_${Date.now()}`,
      app_id: notifData?.app_id || null,
      feature: notifData?.feature || null,
      title: notifData?.title || '',
      body: notifData?.body || '',
      target_uid_count: targetUids.length,
      success_count: result.success_count,
      failure_count: result.failure_count,
      status,
      errors: result.errors.slice(0, 20),
      triggered_by: context.auth!.uid,
      trigger_type: 'manual',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: `발송 완료 — 성공: ${result.success_count}, 실패: ${result.failure_count}`,
      fcm_result: {
        success_count: result.success_count,
        failure_count: result.failure_count,
      },
    };
  } catch (err: any) {
    await notifRef!.update({
      fcm_status: 'failed',
      last_error: err.message,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new functions.https.HttpsError('internal', `FCM 발송 실패: ${err.message}`);
  }
}

function sanitizeTokens(rawTokens: unknown[]): { tokens: string[]; changed: boolean } {
  const filtered = rawTokens.filter((t): t is string => typeof t === 'string' && t.length > 0);
  const deduped = Array.from(new Set(filtered));
  const trimmed = deduped.slice(-20);
  const changed = trimmed.length !== rawTokens.length || trimmed.some((t, i) => t !== rawTokens[i]);
  return { tokens: trimmed, changed };
}
