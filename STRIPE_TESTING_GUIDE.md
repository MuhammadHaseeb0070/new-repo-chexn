# Stripe Subscription Testing Guide

## Overview

This guide explains how to test the Stripe subscription system **without paying real money**. Stripe provides test mode with test cards that simulate different payment scenarios.

---

## 1. Stripe Test Mode Setup

### 1.1 Get Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Click on **"Developers"** → **"API keys"**
3. Make sure you're in **Test mode** (toggle in the top right)
4. Copy your **Publishable key** (starts with `pk_test_`)
5. Copy your **Secret key** (starts with `sk_test_`)

### 1.2 Set Up Environment Variables

Add to your `.env` file in the backend:

```env
# Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5173

# Stripe Webhook Secret (we'll get this after setting up webhooks)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

Add to your `.env` file in the frontend (or use `vite.config.js`):

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### 1.3 Install Stripe CLI (for Webhook Testing)

1. Download from [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Install and authenticate:
   ```bash
   stripe login
   ```

---

## 2. Stripe Test Cards

Use these test card numbers to simulate different scenarios:

### 2.1 Successful Payments

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Visa - Success |
| `5555 5555 5555 4444` | Mastercard - Success |
| `3782 822463 10005` | American Express - Success |

**Test Details:**
- **Expiry**: Any future date (e.g., `12/34`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)

### 2.2 Declined Cards

| Card Number | Description |
|-------------|-------------|
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |

### 2.3 3D Secure (Requires Authentication)

| Card Number | Description |
|-------------|-------------|
| `4000 0027 6000 3184` | Requires 3D Secure authentication |
| `4000 0025 0000 3155` | 3D Secure authentication failed |

### 2.4 Subscription Scenarios

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful subscription (renews automatically) |
| `4000 0000 0000 0341` | Attaching this card to a customer requires authentication |

---

## 3. Testing Subscription Flow

### 3.1 Test Subscription Creation

1. **Sign up** as a new user
2. **Select role** (Parent, School Admin, District, Employer)
3. **Complete profile** (first name, last name, etc.)
4. **Select a package** (all are $1 for testing)
5. **Click "Select Plan"** → Redirected to Stripe Checkout
6. **Use test card**: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`
7. **Complete checkout** → Redirected back to app
8. **Verify subscription** in Stripe Dashboard → Subscriptions

### 3.2 Test Subscription Limits

1. **Create subscription** (as above)
2. **Try to create resources** up to your limit:
   - Parent: Try creating children (limit: 2, 5, or 10)
   - School Admin: Try creating staff (limit: 5, 15, or 50)
   - Staff: Try creating students (limit: 30, 50, or 100 per staff)
3. **Verify limit enforcement**:
   - Should allow creation up to limit
   - Should block creation when limit reached
   - Should show error message with current/limit

### 3.3 Test Subscription Management

1. **Log in** with an active subscription
2. **Go to subscription management** (from dashboard)
3. **Click "Manage Subscription"** → Opens Stripe Customer Portal
4. **Test different actions**:
   - Update payment method
   - View invoices
   - Cancel subscription
   - Reactivate subscription

### 3.4 Test Webhook Events

#### Set Up Webhook Endpoint (Local Testing)

1. **Start Stripe CLI listener**:
   ```bash
   stripe listen --forward-to http://localhost:5000/api/subscriptions/webhook
   ```

2. **Copy webhook secret** from the output:
   ```
   Ready! Your webhook signing secret is whsec_xxxxx
   ```

3. **Add to `.env`**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

4. **Test webhook events**:
   - Create a subscription → `checkout.session.completed`
   - Update subscription → `customer.subscription.updated`
   - Cancel subscription → `customer.subscription.deleted`
   - Payment succeeds → `invoice.payment_succeeded`
   - Payment fails → `invoice.payment_failed`

#### Test Webhook Events Manually

1. **Go to Stripe Dashboard** → **Developers** → **Webhooks**
2. **Click "Send test webhook"**
3. **Select event type** (e.g., `customer.subscription.created`)
4. **Send webhook** → Check backend logs

---

## 4. Testing Different Scenarios

### 4.1 Test Payment Failure

1. **Use declined card**: `4000 0000 0000 0002`
2. **Complete checkout** → Should show error
3. **Verify subscription status** → Should be `past_due` or not created

### 4.2 Test Subscription Cancellation

1. **Create subscription** (with successful card)
2. **Cancel subscription** (via Customer Portal)
3. **Verify status** → Should be `canceled`
4. **Try creating resources** → Should be blocked (subscription required)

### 4.3 Test Subscription Upgrade/Downgrade

1. **Create subscription** with Basic plan
2. **Go to Customer Portal** → Change plan
3. **Verify limits updated** → Check usage dashboard
4. **Verify resources** → Should reflect new limits

### 4.4 Test Usage Tracking

1. **Create subscription** (e.g., Parent with 2 children limit)
2. **Create 1 child** → Usage should show 1/2
3. **Create another child** → Usage should show 2/2
4. **Try creating 3rd child** → Should be blocked
5. **Delete a child** → Usage should update to 1/2

---

## 5. Stripe Dashboard Testing

### 5.1 View Test Data

1. **Go to Stripe Dashboard** → **Test mode** (toggle on)
2. **View subscriptions** → **Subscriptions** tab
3. **View customers** → **Customers** tab
4. **View payments** → **Payments** tab
5. **View events** → **Developers** → **Events** tab

### 5.2 Test Refunds

1. **Go to Payments** → Find a test payment
2. **Click "Refund"** → Select amount
3. **Process refund** → Verify in dashboard

### 5.3 Test Subscription Modifications

1. **Go to Subscriptions** → Find a test subscription
2. **Click "Update subscription"** → Change plan
3. **Verify changes** → Check limits in app

---

## 6. Common Test Scenarios

### 6.1 New User Sign-up Flow

1. ✅ Sign up → Select role → Complete profile
2. ✅ Select package → Checkout with test card
3. ✅ Verify subscription created
4. ✅ Verify can create resources up to limit
5. ✅ Verify limit enforcement works

### 6.2 Existing User with Subscription

1. ✅ Log in → View subscription status
2. ✅ View usage dashboard
3. ✅ Create resources (up to limit)
4. ✅ Manage subscription (via portal)
5. ✅ Upgrade/downgrade plan

### 6.3 Subscription Expired

1. ✅ Cancel subscription (via portal)
2. ✅ Verify status → `canceled`
3. ✅ Try creating resources → Should be blocked
4. ✅ Verify error message shown

### 6.4 Payment Failed

1. ✅ Use declined card (`4000 0000 0000 0002`)
2. ✅ Verify subscription status → `past_due`
3. ✅ Verify resources still accessible (grace period)
4. ✅ Update payment method → Verify subscription reactivated

---

## 7. Debugging Tips

### 7.1 Check Stripe Dashboard

- **Events**: View all webhook events and their status
- **Logs**: Check API request logs for errors
- **Webhooks**: Verify webhook endpoints are receiving events

### 7.2 Check Backend Logs

- **Subscription creation**: Check if subscription saved to database
- **Webhook processing**: Check if webhooks are being processed
- **Limit checks**: Check if limits are being enforced correctly

### 7.3 Check Frontend Console

- **API errors**: Check for failed API requests
- **Redirect issues**: Check if Stripe redirects are working
- **State management**: Check if subscription state is updated

### 7.4 Common Issues

| Issue | Solution |
|-------|----------|
| Webhook not received | Check webhook URL and secret |
| Subscription not created | Check Stripe API keys |
| Limits not enforced | Check subscription status in database |
| Redirect not working | Check `FRONTEND_URL` in `.env` |

---

## 8. Production Checklist

Before going live:

1. ✅ Switch to **Live mode** in Stripe Dashboard
2. ✅ Update environment variables with **live keys**
3. ✅ Set up **production webhook endpoint**
4. ✅ Update package prices in `backend/config/packages.js`
5. ✅ Test with **real card** (small amount)
6. ✅ Verify **webhook security** (signature verification)
7. ✅ Set up **monitoring** and **alerts**
8. ✅ Document **refund policy**
9. ✅ Set up **customer support** process

---

## 9. Useful Stripe Resources

- [Stripe Testing](https://stripe.com/docs/testing)
- [Test Cards](https://stripe.com/docs/testing#cards)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
- [Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Subscription Lifecycle](https://stripe.com/docs/billing/subscriptions/overview)

---

## 10. Quick Test Checklist

- [ ] Test successful subscription creation
- [ ] Test subscription limits enforcement
- [ ] Test subscription management (portal)
- [ ] Test payment failure scenarios
- [ ] Test subscription cancellation
- [ ] Test webhook events
- [ ] Test usage tracking
- [ ] Test upgrade/downgrade
- [ ] Test error handling
- [ ] Test redirect flows

---

## Notes

- **All test cards work in test mode only**
- **No real money is charged in test mode**
- **Test data is separate from live data**
- **Webhook events are simulated in test mode**
- **You can reset test data in Stripe Dashboard**

---

**Last Updated**: 2024  
**Stripe API Version**: 2024-xx-xx

