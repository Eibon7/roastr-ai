const request = require('supertest');
const express = require('express');

// Mock logger first
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

// Mock the auth service
jest.mock('../../../src/services/authService', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  signInWithMagicLink: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  verifyEmail: jest.fn()
}));

// Mock the middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'mock-user-id', email: 'test@example.com' };
    req.accessToken = 'mock-token';
    next();
  },
  requireAdmin: (req, res, next) => next()
}));

const authRoutes = require('../../../src/routes/auth');
const authService = require('../../../src/services/authService');

describe('Auth Routes - Edge Cases', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Magic Link - Edge Cases', () => {
    it('should handle magic link with expired token', async () => {
      // Mock expired magic link error
      authService.signInWithMagicLink.mockRejectedValue(new Error('Token has expired'));

      const response = await request(app).post('/api/auth/magic-link').send({
        email: 'test@example.com'
      });

      // Should always return success to prevent enumeration
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with this email exists');
    });

    it('should handle magic link rate limiting', async () => {
      authService.signInWithMagicLink.mockRejectedValue(new Error('Too many requests'));

      const response = await request(app).post('/api/auth/magic-link').send({
        email: 'test@example.com'
      });

      // Should still return success for security
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with this email exists');
    });

    it('should handle malformed email in magic link request', async () => {
      authService.signInWithMagicLink.mockRejectedValue(new Error('Invalid email format'));

      const response = await request(app).post('/api/auth/magic-link').send({
        email: 'not-an-email'
      });

      // Should still return success for security (prevent enumeration)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with this email exists');
    });

    it('should handle empty email in magic link request', async () => {
      const response = await request(app).post('/api/auth/magic-link').send({
        email: ''
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });
  });

  describe('Password Reset - Edge Cases', () => {
    it('should handle reset password with invalid token', async () => {
      authService.updatePassword.mockRejectedValue(new Error('Invalid or expired reset token'));

      const response = await request(app).post('/api/auth/update-password').send({
        access_token: 'invalid-token',
        password: 'NewPassword123!'
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        'Failed to update password. The reset link may have expired.'
      );
    });

    it('should handle reset password with expired token', async () => {
      authService.updatePassword.mockRejectedValue(
        new Error('Token has expired. Please request a new password reset.')
      );

      const response = await request(app).post('/api/auth/update-password').send({
        access_token: 'expired-token',
        password: 'NewPassword123!'
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        'Failed to update password. The reset link may have expired.'
      );
    });

    it('should validate missing access_token in password update', async () => {
      const response = await request(app).post('/api/auth/update-password').send({
        password: 'NewPassword123!'
        // missing access_token
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token and new password are required');
    });

    it('should handle password reset for non-existent email gracefully', async () => {
      authService.resetPassword.mockRejectedValue(new Error('User not found'));

      const response = await request(app).post('/api/auth/reset-password').send({
        email: 'nonexistent@example.com'
      });

      // Should always return success to prevent enumeration
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with this email exists');
    });
  });

  describe('Login - Edge Cases', () => {
    it('should handle login with valid email but incorrect password', async () => {
      authService.signIn.mockRejectedValue(new Error('Invalid login credentials'));

      const response = await request(app).post('/api/auth/login').send({
        email: 'valid@example.com',
        password: 'WrongPassword123!'
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Wrong email or password');
    });

    it('should handle login with unverified email', async () => {
      authService.signIn.mockRejectedValue(new Error('Email not confirmed'));

      const response = await request(app).post('/api/auth/login').send({
        email: 'unverified@example.com',
        password: 'Password123!'
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Wrong email or password');
    });

    it('should handle login with suspended account', async () => {
      authService.signIn.mockRejectedValue(new Error('Account is suspended'));

      const response = await request(app).post('/api/auth/login').send({
        email: 'suspended@example.com',
        password: 'Password123!'
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Wrong email or password');
    });

    it('should handle login with malformed email', async () => {
      // Issue #1020: Zod validates email format BEFORE calling authService
      // Malformed email returns 400 (validation error), not 401 (auth error)
      const response = await request(app).post('/api/auth/login').send({
        email: 'not-an-email',
        password: 'Password123!'
      });

      expect(response.status).toBe(400); // Changed from 401: validation happens first
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email format'); // Changed: more specific
    });
  });

  describe('Registration - Edge Cases', () => {
    it('should handle registration with existing email', async () => {
      authService.signUp.mockRejectedValue(new Error('User already registered'));

      const response = await request(app).post('/api/auth/register').send({
        email: 'existing@example.com',
        password: 'Password123!',
        name: 'Test User'
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('An account with this email already exists');
    });

    it('should handle registration with blacklisted domain', async () => {
      authService.signUp.mockRejectedValue(new Error('Email domain is not allowed'));

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@blacklisted.com',
        password: 'Password123!',
        name: 'Test User'
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Registration failed. Please try again.');
    });

    it('should handle registration with extremely long name', async () => {
      const longName = 'A'.repeat(300);
      const mockUser = {
        user: { id: '123', email: 'test@example.com' },
        session: { access_token: 'token123' }
      };

      authService.signUp.mockResolvedValue(mockUser);

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Password123!',
        name: longName
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(authService.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
        name: longName
      });
    });

    it('should handle registration system error', async () => {
      authService.signUp.mockRejectedValue(new Error('Internal server error'));

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User'
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Registration failed. Please try again.');
    });
  });

  describe('Email Verification - Edge Cases', () => {
    it('should handle email verification with invalid token', async () => {
      authService.verifyEmail.mockResolvedValue({
        success: false,
        error: 'Invalid verification token'
      });

      const response = await request(app).get('/api/auth/verify').query({
        token: 'invalid-token',
        type: 'signup',
        email: 'test@example.com'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('/login.html');
      expect(response.header.location).toContain('verification%20failed');
    });

    it('should handle email verification with missing parameters', async () => {
      const response = await request(app).get('/api/auth/verify').query({
        token: 'some-token'
        // missing type and email
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('/login.html');
      expect(response.header.location).toContain('Invalid%20verification%20link');
    });

    it('should handle email verification with expired token', async () => {
      authService.verifyEmail.mockResolvedValue({
        success: false,
        error: 'Token has expired'
      });

      const response = await request(app).get('/api/auth/verify').query({
        token: 'expired-token',
        type: 'signup',
        email: 'test@example.com'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('/login.html');
      expect(response.header.location).toContain('verification%20failed');
    });

    it('should handle successful email verification', async () => {
      authService.verifyEmail.mockResolvedValue({
        success: true,
        data: { user: { id: '123', email: 'test@example.com' } }
      });

      const response = await request(app).get('/api/auth/verify').query({
        token: 'valid-token',
        type: 'signup',
        email: 'test@example.com'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('/login.html');
      expect(response.header.location).toContain('Email%20verified%20successfully');
    });
  });
});
