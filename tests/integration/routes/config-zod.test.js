/**
 * Integration Tests for Config Endpoints with Zod Validation
 * Issue #943: Migrar endpoints de config a Zod
 *
 * Tests PUT /api/config/:platform with Zod validation for roast_level and shield_level
 */

const request = require('supertest');
const express = require('express');

// Issue #943: Create mock BEFORE jest.mock() call (CodeRabbit Lesson #11)
let mockOrganization = { id: 'org-123', owner_id: 'user-123' };
let mockIntegrationConfig = {
  platform: 'twitter',
  enabled: true,
  roast_level: 3,
  shield_level: 3,
  tone: 'balanceado',
  response_frequency: 1.0,
  trigger_words: ['roast'],
  shield_enabled: false,
  shield_config: {},
  updated_at: new Date().toISOString()
};

const mockSupabase = {
  from: jest.fn((tableName) => {
    if (tableName === 'organizations') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: mockOrganization,
                error: null
              })
            )
          }))
        }))
      };
    }

    if (tableName === 'integration_configs') {
      return {
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: mockIntegrationConfig,
                error: null
              })
            )
          }))
        }))
      };
    }

    return {};
  }),
  _setData: (table, data) => {
    if (table === 'organizations') mockOrganization = data;
    if (table === 'integration_configs')
      mockIntegrationConfig = { ...mockIntegrationConfig, ...data };
  },
  _reset: () => {
    mockOrganization = { id: 'org-123', owner_id: 'user-123' };
    mockIntegrationConfig = {
      platform: 'twitter',
      enabled: true,
      roast_level: 3,
      shield_level: 3,
      tone: 'balanceado',
      response_frequency: 1.0,
      trigger_words: ['roast'],
      shield_enabled: false,
      shield_config: {},
      updated_at: new Date().toISOString()
    };
  }
};

// Issue #943: Reference pre-created mock in jest.mock()
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock authentication middleware BEFORE importing routes
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
  requireAdmin: (req, res, next) => next()
}));

// Import AFTER mocks are configured
const configRoutes = require('../../../src/routes/config');

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn().mockReturnValue(true)
  }
}));

jest.mock('../../../src/services/levelConfigService', () => ({
  validateLevelAccess: jest.fn().mockResolvedValue({
    allowed: true,
    currentPlan: 'pro',
    maxAllowedRoastLevel: 4,
    maxAllowedShieldLevel: 4
  }),
  getAllRoastLevels: jest.fn().mockReturnValue({}),
  getAllShieldLevels: jest.fn().mockReturnValue({})
}));

jest.mock('../../../src/services/toneCompatibilityService', () => ({
  normalizeTone: jest.fn((tone) => tone)
}));

describe('Config Endpoints - Zod Validation (Issue #943)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/config', configRoutes);

    // Reset mocks
    mockSupabase._reset();
    jest.clearAllMocks();
  });

  describe('PUT /api/config/:platform - roast_level validation', () => {
    it('should accept valid roast_level (3)', async () => {
      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });
      mockSupabase._setData('integration_configs', {
        platform: 'twitter',
        enabled: true,
        roast_level: 3,
        updated_at: new Date().toISOString()
      });

      const response = await request(app).put('/api/config/twitter').send({ roast_level: 3 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.roast_level).toBe(3);
    });

    it('should accept valid roast_level (1)', async () => {
      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });
      mockSupabase._setData('integration_configs', {
        roast_level: 1,
        updated_at: new Date().toISOString()
      });

      const response = await request(app).put('/api/config/twitter').send({ roast_level: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept valid roast_level (5)', async () => {
      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });
      mockSupabase._setData('integration_configs', {
        roast_level: 5,
        updated_at: new Date().toISOString()
      });

      const response = await request(app).put('/api/config/twitter').send({ roast_level: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject roast_level < 1 with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ roast_level: 0 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 1 and 5');
    });

    it('should reject roast_level > 5 with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ roast_level: 6 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 1 and 5');
    });

    it('should reject non-integer roast_level with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ roast_level: 3.5 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be an integer');
    });

    it('should reject string roast_level with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ roast_level: '3' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be a number');
    });

    it('should reject null roast_level with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ roast_level: null });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be a number');
    });
  });

  describe('PUT /api/config/:platform - shield_level validation', () => {
    it('should accept valid shield_level (3)', async () => {
      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });
      mockSupabase._setData('integration_configs', {
        shield_level: 3,
        updated_at: new Date().toISOString()
      });

      const response = await request(app).put('/api/config/twitter').send({ shield_level: 3 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shield_level).toBe(3);
    });

    it('should reject shield_level < 1 with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ shield_level: 0 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 1 and 5');
    });

    it('should reject shield_level > 5 with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ shield_level: 6 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 1 and 5');
    });

    it('should reject non-integer shield_level with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ shield_level: 2.7 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be an integer');
    });

    it('should reject string shield_level with Zod error', async () => {
      const response = await request(app).put('/api/config/twitter').send({ shield_level: '4' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be a number');
    });
  });

  describe('PUT /api/config/:platform - combined validation', () => {
    it('should accept both valid roast_level and shield_level', async () => {
      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });
      mockSupabase._setData('integration_configs', {
        roast_level: 4,
        shield_level: 3,
        updated_at: new Date().toISOString()
      });

      const response = await request(app)
        .put('/api/config/twitter')
        .send({ roast_level: 4, shield_level: 3 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.roast_level).toBe(4);
      expect(response.body.data.shield_level).toBe(3);
    });

    it('should reject if roast_level invalid but shield_level valid', async () => {
      const response = await request(app)
        .put('/api/config/twitter')
        .send({ roast_level: 6, shield_level: 3 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 1 and 5');
    });

    it('should reject if shield_level invalid but roast_level valid', async () => {
      const response = await request(app)
        .put('/api/config/twitter')
        .send({ roast_level: 3, shield_level: 0 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 1 and 5');
    });
  });

  describe('Plan-based validation integration', () => {
    it('should still enforce plan-based validation after Zod validation', async () => {
      const levelConfigService = require('../../../src/services/levelConfigService');

      // Mock plan validation to reject level 5
      levelConfigService.validateLevelAccess.mockResolvedValueOnce({
        allowed: false,
        reason: 'roast_level_exceeds_plan',
        message: 'Roast level 5 requires plus plan or higher. Current plan: pro',
        maxAllowedRoastLevel: 4,
        currentPlan: 'pro'
      });

      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });

      const response = await request(app).put('/api/config/twitter').send({ roast_level: 5 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Roast level 5 requires plus plan');
    });

    it('should pass Zod validation before plan-based validation', async () => {
      const levelConfigService = require('../../../src/services/levelConfigService');

      // Clear any previous calls to the mock
      levelConfigService.validateLevelAccess.mockClear();

      // Invalid Zod value should fail before reaching plan validation
      const response = await request(app).put('/api/config/twitter').send({ roast_level: 10 });

      expect(response.status).toBe(400); // Zod validation fails first
      expect(response.body.error).toContain('must be between 1 and 5');

      // Verify that plan-based validation was NOT called (short-circuit behavior)
      expect(levelConfigService.validateLevelAccess).not.toHaveBeenCalled();
    });
  });

  describe('Error message formatting', () => {
    it('should return formatted Zod error messages', async () => {
      const response = await request(app)
        .put('/api/config/twitter')
        .send({ roast_level: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(typeof response.body.error).toBe('string');
      expect(response.body.error.length).toBeGreaterThan(0);
    });

    it('should handle multiple validation errors', async () => {
      const response = await request(app).put('/api/config/twitter').send({
        roast_level: 'not-a-number',
        shield_level: 'also-invalid'
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // First error should be returned (roast_level)
      expect(response.body.error).toContain('must be a number');
    });
  });

  describe('Backward compatibility', () => {
    it('should still accept updates without roast_level or shield_level', async () => {
      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });
      mockSupabase._setData('integration_configs', {
        enabled: true,
        updated_at: new Date().toISOString()
      });

      const response = await request(app).put('/api/config/twitter').send({ enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should still accept other config fields unchanged', async () => {
      mockSupabase._setData('organizations', { id: 'org-123', owner_id: 'user-123' });
      mockSupabase._setData('integration_configs', {
        tone: 'balanceado',
        response_frequency: 0.8,
        updated_at: new Date().toISOString()
      });

      const response = await request(app).put('/api/config/twitter').send({
        tone: 'balanceado',
        response_frequency: 0.8
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
