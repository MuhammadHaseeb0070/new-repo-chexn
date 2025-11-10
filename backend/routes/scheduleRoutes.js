const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

// Create a new schedule
router.post('/', authMiddleware, async (req, res) => {
  try {
    const creatorId = req.user.uid;
    const { targetUserId, time, message } = req.body;

    if (!targetUserId || !time || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Security checks (linked parent, staff with permissions) can be added here

    const newSchedule = {
      creatorId,
      targetUserId,
      time,
      message,
      createdAt: new Date()
    };

    const docRef = await db.collection('schedules').add(newSchedule);
    return res.status(201).json({ id: docRef.id, ...newSchedule });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single schedule by ID
router.get('/by-id/:scheduleId', authMiddleware, async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const scheduleDoc = await db.collection('schedules').doc(scheduleId).get();
    if (!scheduleDoc.exists) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    return res.status(200).json({ id: scheduleDoc.id, ...scheduleDoc.data() });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get schedules for a target user
router.get('/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.params;

    // TODO: Security checks can be added here

    const query = db
      .collection('schedules')
      .where('targetUserId', '==', targetUserId);

    const snapshot = await query.get();
    const schedules = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a schedule by id
router.delete('/:scheduleId', authMiddleware, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    await db.collection('schedules').doc(scheduleId).delete();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual CRON trigger to send scheduled reminders
router.post('/trigger', async (req, res) => {
  try {
    const now = new Date();
    // Use local time, not UTC (since frontend sends local time from HTML time input)
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    console.log('Schedule trigger at (local time):', currentTime);

    const query = db.collection('schedules').where('time', '==', currentTime);
    const snapshot = await query.get();
    if (snapshot.empty) {
      console.log('No schedules to send');
      return res.status(200).json({ success: true, sent: 0 });
    }

    console.log(`Found ${snapshot.docs.length} schedules to send.`);

    for (const scheduleDoc of snapshot.docs) {
      const schedule = scheduleDoc.data();
      const targetUserId = schedule.targetUserId;
      const message = schedule.message || `It's time to Chex-N!`;
      const scheduleId = scheduleDoc.id;

      try {
        const userDoc = await db.collection('users').doc(targetUserId).get();
        if (!userDoc.exists) continue;
        const fcmTokens = userDoc.data().fcmTokens || [];
        if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) continue;

        const payload = {
          notification: {
            title: 'Time to Chex-N!',
            body: message,
          },
          data: {
            scheduleId: scheduleId,
            question: message,
            type: 'scheduled_checkin'
          },
          tokens: fcmTokens,
        };
        await admin.messaging().sendEachForMulticast(payload);
      } catch (innerError) {
        console.error('Error sending scheduled message for user:', targetUserId, innerError);
      }
    }

    return res.status(200).json({ success: true, sent: snapshot.docs.length });
  } catch (error) {
    console.error('Error in schedule trigger:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


