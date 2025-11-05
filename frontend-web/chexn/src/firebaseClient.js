import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig as FIREBASE_CONFIG } from './config.js';
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

export { app, auth };

