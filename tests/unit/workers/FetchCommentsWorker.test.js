/**
 * Fetch Comments Worker Tests
 * 
 * Tests for comment fetching from multiple social media platforms
 */

const FetchCommentsWorker = require('../../../src/workers/FetchCommentsWorker');

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
  };
});

// Mock Cost Control service
const mockCostControlService = {
  canPerformOperation: jest.fn(),
  recordUsage: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControlService);
});

// Mock external API libraries
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    v2: {
      search: jest.fn(),
      userMentionTimeline: jest.fn()
    }
  }))
}));

jest.mock('googleapis', () => ({
  google: {
    youtube: jest.fn().mockImplementation(() => ({
      comments: {
        list: jest.fn()
      }
    }))
  }
}));

describe('FetchCommentsWorker', () => {
  let worker;
  let mockSupabase;
  let mockQueueService;

  beforeEach(() => {
    worker = new FetchCommentsWorker();
    mockSupabase = worker.supabase;
    mockQueueService = worker.queueService;
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { exists: false },
              error: null
            })
          })
        })
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

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
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
              single: jest.fn().mockResolvedValue({
                data: { id: 'existing-comment' }, // Comment exists
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
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

      mockTwitterService.fetchComments.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

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
              single: jest.fn().mockResolvedValue({
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
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
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

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });

      await expect(worker.storeComment(comment, job)).rejects.toThrow(
        'Database connection failed'
      );
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
      mockTwitterService.initialize.mockRejectedValue(
        new Error('Twitter API credentials invalid')
      );

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
});