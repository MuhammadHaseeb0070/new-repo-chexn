const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/my-staff', authMiddleware, async (req, res) => {
  try {
    const schoolAdminId = req.user.uid;
    const adminDoc = await db.collection('users').doc(schoolAdminId).get();

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
      .where('role', 'in', ['teacher', 'counselor', 'social-worker']);

    const snapshot = await query.get();
    const staff = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: data.uid || doc.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
      };
    });

    return res.status(200).json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create-staff', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is an admin
    const adminRef = db.collection('users').doc(req.user.uid);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists || adminDoc.data().role !== 'school-admin') {
      return res.status(403).json({ error: 'You are not authorized for this action.' });
    }

    // Get the admin's organizationId
    const organizationId = adminDoc.data().organizationId;

    // Get data from request body
    const { email, password, firstName, lastName, role } = req.body;

    // Create the user in Firebase Auth
    const newStaffUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true // Add this line
    });

    // Create the user in Firestore
    await db.collection('users').doc(newStaffUser.uid).set({
      uid: newStaffUser.uid,
      email,
      firstName,
      lastName,
      role,
      organizationId
    });

    // Send a 201 (Created) response with the new user's data (excluding the password)
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

