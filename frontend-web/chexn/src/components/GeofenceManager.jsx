import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';

function GeofenceManager({ targetUserId }) {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState(1000);

  useEffect(() => {
    async function fetchGeofence() {
      setLoading(true);
      setMessage('');
      try {
        const res = await apiClient.get(`/geofence/${targetUserId}`);
        const data = res.data;
        // Firestore GeoPoint from API often serializes with _latitude/_longitude
        const latVal = (data.location && (data.location._latitude ?? data.location.latitude)) ?? '';
        const lonVal = (data.location && (data.location._longitude ?? data.location.longitude)) ?? '';
        setLat(latVal);
        setLon(lonVal);
        setRadius(data.radius ?? 1000);
      } catch (error) {
        // On 404 or errors, clear the form
        setLat('');
        setLon('');
        setRadius(1000);
      } finally {
        setLoading(false);
      }
    }
    if (targetUserId) {
      fetchGeofence();
    } else {
      setLat('');
      setLon('');
      setRadius(1000);
      setLoading(false);
    }
  }, [targetUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    try {
      const location = { lat: parseFloat(lat), lon: parseFloat(lon) };
      await apiClient.post('/geofence', { targetUserId, location, radius: parseInt(radius) });
      setMessage('Geofence saved successfully!');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save geofence');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <h3 className="text-lg font-semibold text-gray-900">Geofence Location</h3>
      {loading ? (
        <div className="mt-3"><Spinner label="Loading geofence..." /></div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Latitude</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Longitude</label>
            <input
              type="number"
              step="any"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Radius (in meters)</label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min={1}
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 disabled:opacity-60"
            >
              {isSubmitting ? (<span className="inline-flex items-center gap-2"><Spinner /> Saving...</span>) : 'Save Geofence'}
            </button>
            {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
          </div>
        </form>
      )}
    </div>
  );
}

export default GeofenceManager;


