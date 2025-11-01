// In backend/config/firebase.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// We use require() here because the path is relative and it's a JSON file
// Note: We go '../' to go UP from /config to /backend
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();

console.log('Firebase Admin SDK Initialized');

// Export the initialized admin object and database
module.exports = { admin, db };