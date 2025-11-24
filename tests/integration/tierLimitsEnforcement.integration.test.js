/**
 * Integration Tests - Tier Limits Enforcement (SPEC 10)
 * End-to-end testing of tier validation in API endpoints
 */

const request = require('supertest');
const express = require('express');
const { tierMiddleware } = require('../../src/middleware/tierValidation');

// Mock external dependencies
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
    insert: jest.fn().mockReturnThis()
  }
}));

jest.mock('../../src/services/planLimitsService', () => ({
  getPlanLimits: jest.fn()
}));
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
jest.mock('../../src/config/flags', () => ({
  isEnabled: jest.fn()
}));

describe('Tier Limits Enforcement Integration', () => {
  let app;
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = require('../../src/config/supabase').supabaseServiceClient;

    // Create test app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = { id: 'test-user-123' };
      next();
    });

    // Test routes with tier validation
    app.post('/api/analysis', tierMiddleware.validateAnalysisLimit(), (req, res) =>
      res.json({ success: true, message: 'Analysis completed' })
    );

    app.post('/api/roast', tierMiddleware.validateRoastLimit(), (req, res) =>
      res.json({ success: true, message: 'Roast generated' })
    );

    app.post('/api/platform/connect', tierMiddleware.validatePlatformLimit('twitter'), (req, res) =>
      res.json({ success: true, message: 'Platform connected' })
    );

    app.post('/api/shield/action', tierMiddleware.requireShield(), (req, res) =>
      res.json({ success: true, message: 'Shield action executed' })
    );

    app.post('/api/tone/custom', tierMiddleware.requireOriginalTone(), (req, res) =>
      res.json({ success: true, message: 'Custom tone applied' })
    );

    app.post('/api/judge/embedded', tierMiddleware.requireEmbeddedJudge(), (req, res) =>
      res.json({ success: true, message: 'Embedded judge executed' })
    );

    jest.clearAllMocks();
  });

  describe('Starter Trial Tier Enforcement', () => {
    beforeEach(() => {
      // Mock starter_trial tier user
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'starter_trial', status: 'active' },
        error: null
      });

      require('../../src/services/planLimitsService').getPlanLimits.mockResolvedValue({
        monthlyAnalysisLimit: 100,
        monthlyResponsesLimit: 10,
        integrationsLimit: 1,
        shieldEnabled: false,
        customTones: false,
        embeddedJudge: false
      });
    });

    describe('Analysis Limit (100)', () => {
      it('should allow analysis when under limit', async () => {
        // Mock usage under limit
        mockSupabase.select.mockResolvedValueOnce({
          data: [{ quantity: 50 }],
          error: null
        });

        const response = await request(app).post('/api/analysis').send({ comment: 'Test comment' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should block analysis when limit exceeded', async () => {
        // Mock usage at limit
        mockSupabase.select.mockResolvedValueOnce({
          data: [{ quantity: 100 }],
          error: null
        });

        const response = await request(app).post('/api/analysis').send({ comment: 'Test comment' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('monthly_analysis_limit_exceeded');
        expect(response.body.details.upgradeRequired).toBe('starter');
      });
    });

    describe('Roast Limit (10)', () => {
      it('should allow roast when under limit', async () => {
        // Mock usage under limit
        mockSupabase.select.mockResolvedValueOnce({
          data: new Array(5), // 5 roasts
          error: null
        });

        const response = await request(app).post('/api/roast').send({ comment: 'Test comment' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should block roast when limit exceeded', async () => {
        // Mock usage at limit
        mockSupabase.select.mockResolvedValueOnce({
          data: new Array(10), // 10 roasts
          error: null
        });

        const response = await request(app).post('/api/roast').send({ comment: 'Test comment' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('monthly_roast_limit_exceeded');
        expect(response.body.details.upgradeRequired).toBe('starter');
      });
    });

    describe('Feature Access', () => {
      it('should block Shield access', async () => {
        const response = await request(app)
          .post('/api/shield/action')
          .send({ action: 'mute_user' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('shield_requires_starter_or_higher');
      });

      it('should block Original Tone access', async () => {
        const response = await request(app).post('/api/tone/custom').send({ tone: 'sarcastic' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('original_tone_requires_pro_or_higher');
      });

      it('should block Embedded Judge access', async () => {
        const response = await request(app)
          .post('/api/judge/embedded')
          .send({ criteria: 'custom' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('embedded_judge_requires_plus');
      });
    });
  });

  describe('Starter Tier Enforcement', () => {
    beforeEach(() => {
      // Mock starter tier user
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'starter', status: 'active' },
        error: null
      });

      require('../../src/services/planLimitsService').getPlanLimits.mockResolvedValue({
        monthlyAnalysisLimit: 1000,
        monthlyResponsesLimit: 100,
        integrationsLimit: 1,
        shieldEnabled: true,
        customTones: false,
        embeddedJudge: false
      });
    });

    it('should allow Shield access', async () => {
      const response = await request(app).post('/api/shield/action').send({ action: 'mute_user' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should still block Original Tone access', async () => {
      const response = await request(app).post('/api/tone/custom').send({ tone: 'sarcastic' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('original_tone_requires_pro_or_higher');
    });

    it('should enforce 1,000 analysis limit', async () => {
      // Mock usage at limit
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ quantity: 1000 }],
        error: null
      });

      const response = await request(app).post('/api/analysis').send({ comment: 'Test comment' });

      expect(response.status).toBe(403);
      expect(response.body.details.upgradeRequired).toBe('pro');
    });
  });

  describe('Pro Tier Enforcement', () => {
    beforeEach(() => {
      // Mock pro tier user
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'pro', status: 'active' },
        error: null
      });

      require('../../src/services/planLimitsService').getPlanLimits.mockResolvedValue({
        monthlyAnalysisLimit: 10000,
        monthlyResponsesLimit: 1000,
        integrationsLimit: 2,
        shieldEnabled: true,
        customTones: true,
        embeddedJudge: false
      });
    });

    it('should allow Original Tone access', async () => {
      const response = await request(app).post('/api/tone/custom').send({ tone: 'sarcastic' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should still block Embedded Judge access', async () => {
      const response = await request(app).post('/api/judge/embedded').send({ criteria: 'custom' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('embedded_judge_requires_plus');
    });

    it('should enforce 10,000 analysis limit', async () => {
      // Mock usage at limit
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ quantity: 10000 }],
        error: null
      });

      const response = await request(app).post('/api/analysis').send({ comment: 'Test comment' });

      expect(response.status).toBe(403);
      expect(response.body.details.upgradeRequired).toBe('plus');
    });
  });

  describe('Plus Tier Enforcement', () => {
    beforeEach(() => {
      // Mock plus tier user
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'plus', status: 'active' },
        error: null
      });

      require('../../src/services/planLimitsService').getPlanLimits.mockResolvedValue({
        monthlyAnalysisLimit: 100000,
        monthlyResponsesLimit: 5000,
        integrationsLimit: 2,
        shieldEnabled: true,
        customTones: true,
        embeddedJudge: true
      });

      // Mock embedded judge flag enabled
      require('../../src/config/flags').isEnabled.mockReturnValue(true);
    });

    it('should allow Embedded Judge access when flag enabled', async () => {
      const response = await request(app).post('/api/judge/embedded').send({ criteria: 'custom' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny Embedded Judge when flag disabled', async () => {
      require('../../src/config/flags').isEnabled.mockReturnValue(false);

      const response = await request(app).post('/api/judge/embedded').send({ criteria: 'custom' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('embedded_judge_not_available_yet');
    });

    it('should have high limits for analysis and roasts', async () => {
      // Mock usage under high limits
      mockSupabase.select
        .mockResolvedValueOnce({ data: [{ quantity: 50000 }], error: null }) // analysis
        .mockResolvedValueOnce({ data: new Array(2500), error: null }); // roasts

      const analysisResponse = await request(app)
        .post('/api/analysis')
        .send({ comment: 'Test comment' });

      const roastResponse = await request(app).post('/api/roast').send({ comment: 'Test comment' });

      expect(analysisResponse.status).toBe(200);
      expect(roastResponse.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'starter_trial', status: 'active' },
        error: null
      });
    });

    it('should allow action on validation service error', async () => {
      // Mock database error
      mockSupabase.select.mockRejectedValue(new Error('Database unavailable'));

      const response = await request(app).post('/api/analysis').send({ comment: 'Test comment' });

      // Should allow the action as fallback
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny feature access on validation error', async () => {
      // Mock error in feature validation
      require('../../src/services/planLimitsService').getPlanLimits.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app).post('/api/shield/action').send({ action: 'mute_user' });

      // Should deny access for security
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FEATURE_VALIDATION_ERROR');
    });
  });

  describe('Multiple Action Validation', () => {
    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'starter_trial', status: 'active' },
        error: null
      });

      // Create route that validates multiple actions
      app.post(
        '/api/complete-workflow',
        tierMiddleware.validateMultiple(['analysis', 'roast']),
        (req, res) => res.json({ success: true, message: 'Workflow completed' })
      );
    });

    it('should allow when all actions are within limits', async () => {
      // Mock usage under limits for both
      mockSupabase.select
        .mockResolvedValueOnce({ data: [{ quantity: 50 }], error: null }) // analysis
        .mockResolvedValueOnce({ data: new Array(5), error: null }); // roasts

      const response = await request(app)
        .post('/api/complete-workflow')
        .send({ comment: 'Test comment' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should block when any action exceeds limits', async () => {
      // Mock analysis under limit, roasts at limit
      mockSupabase.select
        .mockResolvedValueOnce({ data: [{ quantity: 50 }], error: null }) // analysis
        .mockResolvedValueOnce({ data: new Array(10), error: null }); // roasts at limit

      const response = await request(app)
        .post('/api/complete-workflow')
        .send({ comment: 'Test comment' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.details.validations).toBeDefined();
    });
  });

  describe('Platform Account Limits', () => {
    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: { plan: 'starter_trial', status: 'active' },
        error: null
      });

      require('../../src/services/planLimitsService').getPlanLimits.mockResolvedValue({
        integrationsLimit: 1
      });
    });

    it('should allow first platform connection', async () => {
      // Mock no existing platforms
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const response = await request(app)
        .post('/api/platform/connect')
        .send({ platform: 'twitter' });

      expect(response.status).toBe(200);
    });

    it('should block second platform connection for free tier', async () => {
      // Mock existing platform
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ platform: 'twitter', status: 'active' }],
        error: null
      });

      const response = await request(app)
        .post('/api/platform/connect')
        .send({ platform: 'twitter' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('platform_account_limit_exceeded');
    });
  });

  describe('Billing Cycle Edge Cases', () => {
    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: {
          plan: 'pro',
          status: 'active',
          current_period_start: '2024-01-15T00:00:00Z',
          current_period_end: '2024-02-15T00:00:00Z'
        },
        error: null
      });
    });

    it('should calculate usage from custom billing cycle start', async () => {
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ quantity: 500 }],
        error: null
      });

      await request(app).post('/api/analysis').send({ comment: 'Test comment' });

      // Should query from custom period start
      expect(mockSupabase.gte).toHaveBeenCalledWith(
        'created_at',
        expect.stringContaining('2024-01-15')
      );
    });
  });
});
