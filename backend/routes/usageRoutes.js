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

// Additional per-user quota endpoint
router.get('/my-quota', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userDoc.data() || {};
    const role = user.role;

    if (role === 'teacher' || role === 'counselor' || role === 'social-worker') {
      const adminId = user.creatorId;
      if (!adminId) {
        return res.status(200).json({ resourceType: 'student', perStaff: true, current: 0, limit: 0, remaining: 0 });
      }
      const subscriptionDoc = await db.collection('subscriptions').doc(adminId).get();
      if (!subscriptionDoc.exists) {
        return res.status(200).json({ resourceType: 'student', perStaff: true, current: 0, limit: 0, remaining: 0 });
      }
      const limits = subscriptionDoc.data().limits || {};
      const limit = limits.studentsPerStaff || 0;
      const adminUsageDoc = await db.collection('usage').doc(adminId).get();
      const adminUsage = (adminUsageDoc.exists && adminUsageDoc.data().usage) || {};
      const entry = adminUsage.studentsByStaff && adminUsage.studentsByStaff[userId];
      const current = entry && typeof entry === 'object' ? (entry.count || 0) : (entry || 0);
      const remaining = Math.max(limit - current, 0);
      return res.status(200).json({ resourceType: 'student', perStaff: true, current, limit, remaining });
    }

    if (role === 'supervisor' || role === 'hr') {
      const adminId = user.creatorId;
      if (!adminId) {
        return res.status(200).json({ resourceType: 'employee', perStaff: true, current: 0, limit: 0, remaining: 0 });
      }
      const subscriptionDoc = await db.collection('subscriptions').doc(adminId).get();
      if (!subscriptionDoc.exists) {
        return res.status(200).json({ resourceType: 'employee', perStaff: true, current: 0, limit: 0, remaining: 0 });
      }
      const limits = subscriptionDoc.data().limits || {};
      const limit = limits.employeesPerStaff || 0;
      const adminUsageDoc = await db.collection('usage').doc(adminId).get();
      const adminUsage = (adminUsageDoc.exists && adminUsageDoc.data().usage) || {};
      const entry = adminUsage.employeesByStaff && adminUsage.employeesByStaff[userId];
      const current = entry && typeof entry === 'object' ? (entry.count || 0) : (entry || 0);
      const remaining = Math.max(limit - current, 0);
      return res.status(200).json({ resourceType: 'employee', perStaff: true, current, limit, remaining });
    }

    return res.status(200).json(null);
  } catch (error) {
    console.error('Error fetching my-quota:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

