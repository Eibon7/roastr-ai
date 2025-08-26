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
  const mockOrganizations = new Map();
  const mockIntegrations = new Map();
  const mockSessions = new Map();
  
  let userIdCounter = 1;
  let orgIdCounter = 1;

  return {
    supabaseServiceClient: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } })
          })
        })
      }),
      auth: {
        admin: {
          createUser: (userData) => {
            const userId = `user-${userIdCounter++}`;
            return Promise.resolve({
              data: { user: { id: userId, email: userData.email } },
              error: null
            });
          }
        }
      }
    },
    supabaseAnonClient: {
      auth: {
        signInWithPassword: (credentials) => {
          // Mock successful login
          const userId = `user-${userIdCounter++}`;
          const sessionToken = `session-${userId}`;
          const user = { 
            id: userId, 
            email: credentials.email,
            email_confirmed_at: new Date().toISOString()
          };
          const session = { access_token: sessionToken, user };
          
          // Create mock user data
          const userData = {
            id: userId,
            email: credentials.email,
            name: 'Test User',
            plan: 'free',
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Create mock organization
          const orgId = `org-${orgIdCounter++}`;
          const organization = {
            id: orgId,
            name: 'Test Organization',
            slug: 'test-org',
            plan_id: 'free',
            monthly_responses_limit: 100,
            monthly_responses_used: 5,
            subscription_status: 'active'
          };
          
          mockUsers.set(userId, userData);
          mockOrganizations.set(orgId, organization);
          mockSessions.set(sessionToken, { ...userData, organizations: [organization] });
          
          return Promise.resolve({
            data: { user, session },
            error: null
          });
        }
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
          
          if (table === 'integration_configs') {
            // Mock integrations - return 2 active integrations
            const mockIntegrationsData = [
              { platform: 'twitter', enabled: true, created_at: new Date().toISOString() },
              { platform: 'youtube', enabled: true, created_at: new Date().toISOString() }
            ];
            
            return {
              select: () => ({
                eq: () => Promise.resolve({
                  data: mockIntegrationsData,
                  error: null
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

describe('/api/auth/me Endpoint Integration Tests', () => {
  let app;
  let authToken;

  beforeEach(async () => {
    // Create Express app for testing
    app = express();
    app.use(bodyParser.json());
    app.use('/api/auth', authRoutes);
    
    // Login to get a valid token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.data.access_token;
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('plan');
      expect(response.body.data).toHaveProperty('is_admin');
      expect(response.body.data).toHaveProperty('created_at');
      expect(response.body.data).toHaveProperty('organizations');
      expect(response.body.data).toHaveProperty('integrations');
      
      // Verify user data structure
      expect(response.body.data.email).toBe('testuser@example.com');
      expect(response.body.data.name).toBe('Test User');
      expect(response.body.data.plan).toBe('free');
      expect(response.body.data.is_admin).toBe(false);
      
      // Verify organizations array
      expect(response.body.data.organizations).toBeInstanceOf(Array);
      expect(response.body.data.organizations).toHaveLength(1);
      expect(response.body.data.organizations[0]).toHaveProperty('id');
      expect(response.body.data.organizations[0]).toHaveProperty('name');
      expect(response.body.data.organizations[0]).toHaveProperty('plan_id');
      expect(response.body.data.organizations[0]).toHaveProperty('monthly_responses_limit');
      expect(response.body.data.organizations[0]).toHaveProperty('monthly_responses_used');
      
      // Verify integrations array
      expect(response.body.data.integrations).toBeInstanceOf(Array);
      expect(response.body.data.integrations).toHaveLength(2);
      expect(response.body.data.integrations[0]).toHaveProperty('platform');
      expect(response.body.data.integrations[0]).toHaveProperty('enabled');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'invalid-header');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should include all required user fields', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      const userData = response.body.data;
      
      // Check required fields are present and have correct types
      expect(typeof userData.id).toBe('string');
      expect(typeof userData.email).toBe('string');
      expect(typeof userData.name).toBe('string');
      expect(typeof userData.plan).toBe('string');
      expect(typeof userData.is_admin).toBe('boolean');
      expect(typeof userData.created_at).toBe('string');
      
      // Check email format
      expect(userData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      
      // Check plan is valid
      expect(['free', 'starter', 'pro', 'plus', 'custom']).toContain(userData.plan);
      
      // Check created_at is valid ISO date
      expect(new Date(userData.created_at)).toBeInstanceOf(Date);
      expect(new Date(userData.created_at).getTime()).not.toBeNaN();
    });

    it('should include organization and integration data', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      const userData = response.body.data;
      
      // Organization data
      expect(userData.organizations).toHaveLength(1);
      const org = userData.organizations[0];
      expect(typeof org.id).toBe('string');
      expect(typeof org.name).toBe('string');
      expect(typeof org.plan_id).toBe('string');
      expect(typeof org.monthly_responses_limit).toBe('number');
      expect(typeof org.monthly_responses_used).toBe('number');
      expect(org.monthly_responses_limit).toBeGreaterThan(0);
      expect(org.monthly_responses_used).toBeGreaterThanOrEqual(0);
      
      // Integration data
      expect(userData.integrations).toHaveLength(2);
      userData.integrations.forEach(integration => {
        expect(typeof integration.platform).toBe('string');
        expect(typeof integration.enabled).toBe('boolean');
        expect(typeof integration.created_at).toBe('string');
        expect(['twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok'])
          .toContain(integration.platform);
      });
    });
  });
});