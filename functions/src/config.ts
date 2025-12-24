/**
 * Firebase Cloud Functions Configuration
 * 
 * Functions의 리전, 런타임 옵션 등을 관리합니다.
 */

// v1 (functions.region('...')) 용
export const REGION_V1 = 'asia-northeast3';

export const RUNTIME_OPTIONS_V1 = {
  timeoutSeconds: 60,
  memory: '256MB' as const 
};

// v2 (onCall({ region: '...' })) 용
export const REGION_V2 = 'asia-northeast3';

export const COMMON_OPTIONS_V2 = {
  region: REGION_V2,
  maxInstances: 10,
};
