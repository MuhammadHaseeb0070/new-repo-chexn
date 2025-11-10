// Package Configuration File
// This file contains all subscription package definitions
// Update pricing, limits, and features here without code changes

module.exports = {
  // PARENT PACKAGES
  parent: {
    basic: {
      name: "Basic Parent",
      price: 9.99, // Monthly in USD
      currency: "usd",
      billingInterval: "month", // "month" or "year"
      stripeProductId: "prod_parent_basic", // Stripe Product ID
      stripePriceId: "price_parent_basic_monthly", // Stripe Price ID
      limits: {
        children: 2
      },
      features: [
        "2 children",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Email support"
      ],
      popular: false
    },
    standard: {
      name: "Standard Parent",
      price: 19.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_parent_standard",
      stripePriceId: "price_parent_standard_monthly",
      limits: {
        children: 5
      },
      features: [
        "5 children",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Priority support",
        "Advanced notifications"
      ],
      popular: true // Highlight this package
    },
    premium: {
      name: "Premium Parent",
      price: 39.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_parent_premium",
      stripePriceId: "price_parent_premium_monthly",
      limits: {
        children: 10
      },
      features: [
        "10 children",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Priority support",
        "Advanced analytics",
        "Export data"
      ],
      popular: false
    }
  },

  // SCHOOL ADMIN PACKAGES
  schoolAdmin: {
    starter: {
      name: "Starter School",
      price: 49.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_school_starter",
      stripePriceId: "price_school_starter_monthly",
      limits: {
        staff: 5,
        studentsPerStaff: 30
      },
      features: [
        "5 staff members",
        "150 total students (5 × 30)",
        "Unlimited check-ins",
        "Geofence alerts",
        "Scheduled questions",
        "Basic analytics",
        "Email support"
      ],
      popular: false
    },
    professional: {
      name: "Professional School",
      price: 99.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_school_professional",
      stripePriceId: "price_school_professional_monthly",
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
        "Priority support",
        "Export data"
      ],
      popular: true
    },
    enterprise: {
      name: "Enterprise School",
      price: 199.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_school_enterprise",
      stripePriceId: "price_school_enterprise_monthly",
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
        "Custom integrations",
        "Dedicated support"
      ],
      popular: false
    }
  },

  // DISTRICT ADMIN PACKAGES
  districtAdmin: {
    small: {
      name: "Small District",
      price: 299.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_district_small",
      stripePriceId: "price_district_small_monthly",
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
        "Centralized management",
        "Multi-school dashboard",
        "Email support"
      ],
      popular: false
    },
    medium: {
      name: "Medium District",
      price: 599.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_district_medium",
      stripePriceId: "price_district_medium_monthly",
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
        "Multi-school dashboard",
        "Priority support",
        "Custom reports"
      ],
      popular: true
    },
    large: {
      name: "Large District",
      price: 999.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_district_large",
      stripePriceId: "price_district_large_monthly",
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
        "Multi-school dashboard",
        "Priority support",
        "Custom integrations",
        "Dedicated account manager",
        "API access"
      ],
      popular: false
    }
  },

  // EMPLOYER ADMIN PACKAGES
  employerAdmin: {
    small: {
      name: "Small Business",
      price: 79.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_employer_small",
      stripePriceId: "price_employer_small_monthly",
      limits: {
        staff: 3,
        employeesPerStaff: 20
      },
      features: [
        "3 staff members (supervisors/HR)",
        "60 total employees (3 × 20)",
        "Unlimited check-ins",
        "Scheduled questions",
        "Basic analytics",
        "Email support"
      ],
      popular: false
    },
    medium: {
      name: "Medium Business",
      price: 149.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_employer_medium",
      stripePriceId: "price_employer_medium_monthly",
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
        "Priority support",
        "Export data"
      ],
      popular: true
    },
    enterprise: {
      name: "Enterprise Business",
      price: 299.99,
      currency: "usd",
      billingInterval: "month",
      stripeProductId: "prod_employer_enterprise",
      stripePriceId: "price_employer_enterprise_monthly",
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
        "Custom integrations",
        "Dedicated support",
        "API access"
      ],
      popular: false
    }
  }
};

// Helper function to get package by role and packageId
function getPackage(role, packageId) {
  const rolePackages = module.exports[role];
  if (!rolePackages) {
    throw new Error(`Invalid role: ${role}`);
  }
  const pkg = rolePackages[packageId];
  if (!pkg) {
    throw new Error(`Invalid package: ${packageId} for role: ${role}`);
  }
  return pkg;
}

// Helper function to get all packages for a role
function getPackagesForRole(role) {
  const rolePackages = module.exports[role];
  if (!rolePackages) {
    return [];
  }
  return Object.entries(rolePackages).map(([id, pkg]) => ({
    id,
    ...pkg
  }));
}

// Helper function to validate package limits
function validatePackage(role, packageId) {
  try {
    const pkg = getPackage(role, packageId);
    // Validate required fields
    if (!pkg.name || !pkg.price || !pkg.limits) {
      throw new Error("Package missing required fields");
    }
    // Validate limits based on role
    if (role === "parent" && typeof pkg.limits.children !== "number") {
      throw new Error("Parent package must have children limit");
    }
    if (role === "schoolAdmin" && (!pkg.limits.staff || !pkg.limits.studentsPerStaff)) {
      throw new Error("School admin package must have staff and studentsPerStaff limits");
    }
    if (role === "districtAdmin" && (!pkg.limits.schools || !pkg.limits.staffPerSchool || !pkg.limits.studentsPerStaff)) {
      throw new Error("District admin package must have schools, staffPerSchool, and studentsPerStaff limits");
    }
    if (role === "employerAdmin" && (!pkg.limits.staff || !pkg.limits.employeesPerStaff)) {
      throw new Error("Employer admin package must have staff and employeesPerStaff limits");
    }
    return true;
  } catch (error) {
    console.error(`Package validation failed: ${error.message}`);
    return false;
  }
}

module.exports.getPackage = getPackage;
module.exports.getPackagesForRole = getPackagesForRole;
module.exports.validatePackage = validatePackage;

