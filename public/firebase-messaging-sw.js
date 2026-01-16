// v=1.1 Force Update
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

self.addEventListener('install', function (event) {
    console.log('[SW] Service Worker Installing & Skipping Waiting...');
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    console.log('[SW] Service Worker Activating & Claiming Clients...');
    event.waitUntil(clients.claim());
});

// 💡 URL Query String으로 전달된 설정값을 사용
const params = new URLSearchParams(self.location.search);

const firebaseConfig = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId')
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        firebase.initializeApp(firebaseConfig);
        const messaging = firebase.messaging();

        // 💡 Revert to Native Browser Handling
        // By NOT calling showNotification here, we let the browser handle the 'notification' payload in the FCM message.
        // This is the most reliable way for PC Chrome.
        messaging.onBackgroundMessage((payload) => {
            console.log('[firebase-messaging-sw.js] Background message received:', payload);
        });

        console.log('[SW] Firebase Messaging Initialized');
    } catch (e) {
        console.error('[SW] Init fail:', e);
    }
}

// 🔔 Notification Click Event Handler
self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification click received.');
    event.notification.close(); // Close the notification

    // Retrieve URL from notification data or default to root
    // payload.data.url or payload.data.link or default '/'
    const urlToOpen = event.notification.data?.url || event.notification.data?.link || '/';

    // This looks for a window with the same URL and focuses it, or opens a new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // Check if the client matches the origin and is focusable
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    // Optionally: Check if the client is already on the specific URL, or just focus and navigate
                    // For SPA, focusing is often enough if we handle routing via message, 
                    // but simple navigation is safer for "opening" the app.
                    return client.focus().then(focusedClient => {
                        // If we want to force navigation to the specific URL:
                        if (focusedClient && focusedClient.navigate) {
                            return focusedClient.navigate(urlToOpen);
                        }
                        return focusedClient;
                    });
                }
            }
            // If no window is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
