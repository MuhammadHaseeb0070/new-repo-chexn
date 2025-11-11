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

// Response interceptor: on 401 or id-token-expired, refresh token once and retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.error || error?.response?.data?.message || '';
    const originalRequest = error.config;

    // Avoid infinite loops by marking retried requests
    if (status === 401 || message.includes('id-token-expired')) {
      if (!originalRequest || originalRequest._retry) {
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          return Promise.reject(error);
        }
        // Force refresh token and update cache
        const freshToken = await currentUser.getIdToken(true);
        cachedToken = freshToken;
        cachedUid = currentUser.uid;
        tokenExpiresAt = Date.now() + 55 * 60 * 1000;
        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

