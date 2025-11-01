const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { uid, email } = req.user;

    console.log('Creating/Updating user profile for UID:', uid);

    const userRef = db.collection('users').doc(uid);

    await userRef.set(
      {
        uid,
        email,
        createdAt: new Date(),
        role: 'student'
      },
      { merge: true }
    );

    const doc = await userRef.get();

    res.status(201).json(doc.data());
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

