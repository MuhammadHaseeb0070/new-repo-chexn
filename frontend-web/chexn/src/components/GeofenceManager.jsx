import { useState, useEffect, useRef } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';

function GeofenceManager({ targetUserId }) {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState(1000);

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    async function fetchGeofence() {
      setLoading(true);
      setMessage('');
      try {
        const res = await apiClient.get(`/geofence/${targetUserId}`);
        const data = res.data;
        // If no geofence exists, data will be null
        if (!data || !data.location) {
          setLat('');
          setLon('');
          setRadius(1000);
        } else {
          // Firestore GeoPoint from API often serializes with _latitude/_longitude
          const latVal = (data.location._latitude ?? data.location.latitude) ?? '';
          const lonVal = (data.location._longitude ?? data.location.longitude) ?? '';
          setLat(latVal);
          setLon(lonVal);
          setRadius(data.radius ?? 1000);
        }
      } catch (error) {
        // Only log unexpected errors
        console.error('Error fetching geofence:', error);
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

  // Lazy-load Leaflet (no build-time dep) and initialize the map picker
  useEffect(() => {
    // Only init when form is not loading
    if (loading) return;
    // Require coordinates to init; default to a sensible view if empty
    const initialLat = parseFloat(lat) || 37.7749; // SF fallback
    const initialLon = parseFloat(lon) || -122.4194;

    function ensureLeaflet() {
      return new Promise((resolve) => {
        if (window.L) return resolve(window.L);
        // Inject CSS
        if (!document.querySelector('link[data-leaflet]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          link.setAttribute('data-leaflet', '1');
          document.head.appendChild(link);
        }
        // Inject JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin = '';
        script.onload = () => resolve(window.L);
        document.body.appendChild(script);
      });
    }

    let destroyed = false;
    ensureLeaflet().then((L) => {
      if (destroyed) return;
      // Initialize map only once
      if (!mapRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([initialLat, initialLon], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        const marker = L.marker([initialLat, initialLon], { draggable: true }).addTo(map);
        const circle = L.circle([initialLat, initialLon], { radius: Number(radius) || 1000 }).addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          // Use 8 decimal places for precision (~1.1mm accuracy)
          setLat(pos.lat.toFixed(8));
          setLon(pos.lng.toFixed(8));
          circle.setLatLng(pos);
        });

        map.on('click', (e) => {
          const pos = e.latlng;
          // Use 8 decimal places for precision (~1.1mm accuracy)
          setLat(pos.lat.toFixed(8));
          setLon(pos.lng.toFixed(8));
          marker.setLatLng(pos);
          circle.setLatLng(pos);
        });

        mapRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
      } else {
        // Update existing map position/radius when state changes
        if (markerRef.current && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lon))) {
          const pos = { lat: parseFloat(lat), lng: parseFloat(lon) };
          markerRef.current.setLatLng(pos);
          circleRef.current && circleRef.current.setLatLng(pos);
          mapRef.current && mapRef.current.setView(pos);
        }
        if (circleRef.current) {
          circleRef.current.setRadius(Number(radius) || 1000);
        }
      }
    });

    return () => {
      destroyed = true;
    };
  }, [loading, lat, lon, radius]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported by your browser.');
      return;
    }
    
    setMessage('Getting your location...');
    
    // Request high accuracy with timeout
    const options = {
      enableHighAccuracy: true, // Request GPS-level accuracy
      timeout: 10000, // 10 second timeout
      maximumAge: 0 // Don't use cached position
    };
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        // Use higher precision (8 decimal places = ~1.1mm precision)
        setLat(latitude.toFixed(8));
        setLon(longitude.toFixed(8));
        
        console.log(`Location obtained: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);
        
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 18); // Zoom closer for precision
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        if (circleRef.current) {
          circleRef.current.setLatLng([latitude, longitude]);
        }
        
        setMessage(`Location set! Accuracy: ${Math.round(accuracy)}m`);
        setTimeout(() => setMessage(''), 3000);
      },
      (error) => {
        let errorMsg = 'Failed to get location. ';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Please allow location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMsg += 'Location request timed out. Please try again.';
            break;
          default:
            errorMsg += 'Unknown error occurred.';
            break;
        }
        setMessage(errorMsg);
        console.error('Geolocation error:', error);
      },
      options
    );
  };

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
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Geofence Location</h3>
        <InfoTooltip description="Tag a safe zone so you get notified whenever this member checks in outside the approved boundary." />
      </div>
      {loading ? (
        <div className="mt-3"><Spinner label="Loading geofence..." /></div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Latitude</label>
            <input
              type="number"
              step="0.00000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
              placeholder="e.g., 37.7749"
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">Click map or use "Use My Location"</p>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Longitude</label>
            <input
              type="number"
              step="0.00000001"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              required
              placeholder="e.g., -122.4194"
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">Click map or use "Use My Location"</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="block text-sm text-gray-600">Radius (in meters)</label>
              <InfoTooltip description="Set how wide the safe zone should be. Larger numbers cover bigger areas like whole campuses." position="right" />
            </div>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min={1}
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <input
              type="range"
              min={50}
              max={5000}
              step={10}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="mt-2 w-full"
            />
          </div>
          <div className="md:col-span-3">
            <div className="h-64 w-full rounded-md border border-gray-300 overflow-hidden" ref={mapContainerRef} />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={useMyLocation} className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5">
                Use My Location
              </button>
            </div>
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


