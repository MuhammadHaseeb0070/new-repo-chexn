<!-- 7dea4895-0bd7-4abb-9606-0bdae8e9b18d 1bb8a0ef-66d8-464c-8e27-7f9454d20c38 -->
# Remediate Billing Owner & Usage Bugs

## Tasks

- **server-propagation**: Patch backend creators (`backend/routes/adminRoutes.js`, `backend/routes/parentRoutes.js`, `backend/routes/employerRoutes.js`, `backend/routes/employerStaffRoutes.js`, `backend/routes/staffRoutes.js`, `backend/routes/districtRoutes.js`) so every creation/bulk-import path writes the parent `billingOwnerId` plus supporting metadata (`parentStudentLinks`, usage docs) that `usageTracker` expects.
- **usage-engine**: Rebuild `backend/utils/usageTracker.js` (and `backend/routes/usageRoutes.js`, `backend/middleware/subscriptionMiddleware.js`) so usage data includes aggregate + per-staff/per-school counts, and export the helper functions (`getUsage`, `updateUsage`, `refreshUsage`, `checkLimit`) that callers already depend on.
- **frontend-alignment**: Simplify managed-user UI (`frontend-web/chexn/src/App.jsx`, `components/SchoolStaffList.jsx`, `UsageDashboard.jsx`, `StaffDashboard.jsx`, `SubscriptionModal.jsx`) to rely solely on `profile.billingOwnerId` and `/subscriptions/current` + `/usage/current`, removing redundant `/district/coverage` lookups and fixing data-shape mismatches so managed admins see inherited plans instead of “No Subscription.”

### To-dos

- [ ] Fix backend billingOwnerId propagation
- [ ] Rebuild usage tracker + exports
- [ ] Align frontend subscription logic