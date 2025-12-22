import { useEffect } from 'react';

// 개발 모드일 때만 Favicon을 교체하는 컴포넌트
export default function DevFavicon() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = '/pwa-icon-dev.png';
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = '/pwa-icon-dev.png';
        document.head.appendChild(newLink);
      }
      
      document.title = `[DEV] ${document.title}`;
    }
  }, []);

  return null;
}
