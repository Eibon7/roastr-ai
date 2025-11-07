/**
 * Integration tests for roast API endpoints
 * Production-ready tests with real assertions
 *
 * These tests validate actual functionality using proper mocks and assertions.
 * NO flexible expectations (toBeOneOf) - tests must validate exact behavior.
 */

const request = require('supertest');

// Mock dependencies BEFORE requiring routes
jest.mock('../../src/config/supabase', () => {
  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    rpc: jest.fn()
  };

  return {
    supabaseServiceClient: mockSupabaseClient,
    getUserFromToken: jest.fn() // Mock auth helper for middleware
  };
});

jest.mock('../../src/services/roastGeneratorEnhanced', () => ({
  generateRoast: jest.fn()
}));

jest.mock('../../src/services/perspectiveService', () => ({
  analyzeContent: jest.fn()
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

describe('Roast API Integration Tests', () => {
  let app;
  let supabaseServiceClient;
  let getUserFromToken;
  let generateRoast;
  let analyzeContent;

  const testUserId = 'test-user-123';
  const authToken = 'Bearer mock-jwt-token';

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'https://test.example.com';
    process.env.JWT_SECRET = 'test-secret';

    // Clear require cache to force fresh imports with mocks
    jest.resetModules();

    // NOW require modules - they will use mocks
    const indexModule = require('../../src/index');
    app = indexModule.app;

    const supabaseModule = require('../../src/config/supabase');
    supabaseServiceClient = supabaseModule.supabaseServiceClient;
    getUserFromToken = supabaseModule.getUserFromToken;

    const roastModule = require('../../src/services/roastGeneratorEnhanced');
    generateRoast = roastModule.generateRoast;

    const perspectiveModule = require('../../src/services/perspectiveService');
    analyzeContent = perspectiveModule.analyzeContent;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authentication - return valid user for auth middleware
    getUserFromToken.mockResolvedValue({
      id: testUserId,
      email: 'test@example.com',
      plan: 'free'
    });

    // Default mock behaviors
    analyzeContent.mockResolvedValue({
      safe: true,
      attributes: {}
    });

    generateRoast.mockResolvedValue({
      roast: 'This is a generated roast',
      tokensUsed: 150,
      model: 'gpt-3.5-turbo'
    });

    // Default user data
    supabaseServiceClient.single.mockResolvedValue({
      data: {
        id: testUserId,
        email: 'test@example.com',
        plan: 'free',
        credits_remaining: 10,
        credits_limit: 100
      },
      error: null
    });
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

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        roast: 'This is a generated roast',
        tokensUsed: 150
      });

      // Verify interactions
      expect(analyzeContent).toHaveBeenCalledWith('This is a test message for roasting');
      expect(generateRoast).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'This is a test message for roasting',
          tone: 'sarcastic',
          intensity: 3,
          humorType: 'witty'
        })
      );
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
      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.stringContaining('Text cannot be empty')
        ])
      });
    });

    it('should reject toxic content properly', async () => {
      // Mock Perspective API rejecting content
      analyzeContent.mockResolvedValueOnce({
        safe: false,
        attributes: {
          TOXICITY: 0.95,
          SEVERE_TOXICITY: 0.85
        }
      });

      const response = await request(app)
        .post('/api/roast/preview')
        .set('Authorization', authToken)
        .send({
          text: 'Extremely toxic content',
          tone: 'sarcastic',
          intensity: 3,
          humorType: 'witty'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not suitable')
      });

      // Verify roast generation was NOT called
      expect(generateRoast).not.toHaveBeenCalled();
    });

    it('should handle roast generation service errors gracefully', async () => {
      generateRoast.mockRejectedValueOnce(new Error('OpenAI service unavailable'));

      const response = await request(app)
        .post('/api/roast/preview')
        .set('Authorization', authToken)
        .send({
          text: 'Test message',
          tone: 'sarcastic',
          intensity: 3
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });
  });

  describe('POST /api/roast/generate', () => {
    it('should generate roast and consume credits successfully', async () => {
      // Mock successful credit consumption
      supabaseServiceClient.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          credits_remaining: 9,
          credits_limit: 100
        },
        error: null
      });

      const response = await request(app)
        .post('/api/roast/generate')
        .set('Authorization', authToken)
        .send({
          text: 'This is a test message for roasting',
          tone: 'sarcastic',
          intensity: 3,
          humorType: 'witty'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          roast: 'This is a generated roast',
          metadata: expect.any(Object),
          credits: {
            remaining: 9,
            limit: 100
          }
        }
      });

      // Verify credit consumption RPC was called
      expect(supabaseServiceClient.rpc).toHaveBeenCalledWith(
        'consume_roast_credits',
        expect.objectContaining({
          user_id: testUserId
        })
      );
    });

    it('should reject when user has insufficient credits', async () => {
      // Mock RPC returning insufficient credits
      supabaseServiceClient.rpc.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'INSUFFICIENT_CREDITS'
        },
        error: null
      });

      const response = await request(app)
        .post('/api/roast/generate')
        .set('Authorization', authToken)
        .send({
          text: 'This is a test message',
          tone: 'sarcastic',
          intensity: 3,
          humorType: 'witty'
        });

      expect(response.status).toBe(402);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Insufficient credits'
      });

      // Verify roast generation was NOT called
      expect(generateRoast).not.toHaveBeenCalled();
    });

    it('should validate input before consuming credits', async () => {
      const response = await request(app)
        .post('/api/roast/generate')
        .set('Authorization', authToken)
        .send({
          text: '', // Invalid empty text
          tone: 'sarcastic'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });

      // Verify NO credit consumption happened
      expect(supabaseServiceClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/roast/credits', () => {
    it('should return user credit status correctly', async () => {
      supabaseServiceClient.single.mockResolvedValueOnce({
        data: {
          id: testUserId,
          plan: 'free',
          credits_remaining: 42,
          credits_limit: 100,
          billing_status: 'active'
        },
        error: null
      });

      const response = await request(app)
        .get('/api/roast/credits')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          plan: 'free',
          status: 'active',
          credits: {
            remaining: 42,
            limit: 100,
            unlimited: false
          }
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      supabaseServiceClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(app)
        .get('/api/roast/credits')
        .set('Authorization', authToken);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all roast endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/roast/preview', body: { text: 'test' } },
        { method: 'post', path: '/api/roast/generate', body: { text: 'test' } },
        { method: 'get', path: '/api/roast/credits' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .send(endpoint.body || {});

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Authentication')
        });
      }
    });
  });
});
