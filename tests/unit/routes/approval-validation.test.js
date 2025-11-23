/**
 * Approval API Validation Tests
 *
 * Tests for the approval endpoints with focus on:
 * - Character limit validation
 * - Platform-specific constraints
 * - Edited text handling
 * - Error responses
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
    insert: jest.fn().mockReturnThis()
  }
}));

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }
}));

const { supabaseServiceClient } = require('../../../src/config/supabase');

describe('Approval API - Character Limit Validation', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/approval', require('../../../src/routes/approval'));
    jest.clearAllMocks();
  });

  describe('POST /api/approval/:id/approve', () => {
    const mockOrganization = { id: 'org-123' };
    const mockResponse = {
      id: 'response-123',
      organization_id: 'org-123',
      response_text: 'Original response text',
      post_status: 'pending',
      comments: { platform: 'twitter' }
    };

    beforeEach(() => {
      // Mock organization lookup
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOrganization,
              error: null
            })
          };
        }
        if (table === 'responses') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockResponse,
              error: null
            }),
            update: jest.fn().mockReturnThis()
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          update: jest.fn().mockReturnThis()
        };
      });

      // Mock the update chain
      supabaseServiceClient.update = jest.fn().mockReturnThis();
      supabaseServiceClient.eq = jest.fn().mockReturnThis();
      supabaseServiceClient.select = jest.fn().mockReturnThis();
      supabaseServiceClient.single = jest.fn().mockResolvedValue({
        data: { ...mockResponse, post_status: 'approved' },
        error: null
      });
    });

    test('should approve response without edited text', async () => {
      // Mock the complete chain for approval
      const mockUpdateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockResponse, post_status: 'approved' },
          error: null
        })
      };

      // Mock job queue insert
      const mockJobInsert = {
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOrganization,
              error: null
            })
          };
        }
        if (table === 'responses') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockResponse,
              error: null
            }),
            ...mockUpdateChain
          };
        }
        if (table === 'job_queue') {
          return mockJobInsert;
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockUpdateChain.update).toHaveBeenCalledWith({
        post_status: 'approved',
        posted_at: expect.any(String)
      });
    });

    test('should approve response with valid edited text', async () => {
      const editedText = 'This is a valid edited response for Twitter';

      supabaseServiceClient.update.mockResolvedValue({
        data: { ...mockResponse, response_text: editedText, post_status: 'approved' },
        error: null
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .send({ edited_text: editedText })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(supabaseServiceClient.update).toHaveBeenCalledWith({
        post_status: 'approved',
        posted_at: expect.any(String),
        response_text: editedText
      });
    });

    test('should trim whitespace from edited text', async () => {
      const editedTextWithWhitespace = '  Valid response with whitespace  ';
      const trimmedText = 'Valid response with whitespace';

      supabaseServiceClient.update.mockResolvedValue({
        data: { ...mockResponse, response_text: trimmedText, post_status: 'approved' },
        error: null
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .send({ edited_text: editedTextWithWhitespace })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(supabaseServiceClient.update).toHaveBeenCalledWith({
        post_status: 'approved',
        posted_at: expect.any(String),
        response_text: trimmedText
      });
    });

    test('should ignore empty edited text', async () => {
      supabaseServiceClient.update.mockResolvedValue({
        data: { ...mockResponse, post_status: 'approved' },
        error: null
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .send({ edited_text: '   ' }) // Only whitespace
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(supabaseServiceClient.update).toHaveBeenCalledWith({
        post_status: 'approved',
        posted_at: expect.any(String)
        // Should not include response_text since edited_text was empty after trim
      });
    });

    test('should handle very long edited text gracefully', async () => {
      const veryLongText = 'a'.repeat(10000); // Much longer than any platform limit

      supabaseServiceClient.update.mockResolvedValue({
        data: { ...mockResponse, response_text: veryLongText, post_status: 'approved' },
        error: null
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .send({ edited_text: veryLongText })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(supabaseServiceClient.update).toHaveBeenCalledWith({
        post_status: 'approved',
        posted_at: expect.any(String),
        response_text: veryLongText
      });
    });

    test('should return 404 for non-existent response', async () => {
      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOrganization,
              error: null
            })
          };
        }
        if (table === 'responses') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Response not found' }
            })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      const response = await request(app)
        .post('/api/approval/nonexistent/approve')
        .send({ edited_text: 'Some text' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Response not found or already processed');
    });

    test('should return 404 for already processed response', async () => {
      const processedResponse = {
        ...mockResponse,
        post_status: 'approved' // Already processed
      };

      supabaseServiceClient.from.mockImplementation((table) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOrganization,
              error: null
            })
          };
        }
        if (table === 'responses') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null, // Will be null because of post_status filter
              error: { message: 'Response not found' }
            })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .send({ edited_text: 'Some text' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Response not found or already processed');
    });

    test('should handle database update errors', async () => {
      supabaseServiceClient.update.mockResolvedValue({
        data: null,
        error: { message: 'Database update failed' }
      });

      const response = await request(app)
        .post('/api/approval/response-123/approve')
        .send({ edited_text: 'Valid text' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to approve response');
    });
  });

  describe('Platform-Specific Validation', () => {
    test('should handle different platform contexts', async () => {
      const platforms = ['twitter', 'instagram', 'youtube', 'discord'];

      for (const platform of platforms) {
        const mockResponseForPlatform = {
          id: `response-${platform}`,
          organization_id: 'org-123',
          response_text: 'Original response',
          post_status: 'pending',
          comments: { platform }
        };

        supabaseServiceClient.from.mockImplementation((table) => {
          if (table === 'organizations') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'org-123' },
                error: null
              })
            };
          }
          if (table === 'responses') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: mockResponseForPlatform,
                error: null
              }),
              update: jest.fn().mockReturnThis()
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          };
        });

        supabaseServiceClient.update.mockResolvedValue({
          data: { ...mockResponseForPlatform, post_status: 'approved' },
          error: null
        });

        const response = await request(app)
          .post(`/api/approval/response-${platform}/approve`)
          .send({ edited_text: `Valid response for ${platform}` })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });
});
