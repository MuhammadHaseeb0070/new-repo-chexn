import axios from 'axios';
import { auth } from './firebaseClient.js';
import { API_URL } from './config.js';

const apiClient = axios.create({
  baseURL: API_URL
});

// Simple token cache to avoid awaiting getIdToken() on every request
let cachedToken = null;
let tokenExpiresAt = 0; // epoch ms
let cachedUid = null;

apiClient.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;

  if (currentUser) {
    const now = Date.now();
    const userChanged = cachedUid && cachedUid !== currentUser.uid;
    // Refresh token when expired or when a different user logs in
    if (!cachedToken || now >= tokenExpiresAt || userChanged) {
      // Force refresh if the Firebase user changed to avoid stale token reuse
      const forceRefresh = userChanged;
      const token = await currentUser.getIdToken(forceRefresh);
      cachedToken = token;
      cachedUid = currentUser.uid;
      // Firebase tokens typically expire in ~1 hour; set a 5 minute refresh window
      tokenExpiresAt = now + 55 * 60 * 1000;
    }
    config.headers.Authorization = `Bearer ${cachedToken}`;
  } else {
    // Clear cache when there is no authenticated user
    cachedToken = null;
    cachedUid = null;
    tokenExpiresAt = 0;
  }

  return config;
});

export default apiClient;

