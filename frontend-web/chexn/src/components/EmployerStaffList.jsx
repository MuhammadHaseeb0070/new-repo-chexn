import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';

function EmployerStaffList() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchStaff() {
      try {
        const res = await apiClient.get('/employer/my-staff');
        if (isMounted) {
          setStaff(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load employer staff', err);
        if (isMounted) {
          setStaff([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchStaff();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Employer Staff Members</h3>
        <InfoTooltip description="See every staff account connected to your employer workspace, including their roles and contact info." />
      </div>
      {loading && <div className="mt-3"><Spinner label="Loading staff members..." /></div>}
      {!loading && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staff.map((member) => (
            <div key={member.uid} className="rounded-md border border-gray-200 p-3 text-gray-900">
              <div className="font-medium">{member.firstName} {member.lastName}</div>
              <div className="text-sm text-gray-500">{member.email}</div>
              <div className="text-xs text-gray-400 mt-1">Role: {member.role}</div>
            </div>
          ))}
          {staff.length === 0 && (
            <div className="text-gray-500 text-sm col-span-full">No staff members found. Add staff using the form above.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmployerStaffList;


