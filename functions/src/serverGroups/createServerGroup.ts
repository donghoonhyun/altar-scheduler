import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { COMMON_OPTIONS_V2 } from '../config';
import { COL_SERVER_GROUPS } from '../firestorePaths';

interface CreateServerGroupRequest {
  parishCode: string;
  name: string;

  active: boolean;
}

interface CreateServerGroupResponse {
  serverGroupId: string;
}

export const createServerGroup = onCall(
  COMMON_OPTIONS_V2,
  async (
    request: CallableRequest<CreateServerGroupRequest>
  ): Promise<CreateServerGroupResponse> => {
    const { parishCode, name, active } = request.data;

    const db = admin.firestore();
    const ref = db.collection(COL_SERVER_GROUPS).doc();

    await ref.set({
      parishCode,
      name,

      active,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { serverGroupId: ref.id };
  }
);
