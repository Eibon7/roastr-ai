/**
 * Roastr Persona Analytics API Tests
 * Issue #81: Test Roastr Persona analytics and insights functionality
 */

const request = require('supertest');
const express = require('express');

// Setup mock mode
process.env.ENABLE_MOCK_MODE = 'true';

// Mock Supabase
const mockSupabaseServiceClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  gte: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn(),
  is: jest.fn().mockReturnThis()
};

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient,
  createUserClient: jest.fn(() => mockSupabaseServiceClient)
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

jest.mock('../../../src/utils/logger', () => ({
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

const analyticsRoutes = require('../../../src/routes/analytics');

describe('Roastr Persona Analytics API', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
  });

  describe('GET /api/analytics/roastr-persona-insights', () => {
    it('should return persona insights when organization exists', async () => {
      // Mock organization lookup
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: { id: 'org-123' },
        error: null
      });

      // Mock persona data lookup
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: {
          lo_que_me_define_encrypted: 'encrypted_data',
          lo_que_me_define_visible: true,
          lo_que_me_define_created_at: '2024-01-01T00:00:00Z',
          lo_que_me_define_updated_at: '2024-01-02T00:00:00Z',
          lo_que_no_tolero_encrypted: 'encrypted_data_2',
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_created_at: '2024-01-03T00:00:00Z',
          lo_que_no_tolero_updated_at: '2024-01-04T00:00:00Z',
          lo_que_me_da_igual_encrypted: null,
          lo_que_me_da_igual_visible: false,
          lo_que_me_da_igual_created_at: null,
          lo_que_me_da_igual_updated_at: null,
          embeddings_generated_at: '2024-01-05T00:00:00Z',
          embeddings_model: 'text-embedding-3-small',
          embeddings_version: 1
        },
        error: null
      });

      // Mock persona responses data
      mockSupabaseServiceClient.single = jest
        .fn()
        .mockResolvedValueOnce({
          data: { id: 'org-123' },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            lo_que_me_define_encrypted: 'encrypted_data',
            lo_que_me_define_visible: true,
            lo_que_me_define_created_at: '2024-01-01T00:00:00Z',
            lo_que_me_define_updated_at: '2024-01-02T00:00:00Z',
            lo_que_no_tolero_encrypted: 'encrypted_data_2',
            lo_que_no_tolero_visible: false,
            lo_que_no_tolero_created_at: '2024-01-03T00:00:00Z',
            lo_que_no_tolero_updated_at: '2024-01-04T00:00:00Z',
            lo_que_me_da_igual_encrypted: null,
            lo_que_me_da_igual_visible: false,
            lo_que_me_da_igual_created_at: null,
            lo_que_me_da_igual_updated_at: null,
            embeddings_generated_at: '2024-01-05T00:00:00Z',
            embeddings_model: 'text-embedding-3-small',
            embeddings_version: 1
          },
          error: null
        });

      // Mock responses with persona fields used
      const mockResponses = [
        {
          id: 'response-1',
          tone: 'sarcastic',
          humor_type: 'witty',
          created_at: '2024-01-10T10:00:00Z',
          post_status: 'posted',
          platform_response_id: 'platform-123',
          tokens_used: 150,
          cost_cents: 5,
          persona_fields_used: ['lo_que_me_define', 'lo_que_no_tolero'],
          comments: {
            platform: 'twitter',
            toxicity_score: 0.7,
            severity_level: 'medium',
            created_at: '2024-01-10T09:00:00Z'
          }
        },
        {
          id: 'response-2',
          tone: 'ironic',
          humor_type: 'clever',
          created_at: '2024-01-11T14:00:00Z',
          post_status: 'pending',
          platform_response_id: null,
          tokens_used: 120,
          cost_cents: 4,
          persona_fields_used: ['lo_que_me_define'],
          comments: {
            platform: 'youtube',
            toxicity_score: 0.5,
            severity_level: 'low',
            created_at: '2024-01-11T13:00:00Z'
          }
        }
      ];

      // Mock responses query
      mockSupabaseServiceClient.range.mockResolvedValueOnce({
        data: mockResponses,
        error: null
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('period_days', 30);
      expect(response.body.data).toHaveProperty('persona_status');
      expect(response.body.data).toHaveProperty('persona_analytics');
      expect(response.body.data).toHaveProperty('recommendations');

      // Check persona status structure
      const personaStatus = response.body.data.persona_status;
      expect(personaStatus).toHaveProperty('lo_que_me_define');
      expect(personaStatus).toHaveProperty('lo_que_no_tolero');
      expect(personaStatus).toHaveProperty('lo_que_me_da_igual');
      expect(personaStatus).toHaveProperty('embeddings');

      expect(personaStatus.lo_que_me_define.configured).toBe(true);
      expect(personaStatus.lo_que_no_tolero.configured).toBe(true);
      expect(personaStatus.lo_que_me_da_igual.configured).toBe(false);
      expect(personaStatus.embeddings.generated).toBe(true);

      // Check analytics structure
      const analytics = response.body.data.persona_analytics;
      expect(analytics).toHaveProperty('summary');
      expect(analytics).toHaveProperty('fields_usage');
      expect(analytics).toHaveProperty('persona_impact');
      expect(analytics).toHaveProperty('timeline');

      expect(analytics.summary.total_persona_responses).toBe(2);
      expect(analytics.summary.successful_posts).toBe(1);

      // Check field usage tracking
      expect(analytics.fields_usage.lo_que_me_define).toBe(2);
      expect(analytics.fields_usage.lo_que_no_tolero).toBe(1);
      expect(analytics.fields_usage.lo_que_me_da_igual).toBe(0);
      expect(analytics.fields_usage.combined_fields).toBe(1);
    });

    it('should return insights with empty analytics when no persona responses exist', async () => {
      // Mock organization lookup
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: { id: 'org-456' },
        error: null
      });

      // Mock persona data lookup (no persona configured)
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: {
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: null,
          lo_que_me_define_updated_at: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_created_at: null,
          lo_que_no_tolero_updated_at: null,
          lo_que_me_da_igual_encrypted: null,
          lo_que_me_da_igual_visible: false,
          lo_que_me_da_igual_created_at: null,
          lo_que_me_da_igual_updated_at: null,
          embeddings_generated_at: null,
          embeddings_model: null,
          embeddings_version: null
        },
        error: null
      });

      // Mock empty responses
      mockSupabaseServiceClient.range.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const response = await request(app).get('/api/analytics/roastr-persona-insights');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const analytics = response.body.data.persona_analytics;
      expect(analytics.summary.total_persona_responses).toBe(0);
      expect(analytics.fields_usage.lo_que_me_define).toBe(0);
      expect(analytics.timeline).toEqual([]);

      // Should have recommendations to configure persona
      const recommendations = response.body.data.recommendations;
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe('configuration');
      expect(recommendations[0].priority).toBe('high');
    });

    it('should return 404 when organization not found', async () => {
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Organization not found')
      });

      const response = await request(app).get('/api/analytics/roastr-persona-insights');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Organization not found');
    });

    it('should generate appropriate recommendations based on persona status', async () => {
      // Reset mocks
      jest.clearAllMocks();

      // Mock organization with partial persona configuration
      mockSupabaseServiceClient.single = jest
        .fn()
        .mockResolvedValueOnce({
          data: { id: 'org-789' },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            lo_que_me_define_encrypted: 'encrypted_data',
            lo_que_me_define_visible: false, // Not visible
            lo_que_me_define_created_at: '2024-01-01T00:00:00Z',
            lo_que_me_define_updated_at: '2024-01-02T00:00:00Z',
            lo_que_no_tolero_encrypted: null, // Not configured
            lo_que_no_tolero_visible: false,
            lo_que_no_tolero_created_at: null,
            lo_que_no_tolero_updated_at: null,
            lo_que_me_da_igual_encrypted: null, // Not configured
            lo_que_me_da_igual_visible: false,
            lo_que_me_da_igual_created_at: null,
            lo_que_me_da_igual_updated_at: null,
            embeddings_generated_at: null, // No embeddings
            embeddings_model: null,
            embeddings_version: null
          },
          error: null
        });

      // Mock some responses with low success rate
      const mockResponses = [
        {
          id: 'response-1',
          tone: 'sarcastic',
          humor_type: 'witty',
          created_at: '2024-01-10T10:00:00Z',
          post_status: 'failed',
          platform_response_id: null, // Failed post
          tokens_used: 100,
          cost_cents: 3,
          persona_fields_used: ['lo_que_me_define'],
          comments: {
            platform: 'twitter',
            toxicity_score: 0.5,
            severity_level: 'low',
            created_at: '2024-01-10T09:00:00Z'
          }
        },
        {
          id: 'response-2',
          tone: 'ironic',
          humor_type: 'clever',
          created_at: '2024-01-11T14:00:00Z',
          post_status: 'failed',
          platform_response_id: null, // Failed post
          tokens_used: 120,
          cost_cents: 4,
          persona_fields_used: ['lo_que_me_define'],
          comments: {
            platform: 'twitter',
            toxicity_score: 0.6,
            severity_level: 'medium',
            created_at: '2024-01-11T13:00:00Z'
          }
        }
      ];

      mockSupabaseServiceClient.range.mockResolvedValueOnce({
        data: mockResponses,
        error: null
      });

      const response = await request(app).get('/api/analytics/roastr-persona-insights');

      expect(response.status).toBe(200);

      const recommendations = response.body.data.recommendations;
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      // Should recommend completing persona (only 1 of 3 fields configured)
      const configRec = recommendations.find((r) => r.type === 'configuration');
      expect(configRec).toBeTruthy();
      expect(configRec.priority).toBe('high');
      expect(configRec.description).toContain('1 of 3 persona fields');
    });

    it('should handle database errors gracefully', async () => {
      // Reset mocks
      jest.clearAllMocks();

      // Mock organization lookup success first, then error in persona data
      mockSupabaseServiceClient.single = jest
        .fn()
        .mockResolvedValueOnce({
          data: { id: 'org-123' },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: new Error('Database connection failed')
        });

      const response = await request(app).get('/api/analytics/roastr-persona-insights');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve Roastr Persona insights');
    });

    it('should validate days parameter', async () => {
      // Mock organization
      mockSupabaseServiceClient.single
        .mockResolvedValueOnce({ data: { id: 'org-123' }, error: null })
        .mockResolvedValueOnce({ data: {}, error: null });

      mockSupabaseServiceClient.range.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const response = await request(app)
        .get('/api/analytics/roastr-persona-insights')
        .query({ days: 60 });

      expect(response.status).toBe(200);
      expect(response.body.data.period_days).toBe(60);
    });
  });
});
