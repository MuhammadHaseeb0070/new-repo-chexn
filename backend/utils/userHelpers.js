// Utility functions for user creation and bulk import

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 12)
 * @returns {string} Generated password
 */
function generatePassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate a human-readable email from name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} domain - Email domain (e.g., 'school.org')
 * @param {number} suffix - Suffix for duplicates (optional)
 * @returns {string} Generated email
 */
function generateEmail(firstName, lastName, domain, suffix = null) {
  // Normalize names: lowercase, remove special chars, replace spaces with dots
  const normalize = (str) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20); // Limit length
  };
  
  const first = normalize(firstName || 'user');
  const last = normalize(lastName || '');
  
  let email = last ? `${first}.${last}` : first;
  
  // Add suffix if provided (for duplicates)
  if (suffix !== null && suffix > 0) {
    email += `.${suffix + 1}`;
  }
  
  return `${email}@${domain}`;
}

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number in any format
 * @returns {string|null} Normalized phone number or null if invalid
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with +, keep it, otherwise assume it needs country code
  if (!cleaned.startsWith('+')) {
    // If starts with 0, remove it (common in some countries)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    // Default to +1 (US) if no country code - adjust based on your needs
    // For now, just add + if missing
    cleaned = '+' + cleaned;
  }
  
  // Basic validation: should be 10-15 digits after +
  const digits = cleaned.replace('+', '');
  if (digits.length < 10 || digits.length > 15) {
    return null; // Invalid length
  }
  
  return cleaned;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, error: string }
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  
  return { valid: true, error: null };
}

module.exports = {
  generatePassword,
  generateEmail,
  normalizePhoneNumber,
  isValidEmail,
  validatePassword
};

