import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getNextCounter } from "../utils/counter";

const db = admin.firestore();

export const createNotification = functions.https.onCall(
  async (data: { message: string; type: string }) => {
    if (!data.message || !data.type) {
      throw new functions.https.HttpsError("invalid-argument", "필수 입력값 누락");
    }

    try {
      const notificationId = await getNextCounter("notifications", "NTF", 5);

      await db.collection("notifications").doc(notificationId).set({
        type: data.type,
        message: data.message,
        created_at: Timestamp.now(),
      });

      return { notificationId };
    } catch (err) {
      console.error("🔥 [createNotification] 에러 발생:", err);
      throw new functions.https.HttpsError("internal", "서버 오류 발생");
    }
  }
);
