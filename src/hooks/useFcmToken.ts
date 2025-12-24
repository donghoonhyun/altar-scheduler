import { useEffect, useState } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { doc, getFirestore, setDoc, arrayUnion } from 'firebase/firestore';
import { useSession } from '@/state/session';

import { firebaseConfig } from '@/config/firebaseConfig';

export function useFcmToken() {
  const { user } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (!user) return;

    // 브라우저 알림 지원 확인
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }

    const requestPermission = async () => {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm === 'granted') {
          const messaging = getMessaging();

          // 1. SW에 Config 전달하기 위해 URL 파라미터 생성
          const swUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
          swUrl.searchParams.append('apiKey', firebaseConfig.apiKey);
          swUrl.searchParams.append('authDomain', firebaseConfig.authDomain);
          swUrl.searchParams.append('projectId', firebaseConfig.projectId);
          swUrl.searchParams.append('storageBucket', firebaseConfig.storageBucket);
          swUrl.searchParams.append('messagingSenderId', firebaseConfig.messagingSenderId);
          swUrl.searchParams.append('appId', firebaseConfig.appId);

          // 2. 명시적으로 Service Worker 등록 (Scope 지정으로 PWA SW 충돌 방지)
          const registration = await navigator.serviceWorker.register(swUrl.href, {
            scope: '/firebase-cloud-messaging-push-scope',
          });

          // 3. 등록된 SW를 사용하여 토큰 발급
          const currentToken = await getToken(messaging, {
            serviceWorkerRegistration: registration,
          });
          
          if (currentToken) {
            setToken(currentToken);
            
            // Firestore에 토큰 저장 (배열에 추가)
            const db = getFirestore();
            const userRef = doc(db, 'users', user.uid);
            
            await setDoc(userRef, {
                fcm_tokens: arrayUnion(currentToken),
                last_fcm_update: new Date()
            }, { merge: true });
            
            console.log('✅ FCM Token refreshed & saved:', currentToken);
          } else {
            console.log('No registration token available.');
          }
        } else {
          console.log('Permission not granted for Notification');
        }
      } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
      }
    };

    requestPermission();
  }, [user]);

  return { token, permission };
}
