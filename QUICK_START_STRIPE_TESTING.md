# Quick Start: Testing Stripe Subscriptions

## 🚀 Quick Setup (5 Minutes)

### 1. Get Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Make sure you're in **Test mode** (toggle in top right)
3. Copy **Publishable key** (starts with `pk_test_`)
4. Copy **Secret key** (starts with `sk_test_`)

### 2. Add to Backend `.env`

```env
STRIPE_SECRET_KEY=sk_test_your_key_here
FRONTEND_URL=http://localhost:5173
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # We'll get this later
```

### 3. Install Stripe CLI (for Webhook Testing)

```bash
# Download from https://stripe.com/docs/stripe-cli
# Then authenticate
stripe login
```

### 4. Start Stripe Webhook Listener

```bash
stripe listen --forward-to http://localhost:5000/api/subscriptions/webhook
```

Copy the webhook secret from the output (starts with `whsec_`) and add it to `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

Restart your backend server.

---

## ✅ Test the Flow

### Step 1: Sign Up
1. Sign up as a new user
2. Select role (Parent, School Admin, District, or Employer)
3. Complete profile (first name, last name, etc.)

### Step 2: Select Package
1. You'll be redirected to package selection
2. All packages are **$1 for testing**
3. Click "Select Plan" on any package

### Step 3: Checkout with Test Card
1. You'll be redirected to Stripe Checkout
2. Use test card: **4242 4242 4242 4242**
3. Expiry: **12/34**
4. CVC: **123**
5. ZIP: **12345**
6. Click "Subscribe"

### Step 4: Verify Subscription
1. You'll be redirected back to the app
2. Check Stripe Dashboard → Subscriptions
3. Your subscription should be created
4. Check your app → You should be able to create resources

---

## 🧪 Test Cards

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Card Declined |
| `4000 0000 0000 9995` | ❌ Insufficient Funds |

**All test cards:**
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

---

## 🔍 Verify Everything Works

### Check Subscription Created
1. Stripe Dashboard → Subscriptions → Should see your subscription
2. Backend logs → Should show webhook events
3. Database → Check `subscriptions` collection in Firestore

### Check Limits Work
1. Try creating resources up to your limit
2. Parent: Create children (limit: 2, 5, or 10)
3. School Admin: Create staff (limit: 5, 15, or 50)
4. Should block creation when limit reached

### Check Usage Tracking
1. Create a resource → Usage should increase
2. Delete a resource → Usage should decrease
3. Check `/api/usage/current` endpoint → Should show current usage

---

## 🐛 Troubleshooting

### Webhook Not Received
- Check webhook secret is set in `.env`
- Check Stripe CLI is running and forwarding to correct URL
- Check backend logs for errors

### Subscription Not Created
- Check Stripe API keys are correct
- Check backend logs for errors
- Verify checkout session was created successfully

### Limits Not Enforced
- Check subscription status in database
- Check subscription middleware is applied to routes
- Check usage tracking is working

---

## 📝 Next Steps

1. **Test all scenarios** (see `STRIPE_TESTING_GUIDE.md`)
2. **Update package prices** in `backend/config/packages.js`
3. **Add subscription management UI** (view subscription, manage via portal)
4. **Add usage dashboard** (show usage vs limits)
5. **Test webhook events** (subscription updates, payments, etc.)

---

## 🎯 Key Points

- ✅ **All packages are $1** for testing
- ✅ **No real money is charged** in test mode
- ✅ **Test cards work** in test mode only
- ✅ **Webhooks are simulated** via Stripe CLI
- ✅ **Easy to update prices** in `packages.js`

---

**For detailed testing, see `STRIPE_TESTING_GUIDE.md`**

