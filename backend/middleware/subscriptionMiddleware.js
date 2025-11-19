const { db } = require('../config/firebase');
const { getUsage } = require('../utils/usageTracker');

function resolveLimitView(limitKey, { creator, usage, subscription, billingOwnerId }) {
  const limits = subscription.limits || {};
  const role = (creator.role || '').toLowerCase();
  const orgId = creator.organizationId;
  const creatorId = creator.uid;

  switch (limitKey) {
    case 'children':
      return {
        current: usage.children,
        limit: limits.children
      };
    case 'schools':
      return {
        current: usage.schools,
        limit: limits.schools
      };
    case 'staff': {
      const isManagedSchoolAdmin = role === 'school-admin' && creatorId !== billingOwnerId;
      if (isManagedSchoolAdmin) {
        return {
          current: usage.staffPerSchool[orgId] || 0,
          limit: limits.staffPerSchool
        };
      }
      return {
        current: usage.staff_total,
        limit: limits.staff
      };
    }
    case 'studentsPerStaff':
      return {
        current: usage.studentsPerStaff[creatorId] || 0,
        limit: limits.studentsPerStaff
      };
    case 'employeesPerStaff':
      return {
        current: usage.employeesPerStaff[creatorId] || 0,
        limit: limits.employeesPerStaff
      };
    default:
      return {
        current: usage[`${limitKey}_total`] ?? usage[limitKey],
        limit: limits[limitKey]
      };
  }
}

const checkLimit = (limitKeyToAssert) => {
  return async (req, res, next) => {
    try {
      const creatorId = req.user.uid;
      const creatorDoc = await db.collection('users').doc(creatorId).get();
      if (!creatorDoc.exists) {
        return res.status(404).json({ error: 'User profile not found.' });
      }

      const creator = creatorDoc.data();
      const billingOwnerId = creator.billingOwnerId;
      if (!billingOwnerId) {
        return res.status(500).json({ error: 'User is missing billingOwnerId.' });
      }

      const subscriptionDoc = await db.collection('subscriptions').doc(billingOwnerId).get();
      if (!subscriptionDoc.exists) {
        return res.status(403).json({ error: 'Subscription is not active.' });
      }
      const subscription = subscriptionDoc.data();
      if (!subscription || subscription.status !== 'active') {
        return res.status(403).json({ error: 'Subscription is not active.' });
      }

      const usage = await getUsage(billingOwnerId);
      const view = resolveLimitView(limitKeyToAssert, {
        creator: { ...creator, uid: creatorId },
        usage,
        subscription,
        billingOwnerId
      });

      if (typeof view.limit !== 'number') {
        return res.status(400).json({ error: `No limit defined for '${limitKeyToAssert}' on your plan.` });
      }

      if ((view.current || 0) >= view.limit) {
        return res.status(403).json({ error: 'Limit Reached' });
      }

      req.creator = { ...creator, uid: creatorId };
      req.billingOwnerId = billingOwnerId;
      req.organizationId = creator.organizationId;
      req.subscription = subscription;
      req.usage = usage;

      next();
    } catch (error) {
      console.error('Error in subscriptionMiddleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

module.exports = { checkLimit };
