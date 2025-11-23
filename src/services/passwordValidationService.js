/**
 * Password Validation Service
 * Issue #154: Extract password validation to a reusable service
 *
 * This service provides comprehensive password validation functionality
 * that can be reused across different endpoints including:
 * - User registration
 * - Password changes
 * - Account deletion verification
 * - Email changes
 * - Security revalidations
 */

const bcrypt = require('bcryptjs');
const {
  validatePassword: validatePasswordStrength,
  getPasswordStrength
} = require('../utils/passwordValidator');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class PasswordValidationService {
  constructor() {
    this.saltRounds = 12; // Higher salt rounds for enhanced security
    this.maxFailedAttempts = 5; // Track failed validation attempts
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes lockout
  }

  /**
   * Validate password strength and format
   * @param {string} password - The password to validate
   * @returns {Object} - Validation result with isValid, errors, and strength score
   */
  validatePasswordStrength(password) {
    try {
      const validation = validatePasswordStrength(password);
      const strength = getPasswordStrength(password);

      return {
        isValid: validation.isValid,
        errors: validation.errors,
        strength,
        details: {
          hasMinLength: password?.length >= 8,
          hasNumber: /\d/.test(password || ''),
          hasLowercase: /[a-z]/.test(password || ''),
          hasUppercase: /[A-Z]/.test(password || ''),
          hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password || ''),
          noSpaces: !/\s/.test(password || ''),
          length: password?.length || 0
        }
      };
    } catch (error) {
      logger.error('Password strength validation error:', {
        error: error.message,
        hasPassword: !!password
      });
      return {
        isValid: false,
        errors: ['Error validating password strength'],
        strength: 0,
        details: {}
      };
    }
  }

  /**
   * Verify password against stored hash
   * @param {string} plainPassword - The plain text password
   * @param {string} hashedPassword - The stored password hash
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      if (!plainPassword || !hashedPassword) {
        return false;
      }

      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      logger.error('Password verification error:', {
        error: error.message,
        hasPlainPassword: !!plainPassword,
        hasHashedPassword: !!hashedPassword
      });
      return false;
    }
  }

  /**
   * Hash password with salt
   * @param {string} plainPassword - The plain text password to hash
   * @returns {Promise<string>} - The hashed password
   */
  async hashPassword(plainPassword) {
    try {
      if (!plainPassword || typeof plainPassword !== 'string') {
        throw new Error('Invalid password provided for hashing');
      }

      return await bcrypt.hash(plainPassword, this.saltRounds);
    } catch (error) {
      logger.error('Password hashing error:', {
        error: error.message,
        hasPassword: !!plainPassword
      });
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Validate password for account deletion or sensitive operations
   * @param {string} userId - User ID for logging
   * @param {string} providedPassword - Password provided by user
   * @param {string} storedPasswordHash - Stored password hash from database
   * @param {string} operation - The operation being performed (for logging)
   * @returns {Promise<Object>} - Validation result with success status and details
   */
  async validatePasswordForSensitiveOperation(
    userId,
    providedPassword,
    storedPasswordHash,
    operation = 'sensitive_operation'
  ) {
    const validationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('Password validation attempt for sensitive operation:', {
        userId: userId?.substr(0, 8) + '...' || 'unknown',
        operation,
        validationId,
        hasPassword: !!providedPassword,
        hasStoredHash: !!storedPasswordHash
      });

      // Basic input validation
      if (!providedPassword || typeof providedPassword !== 'string') {
        logger.warn('Password validation failed - invalid input:', {
          userId: userId?.substr(0, 8) + '...' || 'unknown',
          operation,
          validationId,
          reason: 'invalid_password_input'
        });

        return {
          success: false,
          error: 'Invalid password provided',
          code: 'INVALID_INPUT',
          validationId
        };
      }

      if (!storedPasswordHash) {
        logger.warn('Password validation failed - no stored hash:', {
          userId: userId?.substr(0, 8) + '...' || 'unknown',
          operation,
          validationId,
          reason: 'no_stored_hash'
        });

        return {
          success: false,
          error: 'Unable to verify password',
          code: 'NO_STORED_HASH',
          validationId
        };
      }

      // Verify password
      const isValid = await this.verifyPassword(providedPassword, storedPasswordHash);

      if (isValid) {
        logger.info('Password validation successful:', {
          userId: userId?.substr(0, 8) + '...' || 'unknown',
          operation,
          validationId,
          result: 'success'
        });

        return {
          success: true,
          validationId
        };
      } else {
        logger.warn('Password validation failed - incorrect password:', {
          userId: userId?.substr(0, 8) + '...' || 'unknown',
          operation,
          validationId,
          reason: 'incorrect_password'
        });

        return {
          success: false,
          error: 'Incorrect password',
          code: 'INCORRECT_PASSWORD',
          validationId
        };
      }
    } catch (error) {
      logger.error('Password validation error for sensitive operation:', {
        userId: userId?.substr(0, 8) + '...' || 'unknown',
        operation,
        validationId,
        error: error.message
      });

      return {
        success: false,
        error: 'Password validation failed',
        code: 'VALIDATION_ERROR',
        validationId,
        details: error.message
      };
    }
  }

  /**
   * Validate password change request
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} confirmPassword - Password confirmation
   * @param {string} storedPasswordHash - Current password hash from database
   * @returns {Promise<Object>} - Validation result
   */
  async validatePasswordChange(
    userId,
    currentPassword,
    newPassword,
    confirmPassword,
    storedPasswordHash
  ) {
    const validationId = `pwd_change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('Password change validation started:', {
        userId: userId?.substr(0, 8) + '...' || 'unknown',
        validationId
      });

      // Validate current password
      const currentPasswordValidation = await this.validatePasswordForSensitiveOperation(
        userId,
        currentPassword,
        storedPasswordHash,
        'password_change'
      );

      if (!currentPasswordValidation.success) {
        return {
          success: false,
          error: 'Current password is incorrect',
          code: 'CURRENT_PASSWORD_INVALID',
          validationId
        };
      }

      // Validate new password confirmation
      if (newPassword !== confirmPassword) {
        logger.warn('Password change validation failed - passwords do not match:', {
          userId: userId?.substr(0, 8) + '...' || 'unknown',
          validationId
        });

        return {
          success: false,
          error: 'New passwords do not match',
          code: 'PASSWORD_MISMATCH',
          validationId
        };
      }

      // Validate new password strength
      const strengthValidation = this.validatePasswordStrength(newPassword);
      if (!strengthValidation.isValid) {
        logger.warn('Password change validation failed - weak password:', {
          userId: userId?.substr(0, 8) + '...' || 'unknown',
          validationId,
          errors: strengthValidation.errors
        });

        return {
          success: false,
          error: 'New password does not meet security requirements',
          code: 'WEAK_PASSWORD',
          validationId,
          details: strengthValidation.errors
        };
      }

      // Check if new password is the same as current password
      const isSamePassword = await this.verifyPassword(newPassword, storedPasswordHash);
      if (isSamePassword) {
        logger.warn('Password change validation failed - same password:', {
          userId: userId?.substr(0, 8) + '...' || 'unknown',
          validationId
        });

        return {
          success: false,
          error: 'New password must be different from current password',
          code: 'SAME_PASSWORD',
          validationId
        };
      }

      logger.info('Password change validation successful:', {
        userId: userId?.substr(0, 8) + '...' || 'unknown',
        validationId,
        strengthScore: strengthValidation.strength
      });

      return {
        success: true,
        validationId,
        strengthScore: strengthValidation.strength
      };
    } catch (error) {
      logger.error('Password change validation error:', {
        userId: userId?.substr(0, 8) + '...' || 'unknown',
        validationId,
        error: error.message
      });

      return {
        success: false,
        error: 'Password validation failed',
        code: 'VALIDATION_ERROR',
        validationId,
        details: error.message
      };
    }
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 12)
   * @param {Object} options - Password generation options
   * @returns {string} - Generated password
   */
  generateSecurePassword(length = 12, options = {}) {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeAmbiguous: true
    };

    const settings = { ...defaults, ...options };

    let charset = '';
    if (settings.includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (settings.includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (settings.includeNumbers) charset += '0123456789';
    if (settings.includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (settings.excludeAmbiguous) {
      charset = charset.replace(/[0O1lI|]/g, '');
    }

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
  }

  /**
   * Check if password validation is enabled
   * @returns {boolean} - True if validation is enabled
   */
  isValidationEnabled() {
    return flags.isEnabled('ENABLE_PASSWORD_VALIDATION');
  }

  /**
   * Get password requirements for client-side display
   * @returns {Object} - Password requirements
   */
  getPasswordRequirements() {
    return {
      minLength: 8,
      requireNumber: true,
      requireLowercase: true,
      requireUppercaseOrSymbol: true,
      noSpaces: true,
      strengthLevels: {
        0: 'Very Weak',
        1: 'Weak',
        2: 'Fair',
        3: 'Good',
        4: 'Strong'
      }
    };
  }
}

// Export singleton instance
module.exports = new PasswordValidationService();
