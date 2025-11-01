// In backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// --- Import our new files ---
// Initialize Firebase Admin (this line is important!)
const { admin } = require('./config/firebase');
// Import our auth middleware
const authMiddleware = require('./middleware/authMiddleware');
// Import user routes
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api/users', userRoutes);

// 1. Public Test Route (from Chunk 1)
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the ChexN Backend!' });
});

// 2. NEW Secure Test Route
// Notice we add "authMiddleware" before the (req, res) handler.
// This means authMiddleware will run FIRST.
app.get('/api/test-secure', authMiddleware, (req, res) => {
  // If we get here, it means the token was valid!
  // We can safely access req.user which we set in the middleware.
  res.json({ 
    message: 'Success! You have accessed a secure route.',
    userEmail: req.user.email,
    userId: req.user.uid 
  });
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});