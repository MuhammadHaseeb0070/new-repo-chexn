// Usage tracking utilities
// Tracks current usage vs subscription limits

const { db } = require('../config/firebase');

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
        const students = await db.collection('users')
          .where('creatorId', '==', staffId)
          .where('role', '==', 'student')
          .get();
        usage.studentsByStaff[staffId] = students.size;
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
        const employees = await db.collection('users')
          .where('creatorId', '==', staffId)
          .where('role', '==', 'employee')
          .get();
        usage.employeesByStaff[staffId] = employees.size;
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
async function updateUsage(userId, resourceType, delta) {
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
      currentUsage.children = (currentUsage.children || 0) + delta;
    } else if (resourceType === 'staff') {
      currentUsage.staff = (currentUsage.staff || 0) + delta;
    } else if (resourceType === 'school') {
      currentUsage.schools = (currentUsage.schools || 0) + delta;
    } else if (resourceType.startsWith('student:')) {
      const staffId = resourceType.split(':')[1];
      if (!currentUsage.studentsByStaff) {
        currentUsage.studentsByStaff = {};
      }
      currentUsage.studentsByStaff[staffId] = (currentUsage.studentsByStaff[staffId] || 0) + delta;
    } else if (resourceType.startsWith('employee:')) {
      const staffId = resourceType.split(':')[1];
      if (!currentUsage.employeesByStaff) {
        currentUsage.employeesByStaff = {};
      }
      currentUsage.employeesByStaff[staffId] = (currentUsage.employeesByStaff[staffId] || 0) + delta;
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
    // Get user's subscription
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    
    if (!subscriptionDoc.exists) {
      return { allowed: false, reason: 'No active subscription' };
    }
    
    const subscription = subscriptionDoc.data();
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return { allowed: false, reason: 'Subscription not active' };
    }
    
    const limits = subscription.limits || {};
    const usageData = await getUsage(userId);
    const usage = usageData.usage || {};
    
    // Check limits based on resource type
    if (resourceType === 'child') {
      const current = usage.children || 0;
      const limit = limits.children || 0;
      if (current + requestedCount > limit) {
        return { 
          allowed: false, 
          reason: 'Children limit reached',
          current,
          limit,
          requested: requestedCount
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
      
    } else if (resourceType === 'staff') {
      const current = usage.staff || 0;
      const limit = limits.staff || 0;
      if (current + requestedCount > limit) {
        return { 
          allowed: false, 
          reason: 'Staff limit reached',
          current,
          limit,
          requested: requestedCount
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
      
    } else if (resourceType === 'school') {
      const current = usage.schools || 0;
      const limit = limits.schools || 0;
      if (current + requestedCount > limit) {
        return { 
          allowed: false, 
          reason: 'Schools limit reached',
          current,
          limit,
          requested: requestedCount
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
      
    } else if (resourceType === 'student') {
      // For students, we need to check the staff member's limit
      // The userId here is the staff member creating the student
      // We need to get the admin who owns this staff member
      const staffDoc = await db.collection('users').doc(userId).get();
      if (!staffDoc.exists) {
        return { allowed: false, reason: 'Staff member not found' };
      }
      
      const staffData = staffDoc.data();
      const organizationId = staffData.organizationId;
      const creatorId = staffData.creatorId; // This is the admin who created this staff
      
      // Get admin's subscription
      const adminSubscriptionRef = db.collection('subscriptions').doc(creatorId);
      const adminSubscriptionDoc = await adminSubscriptionRef.get();
      
      if (!adminSubscriptionDoc.exists) {
        return { allowed: false, reason: 'Admin has no active subscription' };
      }
      
      const adminSubscription = adminSubscriptionDoc.data();
      if (adminSubscription.status !== 'active' && adminSubscription.status !== 'trialing') {
        return { allowed: false, reason: 'Admin subscription not active' };
      }
      
      const adminLimits = adminSubscription.limits || {};
      const adminUsageData = await getUsage(creatorId);
      const adminUsage = adminUsageData.usage || {};
      
      const current = (adminUsage.studentsByStaff && adminUsage.studentsByStaff[userId]) || 0;
      const limit = adminLimits.studentsPerStaff || 0;
      
      if (current + requestedCount > limit) {
        return { 
          allowed: false, 
          reason: 'Students per staff limit reached',
          current,
          limit,
          requested: requestedCount
        };
      }
      return { allowed: true, current, limit, remaining: limit - current };
      
    } else if (resourceType === 'employee') {
      // For employees, similar to students
      const staffDoc = await db.collection('users').doc(userId).get();
      if (!staffDoc.exists) {
        return { allowed: false, reason: 'Staff member not found' };
      }
      
      const staffData = staffDoc.data();
      const creatorId = staffData.creatorId; // This is the employer admin who created this staff
      
      // Get admin's subscription
      const adminSubscriptionRef = db.collection('subscriptions').doc(creatorId);
      const adminSubscriptionDoc = await adminSubscriptionRef.get();
      
      if (!adminSubscriptionDoc.exists) {
        return { allowed: false, reason: 'Admin has no active subscription' };
      }
      
      const adminSubscription = adminSubscriptionDoc.data();
      if (adminSubscription.status !== 'active' && adminSubscription.status !== 'trialing') {
        return { allowed: false, reason: 'Admin subscription not active' };
      }
      
      const adminLimits = adminSubscription.limits || {};
      const adminUsageData = await getUsage(creatorId);
      const adminUsage = adminUsageData.usage || {};
      
      const current = (adminUsage.employeesByStaff && adminUsage.employeesByStaff[userId]) || 0;
      const limit = adminLimits.employeesPerStaff || 0;
      
      if (current + requestedCount > limit) {
        return { 
          allowed: false, 
          reason: 'Employees per staff limit reached',
          current,
          limit,
          requested: requestedCount
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

