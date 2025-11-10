const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const packages = require('../config/packages');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Get available packages for a role
router.get('/packages/:role', authMiddleware, (req, res) => {
  try {
    const { role } = req.params;
    // Map frontend role to backend role
    const backendRole = packages.mapRoleToBackend(role);
    const rolePackages = packages.getPackagesForRole(backendRole);
    
    if (rolePackages.length === 0) {
      return res.status(404).json({ error: 'No packages found for this role' });
    }
    
    res.json(rolePackages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's subscription
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    
    if (!subscriptionDoc.exists) {
      return res.status(200).json(null);
    }
    
    const subscription = subscriptionDoc.data();
    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Stripe checkout session
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { role, packageId } = req.body;
    
    if (!role || !packageId) {
      return res.status(400).json({ error: 'Missing role or packageId' });
    }
    
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const backendRole = packages.mapRoleToBackend(role);
    const pkg = packages.getPackage(backendRole, packageId);
    
    // Get or create Stripe customer
    let customerId = userData.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: {
          userId: userId,
          role: userData.role
        }
      });
      customerId = customer.id;
      
      // Save customer ID to user
      await db.collection('users').doc(userId).update({
        stripeCustomerId: customerId
      });
    }
    
    // Create checkout session
    // For testing, we'll create the price on the fly if it doesn't exist
    // In production, prices should be created in Stripe Dashboard
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: pkg.currency,
          product_data: {
            name: pkg.name,
          },
          recurring: {
            interval: pkg.billingInterval === 'year' ? 'year' : 'month',
          },
          unit_amount: Math.round(pkg.price * 100), // Convert to cents
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription/cancel`,
      metadata: {
        userId: userId,
        role: backendRole,
        packageId: packageId
      }
    });
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Stripe customer portal session
router.post('/create-portal-session', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const customerId = userData.stripeCustomerId;
    
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook route is handled in server.js to ensure raw body parsing
// Webhook handler functions (kept for reference, but webhook is handled in server.js)
async function handleCheckoutCompleted(session) {
  try {
    const userId = session.metadata.userId;
    const role = session.metadata.role;
    const packageId = session.metadata.packageId;
    
    if (!userId || !role || !packageId) {
      console.error('Missing metadata in checkout session');
      return;
    }
    
    // Get subscription from Stripe
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      console.error('No subscription ID in session');
      return;
    }
    
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const pkg = packages.getPackage(role, packageId);
    
    // Save subscription to database
    await db.collection('subscriptions').doc(userId).set({
      userId,
      role,
      packageId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
      limits: pkg.limits,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`Subscription created for user ${userId}`);
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

async function handleSubscriptionUpdate(subscription) {
  try {
    const customerId = subscription.customer;
    const userDoc = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    
    if (userDoc.empty) {
      console.error('User not found for customer:', customerId);
      return;
    }
    
    const userId = userDoc.docs[0].id;
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    
    if (!subscriptionDoc.exists) {
      console.error('Subscription not found in database for user:', userId);
      return;
    }
    
    const subscriptionData = subscriptionDoc.data();
    const pkg = packages.getPackage(subscriptionData.role, subscriptionData.packageId);
    
    // Update subscription in database
    await db.collection('subscriptions').doc(userId).update({
      status: subscription.status,
      limits: pkg.limits,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date()
    });
    
    console.log(`Subscription updated for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    const customerId = subscription.customer;
    const userDoc = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    
    if (userDoc.empty) {
      console.error('User not found for customer:', customerId);
      return;
    }
    
    const userId = userDoc.docs[0].id;
    
    // Update subscription status to canceled
    await db.collection('subscriptions').doc(userId).update({
      status: 'canceled',
      updatedAt: new Date()
    });
    
    console.log(`Subscription canceled for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    const customerId = invoice.customer;
    const userDoc = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    
    if (userDoc.empty) {
      return;
    }
    
    const userId = userDoc.docs[0].id;
    
    // Update subscription status to active if it was past_due
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    if (subscriptionDoc.exists && subscriptionDoc.data().status === 'past_due') {
      await db.collection('subscriptions').doc(userId).update({
        status: 'active',
        updatedAt: new Date()
      });
    }
    
    console.log(`Payment succeeded for user ${userId}`);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const customerId = invoice.customer;
    const userDoc = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    
    if (userDoc.empty) {
      return;
    }
    
    const userId = userDoc.docs[0].id;
    
    // Update subscription status to past_due
    await db.collection('subscriptions').doc(userId).update({
      status: 'past_due',
      updatedAt: new Date()
    });
    
    console.log(`Payment failed for user ${userId}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

module.exports = router;

