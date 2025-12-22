import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from 'sonner';
import { getAppTitleWithEnv } from './lib/env';
import { isInAppBrowser } from './lib/detectInApp';
import InAppBrowserGuide from './pages/components/InAppBrowserGuide';
import DevFavicon from './components/common/DevFavicon';
import ReloadPrompt from './components/common/ReloadPrompt';

function App() {
  useEffect(() => {
    document.title = getAppTitleWithEnv();
  }, []);

  // 인앱 브라우저 감지 시 안내 페이지 렌더링 (라우팅 진입 전 차단)
  if (isInAppBrowser()) {
    return <InAppBrowserGuide />;
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
