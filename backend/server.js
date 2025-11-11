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
// Import check-in routes
const checkinRoutes = require('./routes/checkinRoutes');
const parentRoutes = require('./routes/parentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const staffRoutes = require('./routes/staffRoutes');
const districtRoutes = require('./routes/districtRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const employerRoutes = require('./routes/employerRoutes');
const employerStaffRoutes = require('./routes/employerStaffRoutes');
const geofenceRoutes = require('./routes/geofenceRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const usageRoutes = require('./routes/usageRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
app.use(cors());

// Stripe webhook route needs raw body - must be registered BEFORE express.json()
// We'll handle this route directly here to ensure raw body parsing
app.post('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const { admin, db } = require('./config/firebase');
  const packages = require('./config/packages');
  
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const role = session.metadata.role;
        const packageId = session.metadata.packageId;
        
        if (!userId || !role || !packageId) {
          console.error('Missing metadata in checkout session');
          break;
        }
        
        const subscriptionId = session.subscription;
        if (!subscriptionId) {
          console.error('No subscription ID in session');
          break;
        }
        
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const pkg = packages.getPackage(role, packageId);
        const customerId = subscription.customer;
        const priceId = subscription.items?.data?.[0]?.price?.id || pkg.stripePriceId;
        
        // Save subscription to database
        await db.collection('subscriptions').doc(userId).set({
          userId,
          role,
          packageId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
          stripePriceId: priceId,
          status: subscription.status,
          limits: pkg.limits,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Also save customer ID to user document (needed for portal session)
        await db.collection('users').doc(userId).update({
          stripeCustomerId: customerId
        });
        
        console.log(`Subscription created for user ${userId}`);
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const latestSubscription = await stripe.subscriptions.retrieve(subscription.id);
        const userDoc = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
        
        if (userDoc.empty) {
          console.error('User not found for customer:', customerId);
          break;
        }
        
        const userId = userDoc.docs[0].id;
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (!subscriptionDoc.exists) {
          console.error('Subscription not found in database for user:', userId);
          break;
        }
        
        const subscriptionData = subscriptionDoc.data();
        let role = subscriptionData.role;
        let packageId = subscriptionData.packageId;
        let limits = subscriptionData.limits;

        const priceId = latestSubscription.items?.data?.[0]?.price?.id;
        if (priceId) {
          const mappedPkg = packages.getPackageByPriceId(priceId);
          if (mappedPkg) {
            role = mappedPkg.role;
            packageId = mappedPkg.packageId;
            limits = mappedPkg.pkg.limits;
          }
        }
        if (!limits) {
          try {
            const fallbackPkg = packages.getPackage(role, packageId);
            limits = fallbackPkg.limits;
          } catch (err) {
            console.error('Unable to determine package limits for subscription update:', err.message);
          }
        }
        
        await db.collection('subscriptions').doc(userId).update({
          role,
          packageId,
          status: latestSubscription.status,
          limits,
          stripePriceId: priceId || subscriptionData.stripePriceId,
          currentPeriodStart: new Date(latestSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(latestSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: latestSubscription.cancel_at_period_end,
          cancelAt: latestSubscription.cancel_at ? new Date(latestSubscription.cancel_at * 1000) : null,
          updatedAt: new Date()
        });
        
        console.log(`Subscription updated for user ${userId}`);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const userDoc = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
        
        if (userDoc.empty) {
          console.error('User not found for customer:', customerId);
          break;
        }
        
        const userId = userDoc.docs[0].id;
        
        await db.collection('subscriptions').doc(userId).update({
          status: 'canceled',
          cancelAtPeriodEnd: false,
          cancelAt: null,
          updatedAt: new Date()
        });
        
        console.log(`Subscription canceled for user ${userId}`);
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        
        const userDoc = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
        
        if (userDoc.empty) {
          break;
        }
        
        const userId = userDoc.docs[0].id;
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (!subscriptionDoc.exists) {
          break;
        }

        // Retrieve the latest subscription status from Stripe to ensure accuracy
        let stripeSubscriptionStatus = 'active';
        if (subscriptionId) {
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            stripeSubscriptionStatus = stripeSubscription.status;
            
            // If subscription status is active, ensure package info is up to date
            if (stripeSubscriptionStatus === 'active') {
              const subscriptionData = subscriptionDoc.data();
              const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
              
              // Try to get package info from price ID
              if (priceId) {
                const mappedPkg = packages.getPackageByPriceId(priceId);
                if (mappedPkg) {
                  await db.collection('subscriptions').doc(userId).update({
                    status: 'active',
                    packageId: mappedPkg.packageId,
                    limits: mappedPkg.pkg.limits,
                    stripePriceId: priceId,
                    updatedAt: new Date()
                  });
                  console.log(`Payment succeeded for user ${userId}. Package confirmed: ${mappedPkg.packageId}`);
                  break;
                }
              }
            }
          } catch (err) {
            console.error('Error retrieving subscription status:', err);
          }
        }
        
        // Update status to active if it was past_due
        const subscriptionData = subscriptionDoc.data();
        if (subscriptionData.status === 'past_due' || subscriptionData.status === 'unpaid') {
          await db.collection('subscriptions').doc(userId).update({
            status: stripeSubscriptionStatus,
            updatedAt: new Date()
          });
          console.log(`Payment succeeded for user ${userId}. Subscription restored to ${stripeSubscriptionStatus}`);
        } else {
          console.log(`Payment succeeded for user ${userId}. Subscription already active.`);
        }
        
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        
        const userDoc = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
        
        if (userDoc.empty) {
          break;
        }
        
        const userId = userDoc.docs[0].id;
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (!subscriptionDoc.exists) {
          break;
        }

        const subscriptionData = subscriptionDoc.data();
        
        // Retrieve the latest subscription status from Stripe
        let stripeSubscriptionStatus = 'past_due';
        if (subscriptionId) {
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            stripeSubscriptionStatus = stripeSubscription.status;
          } catch (err) {
            console.error('Error retrieving subscription status:', err);
          }
        }
        
        // Update subscription status
        // Note: We keep the packageId as-is, but status becomes 'past_due'
        // This blocks user access until payment succeeds
        await db.collection('subscriptions').doc(userId).update({
          status: stripeSubscriptionStatus,
          updatedAt: new Date()
        });
        
        console.log(`Payment failed for user ${userId}. Subscription status: ${stripeSubscriptionStatus}`);
        console.log(`User ${userId} will be blocked from accessing features until payment succeeds.`);
        break;
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Apply JSON parsing to all other routes
app.use(express.json());

// --- Routes ---
app.use('/api/users', userRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/district', districtRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/employer-staff', employerStaffRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/usage', usageRoutes);

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
  
  // Set up cron job to check and send scheduled notifications every minute
  const cron = require('node-cron');
  const { db, admin } = require('./config/firebase');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Use local time, not UTC (since frontend sends local time from HTML time input)
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${currentHour}:${currentMinute}`;
      
      const query = db.collection('schedules').where('time', '==', currentTime);
      const snapshot = await query.get();
      if (snapshot.empty) {
        return; // No schedules to send
      }
      
      console.log(`[Cron] Found ${snapshot.docs.length} schedule(s) to send at ${currentTime}`);
      
      let sentCount = 0;
      for (const scheduleDoc of snapshot.docs) {
        const schedule = scheduleDoc.data();
        const targetUserId = schedule.targetUserId;
        const message = schedule.message || 'It\'s time to Chex-N!';
        const scheduleId = scheduleDoc.id;
        
        try {
          const userDoc = await db.collection('users').doc(targetUserId).get();
          if (!userDoc.exists) continue;
          const fcmTokens = userDoc.data().fcmTokens || [];
          if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
            console.log(`[Cron] No FCM tokens for user ${targetUserId}`);
            continue;
          }
          
          const payload = {
            notification: {
              title: 'Time to Chex-N!',
              body: message,
            },
            data: {
              scheduleId: scheduleId,
              question: message,
              type: 'scheduled_checkin'
            },
            tokens: fcmTokens,
          };
          await admin.messaging().sendEachForMulticast(payload);
          sentCount++;
          console.log(`[Cron] Sent notification to user ${targetUserId} with scheduleId ${scheduleId}`);
        } catch (innerError) {
          console.error(`[Cron] Error sending scheduled message for user ${targetUserId}:`, innerError.message);
        }
      }
      
      if (sentCount > 0) {
        console.log(`[Cron] Successfully sent ${sentCount} notification(s)`);
      }
    } catch (error) {
      console.error('[Cron] Error in notification cron job:', error.message);
    }
  });
  
  console.log('✅ Notification cron job started (runs every minute)');
});