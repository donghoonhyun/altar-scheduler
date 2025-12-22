import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function InAppBrowserGuide() {
  const [copied, setCopied] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('URL 복사 실패', err);
      // fallback: prompt
      prompt('URL을 복사해서 브라우저 주소창에 붙여넣으세요:', currentUrl);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full space-y-6">
        <div className="mx-auto w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
          Altar Scheduler
        </h3>

        <h1 className="text-lg font-bold text-gray-900">
          외부 브라우저를 이용해주세요
        </h1>

        <p className="text-gray-600 text-xs leading-relaxed">
          카카오톡 등 인앱 브라우저에서는 <br />
          로그인 및 파일 다운로드 기능이 <br />
          원활하지 않을 수 있습니다.
        </p>

        <div className="bg-blue-50 p-4 rounded-lg text-left text-sm text-blue-800 space-y-2">
          <p className="font-semibold">💡 해결 방법</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              우측 상단 또는 하단의 <strong>[...]</strong> 또는 <strong>공유</strong> 버튼 클릭
            </li>
            <li>
              <strong>[다른 브라우저로 열기]</strong> 또는 <br />
              <strong>[Safari / Chrome(으)로 열기]</strong> 선택
            </li>
          </ul>
        </div>

        <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">또는 URL을 복사해서 직접 주소창에 붙여넣으세요.</p>
            <Button 
                onClick={handleCopyUrl} 
                className="w-full bg-gray-900 text-white hover:bg-gray-800 text-xs py-2"
            >
                {copied ? '복사되었습니다! ✅' : '현재 주소 복사하기'}
            </Button>
        </div>
      </div>
    </div>
  );
}
