/**
 * Fetch Comments Worker Tests
 *
 * Tests for comment fetching from multiple social media platforms
 */

const FetchCommentsWorker = require('../../../src/workers/FetchCommentsWorker');
const {
  createMockComment,
  createMockTwitterComment,
  createMockFetchCommentsJob
} = require('../../utils/mocks');
const { createCostControlMock } = require('../../helpers/costControlMockFactory');

// Mock BaseWorker
jest.mock('../../../src/workers/BaseWorker', () => {
  return class MockBaseWorker {
    constructor(workerType, options = {}) {
      this.workerType = workerType;
      this.workerName = `${workerType}-worker-test`;
      this.config = { maxRetries: 3, ...options };
      this.supabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn()
              }))
            }))
          }))
        }))
      };
      this.queueService = {
        addJob: jest.fn(),
        initialize: jest.fn(),
        shutdown: jest.fn()
      };
      this.redis = null;
      this.log = jest.fn();
      this.start = jest.fn();
      this.stop = jest.fn();
      this.initializeConnections = jest.fn();
      this.setupGracefulShutdown = jest.fn();
    }

    // Issue #618 - Add missing processJob method
    // BaseWorker defines processJob which calls _processJobInternal (defined by subclass)
    async processJob(job) {
      return await this._processJobInternal(job);
    }
  };
});

const mockCostControlService = createCostControlMock();

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControlService);
});

// Mock platform service APIs explicitly
const mockTwitterService = {
  fetchComments: jest.fn(),
  initialize: jest.fn()
};

const mockYouTubeService = {
  fetchComments: jest.fn(),
  initialize: jest.fn()
};

// Mock platform APIs with consolidated functionality
const mockTwitterApi = jest.fn().mockImplementation(() => ({
  v2: {
    search: jest.fn(),
    userMentionTimeline: jest.fn(),
    userByUsername: jest.fn()
  }
}));

const mockYouTubeApi = {
  youtube: jest.fn(() => ({
    comments: {
      list: jest.fn()
    },
    commentThreads: {
      list: jest.fn()
    }
  }))
};

jest.mock('twitter-api-v2', () => ({
  TwitterApi: mockTwitterApi
}));

jest.mock('googleapis', () => ({
  google: mockYouTubeApi
}));

describe('FetchCommentsWorker', () => {
  let worker;
  let mockSupabase;
  let mockQueueService;

  beforeEach(() => {
    worker = new FetchCommentsWorker();
    mockSupabase = worker.supabase;
    mockQueueService = worker.queueService;
    worker.platformServices.set('twitter', mockTwitterService);
    worker.platformServices.set('youtube', mockYouTubeService);
    worker.setIntegrationConfigOverride({ enabled: true });
  });

  afterEach(() => {
    mockCostControlService._reset();
    jest.clearAllMocks();
    worker.setIntegrationConfigOverride(null);
  });

  afterAll(async () => {
    // Ensure worker is properly stopped to avoid open handles
    if (worker && typeof worker.stop === 'function') {
      await worker.stop();
    }
  });

  describe('constructor', () => {
    test('should initialize worker with correct type', () => {
      expect(worker.workerType).toBe('fetch_comments');
      expect(worker.costControl).toBeDefined();
      expect(worker.platformClients).toBeDefined();
      expect(worker.platformClients instanceof Map).toBe(true);
    });
  });

  describe('processJob', () => {
    test('should process Twitter comment fetching job', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: {
          post_id: 'tweet-456',
          since_id: '100',
          max_results: 50
        }
      };

      const mockComments = [
        {
          id: 'comment-1',
          text: 'Great post!',
          author_id: 'user-1',
          created_at: new Date().toISOString(),
          metrics: { likes: 5, replies: 2 }
        },
        {
          id: 'comment-2',
          text: 'This is terrible content',
          author_id: 'user-2',
          created_at: new Date().toISOString(),
          metrics: { likes: 0, replies: 0 }
        }
      ];

      mockTwitterService.fetchComments.mockResolvedValue({
        comments: mockComments,
        nextToken: 'token-next',
        hasMore: false
      });

      // Mock comment insertion
      mockSupabase.from = jest
        .fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null, // First comment doesn't exist
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null, // Second comment doesn't exist
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('twitter');
      expect(result.newComments).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.queuedForAnalysis).toBe(2);

      expect(mockTwitterService.fetchComments).toHaveBeenCalledWith({
        postId: 'tweet-456',
        sinceId: '100',
        maxResults: 50
      });

      expect(mockQueueService.addJob).toHaveBeenCalledTimes(2); // One job per comment for analysis
    });

    test('should process YouTube comment fetching job', async () => {
      const job = {
        id: 'job-456',
        organization_id: 'org-123',
        platform: 'youtube',
        payload: {
          video_id: 'video-789',
          page_token: 'page-1'
        }
      };

      const mockComments = [
        {
          id: 'yt-comment-1',
          text: 'Amazing video!',
          author_id: 'yt-user-1',
          created_at: new Date().toISOString(),
          metrics: { likes: 10 },
          reply_count: 3
        }
      ];

      mockYouTubeService.fetchComments.mockResolvedValue({
        comments: mockComments,
        nextPageToken: 'page-2',
        hasMore: true
      });

      mockSupabase.from = jest
        .fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('youtube');
      expect(result.newComments).toBe(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBe('page-2');

      expect(mockYouTubeService.fetchComments).toHaveBeenCalledWith({
        videoId: 'video-789',
        pageToken: 'page-1'
      });
    });

    test('should handle duplicate comments', async () => {
      const job = {
        id: 'job-789',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: {
          post_id: 'tweet-456'
        }
      };

      const mockComments = [
        {
          id: 'existing-comment',
          text: 'This comment already exists',
          author_id: 'user-1',
          created_at: new Date().toISOString()
        },
        {
          id: 'new-comment',
          text: 'This is a new comment',
          author_id: 'user-2',
          created_at: new Date().toISOString()
        }
      ];

      mockTwitterService.fetchComments.mockResolvedValue({
        comments: mockComments,
        hasMore: false
      });

      // Mock first comment as existing, second as new
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'existing-comment' }, // Comment exists
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null, // Comment doesn't exist
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.newComments).toBe(1);
      expect(result.duplicates).toBe(1);
      expect(result.queuedForAnalysis).toBe(1); // Only new comment queued
    });

    test('should handle platform errors gracefully', async () => {
      const job = {
        id: 'job-error',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: {
          post_id: 'invalid-tweet'
        }
      };

      mockTwitterService.fetchComments.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(worker.processJob(job)).rejects.toThrow('API rate limit exceeded');
    });

    test('should handle unsupported platform', async () => {
      const job = {
        id: 'job-unsupported',
        organization_id: 'org-123',
        platform: 'unsupported_platform',
        payload: {}
      };

      await expect(worker.processJob(job)).rejects.toThrow(
        'Unsupported platform: unsupported_platform'
      );
    });
  });

  describe('storeComment', () => {
    test('should store new comment successfully', async () => {
      const comment = {
        id: 'comment-123',
        text: 'Test comment',
        author_id: 'user-456',
        created_at: new Date().toISOString(),
        metrics: { likes: 5 }
      };

      const job = {
        organization_id: 'org-123',
        platform: 'twitter'
      };

      // Mock comment doesn't exist
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
        // Mock successful insertion
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      const result = await worker.storeComment(comment, job);

      expect(result.stored).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(mockSupabase.from).toHaveBeenCalledWith('comments');
    });

    test('should detect duplicate comment', async () => {
      const comment = {
        id: 'existing-comment',
        text: 'Duplicate comment'
      };

      const job = {
        organization_id: 'org-123',
        platform: 'twitter'
      };

      // Mock comment already exists
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'existing-comment' },
              error: null
            })
          })
        })
      });

      const result = await worker.storeComment(comment, job);

      expect(result.stored).toBe(false);
      expect(result.duplicate).toBe(true);
    });

    test('should handle database errors', async () => {
      const comment = { id: 'comment-error', text: 'Test' };
      const job = { organization_id: 'org-123', platform: 'twitter' };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });

      await expect(worker.storeComment(comment, job)).rejects.toThrow('Database connection failed');
    });
  });

  describe('queueForAnalysis', () => {
    test('should queue comment for toxicity analysis', async () => {
      const comment = {
        id: 'comment-123',
        text: 'Test comment for analysis',
        author_id: 'user-456'
      };

      const job = {
        organization_id: 'org-123',
        platform: 'twitter'
      };

      mockQueueService.addJob.mockResolvedValue({
        success: true,
        jobId: 'analysis-job-123'
      });

      const result = await worker.queueForAnalysis(comment, job);

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('analysis-job-123');

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'analyze_toxicity',
        {
          organization_id: 'org-123',
          platform: 'twitter',
          comment_id: 'comment-123',
          text: 'Test comment for analysis',
          author_id: 'user-456'
        },
        3 // Medium priority for analysis
      );
    });

    test('should handle queue errors', async () => {
      const comment = { id: 'comment-123', text: 'Test' };
      const job = { organization_id: 'org-123', platform: 'twitter' };

      mockQueueService.addJob.mockRejectedValue(new Error('Queue service unavailable'));

      await expect(worker.queueForAnalysis(comment, job)).rejects.toThrow(
        'Queue service unavailable'
      );
    });
  });

  describe('initializePlatformServices', () => {
    test('should initialize all platform services', async () => {
      await worker.initializePlatformServices();

      expect(mockTwitterService.initialize).toHaveBeenCalled();
      expect(mockYouTubeService.initialize).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      mockTwitterService.initialize.mockRejectedValue(new Error('Twitter API credentials invalid'));

      await expect(worker.initializePlatformServices()).rejects.toThrow(
        'Twitter API credentials invalid'
      );
    });
  });

  describe('normalizeCommentData', () => {
    test('should normalize Twitter comment data', () => {
      const twitterComment = {
        id: '1234567890',
        text: 'Great tweet!',
        author_id: '9876543210',
        created_at: '2024-01-15T10:30:00Z',
        public_metrics: {
          like_count: 5,
          reply_count: 2,
          retweet_count: 1
        },
        lang: 'en'
      };

      const normalized = worker.normalizeCommentData(twitterComment, 'twitter');

      expect(normalized.id).toBe('1234567890');
      expect(normalized.text).toBe('Great tweet!');
      expect(normalized.author_id).toBe('9876543210');
      expect(normalized.created_at).toBe('2024-01-15T10:30:00Z');
      expect(normalized.metrics.likes).toBe(5);
      expect(normalized.metrics.replies).toBe(2);
      expect(normalized.language).toBe('en');
    });

    test('should normalize YouTube comment data', () => {
      const youtubeComment = {
        id: 'yt_comment_123',
        snippet: {
          textDisplay: 'Amazing video!',
          authorChannelId: { value: 'channel_456' },
          publishedAt: '2024-01-15T10:30:00Z',
          likeCount: 10
        }
      };

      const normalized = worker.normalizeCommentData(youtubeComment, 'youtube');

      expect(normalized.id).toBe('yt_comment_123');
      expect(normalized.text).toBe('Amazing video!');
      expect(normalized.author_id).toBe('channel_456');
      expect(normalized.created_at).toBe('2024-01-15T10:30:00Z');
      expect(normalized.metrics.likes).toBe(10);
    });
  });

  describe('error handling', () => {
    test('should handle malformed job data', async () => {
      const malformedJob = {
        id: 'bad-job',
        organization_id: 'org-123'
        // Missing platform and payload
      };

      await expect(worker.processJob(malformedJob)).rejects.toThrow();
    });

    test('should handle empty comment responses', async () => {
      const job = {
        id: 'job-empty',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: { post_id: 'tweet-456' }
      };

      mockTwitterService.fetchComments.mockResolvedValue({
        comments: [],
        hasMore: false
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.newComments).toBe(0);
      expect(result.duplicates).toBe(0);
      expect(result.queuedForAnalysis).toBe(0);
    });
  });

  describe('storeComments', () => {
    test('should store multiple new comments', async () => {
      const comments = [
        {
          platform_comment_id: 'comment-1',
          platform_user_id: 'user-1',
          platform_username: 'user1',
          original_text: 'First comment',
          platform: 'twitter',
          metadata: {}
        },
        {
          platform_comment_id: 'comment-2',
          platform_user_id: 'user-2',
          platform_username: 'user2',
          original_text: 'Second comment',
          platform: 'twitter',
          metadata: {}
        }
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'db-comment-1', ...comments[0] },
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'db-comment-2', ...comments[1] },
                error: null
              })
            })
          })
        });

      const result = await worker.storeComments('org-123', 'config-123', 'twitter', comments);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('db-comment-1');
      expect(result[1].id).toBe('db-comment-2');
    });

    test('should skip duplicate comments', async () => {
      const comments = [
        {
          platform_comment_id: 'existing-comment',
          platform_user_id: 'user-1',
          original_text: 'Existing comment',
          platform: 'twitter'
        },
        {
          platform_comment_id: 'new-comment',
          platform_user_id: 'user-2',
          original_text: 'New comment',
          platform: 'twitter'
        }
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'existing-id' },
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'new-id', ...comments[1] },
                error: null
              })
            })
          })
        });

      const result = await worker.storeComments('org-123', 'config-123', 'twitter', comments);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('new-id');
    });

    test('should return empty array for empty input', async () => {
      const result = await worker.storeComments('org-123', 'config-123', 'twitter', []);

      expect(result).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    test('should handle insert errors gracefully', async () => {
      const comments = [
        {
          platform_comment_id: 'comment-error',
          platform_user_id: 'user-1',
          original_text: 'Comment with error',
          platform: 'twitter'
        }
      ];

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' }
              })
            })
          })
        });

      const result = await worker.storeComments('org-123', 'config-123', 'twitter', comments);

      expect(result).toHaveLength(0);
      expect(worker.log).toHaveBeenCalledWith(
        'warn',
        'Failed to store comment',
        expect.any(Object)
      );
    });
  });

  describe('queueAnalysisJobs', () => {
    test('should queue jobs with Redis', async () => {
      const mockPipeline = {
        rpush: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1]
        ])
      };

      worker.redis = {
        pipeline: jest.fn(() => mockPipeline)
      };

      const comments = [
        { id: 'comment-1', platform: 'twitter', original_text: 'Comment 1' },
        { id: 'comment-2', platform: 'twitter', original_text: 'Comment 2' }
      ];

      await worker.queueAnalysisJobs('org-123', comments, 'corr-123');

      expect(worker.redis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.rpush).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(worker.log).toHaveBeenCalledWith('info', 'Queued analysis jobs', expect.any(Object));
    });

    test('should queue jobs with queueService', async () => {
      worker.redis = null;
      worker.queueService = {
        addJob: jest.fn().mockResolvedValue(true)
      };

      const comments = [{ id: 'comment-1', platform: 'twitter', original_text: 'Comment 1' }];

      await worker.queueAnalysisJobs('org-123', comments, 'corr-123');

      expect(worker.queueService.addJob).toHaveBeenCalledWith(
        'analyze_toxicity',
        expect.objectContaining({
          comment_id: 'comment-1',
          organization_id: 'org-123',
          platform: 'twitter',
          correlationId: 'corr-123'
        }),
        5
      );
    });

    test('should queue jobs with database fallback', async () => {
      worker.redis = null;
      worker.queueService = null;
      worker.supabase = mockSupabase;

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const comments = [{ id: 'comment-1', platform: 'twitter', original_text: 'Comment 1' }];

      await worker.queueAnalysisJobs('org-123', comments, 'corr-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('job_queue');
      expect(worker.log).toHaveBeenCalledWith('info', 'Queued analysis jobs', expect.any(Object));
    });

    test('should handle queue errors gracefully', async () => {
      worker.redis = null;
      worker.queueService = null;
      worker.supabase = mockSupabase;

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: { message: 'Database error' }
        })
      });

      const comments = [{ id: 'comment-1', platform: 'twitter', original_text: 'Comment 1' }];

      await worker.queueAnalysisJobs('org-123', comments, 'corr-123');

      expect(worker.log).toHaveBeenCalledWith(
        'error',
        'Failed to queue analysis jobs',
        expect.objectContaining({
          count: 1,
          error: 'Database error'
        })
      );
    });

    test('should return early for empty comments array', async () => {
      await worker.queueAnalysisJobs('org-123', [], 'corr-123');

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(worker.queueService?.addJob).not.toHaveBeenCalled();
    });
  });

  describe('fetchCommentsFromPlatform', () => {
    test('should use platform service if available', async () => {
      const mockService = {
        fetchComments: jest.fn().mockResolvedValue({
          comments: [{ id: 'comment-1', text: 'Test' }]
        })
      };

      worker.platformServices.set('twitter', mockService);
      worker._buildServicePayload = jest.fn().mockReturnValue({ test: 'payload' });

      const config = { id: 'config-123', platform: 'twitter' };
      const payload = { post_id: 'tweet-123' };

      const result = await worker.fetchCommentsFromPlatform('twitter', config, payload);

      expect(mockService.fetchComments).toHaveBeenCalledWith({ test: 'payload' });
      expect(result.comments).toBeDefined();
    });

    test('should delegate to platform-specific methods', async () => {
      worker.fetchTwitterComments = jest.fn().mockResolvedValue({
        comments: [{ id: 'comment-1', text: 'Twitter comment' }]
      });

      const mockClient = { test: 'client' };
      worker.platformClients.set('twitter', mockClient);

      const config = { id: 'config-123', platform: 'twitter' };
      const payload = { post_id: 'tweet-123' };

      const result = await worker.fetchCommentsFromPlatform('twitter', config, payload);

      expect(worker.fetchTwitterComments).toHaveBeenCalledWith(mockClient, config, payload);
      expect(result.comments).toBeDefined();
    });

    test('should throw error for unsupported platform', async () => {
      await expect(worker.fetchCommentsFromPlatform('unsupported', {}, {})).rejects.toThrow(
        'Unsupported platform: unsupported'
      );
    });

    test('should handle platform service fetch errors', async () => {
      const mockService = {
        fetchComments: jest.fn().mockRejectedValue(new Error('Platform service error'))
      };

      worker.platformServices.set('twitter', mockService);
      worker._buildServicePayload = jest.fn().mockReturnValue({ test: 'payload' });
      worker.log = jest.fn();

      const config = { id: 'config-123', platform: 'twitter' };
      const payload = { post_id: 'tweet-123' };

      await expect(worker.fetchCommentsFromPlatform('twitter', config, payload)).rejects.toThrow(
        'Platform service error'
      );
    });
  });

  describe('fetchTwitterComments', () => {
    test('should fetch Twitter comments successfully', async () => {
      const mockClient = {
        v2: {
          userMentionTimeline: jest.fn().mockResolvedValue({
            data: {
              data: [
                {
                  id: 'tweet-1',
                  text: 'Test tweet',
                  author_id: 'user-1',
                  created_at: '2024-01-01T00:00:00Z',
                  public_metrics: { like_count: 5, reply_count: 2 }
                }
              ]
            },
            includes: {
              users: [{ id: 'user-1', username: 'testuser' }]
            }
          })
        }
      };

      const config = { id: 'config-123' };
      const payload = { since_id: '100' };

      const result = await worker.fetchTwitterComments(mockClient, config, payload);

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('twitter');
      expect(result[0].original_text).toBe('Test tweet');
      expect(mockClient.v2.userMentionTimeline).toHaveBeenCalled();
    });

    test('should handle Twitter API errors', async () => {
      const mockClient = {
        v2: {
          userMentionTimeline: jest.fn().mockRejectedValue(new Error('Twitter API error'))
        }
      };

      worker.log = jest.fn();

      await expect(worker.fetchTwitterComments(mockClient, {}, {})).rejects.toThrow(
        'Twitter API error: Twitter API error'
      );

      expect(worker.log).toHaveBeenCalledWith(
        'error',
        'Failed to fetch Twitter comments',
        expect.any(Object)
      );
    });
  });

  describe('fetchYouTubeComments', () => {
    test('should fetch YouTube comments successfully', async () => {
      const mockClient = {
        commentThreads: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [
                {
                  id: 'thread-1',
                  snippet: {
                    topLevelComment: {
                      snippet: {
                        textDisplay: 'Great video!',
                        authorChannelId: { value: 'channel-1' },
                        authorDisplayName: 'Test User',
                        publishedAt: '2024-01-01T00:00:00Z',
                        likeCount: 10,
                        canReply: true
                      }
                    }
                  }
                }
              ]
            }
          })
        }
      };

      const config = { config: { monitored_videos: ['video-1'] } };
      const payload = { video_ids: ['video-1'] };

      const result = await worker.fetchYouTubeComments(mockClient, config, payload);

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('youtube');
      expect(result[0].original_text).toBe('Great video!');
      expect(mockClient.commentThreads.list).toHaveBeenCalled();
    });

    test('should handle YouTube API errors for individual videos', async () => {
      const mockClient = {
        commentThreads: {
          list: jest
            .fn()
            .mockRejectedValueOnce(new Error('Video not found'))
            .mockResolvedValue({
              data: { items: [] }
            })
        }
      };

      worker.log = jest.fn();

      const config = { config: { monitored_videos: ['video-1', 'video-2'] } };
      const payload = { video_ids: ['video-1', 'video-2'] };

      const result = await worker.fetchYouTubeComments(mockClient, config, payload);

      expect(result).toHaveLength(0);
      expect(worker.log).toHaveBeenCalledWith(
        'warn',
        'Failed to fetch comments for video',
        expect.any(Object)
      );
    });

    test('should handle YouTube API general errors', async () => {
      const mockClient = {
        commentThreads: {
          list: jest.fn().mockRejectedValue(new Error('YouTube API error'))
        }
      };

      worker.log = jest.fn();

      await expect(worker.fetchYouTubeComments(mockClient, {}, {})).rejects.toThrow(
        'YouTube API error: YouTube API error'
      );

      expect(worker.log).toHaveBeenCalledWith(
        'error',
        'Failed to fetch YouTube comments',
        expect.any(Object)
      );
    });
  });

  describe('processJob error scenarios', () => {
    test('should handle integration config not enabled', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: { since_id: '100' }
      };

      worker.setIntegrationConfigOverride({ enabled: false });

      await expect(worker.processJob(job)).rejects.toThrow('Integration twitter is not enabled');
    });

    test('should handle fetchCommentsFromPlatform returning empty array', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: { since_id: '100' }
      };

      mockTwitterService.fetchComments.mockResolvedValue([]);
      worker.setIntegrationConfigOverride({ enabled: true });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.newComments).toBe(0);
      expect(result.queuedForAnalysis).toBe(0);
    });
  });

  describe('queueAnalysisJobs', () => {
    test('should queue analysis jobs for stored comments', async () => {
      const organizationId = 'org-123';
      const correlationId = 'corr-123';
      const storedComments = [
        { id: 'comment-1', platform: 'twitter', original_text: 'Test 1' },
        { id: 'comment-2', platform: 'twitter', original_text: 'Test 2' }
      ];

      worker.queueService = mockQueueService;
      worker.log = jest.fn();

      await worker.queueAnalysisJobs(organizationId, storedComments, correlationId);

      expect(mockQueueService.addJob).toHaveBeenCalledTimes(2);
      expect(mockQueueService.addJob).toHaveBeenCalledWith({
        organization_id: organizationId,
        job_type: 'analyze_toxicity',
        priority: 5,
        payload: expect.objectContaining({
          comment_id: 'comment-1',
          organization_id: organizationId,
          platform: 'twitter',
          text: 'Test 1',
          correlationId
        }),
        max_attempts: 3
      });
    });

    test('should handle empty comments array', async () => {
      const organizationId = 'org-123';
      const correlationId = 'corr-123';

      worker.queueService = mockQueueService;
      worker.log = jest.fn();

      await worker.queueAnalysisJobs(organizationId, [], correlationId);

      expect(mockQueueService.addJob).not.toHaveBeenCalled();
    });

    test('should handle queue service errors gracefully', async () => {
      const organizationId = 'org-123';
      const correlationId = 'corr-123';
      const storedComments = [{ id: 'comment-1', platform: 'twitter', original_text: 'Test 1' }];

      worker.queueService = mockQueueService;
      worker.log = jest.fn();
      mockQueueService.addJob.mockRejectedValue(new Error('Queue service unavailable'));

      await worker.queueAnalysisJobs(organizationId, storedComments, correlationId);

      expect(worker.log).toHaveBeenCalledWith(
        'error',
        'Failed to queue analysis job',
        expect.any(Object)
      );
    });
  });

  describe('normalizeCommentData', () => {
    test('should normalize Twitter comment data structure', () => {
      const rawComment = {
        id: '1234567890',
        text: 'Great tweet!',
        author_id: '9876543210',
        created_at: '2024-01-15T10:30:00Z',
        public_metrics: {
          like_count: 5,
          reply_count: 2,
          retweet_count: 1
        },
        lang: 'en'
      };

      const normalized = worker.normalizeCommentData(rawComment, 'twitter');

      expect(normalized.id).toBe('1234567890');
      expect(normalized.text).toBe('Great tweet!');
      expect(normalized.author_id).toBe('9876543210');
      expect(normalized.created_at).toBe('2024-01-15T10:30:00Z');
      expect(normalized.metrics.likes).toBe(5);
      expect(normalized.metrics.replies).toBe(2);
      expect(normalized.metrics.retweets).toBe(1);
      expect(normalized.language).toBe('en');
    });

    test('should normalize YouTube comment data', () => {
      const rawComment = {
        id: 'yt_comment_123',
        snippet: {
          textDisplay: 'Amazing video!',
          authorChannelId: { value: 'channel_456' },
          publishedAt: '2024-01-15T10:30:00Z',
          likeCount: 10
        }
      };

      const normalized = worker.normalizeCommentData(rawComment, 'youtube');

      expect(normalized.id).toBe('yt_comment_123');
      expect(normalized.text).toBe('Amazing video!');
      expect(normalized.author_id).toBe('channel_456');
      expect(normalized.created_at).toBe('2024-01-15T10:30:00Z');
      expect(normalized.metrics.likes).toBe(10);
    });

    test('should handle unknown platform by returning original comment', () => {
      const rawComment = {
        platform_comment_id: '123',
        original_text: 'Test',
        platform_user_id: 'user-1'
      };

      const normalized = worker.normalizeCommentData(rawComment, 'unknown');

      expect(normalized).toEqual(rawComment);
    });
  });

  describe('_buildServicePayload', () => {
    test('should build service payload for Twitter', () => {
      const config = {
        id: 'config-123',
        organization_id: 'org-123',
        platform: 'twitter',
        config: { monitored_accounts: ['@test'] }
      };
      const payload = { post_id: 'tweet-456', since_id: '100', max_results: 50 };

      const servicePayload = worker._buildServicePayload('twitter', config, payload);

      expect(servicePayload).toHaveProperty('postId', 'tweet-456');
      expect(servicePayload).toHaveProperty('sinceId', '100');
      expect(servicePayload).toHaveProperty('maxResults', 50);
    });

    test('should build service payload for YouTube', () => {
      const config = {
        id: 'config-123',
        organization_id: 'org-123',
        platform: 'youtube'
      };
      const payload = { video_id: 'video-123', page_token: 'token-456' };

      const servicePayload = worker._buildServicePayload('youtube', config, payload);

      expect(servicePayload).toHaveProperty('videoId', 'video-123');
      expect(servicePayload).toHaveProperty('pageToken', 'token-456');
    });

    test('should return original payload for unknown platform', () => {
      const config = { id: 'config-123' };
      const payload = { custom_field: 'value' };

      const servicePayload = worker._buildServicePayload('unknown', config, payload);

      expect(servicePayload).toEqual({ custom_field: 'value' });
    });
  });

  describe('storeComments edge cases', () => {
    test('should handle comments with missing platform_comment_id', async () => {
      const organizationId = 'org-123';
      const integrationConfigId = 'config-123';
      const platform = 'twitter';
      const comments = [{ original_text: 'Comment without ID', platform_user_id: 'user-1' }];

      worker.supabase = mockSupabase;
      worker.log = jest.fn();

      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle
        })
      });

      mockSupabase.from = jest.fn().mockReturnValue({
        select: mockSelect,
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await worker.storeComments(
        organizationId,
        integrationConfigId,
        platform,
        comments
      );

      expect(result).toHaveLength(0); // Comments without platform_comment_id should be skipped
    });

    test('should handle bulk insert errors', async () => {
      const organizationId = 'org-123';
      const integrationConfigId = 'config-123';
      const platform = 'twitter';
      const comments = [
        {
          platform: 'twitter',
          platform_comment_id: 'tweet-1',
          original_text: 'Test 1',
          platform_user_id: 'user-1'
        },
        {
          platform: 'twitter',
          platform_comment_id: 'tweet-2',
          original_text: 'Test 2',
          platform_user_id: 'user-2'
        }
      ];

      worker.supabase = mockSupabase;
      worker.log = jest.fn();

      const mockMaybeSingle = jest
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle
        })
      });

      const mockInsert = jest
        .fn()
        .mockResolvedValueOnce({
          error: null,
          data: [{ id: 'comment-1' }]
        })
        .mockResolvedValueOnce({
          error: { message: 'Insert failed' }
        });

      mockSupabase.from = jest.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert
      });

      const result = await worker.storeComments(
        organizationId,
        integrationConfigId,
        platform,
        comments
      );

      expect(result.length).toBeGreaterThan(0);
      expect(worker.log).toHaveBeenCalledWith(
        'error',
        'Failed to store comment',
        expect.any(Object)
      );
    });
  });

  describe('rate limit handling', () => {
    test('should handle rate limit errors from platform services', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: { since_id: '100' }
      };

      mockTwitterService.fetchComments.mockRejectedValue({
        code: 429,
        message: 'Rate limit exceeded',
        rateLimitReset: Date.now() + 900000
      });

      worker.setIntegrationConfigOverride({ enabled: true });

      await expect(worker.processJob(job)).rejects.toThrow();
      expect(worker.log).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('fetch'),
        expect.any(Object)
      );
    });
  });

  describe('cost control edge cases', () => {
    test('should handle cost control limits being reached', async () => {
      const job = {
        id: 'job-123',
        organization_id: 'org-123',
        platform: 'twitter',
        payload: { since_id: '100' }
      };

      mockCostControlService.canPerformOperation.mockResolvedValue({
        allowed: false,
        reason: 'Daily limit exceeded'
      });

      worker.setIntegrationConfigOverride({ enabled: true });

      await expect(worker.processJob(job)).rejects.toThrow('has reached limits');
    });
  });
});
