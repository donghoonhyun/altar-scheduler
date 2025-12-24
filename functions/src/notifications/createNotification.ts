import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { COMMON_OPTIONS_V2 } from '../config';

export const createNotification = onCall(
  COMMON_OPTIONS_V2,
  async (
    request: CallableRequest<{ message: string; type: string }>
  ): Promise<{ notificationId: string }> => {
    const { message, type } = request.data;

    const db = admin.firestore();
    const ref = db.collection('notifications').doc();

    await ref.set({
      message,
      type,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { notificationId: ref.id };
  }
);
