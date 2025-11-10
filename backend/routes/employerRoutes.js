const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const { generatePassword, generateEmail, normalizePhoneNumber, isValidEmail, validatePassword } = require('../utils/userHelpers');

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

    const employerAdminId = req.user.uid;
    
    // Create the Staff user in Firestore
    await db.collection('users').doc(newStaffUser.uid).set({
      uid: newStaffUser.uid,
      email,
      firstName,
      lastName,
      role,
      organizationId,
      creatorId: employerAdminId // Store creator for management
    });
    
    // Store password for creator to view later
    await db.collection('userCredentials').doc(newStaffUser.uid).set({
      uid: newStaffUser.uid,
      creatorId: employerAdminId,
      email,
      password,
      createdAt: new Date()
    });

    // Send a 201 (Created) response with the new staff's data
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

// POST /bulk-create-staff - Bulk import employer staff
router.post('/bulk-create-staff', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is an employer-admin
    const employerAdminRef = db.collection('users').doc(req.user.uid);
    const adminDoc = await employerAdminRef.get();

    if (!adminDoc.exists || adminDoc.data().role !== 'employer-admin') {
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
      defaultRole = 'supervisor' // Default role for staff
    } = options;

    if (generateEmails && !emailDomain) {
      return res.status(400).json({ error: 'Email domain is required when generating emails' });
    }

    const results = {
      created: 0,
      skipped: 0,
      failed: 0,
      total: users.length,
      errors: [],
      createdUsers: []
    };

    // Process users in batches to avoid overwhelming Firebase
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (user, index) => {
        const rowNumber = i + index + 1;
        
        try {
          const { firstName, lastName, phoneNumber, email: providedEmail, password: providedPassword, role } = user;

          if (!firstName || !lastName) {
            results.errors.push({ row: rowNumber, email: providedEmail || 'N/A', error: 'First name and last name are required' });
            results.failed++;
            return;
          }

          // Determine email
          let email = providedEmail?.trim() || null;
          if (!email && generateEmails) {
            // Check for duplicates and generate unique email
            let emailSuffix = 0;
            let uniqueEmail = generateEmail(firstName, lastName, emailDomain, emailSuffix);
            
            // Check if email exists
            while (true) {
              try {
                await admin.auth().getUserByEmail(uniqueEmail);
                // Email exists, try next suffix
                emailSuffix++;
                uniqueEmail = generateEmail(firstName, lastName, emailDomain, emailSuffix);
              } catch (error) {
                if (error.code === 'auth/user-not-found') {
                  // Email doesn't exist, we can use it
                  email = uniqueEmail;
                  break;
                } else {
                  throw error;
                }
              }
            }
          }

          if (!email) {
            results.errors.push({ row: rowNumber, email: 'N/A', error: 'Email is required' });
            results.failed++;
            return;
          }

          // Check for duplicate email if skipDuplicates is enabled
          if (skipDuplicates) {
            try {
              await admin.auth().getUserByEmail(email);
              // User exists, skip
              results.skipped++;
              return;
            } catch (error) {
              if (error.code !== 'auth/user-not-found') {
                throw error;
              }
              // User doesn't exist, continue
            }
          }

          // Validate email format
          if (!isValidEmail(email)) {
            results.errors.push({ row: rowNumber, email, error: 'Invalid email format' });
            results.failed++;
            return;
          }

          // Determine password
          let password = providedPassword?.trim() || null;
          if (!password && generatePasswords) {
            password = generatePassword();
          }

          if (!password) {
            results.errors.push({ row: rowNumber, email, error: 'Password is required' });
            results.failed++;
            return;
          }

          // Validate password
          const passwordValidation = validatePassword(password);
          if (!passwordValidation.valid) {
            results.errors.push({ row: rowNumber, email, error: passwordValidation.error });
            results.failed++;
            return;
          }

          // Determine role (use provided role, default role from options, or 'supervisor')
          const staffRole = role && ['supervisor', 'hr'].includes(role.toLowerCase()) 
            ? role.toLowerCase() 
            : (defaultRole && ['supervisor', 'hr'].includes(defaultRole.toLowerCase()) 
              ? defaultRole.toLowerCase() 
              : 'supervisor');

          // Normalize phone number if provided
          const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

          // Create the user in Firebase Auth
          const newStaffUser = await admin.auth().createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
            emailVerified: true
          });

          const employerAdminId = req.user.uid;
          
          // Create the user in Firestore
          const userData = {
            uid: newStaffUser.uid,
            email,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role: staffRole,
            organizationId,
            createdAt: new Date(),
            creatorId: employerAdminId // Store creator for management
          };

          if (normalizedPhone) {
            userData.phoneNumber = normalizedPhone;
          }

          await db.collection('users').doc(newStaffUser.uid).set(userData);
          
          // Store password for creator to view later
          await db.collection('userCredentials').doc(newStaffUser.uid).set({
            uid: newStaffUser.uid,
            creatorId: employerAdminId,
            email,
            password,
            createdAt: new Date()
          });

          results.created++;
          results.createdUsers.push({
            email,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role: staffRole,
            password: generatePasswords ? password : undefined // Only include if generated
          });
        } catch (error) {
          console.error(`Error creating staff user at row ${rowNumber}:`, error);
          
          let errorMessage = 'Failed to create user';
          if (error.code === 'auth/email-already-exists') {
            errorMessage = 'Email already exists';
            if (skipDuplicates) {
              results.skipped++;
              return;
            }
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email format';
          } else if (error.message) {
            errorMessage = error.message;
          }

          results.errors.push({ 
            row: rowNumber, 
            email: user.email || 'N/A', 
            error: errorMessage 
          });
          results.failed++;
        }
      }));
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk create staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /staff/:staffId - Get staff details with credentials (only if creator)
router.get('/staff/:staffId', authMiddleware, async (req, res) => {
  try {
    const employerAdminId = req.user.uid;
    const staffId = req.params.staffId;
    
    // Verify employer admin created this staff
    const staffDoc = await db.collection('users').doc(staffId).get();
    if (!staffDoc.exists) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    
    // Verify it's staff from this employer's organization
    const adminDoc = await db.collection('users').doc(employerAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'employer-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const organizationId = adminDoc.data().organizationId;
    if (staffDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'Not authorized to view this staff' });
    }
    
    // Get credentials if stored and creator matches
    const credsDoc = await db.collection('userCredentials').doc(staffId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === employerAdminId 
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
    const employerAdminId = req.user.uid;
    const staffId = req.params.staffId;
    const { firstName, lastName, email, password, phoneNumber, role } = req.body;
    
    // Verify employer admin and organization
    const adminDoc = await db.collection('users').doc(employerAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'employer-admin') {
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
    
    // Update Firestore
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    if (role !== undefined && ['supervisor', 'hr'].includes(role.toLowerCase())) {
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
      if (credsDoc.exists && credsDoc.data().creatorId === employerAdminId) {
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
      if (credsDoc.exists && credsDoc.data().creatorId === employerAdminId) {
        await credsRef.update({ password, updatedAt: new Date() });
      } else {
        await credsRef.set({
          uid: staffId,
          creatorId: employerAdminId,
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
    const credentials = credsDoc.exists && credsDoc.data().creatorId === employerAdminId 
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
    const employerAdminId = req.user.uid;
    const staffId = req.params.staffId;
    
    // Verify employer admin and organization
    const adminDoc = await db.collection('users').doc(employerAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'employer-admin') {
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

