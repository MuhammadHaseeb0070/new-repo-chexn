const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase'); // We need 'admin'
const authMiddleware = require('../middleware/authMiddleware');
// We don't need humanReadableId, that was a mistake in my old code.

// GET /my-students - Copy from teacherRoutes.js
router.get('/my-students', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const query = db.collection('users')
      .where('creatorId', '==', staffId)
      .where('role', '==', 'student');

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const students = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unread summary for staff: how many unread check-ins per student
router.get('/unread-summary', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    // get my students first
    const studentsSnap = await db.collection('users')
      .where('creatorId', '==', staffId)
      .where('role', '==', 'student')
      .get();

    if (studentsSnap.empty) {
      return res.status(200).json([]);
    }

    const results = [];
    for (const doc of studentsSnap.docs) {
      const studentId = doc.id;
      const checkInsSnap = await db.collection('checkIns')
        .where('studentId', '==', studentId)
        .orderBy('timestamp', 'desc')
        .get();
      const unreadCount = checkInsSnap.docs
        .map(d => d.data())
        .filter(ci => ci.readStatus && ci.readStatus.school === false)
        .length;
      if (unreadCount > 0) {
        results.push({ studentId, unreadCount });
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching unread summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /checkins/:studentId - New route for fetching student check-ins
router.get('/checkins/:studentId', authMiddleware, async (req, res) => {
  try {
    // Get the staff member's UID
    const staffId = req.user.uid;

    // Get the studentId from req.params.studentId
    const studentId = req.params.studentId;

    // Security Check 1 (Get Staff Org)
    const staffDoc = await db.collection('users').doc(staffId).get();

    if (!staffDoc.exists) {
      return res.status(403).json({ error: 'User profile not found.' });
    }

    const organizationId = staffDoc.data().organizationId;

    // Security Check 2 (Get Student Org)
    const studentDoc = await db.collection('users').doc(studentId).get();

    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Security Check 3 (Compare Orgs)
    if (studentDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'You are not authorized to view this student.' });
    }

    // If authorized, fetch check-ins
    const query = db.collection('checkIns')
      .where('studentId', '==', studentId)
      .orderBy('timestamp', 'desc');
    
    const snapshot = await query.get();

    // Map the results to an array checkIns
    const checkIns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Send a 200 response with the checkIns array
    res.status(200).json(checkIns);
  } catch (error) {
    console.error('Error fetching student check-ins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /create-student - (This was missing)
router.post('/create-student', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is a staff member
    const staffRef = db.collection('users').doc(req.user.uid);
    const staffDoc = await staffRef.get();
    const staffRole = staffDoc.data()?.role;
    const creatorId = req.user.uid;

    if (!staffDoc.exists || (staffRole !== 'teacher' && staffRole !== 'counselor' && staffRole !== 'social-worker')) {
      return res.status(403).json({ error: 'You are not authorized for this action.' });
    }

    // If authorized, get data
    const organizationId = staffDoc.data().organizationId;
    const { email, password, firstName, lastName } = req.body;

    // Create the user in Firebase Auth (with emailVerified: true)
    const newStudentUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true // This is the fix from Chunk 44
    });

    // Create the user in Firestore
    await db.collection('users').doc(newStudentUser.uid).set({
      uid: newStudentUser.uid,
      email,
      firstName,
      lastName,
      role: 'student',
      organizationId: organizationId,
      createdAt: new Date(),
      creatorId: creatorId
    });

    res.status(201).json({
      uid: newStudentUser.uid,
      email,
      firstName,
      lastName
    });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists.' });
    }
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

