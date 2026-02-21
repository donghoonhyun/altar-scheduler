/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COL_NOTIFICATIONS, COL_FCM_LOGS } from '../firestorePaths';

const db = admin.firestore();

// ── 설정 ─────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 50;        // 한 번에 처리할 최대 알림 수
const MAX_RETRY = 3;          // 최대 재시도 횟수
const FCM_TOKEN_CHUNK = 500;  // FCM multicast 최대 토큰 수
const MAX_FCM_TOKENS_PER_USER = 20; // 사용자별 보관 토큰 상한
const REMOVABLE_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/mismatched-credential',
]);

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface FcmResult {
  success_count: number;
  failure_count: number;
  invalid_tokens: string[];
  errors: { uid: string; token: string; error: string }[];
  no_token_uids: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Scheduled Function — 비동기 FCM 배치 처리
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * 📬 processNotificationQueue
 * ─────────────────────────────────────────────────────────────────────────────
 * 매 1분마다 실행되어 fcm_status == 'pending'인 알림을 배치로 처리합니다.
 *
 * 처리 흐름:
 *   1. pending 상태 알림을 최대 BATCH_SIZE건 조회
 *   2. 각 알림을 processing으로 전환 (중복 방지)
 *   3. target_uids에서 FCM 토큰 수집
 *   4. FCM sendEachForMulticast 발송
 *   5. 결과에 따라 sent / partial / failed 상태 업데이트
 *   6. fcm_logs 컬렉션에 상세 발송 이력 기록
 *   7. 무효 토큰 자동 정리
 */
export const processNotificationQueue = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 1 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    console.log('📬 [NotificationQueue] Starting batch processing...');

    // 1. pending 알림 조회 (retry_count < MAX_RETRY, 오래된 것 우선)
    const pendingSnap = await db
      .collection(COL_NOTIFICATIONS)
      .where('fcm_status', '==', 'pending')
      .where('retry_count', '<', MAX_RETRY)
      .orderBy('retry_count', 'asc')
      .orderBy('created_at', 'asc')
      .limit(BATCH_SIZE)
      .get();

    if (pendingSnap.empty) {
      console.log('📬 [NotificationQueue] No pending notifications.');
      return;
    }

    console.log(`📬 [NotificationQueue] Found ${pendingSnap.size} pending notifications.`);

    const batchId = `batch_${Date.now()}`;

    // 2. 각 알림 처리
    for (const doc of pendingSnap.docs) {
      const notifId = doc.id;
      const data = doc.data();

      try {
        // 2-1. processing 상태로 전환 (중복 실행 방지)
        await doc.ref.update({
          fcm_status: 'processing',
          fcm_batch_id: batchId,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2-2. 대상 UID에서 FCM 토큰 수집
        const targetUids: string[] = data.target_uids || [];
        if (targetUids.length === 0) {
          await doc.ref.update({
            fcm_status: 'sent',
            fcm_result: { success_count: 0, failure_count: 0, errors: [] },
            fcm_sent_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }

        // 2-3. FCM 발송
        const result = await sendFcmToUids(targetUids, {
          title: data.title || '',
          body: data.body || '',
          clickAction: data.click_action || '/',
          data: data.fcm_data || {},
        });

        // 2-4. 상태 업데이트
        const status =
          result.failure_count === 0
            ? 'sent'
            : result.success_count > 0
              ? 'partial'
              : 'failed';

        await doc.ref.update({
          fcm_status: status,
          fcm_sent_at: admin.firestore.FieldValue.serverTimestamp(),
          fcm_batch_id: batchId,
          fcm_result: {
            success_count: result.success_count,
            failure_count: result.failure_count,
            errors: result.errors.slice(0, 20), // 최대 20개 에러만 저장
          },
          retry_count: admin.firestore.FieldValue.increment(1),
          last_error:
            result.no_token_uids.length > 0
              ? `NO_FCM_TOKENS: ${result.no_token_uids.length} uid(s)`
              : null,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2-5. FCM 발송 이력 기록 (fcm_logs)
        await db.collection(COL_FCM_LOGS).add({
          notification_id: notifId,
          batch_id: batchId,
          app_id: data.app_id || null,
          feature: data.feature || null,
          title: data.title || '',
          body: data.body || '',
          target_uid_count: targetUids.length,
          token_count: result.success_count + result.failure_count,
          success_count: result.success_count,
          failure_count: result.failure_count,
          status,
          errors: result.errors.slice(0, 20),
          invalid_tokens_removed: result.invalid_tokens.length,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2-6. 무효 토큰 정리
        if (result.invalid_tokens.length > 0) {
          await cleanupInvalidTokens(result.invalid_tokens);
        }

        console.log(
          `✅ [${notifId}] ${status} — success:${result.success_count} fail:${result.failure_count}`
        );
      } catch (err: any) {
        console.error(`❌ [${notifId}] Processing error:`, err.message);

        // 실패 시 pending으로 되돌림 (다음 배치에서 재시도)
        await doc.ref.update({
          fcm_status: 'pending',
          retry_count: admin.firestore.FieldValue.increment(1),
          last_error: err.message || 'Unknown error',
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    console.log(`📬 [NotificationQueue] Batch ${batchId} completed.`);
  });

// ═══════════════════════════════════════════════════════════════════════════════
// 내부 헬퍼: FCM 발송
// ═══════════════════════════════════════════════════════════════════════════════
interface FcmPayload {
  title: string;
  body: string;
  clickAction?: string;
  data?: Record<string, string>;
}

async function sendFcmToUids(
  uids: string[],
  payload: FcmPayload
): Promise<FcmResult> {
  const result: FcmResult = {
    success_count: 0,
    failure_count: 0,
    invalid_tokens: [],
    errors: [],
    no_token_uids: [],
  };

  // 1. UID → FCM 토큰 매핑
  const tokenMap: { uid: string; token: string }[] = [];
  const matchedUids = new Set<string>();

  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 10) {
    chunks.push(uids.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    try {
      const snap = await db
        .collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();

      snap.forEach((doc) => {
        matchedUids.add(doc.id);
        const userData = doc.data();
        if (userData.fcm_tokens && Array.isArray(userData.fcm_tokens)) {
          const sanitizedTokens = sanitizeTokens(userData.fcm_tokens);
          if (sanitizedTokens.changed) {
            void doc.ref.update({
              fcm_tokens: sanitizedTokens.tokens,
              last_fcm_update: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          sanitizedTokens.tokens.forEach((t: string) => {
            tokenMap.push({ uid: doc.id, token: t });
          });
        }
      });
    } catch (e: any) {
      console.error('Token fetch error:', e.message);
    }
  }

  if (tokenMap.length === 0) {
    result.no_token_uids = Array.from(new Set(uids));
    result.failure_count = result.no_token_uids.length;
    result.errors = result.no_token_uids.map((uid) => ({
      uid,
      token: '',
      error: matchedUids.has(uid) ? 'messaging/no-fcm-token' : 'messaging/user-not-found',
    }));
    console.log('[sendFcmToUids] No FCM tokens found.');
    return result;
  }

  // 2. 중복 토큰 제거
  const seen = new Set<string>();
  const uniqueTokenMap = tokenMap.filter((t) => {
    if (seen.has(t.token)) return false;
    seen.add(t.token);
    return true;
  });

  // 3. 토큰 청크별 발송 (FCM 최대 500개)
  for (let i = 0; i < uniqueTokenMap.length; i += FCM_TOKEN_CHUNK) {
    const batch = uniqueTokenMap.slice(i, i + FCM_TOKEN_CHUNK);
    const tokens = batch.map((t) => t.token);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: payload.clickAction
        ? { fcmOptions: { link: payload.clickAction } }
        : undefined,
    };

    // click_action을 data에도 추가 (클라이언트 호환)
    if (payload.clickAction) {
      message.data = { ...message.data, click_action: payload.clickAction };
    }

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      result.success_count += response.successCount;
      result.failure_count += response.failureCount;

      // 실패 토큰 분석
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const entry = batch[idx];
          const errCode = resp.error?.code || 'unknown';

          result.errors.push({
            uid: entry.uid,
            token: entry.token,
            error: errCode,
          });

          if (
            REMOVABLE_ERROR_CODES.has(errCode)
          ) {
            result.invalid_tokens.push(entry.token);
          }
        }
      });
    } catch (e: any) {
      console.error('FCM sendEachForMulticast error:', e.message);
      result.failure_count += tokens.length;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 내부 헬퍼: 무효 토큰 정리
// ═══════════════════════════════════════════════════════════════════════════════
async function cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
  if (invalidTokens.length === 0) return;

  try {
    // users 컬렉션에서 해당 토큰을 가진 문서 찾기
    // Firestore array-contains는 단일 값만 가능하므로 토큰별로 처리
    // 성능을 위해 최대 10개만 정리 (나머지는 다음 배치에서)
    const tokensToClean = invalidTokens.slice(0, 10);

    for (const token of tokensToClean) {
      const snap = await db
        .collection('users')
        .where('fcm_tokens', 'array-contains', token)
        .limit(1)
        .get();

      for (const doc of snap.docs) {
        await doc.ref.update({
          fcm_tokens: admin.firestore.FieldValue.arrayRemove(token),
        });
        console.log(`🧹 Removed invalid token from user ${doc.id}`);
      }
    }
  } catch (e: any) {
    console.error('Token cleanup error:', e.message);
  }
}

function sanitizeTokens(rawTokens: unknown[]): { tokens: string[]; changed: boolean } {
  const filtered = rawTokens.filter(
    (t): t is string => typeof t === 'string' && t.length > 0
  );
  const deduped = Array.from(new Set(filtered));
  const trimmed = deduped.slice(-MAX_FCM_TOKENS_PER_USER);
  const changed = trimmed.length !== rawTokens.length || trimmed.some((t, i) => t !== rawTokens[i]);
  return { tokens: trimmed, changed };
}
