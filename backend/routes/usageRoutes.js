const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const { getUsage } = require('../utils/usageTracker');

// Get current usage for logged-in user
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get the logged-in user's billingOwnerId from their Firestore document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userDoc.data() || {};
    const billingOwnerId = user.billingOwnerId;
    
    if (!billingOwnerId) {
      return res.status(403).json({ error: 'No billing owner found' });
    }
    
    // Call getUsage using billingOwnerId
    const usage = await getUsage(billingOwnerId);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching usage:', error);
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
    const role = (user.role || '').toLowerCase();
    const billingOwnerId = user.billingOwnerId;

    if (!billingOwnerId) {
      return res.status(403).json({ error: 'Missing billing owner' });
    }

    const [usage, subscriptionDoc] = await Promise.all([
      getUsage(billingOwnerId),
      db.collection('subscriptions').doc(billingOwnerId).get()
    ]);

    if (!subscriptionDoc.exists) {
      return res.status(403).json({ error: 'Subscription is not active.' });
    }
    const subscription = subscriptionDoc.data() || {};
    const limits = subscription.limits || {};

    const staffRoles = ['teacher', 'counselor', 'social-worker'];
    const employerStaffRoles = ['supervisor', 'hr'];

    if (staffRoles.includes(role)) {
      const current = usage.studentsPerStaff[userId] || 0;
      const limit = limits.studentsPerStaff || 0;
      return res.status(200).json({
        resourceType: 'students',
        perStaff: true,
        current,
        limit,
        remaining: Math.max(limit - current, 0)
      });
    }

    if (employerStaffRoles.includes(role)) {
      const current = usage.employeesPerStaff[userId] || 0;
      const limit = limits.employeesPerStaff || 0;
      return res.status(200).json({
        resourceType: 'employees',
        perStaff: true,
        current,
        limit,
        remaining: Math.max(limit - current, 0)
      });
    }

    if (role === 'school-admin' && userId !== billingOwnerId) {
      const current = usage.staffPerSchool[user.organizationId] || 0;
      const limit = limits.staffPerSchool || 0;
      return res.status(200).json({
        resourceType: 'staff',
        perStaff: false,
        current,
        limit,
        remaining: Math.max(limit - current, 0)
      });
    }

    return res.status(200).json(null);
  } catch (error) {
    console.error('Error fetching my-quota:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

