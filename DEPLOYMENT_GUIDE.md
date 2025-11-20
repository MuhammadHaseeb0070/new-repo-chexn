# 🚀 Complete Deployment Guide - Free & Live Links

This guide will help you deploy both **Frontend** and **Backend** for FREE with live URLs that you can share with your client immediately.

---

## 📋 Pre-Deployment Checklist

Before starting, make sure you have:
- ✅ GitHub account (free)
- ✅ All environment variables ready
- ✅ Code committed and pushed to GitHub

---

## 🎯 Step 1: Prepare Your Code for Deployment

### 1.1 Create a GitHub Repository

1. Go to [github.com](https://github.com)
2. Click the **"+"** button → **"New repository"**
3. Name it: `chexn-project`
4. Make it **Private** (or Public, your choice)
5. Click **"Create repository"**

### 1.2 Push Your Code to GitHub

Open your terminal in the project root (`E:\Startup\ChexN-Project`) and run:

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for deployment"

# Add your GitHub repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/chexn-project.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note**: If git is already initialized, just run:
```bash
git add .
git commit -m "Ready for deployment"
git push
```

---

## 🔧 Step 2: Deploy Backend (Render.com - FREE)

### 2.1 Sign Up for Render

1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Sign up with your **GitHub account** (easiest)

### 2.2 Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository (`chexn-project`)
3. Select the repository
4. Configure the service:
   - **Name**: `chexn-backend`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && node server.js`
   - **Root Directory**: Leave empty (we'll specify in build command)

### 2.3 Set Environment Variables

In the Render dashboard, go to **Environment** tab and add:

```
FRONTEND_URL=https://chexn.vercel.app
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
FIREBASE_ADMIN_KEY_PATH=./firebase-admin-key.json
PORT=10000
CORS_ORIGINS=http://localhost:5173,https://chexn.vercel.app
```

**IMPORTANT**: 
- Replace `sk_test_...` with your actual Stripe secret key
- Replace `whsec_...` with your actual Stripe webhook secret
- We'll update `FRONTEND_URL` after frontend is deployed

### 2.4 Upload Firebase Admin Key

1. In Render, go to **Environment** tab
2. Scroll down to **"Secret Files"** section
3. Click **"Add Secret File"**
4. **Key**: `FIREBASE_ADMIN_KEY_PATH`
5. **Value**: Copy and paste the entire content of `backend/firebase-admin-key.json`
6. Click **"Add"**

**OR** better method - add it as environment variable (single line JSON):
1. In Environment tab, add a new variable:
   - **Key**: `FIREBASE_ADMIN_SERVICE_ACCOUNT`
   - **Value**: Copy entire JSON content from `firebase-admin-key.json` as a single line

Then we need to update `backend/config/firebase.js` to handle this. Let me provide an alternative approach:

### 2.5 Alternative: Store Firebase Key as Environment Variable

Actually, the easiest way is to convert the JSON to a single-line string. But for now, let's use the file upload method.

**After deployment starts:**
1. Render will build your backend
2. It will give you a URL like: `https://chexn-backend.onrender.com`
3. **Copy this URL** - you'll need it for frontend configuration

---

## 🎨 Step 3: Deploy Frontend (Vercel.com - FREE)

### 3.1 Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Sign up with your **GitHub account**

### 3.2 Import Project

1. Click **"Add New..."** → **"Project"**
2. Import your GitHub repository (`chexn-project`)
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend-web/chexn`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 3.3 Set Environment Variables

In Vercel dashboard, go to **Settings** → **Environment Variables** and add:

```
VITE_API_URL=https://chexn-backend.onrender.com/api
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_STRIPE_PUBLIC_KEY
VITE_FIREBASE_API_KEY=AIzaSyDtPa6Fk4m_2WxLyKBBEulC02bHYLRDJR8
VITE_FIREBASE_AUTH_DOMAIN=chexn-9745b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chexn-9745b
VITE_FIREBASE_STORAGE_BUCKET=chexn-9745b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=75693882893
VITE_FIREBASE_APP_ID=1:75693882893:web:21e9513cc2b85555a09f44
VITE_FIREBASE_MEASUREMENT_ID=G-7DT1E0KS4F
VITE_VAPID_KEY=BPPzaRvzF_1LllZRdC5u0iEKeTemNACN6E2TfQ3xKUL_TxgoOPbPB_tGWYXP8PwfcNxLztH5Lnafyl5LCqjx4uI
```

**IMPORTANT**: 
- Replace `pk_test_...` with your actual Stripe public key
- Replace the backend URL with your actual Render backend URL

### 3.4 Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. Vercel will give you a URL like: `https://chexn-project.vercel.app`
4. **Copy this URL**

---

## 🔄 Step 4: Update Backend with Frontend URL

1. Go back to Render dashboard
2. Click on your backend service
3. Go to **Environment** tab
4. Update `FRONTEND_URL` to your Vercel URL:
   ```
   FRONTEND_URL=https://chexn-project.vercel.app
   ```
5. Click **"Save Changes"**
6. Render will automatically redeploy

---

## ✅ Step 5: Test Your Deployment

### Test Backend:
1. Visit: `https://chexn-backend.onrender.com/api`
2. You should see: `{"message":"Hello from the ChexN Backend!"}`

### Test Frontend:
1. Visit your Vercel URL: `https://chexn-project.vercel.app`
2. Try signing up and logging in
3. Everything should work!

---

## 🔐 Step 6: Important Notes

### Backend URL Pattern:
- Your backend will be at: `https://chexn-backend.onrender.com`
- API endpoints: `https://chexn-backend.onrender.com/api`

### Frontend URL Pattern:
- Your frontend will be at: `https://chexn-project.vercel.app` (or your custom subdomain)

### Free Tier Limitations:
- **Render**: Free tier may spin down after 15 minutes of inactivity (first request may be slow)
- **Vercel**: Free tier is generous, no major limitations

### Update Stripe Webhook:
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://chexn-backend.onrender.com/api/subscriptions/webhook`
3. Copy the webhook signing secret
4. Update `STRIPE_WEBHOOK_SECRET` in Render environment variables

---

## 🐛 Troubleshooting

### Backend not starting?
- Check Render logs for errors
- Make sure all environment variables are set
- Verify Firebase admin key is uploaded correctly

### Frontend can't connect to backend?
- Check CORS settings in backend
- Verify `VITE_API_URL` is correct in Vercel
- Make sure backend URL includes `/api` at the end

### Build failing?
- Check logs in Render/Vercel dashboard
- Make sure all dependencies are in `package.json`
- Verify build commands are correct

---

## 📝 Quick Reference

### Backend Environment Variables (Render):
```
FRONTEND_URL=https://chexn-project.vercel.app
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FIREBASE_ADMIN_KEY_PATH=./firebase-admin-key.json
PORT=10000
CORS_ORIGINS=http://localhost:5173,https://chexn-project.vercel.app
```

### Frontend Environment Variables (Vercel):
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

## 🎉 You're Done!

You now have:
- ✅ Live backend URL: `https://chexn-backend.onrender.com`
- ✅ Live frontend URL: `https://chexn-project.vercel.app`
- ✅ Share these links with your client immediately!

