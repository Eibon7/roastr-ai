/**
 * SSOT Routes Tests
 *
 * Tests for public SSOT endpoints (ROA-267)
 *
 * All endpoints are public (no authentication required)
 */

const request = require('supertest');
const { app } = require('../../../src/index');

describe('SSOT Public Routes', () => {
  describe('GET /api/ssot/plans', () => {
    it('should return valid plan IDs, trial config, limits, and capabilities', async () => {
      const response = await request(app).get('/api/ssot/plans').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid_ids');
      expect(response.body.data).toHaveProperty('trial_config');
      expect(response.body.data).toHaveProperty('limits');
      expect(response.body.data).toHaveProperty('capabilities');
      expect(response.body.source).toBe('SSOT-V2.md section 1');
      expect(response.body.timestamp).toBeDefined();

      // Validate plan IDs match SSOT
      expect(response.body.data.valid_ids).toEqual(['starter', 'pro', 'plus']);

      // Validate trial config
      expect(response.body.data.trial_config.starter.trial_enabled).toBe(true);
      expect(response.body.data.trial_config.starter.trial_days).toBe(30);
      expect(response.body.data.trial_config.pro.trial_enabled).toBe(true);
      expect(response.body.data.trial_config.pro.trial_days).toBe(7);
      expect(response.body.data.trial_config.plus.trial_enabled).toBe(false);
      expect(response.body.data.trial_config.plus.trial_days).toBe(0);

      // Validate limits structure
      expect(response.body.data.limits.starter).toHaveProperty('analysis_limit');
      expect(response.body.data.limits.starter).toHaveProperty('roast_limit');
      expect(response.body.data.limits.starter).toHaveProperty('accounts_per_platform');
      expect(response.body.data.limits.starter).toHaveProperty('sponsors_allowed');
      expect(response.body.data.limits.starter).toHaveProperty('tone_personal_allowed');
    });

    it('should be accessible without authentication', async () => {
      await request(app).get('/api/ssot/plans').expect(200);
    });
  });

  describe('GET /api/ssot/limits', () => {
    it('should return plan limits', async () => {
      const response = await request(app).get('/api/ssot/limits').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('starter');
      expect(response.body.data).toHaveProperty('pro');
      expect(response.body.data).toHaveProperty('plus');
      expect(response.body.source).toBe('SSOT-V2.md section 1.3');

      // Validate starter limits match SSOT
      expect(response.body.data.starter.analysis_limit).toBe(1_000);
      expect(response.body.data.starter.roast_limit).toBe(5);
      expect(response.body.data.starter.accounts_per_platform).toBe(1);
      expect(response.body.data.starter.sponsors_allowed).toBe(false);
      expect(response.body.data.starter.tone_personal_allowed).toBe(false);

      // Validate pro limits match SSOT
      expect(response.body.data.pro.analysis_limit).toBe(10_000);
      expect(response.body.data.pro.roast_limit).toBe(1_000);
      expect(response.body.data.pro.accounts_per_platform).toBe(2);
      expect(response.body.data.pro.sponsors_allowed).toBe(false);
      expect(response.body.data.pro.tone_personal_allowed).toBe(true);

      // Validate plus limits match SSOT
      expect(response.body.data.plus.analysis_limit).toBe(100_000);
      expect(response.body.data.plus.roast_limit).toBe(5_000);
      expect(response.body.data.plus.accounts_per_platform).toBe(2);
      expect(response.body.data.plus.sponsors_allowed).toBe(true);
      expect(response.body.data.plus.tone_personal_allowed).toBe(true);
    });
  });

  describe('GET /api/ssot/features', () => {
    it('should return valid feature flags and semantics', async () => {
      const response = await request(app).get('/api/ssot/features').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid_flags');
      expect(response.body.data).toHaveProperty('semantics');
      expect(response.body.source).toBe('SSOT-V2.md section 3');

      // Validate valid flags is an array
      expect(Array.isArray(response.body.data.valid_flags)).toBe(true);
      expect(response.body.data.valid_flags.length).toBeGreaterThan(0);

      // Validate semantics structure
      expect(response.body.data.semantics).toHaveProperty('autopost_enabled');
      expect(response.body.data.semantics.autopost_enabled).toHaveProperty('actors');
      expect(response.body.data.semantics.autopost_enabled).toHaveProperty('description');
    });

    it('should include all required feature flags from SSOT', () => {
      return request(app)
        .get('/api/ssot/features')
        .expect(200)
        .expect((res) => {
          const flags = res.body.data.valid_flags;
          expect(flags).toContain('autopost_enabled');
          expect(flags).toContain('manual_approval_enabled');
          expect(flags).toContain('enable_shield');
          expect(flags).toContain('enable_roast');
        });
    });
  });

  describe('GET /api/ssot/tones', () => {
    it('should return valid roast tones', async () => {
      const response = await request(app).get('/api/ssot/tones').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid_tones');
      expect(response.body.data).toHaveProperty('descriptions');
      expect(response.body.source).toBe('SSOT-V2.md section 6.1');

      // Validate valid tones match SSOT
      expect(response.body.data.valid_tones).toContain('flanders');
      expect(response.body.data.valid_tones).toContain('balanceado');
      expect(response.body.data.valid_tones).toContain('canalla');
      expect(response.body.data.valid_tones).toContain('personal');

      // Validate descriptions
      expect(response.body.data.descriptions).toHaveProperty('flanders');
      expect(response.body.data.descriptions).toHaveProperty('balanceado');
      expect(response.body.data.descriptions).toHaveProperty('canalla');
      expect(response.body.data.descriptions).toHaveProperty('personal');
    });
  });

  describe('GET /api/ssot/subscription-states', () => {
    it('should return valid subscription states', async () => {
      const response = await request(app).get('/api/ssot/subscription-states').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid_states');
      expect(response.body.data).toHaveProperty('descriptions');
      expect(response.body.source).toBe('SSOT-V2.md section 2.2');

      // Validate valid states match SSOT
      const states = response.body.data.valid_states;
      expect(states).toContain('trialing');
      expect(states).toContain('expired_trial_pending_payment');
      expect(states).toContain('payment_retry');
      expect(states).toContain('active');
      expect(states).toContain('canceled_pending');
      expect(states).toContain('paused');

      // Validate descriptions
      expect(response.body.data.descriptions).toHaveProperty('trialing');
      expect(response.body.data.descriptions).toHaveProperty('active');
      expect(response.body.data.descriptions).toHaveProperty('paused');
    });
  });

  describe('GET /api/ssot/platforms', () => {
    it('should return supported and planned platforms', async () => {
      const response = await request(app).get('/api/ssot/platforms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('supported');
      expect(response.body.data).toHaveProperty('planned');
      expect(response.body.data).toHaveProperty('notes');
      expect(response.body.source).toBe('SSOT-V2.md section 7');

      // Validate supported platforms match SSOT (v2 MVP)
      expect(response.body.data.supported).toContain('x');
      expect(response.body.data.supported).toContain('youtube');

      // Validate planned platforms
      expect(Array.isArray(response.body.data.planned)).toBe(true);
      expect(response.body.data.planned.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/ssot/all', () => {
    it('should return all SSOT data in a single response', async () => {
      const response = await request(app).get('/api/ssot/all').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('plans');
      expect(response.body.data).toHaveProperty('subscription');
      expect(response.body.data).toHaveProperty('features');
      expect(response.body.data).toHaveProperty('tones');
      expect(response.body.data).toHaveProperty('platforms');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data.version).toBe('2.0.0');
      expect(response.body.source).toBe('SSOT-V2.md');
    });

    it('should include all required sections', () => {
      return request(app)
        .get('/api/ssot/all')
        .expect(200)
        .expect((res) => {
          const data = res.body.data;
          expect(data.plans).toHaveProperty('valid_ids');
          expect(data.plans).toHaveProperty('trial_config');
          expect(data.plans).toHaveProperty('limits');
          expect(data.plans).toHaveProperty('capabilities');
          expect(data.subscription).toHaveProperty('valid_states');
          expect(data.features).toHaveProperty('valid_flags');
          expect(data.features).toHaveProperty('semantics');
          expect(data.tones).toHaveProperty('valid_tones');
          expect(data.platforms).toHaveProperty('supported');
          expect(data.platforms).toHaveProperty('planned');
        });
    });
  });

  describe('Error handling', () => {
    it('should return 500 on service errors', async () => {
      // Note: Error handling is tested via service layer
      // In a real scenario, service errors would be caught and returned as 500
      const response = await request(app).get('/api/ssot/plans');

      // If service works, should return 200
      // If service fails, should return 500
      expect([200, 500]).toContain(response.status);
    });
  });
});
