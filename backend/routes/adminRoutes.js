const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const { generatePassword, generateEmail, normalizePhoneNumber, isValidEmail, validatePassword } = require('../utils/userHelpers');
const { requireSubscription, checkResourceLimit } = require('../middleware/subscriptionMiddleware');
const { updateUsage, refreshUsage } = require('../utils/usageTracker');

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

router.post('/create-staff', authMiddleware, requireSubscription, checkResourceLimit('staff'), async (req, res) => {
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

    try {
      await updateUsage(schoolAdminId, 'staff', 1);

      // Also refresh district admin usage if this school belongs to a district
      try {
        const adminDoc2 = await db.collection('users').doc(schoolAdminId).get();
        const schoolOrgId = adminDoc2.data() && adminDoc2.data().organizationId;
        if (schoolOrgId) {
          const schoolOrgDoc = await db.collection('organizations').doc(schoolOrgId).get();
          const parentOrgId = schoolOrgDoc.exists ? schoolOrgDoc.data().parentOrganizationId : null;
          if (parentOrgId) {
            const districtAdminSnap = await db.collection('users')
              .where('organizationId', '==', parentOrgId)
              .where('role', '==', 'district-admin')
              .limit(1)
              .get();
            if (!districtAdminSnap.empty) {
              const districtAdminId = districtAdminSnap.docs[0].id;
              await refreshUsage(districtAdminId);
            }
          }
        }
      } catch (e) {
        console.error('Error refreshing district usage after staff creation:', e);
      }
    } catch (usageError) {
      console.error('Error updating usage for staff creation:', usageError);
    }

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

router.post('/bulk-create-staff', authMiddleware, async (req, res) => {
  try {
    const schoolAdminId = req.user.uid;
    const adminDoc = await db.collection('users').doc(schoolAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'school-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const organizationId = adminDoc.data().organizationId;
    const { users, options = {} } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Users array is required and must not be empty' });
    }
    if (users.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 users per import' });
    }

    const {
      generateEmails = false,
      emailDomain = null,
      generatePasswords = true,
      skipDuplicates = true,
      defaultRole = 'teacher'
    } = options;

    if (generateEmails && !emailDomain) {
      return res.status(400).json({ error: 'emailDomain is required when generateEmails is true' });
    }

    // Enforce plan limit (staff)
    const limitCheck = await require('../utils/usageTracker').checkLimit(schoolAdminId, 'staff', users.length);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Limit exceeded',
        message: limitCheck.reason || 'You have reached your plan limit. Please open Manage Subscription to upgrade.',
        current: limitCheck.current,
        limit: limitCheck.limit,
        requested: limitCheck.requested || users.length,
        canUpgrade: true,
      });
    }

    const results = {
      total: users.length,
      created: 0,
      skipped: 0,
      errors: [],
      createdUsers: []
    };

    // Pre-check existing emails
    const emailsToCheck = users.map(u => (u.email || '').trim()).filter(e => e);
    const existingEmails = new Set();
    for (let i = 0; i < emailsToCheck.length; i += 10) {
      const batch = emailsToCheck.slice(i, i + 10);
      const snapshot = await db.collection('users').where('email', 'in', batch).get();
      snapshot.docs.forEach(d => existingEmails.add((d.data().email || '').trim()));
    }

    // Process users
    for (let i = 0; i < users.length; i++) {
      const row = i + 1;
      const { firstName, lastName } = users[i];
      let { email, password, phoneNumber, role } = users[i];

      try {
        if (!firstName || !lastName) {
          results.errors.push({ row, email: email || 'N/A', error: 'First name and last name are required' });
          results.skipped++;
          continue;
        }

        // Determine role
        const normalizedRole = (role || defaultRole || 'teacher').toLowerCase();
        const allowedRoles = ['teacher', 'counselor', 'social-worker'];
        const finalRole = allowedRoles.includes(normalizedRole) ? normalizedRole : 'teacher';

        // Email
        email = (email || '').trim();
        if (!email && generateEmails && emailDomain) {
          // Generate simple unique email based on name
          const base = `${(firstName || '').toLowerCase().replace(/\s+/g, '')}.${(lastName || '').toLowerCase().replace(/\s+/g, '')}@${emailDomain}`;
          let candidate = base; let suffix = 0;
          while (existingEmails.has(candidate)) { suffix++; candidate = `${(firstName || '').toLowerCase()}.${(lastName || '').toLowerCase()}+${suffix}@${emailDomain}`; }
          email = candidate;
        }
        if (!email) {
          results.errors.push({ row, email: 'N/A', error: 'Email is required or enable email generation' });
          results.skipped++;
          continue;
        }
        if (existingEmails.has(email)) {
          if (skipDuplicates) {
            results.errors.push({ row, email, error: 'Email already exists (skipped)' });
            results.skipped++;
            continue;
          } else {
            results.errors.push({ row, email, error: 'Email already exists' });
            results.skipped++;
            continue;
          }
        }

        // Password
        password = (password || '').trim();
        if (!password && generatePasswords) {
          password = require('../utils/userHelpers').generatePassword(12);
        }
        if (!password) {
          results.errors.push({ row, email, error: 'Password is required or enable password generation' });
          results.skipped++;
          continue;
        }

        const normalizedPhone = phoneNumber ? require('../utils/userHelpers').normalizePhoneNumber(phoneNumber) : null;

        // Create Auth user
        const newUser = await admin.auth().createUser({
          email,
          password,
          displayName: `${firstName} ${lastName}`,
          emailVerified: true
        });

        // Firestore doc
        const userDoc = {
          uid: newUser.uid,
          email,
          firstName: (firstName || '').trim(),
          lastName: (lastName || '').trim(),
          role: finalRole,
          organizationId,
          createdAt: new Date(),
          creatorId: schoolAdminId
        };
        if (normalizedPhone) userDoc.phoneNumber = normalizedPhone;
        await db.collection('users').doc(newUser.uid).set(userDoc);

        // Store password for admin to view later
        await db.collection('userCredentials').doc(newUser.uid).set({
          uid: newUser.uid,
          creatorId: schoolAdminId,
          email,
          password,
          createdAt: new Date()
        });

        results.created++;
        results.createdUsers.push({ email, firstName: userDoc.firstName, lastName: userDoc.lastName, password: generatePasswords ? password : undefined });
        existingEmails.add(email);
      } catch (error) {
        let errorMessage = error?.message || 'Failed to create user';
        if (error?.code === 'auth/email-already-exists') errorMessage = 'Email already exists';
        results.errors.push({ row, email: email || 'N/A', error: errorMessage });
        results.skipped++;
      }
    }

    // Refresh usage for school admin and district (if any)
    try {
      await refreshUsage(schoolAdminId);
      const adminDoc2 = await db.collection('users').doc(schoolAdminId).get();
      const schoolOrgId = adminDoc2.data() && adminDoc2.data().organizationId;
      if (schoolOrgId) {
        const schoolOrgDoc = await db.collection('organizations').doc(schoolOrgId).get();
        const parentOrgId = schoolOrgDoc.exists ? schoolOrgDoc.data().parentOrganizationId : null;
        if (parentOrgId) {
          const districtAdminSnap = await db.collection('users')
            .where('organizationId', '==', parentOrgId)
            .where('role', '==', 'district-admin')
            .limit(1)
            .get();
          if (!districtAdminSnap.empty) {
            const districtAdminId = districtAdminSnap.docs[0].id;
            await refreshUsage(districtAdminId);
          }
        }
      }
    } catch (e) {
      console.error('Error refreshing usage after bulk staff import:', e);
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk create staff (school-admin):', error);
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
    
    try {
      await updateUsage(schoolAdminId, 'staff', -1);
      await refreshUsage(schoolAdminId);

      // Also refresh the parent district admin's usage, if any
      try {
        const adminDoc2 = await db.collection('users').doc(schoolAdminId).get();
        const schoolOrgId = adminDoc2.data() && adminDoc2.data().organizationId;
        if (schoolOrgId) {
          const schoolOrgDoc = await db.collection('organizations').doc(schoolOrgId).get();
          const parentOrgId = schoolOrgDoc.exists ? schoolOrgDoc.data().parentOrganizationId : null;
          if (parentOrgId) {
            const districtAdminSnap = await db.collection('users')
              .where('organizationId', '==', parentOrgId)
              .where('role', '==', 'district-admin')
              .limit(1)
              .get();
            if (!districtAdminSnap.empty) {
              const districtAdminId = districtAdminSnap.docs[0].id;
              await refreshUsage(districtAdminId);
            }
          }
        }
      } catch (e) {
        console.error('Error refreshing district usage after staff deletion:', e);
      }
    } catch (usageError) {
      console.error('Error updating usage after staff deletion:', usageError);
    }

    res.status(200).json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

