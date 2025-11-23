/**
 * Session Refresh Middleware Tests
 * Tests the automatic session refresh functionality
 */

const jwt = require('jsonwebtoken');
const {
  sessionRefreshMiddleware,
  handleSessionRefresh,
  extractToken,
  isTokenNearExpiry
} = require('../../../src/middleware/sessionRefresh');
const { flags } = require('../../../src/config/flags');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    auth: {
      refreshSession: jest.fn()
    }
  }
}));

jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn(),
    reload: jest.fn()
  }
}));

describe('Session Refresh Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {},
      body: {}
    };

    mockRes = {
      set: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => mockRes)
    };

    mockNext = jest.fn();

    // Default flag states
    flags.isEnabled.mockImplementation((flag) => {
      switch (flag) {
        case 'ENABLE_SESSION_REFRESH':
          return true;
        case 'ENABLE_MOCK_MODE':
          return false;
        case 'DEBUG_SESSION':
          return false;
        default:
          return false;
      }
    });
  });

  describe('extractToken', () => {
    it('should extract token from Authorization header', () => {
      const req = {
        headers: {
          authorization: 'Bearer test-token-123'
        }
      };

      const token = extractToken(req);
      expect(token).toBe('test-token-123');
    });

    it('should return null for missing Authorization header', () => {
      const req = { headers: {} };
      const token = extractToken(req);
      expect(token).toBeNull();
    });

    it('should return null for non-Bearer token', () => {
      const req = {
        headers: {
          authorization: 'Basic dGVzdDp0ZXN0'
        }
      };

      const token = extractToken(req);
      expect(token).toBeNull();
    });

    it('should return null for malformed Authorization header', () => {
      const req = {
        headers: {
          authorization: 'Bearer'
        }
      };

      const token = extractToken(req);
      expect(token).toBeNull();
    });
  });

  describe('isTokenNearExpiry', () => {
    const fiveMinutes = 5 * 60; // 5 minutes in seconds
    const now = Math.floor(Date.now() / 1000);

    it('should return true for tokens expiring within 5 minutes', () => {
      const payload = { exp: now + (fiveMinutes - 60) }; // 4 minutes from now
      expect(isTokenNearExpiry(payload)).toBe(true);
    });

    it('should return false for tokens expiring after 5 minutes', () => {
      const payload = { exp: now + (fiveMinutes + 60) }; // 6 minutes from now
      expect(isTokenNearExpiry(payload)).toBe(false);
    });

    it('should return true for already expired tokens', () => {
      const payload = { exp: now - 60 }; // 1 minute ago
      expect(isTokenNearExpiry(payload)).toBe(true);
    });

    it('should return false for payload without exp', () => {
      const payload = { sub: 'user123' };
      expect(isTokenNearExpiry(payload)).toBe(false);
    });
  });

  describe('sessionRefreshMiddleware', () => {
    it('should pass through when session refresh is disabled', async () => {
      flags.isEnabled.mockImplementation((flag) =>
        flag === 'ENABLE_SESSION_REFRESH' ? false : true
      );

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should pass through when no token is present', async () => {
      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should pass through when token is not near expiry', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour from now
      const token = jwt.sign({ exp: futureExp }, 'secret');

      mockReq.headers.authorization = `Bearer ${token}`;

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should pass through when no refresh token is provided', async () => {
      const nearExp = Math.floor(Date.now() / 1000) + 2 * 60; // 2 minutes from now
      const token = jwt.sign({ exp: nearExp }, 'secret');

      mockReq.headers.authorization = `Bearer ${token}`;

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should refresh token when near expiry in mock mode', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_SESSION_REFRESH':
            return true;
          case 'ENABLE_MOCK_MODE':
            return true;
          case 'DEBUG_SESSION':
            return false;
          default:
            return false;
        }
      });

      const nearExp = Math.floor(Date.now() / 1000) + 2 * 60; // 2 minutes from now
      const token = jwt.sign({ exp: nearExp }, 'secret');

      mockReq.headers.authorization = `Bearer ${token}`;
      mockReq.headers['x-refresh-token'] = 'refresh-token-123';

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith({
        'x-new-access-token': expect.stringContaining('mock-refreshed-access-token'),
        'x-new-refresh-token': 'refresh-token-123',
        'x-token-refreshed': 'true',
        'x-expires-at': expect.any(Number)
      });

      expect(mockReq.headers.authorization).toContain('mock-refreshed-access-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle refresh errors gracefully', async () => {
      const nearExp = Math.floor(Date.now() / 1000) + 2 * 60;
      const token = jwt.sign({ exp: nearExp }, 'secret');

      mockReq.headers.authorization = `Bearer ${token}`;
      mockReq.headers['x-refresh-token'] = 'invalid-refresh-token';

      // Mock refresh failure
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_MOCK_MODE') return false; // Force real mode to trigger error
        return flag === 'ENABLE_SESSION_REFRESH';
      });

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      // Should not block request on refresh failure
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should handle malformed JWT tokens', async () => {
      mockReq.headers.authorization = 'Bearer invalid-jwt-token';

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should log debug information when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_SESSION_REFRESH':
          case 'DEBUG_SESSION':
            return true;
          default:
            return false;
        }
      });

      const nearExp = Math.floor(Date.now() / 1000) + 2 * 60;
      const token = jwt.sign({ exp: nearExp }, 'secret');

      mockReq.headers.authorization = `Bearer ${token}`;

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Token near expiry but no refresh token provided');

      consoleSpy.mockRestore();
    });
  });

  describe('handleSessionRefresh endpoint', () => {
    it('should return error when session refresh is disabled', async () => {
      flags.isEnabled.mockImplementation((flag) =>
        flag === 'ENABLE_SESSION_REFRESH' ? false : true
      );

      await handleSessionRefresh(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session refresh is currently disabled',
        code: 'SESSION_REFRESH_DISABLED'
      });
    });

    it('should return error when refresh token is missing', async () => {
      mockReq.body = {};

      await handleSessionRefresh(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    });

    it('should refresh session successfully in mock mode', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_SESSION_REFRESH':
          case 'ENABLE_MOCK_MODE':
            return true;
          default:
            return false;
        }
      });

      mockReq.body = { refresh_token: 'valid-refresh-token' };

      await handleSessionRefresh(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          access_token: expect.stringContaining('mock-refreshed-access-token'),
          refresh_token: 'valid-refresh-token',
          expires_at: expect.any(Number),
          expires_in: 3600,
          user: expect.objectContaining({
            id: 'mock-user-id',
            email: 'mock@example.com'
          })
        })
      });
    });

    it('should handle refresh failure', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_MOCK_MODE') return false; // Force real mode
        return flag === 'ENABLE_SESSION_REFRESH';
      });

      mockReq.body = { refresh_token: 'invalid-refresh-token' };

      await handleSessionRefresh(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to refresh session',
        code: 'SESSION_REFRESH_FAILED',
        details: undefined
      });
    });

    it('should include error details in debug mode', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_SESSION_REFRESH':
          case 'DEBUG_SESSION':
            return true;
          case 'ENABLE_MOCK_MODE':
            return false;
          default:
            return false;
        }
      });

      mockReq.body = { refresh_token: 'invalid-refresh-token' };

      await handleSessionRefresh(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to refresh session',
        code: 'SESSION_REFRESH_FAILED',
        details: expect.any(String)
      });
    });
  });

  describe('Integration with different environments', () => {
    it('should work in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      flags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SESSION_REFRESH');

      mockReq.body = { refresh_token: 'test-refresh-token' };

      await handleSessionRefresh(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          access_token: expect.stringContaining('mock-refreshed-access-token')
        })
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock Supabase response
      const { supabaseServiceClient } = require('../../../src/config/supabase');
      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_at: Date.now() + 3600000,
            expires_in: 3600,
            user: { id: 'user123', email: 'user@example.com' }
          }
        },
        error: null
      });

      flags.isEnabled.mockImplementation((flag) => {
        return flag === 'ENABLE_SESSION_REFRESH';
      });

      mockReq.body = { refresh_token: 'valid-refresh-token' };

      await handleSessionRefresh(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        })
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty JWT payload', async () => {
      const token = jwt.sign({}, 'secret'); // Empty payload
      mockReq.headers.authorization = `Bearer ${token}`;

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should handle JWT without expiration', async () => {
      const token = jwt.sign({ sub: 'user123' }, 'secret'); // No exp claim
      mockReq.headers.authorization = `Bearer ${token}`;

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).not.toHaveBeenCalled();
    });

    it('should handle middleware errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock JWT decode to throw error
      const originalDecode = jwt.decode;
      jwt.decode = jest.fn(() => {
        throw new Error('Invalid token');
      });

      flags.isEnabled.mockImplementation((flag) => {
        switch (flag) {
          case 'ENABLE_SESSION_REFRESH':
          case 'DEBUG_SESSION':
            return true;
          default:
            return false;
        }
      });

      mockReq.headers.authorization = 'Bearer invalid-token';

      await sessionRefreshMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Session middleware error:', 'Invalid token');

      // Restore
      jwt.decode = originalDecode;
      consoleSpy.mockRestore();
    });

    it('should handle missing headers object', async () => {
      const reqWithoutHeaders = {};

      await sessionRefreshMiddleware(reqWithoutHeaders, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate refresh token format', async () => {
      flags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_SESSION_REFRESH');

      const testCases = [
        { refresh_token: '' },
        { refresh_token: null },
        { refresh_token: undefined },
        { refresh_token: 123 },
        { refresh_token: {} }
      ];

      for (const testCase of testCases) {
        mockReq.body = testCase;
        await handleSessionRefresh(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN'
        });

        jest.clearAllMocks();
      }
    });
  });
});
