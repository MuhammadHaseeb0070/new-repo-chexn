// Helper to calculate geofence alert and notify linked users
// Exports: checkGeofenceAlert(db, admin, newCheckIn)

async function checkGeofenceAlert(db, admin, newCheckIn) {
  try {
    // 1) Require a location on the check-in
    if (!newCheckIn || !newCheckIn.location) return;

    const studentId = newCheckIn.studentId;
    if (!studentId) return;

    // 2) Load geofence for this user (one per user)
    const query = db
      .collection('geofences')
      .where('targetUserId', '==', studentId)
      .limit(1);
    const snapshot = await query.get();
    if (snapshot.empty) return;

    const geofence = snapshot.docs[0].data();
    const chexNLocation = newCheckIn.location; // Firestore GeoPoint
    const geofenceLocation = geofence.location; // Firestore GeoPoint
    const radiusInMeters = geofence.radius;
    if (!geofenceLocation || typeof radiusInMeters !== 'number') return;

    // 3) Haversine distance in meters between two GeoPoints
    const getDistance = (loc1, loc2) => {
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371000; // meters
      const lat1 = loc1.latitude;
      const lon1 = loc1.longitude;
      const lat2 = loc2.latitude;
      const lon2 = loc2.longitude;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = getDistance(chexNLocation, geofenceLocation);
    if (distance <= radiusInMeters) return; // inside fence, no alert

    console.log(`ALERT: User ${studentId} is OUTSIDE the geofence!`);

    // 4) Build recipients: parent(s) and creator staff
    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) return;
    const creatorId = studentDoc.data().creatorId;

    const parentLinks = await db
      .collection('parentStudentLinks')
      .where('studentUids', 'array-contains', studentId)
      .get();
    const parentIds = parentLinks.docs.map((doc) => doc.id);

    const recipientUids = [...new Set([creatorId, ...parentIds].filter(Boolean))];
    if (recipientUids.length === 0) return;

    // 5) Gather tokens for recipients
    const userDocs = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', recipientUids)
      .get();
    const allTokens = userDocs.docs.flatMap((doc) => doc.data().fcmTokens || []);
    if (!allTokens.length) {
      console.log('No devices to alert');
      return;
    }

    // 6) Send notification
    const studentName = studentDoc.data().firstName || 'The student';
    const message = {
      notification: {
        title: 'Chex-N Geofence Alert',
        body: `${studentName} has submitted a Chex-N from outside their set location.`,
      },
      tokens: allTokens,
    };
    await admin.messaging().sendEachForMulticast(message);
    console.log('Geofence alert sent successfully.');
  } catch (error) {
    console.error('checkGeofenceAlert error:', error);
  }
}

module.exports = { checkGeofenceAlert };


