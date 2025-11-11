const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const packages = require('../config/packages');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUsage } = require('../utils/usageTracker');

// Utility to safely convert Stripe timestamps to JS Date
function toDate(seconds) {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

// Helper function to get or create a Stripe price for a package
// This ensures prices exist in Stripe even if they were created on-the-fly during checkout
async function getOrCreateStripePrice(pkg) {
  try {
    // First, try to retrieve the price if stripePriceId exists and is a valid Stripe price ID
    if (pkg.stripePriceId && pkg.stripePriceId.startsWith('price_')) {
      try {
        const existingPrice = await stripe.prices.retrieve(pkg.stripePriceId);
        // Verify the price matches our package configuration
        if (
          existingPrice.unit_amount === Math.round(pkg.price * 100) &&
          existingPrice.currency === pkg.currency &&
          existingPrice.recurring?.interval === (pkg.billingInterval === 'year' ? 'year' : 'month')
        ) {
          return existingPrice.id;
        }
      } catch (err) {
        // Price doesn't exist, continue to create it
        console.log(`Price ${pkg.stripePriceId} not found, creating new price`);
      }
    }

    // Try to find an existing product with the same name
    let productId = null;
    const products = await stripe.products.list({ limit: 100 });
    const existingProduct = products.data.find(p => p.name === pkg.name);
    
    if (existingProduct) {
      productId = existingProduct.id;
    } else {
      // Create a new product
      const product = await stripe.products.create({
        name: pkg.name,
        metadata: {
          packageId: pkg.stripeProductId || ''
        }
      });
      productId = product.id;
    }

    // Try to find an existing price for this product with matching amount and interval
    const prices = await stripe.prices.list({ product: productId, limit: 100 });
    const interval = pkg.billingInterval === 'year' ? 'year' : 'month';
    const amount = Math.round(pkg.price * 100);
    
    const existingPrice = prices.data.find(
      price =>
        price.unit_amount === amount &&
        price.currency === pkg.currency &&
        price.recurring?.interval === interval &&
        price.active
    );

    if (existingPrice) {
      return existingPrice.id;
    }

    // Create a new price
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: pkg.currency,
      recurring: {
        interval: interval,
      },
    });

    return price.id;
  } catch (error) {
    console.error('Error getting or creating Stripe price:', error);
    throw error;
  }
}

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
    
    // Check existing subscription
    let existingSubscription = null;
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    if (subscriptionDoc.exists) {
      existingSubscription = subscriptionDoc.data();
    }

    if (
      existingSubscription &&
      existingSubscription.stripeSubscriptionId &&
      ['active', 'trialing', 'past_due', 'incomplete'].includes(existingSubscription.status) &&
      !existingSubscription.cancelAtPeriodEnd
    ) {
      return res.status(409).json({
        error: 'existing_subscription',
        message:
          'You already have an active subscription. Please use Manage Subscription to change plans or cancel first.',
      });
    }

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
    let customerId = userData.stripeCustomerId;
    
    // Fallback: If customer ID not in user doc, try to get it from subscription
    if (!customerId) {
      const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
      if (subscriptionDoc.exists) {
        const subscriptionData = subscriptionDoc.data();
        customerId = subscriptionData.stripeCustomerId;
        
        // Save it to user document for future use
        if (customerId) {
          await db.collection('users').doc(userId).update({
            stripeCustomerId: customerId
          });
        }
      }
    }
    
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found. Please ensure you have an active subscription.' });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Change the current user's subscription plan (upgrade / downgrade)
router.post('/change-plan', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({ error: 'packageId is required' });
    }

    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      return res.status(400).json({ error: 'No active subscription found. Please purchase a plan first.' });
    }

    const subscriptionData = subscriptionDoc.data();
    if (!subscriptionData.stripeSubscriptionId) {
      return res.status(400).json({ error: 'Stripe subscription not linked. Please contact support.' });
    }

    if (subscriptionData.packageId === packageId) {
      return res.status(400).json({ error: 'You are already on this plan.' });
    }

    let targetPackage;
    try {
      targetPackage = packages.getPackage(subscriptionData.role, packageId);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid package selected for your role.' });
    }

    // Get current package to determine if this is a downgrade
    let currentPackage;
    try {
      currentPackage = packages.getPackage(subscriptionData.role, subscriptionData.packageId);
    } catch (err) {
      // If we can't get current package, continue (might be edge case)
      currentPackage = null;
    }

    // Check if this is a downgrade by comparing prices
    const isDowngrade = currentPackage && targetPackage.price < currentPackage.price;

    // If downgrading, validate that current usage doesn't exceed target package limits
    if (isDowngrade) {
      try {
        const usageData = await getUsage(userId);
        const usage = usageData.usage || {};
        const violations = [];

        // Check each limit type based on role
        if (subscriptionData.role === 'parent') {
          const currentChildren = usage.children || 0;
          const targetLimit = targetPackage.limits?.children || 0;
          if (currentChildren > targetLimit) {
            violations.push({
              resourceType: 'children',
              current: currentChildren,
              limit: targetLimit,
              excess: currentChildren - targetLimit,
              message: `You have ${currentChildren} children, but the ${targetPackage.name} plan allows only ${targetLimit}. Please remove ${currentChildren - targetLimit} child(ren) before downgrading.`
            });
          }
        } else if (subscriptionData.role === 'schoolAdmin') {
          const currentStaff = usage.staff || 0;
          const targetStaffLimit = targetPackage.limits?.staff || 0;
          if (currentStaff > targetStaffLimit) {
            violations.push({
              resourceType: 'staff',
              current: currentStaff,
              limit: targetStaffLimit,
              excess: currentStaff - targetStaffLimit,
              message: `You have ${currentStaff} staff members, but the ${targetPackage.name} plan allows only ${targetStaffLimit}. Please remove ${currentStaff - targetStaffLimit} staff member(s) before downgrading.`
            });
          }

          // Check students per staff
          if (usage.studentsByStaff) {
            const targetStudentsPerStaff = targetPackage.limits?.studentsPerStaff || 0;
            for (const [staffId, staffData] of Object.entries(usage.studentsByStaff)) {
              const studentCount = typeof staffData === 'object' ? staffData.count || 0 : staffData || 0;
              if (studentCount > targetStudentsPerStaff) {
                violations.push({
                  resourceType: 'studentsPerStaff',
                  current: studentCount,
                  limit: targetStudentsPerStaff,
                  excess: studentCount - targetStudentsPerStaff,
                  message: `One or more staff members have ${studentCount} students, but the ${targetPackage.name} plan allows only ${targetStudentsPerStaff} students per staff. Please reduce student assignments before downgrading.`
                });
                break; // Only report once
              }
            }
          }
        } else if (subscriptionData.role === 'districtAdmin') {
          const currentSchools = usage.schools || 0;
          const targetSchoolLimit = targetPackage.limits?.schools || 0;
          if (currentSchools > targetSchoolLimit) {
            violations.push({
              resourceType: 'schools',
              current: currentSchools,
              limit: targetSchoolLimit,
              excess: currentSchools - targetSchoolLimit,
              message: `You have ${currentSchools} schools, but the ${targetPackage.name} plan allows only ${targetSchoolLimit}. Please remove ${currentSchools - targetSchoolLimit} school(s) before downgrading.`
            });
          }

          // Check staff per school
          if (usage.staffPerSchool) {
            const targetStaffPerSchool = targetPackage.limits?.staffPerSchool || 0;
            for (const [schoolId, staffCount] of Object.entries(usage.staffPerSchool)) {
              if (staffCount > targetStaffPerSchool) {
                violations.push({
                  resourceType: 'staffPerSchool',
                  current: staffCount,
                  limit: targetStaffPerSchool,
                  excess: staffCount - targetStaffPerSchool,
                  message: `One or more schools have ${staffCount} staff members, but the ${targetPackage.name} plan allows only ${targetStaffPerSchool} staff per school. Please reduce staff assignments before downgrading.`
                });
                break; // Only report once
              }
            }
          }

          // Check students per school
          if (usage.studentsPerSchool) {
            const targetStudentsPerStaff = targetPackage.limits?.studentsPerStaff || 0;
            // Note: For districts, we check students per staff across all schools
            // This is a simplified check - in reality, we'd need to check per school's staff
            // For now, we'll check if any school has excessive students
            for (const [schoolId, studentCount] of Object.entries(usage.studentsPerSchool)) {
              // Estimate: if school has many students, it might exceed per-staff limits
              // This is a rough check - we'd need more detailed usage data for precise validation
              if (studentCount > targetStudentsPerStaff * (targetPackage.limits?.staffPerSchool || 1)) {
                violations.push({
                  resourceType: 'studentsPerSchool',
                  current: studentCount,
                  limit: targetStudentsPerStaff * (targetPackage.limits?.staffPerSchool || 1),
                  excess: studentCount - (targetStudentsPerStaff * (targetPackage.limits?.staffPerSchool || 1)),
                  message: `One or more schools have excessive students for the ${targetPackage.name} plan. Please reduce student assignments before downgrading.`
                });
                break; // Only report once
              }
            }
          }
        } else if (subscriptionData.role === 'employerAdmin') {
          const currentStaff = usage.staff || 0;
          const targetStaffLimit = targetPackage.limits?.staff || 0;
          if (currentStaff > targetStaffLimit) {
            violations.push({
              resourceType: 'staff',
              current: currentStaff,
              limit: targetStaffLimit,
              excess: currentStaff - targetStaffLimit,
              message: `You have ${currentStaff} staff members, but the ${targetPackage.name} plan allows only ${targetStaffLimit}. Please remove ${currentStaff - targetStaffLimit} staff member(s) before downgrading.`
            });
          }

          // Check employees per staff
          if (usage.employeesByStaff) {
            const targetEmployeesPerStaff = targetPackage.limits?.employeesPerStaff || 0;
            for (const [staffId, staffData] of Object.entries(usage.employeesByStaff)) {
              const employeeCount = typeof staffData === 'object' ? staffData.count || 0 : staffData || 0;
              if (employeeCount > targetEmployeesPerStaff) {
                violations.push({
                  resourceType: 'employeesPerStaff',
                  current: employeeCount,
                  limit: targetEmployeesPerStaff,
                  excess: employeeCount - targetEmployeesPerStaff,
                  message: `One or more staff members have ${employeeCount} employees, but the ${targetPackage.name} plan allows only ${targetEmployeesPerStaff} employees per staff. Please reduce employee assignments before downgrading.`
                });
                break; // Only report once
              }
            }
          }
        }

        // If there are violations, prevent downgrade
        if (violations.length > 0) {
          const violationMessages = violations.map(v => v.message).join(' ');
          return res.status(400).json({
            error: 'Cannot downgrade: Usage exceeds target plan limits',
            message: violationMessages,
            violations: violations,
            currentUsage: usage,
            targetLimits: targetPackage.limits
          });
        }
      } catch (usageError) {
        console.error('Error checking usage before downgrade:', usageError);
        // Continue with downgrade if we can't check usage (better to allow than block)
        // But log the error for investigation
      }
    }

    // Get or create the Stripe price for this package
    let targetPriceId;
    try {
      targetPriceId = await getOrCreateStripePrice(targetPackage);
    } catch (error) {
      console.error('Error getting or creating price:', error);
      return res.status(500).json({ 
        error: 'Failed to get or create price for this package. Please try again or contact support.' 
      });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);

    if (!stripeSubscription || !stripeSubscription.items?.data?.length) {
      return res.status(400).json({ error: 'Unable to retrieve subscription items from Stripe.' });
    }

    const primaryItem = stripeSubscription.items.data[0];

    // Store previous package info in case we need to revert
    const previousPackageId = subscriptionData.packageId;
    const previousLimits = subscriptionData.limits;

    // Update subscription in Stripe - this will attempt to charge immediately for prorated amount
    const updatedSubscription = await stripe.subscriptions.update(stripeSubscription.id, {
      items: [
        {
          id: primaryItem.id,
          price: targetPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        ...(stripeSubscription.metadata || {}),
        packageId,
        role: subscriptionData.role,
        updatedBy: userId,
        previousPackageId: previousPackageId, // Store for potential revert
      },
    });

    const updatedItem = updatedSubscription.items?.data?.[0];
    const finalPriceId = updatedItem?.price?.id || targetPriceId;

    // Check if payment was successful by checking subscription status
    // If status is 'past_due' or 'unpaid', the payment failed
    const paymentStatus = updatedSubscription.status;
    const isPaymentSuccessful = paymentStatus === 'active' || paymentStatus === 'trialing';

    // Check for any unpaid invoices that might indicate payment failure
    let hasUnpaidInvoice = false;
    try {
      const invoices = await stripe.invoices.list({
        subscription: updatedSubscription.id,
        status: 'open', // Open invoices are unpaid
        limit: 1,
      });
      hasUnpaidInvoice = invoices.data.length > 0;
    } catch (invoiceError) {
      console.error('Error checking invoices:', invoiceError);
      // Continue anyway - status check is more important
    }

    // Update database with new package information
    // Note: If payment failed, status will be 'past_due' and user will be blocked from features
    // The package is updated, but access is restricted until payment succeeds
    await subscriptionRef.update({
      packageId,
      limits: targetPackage.limits,
      stripePriceId: finalPriceId,
      status: paymentStatus,
      currentPeriodStart: toDate(updatedSubscription.current_period_start),
      currentPeriodEnd: toDate(updatedSubscription.current_period_end),
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
      cancelAt: updatedSubscription.cancel_at ? toDate(updatedSubscription.cancel_at) : null,
      previousPackageId: previousPackageId, // Store for reference
      updatedAt: new Date(),
    });

    // Prepare response
    const responseData = {
      success: true,
      subscription: {
        ...subscriptionData,
        packageId,
        limits: targetPackage.limits,
        stripePriceId: finalPriceId,
        status: paymentStatus,
        currentPeriodStart: toDate(updatedSubscription.current_period_start),
        currentPeriodEnd: toDate(updatedSubscription.current_period_end),
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        cancelAt: updatedSubscription.cancel_at ? toDate(updatedSubscription.cancel_at) : null,
      },
    };

    // Warn user if payment failed
    if (!isPaymentSuccessful || hasUnpaidInvoice) {
      responseData.warning = 'Payment could not be processed. Please update your payment method. Your subscription status is: ' + paymentStatus;
      responseData.requiresPaymentUpdate = true;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    const message = error.response?.data?.error || error.message || 'Failed to update subscription plan.';
    res.status(500).json({ error: message });
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

