const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/my-employees', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const query = db.collection('users')
      .where('creatorId', '==', staffId)
      .where('role', '==', 'employee');

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const employees = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    return res.status(200).json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Unread summary for employer staff: how many unread check-ins per employee
router.get('/unread-summary', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const employeesSnap = await db.collection('users')
      .where('creatorId', '==', staffId)
      .where('role', '==', 'employee')
      .get();

    if (employeesSnap.empty) {
      return res.status(200).json([]);
    }

  // Optimize: batch fetch with 'in' query (chunks of 10)
  const employeeIds = employeesSnap.docs.map(d => d.id);
  const chunkSize = 10;
  const chunks = [];
  for (let i = 0; i < employeeIds.length; i += chunkSize) {
    chunks.push(employeeIds.slice(i, i + chunkSize));
  }
  // Limit to recent 50 check-ins per chunk (enough for unread count)
  const allSnaps = await Promise.all(chunks.map(ids => db.collection('checkIns')
    .where('studentId', 'in', ids)
    .limit(50)
    .get()
  ));
  const countMap = {};
  allSnaps.forEach(snap => {
    snap.forEach(doc => {
      const data = doc.data() || {};
      if (data.readStatus && data.readStatus.school === false) {
        const eid = data.studentId;
        countMap[eid] = (countMap[eid] || 0) + 1;
      }
    });
  });
  const results = Object.keys(countMap).map(eid => ({ employeeId: eid, unreadCount: countMap[eid] }));
  return res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching unread summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/checkins/:employeeId', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const { employeeId } = req.params;

    // Security Check 1: Get Staff Org
    const staffDoc = await db.collection('users').doc(staffId).get();
    if (!staffDoc.exists) {
      return res.status(404).json({ error: 'Staff profile not found.' });
    }
    const organizationId = staffDoc.data().organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: 'No organization associated with this user.' });
    }

    // Security Check 2: Get Employee Org
    const employeeDoc = await db.collection('users').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Security Check 3: Compare Orgs
    if (employeeDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'Forbidden: Employee is not in your organization.' });
    }

    // Authorized: Fetch Chex-Ns (check-ins)
  const query = db
      .collection('checkIns')
      .where('studentId', '==', employeeId)
    .orderBy('timestamp', 'desc')
    .limit(50);

    const snapshot = await query.get();
    const chexNs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json(chexNs);
  } catch (error) {
    console.error('Error fetching chexns:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create-employee', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is a staff member (supervisor/hr)
    const staffRef = db.collection('users').doc(req.user.uid);
    const staffDoc = await staffRef.get();
    const staffRole = staffDoc.data()?.role;
    const creatorId = req.user.uid;

    if (!staffDoc.exists || (staffRole !== 'supervisor' && staffRole !== 'hr')) {
      return res.status(403).json({ error: 'You are not authorized for this action.' });
    }

    // Get Data
    // Get the organizationId from staffDoc.data().organizationId
    const organizationId = staffDoc.data().organizationId;
    
    // Get email, password, firstName, lastName from req.body
    const { email, password, firstName, lastName } = req.body;

    // Create Employee in Auth
    const newEmployeeUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true
    });

    // Create Employee in Firestore
    await db.collection('users').doc(newEmployeeUser.uid).set({
      uid: newEmployeeUser.uid,
      email,
      firstName,
      lastName,
      role: 'employee',
      organizationId,
      createdAt: new Date(),
      creatorId: creatorId
    });

    // Send a 201 (Created) response with the new employee's data
    res.status(201).json({
      uid: newEmployeeUser.uid,
      email,
      firstName,
      lastName,
      role: 'employee',
      organizationId,
      displayName: newEmployeeUser.displayName
    });
  } catch (error) {
    // Handle specific error cases
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Generic error handling
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
// Mark all check-ins as read for employer staff viewing a specific employee
router.post('/checkins/:employeeId/mark-read', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const employeeId = req.params.employeeId;

    const staffDoc = await db.collection('users').doc(staffId).get();
    if (!staffDoc.exists) return res.status(403).json({ error: 'User profile not found.' });
    const organizationId = staffDoc.data().organizationId;

    const employeeDoc = await db.collection('users').doc(employeeId).get();
    if (!employeeDoc.exists) return res.status(404).json({ error: 'Employee not found.' });
    if (employeeDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'You are not authorized to modify this employee.' });
    }

    const q = db.collection('checkIns').where('studentId', '==', employeeId);
    const snap = await q.get();
    const batch = db.batch();
    snap.forEach(doc => {
      const data = doc.data() || {};
      const readStatus = data.readStatus || {};
      if (readStatus.school !== true) {
        batch.update(doc.ref, { 'readStatus.school': true });
      }
    });
    await batch.commit();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking employer-staff read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

