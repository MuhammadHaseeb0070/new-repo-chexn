import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';

function InstituteList() {
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchInstitutes() {
      try {
        const res = await apiClient.get('/district/my-institutes');
        if (isMounted) {
          setInstitutes(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load institutes', err);
        if (isMounted) {
          setInstitutes([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchInstitutes();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <h3 className="text-lg font-semibold text-gray-900">School Districts & Institutes</h3>
      {loading && <div className="mt-3"><Spinner label="Loading institutes..." /></div>}
      {!loading && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {institutes.map((institute) => (
            <div key={institute.id} className="rounded-md border border-gray-200 p-3 text-gray-900">
              <div className="font-medium">{institute.name}</div>
            </div>
          ))}
          {institutes.length === 0 && (
            <div className="text-gray-500 text-sm col-span-full">No institutes found. Create a new institute using the form above.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default InstituteList;


