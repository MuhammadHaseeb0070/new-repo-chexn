// In backend/config/firebase.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Get Firebase Admin service account
// Option 1: If FIREBASE_ADMIN_SERVICE_ACCOUNT is set (as JSON string), use it
// Option 2: Otherwise, read from file path (FIREBASE_ADMIN_KEY_PATH or default)
let serviceAccount;

if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
  // Use service account from environment variable (for deployment platforms)
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
  } catch (error) {
    throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT must be valid JSON. Error: ' + error.message);
  }
} else {
  // Use service account from file (for local development)
  const firebaseAdminKeyPath = process.env.FIREBASE_ADMIN_KEY_PATH || 'firebase-admin-key.json';
  
  // Resolve to absolute path
  const absolutePath = path.isAbsolute(firebaseAdminKeyPath) 
    ? firebaseAdminKeyPath 
    : path.resolve(__dirname, '..', firebaseAdminKeyPath);
  
  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Firebase Admin key file not found at: ${absolutePath}. Please check FIREBASE_ADMIN_KEY_PATH environment variable or set FIREBASE_ADMIN_SERVICE_ACCOUNT.`);
  }
  
  // Load service account from the specified path
  serviceAccount = require(absolutePath);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();

console.log('Firebase Admin SDK Initialized');

// Export the initialized admin object and database
module.exports = { admin, db };