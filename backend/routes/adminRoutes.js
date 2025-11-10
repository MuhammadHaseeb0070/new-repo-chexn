const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const { generatePassword, generateEmail, normalizePhoneNumber, isValidEmail, validatePassword } = require('../utils/userHelpers');

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
        creatorId: data.creatorId, // Include creatorId for filtering
      };
    });

    // Filter only staff created by this admin (check creatorId)
    const filteredStaff = staff.filter(s => {
      // If staff doesn't have creatorId, they might be old data, include them for backward compatibility
      // But prefer checking creatorId if it exists
      return !s.creatorId || s.creatorId === schoolAdminId;
    });

    return res.status(200).json(filteredStaff);
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

    const schoolAdminId = req.user.uid;
    
    // Create the user in Firestore
    await db.collection('users').doc(newStaffUser.uid).set({
      uid: newStaffUser.uid,
      email,
      firstName,
      lastName,
      role,
      organizationId,
      creatorId: schoolAdminId // Store creator for management
    });
    
    // Store password for creator to view later
    await db.collection('userCredentials').doc(newStaffUser.uid).set({
      uid: newStaffUser.uid,
      creatorId: schoolAdminId,
      email,
      password,
      createdAt: new Date()
    });

    // Send a 201 (Created) response with the new user's data
    res.status(201).json({
      uid: newStaffUser.uid,
      email,
      firstName,
      lastName,
      role,
      organizationId,
      displayName: newStaffUser.displayName,
      password // Return password so frontend can show it once
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

// GET /staff/:staffId - Get staff details with credentials (only if creator)
router.get('/staff/:staffId', authMiddleware, async (req, res) => {
  try {
    const schoolAdminId = req.user.uid;
    const staffId = req.params.staffId;
    
    // Verify school admin and organization
    const adminDoc = await db.collection('users').doc(schoolAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'school-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const organizationId = adminDoc.data().organizationId;
    const staffDoc = await db.collection('users').doc(staffId).get();
    if (!staffDoc.exists) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    
    // Verify it's staff from this admin's organization and created by this admin
    if (staffDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'Not authorized to view this staff' });
    }
    
    if (staffDoc.data().creatorId && staffDoc.data().creatorId !== schoolAdminId) {
      return res.status(403).json({ error: 'Not authorized to view this staff' });
    }
    
    // Get credentials if stored and creator matches
    const credsDoc = await db.collection('userCredentials').doc(staffId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === schoolAdminId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...staffDoc.data(),
      uid: staffDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error fetching staff details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /staff/:staffId - Update staff details
router.put('/staff/:staffId', authMiddleware, async (req, res) => {
  try {
    const schoolAdminId = req.user.uid;
    const staffId = req.params.staffId;
    const { firstName, lastName, email, password, phoneNumber, role } = req.body;
    
    // Verify school admin and organization
    const adminDoc = await db.collection('users').doc(schoolAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'school-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const organizationId = adminDoc.data().organizationId;
    const staffDoc = await db.collection('users').doc(staffId).get();
    if (!staffDoc.exists) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    
    if (staffDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'Not authorized to update this staff' });
    }
    
    if (staffDoc.data().creatorId && staffDoc.data().creatorId !== schoolAdminId) {
      return res.status(403).json({ error: 'Not authorized to update this staff' });
    }
    
    // Update Firestore
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    if (role !== undefined && ['teacher', 'counselor', 'social-worker'].includes(role.toLowerCase())) {
      updateData.role = role.toLowerCase();
    }
    
    if (Object.keys(updateData).length > 0) {
      await db.collection('users').doc(staffId).update(updateData);
    }
    
    // Update email in Auth if changed
    if (email && email !== staffDoc.data().email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      await admin.auth().updateUser(staffId, { email });
      await db.collection('users').doc(staffId).update({ email });
      const credsRef = db.collection('userCredentials').doc(staffId);
      const credsDoc = await credsRef.get();
      if (credsDoc.exists && credsDoc.data().creatorId === schoolAdminId) {
        await credsRef.update({ email, updatedAt: new Date() });
      }
    }
    
    // Update password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }
      await admin.auth().updateUser(staffId, { password });
      const credsRef = db.collection('userCredentials').doc(staffId);
      const credsDoc = await credsRef.get();
      if (credsDoc.exists && credsDoc.data().creatorId === schoolAdminId) {
        await credsRef.update({ password, updatedAt: new Date() });
      } else {
        await credsRef.set({
          uid: staffId,
          creatorId: schoolAdminId,
          email: email || staffDoc.data().email,
          password,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // Get updated user data
    const updatedDoc = await db.collection('users').doc(staffId).get();
    const credsDoc = await db.collection('userCredentials').doc(staffId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === schoolAdminId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...updatedDoc.data(),
      uid: updatedDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /staff/:staffId - Delete staff (from Auth and Firestore)
router.delete('/staff/:staffId', authMiddleware, async (req, res) => {
  try {
    const schoolAdminId = req.user.uid;
    const staffId = req.params.staffId;
    
    // Verify school admin and organization
    const adminDoc = await db.collection('users').doc(schoolAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'school-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const organizationId = adminDoc.data().organizationId;
    const staffDoc = await db.collection('users').doc(staffId).get();
    if (!staffDoc.exists) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    
    if (staffDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'Not authorized to delete this staff' });
    }
    
    if (staffDoc.data().creatorId && staffDoc.data().creatorId !== schoolAdminId) {
      return res.status(403).json({ error: 'Not authorized to delete this staff' });
    }
    
    // Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(staffId);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    // Delete from Firestore
    await db.collection('users').doc(staffId).delete();
    await db.collection('userCredentials').doc(staffId).delete();
    
    res.status(200).json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

