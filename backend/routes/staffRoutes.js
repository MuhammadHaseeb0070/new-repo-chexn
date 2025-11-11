const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase'); // We need 'admin'
const authMiddleware = require('../middleware/authMiddleware');
const { generatePassword, generateEmail, normalizePhoneNumber, isValidEmail, validatePassword } = require('../utils/userHelpers');
const { checkResourceLimit } = require('../middleware/subscriptionMiddleware');
const { updateUsage, refreshUsage, checkLimit } = require('../utils/usageTracker');
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

    // Optimize: batch fetch check-ins using 'in' queries (chunks of 10)
    const studentIds = studentsSnap.docs.map(d => d.id);
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      chunks.push(studentIds.slice(i, i + chunkSize));
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
          const sid = data.studentId;
          countMap[sid] = (countMap[sid] || 0) + 1;
        }
      });
    });
    const results = Object.keys(countMap).map(sid => ({ studentId: sid, unreadCount: countMap[sid] }));
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
      .orderBy('timestamp', 'desc')
      .limit(50);
    
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

// Mark all check-ins as read for school staff viewing a specific student
router.post('/checkins/:studentId/mark-read', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const studentId = req.params.studentId;

    const staffDoc = await db.collection('users').doc(staffId).get();
    if (!staffDoc.exists) return res.status(403).json({ error: 'User profile not found.' });
    const organizationId = staffDoc.data().organizationId;

    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) return res.status(404).json({ error: 'Student not found.' });
    if (studentDoc.data().organizationId !== organizationId) {
      return res.status(403).json({ error: 'You are not authorized to modify this student.' });
    }

    const q = db.collection('checkIns').where('studentId', '==', studentId);
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
    console.error('Error marking staff read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /create-student - (This was missing)
router.post('/create-student', authMiddleware, checkResourceLimit('student'), async (req, res) => {
  try {
    // Security Check: Verify the user is a staff member
    const staffRef = db.collection('users').doc(req.user.uid);
    const staffDoc = await staffRef.get();
    const staffData = staffDoc.data() || {};
    const staffRole = staffData.role;
    const creatorId = req.user.uid;

    if (!staffDoc.exists || (staffRole !== 'teacher' && staffRole !== 'counselor' && staffRole !== 'social-worker')) {
      return res.status(403).json({ error: 'You are not authorized for this action.' });
    }

    // If authorized, get data
    const organizationId = staffData.organizationId;
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Create the user in Firebase Auth (with emailVerified: true)
    const newStudentUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true // This is the fix from Chunk 44
    });

    // Create the user in Firestore
    const userData = {
      uid: newStudentUser.uid,
      email,
      firstName,
      lastName,
      role: 'student',
      organizationId: organizationId,
      createdAt: new Date(),
      creatorId: creatorId
    };
    
    // Add phoneNumber if provided (future-proof for mobile/SMS)
    if (phoneNumber) {
      userData.phoneNumber = phoneNumber;
    }
    
    await db.collection('users').doc(newStudentUser.uid).set(userData);
    
    // Store password for creator to view later
    await db.collection('userCredentials').doc(newStudentUser.uid).set({
      uid: newStudentUser.uid,
      creatorId: creatorId,
      email,
      password,
      createdAt: new Date()
    });

    const adminId = staffData.creatorId;
    const staffName = [staffData.firstName, staffData.lastName].filter(Boolean).join(' ') || staffData.email || 'Staff';
    try {
      if (adminId) {
        await updateUsage(adminId, `student:${creatorId}`, 1, { staffName });
      }
    } catch (usageError) {
      console.error('Error updating usage for student creation:', usageError);
    }

    res.status(201).json({
      uid: newStudentUser.uid,
      email,
      firstName,
      lastName,
      password // Return password so frontend can show it once
    });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists.' });
    }
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /bulk-create-students - Bulk import students
router.post('/bulk-create-students', authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is a staff member
    const staffRef = db.collection('users').doc(req.user.uid);
    const staffDoc = await staffRef.get();
    const staffData = staffDoc.data() || {};
    const staffRole = staffData.role;
    const creatorId = req.user.uid;

    if (!staffDoc.exists || (staffRole !== 'teacher' && staffRole !== 'counselor' && staffRole !== 'social-worker')) {
      return res.status(403).json({ error: 'You are not authorized for this action.' });
    }

    const organizationId = staffData.organizationId;
    const adminId = staffData.creatorId;
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

    // Validate email domain if generating emails
    if (generateEmails && !emailDomain) {
      return res.status(400).json({ error: 'emailDomain is required when generateEmails is true' });
    }

    if (adminId) {
      const limitCheck = await checkLimit(req.user.uid, 'student', users.length);
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
    }

    const results = {
      total: users.length,
      created: 0,
      skipped: 0,
      errors: [],
      createdUsers: []
    };

    // Pre-check existing emails to avoid duplicates
    const emailsToCheck = users
      .map(u => u.email)
      .filter(email => email && isValidEmail(email));
    
    const existingEmails = new Set();
    if (emailsToCheck.length > 0) {
      // Check in batches (Firestore 'in' query limit is 10)
      for (let i = 0; i < emailsToCheck.length; i += 10) {
        const batch = emailsToCheck.slice(i, i + 10);
        const query = db.collection('users').where('email', 'in', batch);
        const snapshot = await query.get();
        snapshot.docs.forEach(doc => {
          existingEmails.add(doc.data().email);
        });
      }
    }

    // Track generated emails to avoid duplicates in batch
    const generatedEmails = new Set();
    const emailCounts = new Map(); // Track counts for suffix generation

    // Check limits before processing
    if (adminId) {
      const limitCheck = await checkLimit(req.user.uid, 'student', users.length);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          error: 'Limit exceeded',
          message: limitCheck.reason || 'You have reached your plan limit.',
          current: limitCheck.current,
          limit: limitCheck.limit,
          requested: limitCheck.requested || users.length,
        });
      }
    }

    // Process users
    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      const row = i + 1;
      
      try {
        let { firstName, lastName, phoneNumber, email, password } = userData;

        // Validate required fields
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
            // Generate email
            const baseEmail = generateEmail(firstName, lastName, emailDomain);
            let finalEmail = baseEmail;
            let suffix = emailCounts.get(baseEmail) || 0;
            
            // Check if base email exists or was already generated
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

        // Check for duplicates
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

        // Generate password if needed
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

        // Validate password
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

        // Normalize phone number
        const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

        // Create user in Firebase Auth
        const newStudentUser = await admin.auth().createUser({
          email,
          password,
          displayName: `${firstName} ${lastName}`,
          emailVerified: true
        });

        // Create user in Firestore
        const userDoc = {
          uid: newStudentUser.uid,
          email,
          firstName,
          lastName,
          role: 'student',
          organizationId: organizationId,
          createdAt: new Date(),
          creatorId: creatorId
        };

        if (normalizedPhone) {
          userDoc.phoneNumber = normalizedPhone;
        }

        await db.collection('users').doc(newStudentUser.uid).set(userDoc);
        
        // Store password for creator to view later
        await db.collection('userCredentials').doc(newStudentUser.uid).set({
          uid: newStudentUser.uid,
          creatorId: creatorId,
          email,
          password,
          createdAt: new Date()
        });

        results.created++;
        results.createdUsers.push({
          uid: newStudentUser.uid,
          email,
          firstName,
          lastName,
          phoneNumber: normalizedPhone,
          password: generatePasswords ? password : undefined // Only return if generated
        });

        // Small delay to avoid rate limiting
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
        console.error(`Error creating student at row ${i + 1}:`, error);
      }
    }

    if (results.created > 0 && adminId) {
      try {
        await refreshUsage(adminId);
      } catch (usageError) {
        console.error('Error refreshing usage after bulk student import:', usageError);
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk create students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /student/:studentId - Get student details with credentials (only if creator)
router.get('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const studentId = req.params.studentId;
    
    // Verify staff created this student
    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    if (studentDoc.data().creatorId !== staffId) {
      return res.status(403).json({ error: 'Not authorized to view this student' });
    }
    
    // Get credentials if stored
    const credsDoc = await db.collection('userCredentials').doc(studentId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === staffId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...studentDoc.data(),
      uid: studentDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /student/:studentId - Update student details
router.put('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const studentId = req.params.studentId;
    const { firstName, lastName, email, password, phoneNumber } = req.body;
    
    // Verify staff created this student
    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    if (studentDoc.data().creatorId !== staffId) {
      return res.status(403).json({ error: 'Not authorized to update this student' });
    }
    
    // Update Firestore
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    
    if (Object.keys(updateData).length > 0) {
      await db.collection('users').doc(studentId).update(updateData);
    }
    
    // Update email in Auth if changed
    if (email && email !== studentDoc.data().email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      await admin.auth().updateUser(studentId, { email });
      await db.collection('users').doc(studentId).update({ email });
      const credsRef = db.collection('userCredentials').doc(studentId);
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
      await admin.auth().updateUser(studentId, { password });
      const credsRef = db.collection('userCredentials').doc(studentId);
      const credsDoc = await credsRef.get();
      if (credsDoc.exists && credsDoc.data().creatorId === staffId) {
        await credsRef.update({ password, updatedAt: new Date() });
      } else {
        await credsRef.set({
          uid: studentId,
          creatorId: staffId,
          email: email || studentDoc.data().email,
          password,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // Get updated user data
    const updatedDoc = await db.collection('users').doc(studentId).get();
    const credsDoc = await db.collection('userCredentials').doc(studentId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === staffId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...updatedDoc.data(),
      uid: updatedDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error updating student:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /student/:studentId - Delete student (from Auth and Firestore)
router.delete('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.uid;
    const studentId = req.params.studentId;
    
    // Verify staff created this student
    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    if (studentDoc.data().creatorId !== staffId) {
      return res.status(403).json({ error: 'Not authorized to delete this student' });
    }
    
    // Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(studentId);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    // Delete from Firestore
    await db.collection('users').doc(studentId).delete();
    await db.collection('userCredentials').doc(studentId).delete();
    
    // Delete all check-ins for this student
    const checkInsSnapshot = await db.collection('checkIns')
      .where('studentId', '==', studentId)
      .get();
    
    const batch = db.batch();
    checkInsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    try {
      const staffDoc = await db.collection('users').doc(staffId).get();
      const staffData = staffDoc.data() || {};
      const adminId = staffData.creatorId;
      const staffName = [staffData.firstName, staffData.lastName].filter(Boolean).join(' ') || staffData.email || 'Staff';
      if (adminId) {
        await updateUsage(adminId, `student:${staffId}`, -1, { staffName });
        await refreshUsage(adminId);
      }
    } catch (usageError) {
      console.error('Error updating usage after student deletion:', usageError);
    }

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

