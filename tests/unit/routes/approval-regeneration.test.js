/**
 * Tests for roast regeneration functionality in approval system
 * Issue #205 - Botón "Regenerar roast" en flujo de aprobación manual
 */

const request = require('supertest');
const express = require('express');

// Mock external services
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    rpc: jest.fn()
  }
}));

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => ({
    canPerformOperation: jest.fn(),
    recordUsage: jest.fn()
  }));
});

jest.mock('../../../src/services/roastGeneratorEnhanced', () => {
  return jest.fn().mockImplementation(() => ({
    generateRoast: jest.fn()
  }));
});

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock authenticateToken middleware
const mockAuthenticateToken = (req, res, next) => {
  req.user = { id: 'test-user-id', email: 'test@example.com' };
  next();
};

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

const { supabaseServiceClient } = require('../../../src/config/supabase');
const CostControlService = require('../../../src/services/costControl');
const RoastGeneratorEnhanced = require('../../../src/services/roastGeneratorEnhanced');
const approvalRoutes = require('../../../src/routes/approval');

describe('POST /api/approval/:id/regenerate', () => {
  let app;
  let mockCostControl;
  let mockRoastGenerator;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/approval', approvalRoutes);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup service mocks
    mockCostControl = new CostControlService();
    mockRoastGenerator = new RoastGeneratorEnhanced();
  });

  const mockOriginalResponse = {
    id: 'original-response-id',
    comment_id: 'comment-123',
    response_text: 'Original roast text',
    tone: 'sarcastic',
    humor_type: 'witty',
    post_status: 'pending',
    attempt_number: 1,
    comments: {
      id: 'comment-123',
      platform: 'twitter',
      platform_comment_id: 'tweet-456',
      platform_username: 'testuser',
      original_text: 'This is a toxic comment',
      toxicity_score: 0.8,
      severity_level: 'high'
    }
  };

  const mockOrgData = {
    id: 'org-123',
    plan_id: 'pro'
  };

  describe('Successful regeneration', () => {
    beforeEach(() => {
      // Setup a more comprehensive mock that handles the sequence of calls
      const mockFromChain = jest.fn();
      
      // Organization lookup
      mockFromChain.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(), 
        single: jest.fn().mockResolvedValue({ data: mockOrgData, error: null })
      });

      // Original response lookup  
      mockFromChain.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockOriginalResponse, error: null })
      });

      // Mark original as discarded
      mockFromChain.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      // Create new response
      mockFromChain.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'new-response-id',
            response_text: 'New regenerated roast text',
            tone: 'sarcastic',
            humor_type: 'witty',
            attempt_number: 2,
            created_at: '2024-01-01T12:00:00Z'
          },
          error: null
        })
      });

      // Record attempt history
      mockFromChain.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      supabaseServiceClient.from.mockImplementation(mockFromChain);

      // Mock usage check
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true,
        message: 'Operation allowed'
      });

      // Mock attempt number generation
      supabaseServiceClient.rpc.mockResolvedValue({
        data: 2,
        error: null
      });

      // Mock roast generation
      mockRoastGenerator.generateRoast.mockResolvedValue({
        roast: 'New regenerated roast text',
        metadata: {
          generation_time: 1500,
          tokens_used: 150,
          cost_cents: 5
        }
      });

      // Mock usage recording
      mockCostControl.recordUsage.mockResolvedValue();
    });

    test('should regenerate roast successfully', async () => {
      const response = await request(app)
        .post('/api/approval/original-response-id/regenerate')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Response regenerated successfully',
        data: {
          new_response: {
            id: 'new-response-id',
            response_text: 'New regenerated roast text',
            tone: 'sarcastic',
            humor_type: 'witty',
            attempt_number: 2,
            created_at: '2024-01-01T12:00:00Z'
          },
          original_response_id: 'original-response-id',
          attempt_number: 2,
          comment: {
            id: 'comment-123',
            platform: 'twitter',
            platform_username: 'testuser',
            original_text: 'This is a toxic comment',
            toxicity_score: 0.8
          }
        }
      });

      // Verify cost control checks
      expect(mockCostControl.canPerformOperation).toHaveBeenCalledWith(
        'org-123',
        'generate_reply',
        1,
        'twitter'
      );

      // Verify roast generation
      expect(mockRoastGenerator.generateRoast).toHaveBeenCalledWith(
        'This is a toxic comment',
        0.8,
        'sarcastic',
        {
          plan: 'pro',
          tone: 'sarcastic',
          humor_type: 'witty',
          intensity_level: 3
        }
      );

      // Verify usage recording
      expect(mockCostControl.recordUsage).toHaveBeenCalledWith(
        'org-123',
        'twitter',
        'generate_reply',
        {
          regeneration: true,
          original_response_id: 'original-response-id',
          tokensUsed: 150,
          cost_cents: 5
        },
        'test-user-id',
        1
      );
    });

    test('should record attempt history correctly', async () => {
      await request(app)
        .post('/api/approval/original-response-id/regenerate')
        .expect(200);

      // Check that attempt history was recorded
      const historyInsertCall = supabaseServiceClient.from.mock.calls.find(
        call => call[0] === 'roast_attempts'
      );
      expect(historyInsertCall).toBeDefined();
    });
  });

  describe('Error cases', () => {
    test('should return 404 if organization not found', async () => {
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const response = await request(app)
        .post('/api/approval/original-response-id/regenerate')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Organization not found'
      });
    });

    test('should return 404 if original response not found', async () => {
      // Mock successful organization lookup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      // Mock failed response lookup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      const response = await request(app)
        .post('/api/approval/nonexistent-id/regenerate')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Response not found or already processed'
      });
    });

    test('should return 429 if usage limit reached', async () => {
      // Mock successful lookups
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOriginalResponse,
          error: null
        })
      });

      // Mock usage limit exceeded
      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: false,
        message: 'Monthly roast limit reached'
      });

      const response = await request(app)
        .post('/api/approval/original-response-id/regenerate')
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        error: 'Usage limit reached',
        message: 'Monthly roast limit reached',
        limits_info: {
          allowed: false,
          message: 'Monthly roast limit reached'
        }
      });
    });

    test('should handle roast generation failure gracefully', async () => {
      // Mock successful setup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOriginalResponse,
          error: null
        })
      });

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      supabaseServiceClient.rpc.mockResolvedValue({
        data: 2,
        error: null
      });

      // Mock roast generation failure
      mockRoastGenerator.generateRoast.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const response = await request(app)
        .post('/api/approval/original-response-id/regenerate')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to regenerate response'
      });
    });
  });

  describe('Credit consumption', () => {
    test('should consume credits even if regeneration fails after generation', async () => {
      // Mock successful setup through generation
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOriginalResponse,
          error: null
        })
      });

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      supabaseServiceClient.rpc.mockResolvedValue({
        data: 2,
        error: null
      });

      mockRoastGenerator.generateRoast.mockResolvedValue({
        roast: 'New roast',
        metadata: { tokens_used: 150, cost_cents: 5 }
      });

      // Mock successful discard
      supabaseServiceClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      // Mock failed new response creation
      supabaseServiceClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      });

      const response = await request(app)
        .post('/api/approval/original-response-id/regenerate')
        .expect(500);

      expect(response.body.error).toBe('Failed to regenerate response');
    });
  });

  describe('Multiple regeneration attempts', () => {
    test('should handle multiple regenerations with correct attempt numbers', async () => {
      // Simulate this being the 3rd attempt
      const thirdAttemptResponse = {
        ...mockOriginalResponse,
        attempt_number: 2
      };

      // Mock successful setup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: thirdAttemptResponse,
          error: null
        })
      });

      mockCostControl.canPerformOperation.mockResolvedValue({
        allowed: true
      });

      // Return attempt number 3
      supabaseServiceClient.rpc.mockResolvedValue({
        data: 3,
        error: null
      });

      mockRoastGenerator.generateRoast.mockResolvedValue({
        roast: 'Third attempt roast',
        metadata: { tokens_used: 150, cost_cents: 5 }
      });

      // Mock successful operations
      supabaseServiceClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      supabaseServiceClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'third-response-id',
            response_text: 'Third attempt roast',
            attempt_number: 3,
            created_at: '2024-01-01T12:00:00Z'
          },
          error: null
        })
      });

      supabaseServiceClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      mockCostControl.recordUsage.mockResolvedValue();

      const response = await request(app)
        .post('/api/approval/original-response-id/regenerate')
        .expect(200);

      expect(response.body.data.new_response.attempt_number).toBe(3);
      expect(response.body.data.attempt_number).toBe(3);
    });
  });
});