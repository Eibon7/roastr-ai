/**
 * Social API SDK Tests
 *
 * Tests for the social networks API mock implementation
 */

import socialAPI from '../social';

// Mock the delay function to make tests faster
jest.mock('../social', () => {
  const originalModule = jest.requireActual('../social');

  return {
    ...originalModule,
    default: {
      ...originalModule.default,
      getRoasts: jest.fn(originalModule.default.getRoasts),
      approveRoast: jest.fn(originalModule.default.approveRoast),
      rejectRoast: jest.fn(originalModule.default.rejectRoast),
      getShieldIntercepted: jest.fn(originalModule.default.getShieldIntercepted),
      updateShieldSettings: jest.fn(originalModule.default.updateShieldSettings),
      updateAccountSettings: jest.fn(originalModule.default.updateAccountSettings),
      connectNetwork: jest.fn(originalModule.default.connectNetwork),
      disconnectAccount: jest.fn(originalModule.default.disconnectAccount)
    }
  };
});

describe('Social API SDK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Roasts API', () => {
    it('getRoasts returns paginated roasts data', async () => {
      const accountId = 'acc_tw_1';
      const params = { limit: 5 };

      const result = await socialAPI.getRoasts(accountId, params);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.pagination).toHaveProperty('hasMore');
      expect(socialAPI.getRoasts).toHaveBeenCalledWith(accountId, params);
    });

    it('approveRoast returns success response', async () => {
      const accountId = 'acc_tw_1';
      const roastId = 'r1';

      const result = await socialAPI.approveRoast(accountId, roastId);

      expect(result).toEqual({ success: true });
      expect(socialAPI.approveRoast).toHaveBeenCalledWith(accountId, roastId);
    });

    it('rejectRoast returns success response', async () => {
      const accountId = 'acc_tw_1';
      const roastId = 'r1';

      const result = await socialAPI.rejectRoast(accountId, roastId);

      expect(result).toEqual({ success: true });
      expect(socialAPI.rejectRoast).toHaveBeenCalledWith(accountId, roastId);
    });

    it('approveRoast can throw error for network failures', async () => {
      // Mock Math.random to force failure
      const originalMath = Object.create(global.Math);
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.01; // Force failure
      global.Math = mockMath;

      const accountId = 'acc_tw_1';
      const roastId = 'r1';

      await expect(socialAPI.approveRoast(accountId, roastId)).rejects.toThrow(
        'Failed to approve roast - network error'
      );

      global.Math = originalMath;
    });
  });

  describe('Shield API', () => {
    it('getShieldIntercepted returns paginated data', async () => {
      const accountId = 'acc_tw_1';
      const params = { limit: 5 };

      const result = await socialAPI.getShieldIntercepted(accountId, params);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
      expect(socialAPI.getShieldIntercepted).toHaveBeenCalledWith(accountId, params);
    });

    it('updateShieldSettings returns success response', async () => {
      const accountId = 'acc_tw_1';
      const settings = { enabled: true, threshold: 95 };

      const result = await socialAPI.updateShieldSettings(accountId, settings);

      expect(result).toEqual({ success: true });
      expect(socialAPI.updateShieldSettings).toHaveBeenCalledWith(accountId, settings);
    });
  });

  describe('Account Settings API', () => {
    it('updateAccountSettings returns success response', async () => {
      const accountId = 'acc_tw_1';
      const settings = { active: true, autoApprove: false, defaultTone: 'Comico' };

      const result = await socialAPI.updateAccountSettings(accountId, settings);

      expect(result).toEqual({ success: true });
      expect(socialAPI.updateAccountSettings).toHaveBeenCalledWith(accountId, settings);
    });
  });

  describe('Connection API', () => {
    it('connectNetwork returns OAuth redirect URL', async () => {
      const network = 'twitter';

      const result = await socialAPI.connectNetwork(network);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('redirectUrl');
      expect(result.redirectUrl).toContain(network);
      expect(socialAPI.connectNetwork).toHaveBeenCalledWith(network);
    });

    it('disconnectAccount returns success response', async () => {
      const accountId = 'acc_tw_1';

      const result = await socialAPI.disconnectAccount(accountId);

      expect(result).toEqual({ success: true });
      expect(socialAPI.disconnectAccount).toHaveBeenCalledWith(accountId);
    });
  });

  describe('Utility functions', () => {
    it('isMockMode returns true in test environment', () => {
      expect(socialAPI.isMockMode()).toBe(true);
    });

    it('buildApiUrl constructs correct API URL', () => {
      const endpoint = '/social/accounts';
      const url = socialAPI.buildApiUrl(endpoint);

      expect(url).toMatch(/^https?:\/\/.+\/api\/social\/accounts$/);
    });

    it('getAuthHeaders includes authorization if token exists', () => {
      // Mock localStorage
      const mockToken = 'mock-jwt-token';
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn(() => mockToken)
        },
        writable: true
      });

      const headers = socialAPI.getAuthHeaders();

      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('Authorization', `Bearer ${mockToken}`);
    });

    it('getAuthHeaders works without token', () => {
      // Mock localStorage without token
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn(() => null)
        },
        writable: true
      });

      const headers = socialAPI.getAuthHeaders();

      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('Error handling', () => {
    it('handles random failures appropriately', async () => {
      // Test multiple calls to ensure error rate is reasonable
      const results = [];
      const failures = [];

      for (let i = 0; i < 10; i++) {
        try {
          const result = await socialAPI.updateAccountSettings('test_account', { active: true });
          results.push(result);
        } catch (error) {
          failures.push(error);
        }
      }

      // Most should succeed, some might fail
      expect(results.length + failures.length).toBe(10);
      expect(results.length).toBeGreaterThan(5); // At least 50% success rate
    });
  });
});
