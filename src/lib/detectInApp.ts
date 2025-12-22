export const isInAppBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent.toLowerCase();

  // 주요 인앱 브라우저 식별자
  const inAppSignatures = [
    'kakaotalk',  // 카카오톡
    'line',       // 라인
    'instagram',  // 인스타그램
    'facebook',   // 페이스북
    'twitter',    // 트위터
    'everytimeapp', // 에브리타임
    'daumapps',   // 다음앱
    'naver(inapp', // 네이버앱 (필요시 제외 가능하나, 로그인 등 이슈 방지 위해 포함 권장)
  ];

  return inAppSignatures.some((signature) => ua.includes(signature));
};
