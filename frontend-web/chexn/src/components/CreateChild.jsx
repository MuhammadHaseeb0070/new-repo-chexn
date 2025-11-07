import { useState } from 'react';
import Spinner from './Spinner.jsx';
import apiClient from '../apiClient.js';
import InfoTooltip from './InfoTooltip.jsx';

function CreateChild({ onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage('Creating child\'s account...');

    try {
      await apiClient.post('/parents/create-child', {
        email,
        password,
        firstName,
        lastName
      });

      setMessage('Child account created successfully!');
      // Clear all form inputs
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
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
        <h3 className="text-lg font-semibold text-gray-900">Create a Child Account</h3>
        <InfoTooltip description="Invite a child into ChexN so they can submit check-ins under your supervision." />
      </div>
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
        <div className="md:col-span-2">
          <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isSubmitting ? (<><Spinner /> <span className="text-white text-sm">Creating...</span></>) : 'Create Child'}
          </button>
        </div>
      </form>
      {message && <p className="mt-3 text-sm text-gray-500">{message}</p>}
    </div>
  );
}

export default CreateChild;

