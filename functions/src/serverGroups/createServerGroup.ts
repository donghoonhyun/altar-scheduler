import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { CreateServerGroupRequest, CreateServerGroupResponse } from "../../types/firestore"; // ✅ 경로 맞게

const db = admin.firestore();

export const createServerGroup = functions.https.onCall(
  async (data: CreateServerGroupRequest): Promise<CreateServerGroupResponse> => {
    const { parishCode, name, timezone, locale } = data;

    if (!parishCode || !name || !timezone || !locale) {
      throw new functions.https.HttpsError("invalid-argument", "필수 입력값 누락");
    }

    const counterRef = db.collection("server_group_counters").doc("global");

    const newServerGroupId = await db.runTransaction(async (tx) => {
      const counterDoc = await tx.get(counterRef);
      const lastSeq = counterDoc.exists ? counterDoc.data()?.last_seq || 0 : 0;

      const nextSeq = lastSeq + 1;
      const padded = String(nextSeq).padStart(5, "0");
      const serverGroupId = `SG${padded}`;

      tx.set(counterRef, { last_seq: nextSeq }, { merge: true });

      const sgRef = db.collection("server_groups").doc(serverGroupId);
      tx.set(sgRef, {
        parish_code: parishCode,
        name,
        timezone,
        locale,
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return serverGroupId;
    });

    return { serverGroupId: newServerGroupId };
  }
);

