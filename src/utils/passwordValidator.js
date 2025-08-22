/**
 * Backend password validation utilities
 * Ensures password meets security requirements
 */

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireNumber: true,
  requireLowercase: true,
  requireUppercaseOrSymbol: true,
  noSpaces: true,
};

/**
 * Validate password against security requirements
 * @param {string} password - The password to validate
 * @returns {Object} - Validation result with isValid and errors array
 */
const validatePassword = (password) => {
  const errors = [];
  
  if (!password) {
    errors.push('La contraseña es requerida');
    return { isValid: false, errors };
  }

  // Check minimum length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`La contraseña debe tener al menos ${PASSWORD_REQUIREMENTS.minLength} caracteres`);
  }

  // Check for spaces
  if (PASSWORD_REQUIREMENTS.noSpaces && /\s/.test(password)) {
    errors.push('La contraseña no puede contener espacios');
  }

  // Check for at least one number
  if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }

  // Check for at least one lowercase letter
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
  }

  // Check for at least one uppercase letter OR one symbol
  if (PASSWORD_REQUIREMENTS.requireUppercaseOrSymbol) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    
    if (!hasUppercase && !hasSymbol) {
      errors.push('La contraseña debe contener al menos una letra mayúscula o un símbolo');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Get password strength score (0-4)
 * @param {string} password - The password to evaluate
 * @returns {number} - Strength score from 0 (very weak) to 4 (very strong)
 */
const getPasswordStrength = (password) => {
  if (!password) return 0;
  
  let strength = 0;
  
  // Length checks
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  
  // Complexity checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) strength++;
  
  // Cap at 4
  return Math.min(strength, 4);
};

module.exports = {
  validatePassword,
  getPasswordStrength,
  PASSWORD_REQUIREMENTS,
};