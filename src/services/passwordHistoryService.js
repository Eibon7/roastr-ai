/**
 * Password History Service
 * Tracks password history to prevent reuse of recent passwords
 * This is an optional security feature that can be enabled/disabled
 */

const bcrypt = require('bcrypt');
const { flags } = require('../config/flags');
const { logger } = require('../utils/logger');

// In a real implementation, this would use a database table
// For now, using in-memory storage with fallback to disabled functionality
const passwordHistory = new Map(); // userId -> [{ hash, createdAt }]

// Configuration getter function to read current env vars
function getConfig() {
  return {
    // Number of previous passwords to remember (0 = disabled)
    rememberCount: process.env.PASSWORD_HISTORY_COUNT ? parseInt(process.env.PASSWORD_HISTORY_COUNT) : 5,
    // How long to keep password history (in days)
    retentionDays: process.env.PASSWORD_HISTORY_RETENTION_DAYS ? parseInt(process.env.PASSWORD_HISTORY_RETENTION_DAYS) : 365,
    // Enable/disable feature
    enabled: process.env.ENABLE_PASSWORD_HISTORY === 'true'
  };
}

/**
 * Check if password history is enabled
 * @returns {boolean}
 */
function isPasswordHistoryEnabled() {
  const config = getConfig();
  return config.enabled && config.rememberCount > 0;
}

/**
 * Check if a password has been used recently
 * @param {string} userId - User ID
 * @param {string} plainPassword - Password to check
 * @returns {Promise<boolean>} - True if password was used recently
 */
async function isPasswordReused(userId, plainPassword) {
  if (!isPasswordHistoryEnabled()) {
    return false; // Feature disabled, allow any password
  }

  try {
    const userHistory = passwordHistory.get(userId) || [];
    
    // Check against each stored password hash
    for (const historyEntry of userHistory) {
      const isMatch = await bcrypt.compare(plainPassword, historyEntry.hash);
      if (isMatch) {
        logger.info('Password reuse detected:', { userId, historyEntryDate: historyEntry.createdAt });
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking password history:', { userId, error: error.message });
    // On error, default to allowing the password (fail open for availability)
    return false;
  }
}

/**
 * Add a password to the history
 * @param {string} userId - User ID
 * @param {string} plainPassword - Password to add to history
 * @returns {Promise<void>}
 */
async function addPasswordToHistory(userId, plainPassword) {
  if (!isPasswordHistoryEnabled()) {
    return; // Feature disabled, do nothing
  }

  try {
    const config = getConfig();
    
    // Hash the password before storing
    const saltRounds = 10;
    const hash = await bcrypt.hash(plainPassword, saltRounds);
    
    // Get current history
    let userHistory = passwordHistory.get(userId) || [];
    
    // Add new password to beginning of array
    userHistory.unshift({
      hash: hash,
      createdAt: new Date().toISOString()
    });
    
    // Limit to configured count
    if (userHistory.length > config.rememberCount) {
      userHistory = userHistory.slice(0, config.rememberCount);
    }
    
    // Clean old entries based on retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
    
    userHistory = userHistory.filter(entry => 
      new Date(entry.createdAt) > cutoffDate
    );
    
    // Store updated history
    passwordHistory.set(userId, userHistory);
    
    logger.info('Password added to history:', { 
      userId, 
      historyCount: userHistory.length,
      maxCount: config.rememberCount 
    });
    
  } catch (error) {
    logger.error('Error adding password to history:', { userId, error: error.message });
    // Don't throw - password change should still succeed even if history fails
  }
}

/**
 * Clear password history for a user (useful for account deletion)
 * @param {string} userId - User ID
 */
function clearPasswordHistory(userId) {
  passwordHistory.delete(userId);
  logger.info('Password history cleared:', { userId });
}

/**
 * Get password history stats for a user (admin use)
 * @param {string} userId - User ID
 * @returns {Object} - History stats
 */
function getPasswordHistoryStats(userId) {
  if (!isPasswordHistoryEnabled()) {
    return {
      enabled: false,
      count: 0,
      maxCount: 0,
      retentionDays: 0
    };
  }

  const config = getConfig();
  const userHistory = passwordHistory.get(userId) || [];
  
  return {
    enabled: true,
    count: userHistory.length,
    maxCount: config.rememberCount,
    retentionDays: config.retentionDays,
    oldestEntry: userHistory.length > 0 ? userHistory[userHistory.length - 1].createdAt : null,
    newestEntry: userHistory.length > 0 ? userHistory[0].createdAt : null
  };
}

/**
 * Get system-wide password history configuration
 * @returns {Object} - Configuration object
 */
function getPasswordHistoryConfig() {
  return {
    ...getConfig(),
    totalUsers: passwordHistory.size,
    totalEntries: Array.from(passwordHistory.values()).reduce((sum, history) => sum + history.length, 0)
  };
}

/**
 * Cleanup old password history entries (maintenance function)
 */
function cleanupPasswordHistory() {
  if (!isPasswordHistoryEnabled()) {
    return;
  }

  const config = getConfig();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
  
  let cleanedUsers = 0;
  let cleanedEntries = 0;

  for (const [userId, userHistory] of passwordHistory.entries()) {
    const originalCount = userHistory.length;
    const filteredHistory = userHistory.filter(entry => 
      new Date(entry.createdAt) > cutoffDate
    );
    
    if (filteredHistory.length !== originalCount) {
      if (filteredHistory.length === 0) {
        passwordHistory.delete(userId);
      } else {
        passwordHistory.set(userId, filteredHistory);
      }
      cleanedUsers++;
      cleanedEntries += (originalCount - filteredHistory.length);
    }
  }

  if (cleanedUsers > 0) {
    logger.info('Password history cleanup completed:', {
      cleanedUsers,
      cleanedEntries,
      remainingUsers: passwordHistory.size
    });
  }
}

// Run cleanup every 24 hours in production
if (process.env.NODE_ENV === 'production') {
  setInterval(cleanupPasswordHistory, 24 * 60 * 60 * 1000);
}

module.exports = {
  isPasswordHistoryEnabled,
  isPasswordReused,
  addPasswordToHistory,
  clearPasswordHistory,
  getPasswordHistoryStats,
  getPasswordHistoryConfig,
  cleanupPasswordHistory,
  getConfig
};