# Stripe Subscription System - Implementation Summary

## Quick Overview

This document provides a high-level summary of the Stripe subscription implementation plan. For detailed information, see `STRIPE_SUBSCRIPTION_PLAN.md`.

---

## Key Concepts

### Who Pays?
- ✅ **Parents** - Pay to add children
- ✅ **School Admins** - Pay to add staff and students
- ✅ **District Admins** - Pay to add schools, staff, and students
- ✅ **Employer Admins** - Pay to add staff and employees
- ❌ **Everyone else** - Free (created by paying users)

### Package System
- Each paying role has multiple package tiers (Basic, Standard, Premium, etc.)
- Packages define limits (e.g., number of children, staff, students)
- Packages are easily configurable via `backend/config/packages.js`
- No code changes needed to update pricing or limits

---

## User Flow

### Sign-up Flow
```
1. User signs up (email/password)
   ↓
2. User selects role (Parent, School Admin, District, Employer)
   ↓
3. User selects package (if paying role)
   ↓
4. User redirected to Stripe Checkout
   ↓
5. After payment, subscription activated
   ↓
6. User can create resources up to package limits
```

### Dashboard Flow
```
1. User logs in
   ↓
2. Check subscription status
   ↓
3. If no subscription → Show package selection
   ↓
4. If subscription active → Show dashboard with usage info
   ↓
5. User can manage subscription, view usage, upgrade/downgrade
```

---

## Package Examples

### Parent Packages
- **Basic**: $9.99/month - 2 children
- **Standard**: $19.99/month - 5 children ⭐ (Popular)
- **Premium**: $39.99/month - 10 children

### School Admin Packages
- **Starter**: $49.99/month - 5 staff, 150 students (5 × 30)
- **Professional**: $99.99/month - 15 staff, 750 students (15 × 50) ⭐
- **Enterprise**: $199.99/month - 50 staff, 5,000 students (50 × 100)

### District Admin Packages
- **Small**: $299.99/month - 5 schools, 1,500 students
- **Medium**: $599.99/month - 15 schools, 15,000 students ⭐
- **Large**: $999.99/month - 50 schools, 250,000 students

### Employer Admin Packages
- **Small Business**: $79.99/month - 3 staff, 60 employees
- **Medium Business**: $149.99/month - 10 staff, 500 employees ⭐
- **Enterprise Business**: $299.99/month - 25 staff, 2,500 employees

---

## Database Structure

### Subscriptions Collection
```javascript
{
  userId: "uid",
  role: "parent" | "school-admin" | "district-admin" | "employer-admin",
  packageId: "basic" | "standard" | "premium",
  stripeSubscriptionId: "sub_xxx",
  stripeCustomerId: "cus_xxx",
  status: "active" | "canceled" | "past_due",
  limits: { children: 2, staff: 5, ... },
  currentPeriodStart: Timestamp,
  currentPeriodEnd: Timestamp
}
```

### Usage Collection
```javascript
{
  userId: "uid",
  usage: {
    children: 1, // current count
    staff: 2, // current count
    studentsByStaff: { staffId1: 10, staffId2: 15 }
  },
  lastUpdated: Timestamp
}
```

---

## Backend Endpoints

### Subscription Routes
- `GET /api/subscriptions/packages/:role` - Get packages for role
- `GET /api/subscriptions/current` - Get current subscription
- `POST /api/subscriptions/create-checkout-session` - Create Stripe checkout
- `POST /api/subscriptions/create-portal-session` - Open Stripe customer portal
- `POST /api/subscriptions/webhook` - Handle Stripe webhooks

### Usage Routes
- `GET /api/usage/current` - Get current usage
- `POST /api/usage/refresh` - Refresh usage counts

---

## Frontend Components

### New Components
1. **PackageSelection.jsx** - Package selection screen
2. **SubscriptionManagement.jsx** - Manage subscription
3. **UsageDashboard.jsx** - View usage vs limits

### Updated Components
1. **SelectRole.jsx** - Redirect to package selection after role selection
2. **CreateChild.jsx** - Check limits before creating
3. **CreateStaff.jsx** - Check limits before creating
4. **CreateStudent.jsx** - Check limits before creating
5. **CreateEmployee.jsx** - Check limits before creating
6. **App.jsx** - Show subscription status and usage warnings

---

## Limit Enforcement

### Before Creating Resource
1. Check if user has active subscription
2. Check current usage
3. Check if adding resource would exceed limit
4. Return error if limit exceeded

### Error Messages
- "You've reached your plan limit. Please upgrade to create more [resource]."
- "Your subscription has expired. Please renew to continue using ChexN."
- "You need an active subscription to create [resource]."

---

## Stripe Integration

### Setup
1. Install Stripe SDK: `npm install stripe`
2. Add Stripe keys to `.env`
3. Create products in Stripe Dashboard
4. Set up webhook endpoint

### Webhook Events
- `checkout.session.completed` - Subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Set up Stripe account and products
- Create package configuration file
- Design database schema
- Set up Stripe SDK and webhooks

### Phase 2: Backend (Week 2-3)
- Create subscription routes
- Create usage tracking routes
- Implement subscription middleware
- Update existing routes with limit checks
- Set up webhook handlers

### Phase 3: Frontend - Package Selection (Week 3-4)
- Create PackageSelection component
- Integrate with SelectRole flow
- Create checkout flow
- Test Stripe checkout

### Phase 4: Frontend - Subscription Management (Week 4-5)
- Create SubscriptionManagement component
- Create UsageDashboard component
- Integrate with dashboard
- Add usage warnings to create forms

### Phase 5: Testing & Polish (Week 5-6)
- End-to-end testing
- Fix bugs
- UI/UX improvements
- Documentation
- Deploy to production

---

## Key Features

### ✅ Easy Configuration
- Update packages in `packages.js` without code changes
- Change pricing, limits, and features easily

### ✅ Real-time Usage Tracking
- Track usage in real-time
- Show warnings when near limits
- Block creation when limit reached

### ✅ Stripe Customer Portal
- Users can manage subscription
- Update payment method
- View invoices
- Cancel subscription

### ✅ Webhook Processing
- Handle subscription updates automatically
- Sync subscription status with database
- Process payments and failures

### ✅ Limit Enforcement
- Check limits before creating resources
- Show clear error messages
- Provide upgrade options

---

## Security Considerations

### Backend Validation
- Always check subscription on backend
- Never trust frontend for limit checks
- Use middleware for protected routes

### Webhook Security
- Verify webhook signatures
- Implement idempotency
- Rate limit webhook endpoint

### Data Privacy
- Don't store credit card details
- Store only Stripe customer ID
- Encrypt sensitive data

---

## Future Enhancements

### Potential Features
- Annual plans with discount
- Add-ons for additional resources
- Free trial periods
- Promotional codes
- Usage analytics and reports
- Overage billing
- Prorated upgrades/downgrades

---

## Next Steps

1. **Review this plan** with the team
2. **Set up Stripe account** and create products
3. **Create package configuration** file
4. **Design database schema** and create collections
5. **Implement backend** subscription routes
6. **Implement frontend** package selection
7. **Test end-to-end** flow
8. **Deploy to production**

---

## Questions to Answer

Before implementation, decide on:
1. **Trial Period**: Should we offer free trials? How long?
2. **Annual Plans**: Should we offer annual plans from the start?
3. **Overage Handling**: Should we allow overages with additional charges?
4. **Refunds**: What's the refund policy?
5. **Cancellation**: Immediate cancellation or end of period?
6. **Upgrades/Downgrades**: Prorated or immediate?

---

## Documentation

- **Full Plan**: See `STRIPE_SUBSCRIPTION_PLAN.md`
- **Package Config**: See `backend/config/packages.example.js`
- **API Documentation**: See Appendix B in full plan
- **Database Schema**: See Appendix C in full plan

---

**Status**: Planning Phase  
**Version**: 1.0  
**Last Updated**: 2024

