const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('../../src/routes/auth');
const integrationsRoutes = require('../../src/routes/integrations');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
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

// Mock Supabase entirely for integration tests
jest.mock('../../src/config/supabase', () => {
  const mockUsers = new Map();
  const mockSessions = new Map();
  const mockOrganizations = new Map();
  const mockIntegrations = new Map();

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
                      const user = Array.from(mockUsers.values()).find((u) => u[field] === value);
                      return Promise.resolve({
                        data: user || null,
                        error: user ? null : { message: 'Not found' }
                      });
                    }
                    if (table === 'organizations') {
                      const org = Array.from(mockOrganizations.values()).find(
                        (o) => o[field] === value
                      );
                      return Promise.resolve({
                        data: org || null,
                        error: org ? null : { message: 'Not found' }
                      });
                    }
                    return Promise.resolve({ data: null, error: { message: 'Not found' } });
                  },
                  order: (field, opts) => {
                    return {
                      range: (start, end) => {
                        if (table === 'users') {
                          const users = Array.from(mockUsers.values()).slice(start, end + 1);
                          return Promise.resolve({ data: users, error: null });
                        }
                        return Promise.resolve({ data: [], error: null });
                      }
                    };
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
                        plan_id: newUser.plan,
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
                  mockUsers.delete(value);
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
          const existingUser = Array.from(mockUsers.values()).find(
            (u) => u.email === userData.email
          );
          if (existingUser) {
            return Promise.resolve({
              data: null,
              error: { message: 'Email already registered' }
            });
          }

          const userId = `auth-${userIdCounter++}`;
          const sessionToken = `session-${userId}`;
          const user = {
            id: userId,
            email: userData.email,
            email_confirmed_at: new Date().toISOString()
          };
          const session = { access_token: sessionToken, user };

          mockSessions.set(sessionToken, user);

          return Promise.resolve({
            data: { user, session },
            error: null
          });
        },
        signInWithPassword: (credentials) => {
          // Simple mock - in real tests you'd validate credentials
          const user = Array.from(mockUsers.values()).find((u) => u.email === credentials.email);
          if (!user) {
            return Promise.resolve({
              data: null,
              error: { message: 'Invalid login credentials' }
            });
          }

          const sessionToken = `session-${user.id}-${Date.now()}`;
          const session = { access_token: sessionToken, user: { id: user.id, email: user.email } };
          mockSessions.set(sessionToken, user);

          return Promise.resolve({
            data: { user: { id: user.id, email: user.email }, session },
            error: null
          });
        },
        signInWithOtp: (data) => {
          return Promise.resolve({
            data: {},
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
            getUser: () =>
              Promise.resolve({ data: { user: null }, error: { message: 'Invalid token' } })
          }
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
                  if (table === 'integration_configs') {
                    return {
                      order: (orderField, orderOpts) => {
                        const configs = Array.from(mockIntegrations.values()).filter(
                          (c) => c[field] === value
                        );
                        return Promise.resolve({ data: configs || [], error: null });
                      }
                    };
                  }

                  return {
                    single: () => {
                      if (table === 'users') {
                        const userData = mockUsers.get(user.id);
                        if (userData) {
                          // Add organization data
                          const userWithOrg = {
                            ...userData,
                            organizations: [
                              Array.from(mockOrganizations.values()).find(
                                (o) => o.owner_id === user.id
                              )
                            ]
                          };
                          return Promise.resolve({ data: userWithOrg, error: null });
                        }
                      }
                      if (table === 'organizations') {
                        const org = Array.from(mockOrganizations.values()).find(
                          (o) => o[field] === value
                        );
                        return Promise.resolve({
                          data: org || null,
                          error: org ? null : { message: 'Not found' }
                        });
                      }
                      return Promise.resolve({ data: null, error: { message: 'Not found' } });
                    },
                    order: (field, opts) => {
                      return {
                        eq: (filterField, filterValue) => {
                          if (table === 'integration_configs') {
                            const configs = Array.from(mockIntegrations.values()).filter(
                              (c) => c[filterField] === filterValue
                            );
                            return Promise.resolve({ data: configs || [], error: null });
                          }
                          return Promise.resolve({ data: [], error: null });
                        }
                      };
                    },
                    eq: (field, value) => {
                      return {
                        eq: (field2, value2) => {
                          if (table === 'integration_configs') {
                            const configs = Array.from(mockIntegrations.values()).filter(
                              (c) => c[field] === value && c[field2] === value2
                            );
                            return Promise.resolve({ data: configs || [], error: null });
                          }
                          return Promise.resolve({ data: [], error: null });
                        }
                      };
                    }
                  };
                }
              };
            },
            upsert: (data, options) => {
              return {
                select: () => {
                  return {
                    single: () => {
                      if (table === 'integration_configs') {
                        const configId = `config-${Date.now()}`;
                        const config = { ...data, id: configId };
                        mockIntegrations.set(configId, config);
                        return Promise.resolve({ data: config, error: null });
                      }
                      return Promise.resolve({ data: null, error: { message: 'Upsert failed' } });
                    }
                  };
                }
              };
            },
            update: (data) => {
              return {
                eq: (field, value) => {
                  return {
                    select: () => {
                      return {
                        single: () => {
                          if (table === 'users') {
                            const userData = mockUsers.get(value);
                            if (userData) {
                              const updated = { ...userData, ...data };
                              mockUsers.set(value, updated);
                              return Promise.resolve({ data: updated, error: null });
                            }
                          }
                          return Promise.resolve({
                            data: null,
                            error: { message: 'Update failed' }
                          });
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
    },
    getUserFromToken: (token) => {
      const user = mockSessions.get(token);
      return Promise.resolve(user || null);
    },
    checkConnection: () => {
      return Promise.resolve({ connected: true });
    }
  };
});

describe('Authentication Workflow Integration Tests', () => {
  let app;
  let testUser;
  let authToken;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(bodyParser.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/integrations', integrationsRoutes);

    testUser = null;
    authToken = null;
  });

  describe('User Registration and Login Flow', () => {
    it('should complete full user signup and login workflow', async () => {
      // 1. Register new user
      const signupResponse = await request(app).post('/api/auth/signup').send({
        email: 'testuser@example.com',
        password: 'password123',
        name: 'Test User'
      });

      if (signupResponse.status !== 201) {
        console.log('Signup response error:', signupResponse.body);
      }
      expect(signupResponse.status).toBe(201);
      expect(signupResponse.body.success).toBe(true);
      expect(signupResponse.body.data.user.email).toBe('testuser@example.com');
      expect(signupResponse.body.data.session.access_token).toBeTruthy();

      authToken = signupResponse.body.data.session.access_token;

      // 2. Get user profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.email).toBe('testuser@example.com');
      expect(profileResponse.body.data.name).toBe('Test User');
      expect(profileResponse.body.data.plan).toBe('free');
      expect(profileResponse.body.data.organizations).toHaveLength(1);

      // 3. Update profile
      const updateResponse = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Test User',
          timezone: 'America/New_York'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.name).toBe('Updated Test User');

      // 4. Login with credentials
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'testuser@example.com',
        password: 'password123'
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.user.email).toBe('testuser@example.com');

      const newToken = loginResponse.body.data.session.access_token;

      // 5. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newToken}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
    });

    it('should handle duplicate email registration', async () => {
      // First registration
      await request(app).post('/api/auth/signup').send({
        email: 'duplicate@example.com',
        password: 'password123'
      });

      // Attempt duplicate registration
      const duplicateResponse = await request(app).post('/api/auth/signup').send({
        email: 'duplicate@example.com',
        password: 'password123'
      });

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.success).toBe(false);
    });

    it('should handle invalid credentials', async () => {
      // Try to login with non-existent user
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.error).toContain('Invalid login credentials');
    });
  });

  describe('Integration Management Flow', () => {
    beforeEach(async () => {
      // Create and authenticate test user
      const signupResponse = await request(app).post('/api/auth/signup').send({
        email: 'integrationuser@example.com',
        password: 'password123',
        name: 'Integration User'
      });

      authToken = signupResponse.body.data.session.access_token;
    });

    it('should manage user integrations', async () => {
      // 1. Get available platforms
      const platformsResponse = await request(app)
        .get('/api/integrations/platforms')
        .set('Authorization', `Bearer ${authToken}`);

      expect(platformsResponse.status).toBe(200);
      expect(platformsResponse.body.success).toBe(true);
      expect(platformsResponse.body.data.platforms).toBeDefined();
      expect(platformsResponse.body.data.plan).toBe('free');

      // 2. Get current integrations (should be empty)
      const integrationsResponse = await request(app)
        .get('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`);

      if (integrationsResponse.status !== 200) {
        console.log('Integrations response error:', integrationsResponse.body);
      }
      expect(integrationsResponse.status).toBe(200);
      expect(integrationsResponse.body.success).toBe(true);
      expect(integrationsResponse.body.data).toEqual([]);

      // 3. Add Twitter integration
      const addTwitterResponse = await request(app)
        .post('/api/integrations/twitter')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: true,
          tone: 'sarcastic',
          humor_type: 'witty',
          trigger_words: ['roast', 'burn']
        });

      expect(addTwitterResponse.status).toBe(200);
      expect(addTwitterResponse.body.success).toBe(true);
      expect(addTwitterResponse.body.data.platform).toBe('twitter');
      expect(addTwitterResponse.body.data.enabled).toBe(true);

      // 4. Get integrations again (should have Twitter)
      const updatedIntegrationsResponse = await request(app)
        .get('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedIntegrationsResponse.status).toBe(200);
      expect(updatedIntegrationsResponse.body.data).toHaveLength(1);
      expect(updatedIntegrationsResponse.body.data[0].platform).toBe('twitter');

      // 5. Disable Twitter integration
      const disableResponse = await request(app)
        .post('/api/integrations/twitter/disable')
        .set('Authorization', `Bearer ${authToken}`);

      expect(disableResponse.status).toBe(200);
      expect(disableResponse.body.data.enabled).toBe(false);
    });

    it('should enforce free plan limits', async () => {
      // Add first integration (Twitter)
      await request(app)
        .post('/api/integrations/twitter')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: true });

      // Add second integration (YouTube)
      await request(app)
        .post('/api/integrations/youtube')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: true });

      // Try to add third integration (should fail for free plan)
      const thirdResponse = await request(app)
        .post('/api/integrations/bluesky')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: true });

      expect(thirdResponse.status).toBe(400);
      expect(thirdResponse.body.error).toContain('Free plan limited');
    });
  });

  describe('Authentication Middleware', () => {
    it('should protect authenticated endpoints', async () => {
      // Try to access protected endpoint without token
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('Password Reset Flow', () => {
    it('should handle password reset request', async () => {
      const resetResponse = await request(app).post('/api/auth/reset-password').send({
        email: 'user@example.com'
      });

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.success).toBe(true);
      expect(resetResponse.body.data.message).toContain('Password reset email sent');
    });

    it('should handle magic link requests', async () => {
      const magicResponse = await request(app).post('/api/auth/login/magic-link').send({
        email: 'user@example.com'
      });

      expect(magicResponse.status).toBe(200);
      expect(magicResponse.body.success).toBe(true);
      expect(magicResponse.body.data.message).toContain('Magic link sent');
    });
  });
});
