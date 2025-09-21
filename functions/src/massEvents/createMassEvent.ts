import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getNextCounter } from "../utils/counter";

const db = admin.firestore();

export const createMassEvent = functions.https.onCall(
  async (data: { title: string; date: string; requiredServers: number }) => {
    if (!data.title || !data.date || !data.requiredServers) {
      throw new functions.https.HttpsError("invalid-argument", "필수 입력값 누락");
    }

    try {
      const massEventId = await getNextCounter("mass_events", "ME", 5);

      await db.collection("mass_events").doc(massEventId).set({
        title: data.title,
        date: data.date,
        required_servers: data.requiredServers,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      return { massEventId };
    } catch (err) {
      console.error("🔥 [createMassEvent] 에러 발생:", err);
      throw new functions.https.HttpsError("internal", "서버 오류 발생");
    }
  }
);
