/**
 * EntitlementsService Trial Management Tests - Issue #678
 * Tests for trial functionality added to EntitlementsService
 */

const EntitlementsService = require('../../../src/services/entitlementsService');
const { supabaseServiceClient } = require('../../../src/config/supabase');

// Mock dependencies
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

describe('EntitlementsService - Trial Management', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EntitlementsService();
  });

  describe('isInTrial', () => {
    test('returns true when user has active trial', async () => {
      const mockSubscription = {
        trial_ends_at: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      };

      service.getSubscription = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.isInTrial('user-123');
      expect(result).toBe(true);
      expect(service.getSubscription).toHaveBeenCalledWith('user-123');
    });

    test('returns false when trial has expired', async () => {
      const mockSubscription = {
        trial_ends_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
      };

      service.getSubscription = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.isInTrial('user-123');
      expect(result).toBe(false);
    });

    test('returns false when no trial data exists', async () => {
      const mockSubscription = { plan_id: 'starter' };

      service.getSubscription = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.isInTrial('user-123');
      expect(result).toBe(false);
    });

    test('handles errors gracefully', async () => {
      service.getSubscription = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await service.isInTrial('user-123');
      expect(result).toBe(false);
    });
  });

  describe('startTrial', () => {
    test('starts trial successfully for new user', async () => {
      service.isInTrial = jest.fn().mockResolvedValue(false);

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await service.startTrial('user-123', 30);

      expect(result.success).toBe(true);
      expect(result.trial_ends_at).toBeDefined();
      expect(result.duration_days).toBe(30);
    });

    test('fails if user already in trial', async () => {
      service.isInTrial = jest.fn().mockResolvedValue(true);

      await expect(service.startTrial('user-123')).rejects.toThrow('User is already in trial period');
    });

    test('handles database errors', async () => {
      service.isInTrial = jest.fn().mockResolvedValue(false);

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } })
        })
      });

      await expect(service.startTrial('user-123')).rejects.toThrow('Failed to start trial: DB error');
    });
  });

  describe('checkTrialExpiration', () => {
    test('returns true when trial has expired', async () => {
      const mockSubscription = {
        trial_ends_at: new Date(Date.now() - 86400000).toISOString()
      };

      service.getSubscription = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.checkTrialExpiration('user-123');
      expect(result).toBe(true);
    });

    test('returns false when trial is still active', async () => {
      const mockSubscription = {
        trial_ends_at: new Date(Date.now() + 86400000).toISOString()
      };

      service.getSubscription = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.checkTrialExpiration('user-123');
      expect(result).toBe(false);
    });

    test('returns false when no trial exists', async () => {
      service.getSubscription = jest.fn().mockResolvedValue({ plan_id: 'starter' });

      const result = await service.checkTrialExpiration('user-123');
      expect(result).toBe(false);
    });
  });

  describe('cancelTrial', () => {
    test('cancels trial and converts to paid starter', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await service.cancelTrial('user-123');

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
    });

    test('handles database errors', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } })
        })
      });

      await expect(service.cancelTrial('user-123')).rejects.toThrow('Failed to cancel trial: DB error');
    });
  });

  describe('convertTrialToPaid', () => {
    test('converts trial to paid starter', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await service.convertTrialToPaid('user-123');

      expect(result.success).toBe(true);
      expect(result.converted).toBe(true);
      expect(result.new_plan).toBe('starter');
    });

    test('handles database errors', async () => {
      supabaseServiceClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } })
        })
      });

      await expect(service.convertTrialToPaid('user-123')).rejects.toThrow('Failed to convert trial to paid: DB error');
    });
  });

  describe('getTrialStatus', () => {
    test('returns trial status for active trial', async () => {
      const trialStart = new Date(Date.now() - 86400000); // Yesterday
      const trialEnd = new Date(Date.now() + 86400000); // Tomorrow

      const mockSubscription = {
        trial_starts_at: trialStart.toISOString(),
        trial_ends_at: trialEnd.toISOString()
      };

      service.getSubscription = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.getTrialStatus('user-123');

      expect(result.in_trial).toBe(true);
      expect(result.days_left).toBe(1);
      expect(result.expired).toBe(false);
    });

    test('returns not in trial when no trial data', async () => {
      service.getSubscription = jest.fn().mockResolvedValue({ plan_id: 'starter' });

      const result = await service.getTrialStatus('user-123');

      expect(result.in_trial).toBe(false);
      expect(result.trial_starts_at).toBeUndefined();
    });

    test('returns expired status for past trial', async () => {
      const trialStart = new Date(Date.now() - 86400000 * 2); // 2 days ago
      const trialEnd = new Date(Date.now() - 86400000); // Yesterday

      const mockSubscription = {
        trial_starts_at: trialStart.toISOString(),
        trial_ends_at: trialEnd.toISOString()
      };

      service.getSubscription = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.getTrialStatus('user-123');

      expect(result.in_trial).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.days_left).toBe(0);
    });
  });
});
