const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { checkGeofenceAlert } = require('../utils/location.js');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.uid;

    const query = db.collection('checkIns').where('studentId', '==', studentId).orderBy('timestamp', 'desc').limit(50);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const checkIns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(checkIns);
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's unread check-ins
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.uid;
    const query = db.collection('checkIns').where('studentId', '==', studentId).orderBy('timestamp', 'desc').limit(50);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const unread = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(ci => ci.readStatus && ci.readStatus.student === false);

    return res.status(200).json(unread);
  } catch (error) {
    console.error('Error fetching unread check-ins:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const studentId = req.params.studentId;

    // Security Check: Verify the parent is linked to this student
    const linkRef = db.collection('parentStudentLinks').doc(parentId);
    const linkDoc = await linkRef.get();

    if (!linkDoc.exists || !linkDoc.data().studentUids.includes(studentId)) {
      return res.status(403).json({ error: 'You are not authorized to view these check-ins.' });
    }

    // If authorized, fetch check-ins
    const query = db.collection('checkIns').where('studentId', '==', studentId).orderBy('timestamp', 'desc');
    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const checkIns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(checkIns);
  } catch (error) {
    console.error('Error fetching student check-ins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all check-ins as read for a parent viewing a specific student
router.post('/student/:studentId/mark-read', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const studentId = req.params.studentId;

    // Verify parent is linked to student
    const linkRef = db.collection('parentStudentLinks').doc(parentId);
    const linkDoc = await linkRef.get();
    if (!linkDoc.exists || !linkDoc.data().studentUids.includes(studentId)) {
      return res.status(403).json({ error: 'You are not authorized to modify these check-ins.' });
    }

    // Fetch all check-ins for the student
    const q = db.collection('checkIns').where('studentId', '==', studentId);
    const snap = await q.get();

    const batch = db.batch();
    snap.forEach(doc => {
      const data = doc.data() || {};
      const readStatus = data.readStatus || {};
      if (readStatus.parent !== true) {
        batch.update(doc.ref, { 'readStatus.parent': true });
      }
    });
    await batch.commit();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking parent read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.uid;
    const { emojiCategory, specificFeeling, location } = req.body;

    if (!emojiCategory || !specificFeeling) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newCheckIn = {
      studentId: studentId,
      emojiCategory: emojiCategory,
      specificFeeling: specificFeeling,
      timestamp: new Date(),
      readStatus: {
        student: true,
        parent: false,
        school: false
      }
    };

    if (location && location.lat && location.lon) {
      newCheckIn.location = new admin.firestore.GeoPoint(location.lat, location.lon);
    }

    const docRef = await db.collection('checkIns').add(newCheckIn);

    // Fire-and-forget geofence alert (do not await)
    try { checkGeofenceAlert(db, admin, newCheckIn); } catch (_) {}

    res.status(201).json({ id: docRef.id, ...newCheckIn });
  } catch (error) {
    console.error('Error creating check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

