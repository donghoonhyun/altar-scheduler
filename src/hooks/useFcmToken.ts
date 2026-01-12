import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { doc, getFirestore, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useSession } from '@/state/session';
import { firebaseConfig } from '@/config/firebaseConfig';

export function useFcmToken() {
  const { user, userInfo } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const handleTokenUpdate = useCallback(async (enable: boolean) => {
      if (!user) return;
      // Don't request permission if profile is incomplete (avoids conflict with Profile Dialog)
      if (!userInfo?.userName) return;
      
      if (!('Notification' in window)) return;

      try {
          const perm = await Notification.requestPermission();
          setPermission(perm);

          if (perm === 'granted') {
              const messaging = getMessaging();
              // 1. SW Config
              const swUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
              swUrl.searchParams.append('apiKey', firebaseConfig.apiKey);
              swUrl.searchParams.append('authDomain', firebaseConfig.authDomain);
              swUrl.searchParams.append('projectId', firebaseConfig.projectId);
              swUrl.searchParams.append('storageBucket', firebaseConfig.storageBucket);
              swUrl.searchParams.append('messagingSenderId', firebaseConfig.messagingSenderId);
              swUrl.searchParams.append('appId', firebaseConfig.appId);

              // 2. Register SW
              const registration = await navigator.serviceWorker.register(swUrl.href, {
                  scope: '/firebase-cloud-messaging-push-scope',
              });

              // 3. Get Token
              const currentToken = await getToken(messaging, {
                  serviceWorkerRegistration: registration,
              });

              if (currentToken) {
                  setToken(currentToken);
                  const db = getFirestore();
                  const userRef = doc(db, 'users', user.uid);

                  if (enable) {
                      await setDoc(userRef, {
                          fcm_tokens: arrayUnion(currentToken),
                          last_fcm_update: new Date()
                      }, { merge: true });
                      console.log('✅ FCM Token saved:', currentToken);
                  } else {
                      await setDoc(userRef, {
                          fcm_tokens: arrayRemove(currentToken),
                          last_fcm_update: new Date()
                      }, { merge: true });
                      console.log('🚫 FCM Token removed:', currentToken);
                  }
              }
          }
      } catch (err) {
          console.error('FCM Token Error:', err);
      }
  }, [user, userInfo]);

  // Initial Load
  useEffect(() => {
    const pref = localStorage.getItem('altar_notification_enabled');
    // If explicitly disabled ('false'), do not register automatically.
    // If null (default) or 'true', proceed.
    if (pref === 'false') {
        // Just check permission status without requesting/saving
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
        return;
    }

    handleTokenUpdate(true);
  }, [handleTokenUpdate]);

  const toggleNotification = async (enable: boolean) => {
      localStorage.setItem('altar_notification_enabled', enable ? 'true' : 'false');
      await handleTokenUpdate(enable);
  };

  return { token, permission, toggleNotification };
}
