// Usage tracking utilities
// Tracks current usage vs subscription limits

const { db } = require('../config/firebase');
const packages = require('../config/packages');

/**
 * Get current usage for a user
 */
async function getUsage(userId) {
  try {
    const usageRef = db.collection('usage').doc(userId);
    const usageDoc = await usageRef.get();
    
    if (!usageDoc.exists) {
      // Initialize usage if doesn't exist
      return await initializeUsage(userId);
    }
    
    return usageDoc.data();
  } catch (error) {
    console.error('Error getting usage:', error);
    throw error;
  }
}

/**
 * Initialize usage tracking for a user
 */
async function initializeUsage(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const role = userData.role;
    
    // Calculate initial usage based on role
    const usage = await calculateUsage(userId, role);
    
    // Save to database
    await db.collection('usage').doc(userId).set({
      userId,
      role,
      usage,
      lastUpdated: new Date()
    });
    
    return { userId, role, usage, lastUpdated: new Date() };
  } catch (error) {
    console.error('Error initializing usage:', error);
    throw error;
  }
}

/**
 * Calculate current usage by querying database
 */
async function calculateUsage(userId, role) {
  const usage = {};
  
  try {
    if (role === 'parent') {
      // Count children
      const parentLinks = await db.collection('parentStudentLinks')
        .where('parentUid', '==', userId)
        .get();
      usage.children = parentLinks.size;
      
    } else if (role === 'school-admin') {
      // Count staff
      const staff = await db.collection('users')
        .where('organizationId', '==', (await db.collection('users').doc(userId).get()).data().organizationId)
        .where('role', 'in', ['teacher', 'counselor', 'social-worker'])
        .get();
      usage.staff = staff.size;
      
      // Count students per staff
      usage.studentsByStaff = {};
      for (const staffDoc of staff.docs) {
        const staffId = staffDoc.id;
        const staffData = staffDoc.data() || {};
        const staffName = [staffData.firstName, staffData.lastName].filter(Boolean).join(' ') || staffData.email || staffId;
        const students = await db.collection('users')
          .where('creatorId', '==', staffId)
          .where('role', '==', 'student')
          .get();
        usage.studentsByStaff[staffId] = {
          count: students.size,
          name: staffName
        };
      }
      
    } else if (role === 'district-admin') {
      // Count schools
      const organizationId = (await db.collection('users').doc(userId).get()).data().organizationId;
      const schools = await db.collection('organizations')
        .where('parentOrganizationId', '==', organizationId)
        .get();
      usage.schools = schools.size;
      
      // Count staff and students per school
      usage.staffPerSchool = {};
      usage.studentsPerSchool = {};
      for (const schoolDoc of schools.docs) {
        const schoolOrgId = schoolDoc.id;
        const schoolStaff = await db.collection('users')
          .where('organizationId', '==', schoolOrgId)
          .where('role', 'in', ['teacher', 'counselor', 'social-worker'])
          .get();
        usage.staffPerSchool[schoolOrgId] = schoolStaff.size;
        
        // Count students for this school
        let totalStudents = 0;
        for (const staffDoc of schoolStaff.docs) {
          const students = await db.collection('users')
            .where('creatorId', '==', staffDoc.id)
            .where('role', '==', 'student')
            .get();
          totalStudents += students.size;
        }
        usage.studentsPerSchool[schoolOrgId] = totalStudents;
      }
      
    } else if (role === 'employer-admin') {
      // Count staff
      const organizationId = (await db.collection('users').doc(userId).get()).data().organizationId;
      const staff = await db.collection('users')
        .where('organizationId', '==', organizationId)
        .where('role', 'in', ['supervisor', 'hr'])
        .get();
      usage.staff = staff.size;
      
      // Count employees per staff
      usage.employeesByStaff = {};
      for (const staffDoc of staff.docs) {
        const staffId = staffDoc.id;
        const staffData = staffDoc.data() || {};
        const staffName = [staffData.firstName, staffData.lastName].filter(Boolean).join(' ') || staffData.email || staffId;
        const employees = await db.collection('users')
          .where('creatorId', '==', staffId)
          .where('role', '==', 'employee')
          .get();
        usage.employeesByStaff[staffId] = {
          count: employees.size,
          name: staffName
        };
      }
    }
    
    return usage;
  } catch (error) {
    console.error('Error calculating usage:', error);
    return usage;
  }
}

/**
 * Update usage when a resource is created/deleted
 */
async function updateUsage(userId, resourceType, delta, metadata = {}) {
  try {
    const usageRef = db.collection('usage').doc(userId);
    const usageDoc = await usageRef.get();
    
    if (!usageDoc.exists) {
      await initializeUsage(userId);
      return;
    }
    
    const currentUsage = usageDoc.data().usage || {};
    
    // Update the specific resource count
    if (resourceType === 'child') {
      currentUsage.children = Math.max(0, (currentUsage.children || 0) + delta);
    } else if (resourceType === 'staff') {
      currentUsage.staff = Math.max(0, (currentUsage.staff || 0) + delta);
    } else if (resourceType === 'school') {
      currentUsage.schools = Math.max(0, (currentUsage.schools || 0) + delta);
    } else if (resourceType.startsWith('student:')) {
      const staffId = resourceType.split(':')[1];
      if (!currentUsage.studentsByStaff) {
        currentUsage.studentsByStaff = {};
      }
      const entry = currentUsage.studentsByStaff[staffId] || {};
      entry.count = Math.max(0, (entry.count || 0) + delta);
      if (metadata.staffName) {
        entry.name = metadata.staffName;
      }
      if (entry.count <= 0) {
        delete currentUsage.studentsByStaff[staffId];
      } else {
        currentUsage.studentsByStaff[staffId] = entry;
      }
    } else if (resourceType.startsWith('employee:')) {
      const staffId = resourceType.split(':')[1];
      if (!currentUsage.employeesByStaff) {
        currentUsage.employeesByStaff = {};
      }
      const entry = currentUsage.employeesByStaff[staffId] || {};
      entry.count = Math.max(0, (entry.count || 0) + delta);
      if (metadata.staffName) {
        entry.name = metadata.staffName;
      }
      if (entry.count <= 0) {
        delete currentUsage.employeesByStaff[staffId];
      } else {
        currentUsage.employeesByStaff[staffId] = entry;
      }
    }
    
    // Update database
    await usageRef.update({
      usage: currentUsage,
      lastUpdated: new Date()
    });
    
    return currentUsage;
  } catch (error) {
    console.error('Error updating usage:', error);
    throw error;
  }
}

/**
 * Refresh usage by recalculating from database
 */
async function refreshUsage(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const role = userDoc.data().role;
    const usage = await calculateUsage(userId, role);
    
    await db.collection('usage').doc(userId).set({
      userId,
      role,
      usage,
      lastUpdated: new Date()
    }, { merge: true });
    
    return { userId, role, usage, lastUpdated: new Date() };
  } catch (error) {
    console.error('Error refreshing usage:', error);
    throw error;
  }
}

/**
 * Check if user can create a resource (hasn't reached limit)
 */
async function checkLimit(userId, resourceType, requestedCount = 1) {
  try {
    let subscriptionUserId = userId;
    let requesterDoc = null;
    let requester = null;
    let requesterOrgId = null;

    if (resourceType === 'student' || resourceType === 'employee') {
      const staffDoc = await db.collection('users').doc(userId).get();
      if (!staffDoc.exists) {
        return { allowed: false, reason: 'Staff member not found' };
      }
      const staffData = staffDoc.data() || {};
      if (!staffData.creatorId) {
        return { allowed: false, reason: 'Admin has no active subscription' };
      }
      subscriptionUserId = staffData.creatorId; // school-admin
      requesterDoc = await db.collection('users').doc(subscriptionUserId).get();
      requester = requesterDoc.exists ? (requesterDoc.data() || {}) : {};
      requesterOrgId = requester.organizationId || null;
      // If school-admin lacks own subscription but is linked to a district, use district's subscription
      const adminSub = await db.collection('subscriptions').doc(subscriptionUserId).get();
      if ((!adminSub.exists || !['active', 'trialing'].includes((adminSub.data() || {}).status)) && requesterOrgId) {
        const orgDoc = await db.collection('organizations').doc(requesterOrgId).get();
        if (orgDoc.exists) {
          const parentDistrictId = (orgDoc.data() || {}).parentDistrictId;
          if (parentDistrictId) {
            subscriptionUserId = parentDistrictId;
          }
        }
      }
    }

    if (resourceType === 'staff') {
      // Staff is created by a school-admin; may inherit district subscription
      requesterDoc = await db.collection('users').doc(userId).get();
      if (!requesterDoc.exists) {
        return { allowed: false, reason: 'Admin not found' };
      }
      requester = requesterDoc.data() || {};
      requesterOrgId = requester.organizationId || null;
      // Prefer admin's own subscription if active; otherwise, inherit district via org
      const adminSubDoc = await db.collection('subscriptions').doc(userId).get();
      const adminSub = adminSubDoc.exists ? (adminSubDoc.data() || {}) : null;
      const hasOwnActive = adminSub && ['active', 'trialing'].includes(adminSub.status);
      if (!hasOwnActive && requesterOrgId) {
        const orgDoc = await db.collection('organizations').doc(requesterOrgId).get();
        if (orgDoc.exists) {
          const parentDistrictId = (orgDoc.data() || {}).parentDistrictId;
          if (parentDistrictId) {
            subscriptionUserId = parentDistrictId;
          }
        }
      }
    }

    const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionUserId).get();
    if (!subscriptionDoc.exists) {
      return { allowed: false, reason: 'No active subscription' };
    }

    const subscription = subscriptionDoc.data();
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return { allowed: false, reason: 'Subscription not active' };
    }

    const resolveLimit = (limitKey) => {
      let limitValue = subscription.limits && subscription.limits[limitKey];
      if (limitValue === undefined || limitValue === null) {
        try {
          // Normalize role keys to config keys
          let roleKey = subscription.role;
          if (roleKey === 'school-admin') roleKey = 'schoolAdmin';
          if (roleKey === 'district-admin') roleKey = 'districtAdmin';
          if (roleKey === 'employer-admin') roleKey = 'employerAdmin';
          const pkg = packages.getPackage(roleKey, subscription.packageId);
          limitValue = pkg?.limits?.[limitKey];
        } catch (err) {
          console.error(`Unable to resolve limit for ${limitKey}:`, err.message);
          limitValue = 0;
        }
      }
      return limitValue || 0;
    };

    const usageData = await getUsage(subscriptionUserId);
    const usage = usageData.usage || {};

    if (resourceType === 'child') {
      const current = usage.children || 0;
      const limit = resolveLimit('children');
      if (current + requestedCount > limit) {
        return {
          allowed: false,
          reason: 'Children limit reached. Please open Manage Subscription to upgrade your plan.',
          current,
          limit,
          requested: requestedCount,
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
    }

    if (resourceType === 'staff') {
      let current;
      let limit;
      if (subscription.role === 'district-admin' && requesterOrgId) {
        // Enforce per-school staff limit when covered by district
        const perSchool = usage.staffPerSchool || {};
        current = perSchool[requesterOrgId] || 0;
        // District package uses staffPerSchool as the limit key
        limit = resolveLimit('staffPerSchool');
      } else {
        current = usage.staff || 0;
        limit = resolveLimit('staff');
      }
      if (current + requestedCount > limit) {
        return {
          allowed: false,
          reason: 'Staff limit reached. Please open Manage Subscription to upgrade your plan.',
          current,
          limit,
          requested: requestedCount,
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
    }

    if (resourceType === 'school') {
      const current = usage.schools || 0;
      const limit = resolveLimit('schools');
      if (current + requestedCount > limit) {
        return {
          allowed: false,
          reason: 'Schools limit reached. Please open Manage Subscription to upgrade your plan.',
          current,
          limit,
          requested: requestedCount,
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
    }

    if (resourceType === 'student') {
      // For students, if subscription is inherited from district, use school-admin usage for per-staff counts
      let studentsUsage = usage;
      if (subscription.role === 'district-admin' && requester && requester.role === 'school-admin') {
        try {
          const adminUsageData = await getUsage(requesterDoc.id);
          studentsUsage = (adminUsageData && adminUsageData.usage) ? adminUsageData.usage : {};
        } catch (e) {
          studentsUsage = {};
        }
      }
      const entry = studentsUsage.studentsByStaff && studentsUsage.studentsByStaff[userId];
      const current = entry && typeof entry === 'object' ? entry.count || 0 : entry || 0;
      const limit = resolveLimit('studentsPerStaff');
      if (current + requestedCount > limit) {
        return {
          allowed: false,
          reason: 'Students per staff limit reached. Please open Manage Subscription to upgrade your plan.',
          current,
          limit,
          requested: requestedCount,
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
    }

    if (resourceType === 'employee') {
      const entry = usage.employeesByStaff && usage.employeesByStaff[userId];
      const current = entry && typeof entry === 'object' ? entry.count || 0 : entry || 0;
      const limit = resolveLimit('employeesPerStaff');
      if (current + requestedCount > limit) {
        return {
          allowed: false,
          reason: 'Employees per staff limit reached. Please open Manage Subscription to upgrade your plan.',
          current,
          limit,
          requested: requestedCount,
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking limit:', error);
    return { allowed: false, reason: 'Error checking limit' };
  }
}

module.exports = {
  getUsage,
  initializeUsage,
  calculateUsage,
  updateUsage,
  refreshUsage,
  checkLimit
};

