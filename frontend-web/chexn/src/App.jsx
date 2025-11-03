import { useState, useEffect } from "react";
import auth from "./firebaseClient.js";
import { onAuthStateChanged, signOut, sendEmailVerification } from "firebase/auth";
import Login from "./components/login.jsx";
import Spinner from "./components/Spinner.jsx";
import apiClient from "./apiClient.js";
import CheckIn from "./components/CheckIn.jsx";
import CheckInHistory from "./components/CheckInHistory.jsx";
import CreateChild from "./components/CreateChild.jsx";
import ParentDashboard from "./components/ParentDashboard.jsx";
import CreateStaff from "./components/CreateStaff.jsx";
import CreateStudent from "./components/CreateStudent.jsx";
// Removed TeacherDashboard (StudentList)
import SelectRole from "./components/SelectRole.jsx";
import CreateSchool from "./components/CreateSchool.jsx";
import CreateEmployerStaff from "./components/CreateEmployerStaff.jsx";
import CreateEmployee from "./components/CreateEmployee.jsx";
// Removed SupervisorDashboard
import StaffDashboard from "./components/StaffDashboard.jsx";
import SchoolList from "./components/SchoolList.jsx";
import SchoolStaffList from "./components/SchoolStaffList.jsx";
import EmployerStaffList from "./components/EmployerStaffList.jsx";

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schoolsRefreshKey, setSchoolsRefreshKey] = useState(0);
  const [schoolStaffRefreshKey, setSchoolStaffRefreshKey] = useState(0);
  const [employerStaffRefreshKey, setEmployerStaffRefreshKey] = useState(0);
  const [studentsRefreshKey, setStudentsRefreshKey] = useState(0);
  const [employeesRefreshKey, setEmployeesRefreshKey] = useState(0);
  const [selfCheckInsRefreshKey, setSelfCheckInsRefreshKey] = useState(0);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
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
          .then(response => {
            // They have a profile, save it
            setUserProfile(response.data);
          })
          .catch(error => {
            // A 404 means they are new and need to pick a role
            if (error.response && error.response.status === 404) {
              setUserProfile(null); 
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

      {/* 4. User is logged in, email IS verified, BUT profile is NOT created */}
      {!loading && authUser && authUser.emailVerified && !userProfile && (
        <SelectRole />
      )}

      {/* 5. User is fully logged in, verified, and has a profile */}
      {!loading && authUser && authUser.emailVerified && userProfile && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Welcome, {userProfile.email}</h2>
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
                <CreateChild />
                <ParentDashboard />
              </div>
            )}

            {/* --- School Admin UI --- */}
            {userProfile.role === 'school-admin' && (
              <div className="space-y-4">
                <CreateStaff onCreated={() => setSchoolStaffRefreshKey(v => v + 1)} />
                <SchoolStaffList key={schoolStaffRefreshKey} />
              </div>
            )}

            {/* --- Teacher/Staff UI --- */}
            {(userProfile.role === 'teacher' || userProfile.role === 'counselor' || userProfile.role === 'social-worker') && (
              <div className="space-y-4">
                <CreateStudent onCreated={() => setStudentsRefreshKey(v => v + 1)} />
                <StaffDashboard userType="student" refreshToken={studentsRefreshKey} />
              </div>
            )}

            {/* --- District Admin UI --- */}
            {userProfile.role === 'district-admin' && (
              <div className="space-y-4">
                <CreateSchool onCreated={() => setSchoolsRefreshKey(v => v + 1)} />
                <SchoolList key={schoolsRefreshKey} />
              </div>
            )}

            {/* --- Employer UI --- */}
            {userProfile.role === 'employer-admin' && (
              <div className="space-y-4">
                <CreateEmployerStaff onCreated={() => setEmployerStaffRefreshKey(v => v + 1)} />
                <EmployerStaffList key={employerStaffRefreshKey} />
              </div>
            )}

            {/* --- Employer Staff UI --- */}
            {(userProfile.role === 'supervisor' || userProfile.role === 'hr') && (
              <div className="space-y-4">
                <CreateEmployee onCreated={() => setEmployeesRefreshKey(v => v + 1)} />
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
