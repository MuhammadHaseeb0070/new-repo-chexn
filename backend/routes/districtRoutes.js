const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/my-institutes', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const query = db
      .collection('organizations')
      .where('parentDistrictId', '==', districtAdminId);
    const snapshot = await query.get();
    const institutes = snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name }));
    return res.status(200).json(institutes);
  } catch (error) {
    console.error('Error fetching schools:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create-institute', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is a district-admin
    const districtAdminRef = db.collection('users').doc(req.user.uid);
    const adminDoc = await districtAdminRef.get();

    if (!adminDoc.exists || adminDoc.data().role !== 'district-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get Data
    // Get the district's organizationId from adminDoc.data().organizationId
    const districtOrgId = adminDoc.data().organizationId;
    
    // Get email, password, firstName, lastName, instituteName, instituteType from req.body
    const { email, password, firstName, lastName, instituteName, instituteType } = req.body;

    // Create the School's own Organization: A school is its own entity
    const newOrgRef = db.collection('organizations').doc();
    await newOrgRef.set({
      name: instituteName,
      type: instituteType,
      parentDistrictId: adminDoc.id
    });
    const newSchoolOrgId = newOrgRef.id;

    // Create the School Admin user in Auth
    const newSchoolAdmin = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true
    });

    // Create the School Admin user in Firestore
    await db.collection('users').doc(newSchoolAdmin.uid).set({
      uid: newSchoolAdmin.uid,
      email,
      firstName,
      lastName,
      role: 'school-admin',
      organizationId: newSchoolOrgId
    });

    // Send a 201 (Created) response with the new admin's data
    res.status(201).json({
      uid: newSchoolAdmin.uid,
      email,
      firstName,
      lastName,
      role: 'school-admin',
      organizationId: newSchoolOrgId,
      displayName: newSchoolAdmin.displayName,
      createdAt: new Date()
    });
  } catch (error) {
    // Handle specific error cases
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Generic error handling
    console.error('Error creating school:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

