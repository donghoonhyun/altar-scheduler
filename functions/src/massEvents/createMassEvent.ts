import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

if (!admin.apps.length) {
  admin.initializeApp();
  console.log('✅ admin.initializeApp() 호출됨');
}

const db = admin.firestore();

export interface CreateMassEventRequest {
  serverGroupId: string;
  title: string;
  date: string; // YYYY-MM-DD
  requiredServers: number;
}

export interface CreateMassEventResponse {
  success: boolean;
  eventId?: string;
  message?: string;
  error?: string;
}

export const createMassEvent = functions.https.onCall(
  async (data: CreateMassEventRequest, context): Promise<CreateMassEventResponse> => {
    console.log('📨 [createMassEvent] 호출됨:', JSON.stringify(data));

    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
      }

      const { serverGroupId, title, date, requiredServers } = data;
      if (!serverGroupId || !title || !date || !requiredServers) {
        throw new functions.https.HttpsError('invalid-argument', '필수 입력값 누락');
      }

      // ✅ server_group의 timezone 조회
      const groupRef = db.collection('server_groups').doc(serverGroupId);
      const groupSnap = await groupRef.get();

      if (!groupSnap.exists) {
        throw new functions.https.HttpsError('not-found', `serverGroup ${serverGroupId} 없음`);
      }

      const tz = groupSnap.data()?.timezone || 'Asia/Seoul';
      console.log(`🌐 serverGroup ${serverGroupId} timezone = ${tz}`);

      // ✅ 카운터
      const counterRef = db.collection('counters').doc('mass_events');
      const counterSnap = await counterRef.get();
      const lastSeq = counterSnap.exists ? counterSnap.data()?.last_seq || 0 : 0;
      const newSeq = lastSeq + 1;
      const eventId = `ME${String(newSeq).padStart(6, '0')}`;

      // ✅ 날짜 변환 (PRD 2.4.2.3 규칙)
      // 현지 자정 기준 Timestamp로 저장
      const localMidnight = dayjs(date).tz(tz, true).startOf('day');
      const timestamp = Timestamp.fromDate(localMidnight.toDate());

      console.log(
        `📅 변환 완료: 입력=${date}, timezone=${tz}, Firestore 저장=${timestamp
          .toDate()
          .toISOString()}`
      );

      // ✅ 트랜잭션 저장
      await db.runTransaction(async (t) => {
        const eventRef = groupRef.collection('mass_events').doc(eventId);

        t.set(counterRef, { last_seq: newSeq, updated_at: new Date() }, { merge: true });
        t.set(eventRef, {
          server_group_id: serverGroupId,
          title,
          date: timestamp,
          required_servers: requiredServers,
          status: 'MASS-NOTCONFIRMED',
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      });

      console.log(`✅ [createMassEvent] ${eventId} created for ${serverGroupId}`);
      return { success: true, eventId, message: `${eventId} created.` };
    } catch (err) {
      console.error('❌ createMassEvent error:', err);
      if (err instanceof functions.https.HttpsError) {
        return { success: false, error: `[FirebaseError] ${err.message}` };
      }
      if (err instanceof Error) {
        return { success: false, error: `[NativeError] ${err.message}` };
      }
      return { success: false, error: `[UnknownError] ${JSON.stringify(err)}` };
    }
  }
);
