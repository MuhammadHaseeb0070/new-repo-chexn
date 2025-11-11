import { useState } from 'react';
import Spinner from './Spinner.jsx';
import apiClient from '../apiClient.js';
import InfoTooltip from './InfoTooltip.jsx';
import BulkImport from './BulkImport.jsx';

function CreateStaff({ onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('teacher');
  const [message, setMessage] = useState('');
  const [showImport, setShowImport] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage('Creating account...');

    try {
      await apiClient.post('/admin/create-staff', {
        email,
        password,
        firstName,
        lastName,
        role
      });

      setMessage('Staff account created successfully!');
      // Clear all form inputs
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setRole('teacher');
      if (onCreated) onCreated();
    } catch (error) {
      setMessage(error.response?.data?.error || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Create Staff Account</h3>
        <InfoTooltip description="Add counselors, teachers, or social workers so they can manage student ChexNs." />
      </div>
      <div className="mt-3 mb-4">
        <button
          onClick={() => setShowImport(!showImport)}
          type="button"
          className="w-full rounded-md border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 font-medium transition-colors"
        >
          {showImport ? '← Single Entry' : '📥 Bulk Import Staff'}
        </button>
      </div>

      {showImport ? (
        <BulkImport
          endpoint="/admin/bulk-create-staff"
          onImportComplete={onCreated}
          userType="staff"
          maxUsers={100}
          showRoleField={true}
          defaultRole="teacher"
          roleOptions={[
            { value: 'teacher', label: 'Teacher' },
            { value: 'counselor', label: 'Counselor' },
            { value: 'social-worker', label: 'Social Worker' }
          ]}
        />
      ) : (
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm text-gray-600">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm text-gray-600">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1">
          <label className="block text-sm text-gray-600">First Name</label>
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1">
          <label className="block text-sm text-gray-600">Last Name</label>
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="block text-sm text-gray-600">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent">
            <option value="teacher">Teacher</option>
            <option value="counselor">Counselor</option>
            <option value="social-worker">Social Worker</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isSubmitting ? (<><Spinner /> <span className="text-white text-sm">Creating...</span></>) : 'Create Staff'}
          </button>
        </div>
      </form>
      )}
      {message && <p className="mt-3 text-sm text-gray-500">{message}</p>}
    </div>
  );
}

export default CreateStaff;

