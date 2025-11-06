const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/:checkInId/message', authMiddleware, async (req, res) => {
  try {
    // Get the senderId from req.user.uid
    const senderId = req.user.uid;

    // Get the checkInId from req.params
    const checkInId = req.params.checkInId;

    // Get the text from req.body
    const { text } = req.body;

    // Security Check: Verify this senderId is authorized to see this checkInId
    // Parallelize Firestore reads
    const checkInRef = db.collection('checkIns').doc(checkInId);
    const senderRef = db.collection('users').doc(senderId);
    
    const [checkInDoc, senderDoc] = await Promise.all([
      checkInRef.get(),
      senderRef.get()
    ]);

    if (!checkInDoc.exists) {
      return res.status(404).json({ error: 'Check-in not found.' });
    }

    if (!senderDoc.exists) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const studentId = checkInDoc.data().studentId;
    const senderData = senderDoc.data();
    // Use their full name if it exists, otherwise fall back to their email
    const senderName = senderData.firstName ? `${senderData.firstName} ${senderData.lastName}` : senderData.email;
    const senderRole = senderData.role;
    // --- New Logic: Determine who has "read" this new message ---
    // By default, everyone is set to false, then we set the sender to true.
    let newReadStatus = {
      student: false,
      parent: false,
      school: false
    };
    if (senderRole === 'parent') {
      newReadStatus.parent = true;
    } else if (senderRole === 'student' || senderRole === 'employee') {
      newReadStatus.student = true;
    } else {
      // Any school staff (teacher, counselor, supervisor, etc.)
      newReadStatus.school = true;
    }
    const senderOrgId = senderData.organizationId;

    // Authorize the Sender
    let isAuthorized = false;

    // Students/Employees can access their own check-ins
    if ((senderRole === 'student' || senderRole === 'employee') && senderId === studentId) {
      isAuthorized = true;
    } else if (senderRole === 'parent') {
      const linkDoc = await db.collection('parentStudentLinks').doc(senderId).get();
      if (linkDoc.exists && linkDoc.data().studentUids.includes(studentId)) {
        isAuthorized = true;
      }
    } else if (senderRole === 'teacher' || senderRole === 'counselor' || senderRole === 'school-admin' || senderRole === 'supervisor' || senderRole === 'hr') {
      // Only check if orgId exists and matches
      if (senderOrgId) {
        const studentDoc = await db.collection('users').doc(studentId).get();
        if (studentDoc.exists && studentDoc.data().organizationId === senderOrgId) {
          isAuthorized = true;
        }
      }
    }

    // If Not Authorized
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    // If Authorized, Save the Message
    const message = {
      senderId,
      text,
      timestamp: new Date(),
      senderName: senderName
    };

    // We will store messages in a sub-collection
    const messageRef = db.collection('communications').doc(checkInId).collection('messages').doc();
    await messageRef.set(message);
    
    // Fire-and-forget: Update readStatus (don't block response)
    checkInRef.update({ readStatus: newReadStatus }).catch(() => {});

    // Send a 201 (Created) response with the new message immediately
    res.status(201).json({
      id: messageRef.id,
      ...message
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:checkInId', authMiddleware, async (req, res) => {
  try {
    // Get the userId from req.user.uid
    const userId = req.user.uid;

    // Get the checkInId from req.params
    const checkInId = req.params.checkInId;

    // Security Check: Parallelize Firestore reads
    const checkInRef = db.collection('checkIns').doc(checkInId);
    const senderRef = db.collection('users').doc(userId);
    
    const [checkInDoc, senderDoc] = await Promise.all([
      checkInRef.get(),
      senderRef.get()
    ]);

    if (!checkInDoc.exists) {
      return res.status(404).json({ error: 'Check-in not found.' });
    }

    if (!senderDoc.exists) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const studentId = checkInDoc.data().studentId;
    const senderRole = senderDoc.data().role;
    const senderOrgId = senderDoc.data().organizationId;

    // Authorize the Sender
    let isAuthorized = false;

    // Students/Employees can access their own check-ins
    if ((senderRole === 'student' || senderRole === 'employee') && userId === studentId) {
      isAuthorized = true;
    } else if (senderRole === 'parent') {
      const linkDoc = await db.collection('parentStudentLinks').doc(userId).get();
      if (linkDoc.exists && linkDoc.data().studentUids.includes(studentId)) {
        isAuthorized = true;
      }
    } else if (senderRole === 'teacher' || senderRole === 'counselor' || senderRole === 'school-admin' || senderRole === 'supervisor' || senderRole === 'hr') {
      // Only check if orgId exists and matches
      if (senderOrgId) {
        const studentDoc = await db.collection('users').doc(studentId).get();
        if (studentDoc.exists && studentDoc.data().organizationId === senderOrgId) {
          isAuthorized = true;
        }
      }
    }

    // If Not Authorized
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    // If Authorized, Fetch Messages (limit to recent 50 for faster loading)
    const messagesRef = db.collection('communications').doc(checkInId).collection('messages').orderBy('timestamp', 'asc').limit(50);
    const snapshot = await messagesRef.get();

    // If snapshot.empty, return an empty array
    if (snapshot.empty) {
      // Fire-and-forget: Mark read (don't block response)
      const updatedReadStatus = checkInDoc.data().readStatus || { student: false, parent: false, school: false };
      if (senderRole === 'parent') {
        updatedReadStatus.parent = true;
      } else if (senderRole === 'student' || senderRole === 'employee') {
        updatedReadStatus.student = true;
      } else {
        updatedReadStatus.school = true;
      }
      checkInRef.update({ readStatus: updatedReadStatus }).catch(() => {});
      return res.status(200).json([]);
    }

    // Map the results
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Fire-and-forget: Mark read (don't block response)
    const updatedReadStatus = checkInDoc.data().readStatus || { student: false, parent: false, school: false };
    if (senderRole === 'parent') {
      updatedReadStatus.parent = true;
    } else if (senderRole === 'student' || senderRole === 'employee') {
      updatedReadStatus.student = true;
    } else {
      updatedReadStatus.school = true;
    }
    checkInRef.update({ readStatus: updatedReadStatus }).catch(() => {});

    // Send the array of messages immediately
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

