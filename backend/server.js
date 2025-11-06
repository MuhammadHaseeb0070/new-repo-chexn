// In backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// --- Import our new files ---
// Initialize Firebase Admin (this line is important!)
const { admin } = require('./config/firebase');
// Import our auth middleware
const authMiddleware = require('./middleware/authMiddleware');
// Import user routes
const userRoutes = require('./routes/userRoutes');
// Import check-in routes
const checkinRoutes = require('./routes/checkinRoutes');
const parentRoutes = require('./routes/parentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const staffRoutes = require('./routes/staffRoutes');
const districtRoutes = require('./routes/districtRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const employerRoutes = require('./routes/employerRoutes');
const employerStaffRoutes = require('./routes/employerStaffRoutes');
const geofenceRoutes = require('./routes/geofenceRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api/users', userRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/district', districtRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/employer-staff', employerStaffRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/schedules', scheduleRoutes);

// 1. Public Test Route (from Chunk 1)
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the ChexN Backend!' });
});

// 2. NEW Secure Test Route
// Notice we add "authMiddleware" before the (req, res) handler.
// This means authMiddleware will run FIRST.
app.get('/api/test-secure', authMiddleware, (req, res) => {
  // If we get here, it means the token was valid!
  // We can safely access req.user which we set in the middleware.
  res.json({ 
    message: 'Success! You have accessed a secure route.',
    userEmail: req.user.email,
    userId: req.user.uid 
  });
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set up cron job to check and send scheduled notifications every minute
  const cron = require('node-cron');
  const { db, admin } = require('./config/firebase');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Use local time, not UTC (since frontend sends local time from HTML time input)
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${currentHour}:${currentMinute}`;
      
      const query = db.collection('schedules').where('time', '==', currentTime);
      const snapshot = await query.get();
      if (snapshot.empty) {
        return; // No schedules to send
      }
      
      console.log(`[Cron] Found ${snapshot.docs.length} schedule(s) to send at ${currentTime}`);
      
      let sentCount = 0;
      for (const scheduleDoc of snapshot.docs) {
        const schedule = scheduleDoc.data();
        const targetUserId = schedule.targetUserId;
        const message = schedule.message || 'It\'s time to Chex-N!';
        
        try {
          const userDoc = await db.collection('users').doc(targetUserId).get();
          if (!userDoc.exists) continue;
          const fcmTokens = userDoc.data().fcmTokens || [];
          if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
            console.log(`[Cron] No FCM tokens for user ${targetUserId}`);
            continue;
          }
          
          const payload = {
            notification: {
              title: 'Time to Chex-N!',
              body: message,
            },
            tokens: fcmTokens,
          };
          await admin.messaging().sendEachForMulticast(payload);
          sentCount++;
          console.log(`[Cron] Sent notification to user ${targetUserId}`);
        } catch (innerError) {
          console.error(`[Cron] Error sending scheduled message for user ${targetUserId}:`, innerError.message);
        }
      }
      
      if (sentCount > 0) {
        console.log(`[Cron] Successfully sent ${sentCount} notification(s)`);
      }
    } catch (error) {
      console.error('[Cron] Error in notification cron job:', error.message);
    }
  });
  
  console.log('✅ Notification cron job started (runs every minute)');
});