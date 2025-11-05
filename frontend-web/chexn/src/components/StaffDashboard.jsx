import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import CommunicationThread from './CommunicationThread.jsx';
import NotificationScheduler from './NotificationScheduler.jsx';
import GeofenceManager from './GeofenceManager.jsx';
import Spinner from './Spinner.jsx';

// This component is smart. It takes a 'userType' prop (either 'student' or 'employee')
// and dynamically calls the correct API endpoints.
function StaffDashboard({ userType, refreshToken }) {
  const [users, setUsers] = useState([]); // List of students or employees
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [childCheckIns, setChildCheckIns] = useState([]);
  const [selectedCheckInId, setSelectedCheckInId] = useState(null);
  const [unreadByUserId, setUnreadByUserId] = useState({});

  // Define API endpoints based on the userType prop
  const apiConfig = {
    student: {
      list: '/staff/my-students',
      checkins: '/staff/checkins' // We use /checkins/:id
    },
    employee: {
      list: '/employer-staff/my-employees',
      checkins: '/employer-staff/checkins' // We use /checkins/:id
    }
  };

  const currentConfig = apiConfig[userType];
  const userTypeName = userType === 'student' ? 'Student' : 'Employee';

  // Unread summary endpoint per userType
  const unreadSummaryEndpoint = userType === 'student' ? '/staff/unread-summary' : '/employer-staff/unread-summary';

  // 1. Fetch the list of users (students/employees)
  useEffect(() => {
    apiClient.get(currentConfig.list)
      .then(res => setUsers(res.data))
      .catch(err => console.error(`Error fetching ${userType}s:`, err))
      .finally(() => setLoading(false));
  }, [currentConfig.list, userType, refreshToken]);

  // Fetch unread summary for badges
  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await apiClient.get(unreadSummaryEndpoint);
        const map = {};
        res.data.forEach(item => {
          const key = item.studentId || item.employeeId;
          if (key) map[key] = item.unreadCount;
        });
        setUnreadByUserId(map);
      } catch (e) {
        // ignore
      }
    }
    fetchUnread();
  }, [unreadSummaryEndpoint, refreshToken]);

  // 2. Fetch Chex-Ns when a user is selected
  useEffect(() => {
    if (!selectedUserId) {
      setChildCheckIns([]);
      setSelectedCheckInId(null);
      return;
    }

    apiClient.get(`${currentConfig.checkins}/${selectedUserId}`)
      .then(res => setChildCheckIns(res.data))
      .catch(err => console.error(`Error fetching ${userType} Chex-Ns:`, err));
  }, [selectedUserId, currentConfig.checkins, userType]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">{userTypeName}s</h2>
        </div>

        {loading && <div className="mt-6"><Spinner label="Loading..." /></div>}
        {!loading && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* User list */}
            <div className="lg:col-span-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
                <h3 className="text-lg font-semibold text-gray-900">{userTypeName} List</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {users.map((u) => (
                    <button
                      key={u.uid}
                      onClick={() => setSelectedUserId(u.uid)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors duration-200 ${selectedUserId === u.uid ? 'border-blue-600 bg-blue-50 text-gray-900' : 'border-gray-200 hover:bg-gray-50 text-gray-900'}`}
                    >
                      {(u.firstName || '')} {(u.lastName || '')} ({u.email})
                      {unreadByUserId[u.uid] ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-600 text-white text-xs px-1.5 py-0.5">
                          {unreadByUserId[u.uid]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {users.length === 0 && (
                    <div className="text-gray-500 text-sm">No {userTypeName.toLowerCase()}s found.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Check-in history */}
            <div className="lg:col-span-8">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
                {selectedUserId ? (
                  <>
                    <div className="mb-6">
                      <GeofenceManager targetUserId={selectedUserId} />
                    </div>
                    <div className="mb-6">
                      <NotificationScheduler targetUserId={selectedUserId} />
                    </div>
                    <hr className="my-6" />
                    <h3 className="text-lg font-semibold text-gray-900">{userTypeName} Chex-N History</h3>
                    <div className="mt-4 space-y-3">
                    {childCheckIns.length === 0 ? (
                      <p className="text-gray-500 text-sm">No Chex-Ns found.</p>
                    ) : (
                      childCheckIns.map(checkIn => (
                        <div key={checkIn.id} className="rounded-md border border-gray-200 p-3 md:p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-gray-900"><strong>{checkIn.emojiCategory}</strong>: {checkIn.specificFeeling}</div>
                            {!checkIn.readStatus || checkIn.readStatus.school === false ? (
                              <span className="ml-3 inline-flex items-center rounded-full bg-blue-600 text-white text-xs px-2 py-0.5">unread</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">On: {new Date(checkIn.timestamp.seconds * 1000).toLocaleString()}</p>
                          <div className="mt-3">
                            <button
                              onClick={() => setSelectedCheckInId(checkIn.id)}
                              className="border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md px-3 py-1.5 text-sm transition-colors duration-200"
                            >
                              View Thread
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-gray-500">Select a {userTypeName.toLowerCase()} to see their history.</p>
                )}

                {selectedCheckInId && (
                  <div className="mt-6">
                    <CommunicationThread checkInId={selectedCheckInId} />
                    <div className="mt-4">
                      <button
                        className="border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md px-4 py-2 transition-colors duration-200"
                        onClick={async () => {
                          setSelectedCheckInId(null);
                          if (selectedUserId) {
                            try {
                              const res = await apiClient.get(`${currentConfig.checkins}/${selectedUserId}`);
                              setChildCheckIns(res.data);
                            } catch {}
                          }
                          try {
                            const res2 = await apiClient.get(unreadSummaryEndpoint);
                            const map2 = {};
                            res2.data.forEach(item => { const key = item.studentId || item.employeeId; if (key) map2[key] = item.unreadCount; });
                            setUnreadByUserId(map2);
                          } catch {}
                        }}
                      >
                        Close Thread
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StaffDashboard;
