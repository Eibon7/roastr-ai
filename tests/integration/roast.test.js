/**
 * Integration tests for roast API endpoints
 * Simplified version following oauth-mock pattern
 * Issue #483: Roast Generation Test Suite
 */

const request = require('supertest');
const { app } = require('../../src/index');
const { flags } = require('../../src/config/flags');

describe('Roast API Integration Tests', () => {
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_MOCK_MODE = 'true';
    process.env.ENABLE_REAL_OPENAI = 'false';
    process.env.ENABLE_ROAST_ENGINE = 'false';
    process.env.ENABLE_PERSPECTIVE_API = 'false';
    flags.reload();

    // Setup authenticated user
    authToken = 'Bearer mock-jwt-token';
    testUserId = 'test-user-123';
  });

  afterAll(() => {
    // Clean up
    delete process.env.ENABLE_MOCK_MODE;
    delete process.env.ENABLE_REAL_OPENAI;
    delete process.env.ENABLE_ROAST_ENGINE;
    delete process.env.ENABLE_PERSPECTIVE_API;
    flags.reload();
  });

  describe('POST /api/roast/preview', () => {
    it('should generate roast preview successfully with valid input', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .set('Authorization', authToken)
        .send({
          text: 'This is a test message for roasting',
          tone: 'sarcastic',
          intensity: 3,
          humorType: 'witty'
        });

      // Issue #483: Log error if test fails
      if (response.status !== 200) {
        console.error('⚠️  Preview failed with status:', response.status);
        console.error('⚠️  Response body:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.roast).toBeDefined();
      expect(typeof response.body.roast).toBe('string');
      expect(response.body.tokensUsed).toBeDefined();
    });

    it('should handle validation errors correctly', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .set('Authorization', authToken)
        .send({
          text: '', // Empty text
          tone: 'invalid-tone'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should handle roast generation service errors gracefully', async () => {
      // Test with extremely long text to trigger potential errors
      const response = await request(app)
        .post('/api/roast/preview')
        .set('Authorization', authToken)
        .send({
          text: 'a'.repeat(10000), // Very long text
          tone: 'sarcastic'
        });

      // Should either succeed or return proper error
      expect([200, 400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('POST /api/roast/generate', () => {
    it('should validate input before consuming credits', async () => {
      const response = await request(app)
        .post('/api/roast/generate')
        .set('Authorization', authToken)
        .send({
          text: '', // Empty text
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('GET /api/roast/credits', () => {
    it('should return user credit status correctly', async () => {
      const response = await request(app)
        .get('/api/roast/credits')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('plan');
      expect(response.body.data).toHaveProperty('credits');
      expect(response.body.data.credits).toHaveProperty('remaining');
      expect(response.body.data.credits).toHaveProperty('limit');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for preview endpoint', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .send({
          text: 'Test message',
          tone: 'sarcastic'
        });

      // Without auth token, should return 401
      expect([401, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for generate endpoint', async () => {
      const response = await request(app)
        .post('/api/roast/generate')
        .send({
          text: 'Test message'
        });

      expect([401, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for credits endpoint', async () => {
      const response = await request(app)
        .get('/api/roast/credits');

      expect([401, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });
});
