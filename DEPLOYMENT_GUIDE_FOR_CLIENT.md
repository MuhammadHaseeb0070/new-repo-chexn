# How to Deploy ChexN Application

Hi, this guide explains everything your engineer needs to deploy the ChexN application. I've kept it straightforward so anyone can follow it, regardless of where you decide to host it.

## What's in the Codebase

The project has two parts:
1. **Backend** - Located in the `backend/` folder (Node.js/Express server)
2. **Frontend** - Located in the `frontend-web/chexn/` folder (React app built with Vite)

Both folders have their own `package.json` and need to be deployed separately.

## What's NOT in GitHub

For security reasons, some files aren't in the repository. Your engineer will need to create these:

1. **Firebase Admin Key** - This file is required for the backend. You need to download it from Firebase Console (I'll explain how below).

2. **Environment variable files** - Both backend and frontend need `.env` files with specific values. I've included `.env.example` files in both folders as templates.

## Step 1: Get Firebase Admin Key

The backend needs a Firebase Admin service account key to access your Firebase project. Here's how to get it:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (it should be `chexn-9745b`)
3. Click the gear icon (⚙️) next to "Project Overview" → Select "Project settings"
4. Go to "Service accounts" tab
5. Click "Generate new private key"
6. A JSON file will download - this is your Firebase Admin key

**Important:** Keep this file safe. Don't commit it to GitHub or share it publicly.

You have two options for using this key:

**Option A:** Save it as a file (for local development or if your hosting supports file uploads)
- Save the downloaded file as `backend/firebase-admin-key.json`
- The code will automatically find it there

**Option B:** Use it as an environment variable (recommended for cloud hosting)
- Open the downloaded JSON file
- Copy the entire contents
- Convert it to a single line (remove all line breaks)
- Use this as the value for `FIREBASE_ADMIN_SERVICE_ACCOUNT` environment variable

## Step 2: Get Stripe Keys

You need two Stripe keys:

1. **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Click "Developers" → "API keys"
   - Copy the "Publishable key" - this goes to the frontend

2. **Secret Key** (starts with `sk_test_` or `sk_live_`)
   - Same page in Stripe Dashboard
   - Click "Reveal test key" or "Reveal live key"
   - Copy the secret key - this goes to the backend
   - **Never share this key** - it's like a password

3. **Webhook Secret** (you'll get this after setting up the webhook)
   - I'll explain this in the Stripe webhook section below

## Step 3: Environment Variables for Backend

Create a `.env` file in the `backend/` folder. You can copy `backend/.env.example` as a starting point.

Here are all the variables your backend needs:

```
FRONTEND_URL=https://your-frontend-domain.com
```

This is the URL where your frontend will be hosted. No trailing slash. If you don't know it yet, use a placeholder and update it later.

```
CORS_ORIGINS=http://localhost:5173,https://your-frontend-domain.com
```

This tells the backend which websites are allowed to make API requests. Include your frontend URL here, plus localhost for local development.

```
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

This is the Stripe secret key from Step 2.

```
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

You'll get this after setting up the Stripe webhook. More on that below.

```
PORT=5000
```

The port number. Most hosting providers will set this automatically, but if they don't, use 5000. Some providers (like Render) use a different port - check your hosting provider's documentation.

```
FIREBASE_ADMIN_SERVICE_ACCOUNT={"type":"service_account","project_id":"chexn-9745b",...}
```

This is the entire Firebase Admin JSON file as a single line (all on one line, no line breaks). Or if you're using a file instead, use:

```
FIREBASE_ADMIN_KEY_PATH=./firebase-admin-key.json
```

## Step 4: Environment Variables for Frontend

Create a `.env` file in the `frontend-web/chexn/` folder. You can copy `frontend-web/chexn/.env.example` as a starting point.

Here are all the variables your frontend needs:

```
VITE_API_URL=https://your-backend-domain.com/api
```

This is your backend URL with `/api` at the end. Make sure to include the `/api` part.

```
VITE_STRIPE_PUBLIC_KEY=pk_test_your_publishable_key_here
```

This is the Stripe publishable key from Step 2.

```
VITE_FIREBASE_API_KEY=AIzaSyDtPa6Fk4m_2WxLyKBBEulC02bHYLRDJR8
VITE_FIREBASE_AUTH_DOMAIN=chexn-9745b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chexn-9745b
VITE_FIREBASE_STORAGE_BUCKET=chexn-9745b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=75693882893
VITE_FIREBASE_APP_ID=1:75693882893:web:21e9513cc2b85555a09f44
VITE_FIREBASE_MEASUREMENT_ID=G-7DT1E0KS4F
```

These are your Firebase project settings. They should already be correct for your project, but you can double-check in Firebase Console → Project Settings → General → Your apps → Web app.

```
VITE_VAPID_KEY=BPPzaRvzF_1LllZRdC5u0iEKeTemNACN6E2TfQ3xKUL_TxgoOPbPB_tGWYXP8PwfcNxLztH5Lnafyl5LCqjx4uI
```

This is for push notifications. You can get it from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates. If you don't see it, you may need to generate it first.

## Step 5: Building and Running Locally (Testing)

Before deploying, it's good to test everything locally:

### Backend:
```bash
cd backend
npm install
npm run dev
```

The backend should start on `http://localhost:5000`. Test it by visiting `http://localhost:5000/api` - you should see a JSON message.

### Frontend:
```bash
cd frontend-web/chexn
npm install
npm run dev
```

The frontend should start on `http://localhost:5173`. Open that in your browser and you should see the login page.

## Step 6: Deploy Backend

The backend is a Node.js application. It can be deployed to any platform that supports Node.js:

- Render.com
- Railway.app
- Heroku
- AWS Elastic Beanstalk
- Google Cloud Run
- Azure App Service
- Or any server with Node.js installed

**Build Settings:**
- Build command: `cd backend && npm install`
- Start command: `cd backend && node server.js`
- Port: Check your hosting provider's documentation. Some use `$PORT` environment variable.

**Important:** Make sure to set all the backend environment variables (from Step 3) in your hosting provider's dashboard.

After deployment, you'll get a URL like `https://your-backend.onrender.com`. Save this URL - you'll need it for the frontend.

## Step 7: Deploy Frontend

The frontend is a static React app. It can be deployed to:

- Vercel
- Netlify
- AWS S3 + CloudFront
- Azure Static Web Apps
- Google Cloud Storage
- Or any static hosting service

**Build Settings:**
- Root directory: `frontend-web/chexn`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

**Important:** 
1. Set all the frontend environment variables (from Step 4) in your hosting provider's dashboard BEFORE building.
2. Make sure `VITE_API_URL` points to your deployed backend URL with `/api` at the end.

After deployment, you'll get a URL like `https://your-frontend.vercel.app`. Save this URL.

## Step 8: Update Backend with Frontend URL

Now that you have both URLs:

1. Go back to your backend hosting dashboard
2. Update the `FRONTEND_URL` environment variable to your actual frontend URL
3. Update the `CORS_ORIGINS` environment variable to include your frontend URL (and localhost for development)
4. Redeploy the backend (or wait for it to auto-redeploy)

This allows the backend to accept requests from your frontend.

## Step 9: Set Up Stripe Webhook

The webhook tells Stripe to notify your backend when payments are completed. Here's how to set it up:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click "Developers" → "Webhooks"
3. Click "Add endpoint"
4. Enter your webhook URL: `https://your-backend-domain.com/api/subscriptions/webhook`
   (Replace with your actual backend URL)
5. Click "Select events" and choose these events:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
6. Click "Add events" then "Add endpoint"
7. After creating the webhook, click on it to view details
8. Find "Signing secret" and click "Reveal"
9. Copy the secret (it starts with `whsec_`)
10. Go back to your backend hosting dashboard
11. Update the `STRIPE_WEBHOOK_SECRET` environment variable with this secret
12. Redeploy the backend

## Step 10: Test Everything

After everything is deployed:

1. Visit your frontend URL - you should see the login page
2. Try creating a new account
3. Verify your email (check your inbox)
4. After logging in, try the subscription flow
5. Use Stripe test card numbers: `4242 4242 4242 4242` with any future expiry date and any CVC
6. Complete the payment - you should be redirected back to the app

If anything doesn't work, check the browser console (press F12) and the backend logs in your hosting dashboard.

## Common Issues and Solutions

**"Connection refused" or "Network error":**
- Check that `VITE_API_URL` in frontend is correct and includes `/api`
- Make sure the backend is actually running (check the URL directly in browser)

**CORS errors:**
- Make sure `FRONTEND_URL` and `CORS_ORIGINS` in backend match your actual frontend URL exactly
- No trailing slashes

**Firebase errors:**
- Double-check all the `VITE_FIREBASE_*` variables in frontend
- Make sure the Firebase Admin key is set correctly in backend (either as file or environment variable)

**Stripe payments work but subscription doesn't activate:**
- Check that the webhook is configured correctly
- Verify `STRIPE_WEBHOOK_SECRET` is set in backend
- Check Stripe webhook logs to see if events are being received

**404 error after payment:**
- The success redirect URL should be `https://your-frontend.com/?session_id={CHECKOUT_SESSION_ID}`
- Make sure `FRONTEND_URL` in backend doesn't have a trailing slash

## What Your Engineer Needs

If you're giving this to an engineer, they need:

1. Access to Firebase Console (to download the admin key)
2. Access to Stripe Dashboard (to get API keys and set up webhook)
3. Access to your hosting provider (to deploy and set environment variables)
4. This guide

That's it. Everything else is in the codebase.

## Quick Checklist

- [ ] Firebase Admin key downloaded and configured
- [ ] Stripe keys obtained (publishable and secret)
- [ ] Backend environment variables set
- [ ] Frontend environment variables set
- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Backend updated with frontend URL
- [ ] Stripe webhook configured and secret added to backend
- [ ] Tested signup, login, and payment flow

Once all these are checked, you're live!

## Questions?

If your engineer runs into issues, have them check:
1. Environment variables are set correctly (no typos, correct URLs)
2. Both services are actually running (test the URLs directly)
3. Logs from both backend and frontend hosting dashboards
4. Browser console for frontend errors

Most issues are usually missing or incorrect environment variables, so double-check those first.

Good luck with the deployment!

