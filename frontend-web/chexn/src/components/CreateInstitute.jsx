import { useState } from 'react';
import Spinner from './Spinner.jsx';
import apiClient from '../apiClient.js';
import InfoTooltip from './InfoTooltip.jsx';
import BulkImport from './BulkImport.jsx';

function CreateInstitute({ onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [instituteName, setInstituteName] = useState('');
  const [instituteType, setInstituteType] = useState('elementary');
  const [message, setMessage] = useState('');
  const [showImport, setShowImport] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage('Creating institute account...');

    try {
      await apiClient.post('/district/create-institute', {
        email,
        password,
        firstName,
        lastName,
        instituteName,
        instituteType
      });

      setMessage('Institute account created successfully!');
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setInstituteName('');
      setInstituteType('elementary');
      if (onCreated) onCreated();
    } catch (error) {
      if (error.response?.status === 403 && error.response?.data?.error === 'Limit Reached') {
        setMessage('You have reached your limit. Please contact your administrator to upgrade your plan.');
      } else {
        setMessage(error.response?.data?.error || 'An error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">District Admin: Manage Schools (Create School Admins)</h3>
        <InfoTooltip description="You are a district-level admin. Create school (institute) accounts and their primary school admins here." />
      </div>
      <div className="mt-3 mb-4">
        <button
          type="button"
          onClick={() => setShowImport(!showImport)}
          className="w-full rounded-md border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 font-medium transition-colors"
        >
          {showImport ? '← Single Institute Entry' : '📥 Bulk Import Schools'}
        </button>
      </div>
      {showImport ? (
        <BulkImport
          endpoint="/district/bulk-create-institutes"
          onImportComplete={onCreated}
          userType="institutes"
          maxUsers={100}
          parseMode="district-institutes"
        />
      ) : (
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm text-gray-600">Institute Name</label>
          <input type="text" value={instituteName} onChange={(e) => setInstituteName(e.target.value)} required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm text-gray-600">Institute Type</label>
          <select value={instituteType} onChange={(e) => setInstituteType(e.target.value)} className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent">
            <option value="elementary">Elementary School</option>
            <option value="middle-school">Middle School</option>
            <option value="high-school">High School</option>
            <option value="college">College</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm text-gray-600">Admin Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm text-gray-600">Admin Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1">
          <label className="block text-sm text-gray-600">Admin First Name</label>
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1">
          <label className="block text-sm text-gray-600">Admin Last Name</label>
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isSubmitting ? (<><Spinner /> <span className="text-white text-sm">Creating...</span></>) : 'Add Institute'}
          </button>
        </div>
      </form>
      )}
      {message && <p className="mt-3 text-sm text-gray-500">{message}</p>}
    </div>
  );
}

export default CreateInstitute;


