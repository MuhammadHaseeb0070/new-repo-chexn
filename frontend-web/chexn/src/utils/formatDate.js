export function formatCheckInDate(ts) {
  if (!ts) return '';
  try {
    // Firestore Timestamp
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString();
    }
    // Serialized { seconds, nanoseconds }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000).toLocaleString();
    }
    // Serialized {_seconds, _nanoseconds}
    if (typeof ts._seconds === 'number') {
      return new Date(ts._seconds * 1000).toLocaleString();
    }
    // ISO string or ms value
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  } catch {}
  return '';
}


