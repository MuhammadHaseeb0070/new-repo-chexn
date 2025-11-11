import { useState, useEffect } from "react";
import { auth } from "./firebaseClient.js";
import { requestNotificationPermission, setupForegroundMessageHandler } from "./firebaseMessaging.js";
import { onAuthStateChanged, signOut, sendEmailVerification } from "firebase/auth";
import Login from "./components/login.jsx";
import Spinner from "./components/Spinner.jsx";
import apiClient from "./apiClient.js";
import CheckIn from "./components/CheckIn.jsx";
import CheckInHistory from "./components/CheckInHistory.jsx";
import CreateChild from "./components/CreateChild.jsx";
import CollapsiblePanel from "./components/CollapsiblePanel.jsx";
import ParentDashboard from "./components/ParentDashboard.jsx";
import CreateStaff from "./components/CreateStaff.jsx";
import CreateStudent from "./components/CreateStudent.jsx";
// Removed TeacherDashboard (StudentList)
import SelectRole from "./components/SelectRole.jsx";
import CreateInstitute from "./components/CreateInstitute.jsx";
import CreateEmployerStaff from "./components/CreateEmployerStaff.jsx";
import CreateEmployee from "./components/CreateEmployee.jsx";
// Removed SupervisorDashboard
import StaffDashboard from "./components/StaffDashboard.jsx";
import InstituteList from "./components/InstituteList.jsx";
import SchoolStaffList from "./components/SchoolStaffList.jsx";
import EmployerStaffList from "./components/EmployerStaffList.jsx";
import PackageSelection from "./components/PackageSelection.jsx";

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schoolsRefreshKey, setSchoolsRefreshKey] = useState(0);
  const [schoolStaffRefreshKey, setSchoolStaffRefreshKey] = useState(0);
  const [employerStaffRefreshKey, setEmployerStaffRefreshKey] = useState(0);
  const [studentsRefreshKey, setStudentsRefreshKey] = useState(0);
  const [employeesRefreshKey, setEmployeesRefreshKey] = useState(0);
  const [selfCheckInsRefreshKey, setSelfCheckInsRefreshKey] = useState(0);
  const [parentChildrenRefreshKey, setParentChildrenRefreshKey] = useState(0);
  const [showPackageSelection, setShowPackageSelection] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      setIsNewUser(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleResendVerification = async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      alert('New verification email sent!');
    } catch (error) {
      alert(error.message);
    }
  };

  // Listen for messages from service worker (notification clicks when app is already open)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'notificationClick' && event.data?.scheduleId) {
        // Update URL to include scheduleId - CheckIn component will detect this via URL params
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('scheduleId', event.data.scheduleId);
        window.history.pushState({}, '', currentUrl.toString());
        // Dispatch a custom event to trigger URL param re-check in CheckIn component
        window.dispatchEvent(new CustomEvent('scheduleIdUpdated'));
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  // Check for Stripe checkout success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      // User just completed checkout
      setShowSuccessMessage(true);
      // Remove the session_id from URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload after a short delay to ensure webhook has processed
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {

        try {

          const token = await user.getIdToken();

          // Most likely this token is sent with apiClient (axios) requests as a bearer token,

          // but to follow your instructions, we'll log it here:

          console.log("Firebase access token:", token);

        } catch (err) {

          console.warn("Could not get Firebase access token:", err);

        }
        setLoading(true); 
        setAuthUser(user);
        
        // Check if they have a profile in our DB
        apiClient.get('/users/me')
          .then(async (response) => {
            // They have a profile, save it
            const profile = response.data;
            setUserProfile(profile);
            setIsNewUser(false);
            
            // Check if user needs subscription (paying roles)
            const payingRoles = ['parent', 'school-admin', 'district-admin', 'employer-admin'];
            if (payingRoles.includes(profile.role)) {
              try {
                // Special case: school-admin may be covered by district subscription
                if (profile.role === 'school-admin') {
                  try {
                    const cov = await apiClient.get('/district/coverage');
                    if (cov?.data?.covered) {
                      setShowPackageSelection(false);
                      return;
                    }
                  } catch (e) {
                    // ignore coverage errors; fall back to direct subscription check
                    console.warn('Coverage check failed; falling back to direct subscription check', e?.message || e);
                  }
                }

                const subscriptionRes = await apiClient.get('/subscriptions/current');
                if (!subscriptionRes.data || (subscriptionRes.data.status !== 'active' && subscriptionRes.data.status !== 'trialing')) {
                  setShowPackageSelection(true);
                } else {
                  setShowPackageSelection(false);
                }
              } catch (error) {
                console.error('Error checking subscription:', error);
                setShowPackageSelection(true);
              }
            } else {
              setShowPackageSelection(false);
            }
            
            // Request push permission and register token
            requestNotificationPermission();
            // Setup foreground message handler for notifications
            setupForegroundMessageHandler((scheduleId) => {
              // Scroll to check-in form if it exists
              setTimeout(() => {
                const checkInElement = document.querySelector('[data-checkin-form]');
                if (checkInElement) {
                  checkInElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 100);
            });
          })
          .catch(error => {
            // A 404 means they are new and need to pick a role
            if (error.response && error.response.status === 404) {
              setUserProfile(null); 
              setIsNewUser(true);
            } else {
              // Any other error: do NOT treat as new-user. Keep them on a safe fallback.
              console.error('Failed to load profile:', error);
              setIsNewUser(false);
            }
          })
          .finally(() => {
            // Now we're done, stop loading.
            setLoading(false);
          });
      } else {
        setAuthUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. App is loading */}
      {loading && (
        <div className="flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 md:p-8 text-center">
            <div className="flex items-center justify-center">
              <Spinner label="Preparing your dashboard..." />
            </div>
          </div>
        </div>
      )}

      {/* 2. User is logged out */}
      {!loading && !authUser && <Login />}

      {/* 3. User is logged in BUT email is not verified */}
      {!loading && authUser && !authUser.emailVerified && (
        <div className="flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-6 md:p-8">
            <h2 className="text-2xl font-semibold text-gray-900 text-center">Please Verify Your Email</h2>
            <p className="mt-2 text-center text-gray-500">
              A verification link has been sent to <strong className="text-gray-900 font-medium">{authUser.email}</strong>.
            </p>
            <p className="mt-1 text-center text-gray-500">Check your inbox (and spam) and click the link.</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={handleResendVerification} className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium">Resend Email</button>
              <button onClick={() => window.location.reload()} className="w-full rounded-md border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-3 font-medium">I've Verified</button>
              <button onClick={handleSignOut} className="w-full rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-3 font-medium">Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. User is logged in, email IS verified, BUT profile is NOT created (explicit new user only) */}
      {!loading && authUser && authUser.emailVerified && !userProfile && isNewUser && (
        <SelectRole />
      )}

      {/* 4.5. User needs to select a package */}
      {!loading && authUser && authUser.emailVerified && userProfile && showPackageSelection && (
        <PackageSelection 
          role={userProfile.role === 'school-admin' ? 'school' : userProfile.role === 'district-admin' ? 'district' : userProfile.role === 'employer-admin' ? 'employer' : 'parent'} 
        />
      )}

      {/* 5. User is fully logged in, verified, has a profile, and has subscription (if needed) */}
      {!loading && authUser && authUser.emailVerified && userProfile && !showPackageSelection && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Success Message */}
          {showSuccessMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="font-medium">Subscription activated successfully! Your account is now active.</p>
                </div>
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">
                Welcome{userProfile.firstName ? `, ${userProfile.firstName}${userProfile.lastName ? ` ${userProfile.lastName}` : ''}` : userProfile.email ? `, ${userProfile.email.split('@')[0]}` : ''}
              </h2>
              <p className="text-sm text-gray-500">Role: <span className="text-gray-900 font-medium">{userProfile.role}</span></p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSignOut} className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 font-medium">Sign Out</button>
            </div>
          </div>

          {/* Content */}
          <div className="mt-6 space-y-6">
          {/* --- Student UI --- */}
          {(userProfile.role === 'student' || userProfile.role === 'employee') && (
              <div className="space-y-4">
              <CheckIn onCreated={() => setSelfCheckInsRefreshKey(v => v + 1)} />
              <CheckInHistory refreshToken={selfCheckInsRefreshKey} />
            </div>
          )}

          {/* --- Parent UI --- */}
          {userProfile.role === 'parent' && (
              <div className="space-y-4">
                <CollapsiblePanel title="Add Child">
                  <CreateChild onCreated={() => setParentChildrenRefreshKey(v => v + 1)} />
                </CollapsiblePanel>
                <ParentDashboard refreshToken={parentChildrenRefreshKey} />
            </div>
          )}

          {/* --- School Admin UI --- */}
          {userProfile.role === 'school-admin' && (
              <div className="space-y-4">
                <CollapsiblePanel title="Add Staff">
              <CreateStaff onCreated={() => setSchoolStaffRefreshKey(v => v + 1)} />
                </CollapsiblePanel>
                <SchoolStaffList key={schoolStaffRefreshKey} refreshToken={schoolStaffRefreshKey} />
            </div>
          )}

          {/* --- Teacher/Staff UI --- */}
          {(userProfile.role === 'teacher' || userProfile.role === 'counselor' || userProfile.role === 'social-worker') && (
              <div className="space-y-4">
                <CollapsiblePanel title="Add Student">
              <CreateStudent onCreated={() => setStudentsRefreshKey(v => v + 1)} />
                </CollapsiblePanel>
              <StaffDashboard userType="student" refreshToken={studentsRefreshKey} />
            </div>
          )}

          {/* --- District Admin UI --- */}
          {userProfile.role === 'district-admin' && (
              <div className="space-y-4">
                <CollapsiblePanel title="Create New Institute">
                  <CreateInstitute onCreated={() => setSchoolsRefreshKey(v => v + 1)} />
                </CollapsiblePanel>
                <InstituteList key={schoolsRefreshKey} />
            </div>
          )}

          {/* --- Employer UI --- */}
          {userProfile.role === 'employer-admin' && (
              <div className="space-y-4">
                <CollapsiblePanel title="Add Staff">
              <CreateEmployerStaff onCreated={() => setEmployerStaffRefreshKey(v => v + 1)} />
                </CollapsiblePanel>
                <EmployerStaffList key={employerStaffRefreshKey} refreshToken={employerStaffRefreshKey} />
            </div>
          )}

          {/* --- Employer Staff UI --- */}
          {(userProfile.role === 'supervisor' || userProfile.role === 'hr') && (
              <div className="space-y-4">
                <CollapsiblePanel title="Add Employee">
              <CreateEmployee onCreated={() => setEmployeesRefreshKey(v => v + 1)} />
                </CollapsiblePanel>
              <StaffDashboard userType="employee" refreshToken={employeesRefreshKey} />
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
