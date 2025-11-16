import { useState, useEffect, useMemo } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';

function UsageDashboard({ subscription, userRole, isBillingOwner }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subscription) {
      fetchUsage();
    }
  }, [subscription]);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/usage/current');
      setUsage(response.data);
    } catch (error) {
      console.error('Error fetching usage:', error);
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (current, limit) => {
    if (!limit || limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const normalizeEntry = (value) => {
    if (!value || typeof value !== 'object') {
      return {
        count: value || 0,
        name: '',
      };
    }
    return {
      count: value.count || 0,
      name: value.name || '',
    };
  };

  const displayLimits = useMemo(() => {
    if (!subscription) return {};

    const { limits } = subscription;
    const managedSchoolRoles = ['school-admin', 'teacher', 'counselor', 'social-worker'];

    if (isBillingOwner) {
      // This is a Payer (Parent, Standalone Admin, District, Employer)
      // They see the direct limits from their plan.
      return limits;
    } else if (managedSchoolRoles.includes(userRole)) {
      // This is a Managed Staff/Admin under a District
      // We map their limits to the district's "PerSchool" limits
      return {
        staff: limits.staffPerSchool,
        students: limits.studentsPerStaff,
      };
    } else {
      // This is a Managed Staff under an Employer
      // We map their limits to the employer's "PerStaff" limits
      return {
        employees: limits.employeesPerStaff,
      };
    }
  }, [subscription, userRole, isBillingOwner]);

  const renderUsageBar = (label, current, limit, resourceType) => {
    if (typeof limit !== 'number' || limit === undefined || limit === null) return null;
    
    const percentage = getUsagePercentage(current || 0, limit);
    const color = getUsageColor(percentage);
    const remaining = Math.max(limit - (current || 0), 0);

    return (
      <div className="mb-4">
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
        {percentage >= 80 && (
          <p className="mt-1 text-xs text-yellow-600">
            {percentage >= 100 
              ? 'Limit reached. Upgrade to add more.' 
              : 'Approaching limit. Consider upgrading.'}
          </p>
        )}
      </div>
    );
  };

  if (!subscription) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
        <Spinner label="Loading usage..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  const usageData = usage?.usage || {};

  return (
    <div className="space-y-4">
      {/* Parent - Children */}
      {renderUsageBar('Children', usageData.children, displayLimits.children, 'children')}

      {/* Schools (District Admin only) */}
      {renderUsageBar('Schools', usageData.schools, displayLimits.schools, 'schools')}

      {/* Staff (School Admin, District Admin, Employer Admin) */}
      {renderUsageBar('Staff Members', usageData.staff, displayLimits.staff, 'staff')}

      {/* Students per Staff (School Admin, Teachers, Counselors, Social Workers) */}
      {typeof displayLimits.students === 'number' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Students per Staff</span>
            <span className="text-sm text-gray-600">Limit: {displayLimits.students} per staff</span>
          </div>
          {usageData.studentsByStaff && Object.keys(usageData.studentsByStaff).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(usageData.studentsByStaff).map(([staffId, value]) => {
                const { count, name } = normalizeEntry(value);
                const displayName = name || `Staff ${staffId.slice(0, 8)}...`;
                return (
                  <div key={staffId} className="text-xs text-gray-600">
                    {displayName}: {count} / {displayLimits.students}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No students created yet</p>
          )}
        </div>
      )}

      {/* Staff per School (District Admin only) */}
      {typeof displayLimits.staffPerSchool === 'number' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Staff per School</span>
            <span className="text-sm text-gray-600">Limit: {displayLimits.staffPerSchool} per school</span>
          </div>
          {usageData.staffPerSchool && Object.keys(usageData.staffPerSchool).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(usageData.staffPerSchool).map(([schoolId, count]) => (
                <div key={schoolId} className="text-xs text-gray-600">
                  School {schoolId.slice(0, 8)}...: {count} / {displayLimits.staffPerSchool}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No staff created yet</p>
          )}
        </div>
      )}

      {/* Employees per Staff (Employer Admin, Employer Staff) */}
      {typeof displayLimits.employees === 'number' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Employees per Staff</span>
            <span className="text-sm text-gray-600">Limit: {displayLimits.employees} per staff</span>
          </div>
          {usageData.employeesByStaff && Object.keys(usageData.employeesByStaff).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(usageData.employeesByStaff).map(([staffId, value]) => {
                const { count, name } = normalizeEntry(value);
                const displayName = name || `Staff ${staffId.slice(0, 8)}...`;
                return (
                  <div key={staffId} className="text-xs text-gray-600">
                    {displayName}: {count} / {displayLimits.employees}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No employees created yet</p>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="pt-3 border-t">
        <button
          onClick={fetchUsage}
          disabled={loading}
          className="w-full rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Spinner /> Refreshing...
            </>
          ) : (
            'Refresh Usage'
          )}
        </button>
      </div>
    </div>
  );
}

export default UsageDashboard;

