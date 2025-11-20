# ✅ Deployment Checklist

Use this checklist to ensure you complete all steps correctly.

---

## 📋 Pre-Deployment

- [ ] All code is committed to git
- [ ] `.gitignore` includes `firebase-admin-key.json` and `.env` files
- [ ] Code pushed to GitHub successfully

---

## 🔧 Backend Deployment (Render.com)

### Setup
- [ ] Signed up for Render.com with GitHub
- [ ] Created new Web Service
- [ ] Connected GitHub repository
- [ ] Set Root Directory: (leave empty)
- [ ] Set Build Command: `cd backend && npm install`
- [ ] Set Start Command: `cd backend && node server.js`

### Environment Variables Added:
- [ ] `FRONTEND_URL` = `https://placeholder.vercel.app` (will update later)
- [ ] `STRIPE_SECRET_KEY` = `sk_test_...` (your actual key)
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...` (will update after webhook setup)
- [ ] `FIREBASE_ADMIN_SERVICE_ACCOUNT` = `{"type":"service_account",...}` (entire JSON as one line)
- [ ] `PORT` = `10000`
- [ ] `CORS_ORIGINS` = `http://localhost:5173,https://placeholder.vercel.app`

### Deployment
- [ ] Deployment completed successfully
- [ ] Backend URL obtained: `https://______________.onrender.com`
- [ ] Backend health check passed: Visit `/api` endpoint shows success message

---

## 🎨 Frontend Deployment (Vercel.com)

### Setup
- [ ] Signed up for Vercel.com with GitHub
- [ ] Imported GitHub repository
- [ ] Set Root Directory: `frontend-web/chexn`
- [ ] Framework Preset: `Vite`

### Environment Variables Added (all 10):
- [ ] `VITE_API_URL` = `https://______________.onrender.com/api` (your backend URL + `/api`)
- [ ] `VITE_STRIPE_PUBLIC_KEY` = `pk_test_...` (your actual key)
- [ ] `VITE_FIREBASE_API_KEY` = `AIzaSyDtPa6Fk4m_2WxLyKBBEulC02bHYLRDJR8`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN` = `chexn-9745b.firebaseapp.com`
- [ ] `VITE_FIREBASE_PROJECT_ID` = `chexn-9745b`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET` = `chexn-9745b.firebasestorage.app`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID` = `75693882893`
- [ ] `VITE_FIREBASE_APP_ID` = `1:75693882893:web:21e9513cc2b85555a09f44`
- [ ] `VITE_FIREBASE_MEASUREMENT_ID` = `G-7DT1E0KS4F`
- [ ] `VITE_VAPID_KEY` = `BPPzaRvzF_1LllZRdC5u0iEKeTemNACN6E2TfQ3xKUL_TxgoOPbPB_tGWYXP8PwfcNxLztH5Lnafyl5LCqjx4uI`

### Deployment
- [ ] Deployment completed successfully
- [ ] Frontend URL obtained: `https://______________.vercel.app`
- [ ] Frontend loads correctly (no blank page)

---

## 🔄 Post-Deployment Updates

### Update Backend
- [ ] Updated `FRONTEND_URL` in Render with actual Vercel URL
- [ ] Updated `CORS_ORIGINS` in Render with actual Vercel URL
- [ ] Backend redeployed successfully

### Stripe Webhook Setup
- [ ] Created webhook endpoint in Stripe Dashboard
- [ ] Webhook URL: `https://______________.onrender.com/api/subscriptions/webhook`
- [ ] Selected events:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] Copied webhook signing secret
- [ ] Updated `STRIPE_WEBHOOK_SECRET` in Render
- [ ] Backend redeployed after webhook secret update

---

## ✅ Final Testing

- [ ] Backend health check: `/api` returns success
- [ ] Frontend loads: No blank page, login/signup visible
- [ ] Can sign up: New account created successfully
- [ ] Can login: Login works with created account
- [ ] API connection: No `ERR_CONNECTION_REFUSED` errors in browser console
- [ ] Dashboard loads: After login, dashboard appears

---

## 📝 Final URLs

**Backend URL:**
```
https://______________.onrender.com
```

**Frontend URL:**
```
https://______________.vercel.app
```

**Webhook URL (for Stripe):**
```
https://______________.onrender.com/api/subscriptions/webhook
```

---

## 🎉 Ready to Share!

Once all checkboxes are checked, share the **Frontend URL** with your client!

---

## 🆘 If Something Goes Wrong

1. Check deployment logs in Render/Vercel
2. Verify all environment variables are set correctly
3. Test backend URL directly in browser
4. Check browser console for errors (F12)
5. Review `DEPLOYMENT_STEP_BY_STEP.md` for detailed troubleshooting

