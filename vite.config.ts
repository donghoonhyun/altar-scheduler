// vite.config.ts
import { defineConfig } from 'vite';
// Force reload
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
// https://vite.dev/config/
// https://vite.dev/config/
import { VitePWA } from 'vite-plugin-pwa';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  // process.env를 우선 확인 (cross-env로 주입된 값)
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '';
  const isDevProject = projectId.includes('-dev');
  // PNG 파일명 결정 (SVG가 아니라 PNG를 사용)
  const pwaIconName = isDevProject || mode === 'development' ? 'pwa-icon-dev.png' : 'pwa-icon.png';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        devOptions: {
          enabled: true, // 개발 모드에서도 PWA 활성화
          suppressWarnings: true,
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          name: isDevProject ? 'Altar Scheduler (DEV)' : 'Altar Scheduler',
          short_name: isDevProject ? '복사(DEV)' : '복사스케줄러',
          description: '성당 복사단을 위한 스마트 스케줄링 도우미',
          theme_color: '#ffffff',
          background_color: '#ffffff', // 필수 항목 추가
          display: 'standalone',       // 필수 항목 추가
          start_url: '/',              // 필수 항목 추가
          icons: [
            {
              src: pwaIconName,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: pwaIconName,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: pwaIconName,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: pwaIconName,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1', // ✅ 명시적 바인딩
      port: 5173,
    },
  };
});
