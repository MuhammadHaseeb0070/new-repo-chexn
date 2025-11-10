// Subscription middleware to check if user has active subscription
// and hasn't reached limits

const { db } = require('../config/firebase');
const { checkLimit } = require('../utils/usageTracker');

/**
 * Middleware to check if user has active subscription
 */
async function requireSubscription(req, res, next) {
  try {
    const userId = req.user.uid;
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    
    if (!subscriptionDoc.exists) {
      return res.status(403).json({ 
        error: 'Subscription required',
        message: 'You need an active subscription to perform this action.'
      });
    }
    
    const subscription = subscriptionDoc.data();
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return res.status(403).json({ 
        error: 'Subscription not active',
        message: 'Your subscription is not active. Please renew your subscription.',
        status: subscription.status
      });
    }
    
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware to check if user can create a resource (hasn't reached limit)
 */
function checkResourceLimit(resourceType) {
  return async (req, res, next) => {
    try {
      const userId = req.user.uid;
      const limitCheck = await checkLimit(userId, resourceType, 1);
      
      if (!limitCheck.allowed) {
        return res.status(403).json({
          error: 'Limit exceeded',
          message: limitCheck.reason || 'You have reached your plan limit.',
          current: limitCheck.current,
          limit: limitCheck.limit,
          requested: limitCheck.requested
        });
      }
      
      req.limitCheck = limitCheck;
      next();
    } catch (error) {
      console.error('Error checking resource limit:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = {
  requireSubscription,
  checkResourceLimit
};

