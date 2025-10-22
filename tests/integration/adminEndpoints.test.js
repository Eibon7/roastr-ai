const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('../../src/routes/auth');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock Supabase
jest.mock('../../src/config/supabase', () => {
  const mockUsers = new Map();
  const mockSessions = new Map();
  let userIdCounter = 1;

  return {
    supabaseServiceClient: {
      from: (table) => {
        if (table === 'users') {
          return {
            select: (fields) => {
              if (fields === 'email') {
                return {
                  eq: (field, value) => ({
                    single: () => {
                      if (value === 'user-1') {
                        return Promise.resolve({
                          data: { email: 'admin@test.com' },
                          error: null
                        });
                      }
                      return Promise.resolve({ data: null, error: { message: 'Not found' } });
                    }
                  })
                };
              }
              return {
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: { message: 'Not found' } })
                }),
                order: () => ({
                  range: () => Promise.resolve({
                    data: [
                      {
                        id: 'user-1',
                        email: 'admin@test.com',
                        name: 'Admin User',
                        plan: 'pro',
                        is_admin: true,
                        created_at: new Date().toISOString(),
                        organizations: [{
                          id: 'org-1',
                          name: 'Test Org',
                          plan_id: 'pro',
                          monthly_responses_used: 10
                        }]
                      },
                      {
                        id: 'user-2',
                        email: 'user@test.com',
                        name: 'Regular User',
                        plan: 'free',
                        is_admin: false,
                        created_at: new Date().toISOString(),
                        organizations: [{
                          id: 'org-2',
                          name: 'User Org',
                          plan_id: 'free',
                          monthly_responses_used: 5
                        }]
                      }
                    ],
                    error: null
                  })
                })
              };
            },
            update: (updates) => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({
                    data: { id: 'user-1', ...updates },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'organizations') {
          return {
            update: () => ({
              eq: () => Promise.resolve({ error: null })
            })
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'Not found' } })
            })
          })
        };
      },
      auth: {
        admin: {
          createUser: () => Promise.resolve({
            data: { user: { id: `user-${userIdCounter++}`, email: 'test@example.com' } },
            error: null
          })
        }
      }
    },
    supabaseAnonClient: {
      auth: {
        signInWithPassword: (credentials) => {
          const isAdmin = credentials.email.includes('admin');
          const userId = `user-${userIdCounter++}`;
          const sessionToken = `session-${userId}`;
          const user = { 
            id: userId, 
            email: credentials.email,
            email_confirmed_at: new Date().toISOString()
          };
          const session = { access_token: sessionToken, user };
          
          const userData = {
            id: userId,
            email: credentials.email,
            name: 'Test User',
            plan: isAdmin ? 'pro' : 'free',
            is_admin: isAdmin,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          mockUsers.set(userId, userData);
          mockSessions.set(sessionToken, { ...userData });
          
          return Promise.resolve({
            data: { user, session },
            error: null
          });
        },
        resetPasswordForEmail: () => Promise.resolve({
          data: { message: 'Password reset email sent' },
          error: null
        })
      }
    },
    createUserClient: (token) => {
      const userSession = mockSessions.get(token);
      
      if (!userSession) {
        return {
          auth: {
            getUser: () => Promise.resolve({ 
              data: { user: null }, 
              error: { message: 'Invalid token' } 
            })
          }
        };
      }
      
      return {
        auth: {
          getUser: () => Promise.resolve({ 
            data: { user: { id: userSession.id, email: userSession.email } }, 
            error: null 
          })
        },
        from: (table) => {
          if (table === 'users') {
            return {
              select: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: userSession,
                    error: null
                  })
                })
              })
            };
          }
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null })
            })
          };
        }
      };
    },
    getUserFromToken: (token) => {
      const userSession = mockSessions.get(token);
      return Promise.resolve(userSession ? { 
        id: userSession.id, 
        email: userSession.email 
      } : null);
    }
  };
});

describe('Admin Endpoints Integration Tests', () => {
  let app;
  let adminToken;
  let userToken;

  beforeEach(async () => {
    // Create Express app for testing
    app = express();
    app.use(bodyParser.json());
    app.use('/api/auth', authRoutes);
    
    // Login admin user
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });
    
    // Issue #618 - Fix response structure access (route returns data.access_token, not data.session.access_token)
    adminToken = adminLogin.body.data.access_token;

    // Login regular user
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user@test.com',
        password: 'password123'
      });
    
    // Issue #618 - Fix response structure access (route returns data.access_token, not data.session.access_token)
    userToken = userLogin.body.data.access_token;
  });

  describe('GET /api/auth/admin/users', () => {
    it('should return users list for admin', async () => {
      const response = await request(app)
        .get('/api/auth/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('email');
      expect(response.body.data[0]).toHaveProperty('plan');
      expect(response.body.data[0]).toHaveProperty('is_admin');
    });

    it('should deny access to regular users', async () => {
      const response = await request(app)
        .get('/api/auth/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/admin/users');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /api/auth/admin/users/update-plan', () => {
    it('should update user plan for admin', async () => {
      const response = await request(app)
        .post('/api/auth/admin/users/update-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'user-1',
          newPlan: 'plus'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.newPlan).toBe('plus');
    });

    it('should validate plan value', async () => {
      const response = await request(app)
        .post('/api/auth/admin/users/update-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'user-1',
          newPlan: 'invalid_plan'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid plan');
    });

    it('should require both userId and newPlan', async () => {
      const response = await request(app)
        .post('/api/auth/admin/users/update-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'user-1'
          // Missing newPlan
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User ID and new plan are required');
    });

    it('should deny access to regular users', async () => {
      const response = await request(app)
        .post('/api/auth/admin/users/update-plan')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: 'user-1',
          newPlan: 'pro'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('POST /api/auth/admin/users/reset-password', () => {
    it('should send password reset email for admin', async () => {
      const response = await request(app)
        .post('/api/auth/admin/users/reset-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'user-1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('email');
    });

    it('should require userId', async () => {
      const response = await request(app)
        .post('/api/auth/admin/users/reset-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing userId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User ID is required');
    });

    it('should deny access to regular users', async () => {
      const response = await request(app)
        .post('/api/auth/admin/users/reset-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: 'user-1'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });
  });
});