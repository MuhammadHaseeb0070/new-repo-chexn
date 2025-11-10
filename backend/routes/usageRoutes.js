const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const { getUsage, refreshUsage } = require('../utils/usageTracker');

// Get current usage for logged-in user
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const usage = await getUsage(userId);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh usage (recalculate from database)
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const usage = await refreshUsage(userId);
    res.json(usage);
  } catch (error) {
    console.error('Error refreshing usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

