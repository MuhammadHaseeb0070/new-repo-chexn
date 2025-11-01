// In backend/middleware/authMiddleware.js
const { admin } = require('../config/firebase');

const authMiddleware = async (req, res, next) => {
  // Get the Authorization header
  const authHeader = req.headers.authorization;

  // Check if it exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided or invalid format' });
  }

  // Extract the token
  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verify the token using Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Token is valid!
    // Attach the decoded user info to the request object
    req.user = decodedToken;

    // Move on to the next function (the actual route handler)
    next();
  } catch (error) {
    // Token is invalid (expired, wrong signature, etc.)
    console.error('Error verifying token:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;