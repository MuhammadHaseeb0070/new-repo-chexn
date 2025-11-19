const { db } = require('../config/firebase');

const schoolStaffRoles = new Set(['teacher', 'counselor', 'social-worker']);
const employerStaffRoles = new Set(['supervisor', 'hr']);

function emptyUsageSnapshot() {
  return {
    children: 0,
    schools: 0,
    staff_total: 0,
    students_total: 0,
    employees_total: 0,
    staffPerSchool: {},
    studentsPerStaff: {},
    studentsPerSchool: {},
    employeesPerStaff: {}
  };
}

/**
 * Aggregate usage for a billing owner in real-time.
 * @param {string} billingOwnerId
 * @returns {Promise<object>}
 */
async function getUsage(billingOwnerId) {
  if (!billingOwnerId) {
    return emptyUsageSnapshot();
  }

  const usage = emptyUsageSnapshot();

  // Aggregate user-based counts.
  const usersSnap = await db.collection('users')
    .where('billingOwnerId', '==', billingOwnerId)
    .get();

  usersSnap.forEach(doc => {
    const user = doc.data() || {};
    const role = (user.role || '').toLowerCase();

    if (role === 'student') {
      usage.students_total += 1;
      if (user.creatorId) {
        usage.studentsPerStaff[user.creatorId] = (usage.studentsPerStaff[user.creatorId] || 0) + 1;
      }
      if (user.organizationId) {
        usage.studentsPerSchool[user.organizationId] = (usage.studentsPerSchool[user.organizationId] || 0) + 1;
      }
    } else if (role === 'employee') {
      usage.employees_total += 1;
      if (user.creatorId) {
        usage.employeesPerStaff[user.creatorId] = (usage.employeesPerStaff[user.creatorId] || 0) + 1;
      }
    } else if (schoolStaffRoles.has(role)) {
      usage.staff_total += 1;
      if (user.organizationId) {
        usage.staffPerSchool[user.organizationId] = (usage.staffPerSchool[user.organizationId] || 0) + 1;
      }
    } else if (employerStaffRoles.has(role)) {
      usage.staff_total += 1;
      // Employer staff are not tied to schools for per-school metrics.
    }
  });

  // Parent hierarchy - count children linked to the billing owner.
  const parentLinkRef = db.collection('parentStudentLinks').doc(billingOwnerId);
  const parentLinkDoc = await parentLinkRef.get();
  if (parentLinkDoc.exists) {
    const studentUids = parentLinkDoc.data().studentUids;
    if (Array.isArray(studentUids)) {
      usage.children = studentUids.length;
    }
  }

  // District hierarchy - count managed schools.
  const orgsSnap = await db.collection('organizations')
    .where('billingOwnerId', '==', billingOwnerId)
    .get();

  orgsSnap.forEach(doc => {
    const org = doc.data() || {};
    if (org.ownerId && org.ownerId === billingOwnerId) {
      return;
    }
    usage.schools += 1;
  });

  return usage;
}

module.exports = { getUsage };
