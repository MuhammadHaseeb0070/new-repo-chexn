import axios from 'axios';
import { auth } from './firebaseClient.js';
import { API_URL } from './config.js';

const apiClient = axios.create({
  baseURL: API_URL
});

// Simple token cache to avoid awaiting getIdToken() on every request
let cachedToken = null;
let tokenExpiresAt = 0; // epoch ms

apiClient.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;

  if (currentUser) {
    const now = Date.now();
    if (!cachedToken || now >= tokenExpiresAt) {
      // getIdToken(true) forces refresh; here we use default cached
      const token = await currentUser.getIdToken();
      cachedToken = token;
      // Firebase tokens typically expire in ~1 hour; set a 5 minute refresh window
      tokenExpiresAt = now + 55 * 60 * 1000;
    }
    config.headers.Authorization = `Bearer ${cachedToken}`;
  }

  return config;
});

export default apiClient;

