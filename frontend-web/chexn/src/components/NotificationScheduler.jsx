import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';

function NotificationScheduler({ targetUserId }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTime, setNewTime] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSchedules = async () => {
    try {
      const res = await apiClient.get(`/schedules/${targetUserId}`);
      setSchedules(res.data || []);
    } catch (error) {
      console.error('Failed to fetch schedules', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!targetUserId) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/schedules', {
        targetUserId,
        time: newTime,
        message: newMessage,
      });
      setNewTime('');
      setNewMessage('');
    } catch (error) {
      console.error('Failed to create schedule', error);
    } finally {
      setIsSubmitting(false);
      fetchSchedules();
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await apiClient.delete(`/schedules/${scheduleId}`);
      fetchSchedules();
    } catch (error) {
      console.error('Failed to delete schedule', error);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Timed Reminders</h3>
        <InfoTooltip description="Set recurring nudges to remind students or staff when it's time to submit a ChexN or follow a routine." />
      </div>

      <form onSubmit={handleCreateSchedule} className="mt-4 flex flex-col sm:flex-row gap-3">
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          required
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Reminder message"
          required
          className="flex-1 rounded-md border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 disabled:opacity-60"
        >
          {isSubmitting ? (<span className="inline-flex items-center gap-2"><Spinner /> Adding...</span>) : 'Add Schedule'}
        </button>
      </form>

      <div className="mt-4">
        {loading ? (
          <Spinner label="Loading schedules..." />
        ) : (
          <ul className="space-y-2">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <div className="text-gray-900">
                  <span className="font-medium">{s.time}</span>
                  <span className="ml-2 text-gray-600">{s.message}</span>
                </div>
                <button
                  onClick={() => handleDeleteSchedule(s.id)}
                  className="text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-md px-3 py-1 text-sm"
                >
                  Delete
                </button>
              </li>
            ))}
            {schedules.length === 0 && (
              <li className="text-gray-500 text-sm">No schedules yet.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default NotificationScheduler;


