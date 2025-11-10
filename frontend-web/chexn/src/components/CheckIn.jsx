import { useState, useEffect, useRef } from 'react';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import apiClient from '../apiClient.js';
import { EMOTIONAL_CATEGORIES } from '../constants.js';

function CheckIn({ onCreated, scheduleId: propScheduleId, question: propQuestion }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFeeling, setSelectedFeeling] = useState('');
  const [availableFeelings, setAvailableFeelings] = useState([]);
  const [scheduleId, setScheduleId] = useState(propScheduleId || null);
  const [question, setQuestion] = useState(propQuestion || null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const loadedScheduleIdRef = useRef(null); // Track which scheduleId we've loaded

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load question for a scheduleId
  const loadScheduleQuestion = (sid) => {
    if (loadedScheduleIdRef.current === sid) {
      return; // Already loaded
    }
    
    loadedScheduleIdRef.current = sid;
    setScheduleId(sid);
    setLoadingQuestion(true);
    
    apiClient.get(`/schedules/by-id/${sid}`)
      .then(response => {
        setQuestion(response.data.message || 'ChexN Question');
        setLoadingQuestion(false);
        // Clean up URL params after reading
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      })
      .catch(error => {
        console.error('Error fetching schedule:', error);
        setLoadingQuestion(false);
        loadedScheduleIdRef.current = null; // Reset on error
      });
  };

  // Check URL params and props for scheduleId on mount and when props change
  useEffect(() => {
    // Priority: propScheduleId > URL param
    const urlParams = new URLSearchParams(window.location.search);
    const urlScheduleId = urlParams.get('scheduleId');
    const targetScheduleId = propScheduleId || urlScheduleId;
    
    if (targetScheduleId && loadedScheduleIdRef.current !== targetScheduleId) {
      if (propQuestion) {
        // Use provided question, no need to fetch
        setScheduleId(targetScheduleId);
        setQuestion(propQuestion);
        loadedScheduleIdRef.current = targetScheduleId;
      } else {
        loadScheduleQuestion(targetScheduleId);
      }
    } else if (!targetScheduleId && scheduleId) {
      // Clear if no scheduleId in props or URL
      setScheduleId(null);
      setQuestion(null);
      loadedScheduleIdRef.current = null;
    }
  }, [propScheduleId, propQuestion]); // Only re-run when props change

  // Listen for URL changes (from service worker messages or browser navigation)
  useEffect(() => {
    const checkUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlScheduleId = urlParams.get('scheduleId');
      
      if (urlScheduleId && loadedScheduleIdRef.current !== urlScheduleId) {
        loadScheduleQuestion(urlScheduleId);
      }
    };
    
    // Check immediately on mount
    checkUrl();
    
    // Listen for popstate events (browser back/forward, or our custom event)
    window.addEventListener('popstate', checkUrl);
    
    // Listen for custom event from App.jsx when service worker sends message
    const handleUrlUpdate = () => {
      // Small delay to ensure URL is updated
      setTimeout(checkUrl, 100);
    };
    window.addEventListener('scheduleIdUpdated', handleUrlUpdate);
    
    return () => {
      window.removeEventListener('popstate', checkUrl);
      window.removeEventListener('scheduleIdUpdated', handleUrlUpdate);
    };
  }, []); // Only run once on mount

  // Mandatory geolocation helper with high accuracy
  const getGeolocation = async () => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        return reject(new Error('Geolocation is not supported by your browser.'));
      }
      
      // Request high accuracy with timeout
      const options = {
        enableHighAccuracy: true, // Request GPS-level accuracy
        timeout: 15000, // 15 second timeout (longer for check-in)
        maximumAge: 0 // Don't use cached position - get fresh location
      };
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`Check-in location: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);
          
          // Use full precision (don't round) for accurate distance calculations
          const coords = { 
            lat: latitude, // Full precision, backend will handle storage
            lon: longitude 
          };
          resolve(coords);
        },
        (error) => {
          let errorMsg = 'Failed to get location. ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location permission denied. Please allow location access to submit check-ins.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Location information unavailable. Please check your device settings.';
              break;
            case error.TIMEOUT:
              errorMsg = 'Location request timed out. Please try again.';
              break;
            default:
              errorMsg = 'Failed to get your location. Please try again.';
              break;
          }
          console.error('Geolocation error:', error);
          reject(new Error(errorMsg));
        },
        options
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    try {
      const location = await getGeolocation();
      setIsSubmitting(true);

      const checkInData = { 
        emojiCategory: selectedCategory, 
        specificFeeling: selectedFeeling,
        location
      };
      
      // Include scheduleId if it exists (for scheduled check-ins)
      if (scheduleId) {
        checkInData.scheduleId = scheduleId;
      }
      
      await apiClient.post('/checkins', checkInData);
      alert('Check-in successful!');
      setSelectedCategory('');
      setSelectedFeeling('');
      setAvailableFeelings([]);
      // Clear scheduleId after submission (so form resets for next check-in)
      setScheduleId(null);
      setQuestion(null);
      if (onCreated) onCreated();
    } catch (error) {
      alert('Location is required. Please allow location access to submit your Chex-N.');
      console.error(error);
      setIsSubmitting(false);
      return;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategoryChange = (e) => {
    const categoryValue = e.target.value;
    setSelectedCategory(categoryValue);
    
    if (categoryValue) {
      const selectedCat = EMOTIONAL_CATEGORIES.find(cat => cat.category === categoryValue);
      setAvailableFeelings(selectedCat ? selectedCat.feelings : []);
    } else {
      setAvailableFeelings([]);
    }
    
    setSelectedFeeling('');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5" data-checkin-form>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Submit New Check-in</h2>
        <InfoTooltip description="Share how you're feeling right now. We capture your location with each ChexN so caregivers can keep students safe." />
      </div>
      
      {/* Display question if this is a scheduled check-in */}
      {loadingQuestion && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <Spinner label="Loading question..." />
        </div>
      )}
      {question && !loadingQuestion && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm font-medium text-blue-900 mb-1">Question:</p>
          <p className="text-base text-blue-800">{question}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="block text-sm text-gray-600">Category</label>
            <InfoTooltip description="Choose the emotion group that best matches how you feel (happy, anxious, calm, etc.)." position="right" />
          </div>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          >
            <option value="">Select a category</option>
            {EMOTIONAL_CATEGORIES.map(cat => (
              <option key={cat.category} value={cat.category}>
                {cat.emoji} {cat.category}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="block text-sm text-gray-600">Specific Feeling</label>
            <InfoTooltip description="After picking a category, narrow it down with a specific feeling so mentors understand the exact mood." position="right" />
          </div>
          <select
            value={selectedFeeling}
            onChange={(e) => setSelectedFeeling(e.target.value)}
            disabled={!selectedCategory}
            className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          >
            <option value="">Select a feeling</option>
            {availableFeelings.map(feeling => (
              <option key={feeling} value={feeling}>
                {feeling}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={!selectedCategory || !selectedFeeling || isSubmitting}
            className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (<><Spinner /> <span className="text-white text-sm">Submitting...</span></>) : 'Submit Check-in'}
          </button>
        </div>
      </form>
      <p className="text-xs text-gray-400 mt-2">Note: Your location will be captured automatically when you submit.</p>
    </div>
  );
}

export default CheckIn;

