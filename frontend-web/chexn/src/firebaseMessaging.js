import { getMessaging, getToken } from 'firebase/messaging';
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


