const { db } = require('../config/firebase');
const { getUsage } = require('../utils/usageTracker');

/**
 * This is a middleware factory.
 * 
 * You call it with the limit key you want to check (e.g., 'children', 'staff', 'students').
 */
const checkLimit = (limitKeyToAssert) => {
  return async (req, res, next) => {
    try {
      const creatorId = req.user.uid;

      // 1. Get the person making the request
      const creatorDoc = await db.collection('users').doc(creatorId).get();
      if (!creatorDoc.exists) {
        return res.status(404).json({ error: 'User profile not found.' });
      }

      const creator = creatorDoc.data();
      const { role, billingOwnerId, organizationId } = creator;

      if (!billingOwnerId) {
        return res.status(500).json({ error: 'User is missing billingOwnerId.' });
      }

      // 2. Get the subscription of the billing owner
      const subDoc = await db.collection('subscriptions').doc(billingOwnerId).get();
      if (!subDoc.exists || subDoc.data().status !== 'active') {
        return res.status(403).json({ error: 'Subscription is not active.' });
      }

      const { limits } = subDoc.data();

      // 3. Get the current usage for this billing owner
      const usage = await getUsage(billingOwnerId);

      // 4. Determine the correct limit based on the creator's role
      let actualLimit = 0;

      // Define managed school roles that are part of a District plan
      const managedSchoolRoles = ['school-admin', 'teacher', 'counselor', 'social-worker'];

      // This is the special case for Group 3 (District)
      if (managedSchoolRoles.includes(role) && creatorId !== billingOwnerId) {
        // This is a "Managed" user under a District plan
        switch (limitKeyToAssert) {
          case 'staff':
            actualLimit = limits.staffPerSchool;
            break;
          case 'students':
            actualLimit = limits.studentsPerStaff;
            break;
          default:
            // This case handles 'schools', 'employees', etc. which this user can't create.
            // We let it fall through to the 'undefined' check, which is correct.
            break;
        }
      } else {
        // This is a "Standalone" Admin (Group 2) or any other top-level role
        // They check their own plan's limits directly.
        actualLimit = limits[limitKeyToAssert];
      }

      if (typeof actualLimit === 'undefined') {
        return res.status(400).json({ error: `No limit defined for '${limitKeyToAssert}' on your plan.` });
      }

      // 5. Check the usage against the correct limit
      const currentUsage = usage[limitKeyToAssert] || 0;
      if (currentUsage >= actualLimit) {
        return res.status(403).json({ error: 'Limit Reached' });
      }

      // All checks passed!
      // Attach useful info to the request for the next handler
      req.creator = creator;
      req.billingOwnerId = billingOwnerId;
      req.organizationId = organizationId;

      next();
    } catch (error) {
      console.error('Error in subscriptionMiddleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

module.exports = { checkLimit };
