import { useState } from 'react';
import { auth } from '../firebaseClient.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import PasswordReset from './PasswordReset.jsx';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  // --- YOUR LOGIC (UNCHANGED) ---
  const handleSignUp = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      setSigningUp(true);
      await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(auth.currentUser);
      console.log('Sign up successful, initial verification email sent.');
    } catch (error) {
      console.error('Sign up error:', error);
      setError(error.message);
    } finally {
      setSigningUp(false);
    }
  };

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      setSigningIn(true);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Sign in successful');
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error.message);
    } finally {
      setSigningIn(false);
    }
  };
  // --- END YOUR LOGIC ---

  // Password reset view (minimal, responsive)
  if (showReset) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 md:p-8">
          <PasswordReset />
          <button
            type="button"
            onClick={() => setShowReset(false)}
            className="mt-6 w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Login view (minimal, responsive, clear labeling)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 md:p-8">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 text-center">Sign in to ChexN</h1>
            <InfoTooltip description="Access your ChexN workspace to submit check-ins, monitor teams, and receive real-time alerts." />
          </div>
          <p className="mt-2 text-center text-sm text-gray-500">Use your email and password to continue</p>

          <form className="mt-6 space-y-5" noValidate>
            {error && (
              <div className="rounded-md border border-red-500/20 bg-red-50 text-red-600 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-2 w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                aria-invalid={!!error && (!email || !!error)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-2 w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                aria-invalid={!!error && (!password || !!error)}
              />
            </div>

            <div className="space-y-3">
            <button
                type="button"
                onClick={handleSignIn}
              disabled={signingIn}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
              {signingIn ? (<><Spinner /> <span className="text-white text-sm">Signing in...</span></>) : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={handleSignUp}
              disabled={signingUp}
              className="w-full rounded-md border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
              {signingUp ? (<><Spinner /> <span className="text-blue-600 group-hover:text-white text-sm">Signing up...</span></>) : 'Sign Up'}
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;