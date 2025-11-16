import { useState, useEffect, useMemo } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import UsageDashboard from './UsageDashboard.jsx';

function SubscriptionManagement({ userRole, isBillingOwner }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (value, options = {}) => {
    if (!value) return 'N/A';
    let date;
    try {
      if (typeof value.toDate === 'function') {
        date = value.toDate();
      } else if (value.seconds) {
        date = new Date(value.seconds * 1000);
      } else if (value._seconds) {
        date = new Date(value._seconds * 1000);
      } else {
        date = new Date(value);
      }
    } catch {
      date = null;
    }
    if (!date || Number.isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    });
  };

  const formattedRenewalDate = useMemo(
    () => (subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null),
    [subscription]
  );

  // Map frontend role to backend role for API calls
  const getBackendRole = (role) => {
    const roleMap = {
      'parent': 'parent',
      'school-admin': 'schoolAdmin',
      'district-admin': 'districtAdmin',
      'employer-admin': 'employerAdmin'
    };
    return roleMap[role] || role;
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/subscriptions/current');
      setSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setError('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setOpeningPortal(true);
      const response = await apiClient.post('/subscriptions/create-portal-session');
      // Redirect to Stripe Customer Portal
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error opening portal:', error);
      setError('Failed to open subscription management. Please try again.');
      setOpeningPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
        <Spinner label="Loading subscription..." />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
          <InfoTooltip description="You need an active subscription to use ChexN. Select a plan to get started." />
        </div>
        <p className="text-gray-600 mb-4">No active subscription found.</p>
        <a
          href="/package-selection"
          className="inline-block rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-medium"
        >
          Select a Plan
        </a>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Subscription Details */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
          <InfoTooltip description="Manage your subscription, view usage, and upgrade or cancel your plan." />
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Plan:</span>
            <span className="text-sm font-medium text-gray-900 capitalize">{subscription.packageId}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(subscription.status)}`}>
              {subscription.status}
            </span>
          </div>

          {formattedRenewalDate && formattedRenewalDate !== 'N/A' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Renews:</span>
              <span className="text-sm text-gray-900">{formattedRenewalDate}</span>
            </div>
          )}

          {subscription.cancelAtPeriodEnd && formattedRenewalDate && formattedRenewalDate !== 'N/A' && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md text-sm">
              Your subscription will cancel on {formattedRenewalDate}
            </div>
          )}

          <div className="pt-3 border-t">
            <button
              onClick={handleManageSubscription}
              disabled={openingPortal}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {openingPortal ? (
                <>
                  <Spinner /> Opening...
                </>
              ) : (
                'Manage Subscription'
              )}
            </button>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Update payment method, view invoices, or cancel subscription
            </p>
          </div>
        </div>
      </div>

      {/* Usage Dashboard */}
      <UsageDashboard subscription={subscription} userRole={userRole} isBillingOwner={isBillingOwner} />
    </div>
  );
}

export default SubscriptionManagement;

