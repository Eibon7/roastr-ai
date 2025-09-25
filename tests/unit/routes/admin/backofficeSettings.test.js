/**
 * Unit Tests for Backoffice Settings API Routes
 * Issue #371: SPEC 15 — Backoffice (MVP): thresholds globales, flags y soporte básico
 */

const request = require('supertest');
const express = require('express');
const backofficeSettingsRoutes = require('../../../../src/routes/admin/backofficeSettings');

// Mock dependencies
jest.mock('../../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn()
  }
}));

jest.mock('../../../../src/middleware/auth', () => ({
  requireAdmin: jest.fn((req, res, next) => {
    req.user = { id: 'admin-123', email: 'admin@roastr.ai', is_admin: true };
    next();
  })
}));

jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../../src/utils/safeUtils', () => ({
  safeUserIdPrefix: jest.fn((id) => `***${id.slice(-3)}`)
}));

const { supabaseServiceClient } = require('../../../../src/config/supabase');

// Set up Express app with routes
const app = express();
app.use(express.json());
app.use('/api/admin/backoffice', backofficeSettingsRoutes);

describe('Backoffice Settings API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/backoffice/thresholds', () => {
    it('should return global thresholds successfully', async () => {
      const mockThresholds = {
        id: 'global-1',
        scope: 'global',
        tau_roast_lower: 0.25,
        tau_shield: 0.70,
        tau_critical: 0.90,
        aggressiveness: 95,
        created_at: '2025-01-24T10:00:00Z',
        updated_at: '2025-01-24T10:00:00Z'
      };

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockThresholds,
              error: null
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/admin/backoffice/thresholds')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.thresholds).toEqual(mockThresholds);
      expect(response.body.data.aggressiveness_levels).toBeDefined();
      expect(response.body.data.aggressiveness_levels[95].name).toBe('Balanced');
    });

    it('should return defaults when no global settings exist', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // No rows returned
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/admin/backoffice/thresholds')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.thresholds.tau_roast_lower).toBe(0.25);
      expect(response.body.data.thresholds.tau_shield).toBe(0.70);
      expect(response.body.data.thresholds.tau_critical).toBe(0.90);
      expect(response.body.data.thresholds.aggressiveness).toBe(95);
    });

    it('should handle database errors', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection error' }
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/admin/backoffice/thresholds')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve global thresholds');
    });
  });

  describe('PUT /api/admin/backoffice/thresholds', () => {
    it('should update global thresholds successfully', async () => {
      const newThresholds = {
        tau_roast_lower: 0.20,
        tau_shield: 0.65,
        tau_critical: 0.85,
        aggressiveness: 98
      };

      const mockUpdatedSettings = {
        id: 'global-1',
        scope: 'global',
        ...newThresholds,
        updated_at: '2025-01-24T10:30:00Z',
        updated_by: 'admin-123'
      };

      // Mock current settings for audit logging
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'global_shield_settings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    tau_roast_lower: 0.25,
                    tau_shield: 0.70,
                    tau_critical: 0.90,
                    aggressiveness: 95
                  },
                  error: null
                })
              })
            }),
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockUpdatedSettings,
                    error: null
                  })
                })
              })
            })
          };
        }
        // Mock audit logs table
        if (table === 'admin_audit_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send(newThresholds)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.thresholds).toEqual(mockUpdatedSettings);
      expect(response.body.data.message).toContain('98% aggressiveness level');
    });

    it('should validate threshold values', async () => {
      const invalidThresholds = {
        tau_roast_lower: 1.5, // Invalid: > 1
        tau_shield: 0.70,
        tau_critical: 0.90,
        aggressiveness: 95
      };

      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send(invalidThresholds)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tau_roast_lower must be a number between 0 and 1');
    });

    it('should validate threshold hierarchy', async () => {
      const invalidHierarchy = {
        tau_roast_lower: 0.80, // Invalid: >= tau_shield
        tau_shield: 0.70,
        tau_critical: 0.90,
        aggressiveness: 95
      };

      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send(invalidHierarchy)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('tau_roast_lower must be less than tau_shield');
    });

    it('should validate aggressiveness levels', async () => {
      const invalidAggressiveness = {
        tau_roast_lower: 0.25,
        tau_shield: 0.70,
        tau_critical: 0.90,
        aggressiveness: 85 // Invalid: not in [90, 95, 98, 100]
      };

      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send(invalidAggressiveness)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('aggressiveness must be one of: 90, 95, 98, 100');
    });
  });

  describe('POST /api/admin/backoffice/healthcheck', () => {
    beforeEach(() => {
      // Mock fetch globally
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch.mockRestore();
    });

    it('should perform healthcheck for all platforms when no platforms specified', async () => {
      // Mock successful API responses
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' }) // Twitter
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' }) // YouTube
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' }) // Discord
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' }); // Twitch

      // Mock environment variables
      process.env.TWITTER_BEARER_TOKEN = 'mock-twitter-token';
      process.env.YOUTUBE_API_KEY = 'mock-youtube-key';
      process.env.DISCORD_BOT_TOKEN = 'mock-discord-token';
      process.env.TWITCH_CLIENT_ID = 'mock-twitch-id';
      process.env.TWITCH_CLIENT_SECRET = 'mock-twitch-secret';

      // Mock database operations
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'healthcheck_results') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
        if (table === 'admin_audit_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      const response = await request(app)
        .post('/api/admin/backoffice/healthcheck')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall_status).toBe('OK');
      expect(response.body.data.results).toBeDefined();
      expect(Object.keys(response.body.data.results)).toContain('twitter');
      expect(Object.keys(response.body.data.results)).toContain('youtube');
    });

    it('should perform healthcheck for specific platforms only', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      process.env.TWITTER_BEARER_TOKEN = 'mock-twitter-token';

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'healthcheck_results') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
        if (table === 'admin_audit_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      const response = await request(app)
        .post('/api/admin/backoffice/healthcheck')
        .send({ platforms: ['twitter'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Object.keys(response.body.data.results)).toEqual(['twitter']);
      expect(response.body.data.results.twitter.status).toBe('OK');
    });

    it('should handle API failures', async () => {
      global.fetch.mockResolvedValueOnce({ 
        ok: false, 
        status: 401, 
        statusText: 'Unauthorized' 
      });

      process.env.TWITTER_BEARER_TOKEN = 'invalid-token';

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'healthcheck_results') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
        if (table === 'admin_audit_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      const response = await request(app)
        .post('/api/admin/backoffice/healthcheck')
        .send({ platforms: ['twitter'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall_status).toBe('FAIL');
      expect(response.body.data.results.twitter.status).toBe('FAIL');
      expect(response.body.data.results.twitter.error).toContain('401');
    });

    it('should handle missing credentials', async () => {
      // Clear environment variables
      delete process.env.TWITTER_BEARER_TOKEN;

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'healthcheck_results') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
        if (table === 'admin_audit_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      const response = await request(app)
        .post('/api/admin/backoffice/healthcheck')
        .send({ platforms: ['twitter'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results.twitter.status).toBe('FAIL');
      expect(response.body.data.results.twitter.error).toBe('Twitter API credentials not configured');
    });
  });

  describe('GET /api/admin/backoffice/healthcheck/status', () => {
    it('should return latest healthcheck status', async () => {
      const mockHealthcheckResult = {
        id: 'health-1',
        checked_by: 'admin-123',
        results: {
          twitter: { status: 'OK', response_time_ms: 150 },
          youtube: { status: 'FAIL', error: 'API key invalid' }
        },
        platforms_checked: ['twitter', 'youtube'],
        overall_status: 'FAIL',
        created_at: '2025-01-24T10:15:00Z'
      };

      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockHealthcheckResult,
                error: null
              })
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/admin/backoffice/healthcheck/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHealthcheckResult);
    });

    it('should handle no previous healthcheck results', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/admin/backoffice/healthcheck/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('No healthcheck has been performed yet');
      expect(response.body.data.overall_status).toBe('UNKNOWN');
    });
  });

  describe('GET /api/admin/backoffice/audit/export', () => {
    it('should export audit logs as CSV', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          admin_user_id: 'admin-123',
          action_type: 'global_thresholds_update',
          resource_type: 'global_shield_settings',
          resource_id: 'global',
          description: 'Global Shield thresholds updated to 98% aggressiveness level',
          created_at: '2025-01-24T10:00:00Z',
          admin_user: { email: 'admin@roastr.ai' }
        }
      ];

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'admin_audit_logs') {
          const mockQuery = {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockAuditLogs,
              error: null
            })
          };
          
          // Handle the chain of method calls
          mockQuery.select.mockReturnValue(mockQuery);
          mockQuery.gte.mockReturnValue(mockQuery);
          mockQuery.lte.mockReturnValue(mockQuery);
          
          return mockQuery;
        }
        return {
          insert: jest.fn().mockResolvedValue({ error: null })
        };
      });

      const response = await request(app)
        .get('/api/admin/backoffice/audit/export?format=csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Timestamp,Admin Email,Action Type');
      expect(response.text).toContain('admin@roastr.ai');
    });

    it('should export audit logs as JSON', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          admin_user_id: 'admin-123',
          action_type: 'feature_flag_update',
          created_at: '2025-01-24T10:00:00Z',
          admin_user: { email: 'admin@roastr.ai' }
        }
      ];

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'admin_audit_logs') {
          const mockQuery = {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockAuditLogs,
              error: null
            })
          };
          
          mockQuery.select.mockReturnValue(mockQuery);
          mockQuery.gte.mockReturnValue(mockQuery);
          mockQuery.lte.mockReturnValue(mockQuery);
          
          return mockQuery;
        }
        return {
          insert: jest.fn().mockResolvedValue({ error: null })
        };
      });

      const response = await request(app)
        .get('/api/admin/backoffice/audit/export?format=json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuditLogs);
    });

    it('should validate format parameter', async () => {
      const response = await request(app)
        .get('/api/admin/backoffice/audit/export?format=xml')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('format must be either csv or json');
    });
  });
});