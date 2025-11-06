/**
 * Integration tests for roast API endpoints
 * Production-ready tests with real assertions
 *
 * These tests validate actual functionality using proper mocks and assertions.
 * NO flexible expectations (toBeOneOf) - tests must validate exact behavior.
 */

const request = require('supertest');

// Mock dependencies BEFORE requiring routes
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    // Issue #483: Mock authentication - set test user
    req.user = { id: 'test-user-123' };
    next();
  }),
  requireAdmin: jest.fn((req, res, next) => next()),
  optionalAuth: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-123' };
    next();
  })
}));

jest.mock('../../src/middleware/requirePlan', () => ({
  requirePlan: jest.fn(() => (req, res, next) => next())
}));

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
    supabaseServiceClient: mockSupabaseClient
  };
});

// Issue #483: Mock RoastGeneratorEnhanced class properly
const mockGenerateRoast = jest.fn();
jest.mock('../../src/services/roastGeneratorEnhanced', () => {
  return jest.fn().mockImplementation(() => ({
    generateRoast: mockGenerateRoast,
    generateRoastPreview: mockGenerateRoast, // Same mock for preview
    isAvailable: jest.fn().mockReturnValue(true)
  }));
});

const mockAnalyzeContent = jest.fn();
jest.mock('../../src/services/perspectiveService', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeContent: mockAnalyzeContent,
    isAvailable: jest.fn().mockReturnValue(true)
  }));
});

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

  const testUserId = 'test-user-123';
  const authToken = 'Bearer mock-jwt-token';

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'https://test.example.com';
    process.env.JWT_SECRET = 'test-secret';
    // Issue #483: Disable real OpenAI to use mock generator
    process.env.ENABLE_REAL_OPENAI = 'false';
    process.env.ENABLE_ROAST_ENGINE = 'false';

    // Clear require cache to force fresh imports with mocks
    jest.resetModules();

    // NOW require modules - they will use mocks
    const indexModule = require('../../src/index');
    app = indexModule.app;

    const supabaseModule = require('../../src/config/supabase');
    supabaseServiceClient = supabaseModule.supabaseServiceClient;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock behaviors - use global mocks defined at top of file
    mockAnalyzeContent.mockResolvedValue({
      safe: true,
      attributes: {}
    });

    mockGenerateRoast.mockResolvedValue({
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

      // Debug: Log response for investigation
      if (response.status !== 200) {
        console.error('DEBUG - Response status:', response.status);
        console.error('DEBUG - Response body:', JSON.stringify(response.body, null, 2));
      }

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        roast: 'This is a generated roast',
        tokensUsed: 150
      });

      // Verify interactions
      expect(mockAnalyzeContent).toHaveBeenCalledWith('This is a test message for roasting');
      expect(mockGenerateRoast).toHaveBeenCalledWith(
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
      mockAnalyzeContent.mockResolvedValueOnce({
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
      expect(mockGenerateRoast).not.toHaveBeenCalled();
    });

    it('should handle roast generation service errors gracefully', async () => {
      mockGenerateRoast.mockRejectedValueOnce(new Error('OpenAI service unavailable'));

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
      expect(mockGenerateRoast).not.toHaveBeenCalled();
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
