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

// Helper function to get emoji for category
function getEmojiForCategory(category) {
  const emojiMap = {
    'Happy': '😊',
    'Sad': '😠',
    'Afraid': '😨',
    'Angry': '😡',
    'Unwell': '🤒',
    'Surprised': '😲',
    'Disgusted': '🤢',
    'Hurt': '😭',
    'Tired': '😴',
    'Abused': '🤬'
  };
  return emojiMap[category] || '';
}

// Helper function to notify creator when check-in responds to a schedule
async function notifyCreatorOfResponse(db, admin, scheduleId, emojiCategory, specificFeeling) {
  try {
    // Fetch the schedule to get creatorId and question
    const scheduleDoc = await db.collection('schedules').doc(scheduleId).get();
    if (!scheduleDoc.exists) {
      console.log(`Schedule ${scheduleId} not found, skipping creator notification`);
      return;
    }

    const schedule = scheduleDoc.data();
    const creatorId = schedule.creatorId;
    const question = schedule.message || 'ChexN Question';

    if (!creatorId) {
      console.log('No creatorId in schedule, skipping notification');
      return;
    }

    // Get emoji for the category
    const emoji = getEmojiForCategory(emojiCategory);
    
    // Fetch creator's FCM tokens
    const creatorDoc = await db.collection('users').doc(creatorId).get();
    if (!creatorDoc.exists) {
      console.log(`Creator ${creatorId} not found, skipping notification`);
      return;
    }

    const fcmTokens = creatorDoc.data().fcmTokens || [];
    if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      console.log(`No FCM tokens for creator ${creatorId}`);
      return;
    }

    // Create notification message
    const responseMessage = `${question} Response: ${emoji} ${emojiCategory}`;

    // Send notification to creator
    const payload = {
      notification: {
        title: 'ChexN Response',
        body: responseMessage,
      },
      tokens: fcmTokens,
    };

    await admin.messaging().sendEachForMulticast(payload);
    console.log(`Sent response notification to creator ${creatorId}: ${responseMessage}`);
  } catch (error) {
    console.error('Error notifying creator of response:', error);
    // Don't throw error - this is fire-and-forget, shouldn't break check-in creation
  }
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.uid;
    const { emojiCategory, specificFeeling, location, scheduleId } = req.body;

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

    // Add scheduleId if provided (optional field for backward compatibility)
    if (scheduleId) {
      newCheckIn.scheduleId = scheduleId;
    }

    if (location && location.lat && location.lon) {
      newCheckIn.location = new admin.firestore.GeoPoint(location.lat, location.lon);
    }

    const docRef = await db.collection('checkIns').add(newCheckIn);

    // Fire-and-forget geofence alert (do not await)
    try { checkGeofenceAlert(db, admin, newCheckIn); } catch (_) {}

    // If scheduleId exists, notify the creator (fire-and-forget)
    if (scheduleId) {
      try {
        notifyCreatorOfResponse(db, admin, scheduleId, emojiCategory, specificFeeling);
      } catch (error) {
        console.error('Error in notifyCreatorOfResponse (non-blocking):', error);
      }
    }

    res.status(201).json({ id: docRef.id, ...newCheckIn });
  } catch (error) {
    console.error('Error creating check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

