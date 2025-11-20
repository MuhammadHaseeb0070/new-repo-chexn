// Firebase Configuration - All values from environment variables
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

const DEFAULT_LOCAL_API_URL = "http://localhost:5000/api";

const normalizeUrl = (url) => {
  if (!url) {
    return url;
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

const getBrowserDefaultApiUrl = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_API_URL;
  }

  const { origin, hostname } = window.location;
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  if (isLocalHost) {
    return DEFAULT_LOCAL_API_URL;
  }

  return `${normalizeUrl(origin)}/api`;
};

const envApiUrl = import.meta.env?.VITE_API_URL?.trim();
const normalizedEnvApiUrl = normalizeUrl(envApiUrl);

export const API_URL = normalizedEnvApiUrl || getBrowserDefaultApiUrl();

// Stripe Public Key - Must be set in environment variables
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || "";