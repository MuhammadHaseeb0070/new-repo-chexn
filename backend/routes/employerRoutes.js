const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/my-staff', authMiddleware, async (req, res) => {
  try {
    const employerAdminId = req.user.uid;
    const adminDoc = await db.collection('users').doc(employerAdminId).get();

    if (!adminDoc.exists) {
      return res.status(404).json({ error: 'Admin profile not found.' });
    }

    const organizationId = adminDoc.data().organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: 'No organization associated with this admin.' });
    }

    const query = db
      .collection('users')
      .where('organizationId', '==', organizationId)
      .where('role', 'in', ['supervisor', 'hr']);

    const snapshot = await query.get();
    const staff = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));

    return res.status(200).json(staff);
  } catch (error) {
    console.error('Error fetching employer staff:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create-staff', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is an employer-admin
    const employerAdminRef = db.collection('users').doc(req.user.uid);
    const adminDoc = await employerAdminRef.get();

    if (!adminDoc.exists || adminDoc.data().role !== 'employer-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get Data
    // Get the organizationId from adminDoc.data().organizationId
    const organizationId = adminDoc.data().organizationId;
    
    // Get email, password, firstName, lastName from req.body
    // Get role from req.body (e.g., 'hr', 'supervisor')
    const { email, password, firstName, lastName, role } = req.body;

    // Create the Staff user in Auth
    const newStaffUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true
    });

    // Create the Staff user in Firestore
    await db.collection('users').doc(newStaffUser.uid).set({
      uid: newStaffUser.uid,
      email,
      firstName,
      lastName,
      role,
      organizationId
    });

    // Send a 201 (Created) response with the new staff's data
    res.status(201).json({
      uid: newStaffUser.uid,
      email,
      firstName,
      lastName,
      role,
      organizationId,
      displayName: newStaffUser.displayName
    });
  } catch (error) {
    // Handle specific error cases
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Generic error handling
    console.error('Error creating staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

