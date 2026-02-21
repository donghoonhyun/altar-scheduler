/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import { REGION_V1 } from '../config';
import { COL_NOTIFICATIONS, db } from './enqueueNotification/core';
import { ACTION_HANDLER_MAP, parseAction, validatePayload } from './enqueueNotification/handlers';

export const enqueueNotification = functions
  .region(REGION_V1)
  .https.onCall(async (data: any, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '인증된 사용자만 실행할 수 있습니다.');
    }

    const action = parseAction(data);
    validatePayload(action, data);
    const handlerDef = ACTION_HANDLER_MAP[action];

    if (!handlerDef.requiresNotification) {
      return handlerDef.handle({ data, context });
    }

    const notificationId = String(data.notificationId);
    const notifRef = db.collection(COL_NOTIFICATIONS).doc(notificationId);
    const notifSnap = await notifRef.get();
    if (!notifSnap.exists) {
      throw new functions.https.HttpsError('not-found', '해당 알림을 찾을 수 없습니다.');
    }

    return handlerDef.handle({
      data,
      context,
      notificationId,
      notifRef,
      notifData: notifSnap.data() || {},
    });
  });
