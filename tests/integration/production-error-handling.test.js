/**
 * Production Error Handling Tests - Issue #90
 * 
 * Tests realistic error scenarios that occur in production environments.
 * Validates error handling, recovery mechanisms, and user experience.
 */

const request = require('supertest');
const nock = require('nock');
const app = require('../../src/index');

describe('Production Error Handling - Issue #90', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ENABLE_MOCK_MODE = 'true';
    nock.cleanAll();
  });

  afterEach(() => {
    process.env = originalEnv;
    nock.cleanAll();
  });

  describe('API Rate Limiting Scenarios', () => {
    test('should handle Twitter API rate limit (429) with proper retry headers', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
      
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(429, {
          title: 'Too Many Requests',
          detail: 'Too Many Requests',
          type: 'https://api.twitter.com/2/problems/too-many-requests'
        }, {
          'x-rate-limit-limit': '300',
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': resetTime.toString(),
          'retry-after': '900'
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/rate limit exceeded/i);
      expect(response.body.retryAfter).toBeDefined();
      expect(response.body.retryAfter).toBeGreaterThan(0);
      expect(response.body.resetTime).toBeDefined();
    });

    test('should handle YouTube API quota exceeded (403)', async () => {
      nock('https://www.googleapis.com')
        .get('/youtube/v3/commentThreads')
        .query(true)
        .reply(403, {
          error: {
            code: 403,
            message: 'The request cannot be completed because you have exceeded your quota.',
            errors: [
              {
                message: 'The request cannot be completed because you have exceeded your quota.',
                domain: 'youtube.quota',
                reason: 'quotaExceeded'
              }
            ]
          }
        });

      const response = await request(app)
        .get('/api/integrations/youtube/comments?videoId=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/quota exceeded/i);
      expect(response.body.errorType).toBe('QUOTA_EXCEEDED');
      expect(response.body.suggestions).toContain('Try again tomorrow when quota resets');
    });

    test('should handle Instagram API rate limiting with backoff strategy', async () => {
      nock('https://graph.instagram.com')
        .get('/me/media')
        .query(true)
        .reply(429, {
          error: {
            message: 'Application request limit reached',
            type: 'OAuthRateLimitException',
            code: 4,
            error_subcode: 2018218,
            fbtrace_id: 'test-trace-id'
          }
        }, {
          'x-app-usage': '{"call_count":100,"total_cputime":25,"total_time":300}',
          'retry-after': '3600'
        });

      const response = await request(app)
        .get('/api/integrations/instagram/posts')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/rate limit|request limit/i);
      expect(response.body.retryAfter).toBe(3600);
      expect(response.body.usageInfo).toBeDefined();
    });
  });

  describe('Authentication and Authorization Errors', () => {
    test('should handle expired Twitter Bearer Token (401)', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(401, {
          title: 'Unauthorized',
          detail: 'Unauthorized',
          type: 'https://api.twitter.com/2/problems/unauthorized'
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/unauthorized|invalid credentials/i);
      expect(response.body.errorType).toBe('AUTH_EXPIRED');
      expect(response.body.action).toBe('REAUTHORIZE');
      expect(response.body.reauthorizeUrl).toBeDefined();
    });

    test('should handle revoked Instagram access token', async () => {
      nock('https://graph.instagram.com')
        .get('/me/media')
        .query(true)
        .reply(400, {
          error: {
            message: 'Error validating access token: Session has expired on Thursday, 01-Jan-24 00:00:00 PST.',
            type: 'OAuthException',
            code: 190,
            error_subcode: 463
          }
        });

      const response = await request(app)
        .get('/api/integrations/instagram/posts')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/token expired|session expired/i);
      expect(response.body.errorType).toBe('TOKEN_EXPIRED');
      expect(response.body.platform).toBe('instagram');
    });

    test('should handle insufficient OAuth scopes (403)', async () => {
      nock('https://www.googleapis.com')
        .get('/youtube/v3/commentThreads')
        .query(true)
        .reply(403, {
          error: {
            code: 403,
            message: 'Insufficient Permission',
            errors: [
              {
                message: 'Insufficient Permission',
                domain: 'youtube.common',
                reason: 'insufficientPermissions'
              }
            ]
          }
        });

      const response = await request(app)
        .get('/api/integrations/youtube/comments?videoId=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/insufficient permission/i);
      expect(response.body.errorType).toBe('INSUFFICIENT_SCOPES');
      expect(response.body.requiredScopes).toContain('https://www.googleapis.com/auth/youtube.readonly');
    });
  });

  describe('Network and Connectivity Issues', () => {
    test('should handle API service unavailable (503)', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(503, {
          title: 'Service Unavailable',
          detail: 'The Twitter API is temporarily unavailable',
          type: 'https://api.twitter.com/2/problems/service-unavailable'
        }, {
          'retry-after': '300'
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/service unavailable|temporarily unavailable/i);
      expect(response.body.retryAfter).toBe(300);
      expect(response.body.isTemporary).toBe(true);
    });

    test('should handle network timeouts gracefully', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .delay(31000) // 31 second delay
        .reply(200, { data: [] });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token')
        .timeout(30000);

      expect([408, 504]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/timeout|request timeout/i);
      expect(response.body.errorType).toBe('TIMEOUT');
      expect(response.body.suggestion).toMatch(/try again|retry/i);
    }, 35000);

    test('should handle DNS resolution failures', async () => {
      nock('https://invalid-api-domain.com')
        .get('/api/endpoint')
        .replyWithError({
          code: 'ENOTFOUND',
          message: 'getaddrinfo ENOTFOUND invalid-api-domain.com'
        });

      // Mock an endpoint that would call an invalid domain
      const response = await request(app)
        .get('/api/test/network-error')
        .set('Authorization', 'Bearer mock-token');

      expect([503, 504]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/network error|connection failed/i);
      expect(response.body.errorType).toBe('NETWORK_ERROR');
    });
  });

  describe('Data Validation and Edge Cases', () => {
    test('should handle malformed API responses gracefully', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(200, 'invalid json response that cannot be parsed');

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      expect([400, 502]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid response|parse error/i);
      expect(response.body.errorType).toBe('INVALID_RESPONSE');
    });

    test('should handle empty or null API responses', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(200, null);

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      expect([200, 204]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.tweets).toEqual([]);
        expect(response.body.message).toMatch(/no.*found|empty.*result/i);
      }
    });

    test('should validate request parameters and reject invalid input', async () => {
      const response = await request(app)
        .get('/api/integrations/twitter/tweets')
        .query({
          query: '', // Empty query
          max_results: 'invalid_number',
          tweet_fields: 'invalid_field'
        })
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid.*parameter|validation.*error/i);
      expect(response.body.validationErrors).toBeDefined();
      expect(Array.isArray(response.body.validationErrors)).toBe(true);
    });
  });

  describe('Resource Access and Permissions', () => {
    test('should handle forbidden resource access (403)', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(403, {
          title: 'Forbidden',
          detail: 'You are not allowed to access this resource',
          type: 'https://api.twitter.com/2/problems/forbidden'
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/forbidden|not allowed/i);
      expect(response.body.errorType).toBe('FORBIDDEN');
    });

    test('should handle resource not found (404)', async () => {
      nock('https://www.googleapis.com')
        .get('/youtube/v3/commentThreads')
        .query(true)
        .reply(404, {
          error: {
            code: 404,
            message: 'Video not found',
            errors: [
              {
                message: 'Video not found',
                domain: 'youtube.common',
                reason: 'videoNotFound'
              }
            ]
          }
        });

      const response = await request(app)
        .get('/api/integrations/youtube/comments?videoId=invalid_video_id')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/not found|video not found/i);
      expect(response.body.errorType).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.resource).toBe('video');
    });

    test('should handle private content access restrictions', async () => {
      nock('https://graph.instagram.com')
        .get('/me/media')
        .query(true)
        .reply(400, {
          error: {
            message: 'This content is private and cannot be accessed',
            type: 'IGApiException',
            code: 100,
            error_subcode: 2108006
          }
        });

      const response = await request(app)
        .get('/api/integrations/instagram/posts')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/private.*content|content.*private/i);
      expect(response.body.errorType).toBe('PRIVATE_CONTENT');
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    test('should implement exponential backoff for transient errors', async () => {
      let callCount = 0;
      
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .times(3)
        .reply(() => {
          callCount++;
          if (callCount < 3) {
            return [502, { error: 'Bad Gateway' }];
          }
          return [200, { data: [{ id: '123', text: 'Success after retry' }] }];
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test&retry=true')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta).toHaveProperty('retryCount');
      expect(response.body.meta.retryCount).toBeGreaterThan(0);
    });

    test('should respect max retry limits and fail gracefully', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .times(5) // More than max retries
        .reply(502, { error: 'Bad Gateway' });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test&retry=true')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/max.*retries|retry.*limit/i);
      expect(response.body.retryCount).toBeDefined();
      expect(response.body.lastError).toBeDefined();
    });
  });

  describe('Platform-Specific Error Handling', () => {
    test('should handle Twitter API v2 specific errors', async () => {
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(400, {
          errors: [
            {
              parameters: {
                'tweet.fields': ['invalid_field']
              },
              message: 'The tweet.fields query parameter value [invalid_field] is not one of [attachments,author_id,context_annotations,conversation_id,created_at,edit_controls,entities,geo,id,in_reply_to_user_id,lang,public_metrics,possibly_sensitive,referenced_tweets,reply_settings,source,text,withheld]'
            }
          ]
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test&tweet_fields=invalid_field')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid.*field|parameter.*invalid/i);
      expect(response.body.validFields).toBeDefined();
      expect(Array.isArray(response.body.validFields)).toBe(true);
    });

    test('should handle YouTube API specific quota and policy errors', async () => {
      nock('https://www.googleapis.com')
        .get('/youtube/v3/commentThreads')
        .query(true)
        .reply(403, {
          error: {
            code: 403,
            message: 'Comments are disabled for this video',
            errors: [
              {
                message: 'Comments are disabled for this video',
                domain: 'youtube.commentThread',
                reason: 'commentsDisabled'
              }
            ]
          }
        });

      const response = await request(app)
        .get('/api/integrations/youtube/comments?videoId=comments_disabled_video')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/comments.*disabled/i);
      expect(response.body.errorType).toBe('COMMENTS_DISABLED');
      expect(response.body.videoId).toBe('comments_disabled_video');
    });
  });
});