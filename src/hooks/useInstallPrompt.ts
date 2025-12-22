import { useState, useEffect } from 'react';

// BeforeInstallPromptEvent 인터페이스 정의
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// React 컴포넌트 렌더링 전에 이벤트를 잡기 위한 전역 변수
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

// 모듈이 로드되자마자 리스너 등록 (가장 빠른 시점)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    // 이벤트가 발생했다는 것을 알리기 위한 커스텀 이벤트 디스패치 (선택적)
  });
}

export function useInstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(!!globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. 이미 설치되었는지 확인
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // 2. 이벤트 핸들러 (이미 전역 변수에 있으면 상태 업데이트)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    // 훅이 마운트될 때 이미 이벤트가 발생했었다면 상태 동기화
    if (globalDeferredPrompt) {
      setIsInstallable(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', checkInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', checkInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!globalDeferredPrompt) {
        // 혹시라도 없으면 한번 더 알림
        alert('설치 가능한 상태가 아닙니다. 주소창의 아이콘을 확인해주세요.');
        return;
    }

    await globalDeferredPrompt.prompt();

    const { outcome } = await globalDeferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    globalDeferredPrompt = null;
    setIsInstallable(false);
  };

  return { isInstallable, isInstalled, promptInstall };
}
