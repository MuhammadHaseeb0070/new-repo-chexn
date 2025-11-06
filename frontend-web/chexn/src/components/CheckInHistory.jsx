import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import ThreadModal from './ThreadModal.jsx';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import { formatCheckInDate } from '../utils/formatDate.js';
import Spinner from './Spinner.jsx';

function CheckInHistory({ refreshToken }) {
  const [checkIns, setCheckIns] = useState([]);
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <h2 className="text-lg font-semibold text-gray-900">Your Check-in History</h2>
      {loading ? (
        <div className="mt-4"><Spinner label="Loading history..." /></div>
      ) : (
        <CollapsiblePanel title="Show Check-in History" defaultOpen={true}>
          <div className="mt-2 space-y-3">
            {checkIns.map(checkIn => (
              <div key={checkIn.id} className="rounded-md border border-gray-200 p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="text-gray-900"><strong>{checkIn.emojiCategory}</strong>: {checkIn.specificFeeling}</div>
                  {checkIn.readStatus?.student === false ? (
                    <span className="ml-3 inline-flex items-center rounded-full bg-blue-600 text-white text-xs px-2 py-0.5">unread</span>
                  ) : null}
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
            {checkIns.length === 0 && (
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

