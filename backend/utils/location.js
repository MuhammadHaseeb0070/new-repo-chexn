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
      const R = 6371000; // Earth radius in meters
      
      // Handle both Firestore GeoPoint format and plain object format
      const lat1 = loc1.latitude || loc1._latitude || loc1.lat;
      const lon1 = loc1.longitude || loc1._longitude || loc1.lon;
      const lat2 = loc2.latitude || loc2._latitude || loc2.lat;
      const lon2 = loc2.longitude || loc2._longitude || loc2.lon;
      
      if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
          typeof lat2 !== 'number' || typeof lon2 !== 'number') {
        console.error('Invalid coordinates:', { loc1, loc2 });
        return Infinity; // Return large distance if invalid
      }
      
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      return distance;
    };

    const distance = getDistance(chexNLocation, geofenceLocation);
    
    // Add a small buffer (5% or 10m, whichever is larger) to account for GPS inaccuracy
    // This prevents false alerts when user is at the edge of the geofence
    const buffer = Math.max(radiusInMeters * 0.05, 10);
    const effectiveRadius = radiusInMeters + buffer;
    
    console.log(`Geofence check: distance=${distance.toFixed(2)}m, radius=${radiusInMeters}m, effectiveRadius=${effectiveRadius.toFixed(2)}m, inside=${distance <= effectiveRadius}`);
    
    if (distance <= effectiveRadius) return; // inside fence (with buffer), no alert

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


