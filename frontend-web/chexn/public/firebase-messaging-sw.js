importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Copy of firebaseConfig from src/config.js
const firebaseConfig = {
  apiKey: "AIzaSyDtPa6Fk4m_2WxLyKBBEulC02bHYLRDJR8",
  authDomain: "chexn-9745b.firebaseapp.com",
  projectId: "chexn-9745b",
  storageBucket: "chexn-9745b.firebasestorage.app",
  messagingSenderId: "75693882893",
  appId: "1:75693882893:web:21e9513cc2b85555a09f44",
  measurementId: "G-7DT1E0KS4F",
};

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


