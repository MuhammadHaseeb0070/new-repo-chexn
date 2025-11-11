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

  // Search state (OpenStreetMap Nominatim)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const searchAbortRef = useRef(null);

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

    // Helpful hints when running over HTTP or blocked
    try {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setMessage('Tip: For best accuracy, use HTTPS or localhost.');
      }
    } catch {}

    setMessage('Getting your location...');

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // Helper: one-shot getCurrentPosition as a Promise
    const once = () => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve(pos),
        err => reject(err),
        options
      );
    });

    // Helper: brief watch that resolves when we get a significantly better fix or time out
    const watchForBetter = (bestAcc, ms = 10000) => new Promise((resolve) => {
      if (!navigator.geolocation.watchPosition) return resolve(null);
      let best = null;
      const wid = navigator.geolocation.watchPosition(
        (p) => {
          const a = p.coords?.accuracy;
          // Accept if we get a materially better fix
          if (typeof a === 'number' && a > 0 && a < Math.max(5, bestAcc * 0.6)) {
            best = p;
            cleanup();
            resolve(best);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      const cleanup = () => {
        try { navigator.geolocation.clearWatch(wid); } catch {}
      };
      setTimeout(() => { cleanup(); resolve(best); }, ms);
    });

    // Strategy: try up to two one-shot reads, then a short watch to refine
    (async () => {
      try {
        // First attempt
        let best = await once();
        // A second attempt sometimes yields a GPS fix after radios wake up
        try {
          const second = await once();
          if ((second.coords.accuracy || Infinity) < (best.coords.accuracy || Infinity)) best = second;
        } catch {}

        // Optional refinement via watch
        const improved = await watchForBetter(best.coords.accuracy || 9999, 12000);
        let final = improved || best;

        // If the reported accuracy is extremely poor (>1000m), try a longer refinement pass
        if (!Number.isFinite(final.coords.accuracy) || final.coords.accuracy > 1000) {
          setMessage(`Low-accuracy fix detected (~${Math.round(final.coords.accuracy || 0)}m). Improving…`);
          const improved2 = await watchForBetter(final.coords.accuracy || 9999, 20000);
          if (improved2 && (improved2.coords.accuracy || Infinity) < (final.coords.accuracy || Infinity)) {
            final = improved2;
          }
        }

        const { latitude, longitude, accuracy } = final.coords;

        // Reject extremely imprecise fixes; ask user to try again or use search
        if (!Number.isFinite(accuracy) || accuracy > 1000) {
          setMessage('Couldn’t obtain a precise GPS fix (±1km+). Please move near a window, enable Precise Location, or use the search box to set the fence exactly.');
          return;
        }

        // Keep full precision internally; round only for input display
        setLat(Number(latitude).toFixed(8));
        setLon(Number(longitude).toFixed(8));

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], accuracy < 30 ? 18 : 16);
        }
        markerRef.current && markerRef.current.setLatLng([latitude, longitude]);
        circleRef.current && circleRef.current.setLatLng([latitude, longitude]);

        const accText = typeof accuracy === 'number' ? `${Math.round(accuracy)}m` : 'unknown';
        setMessage(`Location set${improved ? ' (refined)' : ''}! Accuracy: ${accText}`);
        setTimeout(() => setMessage(''), 3500);
      } catch (error) {
        let errorMsg = 'Failed to get location. ';
        switch (error && error.code) {
          case error?.PERMISSION_DENIED:
            errorMsg += 'Please allow location access and try again.';
            break;
          case error?.POSITION_UNAVAILABLE:
            errorMsg += 'Location unavailable. Try moving near a window or enabling GPS.';
            break;
          case error?.TIMEOUT:
            errorMsg += 'Timed out. Try again or search your address below.';
            break;
          default:
            errorMsg += 'Unknown error. Try again or search your address below.';
            break;
        }
        setMessage(errorMsg);
        console.error('Geolocation error:', error);
      }
    })();
  };

  // Debounced place search (OpenStreetMap Nominatim)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    // Abort previous
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timer = setTimeout(async () => {
      try {
        // Nominatim: public API. Respect usage policy (limit & UA implicitly handled by browser).
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('Geocoding failed');
        const data = await res.json();
        const items = (data || []).map((d) => ({
          label: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
        }));
        setSearchResults(items);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 400); // debounce
    return () => {
      clearTimeout(timer);
      try { controller.abort(); } catch {}
    };
  }, [searchQuery]);

  const applySearchResult = (item) => {
    setLat(item.lat.toFixed(8));
    setLon(item.lon.toFixed(8));
    if (mapRef.current) mapRef.current.setView([item.lat, item.lon], 17);
    markerRef.current && markerRef.current.setLatLng([item.lat, item.lon]);
    circleRef.current && circleRef.current.setLatLng([item.lat, item.lon]);
    setSearchResults([]);
    setSearchQuery(item.label);
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
            {/* Place Search */}
            <div className="mb-3">
              <label className="block text-sm text-gray-600">Search place</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search an address, place, or coordinates"
                className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              {searchLoading && <p className="mt-1 text-xs text-gray-500">Searching…</p>}
              {searchResults.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-auto border border-gray-200 rounded-md bg-white shadow-sm divide-y">
                  {searchResults.map((r, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => applySearchResult(r)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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


