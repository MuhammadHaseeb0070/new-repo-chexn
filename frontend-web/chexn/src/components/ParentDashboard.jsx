import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import CommunicationThread from './CommunicationThread.jsx';
import NotificationScheduler from './NotificationScheduler.jsx';
import GeofenceManager from './GeofenceManager.jsx';
import Spinner from './Spinner.jsx';

function ParentDashboard() {
  const [myStudents, setMyStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [childCheckIns, setChildCheckIns] = useState([]);
  const [selectedCheckInId, setSelectedCheckInId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadByStudentId, setUnreadByStudentId] = useState({});

  useEffect(() => {
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

    fetchMyStudents();
  }, []);

  // After loading students, compute unread counts per student
  useEffect(() => {
    async function computeUnread() {
      const map = {};
      for (const s of myStudents) {
        try {
          const res = await apiClient.get(`/checkins/student/${s.uid}`);
          const unread = (res.data || []).filter(ci => ci.readStatus && ci.readStatus.parent === false).length;
          if (unread > 0) map[s.uid] = unread;
        } catch (e) {
          // ignore per-student errors
        }
      }
      setUnreadByStudentId(map);
    }
    if (myStudents.length > 0) computeUnread();
    else setUnreadByStudentId({});
  }, [myStudents]);

  useEffect(() => {
    const fetchChildCheckIns = async () => {
      if (selectedStudentId === null) {
        setChildCheckIns([]);
        return;
      }

      try {
        const response = await apiClient.get(`/checkins/student/${selectedStudentId}`);
        setChildCheckIns(response.data);
      } catch (error) {
        console.error('Error fetching child check-ins:', error);
        setChildCheckIns([]);
      }
    };

    fetchChildCheckIns();
  }, [selectedStudentId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">Parent Dashboard</h2>
        </div>

        {loading ? (
          <div className="mt-8"><Spinner label="Loading students..." /></div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Children list */}
            <div className="lg:col-span-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
                <h3 className="text-lg font-semibold text-gray-900">Your Children</h3>
                <ul className="mt-4 space-y-2">
                  {myStudents.map(student => (
                    <li key={student.uid}>
                      <button
                        onClick={() => setSelectedStudentId(student.uid)}
                        className={`w-full flex items-center justify-between rounded-md border px-4 py-2 text-left transition-colors duration-200 ${selectedStudentId === student.uid ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <span className="text-gray-900 truncate">{student.email}</span>
                        {unreadByStudentId[student.uid] && (
                          <span className="ml-3 inline-flex items-center rounded-full bg-blue-600 text-white text-xs px-2 py-0.5">
                            {unreadByStudentId[student.uid]}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {myStudents.length === 0 && (
                    <li className="text-gray-500 text-sm">No children found.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Check-in history */}
            <div className="lg:col-span-8">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
                <h3 className="text-lg font-semibold text-gray-900">Check-in History</h3>
                {!selectedStudentId ? (
                  <p className="mt-4 text-gray-500">Select a child to see their history.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {childCheckIns.map(checkIn => (
                      <div key={checkIn.id} className="rounded-md border border-gray-200 p-3 md:p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-gray-900"><strong>{checkIn.emojiCategory}</strong>: {checkIn.specificFeeling}</div>
                          {!checkIn.readStatus || checkIn.readStatus.parent === false ? (
                            <span className="ml-3 inline-flex items-center rounded-full bg-blue-600 text-white text-xs px-2 py-0.5">unread</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{new Date(checkIn.timestamp.seconds * 1000).toLocaleString()}</p>
                        <div className="mt-3">
                          <button
                            onClick={() => setSelectedCheckInId(checkIn.id)}
                            className="border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md px-3 py-1.5 text-sm transition-colors duration-200"
                          >
                            View Thread
                          </button>
                        </div>
                      </div>
                    ))}
                    {childCheckIns.length === 0 && (
                      <div className="text-gray-500 text-sm">No check-ins found.</div>
                    )}
                   </div>
                 )}
                {selectedStudentId && (
                  <>
                    <div className="mt-6">
                      <GeofenceManager targetUserId={selectedStudentId} />
                    </div>
                    <div className="mt-6">
                      <NotificationScheduler targetUserId={selectedStudentId} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedCheckInId && (
          <div className="mt-6 bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
            <CommunicationThread checkInId={selectedCheckInId} />
            <div className="mt-4">
              <button
                className="border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md px-4 py-2 transition-colors duration-200"
                onClick={async () => {
                  setSelectedCheckInId(null);
                  if (selectedStudentId) {
                    try {
                      const response = await apiClient.get(`/checkins/student/${selectedStudentId}`);
                      setChildCheckIns(response.data);
                    } catch {}
                    try {
                      const res = await apiClient.get(`/checkins/student/${selectedStudentId}`);
                      const unread = (res.data || []).filter(ci => ci.readStatus && ci.readStatus.parent === false).length;
                      setUnreadByStudentId(prev => ({ ...prev, [selectedStudentId]: unread || undefined }));
                    } catch {}
                  }
                }}
              >
                Close Thread
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParentDashboard;

