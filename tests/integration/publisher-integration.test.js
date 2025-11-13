/**
 * Publisher Integration Tests
 * 
 * Tests for PublisherWorker according to Issue #456 AC:
 * - Persistencia de post_id: Guardar platform_response_id en tabla responses después de publicación exitosa
 * - Manejo de rate limits: Usar exponential backoff de BaseWorker para errores 429
 * - Gestión de errores 4xx/5xx: 
 *   - 4xx permanentes: no reintentar (401, 403, 400)
 *   - 5xx transitorios: reintentar con backoff (500, 502, 503, 504)
 * - Idempotencia: Verificar si platform_response_id ya existe antes de publicar
 * - Logging completo: Registrar cada intento, resultado, y platform_response_id
 * 
 * Related Issue: #456
 */

const PublisherWorker = require('../../src/workers/PublisherWorker');
const { createSupabaseMock } = require('../helpers/supabaseMockFactory');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('PublisherWorker Integration Tests', () => {
  let publisherWorker;
  let mockSupabase;
  let mockPlatformService;
  let responseData;
  let commentData;

  // Helper function to create Supabase mock
  const createMockSupabase = (customResponseData = null, customCommentData = null) => {
    const respData = customResponseData || responseData;
    const commData = customCommentData || commentData;

    return {
      from: jest.fn((tableName) => {
        const filters = {};
        let updateData = null;
        let isUpdateChain = false;

        const builder = {
          select: jest.fn(() => {
            // If this is part of update().eq().select() chain, return Promise
            if (isUpdateChain) {
              return Promise.resolve({
                data: updateData ? [{ ...respData, ...updateData }] : [],
                error: null
              });
            }
            // Otherwise return builder for select().eq().single() chain
            return builder;
          }),
          update: jest.fn((data) => {
            updateData = data;
            isUpdateChain = true;
            return builder;
          }),
          insert: jest.fn(() => builder),
          eq: jest.fn((column, value) => {
            filters[column] = value;
            return builder;
          }),
          single: jest.fn(() => {
            // Return appropriate data based on table and filters
            if (tableName === 'responses') {
              if (filters.id === 'response-123') {
                return Promise.resolve({ data: respData, error: null });
              }
              return Promise.resolve({ data: null, error: { message: 'Not found' } });
            }
            if (tableName === 'comments') {
              // Handle both with and without organization_id filter
              // fetchComment uses both .eq('id') and .eq('organization_id')
              if (filters.id === 'comment-123') {
                return Promise.resolve({ data: commData, error: null });
              }
              return Promise.resolve({ data: null, error: { message: 'Not found' } });
            }
            return Promise.resolve({ data: null, error: null });
          })
        };
        return builder;
      })
    };
  };

  beforeEach(() => {
    // Create response and comment data
    responseData = {
      id: 'response-123',
      response_text: 'Test roast response',
      comment_id: 'comment-123',
      platform_response_id: null,
      posted_at: null,
      post_status: 'pending',
      organization_id: 'org-123'
    };

    commentData = {
      id: 'comment-123',
      platform: 'twitter',
      platform_comment_id: 'tweet-123',
      platform_user_id: 'user-123',
      platform_username: 'testuser',
      original_text: 'Original comment',
      metadata: {},
      organization_id: 'org-123'
    };

    // Create Supabase mock with proper table builders
    mockSupabase = createMockSupabase();

    // Mock platform service
    mockPlatformService = {
      supportDirectPosting: true,
      supportModeration: false,
      postResponse: jest.fn()
    };

    // Create worker instance
    publisherWorker = new PublisherWorker();

    // Override supabase with mock (after initialization)
    publisherWorker.supabase = mockSupabase;
    publisherWorker.queueService = {
      getNextJob: jest.fn(),
      completeJob: jest.fn(),
      failJob: jest.fn()
    };

    // Mock getPlatformService to return our mock
    publisherWorker.getPlatformService = jest.fn().mockResolvedValue(mockPlatformService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AC1: Persistencia de post_id', () => {
    test('should save platform_response_id after successful publication', async () => {
      const platformPostId = 'tweet-response-456';
      mockPlatformService.postResponse.mockResolvedValue({
        success: true,
        responseId: platformPostId
      });

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'twitter',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      const result = await publisherWorker._processJobInternal(job);

      expect(result.success).toBe(true);
      expect(result.postId).toBe(platformPostId);

      // Verify database update was called
      expect(mockSupabase.from).toHaveBeenCalledWith('responses');
      
      // Verify update was called with correct data
      const updateCalls = mockSupabase.from.mock.results
        .map(r => r.value?.update?.mock?.calls)
        .flat()
        .filter(Boolean);
      
      expect(updateCalls.length).toBeGreaterThan(0);
      const updateCall = updateCalls[updateCalls.length - 1];
      expect(updateCall[0]).toMatchObject({
        platform_response_id: platformPostId,
        post_status: 'posted'
      });
      expect(updateCall[0].posted_at).toBeDefined();
    });
  });

  describe('AC2: Manejo de rate limits (429)', () => {
    test('should retry with exponential backoff on 429 rate limit error', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.statusCode = 429;
      rateLimitError.response = {
        status: 429,
        headers: {
          'retry-after': '60'
        }
      };

      // First attempt fails with 429
      mockPlatformService.postResponse
        .mockRejectedValueOnce(rateLimitError)
        // Second attempt succeeds
        .mockResolvedValueOnce({
          success: true,
          responseId: 'tweet-response-456'
        });

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'twitter',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      // The error should be classified as retriable
      const classifiedError = publisherWorker.classifyError(rateLimitError, 1);
      expect(classifiedError.retriable).toBe(true);
      expect(classifiedError.type).toBe('RATE_LIMIT');

      // The error should have retriable flag set
      expect(classifiedError.error.retriable).toBe(true);
    });
  });

  describe('AC3: Gestión de errores 4xx/5xx', () => {
    test('should NOT retry on 4xx permanent errors (401, 403, 400)', async () => {
      const permanentErrors = [
        { statusCode: 401, message: 'Unauthorized' },
        { statusCode: 403, message: 'Forbidden' },
        { statusCode: 400, message: 'Bad Request' }
      ];

      for (const errorData of permanentErrors) {
        const error = new Error(errorData.message);
        error.statusCode = errorData.statusCode;

        const classifiedError = publisherWorker.classifyError(error, 1);
        expect(classifiedError.retriable).toBe(false);
        expect(classifiedError.type).toBe('CLIENT_ERROR');
        expect(classifiedError.error.permanent).toBe(true);
        expect(classifiedError.error.retriable).toBe(false);
      }
    });

    test('should retry on 5xx transient errors (500, 502, 503, 504)', async () => {
      const transientErrors = [
        { statusCode: 500, message: 'Internal Server Error' },
        { statusCode: 502, message: 'Bad Gateway' },
        { statusCode: 503, message: 'Service Unavailable' },
        { statusCode: 504, message: 'Gateway Timeout' }
      ];

      for (const errorData of transientErrors) {
        const error = new Error(errorData.message);
        error.statusCode = errorData.statusCode;

        const classifiedError = publisherWorker.classifyError(error, 1);
        expect(classifiedError.retriable).toBe(true);
        expect(classifiedError.type).toBe('SERVER_ERROR');
        expect(classifiedError.error.retriable).toBe(true);
      }
    });
  });

  describe('AC4: Idempotencia', () => {
    test('should skip publication if platform_response_id already exists', async () => {
      // Override mock to return response with existing platform_response_id
      const existingResponseData = {
        ...responseData,
        platform_response_id: 'tweet-response-existing',
        posted_at: '2025-01-01T00:00:00Z',
        post_status: 'posted'
      };
      mockSupabase = createMockSupabase(existingResponseData, commentData);
      publisherWorker.supabase = mockSupabase;

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'twitter',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      const result = await publisherWorker._processJobInternal(job);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('already_published');
      expect(result.postId).toBe('tweet-response-existing');

      // Should NOT call platform service
      expect(mockPlatformService.postResponse).not.toHaveBeenCalled();
    });

    test('should publish if platform_response_id is null', async () => {
      const platformPostId = 'tweet-response-456';
      mockPlatformService.postResponse.mockResolvedValue({
        success: true,
        responseId: platformPostId
      });

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'twitter',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      const result = await publisherWorker._processJobInternal(job);

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(mockPlatformService.postResponse).toHaveBeenCalled();
    });
  });

  describe('AC5: Logging completo', () => {
    test('should log each attempt, result, and platform_response_id', async () => {
      const platformPostId = 'tweet-response-456';
      mockPlatformService.postResponse.mockResolvedValue({
        success: true,
        responseId: platformPostId
      });

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'twitter',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      // Spy on log method
      const logSpy = jest.spyOn(publisherWorker, 'log');

      await publisherWorker._processJobInternal(job);

      // Verify logging calls
      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Processing publication job',
        expect.objectContaining({
          jobId: 'job-123',
          responseId: 'response-123',
          attempt: 1
        })
      );

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Publishing to platform',
        expect.objectContaining({
          platform: 'twitter',
          attempt: 1
        })
      );

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Publication successful',
        expect.objectContaining({
          postId: platformPostId,
          attempt: 1
        })
      );

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Response record updated with publication details',
        expect.objectContaining({
          platformResponseId: platformPostId
        })
      );

      logSpy.mockRestore();
    });

    test('should log errors with full context', async () => {
      const error = new Error('Platform API error');
      error.statusCode = 500;
      mockPlatformService.postResponse.mockRejectedValue(error);

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'twitter',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      const logSpy = jest.spyOn(publisherWorker, 'log');

      try {
        await publisherWorker._processJobInternal(job);
        fail('Should have thrown an error');
      } catch (e) {
        // Expected to throw
      }

      // Verify error logging was called
      const errorLogCalls = logSpy.mock.calls.filter(call => call[0] === 'error' && call[1] === 'Publication failed');
      expect(errorLogCalls.length).toBeGreaterThan(0);
      
      const errorLogCall = errorLogCalls[0];
      expect(errorLogCall[2]).toMatchObject({
        responseId: 'response-123',
        errorType: expect.any(String),
        retriable: expect.any(Boolean),
        attempt: 1
      });

      logSpy.mockRestore();
    });
  });

  describe('Platform-specific argument mapping', () => {
    test('should call Twitter postResponse with correct arguments', async () => {
      // Reset mock to use default implementation
      mockSupabase = createMockSupabase();
      publisherWorker.supabase = mockSupabase;

      mockPlatformService.postResponse.mockResolvedValue({
        success: true,
        responseId: 'tweet-response-456'
      });

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'twitter',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      await publisherWorker._processJobInternal(job);

      expect(mockPlatformService.postResponse).toHaveBeenCalledWith(
        'tweet-123', // platform_comment_id
        'Test roast response', // response_text
        'user-123' // platform_user_id
      );
    });

    test('should call YouTube postResponse with correct arguments', async () => {
      // Override mock for YouTube comment
      const youtubeCommentData = {
        ...commentData,
        platform: 'youtube',
        platform_comment_id: 'yt-comment-123'
      };
      mockSupabase = createMockSupabase(responseData, youtubeCommentData);
      publisherWorker.supabase = mockSupabase;

      mockPlatformService.postResponse.mockResolvedValue({
        success: true,
        responseId: 'yt-response-456'
      });

      const job = {
        id: 'job-123',
        payload: {
          response_id: 'response-123',
          organization_id: 'org-123',
          platform: 'youtube',
          response_text: 'Test roast response',
          comment_id: 'comment-123'
        },
        attempts: 1
      };

      await publisherWorker._processJobInternal(job);

      expect(mockPlatformService.postResponse).toHaveBeenCalledWith(
        'yt-comment-123', // platform_comment_id
        'Test roast response' // response_text
      );
    });
  });
});

