const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const { generatePassword, generateEmail, normalizePhoneNumber, isValidEmail, validatePassword } = require('../utils/userHelpers');

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
    
    // Get email, password, firstName, lastName, phoneNumber from req.body
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Create Employee in Auth
    const newEmployeeUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true
    });

    // Create Employee in Firestore
    const userData = {
      uid: newEmployeeUser.uid,
      email,
      firstName,
      lastName,
      role: 'employee',
      organizationId,
      createdAt: new Date(),
      creatorId: creatorId
    };
    
    // Add phoneNumber if provided (future-proof for mobile/SMS)
    if (phoneNumber) {
      userData.phoneNumber = phoneNumber;
    }
    
    await db.collection('users').doc(newEmployeeUser.uid).set(userData);
    
    // Store password for creator to view later
    await db.collection('userCredentials').doc(newEmployeeUser.uid).set({
      uid: newEmployeeUser.uid,
      creatorId: creatorId,
      email,
      password,
      createdAt: new Date()
    });

    // Send a 201 (Created) response with the new employee's data
    res.status(201).json({
      uid: newEmployeeUser.uid,
      email,
      firstName,
      lastName,
      role: 'employee',
      organizationId,
      displayName: newEmployeeUser.displayName,
      password // Return password so frontend can show it once
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

// POST /bulk-create-employees - Bulk import employees
router.post('/bulk-create-employees', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is a staff member (supervisor/hr)
    const staffRef = db.collection('users').doc(req.user.uid);
    const staffDoc = await staffRef.get();
    const staffRole = staffDoc.data()?.role;
    const creatorId = req.user.uid;

    if (!staffDoc.exists || (staffRole !== 'supervisor' && staffRole !== 'hr')) {
      return res.status(403).json({ error: 'You are not authorized for this action.' });
    }

    const organizationId = staffDoc.data().organizationId;
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
      skipDuplicates = true
    } = options;

    if (generateEmails && !emailDomain) {
      return res.status(400).json({ error: 'emailDomain is required when generateEmails is true' });
    }

    const results = {
      total: users.length,
      created: 0,
      skipped: 0,
      errors: [],
      createdUsers: []
    };

    // Pre-check existing emails
    const emailsToCheck = users
      .map(u => u.email)
      .filter(email => email && isValidEmail(email));
    
    const existingEmails = new Set();
    if (emailsToCheck.length > 0) {
      for (let i = 0; i < emailsToCheck.length; i += 10) {
        const batch = emailsToCheck.slice(i, i + 10);
        const query = db.collection('users').where('email', 'in', batch);
        const snapshot = await query.get();
        snapshot.docs.forEach(doc => {
          existingEmails.add(doc.data().email);
        });
      }
    }

    const generatedEmails = new Set();
    const emailCounts = new Map();

    // Process users
    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      const row = i + 1;
      
      try {
        let { firstName, lastName, phoneNumber, email, password } = userData;

        if (!firstName || !lastName) {
          results.errors.push({
            row,
            email: email || 'N/A',
            error: 'First name and last name are required'
          });
          results.skipped++;
          continue;
        }

        // Generate or validate email
        if (!email || !isValidEmail(email)) {
          if (generateEmails && emailDomain) {
            const baseEmail = generateEmail(firstName, lastName, emailDomain);
            let finalEmail = baseEmail;
            let suffix = emailCounts.get(baseEmail) || 0;
            
            while (existingEmails.has(finalEmail) || generatedEmails.has(finalEmail)) {
              suffix++;
              finalEmail = generateEmail(firstName, lastName, emailDomain, suffix);
            }
            
            email = finalEmail;
            emailCounts.set(baseEmail, suffix);
            generatedEmails.add(email);
          } else {
            results.errors.push({
              row,
              email: email || 'N/A',
              error: 'Valid email is required or enable email generation'
            });
            results.skipped++;
            continue;
          }
        }

        if (existingEmails.has(email)) {
          if (skipDuplicates) {
            results.errors.push({
              row,
              email,
              error: 'Email already exists (skipped)'
            });
            results.skipped++;
            continue;
          } else {
            results.errors.push({
              row,
              email,
              error: 'Email already exists'
            });
            results.skipped++;
            continue;
          }
        }

        if (!password) {
          if (generatePasswords) {
            password = generatePassword(12);
          } else {
            results.errors.push({
              row,
              email,
              error: 'Password is required or enable password generation'
            });
            results.skipped++;
            continue;
          }
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          results.errors.push({
            row,
            email,
            error: passwordValidation.error
          });
          results.skipped++;
          continue;
        }

        const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

        const newEmployeeUser = await admin.auth().createUser({
          email,
          password,
          displayName: `${firstName} ${lastName}`,
          emailVerified: true
        });

        const userDoc = {
          uid: newEmployeeUser.uid,
          email,
          firstName,
          lastName,
          role: 'employee',
          organizationId,
          createdAt: new Date(),
          creatorId: creatorId
        };

        if (normalizedPhone) {
          userDoc.phoneNumber = normalizedPhone;
        }

        await db.collection('users').doc(newEmployeeUser.uid).set(userDoc);
        
        // Store password for creator to view later
        await db.collection('userCredentials').doc(newEmployeeUser.uid).set({
          uid: newEmployeeUser.uid,
          creatorId: creatorId,
          email,
          password,
          createdAt: new Date()
        });

        results.created++;
        results.createdUsers.push({
          uid: newEmployeeUser.uid,
          email,
          firstName,
          lastName,
          phoneNumber: normalizedPhone,
          password: generatePasswords ? password : undefined
        });

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const errorEmail = users[i].email || 'N/A';
        let errorMessage = 'Unknown error';
        
        if (error.code === 'auth/email-already-exists') {
          errorMessage = 'Email already exists';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Invalid email format';
        } else if (error.code === 'auth/weak-password') {
          errorMessage = 'Password is too weak';
        } else {
          errorMessage = error.message || 'Failed to create user';
        }

        results.errors.push({
          row: i + 1,
          email: errorEmail,
          error: errorMessage
        });
        results.skipped++;
        console.error(`Error creating employee at row ${i + 1}:`, error);
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk create employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /employee/:employeeId - Get employee details with credentials (only if creator)
router.get('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const employeeId = req.params.employeeId;
    
    // Verify staff created this employee
    const employeeDoc = await db.collection('users').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    if (employeeDoc.data().creatorId !== staffId) {
      return res.status(403).json({ error: 'Not authorized to view this employee' });
    }
    
    // Get credentials if stored
    const credsDoc = await db.collection('userCredentials').doc(employeeId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === staffId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...employeeDoc.data(),
      uid: employeeDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error fetching employee details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /employee/:employeeId - Update employee details
router.put('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const employeeId = req.params.employeeId;
    const { firstName, lastName, email, password, phoneNumber } = req.body;
    
    // Verify staff created this employee
    const employeeDoc = await db.collection('users').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    if (employeeDoc.data().creatorId !== staffId) {
      return res.status(403).json({ error: 'Not authorized to update this employee' });
    }
    
    // Update Firestore
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    
    if (Object.keys(updateData).length > 0) {
      await db.collection('users').doc(employeeId).update(updateData);
    }
    
    // Update email in Auth if changed
    if (email && email !== employeeDoc.data().email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      await admin.auth().updateUser(employeeId, { email });
      await db.collection('users').doc(employeeId).update({ email });
      const credsRef = db.collection('userCredentials').doc(employeeId);
      const credsDoc = await credsRef.get();
      if (credsDoc.exists && credsDoc.data().creatorId === staffId) {
        await credsRef.update({ email, updatedAt: new Date() });
      }
    }
    
    // Update password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }
      await admin.auth().updateUser(employeeId, { password });
      const credsRef = db.collection('userCredentials').doc(employeeId);
      const credsDoc = await credsRef.get();
      if (credsDoc.exists && credsDoc.data().creatorId === staffId) {
        await credsRef.update({ password, updatedAt: new Date() });
      } else {
        await credsRef.set({
          uid: employeeId,
          creatorId: staffId,
          email: email || employeeDoc.data().email,
          password,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // Get updated user data
    const updatedDoc = await db.collection('users').doc(employeeId).get();
    const credsDoc = await db.collection('userCredentials').doc(employeeId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === staffId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...updatedDoc.data(),
      uid: updatedDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /employee/:employeeId - Delete employee (from Auth and Firestore)
router.delete('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const employeeId = req.params.employeeId;
    
    // Verify staff created this employee
    const employeeDoc = await db.collection('users').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    if (employeeDoc.data().creatorId !== staffId) {
      return res.status(403).json({ error: 'Not authorized to delete this employee' });
    }
    
    // Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(employeeId);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    // Delete from Firestore
    await db.collection('users').doc(employeeId).delete();
    await db.collection('userCredentials').doc(employeeId).delete();
    
    // Delete all check-ins for this employee
    const checkInsSnapshot = await db.collection('checkIns')
      .where('studentId', '==', employeeId)
      .get();
    
    const batch = db.batch();
    checkInsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    res.status(200).json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

module.exports = router;

