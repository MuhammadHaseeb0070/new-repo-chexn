const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

// GET a geofence for a specific user
router.get('/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { targetUserId } = req.params;

    const query = db
      .collection('geofences')
      .where('targetUserId', '==', targetUserId)
      .limit(1);

    const snapshot = await query.get();
    if (snapshot.empty) {
      return res.status(404).json({ error: 'No geofence found for this user' });
    }

    const doc = snapshot.docs[0];
    return res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching geofence:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update (upsert) a geofence
router.post('/', authMiddleware, async (req, res) => {
  try {
    const creatorId = req.user.uid;
    const { targetUserId, location, radius } = req.body;

    if (!targetUserId || !location || typeof radius !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newGeofence = {
      creatorId,
      targetUserId,
      location: new admin.firestore.GeoPoint(location.lat, location.lon),
      radius,
      createdAt: new Date(),
    };

    const query = db
      .collection('geofences')
      .where('targetUserId', '==', targetUserId)
      .limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      await db.collection('geofences').add(newGeofence);
    } else {
      const docRef = snapshot.docs[0].ref;
      await docRef.update(newGeofence);
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error upserting geofence:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


