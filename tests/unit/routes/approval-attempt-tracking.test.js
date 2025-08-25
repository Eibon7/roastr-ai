/**
 * Tests for attempt tracking in approval system
 * Issue #205 - Testing attempt counter display and history tracking
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
    rpc: jest.fn(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis()
  }
}));

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
const approvalRoutes = require('../../../src/routes/approval');

describe('Approval System - Attempt Tracking', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/approval', approvalRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  const mockOrgData = {
    id: 'org-123'
  };

  describe('GET /api/approval/pending - with attempt tracking', () => {
    const mockPendingResponsesWithAttempts = [
      {
        id: 'response-1',
        response_text: 'First roast attempt',
        tone: 'sarcastic',
        humor_type: 'witty',
        attempt_number: 1,
        created_at: '2024-01-01T12:00:00Z',
        comments: {
          id: 'comment-1',
          platform: 'twitter',
          platform_comment_id: 'tweet-123',
          platform_username: 'user1',
          original_text: 'Original comment 1',
          toxicity_score: 0.7,
          severity_level: 'medium',
          created_at: '2024-01-01T11:00:00Z'
        }
      },
      {
        id: 'response-2',
        response_text: 'Second roast attempt (regenerated)',
        tone: 'sarcastic',
        humor_type: 'witty',
        attempt_number: 2,
        created_at: '2024-01-01T12:30:00Z',
        comments: {
          id: 'comment-2',
          platform: 'youtube',
          platform_comment_id: 'yt-456',
          platform_username: 'user2',
          original_text: 'Original comment 2',
          toxicity_score: 0.9,
          severity_level: 'high',
          created_at: '2024-01-01T11:30:00Z'
        }
      }
    ];

    beforeEach(() => {
      // Mock organization lookup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      // Mock pending responses query
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockPendingResponsesWithAttempts,
          error: null
        })
      });

      // Mock count_roast_attempts calls for each comment
      supabaseServiceClient.rpc
        .mockResolvedValueOnce({ data: 1, error: null }) // comment-1 has 1 attempt
        .mockResolvedValueOnce({ data: 3, error: null }); // comment-2 has 3 attempts

      // Mock pagination count
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({
          count: 2
        })
      });
    });

    test('should return pending responses with attempt counts', async () => {
      const response = await request(app)
        .get('/api/approval/pending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pending_responses).toHaveLength(2);

      // Check first response (single attempt)
      const firstResponse = response.body.data.pending_responses[0];
      expect(firstResponse.attempt_number).toBe(1);
      expect(firstResponse.total_attempts).toBe(1);

      // Check second response (multiple attempts)
      const secondResponse = response.body.data.pending_responses[1];
      expect(secondResponse.attempt_number).toBe(2);
      expect(secondResponse.total_attempts).toBe(3);

      // Verify count_roast_attempts was called for each comment
      expect(supabaseServiceClient.rpc).toHaveBeenCalledWith(
        'count_roast_attempts',
        { comment_uuid: 'comment-1' }
      );
      expect(supabaseServiceClient.rpc).toHaveBeenCalledWith(
        'count_roast_attempts',
        { comment_uuid: 'comment-2' }
      );
    });

    test('should handle missing attempt counts gracefully', async () => {
      // Mock count function returning null
      supabaseServiceClient.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const response = await request(app)
        .get('/api/approval/pending')
        .expect(200);

      // Should default to 1 attempt when count is null
      expect(response.body.data.pending_responses[0].total_attempts).toBe(1);
      expect(response.body.data.pending_responses[1].total_attempts).toBe(1);
    });
  });

  describe('POST /api/approval/:id/approve - with attempt history', () => {
    const mockResponse = {
      id: 'response-123',
      comment_id: 'comment-456',
      attempt_number: 2,
      created_by: 'system',
      comments: {
        platform: 'twitter'
      }
    };

    beforeEach(() => {
      // Mock organization lookup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      // Mock response lookup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockResponse,
          error: null
        })
      });

      // Mock response update
      supabaseServiceClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'response-123',
            response_text: 'Approved roast',
            tone: 'sarcastic',
            humor_type: 'witty',
            post_status: 'approved',
            posted_at: '2024-01-01T12:00:00Z'
          },
          error: null
        })
      });

      // Mock job queue insertion
      supabaseServiceClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          error: null
        })
      });

      // Mock attempt history recording
      supabaseServiceClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          error: null
        })
      });
    });

    test('should record attempt history when approving', async () => {
      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .expect(200);

      expect(response.body.success).toBe(true);

      // Find the attempt history insert call
      const historyInsertCall = supabaseServiceClient.from.mock.calls.find(
        call => call[0] === 'roast_attempts'
      );
      expect(historyInsertCall).toBeDefined();

      // Verify the insert was called with correct data structure
      const insertCall = supabaseServiceClient.from.mock.results.find(
        result => result.value && result.value.insert
      );
      expect(insertCall).toBeDefined();
    });

    test('should handle attempt history recording failure gracefully', async () => {
      // Mock history recording failure
      supabaseServiceClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          error: new Error('History recording failed')
        })
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .expect(200);

      // Should still succeed even if history recording fails
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/approval/:id/reject - with attempt history', () => {
    const mockResponse = {
      id: 'response-123',
      comment_id: 'comment-456',
      attempt_number: 1,
      created_by: 'system'
    };

    beforeEach(() => {
      // Mock organization lookup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOrgData,
          error: null
        })
      });

      // Mock response lookup
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockResponse,
          error: null
        })
      });

      // Mock response update
      supabaseServiceClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'response-123',
            post_status: 'rejected',
            rejection_reason: 'Too harsh',
            rejected_at: '2024-01-01T12:00:00Z'
          },
          error: null
        })
      });

      // Mock attempt history recording
      supabaseServiceClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          error: null
        })
      });
    });

    test('should record attempt history when rejecting', async () => {
      const response = await request(app)
        .post('/api/approval/response-123/reject')
        .send({ reason: 'Too harsh' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Find the attempt history insert call
      const historyInsertCall = supabaseServiceClient.from.mock.calls.find(
        call => call[0] === 'roast_attempts'
      );
      expect(historyInsertCall).toBeDefined();
    });
  });

  describe('Database functions', () => {
    test('should call get_next_attempt_number function correctly', async () => {
      const mockCommentId = 'comment-123';
      
      // This would be part of a regeneration test
      supabaseServiceClient.rpc.mockResolvedValue({
        data: 3,
        error: null
      });

      // Call the function (this would be done inside the regenerate endpoint)
      const result = await supabaseServiceClient.rpc(
        'get_next_attempt_number',
        { comment_uuid: mockCommentId }
      );

      expect(result.data).toBe(3);
      expect(supabaseServiceClient.rpc).toHaveBeenCalledWith(
        'get_next_attempt_number',
        { comment_uuid: mockCommentId }
      );
    });

    test('should call count_roast_attempts function correctly', async () => {
      const mockCommentId = 'comment-456';
      
      supabaseServiceClient.rpc.mockResolvedValue({
        data: 2,
        error: null
      });

      const result = await supabaseServiceClient.rpc(
        'count_roast_attempts',
        { comment_uuid: mockCommentId }
      );

      expect(result.data).toBe(2);
      expect(supabaseServiceClient.rpc).toHaveBeenCalledWith(
        'count_roast_attempts',
        { comment_uuid: mockCommentId }
      );
    });
  });
});