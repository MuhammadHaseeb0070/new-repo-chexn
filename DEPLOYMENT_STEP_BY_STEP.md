# 🚀 Step-by-Step Deployment Guide (Ultra Detailed)

Follow these steps **EXACTLY** in order. Don't skip any step!

---

## 📦 PART 1: Prepare Code for GitHub

### Step 1.1: Check Your Code is Ready

1. Open terminal in: `E:\Startup\ChexN-Project`
2. Make sure all files are saved
3. Check that `.env.example` files exist in both `frontend-web/chexn/` and `backend/` folders

### Step 1.2: Create `.gitignore` (if needed)

Check if `.gitignore` exists. If not, create it with this content:

```
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.production

# Build outputs
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Firebase
firebase-admin-key.json
*.log
```

### Step 1.3: Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - Ready for deployment"
```

---

## 📤 PART 2: Push to GitHub

### Step 2.1: Create GitHub Repository

1. Go to **github.com** and sign in
2. Click **"+"** icon (top right) → **"New repository"**
3. Repository name: `chexn-project`
4. Description: `ChexN Project - Check-in Management System`
5. Choose **Private** or **Public** (Private is safer)
6. **DO NOT** check "Initialize with README" (we already have code)
7. Click **"Create repository"**

### Step 2.2: Connect and Push

After creating repository, GitHub will show you commands. Copy and run these:

```bash
# Add your GitHub repository as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/chexn-project.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

**If git asks for credentials:**
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (not your password)
  - Go to: GitHub → Settings → Developer settings → Personal access tokens → Generate new token
  - Check `repo` permission
  - Copy token and use it as password

---

## 🔧 PART 3: Deploy Backend on Render.com

### Step 3.1: Sign Up for Render

1. Go to **[render.com](https://render.com)**
2. Click **"Get Started for Free"**
3. Click **"Sign Up with GitHub"** (EASIEST METHOD)
4. Authorize Render to access your GitHub

### Step 3.2: Create New Web Service

1. In Render dashboard, click **"New +"** button (top right)
2. Click **"Web Service"**
3. You'll see "Connect a repository" screen
4. Click **"Configure account"** or **"Connect GitHub"** if not connected
5. Select your GitHub account
6. Find and select repository: **`chexn-project`**
7. Click **"Connect"**

### Step 3.3: Configure Backend Service

Fill in these fields **EXACTLY**:

- **Name**: `chexn-backend`
- **Environment**: Select **`Node`**
- **Region**: Choose closest to you (e.g., `Oregon (US West)`)
- **Branch**: `main`
- **Root Directory**: **LEAVE EMPTY** (don't fill this!)
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && node server.js`
- **Instance Type**: **Free** (default)

Click **"Create Web Service"**

### Step 3.4: Add Environment Variables

**BEFORE** deployment starts, add environment variables:

1. In your new service dashboard, click **"Environment"** tab (left sidebar)
2. Click **"Add Environment Variable"** button
3. Add each variable **ONE BY ONE**:

**Variable 1:**
- Key: `FRONTEND_URL`
- Value: `https://placeholder.vercel.app` (we'll update this later)
- Click **"Save"**

**Variable 2:**
- Key: `STRIPE_SECRET_KEY`
- Value: `sk_test_YOUR_ACTUAL_STRIPE_SECRET_KEY` (get from Stripe Dashboard)
- Click **"Save"**

**Variable 3:**
- Key: `STRIPE_WEBHOOK_SECRET`
- Value: `whsec_YOUR_ACTUAL_WEBHOOK_SECRET` (we'll get this after webhook setup)
- Click **"Save"`

**Variable 4:**
- Key: `FIREBASE_ADMIN_SERVICE_ACCOUNT`
- Value: Open `backend/firebase-admin-key.json` file, copy **ENTIRE content**, paste here as **ONE LINE**
  - Make sure it's valid JSON (no line breaks)
  - It should start with `{"type":"service_account",...}`
- Click **"Save"**

**Variable 5:**
- Key: `PORT`
- Value: `10000`
- Click **"Save"**

**Variable 6:**
- Key: `CORS_ORIGINS`
- Value: `http://localhost:5173,https://placeholder.vercel.app`
- Click **"Save"**

### Step 3.5: Wait for Deployment

1. Render will automatically start deploying
2. You'll see build logs in real-time
3. Wait 3-5 minutes for deployment to complete
4. When done, you'll see: **"Live"** status

### Step 3.6: Get Your Backend URL

1. At the top of your service dashboard, you'll see a URL like:
   - `https://chexn-backend.onrender.com`
2. **COPY THIS URL** - you'll need it!

### Step 3.7: Test Backend

1. Open new browser tab
2. Visit: `https://chexn-backend.onrender.com/api`
3. You should see: `{"message":"Hello from the ChexN Backend!"}`
4. ✅ **Backend is working!**

---

## 🎨 PART 4: Deploy Frontend on Vercel.com

### Step 4.1: Sign Up for Vercel

1. Go to **[vercel.com](https://vercel.com)**
2. Click **"Sign Up"** (top right)
3. Click **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub

### Step 4.2: Import Project

1. In Vercel dashboard, click **"Add New..."** button
2. Click **"Project"**
3. You'll see your GitHub repositories
4. Find and click **`chexn-project`** repository
5. Click **"Import"**

### Step 4.3: Configure Frontend Project

**IMPORTANT**: Configure these settings:

1. **Project Name**: `chexn-frontend` (or anything you like)
2. **Framework Preset**: Already set to `Vite` (don't change)
3. **Root Directory**: Click **"Edit"** and set to: `frontend-web/chexn`
   - This tells Vercel where your frontend code is
4. **Build Command**: `npm run build` (should be auto-filled)
5. **Output Directory**: `dist` (should be auto-filled)
6. **Install Command**: `npm install` (should be auto-filled)

**DO NOT** click "Deploy" yet! First add environment variables.

### Step 4.4: Add Environment Variables

**BEFORE** clicking Deploy, add environment variables:

1. Expand **"Environment Variables"** section
2. Click **"Add another"** for each variable

**Variable 1:**
- Key: `VITE_API_URL`
- Value: `https://chexn-backend.onrender.com/api` (use YOUR backend URL from Step 3.6)
- Environments: Check **Production**, **Preview**, and **Development**
- Click **"Add"**

**Variable 2:**
- Key: `VITE_STRIPE_PUBLIC_KEY`
- Value: `pk_test_YOUR_ACTUAL_STRIPE_PUBLIC_KEY` (get from Stripe Dashboard)
- Environments: Check all three
- Click **"Add"**

**Variable 3:**
- Key: `VITE_FIREBASE_API_KEY`
- Value: `AIzaSyDtPa6Fk4m_2WxLyKBBEulC02bHYLRDJR8`
- Environments: Check all three
- Click **"Add"**

**Variable 4:**
- Key: `VITE_FIREBASE_AUTH_DOMAIN`
- Value: `chexn-9745b.firebaseapp.com`
- Environments: Check all three
- Click **"Add"**

**Variable 5:**
- Key: `VITE_FIREBASE_PROJECT_ID`
- Value: `chexn-9745b`
- Environments: Check all three
- Click **"Add"**

**Variable 6:**
- Key: `VITE_FIREBASE_STORAGE_BUCKET`
- Value: `chexn-9745b.firebasestorage.app`
- Environments: Check all three
- Click **"Add"`

**Variable 7:**
- Key: `VITE_FIREBASE_MESSAGING_SENDER_ID`
- Value: `75693882893`
- Environments: Check all three
- Click **"Add"**

**Variable 8:**
- Key: `VITE_FIREBASE_APP_ID`
- Value: `1:75693882893:web:21e9513cc2b85555a09f44`
- Environments: Check all three
- Click **"Add"**

**Variable 9:**
- Key: `VITE_FIREBASE_MEASUREMENT_ID`
- Value: `G-7DT1E0KS4F`
- Environments: Check all three
- Click **"Add"**

**Variable 10:**
- Key: `VITE_VAPID_KEY`
- Value: `BPPzaRvzF_1LllZRdC5u0iEKeTemNACN6E2TfQ3xKUL_TxgoOPbPB_tGWYXP8PwfcNxLztH5Lnafyl5LCqjx4uI`
- Environments: Check all three
- Click **"Add"**

### Step 4.5: Deploy Frontend

1. Click **"Deploy"** button (bottom of page)
2. Wait 2-3 minutes
3. Vercel will show build progress
4. When done, you'll see: **"Ready"** status

### Step 4.6: Get Your Frontend URL

1. In deployment page, you'll see a URL like:
   - `https://chexn-project.vercel.app`
   - Or `https://chexn-frontend.vercel.app`
2. **COPY THIS URL** - this is your live frontend!

---

## 🔄 PART 5: Update Backend with Frontend URL

### Step 5.1: Update Render Environment Variables

1. Go back to **Render.com** dashboard
2. Click on your **`chexn-backend`** service
3. Go to **"Environment"** tab
4. Find **`FRONTEND_URL`** variable
5. Click **"Edit"** (pencil icon)
6. Change value to: Your Vercel frontend URL (from Step 4.6)
7. Click **"Save Changes"**

### Step 5.2: Update CORS_ORIGINS

1. Find **`CORS_ORIGINS`** variable
2. Click **"Edit"**
3. Change to: `http://localhost:5173,https://YOUR_VERCEL_URL.vercel.app`
   - Replace `YOUR_VERCEL_URL` with your actual Vercel URL
4. Click **"Save Changes"**

### Step 5.3: Wait for Redeploy

1. Render will automatically redeploy (takes 2-3 minutes)
2. Wait until status shows **"Live"** again

---

## 🔗 PART 6: Set Up Stripe Webhook

### Step 6.1: Get Your Backend Webhook URL

Your webhook endpoint is:
```
https://chexn-backend.onrender.com/api/subscriptions/webhook
```
(Replace with YOUR backend URL)

### Step 6.2: Add Webhook in Stripe Dashboard

1. Go to **[dashboard.stripe.com](https://dashboard.stripe.com)**
2. Click **"Developers"** → **"Webhooks"** (left sidebar)
3. Click **"Add endpoint"** button
4. **Endpoint URL**: Paste your webhook URL from Step 6.1
5. Click **"Select events"**
6. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
7. Click **"Add events"**
8. Click **"Add endpoint"**

### Step 6.3: Copy Webhook Signing Secret

1. After creating webhook, click on it
2. Find **"Signing secret"** section
3. Click **"Reveal"** button
4. **COPY** the secret (starts with `whsec_...`)

### Step 6.4: Update Render Environment Variable

1. Go back to **Render.com**
2. Click on **`chexn-backend`** service
3. Go to **"Environment"** tab
4. Find **`STRIPE_WEBHOOK_SECRET`** variable
5. Click **"Edit"**
6. Paste the signing secret you copied
7. Click **"Save Changes"**
8. Wait for redeploy (2-3 minutes)

---

## ✅ PART 7: Test Everything

### Test 1: Backend Health Check

1. Visit: `https://chexn-backend.onrender.com/api`
2. Should show: `{"message":"Hello from the ChexN Backend!"}`
3. ✅ **PASSED**

### Test 2: Frontend Loads

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Should see login/signup page
3. ✅ **PASSED**

### Test 3: Sign Up & Login

1. Click **"Sign Up"**
2. Create a test account
3. Should redirect to dashboard
4. ✅ **PASSED**

### Test 4: API Connection

1. After logging in, check browser console (F12)
2. Should NOT see `ERR_CONNECTION_REFUSED` errors
3. Should see successful API calls
4. ✅ **PASSED**

---

## 🎉 SUCCESS! Share Your Links

You now have:

✅ **Backend URL**: `https://chexn-backend.onrender.com`  
✅ **Frontend URL**: `https://your-project.vercel.app`

**Share the Frontend URL with your client!**

---

## 🆘 TROUBLESHOOTING

### Backend not starting?

1. Go to Render → Your service → **"Logs"** tab
2. Look for error messages
3. Common issues:
   - Missing environment variables
   - Invalid Firebase admin key JSON
   - Port configuration

### Frontend shows blank page?

1. Go to Vercel → Your project → **"Deployments"** → Click latest deployment
2. Check **"Build Logs"**
3. Common issues:
   - Missing environment variables
   - Build errors
   - Incorrect root directory

### "Network Error" in browser console?

1. Check `VITE_API_URL` in Vercel is correct
2. Make sure it ends with `/api`
3. Check backend CORS settings
4. Test backend URL directly in browser

### Firebase errors?

1. Check all `VITE_FIREBASE_*` variables are set in Vercel
2. Verify Firebase Admin key is correctly set in Render
3. Make sure Firebase project settings match

---

## 📝 QUICK REFERENCE

### Your URLs:
- **Backend**: `https://chexn-backend.onrender.com`
- **Frontend**: `https://your-project.vercel.app`

### Render Environment Variables:
```
FRONTEND_URL=https://your-project.vercel.app
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FIREBASE_ADMIN_SERVICE_ACCOUNT={"type":"service_account",...}
PORT=10000
CORS_ORIGINS=http://localhost:5173,https://your-project.vercel.app
```

### Vercel Environment Variables:
```
VITE_API_URL=https://chexn-backend.onrender.com/api
VITE_STRIPE_PUBLIC_KEY=pk_test_...
VITE_FIREBASE_API_KEY=AIzaSyDtPa6Fk4m_2WxLyKBBEulC02bHYLRDJR8
VITE_FIREBASE_AUTH_DOMAIN=chexn-9745b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chexn-9745b
VITE_FIREBASE_STORAGE_BUCKET=chexn-9745b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=75693882893
VITE_FIREBASE_APP_ID=1:75693882893:web:21e9513cc2b85555a09f44
VITE_FIREBASE_MEASUREMENT_ID=G-7DT1E0KS4F
VITE_VAPID_KEY=BPPzaRvzF_1LllZRdC5u0iEKeTemNACN6E2TfQ3xKUL_TxgoOPbPB_tGWYXP8PwfcNxLztH5Lnafyl5LCqjx4uI
```

---

**That's it! Follow these steps EXACTLY and you'll have a live deployment in 30 minutes! 🚀**

