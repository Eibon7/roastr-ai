/**
 * Feature Flags Admin API Tests
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 */

const { createSupabaseMock } = require('../../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
    feature_flags: []
});

// Mock dependencies
jest.mock('../../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

jest.mock('../../../../src/middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    req.user = { id: 'admin-user-id', email: 'admin@test.com' };
    next();
  }
}));

jest.mock('../../../../src/utils/logger', () => ({
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

jest.mock('../../../../src/utils/safeUtils', () => ({
  safeUserIdPrefix: jest.fn(id => `safe_${id}`),
  maskEmail: jest.fn(email => email ? `${email.split('@')[0]}@***` : 'unknown-email')
}));

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const request = require('supertest');
const express = require('express');
const featureFlagsRouter = require('../../../../src/routes/admin/featureFlags');
const { supabaseServiceClient } = require('../../../../src/config/supabase');

describe('Feature Flags Admin API', () => {
  let app;
  let mockSelect, mockEq, mockUpdate, mockInsert, mockOrder, mockRange;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/admin', featureFlagsRouter);

    jest.clearAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();

    // Setup Supabase mocks with proper chaining
    mockRange = jest.fn();
    mockOrder = jest.fn();
    mockEq = jest.fn();
    mockUpdate = jest.fn();
    mockInsert = jest.fn();
    mockSelect = jest.fn();

    // Reset all mocks to return chainable objects by default
    mockSupabase.from.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
      eq: mockEq,
      order: mockOrder,
      range: mockRange
    }));
  });

  describe('GET /admin/feature-flags', () => {
    it('should return all feature flags grouped by category', async () => {
      const mockFlags = [
        {
          id: '1',
          flag_key: 'KILL_SWITCH_AUTOPOST',
          flag_name: 'Kill Switch - Autopost Global',
          description: 'Emergency kill switch',
          is_enabled: false,
          category: 'system',
          created_at: '2025-01-09T00:00:00Z',
          updated_at: '2025-01-09T00:00:00Z'
        },
        {
          id: '2',
          flag_key: 'AUTOPOST_TWITTER',
          flag_name: 'Autopost - Twitter',
          description: 'Enable Twitter autopost',
          is_enabled: true,
          category: 'autopost',
          created_at: '2025-01-09T00:00:00Z',
          updated_at: '2025-01-09T00:00:00Z'
        }
      ];

      // Mock the select chain for getting all flags: select().order().order()
      // The route calls .order() twice: once for category, once for flag_name
      const mockOrder2 = jest.fn().mockResolvedValue({
        data: mockFlags,
        error: null
      });

      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          order: mockOrder2
        })
      });

      const response = await request(app)
        .get('/admin/feature-flags')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.flags).toHaveLength(2);
      expect(response.body.data.flagsByCategory).toHaveProperty('system');
      expect(response.body.data.flagsByCategory).toHaveProperty('autopost');
      expect(response.body.data.totalCount).toBe(2);
    });

    it('should filter flags by category when provided', async () => {
      const mockFlags = [
        {
          id: '1',
          flag_key: 'KILL_SWITCH_AUTOPOST',
          flag_name: 'Kill Switch - Autopost Global',
          category: 'system',
          is_enabled: false
        }
      ];

      // Mock the select chain for filtered flags: select().order().order().eq()
      // The route calls .order() twice, then .eq() for category filter
      const mockOrder2 = jest.fn().mockReturnValue({
        eq: mockEq.mockResolvedValue({
          data: mockFlags,
          error: null
        })
      });

      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          order: mockOrder2
        })
      });

      const response = await request(app)
        .get('/admin/feature-flags?category=system')
        .expect(200);

      expect(mockEq).toHaveBeenCalledWith('category', 'system');
      expect(response.body.data.flags).toHaveLength(1);
    });

    it('should handle database errors', async () => {
      mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .get('/admin/feature-flags')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve feature flags');
    });
  });

  describe('PUT /admin/feature-flags/:flagKey', () => {
    it('should update a feature flag successfully', async () => {
      const currentFlag = {
        id: '1',
        flag_key: 'AUTOPOST_TWITTER',
        flag_name: 'Autopost - Twitter',
        is_enabled: false,
        flag_value: false,
        description: 'Old description'
      };

      const updatedFlag = {
        ...currentFlag,
        is_enabled: true,
        flag_value: true,
        description: 'Updated description',
        updated_at: '2025-01-09T01:00:00Z'
      };

      // Mock getting current flag with proper chaining
      const mockSelectSingle = jest.fn().mockResolvedValue({
        data: currentFlag,
        error: null
      });

      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedFlag,
        error: null
      });

      // Setup chainable mocks for select flow
      const selectChain = {
        eq: jest.fn().mockReturnValue({
          single: mockSelectSingle
        })
      };

      // Setup chainable mocks for update flow
      const updateChain = {
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockUpdateSingle
          })
        })
      };

      // Mock the from() calls to return appropriate chains
      supabaseServiceClient.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(selectChain) }) // First call for getting current flag
        .mockReturnValueOnce({ update: jest.fn().mockReturnValue(updateChain) }) // Second call for update
        .mockReturnValueOnce({ insert: jest.fn().mockResolvedValue({ error: null }) }); // Third call for audit log

      const response = await request(app)
        .put('/admin/feature-flags/AUTOPOST_TWITTER')
        .send({
          is_enabled: true,
          flag_value: true,
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.flag.is_enabled).toBe(true);
      expect(response.body.data.message).toContain('updated successfully');
    });

    it('should validate input parameters', async () => {
      const response = await request(app)
        .put('/admin/feature-flags/AUTOPOST_TWITTER')
        .send({
          is_enabled: 'not-a-boolean'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('is_enabled must be a boolean value');
    });

    it('should return 404 for non-existent flag', async () => {
      // Mock with proper chaining for non-existent flag
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const selectChain = {
        eq: jest.fn().mockReturnValue({
          single: mockSingle
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain)
      });

      const response = await request(app)
        .put('/admin/feature-flags/NONEXISTENT_FLAG')
        .send({
          is_enabled: true
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Feature flag not found');
    });
  });

  describe('POST /admin/kill-switch', () => {
    it('should activate kill switch successfully', async () => {
      const currentFlag = {
        flag_key: 'KILL_SWITCH_AUTOPOST',
        flag_name: 'Kill Switch - Autopost Global',
        is_enabled: false
      };

      const updatedFlag = {
        ...currentFlag,
        is_enabled: true,
        updated_at: '2025-01-09T01:00:00Z'
      };

      // Mock getting current flag with proper chaining
      const mockSelectSingle = jest.fn().mockResolvedValue({
        data: currentFlag,
        error: null
      });

      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedFlag,
        error: null
      });

      // Setup chainable mocks for select flow
      const selectChain = {
        eq: jest.fn().mockReturnValue({
          single: mockSelectSingle
        })
      };

      // Setup chainable mocks for update flow
      const updateChain = {
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockUpdateSingle
          })
        })
      };

      // Mock the from() calls to return appropriate chains
      supabaseServiceClient.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(selectChain) }) // First call for getting current flag
        .mockReturnValueOnce({ update: jest.fn().mockReturnValue(updateChain) }) // Second call for update
        .mockReturnValueOnce({ insert: jest.fn().mockResolvedValue({ error: null }) }); // Third call for audit log

      const response = await request(app)
        .post('/admin/kill-switch')
        .send({
          enabled: true,
          reason: 'Emergency maintenance'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.killSwitchEnabled).toBe(true);
      expect(response.body.data.message).toContain('activated successfully');
    });

    it('should deactivate kill switch successfully', async () => {
      const currentFlag = {
        flag_key: 'KILL_SWITCH_AUTOPOST',
        flag_name: 'Kill Switch - Autopost Global',
        is_enabled: true
      };

      const updatedFlag = {
        ...currentFlag,
        is_enabled: false,
        updated_at: '2025-01-09T01:00:00Z'
      };

      // Mock getting current flag with proper chaining
      const mockSelectSingle = jest.fn().mockResolvedValue({
        data: currentFlag,
        error: null
      });

      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedFlag,
        error: null
      });

      // Setup chainable mocks for select flow
      const selectChain = {
        eq: jest.fn().mockReturnValue({
          single: mockSelectSingle
        })
      };

      // Setup chainable mocks for update flow
      const updateChain = {
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockUpdateSingle
          })
        })
      };

      // Mock the from() calls to return appropriate chains
      supabaseServiceClient.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(selectChain) }) // First call for getting current flag
        .mockReturnValueOnce({ update: jest.fn().mockReturnValue(updateChain) }) // Second call for update
        .mockReturnValueOnce({ insert: jest.fn().mockResolvedValue({ error: null }) }); // Third call for audit log

      const response = await request(app)
        .post('/admin/kill-switch')
        .send({
          enabled: false,
          reason: 'Issue resolved'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.killSwitchEnabled).toBe(false);
      expect(response.body.data.message).toContain('deactivated successfully');
    });

    it('should validate enabled parameter', async () => {
      const response = await request(app)
        .post('/admin/kill-switch')
        .send({
          enabled: 'not-a-boolean'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('enabled must be a boolean value');
    });

    it('should return 404 if kill switch flag not found', async () => {
      // Mock with proper chaining for non-existent flag
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const selectChain = {
        eq: jest.fn().mockReturnValue({
          single: mockSingle
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain)
      });

      const response = await request(app)
        .post('/admin/kill-switch')
        .send({
          enabled: true
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Kill switch flag not found');
    });
  });

  describe('GET /admin/audit-logs', () => {
    it('should return audit logs with pagination', async () => {
      const mockLogs = [
        {
          id: '1',
          admin_user_id: 'admin-user-id',
          action_type: 'kill_switch_toggle',
          resource_type: 'kill_switch',
          resource_id: 'KILL_SWITCH_AUTOPOST',
          old_value: { enabled: false },
          new_value: { enabled: true },
          description: 'Kill switch activated',
          created_at: '2025-01-09T01:00:00Z',
          admin_user: {
            id: 'admin-user-id',
            email: 'admin@test.com',
            name: 'Admin User'
          }
        }
      ];

      // Mock the audit logs query chain: select().order().range()
      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          range: mockRange.mockResolvedValue({
            data: mockLogs,
            error: null,
            count: 1
          })
        })
      });

      const response = await request(app)
        .get('/admin/audit-logs?limit=10&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toHaveLength(1);
      expect(response.body.data.pagination).toMatchObject({
        offset: 0,
        limit: 10
      });
    });

    it('should filter logs by action type', async () => {
      // Mock the audit logs query chain with filter: select().order().range().eq()
      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          range: mockRange.mockReturnValue({
            eq: mockEq.mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      await request(app)
        .get('/admin/audit-logs?action_type=kill_switch_toggle')
        .expect(200);

      expect(mockEq).toHaveBeenCalledWith('action_type', 'kill_switch_toggle');
    });

    it('should handle database errors', async () => {
      mockRange.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .get('/admin/audit-logs')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve audit logs');
    });
  });
});
