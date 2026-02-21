import { httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';

const PRIMARY_FN = 'admin_enqueueNotification';
const LEGACY_FN = 'admin_manualSendNotification';

function shouldFallbackToLegacy(error: any): boolean {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'functions/not-found' ||
    message.includes('not found') ||
    message.includes('no function') ||
    message.includes(PRIMARY_FN.toLowerCase())
  );
}

/**
 * 알림 큐 callable 함수 호출 진입점.
 * 함수명 변경/마이그레이션 시 이 파일만 수정하면 전체 화면이 함께 따라옵니다.
 */
export async function callNotificationApi<T = any>(
  functions: Functions,
  payload: Record<string, unknown>
): Promise<T> {
  try {
    const callPrimary = httpsCallable(functions, PRIMARY_FN);
    const result = await callPrimary(payload);
    return result.data as T;
  } catch (error: any) {
    if (!shouldFallbackToLegacy(error)) throw error;
    const callLegacy = httpsCallable(functions, LEGACY_FN);
    const result = await callLegacy(payload);
    return result.data as T;
  }
}

