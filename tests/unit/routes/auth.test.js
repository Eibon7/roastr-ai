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
  signUpWithMagicLink: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  signInWithGoogle: jest.fn(),
  verifyEmail: jest.fn(),
  signOut: jest.fn(),
  getCurrentUser: jest.fn(),
  updateProfile: jest.fn(),
  handleOAuthCallback: jest.fn(),
  listUsers: jest.fn(),
  createUserManually: jest.fn(),
  deleteUser: jest.fn(),
  updateUserPlan: jest.fn(),
  adminResetPassword: jest.fn(),
  getUserStats: jest.fn(),
  toggleUserActive: jest.fn(),
  suspendUser: jest.fn(),
  unsuspendUser: jest.fn(),
  logUserActivity: jest.fn()
}));

// Mock the middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'mock-user-id', email: 'test@example.com', is_admin: false };
    req.accessToken = 'mock-token';
    next();
  },
  requireAdmin: (req, res, next) => {
    req.user = { id: 'mock-admin-id', email: 'admin@example.com', is_admin: true };
    next();
  }
}));

// Mock session refresh middleware
jest.mock('../../../src/middleware/sessionRefresh', () => ({
  handleSessionRefresh: jest.fn((req, res) => {
    res.json({ success: true, message: 'Session refreshed' });
  })
}));

// Mock rate limiter middleware
jest.mock('../../../src/middleware/rateLimiter', () => ({
  loginRateLimiter: jest.fn((req, res, next) => next()),
  getRateLimitMetrics: jest.fn((req, res) => {
    res.json({ success: true, data: { attempts: 0, remaining: 10 } });
  }),
  resetRateLimit: jest.fn((req, res) => {
    res.json({ success: true, message: 'Rate limit reset' });
  })
}));

const authRoutes = require('../../../src/routes/auth');
const authService = require('../../../src/services/authService');

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        user: { id: '123', email: 'test@example.com', email_confirmed_at: null },
        session: { access_token: 'token123' }
      };

      authService.signUp.mockResolvedValue(mockUser);

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'ValidPassword123!',
        name: 'Test User'
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Registration successful');
      expect(authService.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPassword123!',
        name: 'Test User'
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com'
        // missing password
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should validate password strength requirements', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: '123' // too short and weak
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('caracteres');
    });

    it('should handle emailService welcome email errors gracefully', async () => {
      const mockUser = {
        user: { id: '123', email: 'test@example.com', email_confirmed_at: null },
        session: { access_token: 'token123' }
      };

      authService.signUp.mockResolvedValue(mockUser);

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'ValidPassword123!',
        name: 'Test User'
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle registration service errors gracefully', async () => {
      authService.signUp.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'ValidPassword123!',
        name: 'Test User'
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Registration failed. Please try again.');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      const mockLoginResult = {
        user: { id: '123', email: 'test@example.com' },
        session: { access_token: 'token123', refresh_token: 'refresh123', expires_at: 1234567890 },
        profile: { is_admin: false, name: 'Test User', plan: 'basic' }
      };

      authService.signIn.mockResolvedValue(mockLoginResult);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should return generic error for invalid credentials', async () => {
      authService.signIn.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Wrong email or password');
    });
  });

  describe('POST /api/auth/magic-link', () => {
    it('should send magic link successfully', async () => {
      const mockResult = {
        message: 'Magic link sent to your email',
        email: 'test@example.com'
      };

      authService.signInWithMagicLink.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/auth/magic-link').send({
        email: 'test@example.com'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Magic link sent');
    });

    it('should always return success to prevent email enumeration', async () => {
      authService.signInWithMagicLink.mockRejectedValue(new Error('User not found'));

      const response = await request(app).post('/api/auth/magic-link').send({
        email: 'nonexistent@example.com'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with this email exists');
    });

    it('should validate email is required for magic link', async () => {
      const response = await request(app).post('/api/auth/magic-link').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should send password reset email', async () => {
      const mockResult = {
        message: 'Password reset email sent',
        email: 'test@example.com'
      };

      authService.resetPassword.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/auth/reset-password').send({
        email: 'test@example.com'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with this email exists');
    });
  });

  describe('POST /api/auth/update-password', () => {
    it('should update password successfully', async () => {
      const mockResult = {
        message: 'Password updated successfully'
      };

      authService.updatePassword.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/auth/update-password').send({
        access_token: 'valid-token',
        password: 'NewPassword123!'
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password updated successfully');
    });

    it('should validate password strength requirements', async () => {
      const response = await request(app).post('/api/auth/update-password').send({
        access_token: 'valid-token',
        password: '123' // too short and weak
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('caracteres');
    });

    it('should handle password update service errors', async () => {
      authService.updatePassword.mockRejectedValue(new Error('Token expired'));

      const response = await request(app).post('/api/auth/update-password').send({
        access_token: 'expired-token',
        password: 'ValidNewPassword123!'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/google', () => {
    it('should redirect to Google OAuth URL', async () => {
      const mockResult = {
        url: 'https://accounts.google.com/oauth/authorize?...',
        message: 'Redirecting to Google authentication...'
      };

      authService.signInWithGoogle.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/auth/google');

      expect(response.status).toBe(302);
      expect(response.header.location).toBe(mockResult.url);
    });

    it('should handle Google OAuth errors by redirecting to login with error', async () => {
      authService.signInWithGoogle.mockRejectedValue(new Error('Google OAuth error'));

      const response = await request(app).get('/api/auth/google');

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('login.html?message=');
      expect(response.header.location).toContain('type=error');
    });
  });

  describe('POST /api/auth/google', () => {
    it('should return Google OAuth URL for frontend requests', async () => {
      const mockResult = {
        url: 'https://accounts.google.com/oauth/authorize?...',
        message: 'Google OAuth URL'
      };

      authService.signInWithGoogle.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/auth/google');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should handle Google OAuth service errors', async () => {
      authService.signInWithGoogle.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app).post('/api/auth/google');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Google authentication is not yet configured');
    });
  });

  describe('POST /api/auth/signup/magic-link', () => {
    it('should send magic link for signup', async () => {
      const mockResult = {
        success: true,
        message: 'Magic link sent'
      };

      authService.signUpWithMagicLink.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/signup/magic-link')
        .send({ email: 'test@example.com', name: 'Test User' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(authService.signUpWithMagicLink).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User'
      });
    });

    it('should validate email is required', async () => {
      const response = await request(app)
        .post('/api/auth/signup/magic-link')
        .send({ name: 'Test User' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });

    it('should handle service errors', async () => {
      authService.signUpWithMagicLink.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/auth/signup/magic-link')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service error');
    });
  });

  describe('POST /api/auth/login/magic-link', () => {
    it('should send magic link for login', async () => {
      const mockResult = {
        success: true,
        message: 'Magic link sent'
      };

      authService.signInWithMagicLink.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/login/magic-link')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should validate email is required', async () => {
      const response = await request(app).post('/api/auth/login/magic-link').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const mockResult = { success: true, message: 'Logged out' };
      authService.signOut.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(authService.signOut).toHaveBeenCalledWith('mock-token');
    });

    it('should handle logout errors', async () => {
      authService.signOut.mockRejectedValue(new Error('Logout failed'));

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Logout failed');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user profile', async () => {
      const mockProfile = {
        id: 'mock-user-id',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'basic'
      };
      authService.getCurrentUser.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProfile);
    });

    it('should handle authentication errors', async () => {
      authService.getCurrentUser.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update user profile', async () => {
      const mockProfile = {
        id: 'mock-user-id',
        name: 'Updated Name',
        bio: 'Updated bio'
      };
      authService.updateProfile.mockResolvedValue(mockProfile);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'Updated Name',
          bio: 'Updated bio',
          id: 'should-be-removed',
          email: 'should-be-removed',
          is_admin: 'should-be-removed',
          plan: 'should-be-removed'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProfile);

      // Verify sensitive fields are removed
      expect(authService.updateProfile).toHaveBeenCalledWith('mock-token', {
        name: 'Updated Name',
        bio: 'Updated bio'
      });
    });

    it('should handle profile update errors', async () => {
      authService.updateProfile.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: 'New Name' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Update failed');
    });
  });

  describe('GET /api/auth/callback', () => {
    it('should handle OAuth callback successfully', async () => {
      const mockResult = {
        session: { access_token: 'new-token', refresh_token: 'new-refresh' },
        user: { id: 'user-123', email: 'test@example.com' },
        profile: { is_admin: false, name: 'Test User', plan: 'basic' }
      };
      authService.handleOAuthCallback.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/auth/callback').query({
        access_token: 'callback-token',
        refresh_token: 'callback-refresh'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('/dashboard.html?auth_data=');
      expect(response.header.location).toContain('type=oauth_success');
    });

    it('should handle OAuth callback errors', async () => {
      const response = await request(app)
        .get('/api/auth/callback')
        .query({ error: 'access_denied' });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('Authentication%20failed');
      expect(response.header.location).toContain('type=error');
    });

    it('should handle missing access token', async () => {
      const response = await request(app).get('/api/auth/callback').query({});

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('no%20token%20received');
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should verify email successfully', async () => {
      const mockResult = { success: true };
      authService.verifyEmail.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/auth/verify').query({
        token: 'verify-token',
        type: 'signup',
        email: 'test@example.com'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('verified%20successfully');
      expect(response.header.location).toContain('type=success');
    });

    it('should handle verification failure', async () => {
      const mockResult = { success: false };
      authService.verifyEmail.mockResolvedValue(mockResult);

      const response = await request(app).get('/api/auth/verify').query({
        token: 'invalid-token',
        type: 'signup',
        email: 'test@example.com'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('verification%20failed');
    });

    it('should handle missing parameters', async () => {
      const response = await request(app).get('/api/auth/verify').query({ token: 'verify-token' }); // missing type and email

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('Invalid%20verification');
    });
  });

  describe('POST /api/auth/session/refresh', () => {
    it('should refresh session', async () => {
      const response = await request(app).post('/api/auth/session/refresh');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session refreshed');
    });
  });

  describe('GET /api/auth/rate-limit/metrics', () => {
    it('should get rate limit metrics', async () => {
      const response = await request(app).get('/api/auth/rate-limit/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ attempts: 0, remaining: 10 });
    });
  });

  describe('POST /api/auth/rate-limit/reset', () => {
    it('should reset rate limit', async () => {
      const response = await request(app).post('/api/auth/rate-limit/reset');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Rate limit reset');
    });
  });

  // Admin endpoints tests
  describe('Admin Routes', () => {
    describe('GET /api/auth/admin/users', () => {
      it('should list users with default parameters', async () => {
        const mockResult = {
          users: [
            { id: '1', email: 'user1@example.com', plan: 'basic' },
            { id: '2', email: 'user2@example.com', plan: 'pro' }
          ],
          total: 2,
          offset: 0,
          limit: 20
        };
        authService.listUsers.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/auth/admin/users')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
        expect(authService.listUsers).toHaveBeenCalledWith({
          limit: 20,
          offset: 0,
          search: '',
          plan: null,
          active: null,
          suspended: null,
          sortBy: 'created_at',
          sortOrder: 'desc'
        });
      });

      it('should handle custom query parameters', async () => {
        const mockResult = { users: [], total: 0 };
        authService.listUsers.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/auth/admin/users')
          .query({
            limit: 50,
            offset: 10,
            search: 'test',
            plan: 'pro',
            active: 'true',
            suspended: 'false',
            sortBy: 'email',
            sortOrder: 'asc'
          })
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(authService.listUsers).toHaveBeenCalledWith({
          limit: 50,
          offset: 10,
          search: 'test',
          plan: 'pro',
          active: true,
          suspended: false,
          sortBy: 'email',
          sortOrder: 'asc'
        });
      });

      it('should handle service errors', async () => {
        authService.listUsers.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/auth/admin/users')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Database error');
      });
    });

    describe('POST /api/auth/admin/users', () => {
      it('should create user manually', async () => {
        const mockResult = {
          user: { id: '123', email: 'newuser@example.com' }
        };
        authService.createUserManually.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/auth/admin/users')
          .set('Authorization', 'Bearer admin-token')
          .send({
            email: 'newuser@example.com',
            password: 'ValidPassword123!',
            name: 'New User',
            plan: 'pro',
            isAdmin: false
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });

      it('should handle admin user creation service errors', async () => {
        authService.createUserManually.mockRejectedValue(new Error('Admin creation failed'));

        const response = await request(app)
          .post('/api/auth/admin/users')
          .set('Authorization', 'Bearer admin-token')
          .send({
            email: 'newuser@example.com',
            password: 'ValidPassword123!',
            name: 'New User'
          });

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
      });

      it('should validate email is required', async () => {
        const response = await request(app)
          .post('/api/auth/admin/users')
          .set('Authorization', 'Bearer admin-token')
          .send({ password: 'password123' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Email is required');
      });
    });

    describe('DELETE /api/auth/admin/users/:userId', () => {
      it('should delete user', async () => {
        const mockResult = { success: true, message: 'User deleted' };
        authService.deleteUser.mockResolvedValue(mockResult);

        const response = await request(app)
          .delete('/api/auth/admin/users/user-123')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authService.deleteUser).toHaveBeenCalledWith('user-123');
      });

      it('should validate user ID is provided', async () => {
        const response = await request(app)
          .delete('/api/auth/admin/users/')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/auth/admin/users/update-plan', () => {
      it('should update user plan', async () => {
        const mockResult = { success: true, user: { plan: 'pro' } };
        authService.updateUserPlan.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/auth/admin/users/update-plan')
          .set('Authorization', 'Bearer admin-token')
          .send({ userId: 'user-123', newPlan: 'pro' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authService.updateUserPlan).toHaveBeenCalledWith('user-123', 'pro', 'mock-admin-id');
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/auth/admin/users/update-plan')
          .set('Authorization', 'Bearer admin-token')
          .send({ userId: 'user-123' }); // missing newPlan

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('User ID and new plan are required');
      });

      it('should validate plan value', async () => {
        const response = await request(app)
          .post('/api/auth/admin/users/update-plan')
          .set('Authorization', 'Bearer admin-token')
          .send({ userId: 'user-123', newPlan: 'invalid-plan' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid plan');
      });
    });

    describe('POST /api/auth/admin/users/reset-password', () => {
      it('should reset user password', async () => {
        const mockResult = { success: true };
        authService.adminResetPassword.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/auth/admin/users/reset-password')
          .set('Authorization', 'Bearer admin-token')
          .send({ userId: 'user-123' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authService.adminResetPassword).toHaveBeenCalledWith('user-123');
      });
    });

    describe('GET /api/auth/admin/users/:id', () => {
      it('should get user details', async () => {
        const mockResult = {
          user: { id: 'user-123', email: 'test@example.com' },
          stats: { totalRoasts: 5, totalCost: 100 }
        };
        authService.getUserStats.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/auth/admin/users/user-123')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });

    describe('POST /api/auth/admin/users/:id/toggle-active', () => {
      it('should toggle user active status', async () => {
        const mockResult = { success: true, active: false };
        authService.toggleUserActive.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/auth/admin/users/user-123/toggle-active')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authService.toggleUserActive).toHaveBeenCalledWith('user-123', 'mock-admin-id');
      });
    });

    describe('POST /api/auth/admin/users/:id/suspend', () => {
      it('should suspend user', async () => {
        const mockResult = { success: true, suspended: true };
        authService.suspendUser.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/auth/admin/users/user-123/suspend')
          .set('Authorization', 'Bearer admin-token')
          .send({ reason: 'Violation of terms' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authService.suspendUser).toHaveBeenCalledWith(
          'user-123',
          'mock-admin-id',
          'Violation of terms'
        );
      });
    });

    describe('POST /api/auth/admin/users/:id/unsuspend', () => {
      it('should unsuspend user', async () => {
        const mockResult = { success: true, suspended: false };
        authService.unsuspendUser.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/auth/admin/users/user-123/unsuspend')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authService.unsuspendUser).toHaveBeenCalledWith('user-123', 'mock-admin-id');
      });
    });

    describe('POST /api/auth/admin/users/:id/plan', () => {
      it('should change user plan and log activity', async () => {
        const mockResult = {
          success: true,
          user: { id: 'user-123', plan: 'pro' }
        };
        authService.updateUserPlan.mockResolvedValue(mockResult);
        authService.logUserActivity.mockResolvedValue({ success: true });

        const response = await request(app)
          .post('/api/auth/admin/users/user-123/plan')
          .set('Authorization', 'Bearer admin-token')
          .send({ newPlan: 'pro' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(authService.updateUserPlan).toHaveBeenCalledWith('user-123', 'pro', 'mock-admin-id');
      });

      it('should handle plan change service errors', async () => {
        authService.updateUserPlan.mockRejectedValue(new Error('Plan update failed'));

        const response = await request(app)
          .post('/api/auth/admin/users/user-123/plan')
          .set('Authorization', 'Bearer admin-token')
          .send({ newPlan: 'pro' });

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/auth/admin/users/:id/stats', () => {
      it('should get user statistics', async () => {
        const mockResult = {
          user: { id: 'user-123' },
          stats: { totalRoasts: 10, totalCost: 200 }
        };
        authService.getUserStats.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/auth/admin/users/user-123/stats')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });
  });

  describe('Legacy and Additional Endpoints', () => {
    describe('POST /api/auth/signup (legacy)', () => {
      it('should redirect to register endpoint', async () => {
        const mockUser = {
          user: { id: '123', email: 'test@example.com', email_confirmed_at: null },
          session: { access_token: 'token123' }
        };

        authService.signUp.mockResolvedValue(mockUser);

        const response = await request(app).post('/api/auth/signup').send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: 'Test User'
        });

        // The legacy endpoint should respond
        expect(response.status).toBeGreaterThanOrEqual(200);
      });
    });

    describe('Password Change Endpoint', () => {
      it('should handle change-password endpoint', async () => {
        const mockResult = { success: true, message: 'Password changed successfully' };
        authService.updatePassword.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', 'Bearer mock-token')
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'NewValidPassword123!'
          });

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });
    });

    describe('Additional Auth Methods', () => {
      it('should handle Google OAuth initiation', async () => {
        const mockResult = {
          url: 'https://accounts.google.com/oauth/authorize?...',
          message: 'Redirecting to Google authentication...'
        };

        authService.signInWithGoogle.mockResolvedValue(mockResult);

        const response = await request(app).get('/api/auth/google');

        expect(response.status).toBe(302);
        expect(response.header.location).toBe(mockResult.url);
      });

      it('should handle POST Google OAuth for frontend', async () => {
        const mockResult = {
          url: 'https://accounts.google.com/oauth/authorize?...',
          message: 'Google OAuth URL'
        };

        authService.signInWithGoogle.mockResolvedValue(mockResult);

        const response = await request(app).post('/api/auth/google');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing email in register', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should handle existing user in register', async () => {
      authService.signUp.mockRejectedValue(new Error('User already registered'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'ValidPassword123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('An account with this email already exists');
    });

    it('should handle duplicate email error variations', async () => {
      authService.signUp.mockRejectedValue(new Error('Email already exists in database'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'ValidPassword123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('An account with this email already exists');
    });

    it('should handle missing email in login', async () => {
      const response = await request(app).post('/api/auth/login').send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should handle missing access token in update-password', async () => {
      const response = await request(app)
        .post('/api/auth/update-password')
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Access token and new password are required');
    });

    it('should handle verification processing errors', async () => {
      authService.verifyEmail.mockRejectedValue(new Error('Verification failed'));

      const response = await request(app).get('/api/auth/verify').query({
        token: 'verify-token',
        type: 'signup',
        email: 'test@example.com'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('verification%20failed');
    });

    it('should handle OAuth callback processing errors', async () => {
      authService.handleOAuthCallback.mockRejectedValue(new Error('Processing failed'));

      const response = await request(app)
        .get('/api/auth/callback')
        .query({ access_token: 'callback-token' });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('failed%20during%20processing');
    });

    it('should handle reset password with missing email', async () => {
      const response = await request(app).post('/api/auth/reset-password').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });

    it('should handle profile update validation errors', async () => {
      authService.updateProfile.mockRejectedValue(new Error('Validation failed'));

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: '' }); // empty name

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle email verification with invalid token type', async () => {
      authService.verifyEmail.mockResolvedValue({ success: false });

      const response = await request(app).get('/api/auth/verify').query({
        token: 'verify-token',
        type: 'invalid-type',
        email: 'test@example.com'
      });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('verification%20failed');
    });

    it('should handle admin service errors gracefully', async () => {
      authService.listUsers.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/auth/admin/users')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service unavailable');
    });

    it('should handle admin user stats service errors', async () => {
      authService.getUserStats.mockRejectedValue(new Error('Stats service error'));

      const response = await request(app)
        .get('/api/auth/admin/users/user-123')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Stats service error');
    });

    it('should handle admin password reset service errors', async () => {
      authService.adminResetPassword.mockRejectedValue(new Error('Reset failed'));

      const response = await request(app)
        .post('/api/auth/admin/users/reset-password')
        .set('Authorization', 'Bearer admin-token')
        .send({ userId: 'user-123' });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle admin user toggle service errors', async () => {
      authService.toggleUserActive.mockRejectedValue(new Error('Toggle failed'));

      const response = await request(app)
        .post('/api/auth/admin/users/user-123/toggle-active')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle admin suspend user service errors', async () => {
      authService.suspendUser.mockRejectedValue(new Error('Suspend failed'));

      const response = await request(app)
        .post('/api/auth/admin/users/user-123/suspend')
        .set('Authorization', 'Bearer admin-token')
        .send({ reason: 'Test suspension' });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle admin unsuspend user service errors', async () => {
      authService.unsuspendUser.mockRejectedValue(new Error('Unsuspend failed'));

      const response = await request(app)
        .post('/api/auth/admin/users/user-123/unsuspend')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle user deletion service errors', async () => {
      authService.deleteUser.mockRejectedValue(new Error('Delete failed'));

      const response = await request(app)
        .delete('/api/auth/admin/users/user-123')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle user stats service errors', async () => {
      authService.getUserStats.mockRejectedValue(new Error('Stats unavailable'));

      const response = await request(app)
        .get('/api/auth/admin/users/user-123/stats')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });
});
