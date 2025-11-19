import { useMemo } from 'react';

function UsageDashboard({ subscription, usageData, profile, isBillingOwner }) {
  const role = (profile?.role || subscription?.role || '').toLowerCase();
  const limits = subscription?.limits || {};

  const getUsagePercentage = (current, limit) => {
    if (!limit || limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const renderUsageBar = (label, current, limit) => {
    if (typeof limit !== 'number') return null;
    const percentage = getUsagePercentage(current || 0, limit);
    const color = getUsageColor(percentage);
    const remaining = Math.max(limit - (current || 0), 0);

    return (
      <div key={label} className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm text-gray-600">
            {current || 0} / {limit} ({remaining} remaining)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`${color} h-2.5 rounded-full transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const payerMetrics = useMemo(() => {
    if (!isBillingOwner || !subscription || !usageData) return [];
    const metrics = [];

    if (typeof limits.children === 'number') {
      metrics.push({ label: 'Children', current: usageData.children || 0, limit: limits.children });
    }
    if (typeof limits.schools === 'number') {
      metrics.push({ label: 'Schools', current: usageData.schools || 0, limit: limits.schools });
    }
    if (typeof limits.staff === 'number') {
      metrics.push({ label: 'Staff Members', current: usageData.staff_total || 0, limit: limits.staff });
    }
    return metrics;
  }, [isBillingOwner, subscription, usageData, limits]);

  const managedView = useMemo(() => {
    if (isBillingOwner || !subscription || !usageData || !profile) {
      return null;
    }

    if (role === 'school-admin' && profile.uid !== profile.billingOwnerId) {
      const limit = limits.staffPerSchool || 0;
      const current = usageData.staffPerSchool?.[profile.organizationId] || 0;
      return { title: 'Staff at My School', current, limit };
    }

    if (['teacher', 'counselor', 'social-worker'].includes(role)) {
      const limit = limits.studentsPerStaff || 0;
      const current = usageData.studentsPerStaff?.[profile.uid] || 0;
      return { title: 'My Students', current, limit };
    }

    if (['supervisor', 'hr'].includes(role)) {
      const limit = limits.employeesPerStaff || 0;
      const current = usageData.employeesPerStaff?.[profile.uid] || 0;
      return { title: 'My Employees', current, limit };
    }

    return null;
  }, [isBillingOwner, subscription, usageData, profile, role, limits]);

  if (!subscription || !usageData) {
    return (
      <div className="text-sm text-gray-500">
        Usage data is not available right now.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isBillingOwner ? (
        <>
          {payerMetrics.map(metric => renderUsageBar(metric.label, metric.current, metric.limit))}

          {typeof limits.staffPerSchool === 'number' && usageData.staffPerSchool && Object.keys(usageData.staffPerSchool).length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Staff per School</span>
                <span className="text-sm text-gray-600">Limit: {limits.staffPerSchool} per school</span>
              </div>
              <div className="space-y-2">
                {Object.entries(usageData.staffPerSchool).map(([schoolId, count]) => (
                  <div key={schoolId} className="text-xs text-gray-600">
                    School {schoolId.slice(0, 8)}...: {count} / {limits.staffPerSchool}
                  </div>
                ))}
              </div>
            </div>
          )}

          {typeof limits.studentsPerStaff === 'number' && usageData.studentsPerStaff && Object.keys(usageData.studentsPerStaff).length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Students per Staff</span>
                <span className="text-sm text-gray-600">Limit: {limits.studentsPerStaff} per staff</span>
              </div>
              <div className="space-y-2">
                {Object.entries(usageData.studentsPerStaff).map(([staffId, count]) => (
                  <div key={staffId} className="text-xs text-gray-600">
                    Staff {staffId.slice(0, 8)}...: {count} / {limits.studentsPerStaff}
                  </div>
                ))}
              </div>
            </div>
          )}

          {typeof limits.employeesPerStaff === 'number' && usageData.employeesPerStaff && Object.keys(usageData.employeesPerStaff).length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Employees per Staff</span>
                <span className="text-sm text-gray-600">Limit: {limits.employeesPerStaff} per staff</span>
              </div>
              <div className="space-y-2">
                {Object.entries(usageData.employeesPerStaff).map(([staffId, count]) => (
                  <div key={staffId} className="text-xs text-gray-600">
                    Staff {staffId.slice(0, 8)}...: {count} / {limits.employeesPerStaff}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : managedView ? (
        renderUsageBar(managedView.title, managedView.current, managedView.limit)
      ) : (
        <p className="text-sm text-gray-500">
          Usage information is not available for your role.
        </p>
      )}
    </div>
  );
}

export default UsageDashboard;

