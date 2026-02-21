import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './lib/firebase';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from 'sonner';
import { getAppTitleWithEnv } from './lib/env';
import { isInAppBrowser } from './lib/detectInApp';
import InAppBrowserGuide from './pages/components/InAppBrowserGuide';
import DevFavicon from './components/common/DevFavicon';
import ReloadPrompt from './components/common/ReloadPrompt';
import LoadingSpinner from './components/common/LoadingSpinner';

const ORDO_LOGIN_URL = 'https://ordo.web.app/login';

function App() {
  const [isSSOChecking, setIsSSOChecking] = useState(false);

  useEffect(() => {
    document.title = getAppTitleWithEnv();

    const params = new URLSearchParams(window.location.search);

    // 1. Theme Sync (PRD 3.3)
    const themeParam = params.get('theme');
    if (themeParam === 'dark' || themeParam === 'light') {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(themeParam);
      localStorage.setItem('theme', themeParam);
    } else {
      // Fallback: Check storage or system preference
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme) {
        window.document.documentElement.classList.add(storedTheme);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        window.document.documentElement.classList.add('dark');
      }
    }

    // 2. SSO Token Check
    const token = params.get('authtoken');

    // Prevent double-processing in Strict Mode
    if (token && !(window as any).__sso_processed) {
      (window as any).__sso_processed = true;
      setIsSSOChecking(true);
      
      signInWithCustomToken(auth, token)
        .then(() => {
          console.log('✅ SSO Login Success');
          // URL 정리 (토큰 제거) - replaceState 사용으로 새로고침 방지
          const url = new URL(window.location.href);
          url.searchParams.delete('authtoken');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        })
        .catch((err) => {
          console.error('❌ SSO Login Failed:', err);
          // 토큰이 있지만 실패한 경우, 이미 로그인된 세션이 있다면 무시
          if (!auth.currentUser) {
            window.location.href = ORDO_LOGIN_URL;
          } else {
             // 이미 로그인된 정보가 있으면 URL만 정리
             const url = new URL(window.location.href);
             url.searchParams.delete('authtoken');
             window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          }
        })
        .finally(() => {
          setIsSSOChecking(false);
        });
    }
  }, []);

  useEffect(() => {
    // 개발환경에서는 vite pwa dev-sw/workbox 캐시를 정리해 최신 번들을 강제 사용
    if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        const swUrl = registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || '';
        if (swUrl.includes('dev-sw') || swUrl.includes('workbox')) {
          registration.unregister().catch(() => {});
        }
      });
    });
  }, []);

  // 인앱 브라우저 감지 시 안내 페이지 렌더링 (라우팅 진입 전 차단)
  if (isInAppBrowser()) {
    return <InAppBrowserGuide />;
  }

  if (isSSOChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <LoadingSpinner label="Ordo 계정으로 로그인 중..." size="lg" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <DevFavicon />
      <ReloadPrompt />
      <Toaster richColors position="top-right" />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
