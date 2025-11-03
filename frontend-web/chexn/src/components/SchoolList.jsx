import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';

function SchoolList() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchSchools() {
      try {
        const res = await apiClient.get('/district/my-schools');
        if (isMounted) {
          setSchools(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load schools', err);
        if (isMounted) {
          setSchools([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchSchools();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <h3 className="text-lg font-semibold text-gray-900">My Schools</h3>
      {loading && <div className="mt-3"><Spinner label="Loading..." /></div>}
      {!loading && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {schools.map((school) => (
            <div key={school.id} className="rounded-md border border-gray-200 p-3 text-gray-900">
              {school.name}
            </div>
          ))}
          {schools.length === 0 && (
            <div className="text-gray-500 text-sm">No schools found.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default SchoolList;


