import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getNextCounter } from "../utils/counter";
import {
  CreateServerGroupRequest,
  CreateServerGroupResponse,
} from "../types/firestore";

const db = admin.firestore();

export const createServerGroup = functions.https.onCall(
  async (
    data: CreateServerGroupRequest
  ): Promise<CreateServerGroupResponse> => {
    const { parishCode, name, timezone, locale, active } = data;

    if (!parishCode || !name || !timezone || !locale) {
      throw new functions.https.HttpsError("invalid-argument", "필수 입력값 누락");
    }

    try {
      // ✅ 공통 counter 유틸 사용
      const serverGroupId = await getNextCounter("server_groups", "SG", 5);

      await db.collection("server_groups").doc(serverGroupId).set({
        parish_code: parishCode,
        name,
        timezone,
        locale,
        active,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      return { serverGroupId };
    } catch (err) {
      console.error("🔥 [createServerGroup] 에러 발생:", err);
      throw new functions.https.HttpsError(
        "internal",
        "서버 오류 발생: " + (err as Error).message
      );
    }
  }
);
