import { useState, useEffect, useCallback } from 'react';
import apiClient from '../apiClient.js';
import CommunicationThread from './CommunicationThread.jsx';
import ThreadModal from './ThreadModal.jsx';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import { formatCheckInDate } from '../utils/formatDate.js';
import NotificationScheduler from './NotificationScheduler.jsx';
import GeofenceManager from './GeofenceManager.jsx';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import { getEmojiForCategory } from '../utils/emojiHelper.js';
import { EMOTIONAL_CATEGORIES } from '../constants.js';
import UserManagement from './UserManagement.jsx';
import SubscriptionModal from './SubscriptionModal.jsx';

function ParentDashboard({ refreshToken }) {
  const [myStudents, setMyStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [childCheckIns, setChildCheckIns] = useState([]);
  const [selectedCheckInId, setSelectedCheckInId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadByStudentId, setUnreadByStudentId] = useState({});
  const [filterCategory, setFilterCategory] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const fetchMyStudents = async () => {
    try {
      const response = await apiClient.get('/parents/my-students');
      setMyStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStudents();
  }, [refreshToken]);

  // After loading students, fetch unread counts (non-blocking, load after UI renders)
  useEffect(() => {
    if (myStudents.length === 0) {
      setUnreadByStudentId({});
      return;
    }
    // Lazy load unread summary only when needed (after user interacts)
    // Don't fetch immediately - let UI render first, fetch on demand
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const res = await apiClient.get('/parents/unread-summary');
        if (mounted) {
          const map = {};
          (res.data || []).forEach(item => { if (item.studentId && item.unreadCount > 0) map[item.studentId] = item.unreadCount; });
          setUnreadByStudentId(map);
        }
      } catch {
        if (mounted) setUnreadByStudentId({});
      }
    };
    // Only fetch after a short delay, and only if component is still mounted
    const timer = setTimeout(fetchUnread, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [myStudents]);

  const fetchChildCheckIns = useCallback(async (studentId) => {
    if (!studentId) {
      setChildCheckIns([]);
      return;
    }
    try {
      const response = await apiClient.get(`/checkins/student/${studentId}`);
      setChildCheckIns(response.data);
    } catch (error) {
      console.error('Error fetching child check-ins:', error);
      setChildCheckIns([]);
    }
  }, []);

  useEffect(() => {
    fetchChildCheckIns(selectedStudentId);
  }, [selectedStudentId, fetchChildCheckIns]);

  const filteredCheckIns = filterCategory
    ? childCheckIns.filter(ci => ci.emojiCategory === filterCategory)
    : childCheckIns;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">Parent Dashboard</h2>
            <InfoTooltip description="Keep tabs on each child's mood check-ins, alerts, and location boundaries all from one place." />
          </div>
          <button
            onClick={() => setShowSubscriptionModal(true)}
            className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Usage & Subscription
          </button>
        </div>

        {loading ? (
          <div className="mt-8"><Spinner label="Loading students..." /></div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Children list */}
              <div className="lg:col-span-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">Your Children</h3>
                  <InfoTooltip description="Select a child to view their history, set reminders, and manage location safety zones." />
                </div>
                <ul className="mt-4 space-y-2">
                  {myStudents.map(student => (
                    <li key={student.uid} className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedStudentId(student.uid)}
                        className={`flex-1 flex items-center justify-between rounded-md border px-3 sm:px-4 py-2 text-left transition-colors duration-200 min-w-0 ${selectedStudentId === student.uid ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <span className="text-sm text-gray-900 truncate flex-1 min-w-0">
                          {student.firstName} {student.lastName}
                          <span className="text-xs text-gray-500 ml-1">({student.email})</span>
                        </span>
                        {unreadByStudentId[student.uid] && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-600 text-white text-xs px-2 py-0.5 shrink-0">
                            {unreadByStudentId[student.uid]}
                          </span>
                        )}
                      </button>
                      <UserManagement
                        userId={student.uid}
                        endpointBase="/parents/child"
                        userType="child"
                        onUpdated={() => {
                          fetchMyStudents();
                          if (selectedStudentId === student.uid) {
                            setSelectedStudentId(null);
                          }
                        }}
                        onDeleted={() => {
                          fetchMyStudents();
                          if (selectedStudentId === student.uid) {
                            setSelectedStudentId(null);
                          }
                          // Refresh usage on the server so Usage panels are accurate
                          try { apiClient.post('/usage/refresh'); } catch {}
                        }}
                      />
                    </li>
                  ))}
                  {myStudents.length === 0 && (
                    <li className="text-gray-500 text-sm">No children found.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Geofence & Notifications & Check-in history */}
            <div className="lg:col-span-8">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">

                {selectedStudentId && (
                  <>
                    <CollapsiblePanel
                      title="Notifications"
                      defaultOpen={false}
                      description="Schedule automatic reminders so this child never forgets to submit a ChexN."
                    >
                      <NotificationScheduler targetUserId={selectedStudentId} />
                    </CollapsiblePanel>
                    <div className="mt-4">
                      <CollapsiblePanel
                        title="Geofence"
                        defaultOpen={false}
                        description="Define safe areas and get alerts when the child checks in outside the boundary."
                      >
                        <GeofenceManager targetUserId={selectedStudentId} />
                      </CollapsiblePanel>
                    </div>
                  </>
                )}

                 <div className="mt-6">
                   <div className="flex items-center gap-2">
                     <h3 className="text-lg font-semibold text-gray-900">Check-in History</h3>
                     <InfoTooltip description="See this child's recent moods and open any ChexN thread to follow up." />
                   </div>
                   {!selectedStudentId ? (
                    <p className="mt-4 text-gray-500">Select a child to see their history.</p>
                  ) : (
                    <>
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
                     <CollapsiblePanel
                       title="Show Check-in History"
                       defaultOpen={false}
                       description="Expand to browse each entry, unread status, and access conversations for this child."
                       onToggle={async (open) => {
                       if (open && selectedStudentId) {
                         try {
                           // Parallel: mark-read and fetch check-ins simultaneously
                           const [_, response] = await Promise.all([
                             apiClient.post(`/checkins/student/${selectedStudentId}/mark-read`),
                             apiClient.get(`/checkins/student/${selectedStudentId}`)
                           ]);
                           setChildCheckIns(response.data);
                           setUnreadByStudentId(prev => ({ ...prev, [selectedStudentId]: undefined }));
                         } catch { /* no-op */ }
                       }
                     }}>
                      <div className="mt-2 space-y-3">
                        {filteredCheckIns.map(checkIn => (
                          <div key={checkIn.id} className="rounded-md border border-gray-200 p-3 md:p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-gray-900 flex items-center gap-2">
                                <span className="text-xl">{getEmojiForCategory(checkIn.emojiCategory)}</span>
                                <span><strong>{checkIn.emojiCategory}</strong>: {checkIn.specificFeeling}</span>
                              </div>
                              {checkIn.readStatus?.parent === false ? (
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
                        {filteredCheckIns.length === 0 && (
                          <div className="text-gray-500 text-sm">No check-ins available for this child.</div>
                        )}
                      </div>
                    </CollapsiblePanel>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {selectedCheckInId && (
          <ThreadModal
            checkInId={selectedCheckInId}
            onClose={async () => {
              setSelectedCheckInId(null);
              if (selectedStudentId) {
                try {
                  // Single call - reuse response for unread count
                  const response = await apiClient.get(`/checkins/student/${selectedStudentId}`);
                  setChildCheckIns(response.data);
                  const unread = (response.data || []).filter(ci => ci.readStatus && ci.readStatus.parent === false).length;
                  setUnreadByStudentId(prev => ({ ...prev, [selectedStudentId]: unread || undefined }));
                } catch { /* no-op */ }
              }
            }}
          />
        )}

        {/* Subscription Modal */}
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          userRole="parent"
        />
      </div>
    </div>
  );
}

export default ParentDashboard;

