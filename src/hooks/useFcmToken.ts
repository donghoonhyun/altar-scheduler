import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
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
                      if (import.meta.env.DEV) {
                          console.log('✅ FCM Token saved:', currentToken);
                      }
                  } else {
                      await setDoc(userRef, {
                          fcm_tokens: arrayRemove(currentToken),
                          last_fcm_update: new Date()
                      }, { merge: true });
                      if (import.meta.env.DEV) {
                          console.log('🚫 FCM Token removed:', currentToken);
                      }
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

  // Foreground Notification Handler
  useEffect(() => {
    if (permission !== 'granted') return;
    
    try {
        const messaging = getMessaging();
        const unsubscribe = onMessage(messaging, (payload) => {
            if (import.meta.env.DEV) {
                console.log('Foreground Message:', payload);
            }
            const { title, body } = payload.notification || {};
            if (title) {
                // Show in-app toast
                // Using dynamic import or a simple alert if toast is not available in hook context
                // But assuming 'sonner' is globally available or passed
                // For this hook, it's safe to assume we can just use the standard browser Notification if user permits,
                // OR better, dispatch a custom event or use the toast library if available in this scope.
                // Let's use the browser Notification API as a fallback or a custom UI.
                
                // Ideally, we import toast from 'sonner' at the top.
                // Since this file already imports hooks, let's assume we can import toast.
                
                // Dispatching a CustomEvent so the main App or UI can listen if needed,
                // BUT for now, let's try to show a System Notification even in foreground if possible (rarely works)
                // OR just log it.
                // Wait, the user wants to SEE it.
                
                new Notification(title, {
                    body: body,
                    icon: '/pwa-icon.png'
                });
            }
        });
        return () => unsubscribe();
    } catch (e) {
        console.error('Foreground init error', e);
    }
  }, [permission]);

  return { token, permission, toggleNotification };
}

// ⚠️ Add this to imports at the top:
// import { getMessaging, getToken, onMessage } from 'firebase/messaging';
