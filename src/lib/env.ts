// src/lib/env.ts
import packageJson from '../../package.json';

export const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL || window.location.origin;

// 1. App Title from package.json
export const APP_TITLE = packageJson.name
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

// 2. Environment Detection
export const getAppEnvLabel = () => {
  const hostname = window.location.hostname;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';

  // Localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ' (로컬)';
  }

  // Development (based on project ID convention, mode, or HOSTNAME)
  if (
    projectId.includes('-dev') || 
    import.meta.env.MODE === 'development' ||
    hostname.includes('dev') ||     // URL에 'dev'가 포함되면 개발환경으로 간주
    hostname.includes('localhost')
  ) {
    return ' (DEV)';
  }

  // Production (default)
  return '';
};

export const getAppTitleWithEnv = () => {
  return `${APP_TITLE}${getAppEnvLabel()}`;
};

export const getAppIconPath = () => {
  const hostname = window.location.hostname;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
  
  const isDev = 
    projectId.includes('-dev') || 
    import.meta.env.MODE === 'development' ||
    hostname.includes('dev');

  // PNG 아이콘 사용 (브라우저 호환성 및 PWA 일관성)
  return isDev ? '/pwa-icon-dev.png' : '/pwa-icon.png';
};
