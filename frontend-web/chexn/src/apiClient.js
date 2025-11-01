import axios from 'axios';
import auth from './firebaseClient.js';
import { API_URL } from './config.js';

const apiClient = axios.create({
  baseURL: API_URL
});

apiClient.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;

  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default apiClient;

