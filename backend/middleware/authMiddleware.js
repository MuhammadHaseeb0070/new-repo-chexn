// In backend/middleware/authMiddleware.js
const { admin } = require('../config/firebase');

// Simple token cache (5 minute TTL)
const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
    // Check cache first
    const cached = tokenCache.get(idToken);
    if (cached && Date.now() < cached.expiresAt) {
      req.user = cached.decodedToken;
      return next();
    }

    // Verify the token using Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Cache the verified token
    tokenCache.set(idToken, {
      decodedToken,
      expiresAt: Date.now() + CACHE_TTL
    });

    // Clean old cache entries periodically (simple cleanup)
    if (tokenCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of tokenCache.entries()) {
        if (now >= value.expiresAt) {
          tokenCache.delete(key);
        }
      }
    }

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