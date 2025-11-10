import { useState, useEffect } from 'react';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import apiClient from '../apiClient.js';

/**
 * Parse CSV/text data into array of user objects
 * Only supports comma-separated values
 */
function parseImportData(text) {
  if (!text || !text.trim()) {
    return { users: [], errors: [] };
  }

  const lines = text.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { users: [], errors: [] };
  }

  // Only comma separator
  const separator = ',';

  // Check if first line is headers
  const firstLine = lines[0];
  const hasHeaders = firstLine.toLowerCase().includes('first') || 
                     firstLine.toLowerCase().includes('name') ||
                     firstLine.toLowerCase().includes('email');

  const dataLines = hasHeaders ? lines.slice(1) : lines;
  
  // Map headers if present
  const headers = hasHeaders ? firstLine.split(separator).map(h => h.trim().toLowerCase()) : null;
  
  const users = [];
  const errors = [];

  dataLines.forEach((line, index) => {
    const row = index + (hasHeaders ? 2 : 1); // Row number for error reporting
    const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, '')); // Remove quotes

    if (values.length < 2) {
      errors.push({ row, error: 'Insufficient columns. Need at least First Name and Last Name.' });
      return;
    }

    let firstName, lastName, phoneNumber, email, password, role;

    if (headers) {
      // Map by headers
      const headerMap = {};
      headers.forEach((h, i) => {
        headerMap[h] = values[i] || '';
      });

      firstName = headerMap['first name'] || headerMap['firstname'] || headerMap['first_name'] || values[0] || '';
      lastName = headerMap['last name'] || headerMap['lastname'] || headerMap['last_name'] || values[1] || '';
      phoneNumber = headerMap['phone'] || headerMap['phone number'] || headerMap['phone_number'] || headerMap['mobile'] || '';
      email = headerMap['email'] || '';
      password = headerMap['password'] || '';
      role = headerMap['role'] || '';
    } else {
      // Assume order: firstName, lastName, phoneNumber, email, password, role (optional)
      firstName = values[0] || '';
      lastName = values[1] || '';
      phoneNumber = values[2] || '';
      email = values[3] || '';
      password = values[4] || '';
      role = values[5] || '';
    }

    if (!firstName || !lastName) {
      errors.push({ row, error: 'First name and last name are required' });
      return;
    }

    const userObj = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim() || null,
      email: email.trim() || null,
      password: password.trim() || null
    };
    
    // Add role if provided
    if (role && role.trim()) {
      userObj.role = role.trim();
    }
    
    users.push(userObj);
  });

  return { users, errors };
}

/**
 * Validate user data
 */
function validateUser(user, index) {
  const errors = [];
  
  if (!user.firstName || !user.firstName.trim()) {
    errors.push('First name is required');
  }
  
  if (!user.lastName || !user.lastName.trim()) {
    errors.push('Last name is required');
  }
  
  if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    errors.push('Invalid email format');
  }
  
  if (user.password && user.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  
  return errors;
}

function BulkImport({ 
  endpoint, 
  onImportComplete, 
  userType = 'users',
  maxUsers = 100,
  showRoleField = false,
  defaultRole = 'supervisor',
  roleOptions = []
}) {
  // Generate unique storage key based on endpoint
  const storageKey = `bulkImport_${endpoint.replace(/\//g, '_')}`;
  
  // Check if localStorage is available
  const isLocalStorageAvailable = (() => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  })();
  
  // Initialize state - try to load from localStorage
  const [inputText, setInputText] = useState('');
  
  const [parsedUsers, setParsedUsers] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  
  // Import options
  const [generateEmails, setGenerateEmails] = useState(false);
  const [emailDomain, setEmailDomain] = useState('');
  const [generatePasswords, setGeneratePasswords] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [selectedRole, setSelectedRole] = useState(defaultRole);

  // Load from localStorage on mount
  useEffect(() => {
    if (!isLocalStorageAvailable) {
      console.warn('LocalStorage is not available. Data will not be saved.');
      return;
    }
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null && saved !== '') {
        setInputText(saved);
        console.log(`[BulkImport] Loaded ${saved.length} characters from localStorage (key: ${storageKey})`);
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }, [storageKey, isLocalStorageAvailable]);

  // Save to localStorage immediately when input changes
  const saveToLocalStorage = (value) => {
    if (!isLocalStorageAvailable) {
      return; // Silently fail if localStorage is not available
    }
    
    try {
      if (value !== undefined && value !== null) {
        localStorage.setItem(storageKey, value);
        // Verify it was saved
        const verified = localStorage.getItem(storageKey);
        if (verified === value) {
          // Success
        } else {
          console.warn('LocalStorage save verification failed');
        }
      }
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      // If storage is full, try to clear old data
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        console.warn('LocalStorage quota exceeded, clearing old import data');
        try {
          // Clear all bulk import keys except current
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('bulkImport_') && key !== storageKey) {
              localStorage.removeItem(key);
            }
          });
          // Try again
          localStorage.setItem(storageKey, value);
          console.log('Successfully saved after cleanup');
        } catch (retryError) {
          console.error('Failed to save after cleanup:', retryError);
          alert('Unable to save data. Your browser\'s storage may be full. Please clear some space and try again.');
        }
      } else {
        // Other errors (like disabled localStorage)
        console.error('LocalStorage error:', error);
      }
    }
  };

  // Handle input change - save immediately
  const handleInputChange = (value) => {
    setInputText(value);
    saveToLocalStorage(value);
  };

  const handleParse = () => {
    const { users, errors } = parseImportData(inputText);
    
    // Validate each user
    const valErrors = {};
    users.forEach((user, index) => {
      const errors = validateUser(user, index);
      if (errors.length > 0) {
        valErrors[index] = errors;
      }
    });
    
    setParsedUsers(users);
    setParseErrors(errors);
    setValidationErrors(valErrors);
    setShowPreview(true);
    setImportResults(null);
  };

  const handleImport = async () => {
    if (parsedUsers.length === 0) {
      alert('No users to import');
      return;
    }

    if (parsedUsers.length > maxUsers) {
      alert(`Maximum ${maxUsers} users per import`);
      return;
    }

    if (generateEmails && !emailDomain) {
      alert('Email domain is required when generating emails');
      return;
    }

    setIsImporting(true);
    setImportResults(null);

    const requestOptions = {
      generateEmails,
      emailDomain: generateEmails ? emailDomain : null,
      generatePasswords,
      skipDuplicates
    };
    
    // Add defaultRole if showRoleField is enabled
    if (showRoleField && selectedRole) {
      requestOptions.defaultRole = selectedRole;
    }
    
    try {
      const response = await apiClient.post(endpoint, {
        users: parsedUsers,
        options: requestOptions
      });

      setImportResults(response.data);
      
      if (response.data.created > 0) {
        handleImportSuccess();
        if (onImportComplete) {
          onImportComplete();
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(error.response?.data?.error || 'Failed to import users');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setInputText('');
    setParsedUsers([]);
    setParseErrors([]);
    setValidationErrors({});
    setShowPreview(false);
    setImportResults(null);
    setGenerateEmails(false);
    setEmailDomain('');
    setGeneratePasswords(true);
    // Clear localStorage
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  };
  
  const handleImportSuccess = () => {
    // Clear localStorage after successful import
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
    setInputText('');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Bulk Import {userType}</h3>
        <InfoTooltip description={`Import multiple ${userType} at once by pasting data from Excel or CSV. Format: First Name, Last Name, Phone (optional), Email (optional), Password (optional).`} />
      </div>

      {!showPreview && !importResults && (
        <>
          <div className="space-y-4">
            {/* Format Example - Collapsible and Compact */}
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors touch-manipulation">
                  <span className="text-xs sm:text-sm font-medium text-blue-900 flex items-center gap-1.5 sm:gap-2">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 group-open:rotate-90 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="truncate">Format Guide</span>
                  </span>
                  <span className="text-[10px] sm:text-xs text-blue-600 hidden sm:inline shrink-0 ml-2">Click to expand</span>
                </div>
              </summary>
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 sm:p-3">
                <div className="space-y-2">
                  <div className="bg-white border border-gray-300 rounded p-2 sm:p-2.5 font-mono text-[10px] sm:text-xs text-gray-700">
                    <div className="space-y-1.5">
                      <div>
                        <span className="text-gray-500 text-[9px] sm:text-[10px] block mb-0.5">Headers (optional):</span>
                        <div className="text-gray-900 break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word' }}>
                          First Name,Last Name,Phone,Email,Password{showRoleField ? ',Role' : ''}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[9px] sm:text-[10px] block mb-0.5">Example rows:</span>
                        <div className="text-gray-900 space-y-0.5 break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word' }}>
                          <div>John,Doe,+1234567890,john@example.com,Pass123{showRoleField ? ',supervisor' : ''}</div>
                          <div>Jane,Smith,+1987654321,jane@example.com,Pass123{showRoleField ? ',hr' : ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-600 leading-relaxed break-words">
                    <strong>Note:</strong> Phone, Email, and Password are optional. Empty fields will be auto-generated if enabled below.
                  </p>
                </div>
              </div>
            </details>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste your data here (comma-separated only)
              </label>
              <textarea
                value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                placeholder={
                  showRoleField
                    ? "First Name,Last Name,Phone,Email,Password,Role\nJohn,Doe,+1234567890,john@example.com,Password123,supervisor\nJane,Smith,+1987654321,jane@example.com,Password123,hr"
                    : "First Name,Last Name,Phone,Email,Password\nJohn,Doe,+1234567890,john@example.com,Password123\nJane,Smith,+1987654321,jane@example.com,Password123"
                }
                rows={8}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-md border border-gray-300 bg-white text-gray-900 font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-y break-words overflow-wrap-anywhere"
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              />
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                <p className="text-[10px] sm:text-xs text-gray-500 break-words">
                  {isLocalStorageAvailable 
                    ? 'Data is automatically saved. First row can be headers (optional).'
                    : '⚠️ LocalStorage unavailable - data will not be saved between sessions.'
                  }
                </p>
                {inputText && inputText.trim() && isLocalStorageAvailable && (
                  <span className="text-[10px] sm:text-xs text-green-600 flex items-center gap-1 shrink-0">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Saved
                  </span>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Import Options</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generatePasswords}
                    onChange={(e) => setGeneratePasswords(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm text-gray-700">Auto-generate passwords (if not provided)</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generateEmails}
                    onChange={(e) => setGenerateEmails(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm text-gray-700">Auto-generate emails (if not provided)</span>
                </label>
                
                {generateEmails && (
                  <div className="ml-6">
                    <input
                      type="text"
                      value={emailDomain}
                      onChange={(e) => setEmailDomain(e.target.value)}
                      placeholder="e.g., school.org"
                      className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <p className="mt-1 text-xs text-gray-500">Email domain for generated emails</p>
                  </div>
                )}
                
                <label className="flex items-start sm:items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="mt-0.5 sm:mt-0 rounded border-gray-300 text-blue-600 focus:ring-blue-600 shrink-0"
                  />
                  <span className="text-xs sm:text-sm text-gray-700 break-words">Skip duplicate emails</span>
                </label>
                
                {showRoleField && roleOptions.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">
                      Default Role (if not specified in data):
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {roleOptions.map(roleOption => (
                        <option key={roleOption.value} value={roleOption.value}>
                          {roleOption.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] sm:text-xs text-gray-500 break-words">
                      Role can also be specified in the data as the last column
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleParse}
              disabled={!inputText.trim()}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              Parse & Preview
            </button>
          </div>
        </>
      )}

      {showPreview && !importResults && (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">
                Preview ({parsedUsers.length} {userType})
              </h4>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setImportResults(null);
                  // Keep inputText in state and localStorage, so data persists
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to Input
              </button>
            </div>
            
            {parseErrors.length > 0 && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-900 mb-1">Parse Errors:</p>
                <ul className="text-xs text-red-700 list-disc list-inside">
                  {parseErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>Row {err.row}: {err.error}</li>
                  ))}
                  {parseErrors.length > 5 && <li>... and {parseErrors.length - 5} more</li>}
                </ul>
              </div>
            )}

            <div className="max-h-96 overflow-auto border border-gray-200 rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">#</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">First Name</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">Last Name</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell">Phone</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 break-words min-w-[120px]">Email</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap hidden md:table-cell">Password</th>
                      {showRoleField && (
                        <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">Role</th>
                      )}
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedUsers.map((user, index) => {
                      const errors = validationErrors[index] || [];
                      const hasErrors = errors.length > 0;
                      
                      return (
                        <tr key={index} className={hasErrors ? 'bg-red-50' : ''}>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-900 whitespace-nowrap">{index + 1}</td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-900 break-words max-w-[100px] sm:max-w-none">{user.firstName}</td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-900 break-words max-w-[100px] sm:max-w-none">{user.lastName}</td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 whitespace-nowrap hidden sm:table-cell">{user.phoneNumber || '-'}</td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 break-words overflow-wrap-anywhere max-w-[150px] sm:max-w-none" style={{ wordBreak: 'break-word' }}>
                            {user.email || (generateEmails ? `(will generate)` : '⚠ Missing')}
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 whitespace-nowrap hidden md:table-cell">
                            {user.password ? '••••••' : (generatePasswords ? `(will generate)` : '⚠ Missing')}
                          </td>
                          {showRoleField && (
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 whitespace-nowrap text-[10px] sm:text-xs">
                              {user.role || selectedRole || '-'}
                            </td>
                          )}
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                            {hasErrors ? (
                              <span className="text-[10px] sm:text-xs text-red-600" title={errors.join(', ')}>
                                ⚠ <span className="hidden sm:inline">{errors[0]}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] sm:text-xs text-green-600">✓ <span className="hidden sm:inline">Valid</span></span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || Object.keys(validationErrors).length > 0 || parsedUsers.length === 0}
              className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <>
                  <Spinner /> <span>Importing...</span>
                </>
              ) : (
                `Import ${parsedUsers.length} ${userType}`
              )}
            </button>
          </div>
        </>
      )}

      {importResults && (
        <>
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Import Results</h4>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-2xl font-bold text-green-900">{importResults.created}</p>
                <p className="text-sm text-green-700">Created</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-2xl font-bold text-yellow-900">{importResults.skipped}</p>
                <p className="text-sm text-yellow-700">Skipped</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-2xl font-bold text-gray-900">{importResults.total}</p>
                <p className="text-sm text-gray-700">Total</p>
              </div>
            </div>

            {importResults.errors && importResults.errors.length > 0 && (
              <div className="mb-4">
                <details className="border border-red-200 rounded-md">
                  <summary className="px-4 py-2 bg-red-50 text-red-900 font-medium cursor-pointer">
                    Errors ({importResults.errors.length})
                  </summary>
                  <div className="p-4 max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left px-2 py-1">Row</th>
                          <th className="text-left px-2 py-1">Email</th>
                          <th className="text-left px-2 py-1">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.errors.map((err, i) => (
                          <tr key={i} className="border-b">
                            <td className="px-2 py-1">{err.row}</td>
                            <td className="px-2 py-1">{err.email}</td>
                            <td className="px-2 py-1 text-red-600">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}

            {importResults.createdUsers && importResults.createdUsers.length > 0 && (
              <div className="mb-4">
                <details className="border border-green-200 rounded-md">
                  <summary className="px-4 py-2 bg-green-50 text-green-900 font-medium cursor-pointer">
                    Created Users ({importResults.createdUsers.length})
                  </summary>
                  <div className="p-4 max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left px-2 py-1">Email</th>
                          <th className="text-left px-2 py-1">Name</th>
                          {importResults.createdUsers.some(u => u.password) && (
                            <th className="text-left px-2 py-1">Password</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.createdUsers.map((user, i) => (
                          <tr key={i} className="border-b">
                            <td className="px-2 py-1">{user.email}</td>
                            <td className="px-2 py-1">{user.firstName} {user.lastName}</td>
                            {user.password && (
                              <td className="px-2 py-1 font-mono text-xs">{user.password}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-3 font-medium"
            >
              Clear & Start New
            </button>
            <button
              onClick={() => {
                setShowPreview(false);
                setImportResults(null);
              }}
              className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium"
            >
              Import More
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default BulkImport;

