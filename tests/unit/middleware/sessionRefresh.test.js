/**
 * Unit tests for Session Refresh Middleware
 * ROA-524: Session Refresh and Health Check Completion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock dependencies before importing
vi.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: vi.fn()
  }
}));

vi.mock('../../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    auth: {
      refreshSession: vi.fn()
    }
  },
  supabaseAnonClient: {
    auth: {
      refreshSession: vi.fn()
    }
  }
}));

// Import after mocks
const {
  sessionRefreshMiddleware,
  handleSessionRefresh,
  refreshUserSession,
  extractToken,
  isTokenNearExpiry
} = await import('../../../src/middleware/sessionRefresh.js');

const { flags } = await import('../../../src/config/flags.js');
const { supabaseServiceClient, supabaseAnonClient } =
  await import('../../../src/config/supabase.js');

describe('Session Refresh Middleware - ROA-524', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.isEnabled.mockImplementation((flag) => {
      if (flag === 'ENABLE_SESSION_REFRESH') return true;
      if (flag === 'ENABLE_MOCK_MODE') return false;
      if (flag === 'DEBUG_SESSION') return false;
      return false;
    });
  });

  describe('extractToken', () => {
    it('should extract token from Bearer authorization header', () => {
      const req = {
        headers: {
          authorization: 'Bearer test-token-123'
        }
      };
      expect(extractToken(req)).toBe('test-token-123');
    });

    it('should return null if no authorization header', () => {
      const req = { headers: {} };
      expect(extractToken(req)).toBeNull();
    });

    it('should return null if authorization does not start with Bearer', () => {
      const req = {
        headers: {
          authorization: 'Basic test-token-123'
        }
      };
      expect(extractToken(req)).toBeNull();
    });
  });

  describe('isTokenNearExpiry', () => {
    it('should return true if token expires in less than 5 minutes', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = { exp: now + 240 }; // 4 minutes
      expect(isTokenNearExpiry(payload)).toBe(true);
    });

    it('should return false if token expires in more than 5 minutes', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = { exp: now + 360 }; // 6 minutes
      expect(isTokenNearExpiry(payload)).toBe(false);
    });

    it('should return false if payload has no exp', () => {
      const payload = {};
      expect(isTokenNearExpiry(payload)).toBe(false);
    });
  });

  describe('refreshUserSession', () => {
    it('should refresh session successfully', async () => {
      const mockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() + 3600000,
        expires_in: 3600,
        user: { id: 'user-123' }
      };

      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await refreshUserSession('old-refresh-token', 'correlation-id-123');
      expect(result).toEqual(mockSession);
      expect(supabaseServiceClient.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token'
      });
    });

    it('should throw error if refresh fails', async () => {
      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid refresh token' }
      });

      await expect(refreshUserSession('invalid-token', 'correlation-id-123')).rejects.toThrow();
    });

    it('should use mock mode in test environment', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_MOCK_MODE') return true;
        if (flag === 'ENABLE_SESSION_REFRESH') return true;
        return false;
      });

      const mockSession = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_at: Date.now() + 3600000
      };

      supabaseAnonClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await refreshUserSession('mock-refresh-token', 'correlation-id-123');
      expect(result).toEqual(mockSession);
      expect(supabaseAnonClient.auth.refreshSession).toHaveBeenCalled();
    });

    it('should throw error if feature flag is disabled', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_SESSION_REFRESH') return false;
        return false;
      });

      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(refreshUserSession('token', 'correlation-id-123')).rejects.toThrow(
        'Session refresh is disabled'
      );

      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sessionRefreshMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
        correlationId: 'test-correlation-id'
      };
      res = {
        set: vi.fn()
      };
      next = vi.fn();
    });

    it('should skip if feature flag is disabled', async () => {
      flags.isEnabled.mockImplementation((flag) => {
        if (flag === 'ENABLE_SESSION_REFRESH') return false;
        return false;
      });

      await sessionRefreshMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).not.toHaveBeenCalled();
    });

    it('should skip if no token provided', async () => {
      await sessionRefreshMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).not.toHaveBeenCalled();
    });

    it('should refresh token if near expiry', async () => {
      const now = Math.floor(Date.now() / 1000);
      const nearExpiryToken = jwt.sign({ exp: now + 240 }, 'secret'); // 4 minutes

      req.headers.authorization = `Bearer ${nearExpiryToken}`;
      req.headers['x-refresh-token'] = 'refresh-token-123';

      const mockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() + 3600000
      };

      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionRefreshMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'x-new-access-token': 'new-access-token',
          'x-new-refresh-token': 'new-refresh-token',
          'x-token-refreshed': 'true'
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not refresh if token not near expiry', async () => {
      const now = Math.floor(Date.now() / 1000);
      const validToken = jwt.sign({ exp: now + 3600 }, 'secret'); // 1 hour

      req.headers.authorization = `Bearer ${validToken}`;

      await sessionRefreshMiddleware(req, res, next);

      expect(res.set).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should continue if no refresh token provided', async () => {
      const now = Math.floor(Date.now() / 1000);
      const nearExpiryToken = jwt.sign({ exp: now + 240 }, 'secret'); // 4 minutes

      req.headers.authorization = `Bearer ${nearExpiryToken}`;
      // No x-refresh-token header

      await sessionRefreshMiddleware(req, res, next);

      expect(res.set).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should continue on refresh error', async () => {
      const now = Math.floor(Date.now() / 1000);
      const nearExpiryToken = jwt.sign({ exp: now + 240 }, 'secret');

      req.headers.authorization = `Bearer ${nearExpiryToken}`;
      req.headers['x-refresh-token'] = 'invalid-token';

      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid refresh token' }
      });

      await sessionRefreshMiddleware(req, res, next);

      // Should not block request
      expect(next).toHaveBeenCalled();
    });

    it('should generate correlation ID if not provided', async () => {
      const now = Math.floor(Date.now() / 1000);
      const validToken = jwt.sign({ exp: now + 3600 }, 'secret');

      req = {
        headers: {
          authorization: `Bearer ${validToken}`
        }
      };

      await sessionRefreshMiddleware(req, res, next);

      expect(req.correlationId).toBeDefined();
      expect(typeof req.correlationId).toBe('string');
      expect(req.correlationId).toMatch(/^sess-/);
    });
  });

  describe('handleSessionRefresh', () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
        headers: {}
      };
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn()
      };
    });

    it('should return 503 if feature flag is disabled', async () => {
      flags.isEnabled = vi.fn((flag) => {
        if (flag === 'ENABLE_SESSION_REFRESH') return false;
        return false;
      });

      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await handleSessionRefresh(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'SESSION_REFRESH_DISABLED'
        })
      );

      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should return 400 if no refresh token provided', async () => {
      await handleSessionRefresh(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'MISSING_REFRESH_TOKEN'
        })
      );
    });

    it('should refresh session successfully', async () => {
      req.body.refresh_token = 'valid-refresh-token';

      const mockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() + 3600000,
        expires_in: 3600,
        user: { id: 'user-123' }
      };

      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await handleSessionRefresh(req, res);

      expect(res.set).toHaveBeenCalledWith('x-correlation-id', expect.any(String));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession
      });
    });

    it('should return 401 if refresh fails', async () => {
      req.body.refresh_token = 'invalid-token';

      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid refresh token' }
      });

      await handleSessionRefresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'SESSION_REFRESH_FAILED'
        })
      );
    });

    it('should use provided correlation ID', async () => {
      req.body.refresh_token = 'valid-token';
      req.headers['x-correlation-id'] = 'custom-correlation-id';

      const mockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() + 3600000,
        expires_in: 3600,
        user: { id: 'user-123' }
      };

      supabaseServiceClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await handleSessionRefresh(req, res);

      expect(res.set).toHaveBeenCalledWith('x-correlation-id', 'custom-correlation-id');
    });
  });
});
