import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import UsageDashboard from './UsageDashboard.jsx';
import UserManagement from './UserManagement.jsx';
import SubscriptionModal from './SubscriptionModal.jsx';

function SchoolStaffList({ refreshToken }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [coveredByDistrict, setCoveredByDistrict] = useState(false);
  const [effectiveLimits, setEffectiveLimits] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [coverageChecked, setCoverageChecked] = useState(false);
  const [schoolLimits, setSchoolLimits] = useState(null);
  const [schoolLimitsLoading, setSchoolLimitsLoading] = useState(false);
  const [isBillingOwner, setIsBillingOwner] = useState(false);

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

  // Check if this school-admin is covered by a parent district subscription
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient.get('/district/coverage');
        if (mounted && res?.data && res.data.covered) {
          setCoveredByDistrict(true);
          // fetch effective limits for covered schools
          try {
            setLimitsLoading(true);
            const lim = await apiClient.get('/district/effective-limits');
            if (mounted && lim?.data?.limits) {
              setEffectiveLimits(lim.data.limits);
            }
          } catch (e) {
            console.warn('Failed to load effective limits:', e?.message || e);
          } finally {
            if (mounted) setLimitsLoading(false);
          }
        } else if (mounted) {
          // Not covered: fetch school's own subscription limits (if any)
          try {
            setSchoolLimitsLoading(true);
            const sub = await apiClient.get('/subscriptions/current');
            if (mounted && sub?.data?.limits) {
              setSchoolLimits(sub.data.limits);
            }
          } catch (e) {
            // no active subscription, leave null
          } finally {
            if (mounted) setSchoolLimitsLoading(false);
          }
        }
      } catch (e) {
        console.warn('Coverage check failed', e?.message || e);
      } finally {
        if (mounted) setCoverageChecked(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">School Staff Members</h3>
          <InfoTooltip description="Manage your school’s staff. Staff do not pay when your school is covered by a district plan." />
          {coveredByDistrict && <span className="text-xs text-gray-500">(Covered by District Plan)</span>}
        </div>
        {coverageChecked && !coveredByDistrict && (
          <button type="button" onClick={() => setShowSubscriptionModal(true)} className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Usage &amp; Subscription
          </button>
        )}
      </div>

      {/* My Capacity card (consistent with other roles) */}
      <div className="mt-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">My Capacity</h3>
              <InfoTooltip description="These are the limits that apply to your school. If your school was created by a district with an active plan, these limits come from that district’s plan." />
            </div>
            <span className="text-sm text-gray-600">
              {(() => {
                const lim = coveredByDistrict ? effectiveLimits : schoolLimits;
                const loading = coveredByDistrict ? limitsLoading : schoolLimitsLoading;
                if (!coverageChecked || loading) return 'Checking…';
                if (!lim) return 'No active plan';
                const current = Array.isArray(staff) ? staff.length : 0;
                const limit = lim?.staff ?? 0;
                const remaining = Math.max((limit || 0) - current, 0);
                return `${current} / ${limit || 0} used${typeof limit === 'number' ? ` — ${remaining} remaining` : ''}`;
              })()}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {coveredByDistrict ? (
              <>
                <div>Staff limit: <strong>{effectiveLimits ? (effectiveLimits.staff ?? 0) : '-'}</strong></div>
                <div>Students per staff limit: <strong>{effectiveLimits ? (effectiveLimits.studentsPerStaff ?? 0) : '-'}</strong></div>
              </>
            ) : (
              <>
                <div>Staff limit: <strong>{schoolLimits ? (schoolLimits.staff ?? 0) : '-'}</strong></div>
                <div>Students per staff limit: <strong>{schoolLimits ? (schoolLimits.studentsPerStaff ?? 0) : '-'}</strong></div>
              </>
            )}
          </div>
        </div>
      </div>
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
                    onUpdated={fetchStaff}
                    onDeleted={fetchStaff}
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
      {!coveredByDistrict && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          userRole="school-admin"
          isBillingOwner={isBillingOwner}
        />
      )}
    </div>
  );
}

export default SchoolStaffList;


