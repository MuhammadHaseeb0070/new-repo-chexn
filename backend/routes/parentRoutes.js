const express = require("express");
const router = express.Router();
const { admin, db } = require("../config/firebase");
const authMiddleware = require("../middleware/authMiddleware");
const { requireSubscription, checkResourceLimit } = require("../middleware/subscriptionMiddleware");
const { updateUsage, checkLimit, refreshUsage } = require("../utils/usageTracker");
const { generatePassword, generateEmail, normalizePhoneNumber, isValidEmail, validatePassword } = require("../utils/userHelpers");

// GET /my-students - list children linked to the logged-in parent
router.get("/my-students", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const linkRef = db.collection("parentStudentLinks").doc(parentId);
    const linkDoc = await linkRef.get();

    if (!linkDoc.exists) {
      return res.status(200).json([]);
    }

    const studentUids = linkDoc.data().studentUids || [];
    if (!Array.isArray(studentUids) || studentUids.length === 0) {
      return res.status(200).json([]);
    }

    // Fetch each student profile
    const snapshots = await Promise.all(
      studentUids.map((uid) => db.collection("users").doc(uid).get())
    );

    const students = snapshots
      .filter((d) => d.exists)
      .map((d) => ({ uid: d.id, ...d.data() }));

    return res.status(200).json(students);
  } catch (error) {
    console.error("Error fetching parent's students:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /unread-summary - returns unread counts per child for this parent
router.get('/unread-summary', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const linkRef = db.collection('parentStudentLinks').doc(parentId);
    const linkDoc = await linkRef.get();
    if (!linkDoc.exists) return res.status(200).json([]);
    const studentUids = linkDoc.data().studentUids || [];
    if (!Array.isArray(studentUids) || studentUids.length === 0) {
      return res.status(200).json([]);
    }

    // Batch with 'in' queries (chunks of 10)
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < studentUids.length; i += chunkSize) {
      chunks.push(studentUids.slice(i, i + chunkSize));
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
        if (data.readStatus && data.readStatus.parent === false) {
          const sid = data.studentId;
          countMap[sid] = (countMap[sid] || 0) + 1;
        }
      });
    });
    const results = Object.keys(countMap).map(sid => ({ studentId: sid, unreadCount: countMap[sid] }));
    return res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching parent unread summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/create-child", authMiddleware, requireSubscription, checkResourceLimit('child'), async (req, res) => {
  try {
    // Security Check: Verify the user is a parent
    const parentRef = db.collection("users").doc(req.user.uid);
    const parentDoc = await parentRef.get();

    if (!parentDoc.exists || parentDoc.data().role !== "parent") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const parentId = parentDoc.id;
    const linkRef = db.collection("parentStudentLinks").doc(parentId);

    // Get Data: Get email, password, firstName, lastName, phoneNumber from req.body
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Create Child in Auth
    const newChildUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true, // Add this line
    });

    // Create Child in Firestore
    const userData = {
      uid: newChildUser.uid,
      email,
      firstName,
      lastName,
      role: "student",
      creatorId: parentId, // Store creator for management
    };
    
    // Add phoneNumber if provided (future-proof for mobile/SMS)
    if (phoneNumber) {
      userData.phoneNumber = phoneNumber;
    }
    
    await db.collection("users").doc(newChildUser.uid).set(userData);
    
    // Store password for creator to view later (in userCredentials collection)
    await db.collection("userCredentials").doc(newChildUser.uid).set({
      uid: newChildUser.uid,
      creatorId: parentId,
      email,
      password, // Store plain password (only accessible by creator via security rules or backend check)
      createdAt: new Date()
    });

    // Link Child to Parent
    await linkRef.set(
      { studentUids: admin.firestore.FieldValue.arrayUnion(newChildUser.uid) },
      { merge: true }
    );

    // Update usage tracking
    try {
      await updateUsage(parentId, 'child', 1);
    } catch (usageError) {
      console.error('Error updating usage:', usageError);
      // Don't fail the request if usage update fails
    }

    // Send a 201 (Created) response with the new child's data (include password for initial display)
    res.status(201).json({
      uid: newChildUser.uid,
      email,
      firstName,
      lastName,
      role: "student",
      displayName: newChildUser.displayName,
      password // Return password so frontend can show it once
    });
  } catch (error) {
    // Handle specific error cases
    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Generic error handling
    console.error("Error creating child:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /bulk-create-children - Bulk import children
router.post("/bulk-create-children", authMiddleware, requireSubscription, async (req, res) => {
  try {
    // Security Check: Verify the user is a parent
    const parentRef = db.collection("users").doc(req.user.uid);
    const parentDoc = await parentRef.get();

    if (!parentDoc.exists || parentDoc.data().role !== "parent") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const parentId = parentDoc.id;
    const { users, options = {} } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: "Users array is required and must not be empty" });
    }

    if (users.length > 100) {
      return res.status(400).json({ error: "Maximum 100 users per import" });
    }

    // Enforce plan limit
    const limitCheck = await checkLimit(parentId, 'child', users.length);
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

    const {
      generateEmails = false,
      emailDomain = null,
      generatePasswords = true,
      skipDuplicates = true
    } = options;

    if (generateEmails && !emailDomain) {
      return res.status(400).json({ error: "emailDomain is required when generateEmails is true" });
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
        const query = db.collection("users").where("email", "in", batch);
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
            email: email || "N/A",
            error: "First name and last name are required"
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
              email: email || "N/A",
              error: "Valid email is required or enable email generation"
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
              error: "Email already exists (skipped)"
            });
            results.skipped++;
            continue;
          } else {
            results.errors.push({
              row,
              email,
              error: "Email already exists"
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
              error: "Password is required or enable password generation"
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

        const newChildUser = await admin.auth().createUser({
          email,
          password,
          displayName: `${firstName} ${lastName}`,
          emailVerified: true
        });

        const childData = {
          uid: newChildUser.uid,
          email,
          firstName,
          lastName,
          role: 'student',
          creatorId: parentId,
          createdAt: new Date()
        };

        if (normalizedPhone) {
          childData.phoneNumber = normalizedPhone;
        }

        await db.collection('users').doc(newChildUser.uid).set(childData);

        await db.collection('userCredentials').doc(newChildUser.uid).set({
          uid: newChildUser.uid,
          creatorId: parentId,
          email,
          password,
          createdAt: new Date()
        });

        await db.collection('parentStudentLinks').doc(parentId).set({
          studentUids: admin.firestore.FieldValue.arrayUnion(newChildUser.uid)
        }, { merge: true });

        results.created++;
        results.createdUsers.push({
          uid: newChildUser.uid,
          email,
          firstName,
          lastName,
          password: generatePasswords ? password : undefined
        });

        try {
          await updateUsage(parentId, 'child', 1);
        } catch (usageError) {
          console.error('Error updating usage for child creation:', usageError);
        }

      } catch (error) {
        const errorEmail = users[i].email || "N/A";
        let errorMessage = 'Failed to create user';
        if (error.code === 'auth/email-already-exists') {
          errorMessage = 'Email already exists';
          if (skipDuplicates) {
            results.skipped++;
            continue;
          }
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Invalid email format';
        } else if (error.message) {
          errorMessage = error.message;
        }

        results.errors.push({ row: i + 1, email: errorEmail, error: errorMessage });
        results.skipped++;
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk create children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /child/:childId - Get child details with credentials (only if creator)
router.get('/child/:childId', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const childId = req.params.childId;
    
    // Verify parent has access to this child
    const linkRef = db.collection('parentStudentLinks').doc(parentId);
    const linkDoc = await linkRef.get();
    
    if (!linkDoc.exists) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const studentUids = linkDoc.data().studentUids || [];
    if (!studentUids.includes(childId)) {
      return res.status(403).json({ error: 'Not authorized to view this child' });
    }
    
    // Get child user data
    const childDoc = await db.collection('users').doc(childId).get();
    if (!childDoc.exists) {
      return res.status(404).json({ error: 'Child not found' });
    }
    
    // Get credentials if stored
    const credsDoc = await db.collection('userCredentials').doc(childId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === parentId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...childDoc.data(),
      uid: childDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error fetching child details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /child/:childId - Update child details
router.put('/child/:childId', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const childId = req.params.childId;
    const { firstName, lastName, email, password, phoneNumber } = req.body;
    
    // Verify parent has access
    const linkRef = db.collection('parentStudentLinks').doc(parentId);
    const linkDoc = await linkRef.get();
    
    if (!linkDoc.exists) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const studentUids = linkDoc.data().studentUids || [];
    if (!studentUids.includes(childId)) {
      return res.status(403).json({ error: 'Not authorized to update this child' });
    }
    
    // Get child user
    const childDoc = await db.collection('users').doc(childId).get();
    if (!childDoc.exists) {
      return res.status(404).json({ error: 'Child not found' });
    }
    
    // Update Firestore
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    
    if (Object.keys(updateData).length > 0) {
      await db.collection('users').doc(childId).update(updateData);
    }
    
    // Update email in Auth if changed
    if (email && email !== childDoc.data().email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      await admin.auth().updateUser(childId, { email });
      await db.collection('users').doc(childId).update({ email });
      // Update credentials email too
      const credsRef = db.collection('userCredentials').doc(childId);
      const credsDoc = await credsRef.get();
      if (credsDoc.exists && credsDoc.data().creatorId === parentId) {
        await credsRef.update({ email, updatedAt: new Date() });
      }
    }
    
    // Update password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }
      await admin.auth().updateUser(childId, { password });
      // Update stored password
      const credsRef = db.collection('userCredentials').doc(childId);
      const credsDoc = await credsRef.get();
      if (credsDoc.exists && credsDoc.data().creatorId === parentId) {
        await credsRef.update({ password, updatedAt: new Date() });
      } else {
        await credsRef.set({
          uid: childId,
          creatorId: parentId,
          email: email || childDoc.data().email,
          password,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // Get updated user data
    const updatedDoc = await db.collection('users').doc(childId).get();
    const credsDoc = await db.collection('userCredentials').doc(childId).get();
    const credentials = credsDoc.exists && credsDoc.data().creatorId === parentId 
      ? { password: credsDoc.data().password }
      : null;
    
    res.status(200).json({
      ...updatedDoc.data(),
      uid: updatedDoc.id,
      credentials
    });
  } catch (error) {
    console.error('Error updating child:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /child/:childId - Delete child (from Auth and Firestore)
router.delete('/child/:childId', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const childId = req.params.childId;
    
    // Verify parent has access
    const linkRef = db.collection('parentStudentLinks').doc(parentId);
    const linkDoc = await linkRef.get();
    
    if (!linkDoc.exists) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const studentUids = linkDoc.data().studentUids || [];
    if (!studentUids.includes(childId)) {
      return res.status(403).json({ error: 'Not authorized to delete this child' });
    }
    
    // Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(childId);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    // Delete from Firestore
    await db.collection('users').doc(childId).delete();
    await db.collection('userCredentials').doc(childId).delete();
    
    // Remove from parent link
    await linkRef.update({
      studentUids: admin.firestore.FieldValue.arrayRemove(childId)
    });
    
    // Delete all check-ins for this child
    const checkInsSnapshot = await db.collection('checkIns')
      .where('studentId', '==', childId)
      .get();
    
    const batch = db.batch();
    checkInsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    // Update usage tracking
    try {
      await updateUsage(parentId, 'child', -1);
      // Ensure recalculation in case of any drift
      await refreshUsage(parentId);
    } catch (usageError) {
      console.error('Error updating usage:', usageError);
      // Don't fail the request if usage update fails
    }
    
    res.status(200).json({ success: true, message: 'Child deleted successfully' });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
