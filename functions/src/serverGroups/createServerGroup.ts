import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface CreateServerGroupRequest {
  parishCode: string;
  name: string;
  timezone: string;
  locale: string;
  active: boolean;
}

interface CreateServerGroupResponse {
  serverGroupId: string;
}

export const createServerGroup = onCall(
  { region: 'asia-northeast3' },
  async (
    request: CallableRequest<CreateServerGroupRequest>
  ): Promise<CreateServerGroupResponse> => {
    const { parishCode, name, timezone, locale, active } = request.data;

    const db = admin.firestore();
    const ref = db.collection('server_groups').doc();

    await ref.set({
      parishCode,
      name,
      timezone,
      locale,
      active,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { serverGroupId: ref.id };
  }
);
