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
  let originalEnv; // Review #3434156164 M1: Capture original env

  beforeAll(async () => {
    // Review #3434156164 M1: Capture original environment state
    originalEnv = {
      NODE_ENV: process.env.NODE_ENV,
      ENABLE_MOCK_MODE: process.env.ENABLE_MOCK_MODE,
      ENABLE_REAL_OPENAI: process.env.ENABLE_REAL_OPENAI,
      ENABLE_ROAST_ENGINE: process.env.ENABLE_ROAST_ENGINE,
      ENABLE_PERSPECTIVE_API: process.env.ENABLE_PERSPECTIVE_API
    };

    // Setup test environment
    process.env.NODE_ENV = 'development'; // Issue #483: Use development to see error messages
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
    // Review #3434156164 M1: Restore original environment state
    Object.keys(originalEnv).forEach((key) => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });

    // Reload flags to pick up restored config
    flags.reload();
  });

  describe('POST /api/roast/preview', () => {
    it('should generate roast preview successfully with valid input', async () => {
      const response = await request(app)
        .post('/api/roast/preview')
        .set('Authorization', authToken)
        .send({
          text: 'This is a test message for roasting',
          tone: 'Balanceado' // Issue #946: Use canonical tone format (Zod validation)
          // Issue #872: intensity and humorType removed
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

      // Review #3434156164 M2: Reject 200 for invalid input
      expect([400, 500]).toContain(response.status);

      // Review #3434156164 M2: Validate error structure
      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });

      // Review #3434156164 M2: Ensure validation error (generic or specific)
      expect(response.body.error).toMatch(/validation|length|characters|exceeds|limit/i);
    });
  });

  describe('POST /api/roast/generate', () => {
    it('should validate input before consuming credits', async () => {
      const response = await request(app)
        .post('/api/roast/generate')
        .set('Authorization', authToken)
        .send({
          text: '' // Empty text
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('GET /api/roast/credits', () => {
    it('should return user credit status correctly', async () => {
      const response = await request(app).get('/api/roast/credits').set('Authorization', authToken);

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
      const response = await request(app).post('/api/roast/preview').send({
        text: 'Test message',
        tone: 'sarcastic'
      });

      // Review #3434156164 M3: Only 401 is acceptable for auth failure
      expect(response.status).toBe(401);

      // Review #3434156164 M3: Verify error payload contains authorization language
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/auth|unauthorized|token|required/i)
      });
    });

    it('should require authentication for generate endpoint', async () => {
      const response = await request(app).post('/api/roast/generate').send({
        text: 'Test message'
      });

      // Review #3434156164 M3: Only 401 is acceptable
      expect(response.status).toBe(401);

      // Review #3434156164 M3: Verify error structure
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/auth|unauthorized|token|required/i)
      });
    });

    it('should require authentication for credits endpoint', async () => {
      const response = await request(app).get('/api/roast/credits');

      // Review #3434156164 M3: Only 401 is acceptable
      expect(response.status).toBe(401);

      // Review #3434156164 M3: Verify error structure
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/auth|unauthorized|token|required/i)
      });
    });
  });
});
