import { useState } from 'react';
import Spinner from './Spinner.jsx';
import apiClient from '../apiClient.js';
import InfoTooltip from './InfoTooltip.jsx';

function SelectRole() {
  const [selectedRole, setSelectedRole] = useState('parent');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [instituteName, setInstituteName] = useState('');
  const [instituteType, setInstituteType] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage('Creating your profile...');

    try {
      await apiClient.post('/users/create', { role: selectedRole, firstName, lastName, instituteName, instituteType });
      // Our App.jsx listener will see the new profile and refresh the app
      // We'll add a manual reload just to be sure
      window.location.reload();
    } catch (error) {
      setMessage(error.response?.data?.error || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 text-center">Complete Your Profile</h2>
            <InfoTooltip description="Choose the role that fits you so ChexN can unlock the right dashboard and permissions." />
          </div>
          <p className="mt-2 text-center text-gray-500">Tell us who you are to get the right dashboard.</p>
          <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm text-gray-600">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm text-gray-600">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <div className="flex items-center gap-2">
                <label className="block text-sm text-gray-600">Select Role</label>
                <InfoTooltip description="Pick the account type so we know whether to show parent, education institute, district, or employer tools." position="right" />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="parent">Parent</option>
                <option value="school">Education Institute (K-12, College, etc.)</option>
                <option value="district">District</option>
                <option value="employer">Employer</option>
              </select>
            </div>
            {selectedRole !== 'parent' && (
              <>
                <div className="md:col-span-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="block text-sm text-gray-600">
                      {selectedRole === 'school' ? 'Institute Name' : (selectedRole === 'district' ? 'District Name' : 'Company Name')}
                    </label>
                    <InfoTooltip description="Tell us the official name so we can label dashboards and notifications correctly." position="right" />
                  </div>
                  <input
                    type="text"
                    value={instituteName}
                    onChange={(e) => setInstituteName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="block text-sm text-gray-600">
                      {selectedRole === 'school' ? 'Institute Type (e.g., Elementary, College)' : (selectedRole === 'district' ? 'District Type (e.g., Public, Charter)' : 'Industry (e.g., Tech)')}
                    </label>
                    <InfoTooltip description="Add a short descriptor so we can tailor templates and insights for this organization." position="right" />
                  </div>
                  <input
                    type="text"
                    value={instituteType}
                    onChange={(e) => setInstituteType(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSubmitting ? (<><Spinner /> <span className="text-white text-sm">Creating...</span></>) : 'Complete Registration'}
              </button>
            </div>
          </form>
          {message && <p className="mt-3 text-center text-sm text-gray-500">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default SelectRole;

