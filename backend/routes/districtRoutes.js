const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');
const { requireSubscription, checkResourceLimit } = require('../middleware/subscriptionMiddleware');
const { updateUsage } = require('../utils/usageTracker');

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

router.post('/create-institute', authMiddleware, requireSubscription, checkResourceLimit('school'), async (req, res) => {
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
    // Store password for creator to view later
    try {
      await db.collection('userCredentials').set ? Promise.resolve() : Promise.resolve();
    } catch {}
    await db.collection('userCredentials').doc(newSchoolAdmin.uid).set({
      uid: newSchoolAdmin.uid,
      creatorId: req.user.uid,
      email,
      password,
      createdAt: new Date()
    });

    try {
      await updateUsage(req.user.uid, 'school', 1);
    } catch (usageError) {
      console.error('Error updating usage for institute creation:', usageError);
    }

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

router.post('/bulk-create-institutes', authMiddleware, requireSubscription, checkResourceLimit('school'), async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const adminDoc = await db.collection('users').doc(districtAdminId).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'district-admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

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

    // Plan limit enforcement: schools
    const { checkLimit } = require('../utils/usageTracker');
    const limitCheck = await checkLimit(districtAdminId, 'school', users.length);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Limit exceeded',
        message: limitCheck.reason || 'You have reached your plan limit.',
        current: limitCheck.current,
        limit: limitCheck.limit,
        requested: limitCheck.requested || users.length,
        canUpgrade: true,
      });
    }

    const results = { total: users.length, created: 0, skipped: 0, errors: [], createdUsers: [] };

    // Pre-check existing emails to avoid duplicates
    const emailsToCheck = users.map(u => (u.email || '').trim()).filter(e => e);
    const existingEmails = new Set();
    if (emailsToCheck.length > 0) {
      for (let i = 0; i < emailsToCheck.length; i += 10) {
        const batch = emailsToCheck.slice(i, i + 10);
        const snapshot = await db.collection('users').where('email', 'in', batch).get();
        snapshot.docs.forEach(doc => existingEmails.add((doc.data().email || '').trim()));
      }
    }

    for (let i = 0; i < users.length; i++) {
      const row = i + 1;
      const { instituteName, instituteType = 'elementary', firstName, lastName } = users[i] || {};
      let { email, password } = users[i] || {};
      try {
        if (!instituteName || !firstName || !lastName) {
          results.errors.push({ row, email: email || 'N/A', error: 'Missing required fields' });
          results.skipped++;
          continue;
        }

        // Email generation/validation
        email = (email || '').trim();
        if (!email && generateEmails && emailDomain) {
          // Generate email using admin first/last and school name slug
          const slugName = (instituteName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const baseLocal = `${(firstName || '').toLowerCase().replace(/\s+/g, '')}.${(lastName || '').toLowerCase().replace(/\s+/g, '')}`;
          let candidate = `${baseLocal}@${emailDomain}`;
          // try with school slug if conflict
          if (existingEmails.has(candidate)) {
            candidate = `${baseLocal}+${slugName}@${emailDomain}`;
          }
          let suffix = 0;
          while (existingEmails.has(candidate)) {
            suffix++;
            candidate = `${baseLocal}+${slugName}-${suffix}@${emailDomain}`;
          }
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

        // Password generation
        password = (password || '').trim();
        if (!password && generatePasswords) {
          password = require('../utils/userHelpers').generatePassword(12);
        }
        if (!password) {
          results.errors.push({ row, email, error: 'Password is required or enable password generation' });
          results.skipped++;
          continue;
        }

        // Create org
        const newOrgRef = db.collection('organizations').doc();
        await newOrgRef.set({ name: instituteName, type: instituteType, parentDistrictId: districtAdminId });

        // Create school admin auth
        const newUser = await admin.auth().createUser({ email, password, displayName: `${firstName} ${lastName}`, emailVerified: true });

        // Firestore user
        await db.collection('users').doc(newUser.uid).set({
          uid: newUser.uid,
          email,
          firstName,
          lastName,
          role: 'school-admin',
          organizationId: newOrgRef.id,
          createdAt: new Date()
        });
        // Store password for creator to view later
        await db.collection('userCredentials').doc(newUser.uid).set({
          uid: newUser.uid,
          creatorId: districtAdminId,
          email,
          password,
          createdAt: new Date()
        });

        // Update usage
        try { await updateUsage(districtAdminId, 'school', 1); } catch {}

        results.created++;
        results.createdUsers.push({ email, firstName, lastName, instituteName });
        existingEmails.add(email);
      } catch (error) {
        let errorMessage = error?.message || 'Failed to create institute';
        if (error?.code === 'auth/email-already-exists') errorMessage = 'Email already exists';
        results.errors.push({ row, email: email || 'N/A', error: errorMessage });
        results.skipped++;
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk-create-institutes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create-staff', authMiddleware, requireSubscription, async (req, res) => {
  // Optional: If you support creating additional school admins per district, implement here.
});

// List school-admin users under this district (by their organization’s parentDistrictId)
router.get('/school-admins', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    // find orgs under this district
    const orgSnap = await db.collection('organizations').where('parentDistrictId', '==', districtAdminId).get();
    if (orgSnap.empty) return res.status(200).json([]);

    const orgIds = orgSnap.docs.map(d => d.id);
    const chunkSize = 10; // Firestore IN operator limit
    const results = [];
    for (let i = 0; i < orgIds.length; i += chunkSize) {
      const chunk = orgIds.slice(i, i + chunkSize);
      const q = await db.collection('users')
        .where('role', '==', 'school-admin')
        .where('organizationId', 'in', chunk)
        .get();
      q.forEach(doc => {
        const u = doc.data() || {};
        results.push({ uid: doc.id, email: u.email, firstName: u.firstName, lastName: u.lastName, organizationId: u.organizationId });
      });
    }
    return res.status(200).json(results);
  } catch (e) {
    console.error('Error listing school admins:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a school-admin user details (only if belongs to a school under this district)
router.get('/admin/:adminId', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const { adminId } = req.params;
    const userDoc = await db.collection('users').doc(adminId).get();
    if (!userDoc.exists) return res.status(404).send({ error: 'User not found' });
    const user = userDoc.data() || {};
    if (user.role !== 'school-admin') return res.status(403).json({ error: 'Not a school admin' });
    // verify org belongs to this district
    if (!user.organizationId) return res.status(400).json({ error: 'User missing organization' });
    const orgDoc = await db.collection('organizations').doc(user.organizationId).get();
    if (!orgDoc.exists || orgDoc.data().parentDistrictId !== districtAdminId) return res.status(403).json({ error: 'Not authorized' });

    // fetch credentials if created by this district
    const credDoc = await db.collection('userCredentials').doc(adminId).get();
    const credentials = (credDoc.exists && credDoc.data().creatorId === districtAdminId)
      ? { password: credDoc.data().password }
      : null;

    return res.status(200).json({ ...user, uid: userDoc.id, credentials });
  } catch (e) {
    console.error('Error fetching school admin:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a school-admin (name/email/password) if under this district
router.put('/admin/:adminId', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const { adminId } = req.params;
    const { firstName, lastName, email, password } = req.body;

    const userRef = db.collection('users').doc(adminId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data() || {};
    if (user.role !== 'school-admin') return res.status(403).json({ error: 'Not a school admin' });
    const orgDoc = await db.collection('organizations').doc(user.organizationId).get();
    if (!orgDoc.exists || orgDoc.data().parentDistrictId !== districtAdminId) return res.status(403).json({ error: 'Not authorized' });

    const updates = {};
    if (firstName && firstName !== user.firstName) updates.firstName = firstName;
    if (lastName && lastName !== user.lastName) updates.lastName = lastName;
    if (email && email !== user.email) {
      await admin.auth().updateUser(adminId, { email });
      updates.email = email;
      // update credentials email if stored by this district
      const credRef = db.collection('userCredentials').doc(adminId);
      const credDoc = await credRef.get();
      if (credDoc.exists && credDoc.data().creatorId === districtAdminId) {
        await credRef.update({ email, updatedAt: new Date() });
      }
    }
    if (password) {
      await admin.auth().updateUser(adminId, { password });
      const credRef = db.collection('userCredentials').doc(adminId);
      const credDoc = await credRef.get();
      if (credDoc.exists && credDoc.data().creatorId === districtAdminId) {
        await credRef.update({ password, updatedAt: new Date() });
      } else {
        await credRef.set({ uid: adminId, creatorId: districtAdminId, email: updates.email || user.email, password, createdAt: new Date(), updatedAt: new Date() });
      }
    }

    if (Object.keys(updates).length > 0) {
      await userRef.update(updates);
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Error updating school admin:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a school-admin (does not delete the institute). Optional: ensure org has at least one admin? Here we allow delete.
router.delete('/admin/:adminId', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const { adminId } = req.params;
    const userRef = db.collection('users').doc(adminId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data() || {};
    if (user.role !== 'school-admin') return res.status(403).json({ error: 'Not a school admin' });
    const orgDoc = await db.collection('organizations').doc(user.organizationId).get();
    if (!orgDoc.exists || orgDoc.data().parentDistrictId !== districtAdminId) return res.status(403).json({ error: 'Not authorized' });

    // Delete auth user
    try { await admin.auth().deleteUser(adminId); } catch (err) { if (err.code !== 'auth/user-not-found') throw err; }
    // Delete firestore user
    await userRef.delete();
    // Delete stored credentials if created by this district
    const credRef = db.collection('userCredentials').doc(adminId);
    const credDoc = await credRef.get();
    if (credDoc.exists && credDoc.data().creatorId === districtAdminId) {
      await credRef.delete();
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Error deleting school admin:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/institute/:id', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const { id } = req.params;
    const docRef = db.collection('organizations').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Institute not found' });
    const data = doc.data() || {};
    if (data.parentDistrictId !== districtAdminId) return res.status(403).json({ error: 'Not authorized' });

    // Optionally include some counts (e.g., staff count)
    const staffSnap = await db.collection('users').where('organizationId', '==', id).get();
    const response = {
      id: doc.id,
      name: data.name || '',
      type: data.type || '',
      parentDistrictId: data.parentDistrictId || null,
      staffCount: staffSnap.size
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching institute:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/institute/:id', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const { id } = req.params;
    const { name, type } = req.body;

    const docRef = db.collection('organizations').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Institute not found' });
    const data = doc.data() || {};
    if (data.parentDistrictId !== districtAdminId) return res.status(403).json({ error: 'Not authorized' });

    const update = {};
    if (typeof name === 'string' && name.trim() && name !== data.name) update.name = name.trim();
    if (typeof type === 'string' && type.trim() && type !== data.type) update.type = type.trim();

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No changes to update' });
    }

    await docRef.update(update);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating institute:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/institute/:id', authMiddleware, async (req, res) => {
  try {
    const districtAdminId = req.user.uid;
    const { id } = req.params;

    const docRef = db.collection('organizations').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Institute not found' });
    const data = doc.data() || {};
    if (data.parentDistrictId !== districtAdminId) return res.status(403).json({ error: 'Not authorized' });

    // Safety: ensure there are no users in this organization
    const usersSnap = await db.collection('users').where('organizationId', '==', id).limit(1).get();
    if (!usersSnap.empty) {
      return res.status(400).json({ error: 'Institute has associated users. Please delete or reassign its users before deleting the institute.' });
    }

    await docRef.delete();
    // Optionally decrement usage
    try { await updateUsage(districtAdminId, 'school', -1); } catch {}

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting institute:', error);
    return res.status(500,).json({ error: 'Internal server error' });
  }
});

router.get('/coverage', authMiddleware, async (req, res) => {
  try {
    const { db } = require('../config/firebase');
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(200).json({ covered: false });
    const user = userDoc.data() || {};

    // Only school-admin can be covered by a parent district subscription
    if (user.role !== 'school-admin') return res.status(200).json({ covered: false });

    if (!user.organizationId) return res.status(200).json({ covered: false });
    const orgDoc = await db.collection('organizations').doc(user.organizationId).get();
    if (!orgDoc.exists) return res.status(200).json({ covered: false });
    const org = orgDoc.data() || {};
    const parentDistrictId = org.parentDistrictId; // set when district creates the school
    if (!parentDistrictId) return res.status(200).json({ covered: false });

    // Find the district admin user for that parent org id
    const districtAdminSnap = await db.collection('users')
      .where('role', '==', 'district-admin')
      .where('uid', '==', parentDistrictId)
      .limit(1)
      .get();

    let districtAdminId = null;
    if (!districtAdminSnap.empty) {
      districtAdminId = districtAdminSnap.docs[0].id;
    } else {
      // Fallback: some schemas store the district admin by organizationId instead of uid
      const alt = await db.collection('users')
        .where('role', '==', 'district-admin')
        .where('organizationId', '==', parentDistrictId)
        .limit(1)
        .get();
      if (!alt.empty) districtAdminId = alt.docs[0].id;
    }

    if (!districtAdminId) return res.status(200).json({ covered: false });

    const subDoc = await db.collection('subscriptions').doc(districtAdminId).get();
    if (!subDoc.exists) return res.status(200).json({ covered: false });
    const sub = subDoc.data() || {};
    const covered = sub.status === 'active' || sub.status === 'trialing';
    return res.status(200).json({ covered });
  } catch (e) {
    console.error('Error checking coverage:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/effective-limits', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').get().then(snap => snap.docs.find(d => d.id === userId));
    if (!userDoc) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data() || {};

    if (user.role !== 'school-admin') {
      return res.status(400).json({ error: 'Only available for school-admin role' });
    }

    if (!user.organizationId) return res.status(400).json({ error: 'School has no organization' });
    const orgDoc = await db.collection('organizations').doc(user.organizationId).get();
    if (!orgDoc.exists) return res.status(404).json({ error: 'School organization not found' });
    const org = orgDoc.data() || {};
    const parentDistrictId = org.parentDistrictId;
    if (!parentDistrictId) return res.status(404).json({ error: 'School is not linked to a district' });

    // Locate district admin user by id (exact match on uid) or by organizationId fallback
    let districtAdminId = null;
    const districtByUid = await db.collection('users')
      .where('role', '==', 'district-admin')
      .where('uid', '==', parentDistrictId)
      .limit(1)
      .get();
    if (!districtByUid.empty) {
      districtAdminId = districtByUid.docs[0].id;
    } else {
      const districtByOrg = await db.collection('users')
        .where('role', '==', 'district-admin')
        .where('organizationId', '==', parentDistrictId)
        .limit(1)
        .get();
      if (!districtByOrg.empty) {
        districtAdminId = districtByOrg.docs[0].id;
      }
    }

    if (!districtAdminId) return res.status(404).json({ error: 'Parent district admin not found' });

    const subDoc = await db.collection('subscriptions').doc(districtAdminId).get();
    if (!subDoc.exists) return res.status(404).json({ error: 'District has no subscription' });
    const sub = subDoc.data() || {};
    const active = sub.status === 'active' || sub.status === 'trialing';
    if (!active) return res.status(403).json({ error: 'District subscription is not active' });

    const packages = require('../config/packages');
    const pkg = packages.getPackage('districtAdmin', sub.packageId);
    const staffLimit = (pkg?.limits && (pkg.limits.staff || pkg.limits.staffPerSchool)) || 0;
    const studentsPerStaff = (pkg?.limits && pkg.limits.studentsPerStaff) ? pkg.limits.studentsPerStaff : 0;

    return res.status(200).json({
      inherited: true,
      role: 'school-admin',
      fromDistrict: districtAdminId,
      limits: {
        staff: staffLimit,
        studentsPerStaff: studentsPerStaff
      }
    });
  } catch (e) {
    console.error('Error fetching effective limits:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

