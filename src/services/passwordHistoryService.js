/**
 * Password History Service (Issue #133)
 * Manages password history to prevent reuse of recent passwords
 */

const bcrypt = require('bcrypt');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const { logger } = require('../utils/logger');

class PasswordHistoryService {
  constructor() {
    // Configuration
    this.PASSWORD_HISTORY_LIMIT = 5; // Remember last 5 passwords
    this.SALT_ROUNDS = 12; // bcrypt salt rounds for password history hashing
  }

  /**
   * Check if a password has been used recently by the user
   * @param {string} userId - User ID from Supabase Auth
   * @param {string} newPassword - Plain text password to check
   * @returns {Promise<boolean>} - True if password was used recently
   */
  async isPasswordRecentlyUsed(userId, newPassword) {
    if (!flags.isEnabled('ENABLE_PASSWORD_HISTORY')) {
      return false; // Feature disabled
    }

    try {
      // Get recent password history for user
      const { data: passwordHistory, error } = await supabaseServiceClient
        .from('password_history')
        .select('password_hash')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(this.PASSWORD_HISTORY_LIMIT);

      if (error) {
        logger.error('Error checking password history:', error);
        return false; // Fail open for user experience
      }

      if (!passwordHistory || passwordHistory.length === 0) {
        return false; // No history yet
      }

      // Check if new password matches any recent password
      for (const historyEntry of passwordHistory) {
        const isMatch = await bcrypt.compare(newPassword, historyEntry.password_hash);
        if (isMatch) {
          logger.info('Password reuse detected', { userId, historyCount: passwordHistory.length });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error in isPasswordRecentlyUsed:', error);
      return false; // Fail open
    }
  }

  /**
   * Add a password to user's history
   * @param {string} userId - User ID from Supabase Auth
   * @param {string} password - Plain text password to add to history
   * @returns {Promise<boolean>} - Success status
   */
  async addToPasswordHistory(userId, password) {
    if (!flags.isEnabled('ENABLE_PASSWORD_HISTORY')) {
      return true; // Feature disabled, pretend success
    }

    try {
      // Hash the password for storage
      const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

      // Add to password history
      const { error: insertError } = await supabaseServiceClient
        .from('password_history')
        .insert({
          user_id: userId,
          password_hash: passwordHash
        });

      if (insertError) {
        logger.error('Error adding password to history:', insertError);
        return false;
      }

      // Clean up old password history (keep only recent ones)
      await this.cleanupOldPasswords(userId);

      logger.info('Password added to history', { userId });
      return true;
    } catch (error) {
      logger.error('Error in addToPasswordHistory:', error);
      return false;
    }
  }

  /**
   * Clean up old passwords beyond the limit
   * @param {string} userId - User ID from Supabase Auth
   * @returns {Promise<void>}
   */
  async cleanupOldPasswords(userId) {
    try {
      // Get all password history entries for user, ordered by creation date
      const { data: allPasswords, error: fetchError } = await supabaseServiceClient
        .from('password_history')
        .select('id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        logger.error('Error fetching passwords for cleanup:', fetchError);
        return;
      }

      // If we have more than the limit, delete the oldest ones
      if (allPasswords.length > this.PASSWORD_HISTORY_LIMIT) {
        const passwordsToDelete = allPasswords.slice(this.PASSWORD_HISTORY_LIMIT);
        const idsToDelete = passwordsToDelete.map(p => p.id);

        const { error: deleteError } = await supabaseServiceClient
          .from('password_history')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          logger.error('Error deleting old passwords:', deleteError);
        } else {
          logger.info('Cleaned up old password history', { 
            userId, 
            deletedCount: idsToDelete.length 
          });
        }
      }
    } catch (error) {
      logger.error('Error in cleanupOldPasswords:', error);
    }
  }

  /**
   * Clear all password history for a user (for account deletion)
   * @param {string} userId - User ID from Supabase Auth
   * @returns {Promise<boolean>} - Success status
   */
  async clearPasswordHistory(userId) {
    try {
      const { error } = await supabaseServiceClient
        .from('password_history')
        .delete()
        .eq('user_id', userId);

      if (error) {
        logger.error('Error clearing password history:', error);
        return false;
      }

      logger.info('Cleared password history for user', { userId });
      return true;
    } catch (error) {
      logger.error('Error in clearPasswordHistory:', error);
      return false;
    }
  }

  /**
   * Get password history statistics for a user
   * @param {string} userId - User ID from Supabase Auth
   * @returns {Promise<Object>} - Statistics object
   */
  async getPasswordHistoryStats(userId) {
    try {
      const { data: passwordHistory, error } = await supabaseServiceClient
        .from('password_history')
        .select('id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting password history stats:', error);
        return { count: 0, oldestPasswordDate: null, newestPasswordDate: null };
      }

      return {
        count: passwordHistory.length,
        oldestPasswordDate: passwordHistory.length > 0 ? passwordHistory[passwordHistory.length - 1].created_at : null,
        newestPasswordDate: passwordHistory.length > 0 ? passwordHistory[0].created_at : null,
        historyLimit: this.PASSWORD_HISTORY_LIMIT
      };
    } catch (error) {
      logger.error('Error in getPasswordHistoryStats:', error);
      return { count: 0, oldestPasswordDate: null, newestPasswordDate: null };
    }
  }
}

module.exports = new PasswordHistoryService();