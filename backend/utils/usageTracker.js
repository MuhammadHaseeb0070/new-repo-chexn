const { db } = require('../config/firebase');

/**
 * Gets the current usage for a given billingOwnerId
 * 
 * This counts all sub-users across all organizations tied to this billing owner.
 */
async function getUsage(billingOwnerId) {
  const usage = {
    children: 0,
    schools: 0,
    staff: 0, // All staff (school + employer)
    students: 0,
    employees: 0,
  };

  // 1. Get all users who share this billingOwnerId
  const usersSnap = await db.collection('users').where('billingOwnerId', '==', billingOwnerId).get();
  if (usersSnap.empty) {
    return usage;
  }

  // 2. Count users by role
  usersSnap.docs.forEach(doc => {
    const user = doc.data();
    switch (user.role) {
      case 'student':
        usage.students++;
        break;
      case 'employee':
        usage.employees++;
        break;
      case 'teacher':
      case 'counselor':
      case 'social-worker':
      case 'supervisor':
      case 'hr':
        usage.staff++;
        break;
      case 'parent':
        // We count children created by parents, not parents themselves
        break;
    }
  });

  // 3. Count children (linked to parents)
  const parentLinksSnap = await db.collection('parentStudentLinks').where('billingOwnerId', '==', billingOwnerId).get();
  parentLinksSnap.docs.forEach(doc => {
    usage.children += (doc.data().studentUids || []).length;
  });

  // 4. Count schools (created by districts)
  const orgsSnap = await db.collection('organizations').where('billingOwnerId', '==', billingOwnerId).get();
  orgsSnap.docs.forEach(doc => {
    // We count orgs that are NOT the district admin's own org
    if (doc.data().ownerId !== billingOwnerId) {
      usage.schools++;
    }
  });

  return usage;
}

module.exports = { getUsage };
