import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from 'sonner';
import { getAppTitleWithEnv } from './lib/env';

function App() {
  useEffect(() => {
    document.title = getAppTitleWithEnv();
  }, []);

  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
