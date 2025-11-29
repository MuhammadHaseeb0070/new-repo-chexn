# 🧭 ChexN Deployment Playbook (Shareable With Any DevOps Team)

> _“If you have the repo, you can ship this app. No hidden files, no voodoo. Just follow this and don’t skip steps.”_

This document is meant for whoever is taking over infrastructure. It explains **what secrets are needed**, **where they come from**, and **how to deploy both backend and frontend on any platform** (Render/Vercel are just examples). Keep it handy when onboarding vendors or moving between cloud providers.

---

## 1. Repo Layout & What’s Missing From Git

```
chexn-project/
├── backend/               # Express + Stripe + Firebase Admin API
│   ├── server.js
│   ├── routes/
│   ├── config/
│   └── ... (see repo)
├── frontend-web/
│   └── chexn/             # Vite + React app
│       ├── src/
│       └── ...
└── .env.example           # Provided in each package folder
```

### Files intentionally ignored (must be recreated):

| File | Why missing? | How to recreate |
| ---- | ------------ | --------------- |
| `backend/firebase-admin-key.json` | contains service account private key | download from Firebase Console (see Section 3.2) |
| `frontend-web/chexn/.env` | environment variables | copy `.env.example` → `.env`, fill with real values |
| `backend/.env` | backend env vars | copy `.env.example` → `.env`, fill in values |

If you have the repo but not these pieces, the app cannot boot. The rest of this doc explains how to generate them from scratch.

---

## 2. Required Accounts & Access

| Service | Purpose | Required access |
| ------- | ------- | --------------- |
| **Firebase** | Auth, Firestore, FCM | Project owner |
| **Stripe** | Subscriptions/billing | Standard dashboard access |
| **Hosting provider** | Render/Vercel/other | Ability to set env vars + deploy |

Optional (only if customizing notifications or analytics):
- Google Cloud Messaging (already part of Firebase project)
- Google Analytics (Measurement ID already supplied, but can replace)

---

## 3. Environment Variables & Secrets

You can deploy anywhere as long as you keep these variables intact. All names are hard-coded in code; please don’t rename them.

### 3.1 Frontend (`frontend-web/chexn/.env`)

| Key | Description | Source |
| --- | ----------- | ------ |
| `VITE_API_URL` | Backend base URL (ends with `/api`) | Hosting provider |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key (pk_test / pk_live) | Stripe Dashboard → Developers → API keys |
| `VITE_FIREBASE_API_KEY` | Firebase web API key | Firebase Console → Project Settings → General |
| `VITE_FIREBASE_AUTH_DOMAIN` | `project-id.firebaseapp.com` | Same place as above |
| `VITE_FIREBASE_PROJECT_ID` | e.g., `chexn-9745b` | Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | usually `project-id.firebasestorage.app` | Firebase |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | numeric sender id | Firebase |
| `VITE_FIREBASE_APP_ID` | `1:xxxx:web:xxxx` | Firebase |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional GA ID (`G-xxxx`) | Firebase (if GA enabled) |
| `VITE_VAPID_KEY` | Push notifications key | Firebase → Cloud Messaging → Web Push certificates |

> ✅ **Tip:** Frontend env values can be test-mode even if backend is production. Just be consistent (both sides must talk to the same Firebase/Stripe project).

### 3.2 Backend (`backend/.env`)

| Key | Description | Where to get it |
| --- | ----------- | --------------- |
| `FRONTEND_URL` | Base URL of deployed frontend (no trailing slash) | Hosting provider |
| `CORS_ORIGINS` | CSV list of allowed origins | e.g., `http://localhost:5173,https://app.mydomain.com` |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test / sk_live) | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe → Developers → Webhooks |
| `PORT` | Optional custom port (default 5000) | Hosting provider |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT` **OR** `FIREBASE_ADMIN_KEY_PATH` | See below | Firebase Console |

#### Firebase Admin credentials

2 ways to give the backend admin access:

1. **Service account JSON file**
   - Firebase Console → Project Settings → Service accounts → “Generate new private key”
   - Save as `backend/firebase-admin-key.json`
   - Set `FIREBASE_ADMIN_KEY_PATH=./firebase-admin-key.json`

2. **Environment variable (recommended for cloud hosting)**
   - Copy JSON contents to a single-line string
   - Set `FIREBASE_ADMIN_SERVICE_ACCOUNT={"type":"service_account",...}`
   - The backend automatically prefers env JSON over file path

> ⚠️ Never commit the JSON key or .env files. Share via password manager or secret manager only.

---

## 4. Build & Deployment Recipes (Any Provider)

### 4.1 Backend (Express + Stripe + Firebase)

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
2. **Provide env vars** (see Section 3.2). For local dev, create `.env`.
3. **Start server locally**
   ```bash
   npm run dev   # nodemon
   # or
   node server.js
   ```
4. **Expose webhook locally (when testing Stripe)**
   ```bash
   stripe listen --events checkout.session.completed,customer.subscription.updated,... --forward-to localhost:5000/api/subscriptions/webhook
   ```
5. **Deploy anywhere** (Render, Railway, Heroku, AWS, etc.)
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && node server.js`
   - Ensure port matches provider requirements (Render uses `$PORT`)
   - Set env vars in provider dashboard

### 4.2 Frontend (Vite + React)

1. **Install dependencies**
   ```bash
   cd frontend-web/chexn
   npm install
   ```
2. **Create `.env` from `.env.example`** and fill values.
3. **Run locally**
   ```bash
   npm run dev   # runs on http://localhost:5173
   ```
4. **Build**
   ```bash
   npm run build   # output in dist/
   ```
5. **Deploy** (Vercel/Netlify/S3/CloudFront/etc.)
   - Build command: `npm run build`
   - Output folder: `dist`
   - Root directory: `frontend-web/chexn`
   - Set env vars in hosting dashboard before build

---

## 5. Stripe Configuration Checklist

1. **API Keys**
   - Publishable key → frontend (`VITE_STRIPE_PUBLIC_KEY`)
   - Secret key → backend (`STRIPE_SECRET_KEY`)

2. **Webhook**
   - Endpoint URL: `https://<backend-domain>/api/subscriptions/webhook`
   - Events to enable (minimum set used by code):
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`

3. **Test Cards**
   - Use [Stripe test numbers](https://stripe.com/docs/testing) when `sk_test` + `pk_test` keys are set

4. **Going Live**
   - Swap keys with live versions
   - Update webhook endpoint to live backend domain
   - Re-run deployment

---

## 6. Firebase Configuration Checklist

1. **Firebase project** (`chexn-9745b` in our case):
   - Auth enabled (Email/Password)
   - Firestore rules configured (see repo for rules if needed)
   - Cloud Messaging enabled (for VAPID key)

2. **Web App credentials**
   - From Firebase Console → Project Settings → General → “Your apps” → Web
   - Copy config values into frontend `.env`

3. **Admin SDK key**
   - Generate once, share securely
   - Rotate if leaked

---

## 7. Deployment Targets (Examples)

### 7.1 Render (Backend)

Use these settings (already tested):

| Setting | Value |
| ------- | ----- |
| Runtime | Node |
| Region | `Oregon (US West)` (or closest) |
| Build command | `cd backend && npm install` |
| Start command | `cd backend && node server.js` |
| Root dir | leave blank |
| Auto deploy | On |
| Health check | `GET /api` |

### 7.2 Vercel (Frontend)

| Setting | Value |
| ------- | ----- |
| Framework | Vite |
| Root dir | `frontend-web/chexn` |
| Build command | `npm run build` |
| Output | `dist` |
| Install cmd | `npm install` |
| Env vars | from Section 3.1 |

### 7.3 Other providers

- **Netlify**: same as Vercel (set base dir + build command)
- **AWS Amplify**: connect repo, set build settings to run `npm install && npm run build` inside `frontend-web/chexn`
- **Heroku** (backend): add `Procfile` with `web: node server.js`, set env vars, push
- **Docker**: create `Dockerfile` per package; no custom code required

---

## 8. First-Run Checklist (Ops)

1. **Backend health check**
   ```
   curl https://<backend-domain>/api
   ```
2. **Frontend load**
   ```
   open https://<frontend-domain> in browser
   ```
3. **Signup/login flow** (test user)
4. **Stripe checkout flow** (test card)
5. **Verify Stripe webhook logs** (events received)
6. **Firebase logs** (no auth errors)
7. **FCM push token registration** (check backend log `/users/save-fcm-token`)

---

## 9. Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
| ------- | ------------ | ---- |
| `ERR_CONNECTION_REFUSED` | `VITE_API_URL` incorrect | Set to backend `/api` URL |
| CORS error | `FRONTEND_URL`/`CORS_ORIGINS` mismatch | Include exact frontend origin |
| Stripe “Payment succeeded” but app says inactive | Webhook not configured | Set `STRIPE_WEBHOOK_SECRET`, check webhook logs |
| Firebase “unauthorized” | Admin key missing or malformed | Re-upload JSON / env var |
| Push notifications broken | Missing `VITE_VAPID_KEY` | Copy from Firebase Cloud Messaging |
| `/subscription/success` 404 | Stripe redirect URL wrong | Use `FRONTEND_URL/?session_id=...` |

---

## 10. Hand-off Packet

When giving this project to another engineer, send:

1. **This document** (PDF or link)
2. `.env.example` files + explanations
3. `firebase-admin-key.json` (secure channel only)
4. Stripe API keys + webhook secret (password manager)
5. Existing backend/frontend deployment URLs (if any)

---

## 11. Contact Notes (internal)

- If the client wants to host somewhere else (Azure, GCP, bare metal), the only action items are:
  1. Install Node 18+
  2. Run the same build commands
  3. Export the same environment variables
  4. Expose port 5000 (or set `PORT`)
- There are no other external dependencies.

---

## 12. Quick Start (TL;DR)

1. Clone repo
2. Create `.env` files using `.env.example`
3. Fill every environment variable (Stripe, Firebase, URLs)
4. `npm install` in backend & frontend
5. Deploy backend (any Node host)
6. Deploy frontend (any static host)
7. Configure Stripe webhook
8. Test signup + checkout

Once all eight boxes are checked, you’re live.

---

_Written so that future-me (or any contractor) doesn’t have to reverse-engineer how this project ships._

