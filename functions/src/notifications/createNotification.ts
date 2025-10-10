import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const createNotification = onCall(
  { region: 'asia-northeast3' },
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
