/**
 * Integration Tests for Backoffice Workflow
 * Issue #371: SPEC 15 — Backoffice (MVP): thresholds globales, flags y soporte básico
 * 
 * Tests the complete backoffice workflow including:
 * - Global thresholds management
 * - Feature flags control
 * - API healthcheck monitoring
 * - Audit logging and export
 */

const request = require('supertest');
const express = require('express');
const { supabaseServiceClient } = require('../../src/config/supabase');

// Mock the Supabase client
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn()
  }
}));

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  requireAdmin: jest.fn((req, res, next) => {
    req.user = { 
      id: 'admin-123', 
      email: 'admin@roastr.ai', 
      is_admin: true,
      name: 'Test Admin'
    };
    next();
  })
}));

// Mock the admin middleware
jest.mock('../../src/middleware/isAdmin', () => ({
  isAdminMiddleware: jest.fn((req, res, next) => {
    req.user = { 
      id: 'admin-123', 
      email: 'admin@roastr.ai', 
      is_admin: true,
      name: 'Test Admin'
    };
    next();
  })
}));

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

// Mock SafeUtils
jest.mock('../../src/utils/safeUtils', () => ({
  safeUserIdPrefix: jest.fn((id) => `***${id.slice(-3)}`)
}));

// Import routes after mocking
const adminRoutes = require('../../src/routes/admin');

// Set up Express app
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Backoffice Integration Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock environment variables for API credentials
    process.env.TWITTER_BEARER_TOKEN = 'mock-twitter-token';
    process.env.YOUTUBE_API_KEY = 'mock-youtube-key';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TWITTER_BEARER_TOKEN;
    delete process.env.YOUTUBE_API_KEY;
  });

  describe('Complete Backoffice Administrative Workflow', () => {
    it('should complete full admin workflow: thresholds → flags → healthcheck → audit export', async () => {
      // Step 1: Update global thresholds
      const thresholdsUpdateResponse = await updateGlobalThresholds();
      expect(thresholdsUpdateResponse.status).toBe(200);
      expect(thresholdsUpdateResponse.body.success).toBe(true);

      // Step 2: Update feature flags
      const featureFlagResponse = await updateFeatureFlag();
      expect(featureFlagResponse.status).toBe(200);
      expect(featureFlagResponse.body.success).toBe(true);

      // Step 3: Run healthcheck
      const healthcheckResponse = await runHealthcheck();
      expect(healthcheckResponse.status).toBe(200);
      expect(healthcheckResponse.body.success).toBe(true);

      // Step 4: Export audit logs
      const auditExportResponse = await exportAuditLogs();
      expect(auditExportResponse.status).toBe(200);
      expect(auditExportResponse.headers['content-type']).toContain('text/csv');

      // Verify audit logging occurred for all actions
      expect(supabaseServiceClient.from).toHaveBeenCalledWith('admin_audit_logs');
    });

    // Helper function to update global thresholds
    async function updateGlobalThresholds() {
      // Mock database responses for thresholds update
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
                    data: {
                      id: 'global-1',
                      scope: 'global',
                      tau_roast_lower: 0.20,
                      tau_shield: 0.65,
                      tau_critical: 0.85,
                      aggressiveness: 98,
                      updated_at: '2025-01-24T10:30:00Z'
                    },
                    error: null
                  })
                })
              })
            })
          };
        }
        // Mock audit logs
        if (table === 'admin_audit_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      return request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({
          tau_roast_lower: 0.20,
          tau_shield: 0.65,
          tau_critical: 0.85,
          aggressiveness: 98
        });
    }

    // Helper function to update feature flag
    async function updateFeatureFlag() {
      // Mock database responses for feature flags
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'feature_flags') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    flag_key: 'shop_enabled',
                    flag_name: 'Shop Feature',
                    is_enabled: false,
                    category: 'backoffice'
                  },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      flag_key: 'shop_enabled',
                      flag_name: 'Shop Feature',
                      is_enabled: true,
                      updated_at: '2025-01-24T10:35:00Z'
                    },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'admin_audit_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      return request(app)
        .put('/api/admin/feature-flags/shop_enabled')
        .send({
          is_enabled: true,
          description: 'Enable shop functionality for MVP launch'
        });
    }

    // Helper function to run healthcheck
    async function runHealthcheck() {
      // Mock fetch for API calls
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      // Mock database responses for healthcheck
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
        .send({
          platforms: ['twitter', 'youtube']
        });

      // Clean up mock
      global.fetch.mockRestore();
      
      return response;
    }

    // Helper function to export audit logs
    async function exportAuditLogs() {
      // Mock audit logs data
      const mockAuditLogs = [
        {
          id: 'audit-1',
          admin_user_id: 'admin-123',
          action_type: 'global_thresholds_update',
          resource_type: 'global_shield_settings',
          description: 'Global Shield thresholds updated to 98% aggressiveness',
          created_at: '2025-01-24T10:30:00Z',
          admin_user: { email: 'admin@roastr.ai' }
        },
        {
          id: 'audit-2',
          admin_user_id: 'admin-123',
          action_type: 'feature_flag_update',
          resource_type: 'feature_flag',
          description: 'Feature flag shop_enabled enabled',
          created_at: '2025-01-24T10:35:00Z',
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
          
          // For the audit export action logging
          mockQuery.insert = jest.fn().mockResolvedValue({ error: null });
          
          return mockQuery;
        }
      });

      return request(app)
        .get('/api/admin/backoffice/audit/export?format=csv&days=1');
    }
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database error
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection timed out' }
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

    it('should validate data integrity across operations', async () => {
      // Test invalid threshold hierarchy
      const response = await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({
          tau_roast_lower: 0.80,  // Invalid: > tau_shield
          tau_shield: 0.70,
          tau_critical: 0.90,
          aggressiveness: 95
        })
        .expect(400);

      expect(response.body.error).toBe('tau_roast_lower must be less than tau_shield');
    });

    it('should maintain audit trail consistency', async () => {
      let auditLogCalls = 0;
      
      // Mock successful operations but track audit logging
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'global_shield_settings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { aggressiveness: 95 },
                  error: null
                })
              })
            }),
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { aggressiveness: 98, id: 'global-1' },
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'admin_audit_logs') {
          auditLogCalls++;
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      await request(app)
        .put('/api/admin/backoffice/thresholds')
        .send({
          tau_roast_lower: 0.20,
          tau_shield: 0.65,
          tau_critical: 0.85,
          aggressiveness: 98
        })
        .expect(200);

      // Verify audit log was created
      expect(auditLogCalls).toBe(1);
    });
  });

  describe('GDPR and Privacy Compliance', () => {
    it('should not expose sensitive user data in audit logs', async () => {
      // Mock audit logs with potentially sensitive data
      const mockAuditLogs = [
        {
          id: 'audit-1',
          admin_user_id: 'admin-123',
          action_type: 'global_thresholds_update',
          description: 'System configuration updated',
          old_value: { system_setting: 'value' },
          new_value: { system_setting: 'new_value' },
          created_at: '2025-01-24T10:00:00Z',
          admin_user: { email: 'admin@roastr.ai' } // Only admin info, no user personal data
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
            }),
            insert: jest.fn().mockResolvedValue({ error: null })
          };
          
          mockQuery.select.mockReturnValue(mockQuery);
          mockQuery.gte.mockReturnValue(mockQuery);
          mockQuery.lte.mockReturnValue(mockQuery);
          
          return mockQuery;
        }
      });

      const response = await request(app)
        .get('/api/admin/backoffice/audit/export?format=json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuditLogs);
      
      // Verify no Roastr Persona or other sensitive user data is included
      const auditData = response.body.data;
      auditData.forEach(log => {
        expect(log).not.toHaveProperty('user_persona');
        expect(log).not.toHaveProperty('user_roast_persona');
        expect(log).not.toHaveProperty('sensitive_user_data');
      });
    });
  });
});