import { useState } from 'react';
import Spinner from './Spinner.jsx';
import apiClient from '../apiClient.js';
import { EMOTIONAL_CATEGORIES } from '../constants.js';

function CheckIn({ onCreated }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFeeling, setSelectedFeeling] = useState('');
  const [availableFeelings, setAvailableFeelings] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mandatory geolocation helper
  const getGeolocation = async () => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        return reject(new Error('Geolocation is not supported by your browser.'));
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
          resolve(coords);
        },
        (error) => {
          reject(error);
        }
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    try {
      const location = await getGeolocation();
      setIsSubmitting(true);
      await apiClient.post('/checkins', { 
        emojiCategory: selectedCategory, 
        specificFeeling: selectedFeeling,
        location
      });
      alert('Check-in successful!');
      setSelectedCategory('');
      setSelectedFeeling('');
      setAvailableFeelings([]);
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
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <h2 className="text-lg font-semibold text-gray-900">Submit New Check-in</h2>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm text-gray-600">Category</label>
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
          <label className="block text-sm text-gray-600">Specific Feeling</label>
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

