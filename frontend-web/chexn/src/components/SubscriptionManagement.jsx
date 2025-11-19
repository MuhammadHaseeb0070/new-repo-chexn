import { useState } from 'react';
import SubscriptionModal from './SubscriptionModal.jsx';

function SubscriptionManagement({
  subscription,
  usageData,
  profile,
  isBillingOwner,
  onSubscriptionUpdated
}) {
  const [open, setOpen] = useState(false);

  if (!subscription) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={!isBillingOwner}
      >
        Manage Subscription
      </button>
      <SubscriptionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        subscription={subscription}
        usageData={usageData}
        profile={profile}
        isBillingOwner={isBillingOwner}
        onSubscriptionUpdated={onSubscriptionUpdated}
      />
    </>
  );
}

export default SubscriptionManagement;

