/**
 * testFunction.ts
 * -----------------------------------------------------
 * Firebase callable functions 통합 테스트 스크립트 (CLI 인자 버전)
 * 사용법:
 *   npx ts-node scripts/testFunction.ts <functionName> [jsonPayload]
 * 예시:
 *   npx ts-node scripts/testFunction.ts copyPrevMonthMassEvents
 *   npx ts-node scripts/testFunction.ts copyPrevMonthMassEvents '{"serverGroupId":"SG00001","currentMonth":"2025-10"}'
 *   npm run test:func copyPrevMonthMassEvents
 *   npm run test:func copyPrevMonthMassEvents '{"serverGroupId":"SG00001","currentMonth":"2025-10"}'
 * -----------------------------------------------------
 */

import { initializeApp } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const args = process.argv.slice(2);
const functionName = args[0];
const rawPayload = args[1] || '{}';

if (!functionName) {
  console.error(
    '❌ 함수명을 입력하세요. 예: npx ts-node scripts/testFunction.ts copyPrevMonthMassEvents'
  );
  process.exit(1);
}

let payload: Record<string, unknown> = {};
try {
  payload = JSON.parse(rawPayload);
} catch (err) {
  console.error('❌ JSON 파싱 오류: payload 형식을 확인하세요.');
  process.exit(1);
}

const app = initializeApp({ projectId: 'altar-scheduler-dev' });
const functions = getFunctions(app, 'asia-northeast3');
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

(async () => {
  console.log(`🚀 Calling function: ${functionName}`);
  console.log(`📦 Payload:`, payload);

  try {
    const fn = httpsCallable(functions, functionName);
    const res = await fn(payload);
    console.log('✅ RESULT:', res.data);
  } catch (err) {
    console.error('❌ ERROR:', err);
  }
})();
