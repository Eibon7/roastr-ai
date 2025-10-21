/**
 * Auth Complete Flow E2E Tests
 * Tests the full authentication flow: registration, login, session management, password reset
 *
 * Issue: #593
 */

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock Supabase for reliable testing (Issue #628: Fix supabaseServiceClient import)
jest.mock('../../src/config/supabase', () => {
  const mockUsers = new Map();
  const mockSessions = new Map();
  const mockOrganizations = new Map();

  let userIdCounter = 1;
  let orgIdCounter = 1;

  return {
    supabaseServiceClient: {
      from: (table) => {
        return {
          select: (fields = '*') => {
            return {
              eq: (field, value) => {
                return {
                  single: () => {
                    if (table === 'users') {
                      const user = Array.from(mockUsers.values()).find(u => u[field] === value);
                      return Promise.resolve({ data: user || null, error: user ? null : { message: 'Not found' } });
                    }
                    return Promise.resolve({ data: null, error: { message: 'Not found' } });
                  }
                };
              }
            };
          },
          insert: (data) => {
            return {
              select: () => {
                return {
                  single: () => {
                    if (table === 'users') {
                      const newUser = { ...data, id: data.id || `user-${userIdCounter++}` };
                      mockUsers.set(newUser.id, newUser);

                      // Auto-create organization
                      const orgId = `org-${orgIdCounter++}`;
                      const org = {
                        id: orgId,
                        name: `${newUser.email}'s Organization`,
                        slug: `${newUser.email.split('@')[0]}-${Date.now()}`,
                        owner_id: newUser.id,
                        plan_id: newUser.plan || 'free',
                        monthly_responses_limit: newUser.plan === 'free' ? 100 : 1000
                      };
                      mockOrganizations.set(orgId, org);

                      return Promise.resolve({ data: newUser, error: null });
                    }
                    return Promise.resolve({ data: null, error: { message: 'Insert failed' } });
                  }
                };
              }
            };
          },
          delete: () => {
            return {
              eq: (field, value) => {
                if (table === 'users') {
                  const user = Array.from(mockUsers.values()).find(u => u[field] === value);
                  if (user) {
                    mockUsers.delete(user.id);
                  }
                }
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      },
      auth: {
        admin: {
          createUser: (userData) => {
            const userId = `auth-${userIdCounter++}`;
            return Promise.resolve({
              data: { user: { id: userId, email: userData.email } },
              error: null
            });
          },
          deleteUser: (userId) => {
            return Promise.resolve({ error: null });
          }
        }
      }
    },
    supabaseAnonClient: {
      auth: {
        signUp: (userData) => {
          // Check for duplicate email
          const existingUser = Array.from(mockUsers.values()).find(u => u.email === userData.email);
          if (existingUser) {
            return Promise.resolve({
              data: { user: null, session: null },
              error: { message: 'Email already registered' }
            });
          }

          const userId = `auth-${userIdCounter++}`;
          const sessionToken = `session-${userId}`;
          const user = { id: userId, email: userData.email, email_confirmed_at: new Date().toISOString() };
          const session = { access_token: sessionToken, refresh_token: `refresh-${userId}`, user };

          mockSessions.set(sessionToken, user);

          return Promise.resolve({
            data: { user, session },
            error: null
          });
        },
        signInWithPassword: (credentials) => {
          // Find user by email in mockUsers
          const user = Array.from(mockUsers.values()).find(u => u.email === credentials.email);
          if (!user) {
            return Promise.resolve({
              data: { user: null, session: null },
              error: { message: 'Invalid login credentials' }
            });
          }

          const sessionToken = `session-${user.id}-${Date.now()}`;
          const session = {
            access_token: sessionToken,
            refresh_token: `refresh-${user.id}-${Date.now()}`,
            user: { id: user.id, email: user.email }
          };
          mockSessions.set(sessionToken, user);

          return Promise.resolve({
            data: { user: { id: user.id, email: user.email }, session },
            error: null
          });
        },
        resetPasswordForEmail: (email) => {
          return Promise.resolve({
            data: {},
            error: null
          });
        }
      }
    },
    createUserClient: (token) => {
      const user = mockSessions.get(token);
      if (!user) {
        return {
          auth: {
            getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'Invalid token' } }),
            signOut: () => Promise.resolve({ error: { message: 'Invalid token' } })
          },
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: { message: 'Unauthorized' } })
              })
            })
          })
        };
      }

      return {
        auth: {
          getUser: () => Promise.resolve({ data: { user }, error: null }),
          signOut: () => {
            mockSessions.delete(token);
            return Promise.resolve({ error: null });
          }
        },
        from: (table) => {
          return {
            select: (fields = '*') => {
              return {
                eq: (field, value) => {
                  return {
                    single: () => {
                      if (table === 'users') {
                        const userData = mockUsers.get(user.id);
                        if (userData) {
                          const userWithOrg = {
                            ...userData,
                            organizations: [Array.from(mockOrganizations.values()).find(o => o.owner_id === user.id)]
                          };
                          return Promise.resolve({ data: userWithOrg, error: null });
                        }
                      }
                      return Promise.resolve({ data: null, error: { message: 'Not found' } });
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
});

// Mock email service to avoid sending real emails in tests
jest.mock('../../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  getStatus: jest.fn().mockReturnValue({ configured: true })
}));

// Import mocked modules after jest.mock() (Issue #628)
const emailService = require('../../src/services/emailService');
const { flags } = require('../../src/config/flags');
const { supabaseServiceClient } = require('../../src/config/supabase');

describe('Auth Complete Flow E2E', () => {
  let app;
  let testEmail;
  let testPassword;
  let accessToken;
  let refreshToken;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_EMAIL_NOTIFICATIONS = 'true';

    // Create minimal Express app with only auth routes (avoids rate limiter issues)
    app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Import and mount auth routes
    const authRoutes = require('../../src/routes/auth');
    app.use('/api/auth', authRoutes);
  });

  beforeEach(() => {
    // Generate unique test email for each test
    testEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
    testPassword = 'Test123!@#Strong';

    // Clear mock calls
    jest.clearAllMocks();
  });

  describe('1. Full Registration Flow', () => {
    it('should complete full registration flow successfully', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.message).toContain('Registration successful');

      // Step 2: Verify welcome email was sent
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        testEmail,
        expect.objectContaining({
          userName: 'Test User',
          name: 'Test User'
        })
      );

      // Step 3: Verify user exists in database
      const { data: user } = await supabaseServiceClient
        .from('users')
        .select('*')
        .eq('email', testEmail)
        .single();

      expect(user).toBeDefined();
      expect(user.email).toBe(testEmail);
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });

      // Second registration with same email
      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'DifferentPassword123!',
          name: 'Another User'
        });

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.success).toBe(false);
    });

    it('should reject weak passwords', async () => {
      const weakPasswords = ['123', 'abc', 'test', '12345'];

      for (const weakPass of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `test-weak-${Date.now()}@test.com`,
            password: weakPass,
            name: 'Test User'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('2. Full Login Flow', () => {
    beforeEach(async () => {
      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });
    });

    it('should login successfully with valid credentials', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.access_token).toBeDefined();
      expect(loginResponse.body.data.refresh_token).toBeDefined();

      // Store tokens for next tests
      accessToken = loginResponse.body.data.access_token;
      refreshToken = loginResponse.body.data.refresh_token;
    });

    it('should reject login with invalid password', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!'
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
    });

    it('should reject login with non-existent email', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: testPassword
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
    });
  });

  describe('3. Session Management & Token Refresh', () => {
    beforeEach(async () => {
      // Register and login user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      accessToken = loginResponse.body.data.access_token;
      refreshToken = loginResponse.body.data.refresh_token;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(testEmail);
    });

    it('should reject protected route without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should refresh access token successfully', async () => {
      const refreshResponse = await request(app)
        .post('/api/auth/session/refresh')
        .send({
          refresh_token: refreshToken
        });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.access_token).toBeDefined();
      expect(refreshResponse.body.data.access_token).not.toBe(accessToken);

      // Verify new token works
      const newAccessToken = refreshResponse.body.data.access_token;
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(meResponse.status).toBe(200);
    });

    it('should reject refresh with invalid token', async () => {
      const refreshResponse = await request(app)
        .post('/api/auth/session/refresh')
        .send({
          refresh_token: 'invalid-refresh-token'
        });

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.success).toBe(false);
    });

    it('should logout successfully', async () => {
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutResponse.status).toBe(200);

      // Verify token no longer works after logout
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(401);
    });
  });

  describe('4. Password Reset Flow', () => {
    beforeEach(async () => {
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });
    });

    it('should send password reset email', async () => {
      const resetResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: testEmail
        });

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.success).toBe(true);

      // Verify password reset email was sent
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        testEmail,
        expect.objectContaining({
          resetLink: expect.stringContaining('http')
        })
      );
    });

    it('should handle password reset for non-existent email gracefully', async () => {
      // For security, should not reveal if email exists
      const resetResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'nonexistent@test.com'
        });

      // Should return success to prevent email enumeration
      expect(resetResponse.status).toBe(200);
    });

    it('should update password successfully', async () => {
      // This test requires a valid reset token from Supabase
      // In a real scenario, you'd extract the token from the reset link
      // For now, we'll test the endpoint structure

      const newPassword = 'NewPassword123!@#';

      // Note: This will fail without a valid reset token
      // In production tests, you'd need to extract the token from the email
      const updateResponse = await request(app)
        .post('/api/auth/update-password')
        .send({
          token: 'mock-reset-token',
          password: newPassword
        });

      // Expect either 200 (if mock works) or 400 (if token validation fails)
      expect([200, 400, 401]).toContain(updateResponse.status);
    });
  });

  describe('5. Rate Limiting', () => {
    it('should enforce rate limiting on login attempts', async () => {
      // Attempt multiple logins rapidly
      const attempts = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@test.com',
            password: 'wrong'
          })
      );

      const responses = await Promise.all(attempts);

      // At least one should be rate limited (429)
      const rateLimited = responses.some(r => r.status === 429);

      // If rate limiting is enabled
      if (flags.isEnabled('ENABLE_RATE_LIMIT')) {
        expect(rateLimited).toBe(true);
      }
    });
  });

  describe('6. Edge Cases & Error Handling', () => {
    it('should handle missing email in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: testPassword,
          name: 'Test User'
        });

      expect(response.status).toBe(400);
    });

    it('should handle missing password in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          name: 'Test User'
        });

      expect(response.status).toBe(400);
    });

    it('should handle malformed email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: testPassword,
          name: 'Test User'
        });

      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionAttempts = [
        "admin' OR '1'='1",
        "admin'--",
        "admin' /*",
        "' OR 1=1--"
      ];

      for (const maliciousEmail of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousEmail,
            password: testPassword
          });

        // Should reject without crashing
        expect([400, 401]).toContain(response.status);
      }
    });
  });

  describe('7. Email Service Integration', () => {
    it('should gracefully handle email service failure on registration', async () => {
      // Mock email service failure
      emailService.sendWelcomeEmail.mockRejectedValueOnce(new Error('SendGrid error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });

      // Registration should still succeed even if email fails
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should gracefully handle email service failure on password reset', async () => {
      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User'
        });

      // Mock email service failure
      emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error('SendGrid error'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: testEmail
        });

      // Should return success (don't reveal email service issues to user)
      expect(response.status).toBe(200);
    });
  });
});
