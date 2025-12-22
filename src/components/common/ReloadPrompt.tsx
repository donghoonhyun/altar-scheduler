import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl: string, r: ServiceWorkerRegistration | undefined) {
      console.log(`Service Worker at: ${swUrl}`);
    },
    onRegisterError(error: any) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast('새로운 버전이 출시되었습니다.', {
        description: '최신 기능을 사용하려면 앱을 다시 시작하세요.',
        action: {
          label: '새로고침',
          onClick: () => {
            updateServiceWorker(true);
            setNeedRefresh(false);
          },
        },
        duration: Infinity, // 사용자가 누를 때까지 유지
      });
    }
  }, [needRefresh, updateServiceWorker, setNeedRefresh]);

  return null;
}
