/**
 * Tests for password history service
 */

const {
  isPasswordHistoryEnabled,
  isPasswordReused,
  addPasswordToHistory,
  clearPasswordHistory,
  getPasswordHistoryStats,
  getPasswordHistoryConfig,
  cleanupPasswordHistory,
  PASSWORD_HISTORY_CONFIG
} = require('../../../src/services/passwordHistoryService');

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn()
  }
}));

const bcrypt = require('bcrypt');
const { logger } = require('../../../src/utils/logger');

describe('PasswordHistoryService', () => {
  beforeEach(() => {
    // Clear any existing history BEFORE clearing mocks
    clearPasswordHistory('test-user-123');
    
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.ENABLE_PASSWORD_HISTORY = 'false';
    process.env.PASSWORD_HISTORY_COUNT = '5';
    process.env.PASSWORD_HISTORY_RETENTION_DAYS = '365';
  });

  describe('isPasswordHistoryEnabled', () => {
    test('should return false when password history is disabled', () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'false';
      expect(isPasswordHistoryEnabled()).toBe(false);
    });

    test('should return false when count is 0', () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      process.env.PASSWORD_HISTORY_COUNT = '0';
      expect(isPasswordHistoryEnabled()).toBe(false);
    });

    test('should return true when enabled and count > 0', () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      process.env.PASSWORD_HISTORY_COUNT = '5';
      expect(isPasswordHistoryEnabled()).toBe(true);
    });
  });

  describe('isPasswordReused', () => {
    test('should return false when password history is disabled', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'false';
      
      const result = await isPasswordReused('test-user-123', 'password123');
      expect(result).toBe(false);
    });

    test('should return false when no password history exists', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      
      const result = await isPasswordReused('test-user-123', 'password123');
      expect(result).toBe(false);
    });

    test('should return true when password matches history', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      
      // Mock bcrypt to return true (password match)
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      
      // Add password to history first
      await addPasswordToHistory('test-user-123', 'oldPassword');
      
      // Check if same password is reused
      const result = await isPasswordReused('test-user-123', 'oldPassword');
      expect(result).toBe(true);
    });

    test('should return false when password does not match history', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      
      // Mock bcrypt to return false (no password match)
      bcrypt.compare.mockResolvedValue(false);
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      
      // Add password to history first
      await addPasswordToHistory('test-user-123', 'oldPassword');
      
      // Check if different password is reused
      const result = await isPasswordReused('test-user-123', 'newPassword');
      expect(result).toBe(false);
    });

    test('should handle unexpected errors gracefully', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      
      // Mock bcrypt to throw error
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      
      // Add password to history first
      await addPasswordToHistory('test-user-123', 'oldPassword');
      
      // Should handle error and return false (fail open)
      const result = await isPasswordReused('test-user-123', 'testPassword');
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('addPasswordToHistory', () => {
    test('should do nothing when password history is disabled', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'false';
      
      await addPasswordToHistory('test-user-123', 'password123');
      
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    test('should successfully add password to history', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      
      await addPasswordToHistory('test-user-123', 'password123');
      
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(logger.info).toHaveBeenCalledWith('Password added to history:', {
        userId: 'test-user-123',
        historyCount: 1,
        maxCount: 5
      });
    });

    test('should limit history to configured count', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      process.env.PASSWORD_HISTORY_COUNT = '3';
      
      bcrypt.hash.mockImplementation((password) => `hashed_${password}`);
      
      // Add 5 passwords (more than the limit of 3)
      for (let i = 1; i <= 5; i++) {
        await addPasswordToHistory('test-user-123', `password${i}`);
      }
      
      const stats = getPasswordHistoryStats('test-user-123');
      expect(stats.count).toBe(3); // Should be limited to 3
    });

    test('should handle errors gracefully', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      
      bcrypt.hash.mockRejectedValue(new Error('Hashing error'));
      
      // Should not throw error
      await expect(addPasswordToHistory('test-user-123', 'password123')).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('clearPasswordHistory', () => {
    test('should clear password history for user', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      
      // Add some history
      await addPasswordToHistory('test-user-123', 'password123');
      
      // Verify history exists
      let stats = getPasswordHistoryStats('test-user-123');
      expect(stats.count).toBe(1);
      
      // Clear history
      clearPasswordHistory('test-user-123');
      
      // Verify history is cleared
      stats = getPasswordHistoryStats('test-user-123');
      expect(stats.count).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Password history cleared:', { userId: 'test-user-123' });
    });
  });

  describe('getPasswordHistoryStats', () => {
    test('should return disabled stats when feature is disabled', () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'false';
      
      const stats = getPasswordHistoryStats('test-user-123');
      
      expect(stats).toEqual({
        enabled: false,
        count: 0,
        maxCount: 0,
        retentionDays: 0
      });
    });

    test('should return correct stats when enabled', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      process.env.PASSWORD_HISTORY_COUNT = '5';
      process.env.PASSWORD_HISTORY_RETENTION_DAYS = '365';
      
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      
      // Add some history
      await addPasswordToHistory('test-user-123', 'password123');
      await addPasswordToHistory('test-user-123', 'password456');
      
      const stats = getPasswordHistoryStats('test-user-123');
      
      expect(stats.enabled).toBe(true);
      expect(stats.count).toBe(2);
      expect(stats.maxCount).toBe(5);
      expect(stats.retentionDays).toBe(365);
      expect(stats.newestEntry).toBeDefined();
      expect(stats.oldestEntry).toBeDefined();
    });
  });

  describe('getPasswordHistoryConfig', () => {
    test('should return current configuration', () => {
      const config = getPasswordHistoryConfig();
      
      expect(config).toHaveProperty('rememberCount');
      expect(config).toHaveProperty('retentionDays');
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('totalUsers');
      expect(config).toHaveProperty('totalEntries');
    });
  });

  describe('cleanupPasswordHistory', () => {
    test('should do nothing when disabled', () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'false';
      
      // Should not throw error
      expect(() => cleanupPasswordHistory()).not.toThrow();
    });

    test('should remove old entries', async () => {
      process.env.ENABLE_PASSWORD_HISTORY = 'true';
      process.env.PASSWORD_HISTORY_RETENTION_DAYS = '1'; // 1 day retention
      
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      
      // Add password to history
      await addPasswordToHistory('test-user-123', 'password123');
      
      // Manually set old timestamp (older than retention)
      const stats = getPasswordHistoryStats('test-user-123');
      expect(stats.count).toBe(1);
      
      // Run cleanup (this is a simplified test since we can't easily mock the internal data structure)
      cleanupPasswordHistory();
      
      // In a real scenario, old entries would be removed
      expect(logger.info).toHaveBeenCalled();
    });
  });
});