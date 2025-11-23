/**
 * Reincidence Detector Tests
 *
 * Tests for security-critical user tracking functionality including:
 * - User interaction recording and severity tracking
 * - Automatic action triggering based on thresholds
 * - Data persistence and cleanup
 * - Platform summary statistics
 * - Error handling and edge cases
 */

const fs = require('fs-extra');
const path = require('path');
const ReincidenceDetector = require('../../../src/services/reincidenceDetector');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../../src/utils/advancedLogger', () => ({
  logReincidence: jest.fn(),
  logAutoAction: jest.fn()
}));

jest.mock('../../../src/config/integrations', () => ({
  shield: {
    reincidenceThreshold: 5,
    severityLevels: {
      critical: { threshold: 1, action: 'ban' },
      high: { threshold: 2, action: 'mute' },
      medium: { threshold: 3, action: 'warn' },
      low: { threshold: 5, action: 'warn' }
    }
  }
}));

const advancedLogger = require('../../../src/utils/advancedLogger');

describe('ReincidenceDetector', () => {
  let detector;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fs-extra methods
    fs.ensureDir.mockResolvedValue();
    fs.pathExists.mockResolvedValue(false);
    fs.readJson.mockResolvedValue({});
    fs.writeJson.mockResolvedValue();

    detector = new ReincidenceDetector();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    test('should initialize with correct file paths', () => {
      expect(detector.dataDir).toBe(path.join(process.cwd(), 'data'));
      expect(detector.reincidenceFile).toBe(
        path.join(process.cwd(), 'data', 'user_reincidence.json')
      );
      expect(detector.actionsFile).toBe(path.join(process.cwd(), 'data', 'auto_actions.json'));
      expect(detector.userHistory).toBeInstanceOf(Map);
      expect(detector.actionHistory).toBeInstanceOf(Map);
    });

    test('should create data directory during initialization', () => {
      expect(fs.ensureDir).toHaveBeenCalledWith(detector.dataDir);
    });
  });

  describe('loadData', () => {
    test('should load existing reincidence and action data', async () => {
      const mockReincidenceData = {
        twitter_user1: {
          platform: 'twitter',
          userId: 'user1',
          username: 'testuser',
          totalCount: 3,
          severityCounts: { low: 2, medium: 1, high: 0, critical: 0 }
        }
      };

      const mockActionsData = {
        twitter_user1_12345: {
          platform: 'twitter',
          userId: 'user1',
          action: 'warn',
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      fs.pathExists
        .mockResolvedValueOnce(true) // reincidence file exists
        .mockResolvedValueOnce(true); // actions file exists

      fs.readJson.mockResolvedValueOnce(mockReincidenceData).mockResolvedValueOnce(mockActionsData);

      await detector.loadData();

      expect(detector.userHistory.size).toBe(1);
      expect(detector.userHistory.get('twitter_user1')).toEqual(
        mockReincidenceData['twitter_user1']
      );
      expect(detector.actionHistory.size).toBe(1);
      expect(detector.actionHistory.get('twitter_user1_12345')).toEqual(
        mockActionsData['twitter_user1_12345']
      );
    });

    test('should handle missing data files gracefully', async () => {
      fs.pathExists.mockResolvedValue(false);

      await detector.loadData();

      expect(detector.userHistory.size).toBe(0);
      expect(detector.actionHistory.size).toBe(0);
      expect(fs.readJson).not.toHaveBeenCalled();
    });

    test('should handle file read errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockRejectedValue(new Error('File corrupted'));

      await detector.loadData();

      expect(consoleSpy).toHaveBeenCalledWith('Error loading reincidence data:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('saveData', () => {
    test('should save user history and action history to files', async () => {
      detector.userHistory.set('twitter_user1', {
        platform: 'twitter',
        userId: 'user1',
        totalCount: 2
      });

      detector.actionHistory.set('action1', {
        platform: 'twitter',
        action: 'warn'
      });

      await detector.saveData();

      expect(fs.writeJson).toHaveBeenCalledTimes(2);
      expect(fs.writeJson).toHaveBeenCalledWith(
        detector.reincidenceFile,
        { twitter_user1: { platform: 'twitter', userId: 'user1', totalCount: 2 } },
        { spaces: 2 }
      );
      expect(fs.writeJson).toHaveBeenCalledWith(
        detector.actionsFile,
        { action1: { platform: 'twitter', action: 'warn' } },
        { spaces: 2 }
      );
    });

    test('should handle save errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      fs.writeJson.mockRejectedValue(new Error('Write permission denied'));

      await detector.saveData();

      expect(consoleSpy).toHaveBeenCalledWith('Error saving reincidence data:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('recordInteraction', () => {
    test('should create new user record for first interaction', async () => {
      const mockDate = '2024-01-01T12:00:00Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      const result = await detector.recordInteraction(
        'twitter',
        'user123',
        'testuser',
        'This is a test message',
        'medium'
      );

      expect(result).toBeDefined();
      expect(result.platform).toBe('twitter');
      expect(result.userId).toBe('user123');
      expect(result.username).toBe('testuser');
      expect(result.totalCount).toBe(1);
      expect(result.severityCounts.medium).toBe(1);
      expect(result.firstInteraction).toBe(mockDate);
      expect(result.lastInteraction).toBe(mockDate);
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0]).toEqual({
        timestamp: mockDate,
        messageText: 'This is a test message',
        severity: 'medium'
      });

      expect(fs.writeJson).toHaveBeenCalled();
      Date.prototype.toISOString.mockRestore();
    });

    test('should update existing user record with new interaction', async () => {
      const userKey = 'twitter_user123';

      // Pre-populate user history
      detector.userHistory.set(userKey, {
        platform: 'twitter',
        userId: 'user123',
        username: 'oldname',
        interactions: [
          { timestamp: '2024-01-01T10:00:00Z', messageText: 'Old message', severity: 'low' }
        ],
        totalCount: 1,
        severityCounts: { low: 1, medium: 0, high: 0, critical: 0 },
        lastInteraction: '2024-01-01T10:00:00Z',
        firstInteraction: '2024-01-01T10:00:00Z'
      });

      const mockDate = '2024-01-01T12:00:00Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      const result = await detector.recordInteraction(
        'twitter',
        'user123',
        'newname',
        'New message',
        'high'
      );

      expect(result.totalCount).toBe(2);
      expect(result.severityCounts.low).toBe(1);
      expect(result.severityCounts.high).toBe(1);
      expect(result.username).toBe('newname'); // Should update username
      expect(result.lastInteraction).toBe(mockDate);
      expect(result.interactions).toHaveLength(2);

      Date.prototype.toISOString.mockRestore();
    });

    test('should limit interactions to last 50 entries', async () => {
      const userKey = 'twitter_user123';

      // Pre-populate with 50 interactions
      const interactions = Array.from({ length: 50 }, (_, i) => ({
        timestamp: `2024-01-01T${String(i).padStart(2, '0')}:00:00Z`,
        messageText: `Message ${i}`,
        severity: 'low'
      }));

      detector.userHistory.set(userKey, {
        platform: 'twitter',
        userId: 'user123',
        username: 'testuser',
        interactions,
        totalCount: 50,
        severityCounts: { low: 50, medium: 0, high: 0, critical: 0 },
        firstInteraction: '2024-01-01T00:00:00Z',
        lastInteraction: '2024-01-01T49:00:00Z'
      });

      await detector.recordInteraction('twitter', 'user123', 'testuser', 'New message', 'medium');

      const userRecord = detector.userHistory.get(userKey);
      expect(userRecord.interactions).toHaveLength(50); // Still 50, oldest removed
      expect(userRecord.interactions[0].messageText).toBe('Message 1'); // First is now Message 1
      expect(userRecord.interactions[49].messageText).toBe('New message'); // Latest is new message
    });

    test('should trigger reincidence logging when threshold exceeded', async () => {
      const userKey = 'twitter_user123';

      // Pre-populate user close to threshold
      detector.userHistory.set(userKey, {
        platform: 'twitter',
        userId: 'user123',
        username: 'testuser',
        interactions: [
          { timestamp: '2024-01-01T10:00:00Z', messageText: 'Msg 1', severity: 'low' },
          { timestamp: '2024-01-01T11:00:00Z', messageText: 'Msg 2', severity: 'medium' },
          { timestamp: '2024-01-01T12:00:00Z', messageText: 'Msg 3', severity: 'high' },
          { timestamp: '2024-01-01T13:00:00Z', messageText: 'Msg 4', severity: 'medium' }
        ],
        totalCount: 4,
        severityCounts: { low: 1, medium: 2, high: 1, critical: 0 },
        firstInteraction: '2024-01-01T10:00:00Z',
        lastInteraction: '2024-01-01T13:00:00Z'
      });

      // This interaction should trigger threshold (5 total)
      await detector.recordInteraction(
        'twitter',
        'user123',
        'testuser',
        'Fifth message',
        'critical'
      );

      expect(advancedLogger.logReincidence).toHaveBeenCalledWith(
        'twitter',
        'user123',
        'testuser',
        5,
        'critical',
        {
          severityCounts: { low: 1, medium: 2, high: 1, critical: 1 },
          recentInteractions: expect.any(Array)
        }
      );
    });

    test('should handle interaction recording errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      fs.writeJson.mockRejectedValue(new Error('Save failed'));

      const result = await detector.recordInteraction(
        'twitter',
        'user123',
        'testuser',
        'Test message'
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error recording interaction:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('shouldTakeAutoAction', () => {
    beforeEach(() => {
      // Setup test user data
      detector.userHistory.set('twitter_user1', {
        platform: 'twitter',
        userId: 'user1',
        totalCount: 6,
        severityCounts: { low: 2, medium: 2, high: 1, critical: 1 }
      });
    });

    test('should recommend ban for critical severity exceeding threshold', () => {
      const action = detector.shouldTakeAutoAction('twitter', 'user1', 'critical');
      expect(action).toBe('ban');
    });

    test('should recommend mute for high severity exceeding threshold', () => {
      const action = detector.shouldTakeAutoAction('twitter', 'user1', 'high');
      expect(action).toBe('mute');
    });

    test('should recommend warn for medium severity exceeding threshold', () => {
      const action = detector.shouldTakeAutoAction('twitter', 'user1', 'medium');
      expect(action).toBe('warn');
    });

    test('should recommend warn for low severity with high total count', () => {
      detector.userHistory.set('twitter_user2', {
        platform: 'twitter',
        userId: 'user2',
        totalCount: 12,
        severityCounts: { low: 12, medium: 0, high: 0, critical: 0 }
      });

      const action = detector.shouldTakeAutoAction('twitter', 'user2', 'low');
      expect(action).toBe('warn');
    });

    test('should return null when user does not exist', () => {
      const action = detector.shouldTakeAutoAction('twitter', 'nonexistent', 'high');
      expect(action).toBeNull();
    });

    test('should return null when severity thresholds not met', () => {
      detector.userHistory.set('twitter_user3', {
        platform: 'twitter',
        userId: 'user3',
        totalCount: 2,
        severityCounts: { low: 2, medium: 0, high: 0, critical: 0 }
      });

      const action = detector.shouldTakeAutoAction('twitter', 'user3', 'medium');
      expect(action).toBeNull();
    });

    test('should return null for unknown severity level', () => {
      const action = detector.shouldTakeAutoAction('twitter', 'user1', 'unknown');
      expect(action).toBeNull();
    });

    test('should handle errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Break the config to trigger error
      jest.doMock('../../../src/config/integrations', () => {
        throw new Error('Config error');
      });

      const action = detector.shouldTakeAutoAction('twitter', 'user1', 'high');

      expect(action).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking auto action criteria:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('recordAutoAction', () => {
    test('should record automatic action successfully', async () => {
      const mockDate = '2024-01-01T12:00:00Z';
      const mockTimestamp = 1704110400000;
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const result = await detector.recordAutoAction(
        'twitter',
        'user123',
        'testuser',
        'mute',
        'High toxicity threshold exceeded',
        'high'
      );

      expect(result).toBeDefined();
      expect(result.platform).toBe('twitter');
      expect(result.userId).toBe('user123');
      expect(result.username).toBe('testuser');
      expect(result.action).toBe('mute');
      expect(result.reason).toBe('High toxicity threshold exceeded');
      expect(result.severity).toBe('high');
      expect(result.timestamp).toBe(mockDate);

      const expectedKey = `twitter_user123_${mockTimestamp}`;
      expect(detector.actionHistory.has(expectedKey)).toBe(true);

      expect(advancedLogger.logAutoAction).toHaveBeenCalledWith(
        'twitter',
        'mute',
        'user123',
        'testuser',
        'High toxicity threshold exceeded',
        { severity: 'high', actionKey: expectedKey }
      );

      expect(fs.writeJson).toHaveBeenCalled();

      Date.prototype.toISOString.mockRestore();
      Date.now.mockRestore();
    });

    test('should handle action recording errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      fs.writeJson.mockRejectedValue(new Error('Save failed'));

      const result = await detector.recordAutoAction(
        'twitter',
        'user123',
        'testuser',
        'warn',
        'Test reason',
        'medium'
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error recording auto action:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getUserStats', () => {
    test('should return user statistics for existing user', () => {
      const userData = {
        platform: 'twitter',
        userId: 'user123',
        username: 'testuser',
        totalCount: 5,
        severityCounts: { low: 2, medium: 2, high: 1, critical: 0 }
      };

      detector.userHistory.set('twitter_user123', userData);

      const stats = detector.getUserStats('twitter', 'user123');
      expect(stats).toEqual(userData);
    });

    test('should return null for non-existent user', () => {
      const stats = detector.getUserStats('twitter', 'nonexistent');
      expect(stats).toBeNull();
    });
  });

  describe('getPlatformSummary', () => {
    beforeEach(() => {
      // Setup test data for Twitter
      detector.userHistory.set('twitter_user1', {
        platform: 'twitter',
        userId: 'user1',
        username: 'user1',
        totalCount: 3,
        severityCounts: { low: 1, medium: 1, high: 1, critical: 0 }
      });

      detector.userHistory.set('twitter_user2', {
        platform: 'twitter',
        userId: 'user2',
        username: 'user2',
        totalCount: 2,
        severityCounts: { low: 2, medium: 0, high: 0, critical: 0 }
      });

      detector.userHistory.set('youtube_user1', {
        platform: 'youtube',
        userId: 'user1',
        username: 'ytuser',
        totalCount: 1,
        severityCounts: { low: 0, medium: 0, high: 0, critical: 1 }
      });

      // Setup action data
      detector.actionHistory.set('twitter_action1', {
        platform: 'twitter',
        userId: 'user1',
        action: 'warn',
        timestamp: '2024-01-01T12:00:00Z'
      });

      detector.actionHistory.set('twitter_action2', {
        platform: 'twitter',
        userId: 'user2',
        action: 'mute',
        timestamp: '2024-01-01T13:00:00Z'
      });

      detector.actionHistory.set('youtube_action1', {
        platform: 'youtube',
        userId: 'user1',
        action: 'ban',
        timestamp: '2024-01-01T11:00:00Z'
      });
    });

    test('should return correct platform summary for Twitter', () => {
      const summary = detector.getPlatformSummary('twitter');

      expect(summary.totalUsers).toBe(2);
      expect(summary.totalInteractions).toBe(5); // 3 + 2
      expect(summary.severityCounts).toEqual({
        low: 3, // 1 + 2
        medium: 1, // 1 + 0
        high: 1, // 1 + 0
        critical: 0 // 0 + 0
      });
      expect(summary.actionsTaken).toBe(2);
      expect(summary.recentActions).toHaveLength(2);
      expect(summary.recentActions[0].timestamp).toBe('2024-01-01T13:00:00Z'); // Most recent first
    });

    test('should return correct platform summary for YouTube', () => {
      const summary = detector.getPlatformSummary('youtube');

      expect(summary.totalUsers).toBe(1);
      expect(summary.totalInteractions).toBe(1);
      expect(summary.severityCounts.critical).toBe(1);
      expect(summary.actionsTaken).toBe(1);
    });

    test('should return empty summary for platform with no data', () => {
      const summary = detector.getPlatformSummary('instagram');

      expect(summary.totalUsers).toBe(0);
      expect(summary.totalInteractions).toBe(0);
      expect(summary.severityCounts).toEqual({
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      });
      expect(summary.actionsTaken).toBe(0);
      expect(summary.recentActions).toEqual([]);
    });

    test('should limit recent actions to 10', () => {
      // Add 12 actions for Twitter
      for (let i = 1; i <= 12; i++) {
        detector.actionHistory.set(`twitter_action_${i}`, {
          platform: 'twitter',
          userId: 'user1',
          action: 'warn',
          timestamp: `2024-01-0${i > 9 ? 1 : 1}T${String(i).padStart(2, '0')}:00:00Z`
        });
      }

      const summary = detector.getPlatformSummary('twitter');
      expect(summary.recentActions).toHaveLength(10);
    });
  });

  describe('getGlobalSummary', () => {
    beforeEach(() => {
      // Setup diverse test data
      detector.userHistory.set('twitter_user1', {
        platform: 'twitter',
        userId: 'user1',
        totalCount: 3
      });
      detector.userHistory.set('youtube_user1', {
        platform: 'youtube',
        userId: 'user1',
        totalCount: 2
      });

      detector.actionHistory.set('action1', {
        platform: 'twitter',
        timestamp: '2024-01-01T12:00:00Z'
      });
      detector.actionHistory.set('action2', {
        platform: 'youtube',
        timestamp: '2024-01-01T11:00:00Z'
      });
    });

    test('should return global summary with platform breakdown', () => {
      const summary = detector.getGlobalSummary();

      expect(summary.totalUsers).toBe(2);
      expect(summary.totalActions).toBe(2);
      expect(summary.platformBreakdown).toHaveProperty('twitter');
      expect(summary.platformBreakdown).toHaveProperty('youtube');
      expect(summary.recentActivity).toHaveLength(2);
      expect(summary.recentActivity[0].timestamp).toBe('2024-01-01T12:00:00Z'); // Most recent first
    });

    test('should limit recent activity to 20 entries', () => {
      // Add 25 actions
      for (let i = 1; i <= 25; i++) {
        detector.actionHistory.set(`action_${i}`, {
          platform: 'twitter',
          timestamp: `2024-01-01T${String(i).padStart(2, '0')}:00:00Z`
        });
      }

      const summary = detector.getGlobalSummary();
      expect(summary.recentActivity).toHaveLength(20);
    });
  });

  describe('cleanOldData', () => {
    beforeEach(() => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

      // Setup test data with old and recent interactions
      detector.userHistory.set('twitter_user1', {
        platform: 'twitter',
        userId: 'user1',
        interactions: [
          { timestamp: oldDate.toISOString(), severity: 'low' },
          { timestamp: recentDate.toISOString(), severity: 'medium' }
        ],
        totalCount: 2,
        severityCounts: { low: 1, medium: 1, high: 0, critical: 0 }
      });

      detector.userHistory.set('twitter_user2', {
        platform: 'twitter',
        userId: 'user2',
        interactions: [{ timestamp: oldDate.toISOString(), severity: 'low' }],
        totalCount: 1,
        severityCounts: { low: 1, medium: 0, high: 0, critical: 0 }
      });

      detector.actionHistory.set('old_action', {
        timestamp: oldDate.toISOString()
      });

      detector.actionHistory.set('recent_action', {
        timestamp: recentDate.toISOString()
      });
    });

    test('should clean old interactions and recalculate counts', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await detector.cleanOldData(30); // Keep 30 days

      // User1 should have only recent interaction
      const user1 = detector.userHistory.get('twitter_user1');
      expect(user1.interactions).toHaveLength(1);
      expect(user1.totalCount).toBe(1);
      expect(user1.severityCounts.medium).toBe(1);
      expect(user1.severityCounts.low).toBe(0);

      // User2 should be removed (no recent interactions)
      expect(detector.userHistory.has('twitter_user2')).toBe(false);

      // Old action should be removed
      expect(detector.actionHistory.has('old_action')).toBe(false);
      expect(detector.actionHistory.has('recent_action')).toBe(true);

      expect(fs.writeJson).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Cleaned reincidence data older than 30 days');
      consoleSpy.mockRestore();
    });

    test('should handle cleanup errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock error during data processing
      detector.userHistory.set('invalid_user', {
        interactions: null // This will cause error
      });

      await detector.cleanOldData(30);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error cleaning old reincidence data:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle invalid user data gracefully', async () => {
      // Test with malformed user data
      detector.userHistory.set('invalid_user', null);

      const stats = detector.getUserStats('invalid', 'user');
      expect(stats).toBeNull();
    });

    test('should handle empty severity counts', () => {
      detector.userHistory.set('twitter_user1', {
        platform: 'twitter',
        userId: 'user1',
        totalCount: 5,
        severityCounts: {} // Empty severity counts
      });

      const action = detector.shouldTakeAutoAction('twitter', 'user1', 'medium');
      expect(action).toBeNull();
    });

    test('should handle missing config gracefully in shouldTakeAutoAction', () => {
      // Mock missing config
      jest.doMock('../../../src/config/integrations', () => ({}));

      const action = detector.shouldTakeAutoAction('twitter', 'user1', 'high');
      expect(action).toBeNull();
    });
  });
});
