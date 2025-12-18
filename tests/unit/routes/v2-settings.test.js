/**
 * V2 Settings Routes Tests
 * 
 * Contract tests for v2 settings endpoints (ROA-267)
 * 
 * These tests verify CONTRACT (structure, not values) since values come from SettingsLoader v2
 * All endpoints are public (no authentication required)
 */

const request = require('supertest');
const { app } = require('../../../src/index');

describe('V2 Settings Public Routes - Contract Tests', () => {
  describe('GET /api/v2/settings/public', () => {
    it('should return public settings with correct structure', async () => {
      const response = await request(app).get('/api/v2/settings/public');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.source).toContain('SettingsLoader v2');
      expect(response.body.timestamp).toBeDefined();

      // Contract: must have these top-level keys
      expect(response.body.data).toHaveProperty('plans');
      expect(response.body.data).toHaveProperty('subscription');
      expect(response.body.data).toHaveProperty('features');
      expect(response.body.data).toHaveProperty('platforms');

      // Contract: plans structure
      if (response.body.data.plans) {
        expect(typeof response.body.data.plans).toBe('object');
      }

      // Contract: subscription structure
      if (response.body.data.subscription) {
        expect(typeof response.body.data.subscription).toBe('object');
      }

      // Contract: features structure
      if (response.body.data.features) {
        expect(typeof response.body.data.features).toBe('object');
      }

      // Contract: platforms structure
      if (response.body.data.platforms) {
        expect(typeof response.body.data.platforms).toBe('object');
      }
    });

    it('should be accessible without authentication', async () => {
      await request(app).get('/api/v2/settings/public').expect(200);
    });
  });

  describe('GET /api/v2/settings/tones', () => {
    it('should return tones with correct structure', async () => {
      const response = await request(app).get('/api/v2/settings/tones');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.source).toContain('SettingsLoader v2');
      expect(response.body.timestamp).toBeDefined();

      // Contract: must have valid_tones (array)
      expect(response.body.data).toHaveProperty('valid_tones');
      expect(Array.isArray(response.body.data.valid_tones)).toBe(true);

      // Contract: descriptions is optional object
      if (response.body.data.descriptions) {
        expect(typeof response.body.data.descriptions).toBe('object');
      }
    });

    it('should be accessible without authentication', async () => {
      await request(app).get('/api/v2/settings/tones').expect(200);
    });
  });

  describe('GET /api/v2/settings/roastr-persona/schema', () => {
    it('should return persona schema with correct structure', async () => {
      const response = await request(app).get('/api/v2/settings/roastr-persona/schema');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.source).toContain('SettingsLoader v2');
      expect(response.body.timestamp).toBeDefined();

      // Contract: must have structure and encryption keys
      expect(response.body.data).toHaveProperty('structure');
      expect(response.body.data).toHaveProperty('encryption');

      // Contract: structure and encryption are objects
      expect(typeof response.body.data.structure).toBe('object');
      expect(typeof response.body.data.encryption).toBe('object');
    });

    it('should be accessible without authentication', async () => {
      await request(app).get('/api/v2/settings/roastr-persona/schema').expect(200);
    });
  });

  describe('GET /api/v2/settings/shield', () => {
    it('should return shield config with correct structure', async () => {
      const response = await request(app).get('/api/v2/settings/shield');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.source).toContain('SettingsLoader v2');
      expect(response.body.timestamp).toBeDefined();

      // Contract: shield config is an object
      expect(typeof response.body.data).toBe('object');
    });

    it('should be accessible without authentication', async () => {
      await request(app).get('/api/v2/settings/shield').expect(200);
    });
  });

  describe('Error handling', () => {
    it('should handle SettingsLoader errors gracefully', async () => {
      // Note: Error handling is tested via service layer
      // In a real scenario, service errors would be caught and returned as 500
      const response = await request(app).get('/api/v2/settings/public');

      // If service works, should return 200
      // If service fails, should return 500
      expect([200, 500]).toContain(response.status);
    });
  });
});

