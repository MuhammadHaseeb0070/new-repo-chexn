import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import ThreadModal from './ThreadModal.jsx';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import { formatCheckInDate } from '../utils/formatDate.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import { getEmojiForCategory } from '../utils/emojiHelper.js';
import { EMOTIONAL_CATEGORIES } from '../constants.js';

function CheckInHistory({ refreshToken }) {
  const [checkIns, setCheckIns] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCheckInId, setSelectedCheckInId] = useState(null);

  useEffect(() => {
    const fetchCheckIns = async () => {
      try {
        const response = await apiClient.get('/checkins');
        setCheckIns(response.data);
      } catch (error) {
        console.error('Error fetching check-ins:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCheckIns();
  }, [refreshToken]);

  const filteredCheckIns = filterCategory
    ? checkIns.filter(ci => ci.emojiCategory === filterCategory)
    : checkIns;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Your Check-in History</h2>
        <InfoTooltip description="Review past ChexNs and reopen message threads to continue the conversation." />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-gray-600">Filter by mood:</label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="">All moods</option>
          {EMOTIONAL_CATEGORIES.map(cat => (
            <option key={cat.category} value={cat.category}>
              {cat.emoji} {cat.category}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="mt-4"><Spinner label="Loading history..." /></div>
      ) : (
        <CollapsiblePanel
          title="Show Check-in History"
          defaultOpen={true}
          description="Expand to see every mood entry you've shared, along with unread indicators and quick access to the thread."
        >
          <div className="mt-2 space-y-3">
            {filteredCheckIns.map(checkIn => (
              <div key={checkIn.id} className="rounded-md border border-gray-200 p-3 md:p-4">
              <div className="flex items-center justify-between">
                  <div className="text-gray-900 flex items-center gap-2">
                    <span className="text-xl">{getEmojiForCategory(checkIn.emojiCategory)}</span>
                    <span><strong>{checkIn.emojiCategory}</strong>: {checkIn.specificFeeling}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {checkIn.scheduleId && (
                      <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 text-xs px-2 py-0.5" title="Responded to a scheduled question">Scheduled</span>
                    )}
                    {checkIn.readStatus?.student === false ? (
                      <span className="inline-flex items-center rounded-full bg-blue-600 text-white text-xs px-2 py-0.5">unread</span>
                ) : null}
              </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">{formatCheckInDate(checkIn.timestamp)}</p>
              <div className="mt-3">
                <button
                  onClick={() => setSelectedCheckInId(checkIn.id)}
                    className="border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md px-3 py-1.5 text-sm transition-colors duration-200"
                >
                    Open Conversation
                </button>
              </div>
            </div>
          ))}
            {filteredCheckIns.length === 0 && (
              <div className="text-gray-500 text-sm">No check-ins available yet.</div>
          )}
        </div>
        </CollapsiblePanel>
      )}
      {selectedCheckInId && (
        <ThreadModal
          checkInId={selectedCheckInId}
          onClose={async () => {
            setSelectedCheckInId(null);
            try {
              const response = await apiClient.get('/checkins');
              setCheckIns(response.data);
            } catch (error) {
              console.error('Error refreshing check-ins:', error);
            }
          }}
        />
      )}
    </div>
  );
}

export default CheckInHistory;

