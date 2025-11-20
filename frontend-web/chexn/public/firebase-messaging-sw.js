importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Firebase config - will be set by main app via postMessage
// Default fallback values (these should match your .env values)
let firebaseConfig = {
  "apiKey": "",
  "authDomain": "",
  "projectId": "",
  "storageBucket": "",
  "messagingSenderId": "",
  "appId": "",
  "measurementId": ""
};

// Listen for config from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG' && event.data.config) {
    firebaseConfig = event.data.config;
    // Re-initialize Firebase with new config if needed
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
  }
});

// Initialize Firebase immediately with default config
// The config will be updated via message from main app if different
firebase.initializeApp(firebaseConfig);

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'New notification';
  const notificationBody = payload.notification?.body || '';
  const scheduleId = payload.data?.scheduleId;
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/vite.svg',
    data: {
      scheduleId: scheduleId,
      url: scheduleId ? `/?scheduleId=${scheduleId}` : '/'
    }
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const scheduleId = event.notification.data?.scheduleId;
  let url = '/';
  
  if (scheduleId) {
    url = `/?scheduleId=${scheduleId}`;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Focus existing window and send message to update URL
          client.focus();
          // Post message to update URL (app will handle this)
          client.postMessage({ type: 'notificationClick', scheduleId: scheduleId });
          return;
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});


