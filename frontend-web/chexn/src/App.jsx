import { useState, useEffect } from 'react';
import auth from './firebaseClient.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './components/login.jsx';
import apiClient from './apiClient.js';

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = () => {
    signOut(auth);
    setUserProfile(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
        apiClient.post('/users/create')
          .then(response => setUserProfile(response.data))
          .catch(error => console.error('Error creating/updating profile:', error))
          .finally(() => setLoading(false));
      } else {
        setAuthUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (authUser === null) {
    return <Login />;
  }

  if (authUser && userProfile) {
    return (
      <div>
        <h2>Welcome, {userProfile.email}</h2>
        <h3>Your Role: {userProfile.role}</h3>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    );
  }

  if (authUser && !userProfile) {
    return <div>Creating profile...</div>;
  }
}

export default App;

