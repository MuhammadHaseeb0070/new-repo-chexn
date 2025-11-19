import { useState, useEffect, useMemo } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import UsageDashboard from './UsageDashboard.jsx';
import CollapsiblePanel from './CollapsiblePanel.jsx';

function SubscriptionModal({
  isOpen,
  onClose,
  subscription,
  usageData,
  profile,
  isBillingOwner,
  onSubscriptionUpdated
}) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [upgradeSuccess, setUpgradeSuccess] = useState('');
  const [changingPackageId, setChangingPackageId] = useState(null);

  const mapRoleToFrontend = (role) => {
    if (!role) return 'parent';
    const normalized = String(role).toLowerCase();

    if (['parent', 'school', 'district', 'employer'].includes(normalized)) {
      return normalized;
    }

    switch (normalized) {
      case 'schooladmin':
      case 'school-admin':
      case 'school_admin':
        return 'school';
      case 'districtadmin':
      case 'district-admin':
      case 'district_admin':
        return 'district';
      case 'employeradmin':
      case 'employer-admin':
      case 'employer_admin':
        return 'employer';
      default:
        return 'parent';
    }
  };

  useEffect(() => {
    if (isOpen && showUpgradeOptions && subscription) {
      loadPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, showUpgradeOptions, subscription?.packageId]);

  const loadPackages = async () => {
    if (!subscription) return;
    try {
      setPackagesLoading(true);
      setUpgradeError('');
      const derivedRole = subscription.role || profile?.role || 'parent';
      const roleParam = mapRoleToFrontend(derivedRole);
      const response = await apiClient.get(`/subscriptions/packages/${roleParam}`);
      setPackages(response.data || []);
    } catch (err) {
      console.error('Error loading packages:', err);
      setUpgradeError('Failed to load available plans. Please try again later.');
    } finally {
      setPackagesLoading(false);
    }
  };

  const handleToggleUpgrade = () => {
    const nextState = !showUpgradeOptions;
    setShowUpgradeOptions(nextState);
    if (!nextState) {
      setUpgradeError('');
      setUpgradeSuccess('');
    }
  };

  const handleChangePlan = async (pkg) => {
    if (!subscription || pkg.id === subscription.packageId) {
      return;
    }
    try {
      setChangingPackageId(pkg.id);
      setUpgradeError('');
      setUpgradeSuccess('');
      const response = await apiClient.post('/subscriptions/change-plan', {
        packageId: pkg.id,
      });
      
      // Check if payment warning was returned
      if (response.data?.warning) {
        setUpgradeError(response.data.warning);
        // Still show success message but with warning
        if (response.data.requiresPaymentUpdate) {
          setUpgradeSuccess(`Plan updated to ${pkg.name}, but payment needs attention. Please update your payment method.`);
        }
      } else {
        setUpgradeSuccess(`Plan updated to ${pkg.name}.`);
      }
      
      if (typeof onSubscriptionUpdated === 'function') {
        onSubscriptionUpdated();
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      
      // Check if this is a downgrade validation error
      if (error.response?.data?.violations && error.response?.data?.violations.length > 0) {
        // Format violation messages for display
        const violationMessages = error.response.data.violations
          .map((v) => `• ${v.message}`)
          .join('\n');
        setUpgradeError(
          `Cannot downgrade to ${pkg.name}:\n\n${violationMessages}\n\nPlease remove the excess resources before downgrading.`
        );
      } else {
        // Regular error message
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Failed to update plan. Please try again.';
        setUpgradeError(message);
      }
    } finally {
      setChangingPackageId(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setOpeningPortal(true);
      setError('');
      const response = await apiClient.post('/subscriptions/create-portal-session');
      
      if (response.data && response.data.url) {
        // Redirect to Stripe Customer Portal
        window.location.href = response.data.url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      const rawMessage = error.response?.data?.error || error.message || 'Failed to open subscription management. Please try again.';
      if (rawMessage?.includes('No configuration provided')) {
        setError(
          'Stripe customer portal is not configured for test mode. Please visit https://dashboard.stripe.com/test/settings/billing/portal and save the default settings, then try again.'
        );
      } else {
        setError(rawMessage);
      }
      setOpeningPortal(false);
    }
  };

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

  const formattedCancelDate = useMemo(
    () => (subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null),
    [subscription]
  );

  const handleClose = () => {
    setError('');
    setOpeningPortal(false);
    setShowUpgradeOptions(false);
    setPackages([]);
    setUpgradeError('');
    setUpgradeSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  const isLoading = !subscription;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Subscription Management</h2>
            <InfoTooltip description="View your subscription details, usage limits, and manage your plan." />
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner label="Loading subscription..." />
            </div>
          ) : error && !subscription ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          ) : !subscription ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No active subscription found.</p>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">Subscription Required</p>
                <p>You need an active subscription to use ChexN. Please refresh the page to select a plan.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Subscription Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 md:p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h3>

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
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                      subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                      subscription.status === 'past_due' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {subscription.status}
                    </span>
                  </div>

                  {formattedRenewalDate && formattedRenewalDate !== 'N/A' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Renews:</span>
                      <span className="text-sm text-gray-900">{formattedRenewalDate}</span>
                    </div>
                  )}

                  {subscription.cancelAtPeriodEnd && formattedCancelDate && formattedCancelDate !== 'N/A' && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md text-sm">
                      Your subscription will cancel on {formattedCancelDate}
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
                    <button
                      onClick={handleToggleUpgrade}
                      className="mt-3 w-full rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 px-4 py-2 text-sm font-medium transition-colors"
                    >
                      {showUpgradeOptions ? 'Hide Plan Options' : 'Need more capacity? Change plan'}
                    </button>
                  </div>
                </div>
              </div>

              {showUpgradeOptions && (
                <div className="bg-white border border-blue-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-gray-900">Available Plans</h4>
                    <InfoTooltip description="Pick a different plan to instantly update your subscription. Stripe will prorate any difference automatically." />
                  </div>

                  {upgradeError && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm whitespace-pre-line">
                      {upgradeError}
                    </div>
                  )}

                  {upgradeSuccess && (
                    <div className="mb-3 bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm">
                      {upgradeSuccess}
                    </div>
                  )}

                  {packagesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner label="Loading plans..." />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {packages.map((pkg) => {
                        const isCurrent = subscription?.packageId === pkg.id;
                        const isProcessing = changingPackageId === pkg.id;
                        return (
                          <div key={pkg.id} className={`border rounded-lg p-4 shadow-sm ${isCurrent ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 bg-white'}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-base font-semibold text-gray-900">{pkg.name}</p>
                                <p className="text-sm text-gray-500 mt-1">${pkg.price} / month</p>
                              </div>
                              {isCurrent && (
                                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">Current</span>
                              )}
                            </div>
                            <ul className="mt-3 space-y-1.5">
                              {pkg.features.slice(0, 4).map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                            <button
                              onClick={() => handleChangePlan(pkg)}
                              disabled={isCurrent || Boolean(changingPackageId)}
                              className={`mt-4 w-full rounded-md px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                isCurrent
                                  ? 'border border-gray-300 text-gray-500 cursor-default'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              {isProcessing ? (
                                <>
                                  <Spinner /> Updating...
                                </>
                              ) : isCurrent ? (
                                'Current Plan'
                              ) : (
                                'Switch to this plan'
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Usage Dashboard - Collapsible */}
              <CollapsiblePanel
                title="Usage & Limits"
                defaultOpen={false}
                description="Track how many resources you've created versus your plan limits. Upgrade if you need more capacity."
              >
                <UsageDashboard
                  subscription={subscription}
                  usageData={usageData}
                  profile={profile}
                  isBillingOwner={isBillingOwner}
                />
              </CollapsiblePanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubscriptionModal;

