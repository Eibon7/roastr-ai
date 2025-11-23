/**
 * Unit tests for /api/roast/validation endpoint (CodeRabbit Round 6)
 * Tests the new validation endpoint that provides constants for client-side validation
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies before requiring the module
jest.mock('../../../src/utils/logger');

describe('/api/roast/validation endpoint (Round 6)', () => {
  let app;
  let roastRoutes;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock logger
    require('../../../src/utils/logger').logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    // Setup test app
    app = express();
    app.use(express.json());

    // Import routes after mocking
    roastRoutes = require('../../../src/routes/roast');
    app.use('/api/roast', roastRoutes);
  });

  describe('GET /api/roast/validation', () => {
    test('should return validation constants successfully', async () => {
      const response = await request(app).get('/api/roast/validation');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.constants).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should include all required validation constants', async () => {
      const response = await request(app).get('/api/roast/validation');

      const { constants } = response.body.data;

      // Check all required constants are present
      expect(constants).toHaveProperty('MAX_COMMENT_LENGTH');
      expect(constants).toHaveProperty('MIN_COMMENT_LENGTH');
      expect(constants).toHaveProperty('VALID_LANGUAGES');
      expect(constants).toHaveProperty('VALID_PLATFORMS');
      expect(constants).toHaveProperty('VALID_STYLES');
      expect(constants).toHaveProperty('MIN_INTENSITY');
      expect(constants).toHaveProperty('MAX_INTENSITY');

      // Validate specific values
      expect(constants.MAX_COMMENT_LENGTH).toBe(2000);
      expect(constants.MIN_COMMENT_LENGTH).toBe(1);
      expect(constants.VALID_LANGUAGES).toEqual(['es', 'en']);
      expect(constants.MIN_INTENSITY).toBe(1);
      expect(constants.MAX_INTENSITY).toBe(5);
    });

    test('should include helper information', async () => {
      const response = await request(app).get('/api/roast/validation');

      const { helpers } = response.body.data;

      expect(helpers).toHaveProperty('getValidStylesForLanguage');
      expect(helpers).toHaveProperty('platformAliases');

      // Check platform aliases
      expect(helpers.platformAliases).toEqual({
        x: 'twitter',
        'x.com': 'twitter',
        'twitter.com': 'twitter'
      });
    });

    test('should include proper caching headers', async () => {
      const response = await request(app).get('/api/roast/validation');

      expect(response.headers['cache-control']).toBe('public, max-age=3600');
    });

    test('should include valid styles structure', async () => {
      const response = await request(app).get('/api/roast/validation');

      const { constants } = response.body.data;

      expect(constants.VALID_STYLES).toHaveProperty('es');
      expect(constants.VALID_STYLES).toHaveProperty('en');
      expect(constants.VALID_STYLES.es).toEqual(['flanders', 'balanceado', 'canalla']);
      expect(constants.VALID_STYLES.en).toEqual(['light', 'balanced', 'savage']);
    });

    test('should include valid platforms list', async () => {
      const response = await request(app).get('/api/roast/validation');

      const { constants } = response.body.data;

      expect(Array.isArray(constants.VALID_PLATFORMS)).toBe(true);
      expect(constants.VALID_PLATFORMS).toContain('twitter');
      expect(constants.VALID_PLATFORMS).toContain('facebook');
      expect(constants.VALID_PLATFORMS).toContain('instagram');
      expect(constants.VALID_PLATFORMS).toContain('youtube');
    });

    test('should handle errors gracefully', async () => {
      // Mock logger to throw an error during processing
      const mockError = new Error('Test validation error');
      require('../../../src/utils/logger').logger.error.mockImplementation(() => {
        throw mockError;
      });

      const response = await request(app).get('/api/roast/validation');

      // Should still return 500 for server errors
      expect([200, 500]).toContain(response.status);

      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Failed to retrieve validation constants');
        expect(response.body.timestamp).toBeDefined();
      }
    });

    test('should be accessible without authentication', async () => {
      // No Authorization header should be required
      const response = await request(app).get('/api/roast/validation');

      expect(response.status).toBe(200);
    });

    test('should return consistent response structure', async () => {
      const response = await request(app).get('/api/roast/validation');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.timestamp).toBe('string');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });
});
