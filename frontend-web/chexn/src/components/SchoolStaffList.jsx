import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import UsageDashboard from './UsageDashboard.jsx';
import UserManagement from './UserManagement.jsx';
import SubscriptionModal from './SubscriptionModal.jsx';

function SchoolStaffList({
  refreshToken,
  subscription,
  usageData,
  profile,
  isBillingOwner,
  onSubscriptionUpdated,
  onUsageRefresh
}) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const fetchStaff = async () => {
    try {
      const res = await apiClient.get('/admin/my-staff');
      setStaff(res.data || []);
    } catch (err) {
      console.error('Failed to load staff', err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [refreshToken]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">School Staff Members</h3>
          <InfoTooltip description="Manage your school’s staff. Staff do not pay when your school is covered by a district plan." />
        </div>
        {subscription && isBillingOwner && (
          <button type="button" onClick={() => setShowSubscriptionModal(true)} className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Usage &amp; Subscription
          </button>
        )}
      </div>

      {subscription && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold text-gray-900">My Capacity</h3>
            <InfoTooltip description="These are the limits that apply to your school. If your school was created by a district with an active plan, these limits come from that district’s plan." />
          </div>
          <UsageDashboard
            subscription={subscription}
            usageData={usageData}
            profile={profile}
            isBillingOwner={isBillingOwner}
          />
        </div>
      )}
      {loading && <div className="mt-3"><Spinner label="Loading staff members..." /></div>}
      {!loading && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staff.map((member) => (
            <div key={member.uid} className="rounded-md border border-gray-200 p-3 text-gray-900">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-medium text-sm truncate">{member.firstName} {member.lastName}</div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">{member.email}</div>
                  <div className="text-xs text-gray-400 mt-1 capitalize">Role: {member.role}</div>
                </div>
                <div className="shrink-0">
                  <UserManagement
                    userId={member.uid}
                    endpointBase="/admin/staff"
                    userType="staff"
                    onUpdated={() => {
                      fetchStaff();
                      if (onUsageRefresh) {
                        onUsageRefresh();
                      }
                    }}
                    onDeleted={() => {
                      fetchStaff();
                      if (onUsageRefresh) {
                        onUsageRefresh();
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          {staff.length === 0 && (
            <div className="text-gray-500 text-sm col-span-full">No staff members found. Add staff using the form above.</div>
          )}
        </div>
      )}

      {/* Removed secondary Usage & Limits panel to avoid duplication. Capacity card above is the single source of truth. */}

      {/* Subscription Modal */}
      {isBillingOwner && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          subscription={subscription}
          usageData={usageData}
          profile={profile}
          isBillingOwner={isBillingOwner}
          onSubscriptionUpdated={onSubscriptionUpdated}
        />
      )}
    </div>
  );
}

export default SchoolStaffList;


