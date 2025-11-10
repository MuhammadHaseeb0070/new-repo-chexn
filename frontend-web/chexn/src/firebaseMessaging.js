import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebaseClient.js';
import apiClient from './apiClient.js';

// TODO: Paste your VAPID key from Firebase Console > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'BPPzaRvzF_1LllZRdC5u0iEKeTemNACN6E2TfQ3xKUL_TxgoOPbPB_tGWYXP8PwfcNxLztH5Lnafyl5LCqjx4uI';

const messaging = getMessaging(app);

async function fetchAndSendToken() {
  try {
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (currentToken) {
      console.log('FCM token:', currentToken);
      await apiClient.post('/users/save-fcm-token', { token: currentToken });
    } else {
      console.log('No registration token available. Request permission to generate one.');
    }
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
  }
}

export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    if (permission === 'granted') {
      await fetchAndSendToken();
    }
  } catch (error) {
    console.error('Notification permission error:', error);
  }
}

// Listen for foreground messages and handle notification clicks
export function setupForegroundMessageHandler(onNotificationClick) {
  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
    // If this is a scheduled check-in notification, handle it
    if (payload.data?.type === 'scheduled_checkin' && payload.data?.scheduleId) {
      const scheduleId = payload.data.scheduleId;
      
      // Update URL to include scheduleId (this will trigger CheckIn component to load question)
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('scheduleId', scheduleId);
      window.history.pushState({}, '', currentUrl.toString());
      
      // Call the callback if provided (e.g., to scroll to check-in form)
      if (onNotificationClick) {
        onNotificationClick(scheduleId);
      }
      
      // Show a browser notification (optional, since we're already in the app)
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || 'Time to Chex-N!', {
          body: payload.notification?.body || '',
          icon: '/vite.svg'
        });
      }
    }
  });
}


