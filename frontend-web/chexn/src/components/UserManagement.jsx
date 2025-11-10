import { useState } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';

/**
 * Reusable UserManagement component for viewing, editing, and deleting users
 * @param {string} userId - The user ID to manage
 * @param {string} endpointBase - Base endpoint (e.g., '/parents/child', '/staff/student')
 * @param {string} userType - Type of user (e.g., 'child', 'student', 'employee', 'staff')
 * @param {function} onUpdated - Callback when user is updated
 * @param {function} onDeleted - Callback when user is deleted
 */
function UserManagement({ userId, endpointBase, userType, onUpdated, onDeleted }) {
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('view'); // 'view', 'edit', 'delete'
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const showRoleField = userType === 'staff'; // Show role field for staff management

  const fetchUserData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`${endpointBase}/${userId}`);
      setUserData(response.data);
      setFormData({
        firstName: response.data.firstName || '',
        lastName: response.data.lastName || '',
        email: response.data.email || '',
        phoneNumber: response.data.phoneNumber || '',
        password: '',
        role: response.data.role || ''
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError(error.response?.data?.error || 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (mode) => {
    setViewMode(mode);
    setShowModal(true);
    setError('');
    if (mode !== 'delete') {
      fetchUserData();
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setUserData(null);
    setFormData({});
    setError('');
    setShowPassword(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const updatePayload = {};
      if (formData.firstName !== userData.firstName) updatePayload.firstName = formData.firstName;
      if (formData.lastName !== userData.lastName) updatePayload.lastName = formData.lastName;
      if (formData.email !== userData.email) updatePayload.email = formData.email;
      if (formData.phoneNumber !== userData.phoneNumber) updatePayload.phoneNumber = formData.phoneNumber;
      if (formData.password) updatePayload.password = formData.password;
      if (showRoleField && formData.role !== userData.role) updatePayload.role = formData.role;

      if (Object.keys(updatePayload).length === 0) {
        setError('No changes to save');
        setLoading(false);
        return;
      }

      await apiClient.put(`${endpointBase}/${userId}`, updatePayload);
      handleClose();
      if (onUpdated) onUpdated();
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.response?.data?.error || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.delete(`${endpointBase}/${userId}`);
      handleClose();
      if (onDeleted) onDeleted();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  if (!showModal) {
    return (
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(true);
            setViewMode('view');
            fetchUserData();
          }}
          className="p-1.5 sm:p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          title="View & Manage"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" 
      onClick={handleClose}
      style={{ position: 'fixed', zIndex: 9999 }}
    >
      <div 
        className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', zIndex: 10000 }}
      >
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {viewMode === 'view' && `View ${userType} Details`}
              {viewMode === 'edit' && `Edit ${userType}`}
              {viewMode === 'delete' && `Delete ${userType}`}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none focus:outline-none"
              type="button"
            >
              ×
            </button>
          </div>
          
          {/* Action buttons for view mode */}
          {viewMode === 'view' && userData && (
            <div className="mb-4 flex flex-wrap gap-2 pb-4 border-b">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('edit');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                type="button"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('delete');
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
                type="button"
              >
                Delete
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium transition-colors"
                type="button"
              >
                Close
              </button>
            </div>
          )}

          {loading && viewMode !== 'delete' && !userData && (
            <div className="py-8"><Spinner label="Loading..." /></div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {viewMode === 'view' && userData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded-md">{userData.firstName || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded-md">{userData.lastName || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded-md">{userData.email || '-'}</p>
                </div>
                {userData.phoneNumber && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded-md">{userData.phoneNumber}</p>
                  </div>
                )}
                {showRoleField && userData.role && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded-md capitalize">{userData.role}</p>
                  </div>
                )}
                {userData.credentials && userData.credentials.password && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded-md font-mono flex-1">
                        {showPassword ? userData.credentials.password : '••••••••••••'}
                      </p>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(userData.credentials.password);
                          alert('Password copied to clipboard!');
                        }}
                        className="text-xs text-green-600 hover:text-green-800 px-2 py-1"
                        title="Copy password"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'edit' && userData && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (optional)</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+1234567890"
                    className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter new password or leave blank"
                    className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
                </div>
                {showRoleField && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {endpointBase.includes('/admin/') ? (
                        <>
                          <option value="teacher">Teacher</option>
                          <option value="counselor">Counselor</option>
                          <option value="social-worker">Social Worker</option>
                        </>
                      ) : (
                        <>
                          <option value="supervisor">Supervisor</option>
                          <option value="hr">HR</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  onClick={(e) => e.stopPropagation()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? <><Spinner /> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {viewMode === 'delete' && (
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete this {userType}? This action cannot be undone. The account will be permanently deleted from the system.
              </p>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  type="button"
                >
                  {loading ? <><Spinner /> Deleting...</> : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserManagement;

