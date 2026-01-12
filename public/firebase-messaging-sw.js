importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// 💡 URL Query String으로 전달된 설정값을 사용 (보안/환경변수 지원)
const params = new URLSearchParams(self.location.search);

const firebaseConfig = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId')
};

// Config 값이 제대로 넘어왔을 때만 초기화
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        firebase.initializeApp(firebaseConfig);
        const messaging = firebase.messaging();

        messaging.onBackgroundMessage((payload) => {
            console.log('[firebase-messaging-sw.js] Received background message ', payload);

            // Prioritize data payload, fallback to notification payload
            const notificationTitle = payload.data?.title || payload.notification?.title || '알림';
            const notificationBody = payload.data?.body || payload.notification?.body || '';
            const notificationIcon = payload.data?.icon || '/pwa-icon.png';

            const notificationOptions = {
                body: notificationBody,
                icon: notificationIcon,
                data: payload.data,
                // Add actions or other PWA specific options here if needed
            };

            return self.registration.showNotification(notificationTitle, notificationOptions);
        });
        console.log('[SW] Firebase Messaging Initialized with dynamic config');
    } catch (e) {
        console.error('[SW] Init fail:', e);
    }
} else {
    // Config가 없으면 (일반적인 경우 아님, 그러나 에러 방지용)
    // console.log('[SW] No config params found. Waiting for registration with params.');
}
