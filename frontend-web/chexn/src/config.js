export const firebaseConfig = {
  apiKey: "AIzaSyDtPa6Fk4m_2WxLyKBBEulC02bHYLRDJR8",
  authDomain: "chexn-9745b.firebaseapp.com",
  projectId: "chexn-9745b",
  storageBucket: "chexn-9745b.firebasestorage.app",
  messagingSenderId: "75693882893",
  appId: "1:75693882893:web:21e9513cc2b85555a09f44",
  measurementId: "G-7DT1E0KS4F",
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

export const STRIPE_PUBLIC_KEY = "YOUR_PK_TEST_KEY_HERE";