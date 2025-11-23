/**
 * Unit tests for auth middleware
 * Tests authentication, admin authorization, and optional auth functionality
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies before requiring the middleware
jest.mock('../../../src/config/supabase', () => ({
  getUserFromToken: jest.fn(),
  createUserClient: jest.fn()
}));

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

const { authenticateToken, requireAdmin, optionalAuth } = require('../../../src/middleware/auth');
const { getUserFromToken, createUserClient } = require('../../../src/config/supabase');
const { logger } = require('../../../src/utils/logger');

describe('Auth Middleware Tests', () => {
  let app;
  let mockResponse;
  let mockRequest;
  let mockNext;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Setup mock next function
    mockNext = jest.fn();
  });

  describe('authenticateToken middleware', () => {
    it('should authenticate valid token successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString()
      };

      getUserFromToken.mockResolvedValue(mockUser);

      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token-123'
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).toHaveBeenCalledWith('valid-token-123');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.accessToken).toBe('valid-token-123');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request with missing authorization header', async () => {
      const mockRequest = {
        headers: {}
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      const mockRequest = {
        headers: {
          authorization: 'InvalidFormat'
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with empty Bearer token', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer '
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      getUserFromToken.mockResolvedValue(null);

      const mockRequest = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).toHaveBeenCalledWith('invalid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle token verification errors', async () => {
      getUserFromToken.mockRejectedValue(new Error('Token verification failed'));

      const mockRequest = {
        headers: {
          authorization: 'Bearer error-token'
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Authentication middleware error:',
        'Token verification failed'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication failed'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle different Bearer token formats', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getUserFromToken.mockResolvedValue(mockUser);

      const mockRequest = {
        headers: {
          authorization: 'Bearer token-with-spaces'
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).toHaveBeenCalledWith('token-with-spaces');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware', () => {
    beforeEach(() => {
      // Setup mock user client
      const mockUserClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
      };
      createUserClient.mockReturnValue(mockUserClient);
    });

    it('should allow admin users to proceed', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@example.com' };
      const mockRequest = {
        user: mockUser,
        accessToken: 'admin-token'
      };

      const mockUserClient = createUserClient();
      mockUserClient.single.mockResolvedValue({
        data: { is_admin: true },
        error: null
      });

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(createUserClient).toHaveBeenCalledWith('admin-token');
      expect(mockUserClient.from).toHaveBeenCalledWith('users');
      expect(mockUserClient.select).toHaveBeenCalledWith('is_admin');
      expect(mockUserClient.eq).toHaveBeenCalledWith('id', 'admin-123');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject non-admin users', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      const mockRequest = {
        user: mockUser,
        accessToken: 'user-token'
      };

      const mockUserClient = createUserClient();
      mockUserClient.single.mockResolvedValue({
        data: { is_admin: false },
        error: null
      });

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests without user object', async () => {
      const mockRequest = {
        accessToken: 'some-token'
      };

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors when fetching user profile', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      const mockRequest = {
        user: mockUser,
        accessToken: 'user-token'
      };

      const mockUserClient = createUserClient();
      mockUserClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch user admin status:',
        'Database connection failed'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing user profile data', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      const mockRequest = {
        user: mockUser,
        accessToken: 'user-token'
      };

      const mockUserClient = createUserClient();
      mockUserClient.single.mockResolvedValue({
        data: null,
        error: null
      });

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle exceptions in admin check', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      const mockRequest = {
        user: mockUser,
        accessToken: 'user-token'
      };

      createUserClient.mockImplementation(() => {
        throw new Error('Supabase client error');
      });

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Admin middleware error:', 'Supabase client error');
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle query execution errors', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      const mockRequest = {
        user: mockUser,
        accessToken: 'user-token'
      };

      const mockUserClient = createUserClient();
      mockUserClient.single.mockRejectedValue(new Error('Query execution failed'));

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Admin middleware error:',
        'Query execution failed'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    it('should authenticate user when valid token is provided', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      getUserFromToken.mockResolvedValue(mockUser);

      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-optional-token'
        }
      };

      await optionalAuth(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).toHaveBeenCalledWith('valid-optional-token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.accessToken).toBe('valid-optional-token');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when no token is provided', async () => {
      const mockRequest = {
        headers: {}
      };

      await optionalAuth(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.accessToken).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token is invalid', async () => {
      getUserFromToken.mockResolvedValue(null);

      const mockRequest = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };

      await optionalAuth(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).toHaveBeenCalledWith('invalid-token');
      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.accessToken).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token verification fails', async () => {
      getUserFromToken.mockRejectedValue(new Error('Token verification error'));

      const mockRequest = {
        headers: {
          authorization: 'Bearer error-token'
        }
      };

      await optionalAuth(mockRequest, mockResponse, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Optional auth middleware error:',
        'Token verification error'
      );
      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.accessToken).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header gracefully', async () => {
      const mockRequest = {
        headers: {
          authorization: 'InvalidFormat'
        }
      };

      await optionalAuth(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.accessToken).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty Bearer token gracefully', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer '
        }
      };

      await optionalAuth(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Integration tests with Express routes', () => {
    beforeEach(() => {
      // Create fresh app for integration tests
      app = express();
      app.use(express.json());
    });

    it('should protect routes with authenticateToken middleware', async () => {
      app.get('/protected', authenticateToken, (req, res) => {
        res.json({ message: 'Protected route accessed', user: req.user });
      });

      getUserFromToken.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com'
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Protected route accessed');
      expect(response.body.user.id).toBe('user-123');
    });

    it('should reject protected routes without token', async () => {
      app.get('/protected', authenticateToken, (req, res) => {
        res.json({ message: 'Should not reach here' });
      });

      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should protect admin routes with both middlewares', async () => {
      app.get('/admin', authenticateToken, requireAdmin, (req, res) => {
        res.json({ message: 'Admin route accessed' });
      });

      const mockUser = { id: 'admin-123', email: 'admin@example.com' };
      getUserFromToken.mockResolvedValue(mockUser);

      const mockUserClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { is_admin: true },
          error: null
        })
      };
      createUserClient.mockReturnValue(mockUserClient);

      const response = await request(app).get('/admin').set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin route accessed');
    });

    it('should allow optional auth routes without token', async () => {
      app.get('/optional', optionalAuth, (req, res) => {
        res.json({
          message: 'Optional auth route',
          authenticated: !!req.user,
          user: req.user
        });
      });

      const response = await request(app).get('/optional');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
      expect(response.body.user).toBeUndefined();
    });

    it('should add user to optional auth routes with valid token', async () => {
      app.get('/optional', optionalAuth, (req, res) => {
        res.json({
          message: 'Optional auth route',
          authenticated: !!req.user,
          user: req.user
        });
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/optional')
        .set('Authorization', 'Bearer optional-token');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.user.id).toBe('user-123');
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle undefined authorization header values', async () => {
      const mockRequest = {
        headers: {
          authorization: undefined
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle null user in requireAdmin', async () => {
      const mockRequest = {
        user: null,
        accessToken: 'token'
      };

      await requireAdmin(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should handle Bearer tokens with multiple spaces', async () => {
      const mockUser = { id: 'user-123' };
      getUserFromToken.mockResolvedValue(mockUser);

      const mockRequest = {
        headers: {
          authorization: 'Bearer token1 token2'
        }
      };

      await authenticateToken(mockRequest, mockResponse, mockNext);

      // When split on space, 'Bearer token1 token2'.split(' ')[1] = 'token1'
      expect(getUserFromToken).toHaveBeenCalledWith('token1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty string token in optionalAuth', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer ""'
        }
      };

      await optionalAuth(mockRequest, mockResponse, mockNext);

      expect(getUserFromToken).toHaveBeenCalledWith('""');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
