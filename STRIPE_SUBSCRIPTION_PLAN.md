# Stripe Subscription System - Implementation Plan

## Executive Summary

This document outlines the implementation plan for a role-based subscription system using Stripe. Only top-tier users (parents, school admins, district admins, employer admins) will pay. Sub-users (children, staff, students, employees) created by paying users will not pay.

---

## 1. User Role Hierarchy & Payment Structure

### 1.1 Payment Responsibility

| Role | Pays? | Creates | Limits Defined By |
|------|-------|---------|-------------------|
| **Parent** | ✅ Yes | Children | Package (max children) |
| **School Admin** | ✅ Yes | Staff (teachers, counselors, social workers) | Package (max staff, max students per staff) |
| **District Admin** | ✅ Yes | Schools | Package (max schools, max staff per school, max students per staff) |
| **Employer Admin** | ✅ Yes | Employer Staff (supervisors, HR) | Package (max staff, max employees per staff) |
| **School Staff** | ❌ No | Students | Limited by school admin's package |
| **Employer Staff** | ❌ No | Employees | Limited by employer admin's package |
| **Students/Children/Employees** | ❌ No | - | - |

### 1.2 Hierarchy Flow

```
Parent
  └── Children (no payment)

District Admin (pays)
  └── Schools (no payment, but have limits)
      └── School Staff (no payment)
          └── Students (no payment, limited by package)

School Admin (pays)
  └── School Staff (no payment)
      └── Students (no payment, limited by package)

Employer Admin (pays)
  └── Employer Staff (no payment)
      └── Employees (no payment, limited by package)
```

---

## 2. Package Structure & Configuration

### 2.1 Package Configuration File

Create a centralized configuration file: `backend/config/packages.js`

```javascript
// Package configurations - easily modifiable
module.exports = {
  parent: {
    basic: {
      name: "Basic Parent",
      price: 9.99, // Monthly
      currency: "usd",
      stripeProductId: "prod_parent_basic",
      limits: {
        children: 2
      },
      features: [
        "2 children",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions"
      ]
    },
    standard: {
      name: "Standard Parent",
      price: 19.99,
      currency: "usd",
      stripeProductId: "prod_parent_standard",
      limits: {
        children: 5
      },
      features: [
        "5 children",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Priority support"
      ]
    },
    premium: {
      name: "Premium Parent",
      price: 39.99,
      currency: "usd",
      stripeProductId: "prod_parent_premium",
      limits: {
        children: 10
      },
      features: [
        "10 children",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Priority support",
        "Advanced analytics"
      ]
    }
  },
  
  schoolAdmin: {
    starter: {
      name: "Starter School",
      price: 49.99,
      currency: "usd",
      stripeProductId: "prod_school_starter",
      limits: {
        staff: 5,
        studentsPerStaff: 30
      },
      features: [
        "5 staff members",
        "150 total students (5 × 30)",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions"
      ]
    },
    professional: {
      name: "Professional School",
      price: 99.99,
      currency: "usd",
      stripeProductId: "prod_school_professional",
      limits: {
        staff: 15,
        studentsPerStaff: 50
      },
      features: [
        "15 staff members",
        "750 total students (15 × 50)",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Advanced analytics",
        "Priority support"
      ]
    },
    enterprise: {
      name: "Enterprise School",
      price: 199.99,
      currency: "usd",
      stripeProductId: "prod_school_enterprise",
      limits: {
        staff: 50,
        studentsPerStaff: 100
      },
      features: [
        "50 staff members",
        "5,000 total students (50 × 100)",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Advanced analytics",
        "Priority support",
        "Custom integrations"
      ]
    }
  },
  
  districtAdmin: {
    small: {
      name: "Small District",
      price: 299.99,
      currency: "usd",
      stripeProductId: "prod_district_small",
      limits: {
        schools: 5,
        staffPerSchool: 10,
        studentsPerStaff: 30
      },
      features: [
        "5 schools",
        "50 total staff (5 × 10)",
        "1,500 total students (5 × 10 × 30)",
        "District-wide analytics",
        "Centralized management"
      ]
    },
    medium: {
      name: "Medium District",
      price: 599.99,
      currency: "usd",
      stripeProductId: "prod_district_medium",
      limits: {
        schools: 15,
        staffPerSchool: 20,
        studentsPerStaff: 50
      },
      features: [
        "15 schools",
        "300 total staff (15 × 20)",
        "15,000 total students (15 × 20 × 50)",
        "District-wide analytics",
        "Centralized management",
        "Priority support"
      ]
    },
    large: {
      name: "Large District",
      price: 999.99,
      currency: "usd",
      stripeProductId: "prod_district_large",
      limits: {
        schools: 50,
        staffPerSchool: 50,
        studentsPerStaff: 100
      },
      features: [
        "50 schools",
        "2,500 total staff (50 × 50)",
        "250,000 total students (50 × 50 × 100)",
        "District-wide analytics",
        "Centralized management",
        "Priority support",
        "Custom integrations",
        "Dedicated account manager"
      ]
    }
  },
  
  employerAdmin: {
    small: {
      name: "Small Business",
      price: 79.99,
      currency: "usd",
      stripeProductId: "prod_employer_small",
      limits: {
        staff: 3,
        employeesPerStaff: 20
      },
      features: [
        "3 staff members (supervisors/HR)",
        "60 total employees (3 × 20)",
        "Unlimited check-ins",
        "Scheduled questions",
        "Basic analytics"
      ]
    },
    medium: {
      name: "Medium Business",
      price: 149.99,
      currency: "usd",
      stripeProductId: "prod_employer_medium",
      limits: {
        staff: 10,
        employeesPerStaff: 50
      },
      features: [
        "10 staff members",
        "500 total employees (10 × 50)",
        "Unlimited check-ins",
        "Scheduled questions",
        "Advanced analytics",
        "Priority support"
      ]
    },
    enterprise: {
      name: "Enterprise Business",
      price: 299.99,
      currency: "usd",
      stripeProductId: "prod_employer_enterprise",
      limits: {
        staff: 25,
        employeesPerStaff: 100
      },
      features: [
        "25 staff members",
        "2,500 total employees (25 × 100)",
        "Unlimited check-ins",
        "Scheduled questions",
        "Advanced analytics",
        "Priority support",
        "Custom integrations"
      ]
    }
  }
};
```

### 2.2 Package Selection Logic

- **Parent**: Choose package based on number of children needed
- **School Admin**: Choose package based on number of staff and students
- **District Admin**: Choose package based on number of schools, staff, and students
- **Employer Admin**: Choose package based on number of staff and employees

---

## 3. Database Schema

### 3.1 Subscriptions Collection

```javascript
{
  userId: "uid",
  role: "parent" | "school-admin" | "district-admin" | "employer-admin",
  packageId: "basic" | "standard" | "premium" | "starter" | "professional" | etc.,
  stripeSubscriptionId: "sub_xxx",
  stripeCustomerId: "cus_xxx",
  status: "active" | "canceled" | "past_due" | "trialing",
  currentPeriodStart: Timestamp,
  currentPeriodEnd: Timestamp,
  cancelAtPeriodEnd: boolean,
  limits: {
    children: number, // for parent
    staff: number, // for school/employer admin
    schools: number, // for district admin
    studentsPerStaff: number, // for school/district admin
    employeesPerStaff: number // for employer admin
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 3.2 Usage Tracking Collection

```javascript
{
  userId: "uid",
  role: "parent" | "school-admin" | "district-admin" | "employer-admin",
  usage: {
    children: number, // current count
    staff: number, // current count
    schools: number, // current count (for district)
    studentsByStaff: { [staffId]: number }, // students per staff
    employeesByStaff: { [staffId]: number } // employees per staff
  },
  lastUpdated: Timestamp
}
```

### 3.3 Stripe Webhooks Collection (for logging)

```javascript
{
  stripeEventId: "evt_xxx",
  eventType: "customer.subscription.created" | "customer.subscription.updated" | etc.,
  userId: "uid",
  data: {}, // full webhook data
  processed: boolean,
  createdAt: Timestamp
}
```

---

## 4. Backend Architecture

### 4.1 New Routes

#### 4.1.1 Subscription Routes (`backend/routes/subscriptionRoutes.js`)

```javascript
// GET /api/subscriptions/packages/:role
// Returns available packages for a role

// GET /api/subscriptions/current
// Returns current user's subscription

// POST /api/subscriptions/create-checkout-session
// Creates Stripe checkout session

// POST /api/subscriptions/create-portal-session
// Creates Stripe customer portal session (for managing subscription)

// POST /api/subscriptions/webhook
// Handles Stripe webhooks (subscription updates, payments, etc.)

// GET /api/subscriptions/usage
// Returns current usage vs limits
```

#### 4.1.2 Usage Tracking Routes (`backend/routes/usageRoutes.js`)

```javascript
// GET /api/usage/current
// Returns current usage for the logged-in user

// POST /api/usage/refresh
// Manually refresh usage counts (admin only)
```

### 4.2 Middleware

#### 4.2.1 Subscription Check Middleware (`backend/middleware/subscriptionMiddleware.js`)

```javascript
// Checks if user has active subscription
// Checks if user has reached limits before creating resources
// Returns 403 if limit exceeded
```

### 4.3 Utility Functions

#### 4.3.1 Usage Tracking (`backend/utils/usageTracker.js`)

```javascript
// updateUsage(userId, resourceType, delta)
// getUsage(userId)
// checkLimit(userId, resourceType, requestedCount)
// refreshUsage(userId) // Recalculate from database
```

### 4.4 Integration Points

#### 4.4.1 Update Existing Routes

- **Parent Routes**: Check `children` limit before creating child
- **School Admin Routes**: Check `staff` limit before creating staff, check `studentsPerStaff` before staff creates student
- **District Admin Routes**: Check `schools` limit before creating school
- **Employer Admin Routes**: Check `staff` limit before creating staff, check `employeesPerStaff` before staff creates employee
- **Staff Routes**: Check `studentsPerStaff` limit before creating student
- **Employer Staff Routes**: Check `employeesPerStaff` limit before creating employee

---

## 5. Stripe Integration

### 5.1 Stripe Setup

1. Install Stripe SDK: `npm install stripe`
2. Add Stripe keys to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

### 5.2 Stripe Products & Prices

1. Create products in Stripe Dashboard for each package
2. Store product IDs in `packages.js` config
3. Use Stripe API to create products programmatically (optional)

### 5.3 Checkout Flow

1. User selects package
2. Backend creates Stripe Checkout Session
3. User redirected to Stripe Checkout
4. After payment, Stripe redirects to success page
5. Webhook confirms subscription creation
6. User's subscription activated

### 5.4 Webhook Handlers

Handle these Stripe webhook events:
- `checkout.session.completed` - Subscription created
- `customer.subscription.created` - Subscription activated
- `customer.subscription.updated` - Subscription updated (upgrade/downgrade)
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed

### 5.5 Customer Portal

- Allow users to manage subscription, update payment method, view invoices
- Use Stripe Customer Portal (hosted by Stripe)

---

## 6. Frontend Architecture

### 6.1 New Components

#### 6.1.1 Package Selection Component (`frontend-web/chexn/src/components/PackageSelection.jsx`)

- Shows available packages for user's role
- Displays features, limits, and pricing
- "Select Plan" button for each package
- Redirects to Stripe Checkout

#### 6.1.2 Subscription Management Component (`frontend-web/chexn/src/components/SubscriptionManagement.jsx`)

- Shows current subscription details
- Displays usage vs limits
- "Manage Subscription" button (opens Stripe Customer Portal)
- "Upgrade/Downgrade" options
- Cancel subscription option

#### 6.1.3 Usage Dashboard Component (`frontend-web/chexn/src/components/UsageDashboard.jsx`)

- Visual progress bars for each limit
- Current usage counts
- Remaining capacity
- Alerts when near limits

### 6.2 Updated Components

#### 6.2.1 SelectRole Component

- After role selection, redirect to package selection
- Skip package selection for non-paying roles (if any)

#### 6.2.2 CreateChild, CreateStaff, CreateStudent, CreateEmployee Components

- Check limits before showing create form
- Show warning if near limit
- Disable create button if limit reached
- Show usage info

#### 6.2.3 App.jsx / Dashboard Components

- Add subscription management link in navigation
- Show subscription status badge
- Show usage warnings

### 6.3 Flow Updates

#### 6.3.1 Sign-up Flow

```
1. User signs up (email/password)
2. User selects role
3. User selects package (if paying role)
4. User redirected to Stripe Checkout
5. After payment, user redirected to dashboard
6. Subscription activated via webhook
```

#### 6.3.2 Dashboard Flow

```
1. User logs in
2. Check subscription status
3. If no subscription (for paying role), show package selection
4. If subscription active, show dashboard
5. Show usage warnings if near limits
```

---

## 7. Usage Tracking Implementation

### 7.1 Real-time Usage Calculation

**Option 1: Calculate on-demand (Recommended for MVP)**
- Query database when needed
- Cache results for short period
- More accurate but slower

**Option 2: Maintain usage counter (Recommended for Production)**
- Update counter when resources created/deleted
- Faster but requires careful synchronization
- Use Firestore transactions for consistency

### 7.2 Usage Update Triggers

- **Child created/deleted**: Update parent's `children` count
- **Staff created/deleted**: Update admin's `staff` count
- **Student created/deleted**: Update staff's `students` count and admin's total
- **School created/deleted**: Update district's `schools` count
- **Employee created/deleted**: Update staff's `employees` count and admin's total

### 7.3 Usage Refresh

- Provide manual refresh button (admin only)
- Auto-refresh on dashboard load
- Background job to recalculate usage (daily)

---

## 8. Limit Enforcement

### 8.1 Pre-Creation Checks

Before creating a resource:
1. Check if user has active subscription
2. Check current usage
3. Check if adding resource would exceed limit
4. Return error if limit exceeded

### 8.2 Error Messages

- "You've reached your plan limit. Please upgrade to create more [resource]."
- "Your subscription has expired. Please renew to continue using ChexN."
- "You need an active subscription to create [resource]."

### 8.3 Grace Period

- Allow 7-day grace period after subscription expires
- Show warnings but allow limited functionality
- Block new resource creation after grace period

---

## 9. UI/UX Design

### 9.1 Package Selection Screen

- Clean, card-based layout
- Compare packages side-by-side
- Highlight recommended package
- Show savings for annual plans (if offered)
- Mobile-responsive

### 9.2 Subscription Management Screen

- Current plan card
- Usage progress bars
- Upgrade/downgrade options
- Payment method management
- Invoice history
- Cancel subscription option

### 9.3 Usage Dashboard

- Visual progress indicators
- Color-coded warnings (green/yellow/red)
- Quick actions (upgrade, manage)
- Historical usage charts (optional)

### 9.4 Limit Warnings

- Show warning when 80% of limit reached
- Show error when limit reached
- Provide upgrade CTA
- Show in relevant create forms

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Package configuration validation
- Usage calculation logic
- Limit checking logic
- Stripe webhook handling

### 10.2 Integration Tests

- Stripe checkout flow
- Webhook processing
- Subscription creation/update
- Usage tracking updates

### 10.3 E2E Tests

- Complete sign-up flow with payment
- Package selection and checkout
- Resource creation with limits
- Subscription management

---

## 11. Security Considerations

### 11.1 Stripe Webhook Security

- Verify webhook signatures
- Idempotency for webhook processing
- Rate limiting for webhook endpoint

### 11.2 Subscription Checks

- Verify subscription on backend (never trust frontend)
- Use middleware for all protected routes
- Validate limits before resource creation

### 11.3 Data Privacy

- Don't store full credit card details
- Store only Stripe customer ID
- Encrypt sensitive subscription data

---

## 12. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Stripe account and products
- [ ] Create package configuration file
- [ ] Design database schema
- [ ] Create subscription and usage collections
- [ ] Set up Stripe SDK and webhooks

### Phase 2: Backend (Week 2-3)
- [ ] Create subscription routes
- [ ] Create usage tracking routes
- [ ] Implement subscription middleware
- [ ] Implement usage tracking utilities
- [ ] Update existing routes with limit checks
- [ ] Set up webhook handlers

### Phase 3: Frontend - Package Selection (Week 3-4)
- [ ] Create PackageSelection component
- [ ] Integrate with SelectRole flow
- [ ] Create checkout flow
- [ ] Handle success/error states
- [ ] Test Stripe checkout

### Phase 4: Frontend - Subscription Management (Week 4-5)
- [ ] Create SubscriptionManagement component
- [ ] Create UsageDashboard component
- [ ] Integrate with dashboard
- [ ] Add usage warnings to create forms
- [ ] Test subscription management

### Phase 5: Testing & Polish (Week 5-6)
- [ ] End-to-end testing
- [ ] Fix bugs
- [ ] UI/UX improvements
- [ ] Documentation
- [ ] Deploy to production

---

## 13. Configuration Management

### 13.1 Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Frontend
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### 13.2 Package Updates

- Update `packages.js` to change pricing/limits
- No code changes needed for package updates
- Stripe products should match package IDs

### 13.3 Feature Flags

- Allow enabling/disabling subscription requirements
- Useful for testing and gradual rollout

---

## 14. Monitoring & Analytics

### 14.1 Key Metrics

- Subscription conversion rate
- Churn rate
- Average revenue per user (ARPU)
- Usage patterns
- Limit hit frequency

### 14.2 Alerts

- Failed payments
- Webhook processing failures
- Usage anomalies
- Subscription cancellations

### 14.3 Logging

- All subscription events
- Webhook processing
- Usage updates
- Limit violations

---

## 15. Future Enhancements

### 15.1 Annual Plans
- Offer annual plans with discount
- Prorated upgrades/downgrades

### 15.2 Add-ons
- Allow purchasing additional resources
- Overage billing

### 15.3 Trial Periods
- Free trial for new users
- Trial expiration handling

### 15.4 Promotional Codes
- Discount codes
- Referral programs

### 15.5 Usage Analytics
- Detailed usage reports
- Export functionality
- Historical trends

---

## 16. Decision Points

### 16.1 Package Pricing
- ✅ **Decision**: Start with monthly pricing, add annual later
- **Rationale**: Simpler to implement, easier to change

### 16.2 Usage Calculation
- ✅ **Decision**: Calculate on-demand for MVP, maintain counters for production
- **Rationale**: Faster development, can optimize later

### 16.3 Limit Enforcement
- ✅ **Decision**: Hard limits (block creation), no overages
- **Rationale**: Clearer user experience, predictable costs

### 16.4 Grace Period
- ✅ **Decision**: 7-day grace period after expiration
- **Rationale**: Better UX, reduces churn

### 16.5 Webhook Processing
- ✅ **Decision**: Process webhooks asynchronously, use queue if needed
- **Rationale**: Better reliability, can handle high volume

---

## 17. Open Questions

1. **Trial Period**: Should we offer free trials? If yes, how long?
2. **Annual Plans**: Should we offer annual plans from the start?
3. **Overage Handling**: Should we allow overages with additional charges?
4. **Refunds**: What's the refund policy?
5. **Cancellation**: Immediate cancellation or end of period?
6. **Upgrades/Downgrades**: Prorated or immediate?
7. **Multiple Subscriptions**: Can a user have multiple subscriptions (e.g., parent + school admin)?

---

## 18. Conclusion

This implementation plan provides a comprehensive roadmap for integrating Stripe subscriptions into the ChexN platform. The system is designed to be:

- **Flexible**: Easy to update packages and pricing
- **Scalable**: Can handle growth and new features
- **User-friendly**: Clear limits and usage tracking
- **Secure**: Proper validation and webhook handling
- **Maintainable**: Centralized configuration and clear architecture

The phased approach allows for incremental development and testing, reducing risk and enabling early feedback.

---

## Appendix A: Package Configuration Examples

See `backend/config/packages.js` for full package configurations.

## Appendix B: API Endpoints Summary

### Subscription Endpoints
- `GET /api/subscriptions/packages/:role` - Get packages for role
- `GET /api/subscriptions/current` - Get current subscription
- `POST /api/subscriptions/create-checkout-session` - Create checkout session
- `POST /api/subscriptions/create-portal-session` - Create portal session
- `POST /api/subscriptions/webhook` - Stripe webhook handler

### Usage Endpoints
- `GET /api/usage/current` - Get current usage
- `POST /api/usage/refresh` - Refresh usage (admin only)

## Appendix C: Database Collections

### Collections
- `subscriptions` - User subscriptions
- `usage` - Usage tracking
- `stripeWebhooks` - Webhook logs (optional)

### Existing Collections (updated)
- `users` - Add `subscriptionId` field (optional)
- `organizations` - Add subscription info (optional)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: ChexN Development Team

