/**
 * Social API SDK Tests
 * 
 * Tests for the social networks API mock implementation
 */

import socialAPI from '../index.js';

// These tests verify the API SDK functions work correctly 
// They use the real implementation but in mock mode

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
      expect(typeof result.pagination.hasMore).toBe('boolean');
    });

    it('approveRoast returns success response', async () => {
      const accountId = 'acc_tw_1';
      const roastId = 'r1';

      const result = await socialAPI.approveRoast(accountId, roastId);

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('rejectRoast returns success response', async () => {
      const accountId = 'acc_tw_1';
      const roastId = 'r1';

      const result = await socialAPI.rejectRoast(accountId, roastId);

      expect(result).toHaveProperty('success'); 
      expect(typeof result.success).toBe('boolean');
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
      expect(typeof result.pagination.hasMore).toBe('boolean');
    });

    it('updateShieldSettings returns success response', async () => {
      const accountId = 'acc_tw_1';
      const settings = { enabled: true, threshold: 95 };

      const result = await socialAPI.updateShieldSettings(accountId, settings);

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Account Settings API', () => {
    it('updateAccountSettings returns success response', async () => {
      const accountId = 'acc_tw_1';
      const settings = { active: true, autoApprove: false, defaultTone: 'Comico' };

      const result = await socialAPI.updateAccountSettings(accountId, settings);

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Connection API', () => {
    it('connectNetwork returns OAuth redirect URL', async () => {
      const network = 'twitter';

      const result = await socialAPI.connectNetwork(network);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('redirectUrl');
      expect(result.redirectUrl).toContain(network);
      expect(typeof result.success).toBe('boolean');
    });

    it('disconnectAccount returns success response', async () => {
      const accountId = 'acc_tw_1';

      const result = await socialAPI.disconnectAccount(accountId);

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
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
          getItem: jest.fn(() => mockToken),
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
          getItem: jest.fn(() => null),
        },
        writable: true
      });

      const headers = socialAPI.getAuthHeaders();

      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('Mock Mode Features', () => {
    it('returns expected response structure for all endpoints', async () => {
      // Test that all API methods return properly structured responses
      const roastsResult = await socialAPI.getRoasts('test_account');
      expect(roastsResult).toHaveProperty('data');
      expect(roastsResult).toHaveProperty('pagination');
      
      const connectResult = await socialAPI.connectNetwork('twitter');
      expect(connectResult).toHaveProperty('success');
      expect(connectResult).toHaveProperty('redirectUrl');
      
      const settingsResult = await socialAPI.updateAccountSettings('test_account', { active: true });
      expect(settingsResult).toHaveProperty('success');
    });
  });
});