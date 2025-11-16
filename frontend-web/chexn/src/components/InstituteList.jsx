import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import SubscriptionModal from './SubscriptionModal.jsx';
import { formatCheckInDate } from '../utils/formatDate.js';
import UserManagement from './UserManagement.jsx';

function InstituteList() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isBillingOwner, setIsBillingOwner] = useState(false);

  const reload = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/district/school-admins');
      setAdmins(res.data || []);
    } catch (err) {
      console.error('Failed to load school admins', err);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const doLoad = async () => {
      try {
        const res = await apiClient.get('/district/school-admins');
        if (isMounted) setAdmins(res.data || []);
      } catch (err) {
        console.error('Failed to load school admins', err);
        if (isMounted) setAdmins([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    doLoad();
    return () => { isMounted = false; };
  }, []);

  // Fetch user profile to determine isBillingOwner
  useEffect(() => {
    apiClient.get('/users/me')
      .then(response => {
        const profile = response.data;
        setIsBillingOwner(profile.uid === profile.billingOwnerId);
      })
      .catch(err => {
        console.error('Failed to fetch user profile:', err);
      });
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Institutes</h3>
          <InfoTooltip description="Create and manage schools (institutes) under your district. View details, edit name/type, or delete empty institutes." />
        </div>
        <button
          onClick={() => setShowSubscriptionModal(true)}
          className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Usage & Subscription
        </button>
      </div>
      {loading && <div className="mt-3"><Spinner label="Loading school admins..." /></div>}
      {!loading && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {admins.map((admin) => (
            <div key={admin.uid} className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-gray-900">
              <div className="min-w-0">
                <div className="font-medium truncate">{admin.firstName} {admin.lastName}</div>
                <div className="text-xs text-gray-600 truncate">{admin.email}</div>
              </div>
              <UserManagement
                userId={admin.uid}
                endpointBase="/district/admin"
                userType="school admin"
                onUpdated={reload}
                onDeleted={reload}
              />
            </div>
          ))}
          {(!admins || admins.length === 0) && (
            <div className="text-gray-500 text-sm">No school admins found.</div>
          )}
        </div>
      )}

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        userRole="district-admin"
        isBillingOwner={isBillingOwner}
      />
    </div>
  );
}

export default InstituteList;


