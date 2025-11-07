import { useState } from 'react';
import Spinner from './Spinner.jsx';
import { auth } from '../firebaseClient.js';
import { sendPasswordResetEmail } from 'firebase/auth';
import InfoTooltip from './InfoTooltip.jsx';

function PasswordReset() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage('Check your email for a reset link.');

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <h3 className="text-xl font-semibold text-gray-900 text-center">Reset Password</h3>
        <InfoTooltip description="We’ll email you a secure link so you can set a fresh password for your ChexN account." />
      </div>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="space-y-1">
          <label className="block text-sm text-gray-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {isSubmitting ? (<><Spinner /> <span className="text-white text-sm">Sending...</span></>) : 'Send Reset Email'}
        </button>
      </form>
      {message && <p className="mt-3 text-center text-sm text-gray-500">{message}</p>}
    </div>
  );
}

export default PasswordReset;

