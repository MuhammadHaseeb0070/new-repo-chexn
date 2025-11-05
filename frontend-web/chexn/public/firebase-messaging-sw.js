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

// Optional: handle background messages
messaging.onBackgroundMessage((payload) => {
  // Customize notification here if desired
  const notificationTitle = payload.notification?.title || 'New notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/vite.svg'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});


