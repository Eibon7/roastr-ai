/**
 * Rate Limiting and Token Expiration Tests - Issue #90
 * 
 * Tests rate limiting behavior, token expiration handling, and recovery mechanisms.
 * Validates production-ready rate limiting and token management scenarios.
 */

const request = require('supertest');
const nock = require('nock');
const app = require('../../src/index');

describe('Rate Limiting and Token Expiration - Issue #90', () => {
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
    test('should handle Twitter API rate limiting with proper backoff', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
      let requestCount = 0;

      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .times(5)
        .reply(() => {
          requestCount++;
          if (requestCount <= 3) {
            // First 3 requests succeed
            return [200, {
              data: [{ id: `tweet_${requestCount}`, text: `Tweet ${requestCount}` }],
              meta: { result_count: 1 }
            }];
          } else {
            // 4th and 5th requests hit rate limit
            return [429, {
              title: 'Too Many Requests',
              detail: 'Too Many Requests',
              type: 'https://api.twitter.com/2/problems/too-many-requests'
            }, {
              'x-rate-limit-limit': '300',
              'x-rate-limit-remaining': '0',
              'x-rate-limit-reset': resetTime.toString(),
              'retry-after': '900'
            }];
          }
        });

      // Make multiple requests to trigger rate limiting
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get(`/api/integrations/twitter/tweets?query=test${i}`)
          .set('Authorization', 'Bearer mock-token');
        responses.push(response);
      }

      // First 3 should succeed
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[2].status).toBe(200);

      // Last 2 should be rate limited
      expect(responses[3].status).toBe(429);
      expect(responses[4].status).toBe(429);

      // Check rate limit response format
      const rateLimitedResponse = responses[3];
      expect(rateLimitedResponse.body.success).toBe(false);
      expect(rateLimitedResponse.body.error).toMatch(/rate limit/i);
      expect(rateLimitedResponse.body.retryAfter).toBe(900);
      expect(rateLimitedResponse.body.resetTime).toBeDefined();
    });

    test('should respect different rate limits per platform', async () => {
      // Twitter rate limit
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(429, {}, {
          'x-rate-limit-limit': '300',
          'x-rate-limit-remaining': '0',
          'retry-after': '900'
        });

      // YouTube rate limit (different format)
      nock('https://www.googleapis.com')
        .get('/youtube/v3/commentThreads')
        .query(true)
        .reply(403, {
          error: {
            code: 403,
            message: 'The request cannot be completed because you have exceeded your quota.',
            errors: [{ reason: 'quotaExceeded' }]
          }
        });

      // Instagram rate limit
      nock('https://graph.instagram.com')
        .get('/me/media')
        .query(true)
        .reply(429, {
          error: {
            message: 'Application request limit reached',
            type: 'OAuthRateLimitException'
          }
        }, {
          'retry-after': '3600'
        });

      const twitterResponse = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      const youtubeResponse = await request(app)
        .get('/api/integrations/youtube/comments?videoId=test')
        .set('Authorization', 'Bearer mock-token');

      const instagramResponse = await request(app)
        .get('/api/integrations/instagram/posts')
        .set('Authorization', 'Bearer mock-token');

      // All should be rate limited but with different retry times
      expect(twitterResponse.status).toBe(429);
      expect(twitterResponse.body.retryAfter).toBe(900);

      expect(youtubeResponse.status).toBe(403);
      expect(youtubeResponse.body.errorType).toBe('QUOTA_EXCEEDED');

      expect(instagramResponse.status).toBe(429);
      expect(instagramResponse.body.retryAfter).toBe(3600);
    });

    test('should implement client-side rate limiting to prevent API overuse', async () => {
      // Mock successful responses
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .times(10)
        .reply(200, { data: [], meta: { result_count: 0 } });

      // Make rapid requests
      const startTime = Date.now();
      const responses = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get(`/api/integrations/twitter/tweets?query=rapid${i}`)
          .set('Authorization', 'Bearer mock-token')
          .set('X-Client-Rate-Limit', 'true'); // Enable client-side limiting
        responses.push(response);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should take at least some minimum time due to rate limiting
      expect(totalTime).toBeGreaterThan(1000); // At least 1 second for 10 requests

      // Some requests might be rejected by client-side limiting
      const rejectedRequests = responses.filter(r => r.status === 429);
      if (rejectedRequests.length > 0) {
        expect(rejectedRequests[0].body.error).toMatch(/client.*rate.*limit/i);
      }
    });
  });

  describe('Token Expiration Handling', () => {
    test('should detect and handle expired OAuth tokens', async () => {
      // Mock expired token response
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
      expect(response.body.error).toMatch(/unauthorized|expired/i);
      expect(response.body.errorType).toBe('AUTH_EXPIRED');
      expect(response.body.action).toBe('REAUTHORIZE');
      expect(response.body.reauthorizeUrl).toMatch(/\/api\/oauth\/twitter\/authorize/);
    });

    test('should attempt automatic token refresh when possible', async () => {
      // Mock initial request with expired token
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(401, {
          title: 'Unauthorized',
          detail: 'Unauthorized'
        });

      // Mock successful token refresh
      nock('https://api.twitter.com')
        .post('/2/oauth2/token')
        .reply(200, {
          access_token: 'new_access_token_12345',
          refresh_token: 'new_refresh_token_67890',
          expires_in: 7200,
          token_type: 'Bearer'
        });

      // Mock successful retry with new token
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(200, {
          data: [{ id: '123', text: 'Success with refreshed token' }],
          meta: { result_count: 1 }
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token')
        .set('X-Refresh-Token', 'mock-refresh-token')
        .set('X-Auto-Refresh', 'true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.tokenRefreshed).toBe(true);
      expect(response.body.meta.newTokenInfo).toBeDefined();
    });

    test('should handle refresh token expiration gracefully', async () => {
      // Mock initial request failure
      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(401, { title: 'Unauthorized' });

      // Mock refresh token failure
      nock('https://api.twitter.com')
        .post('/2/oauth2/token')
        .reply(400, {
          error: 'invalid_grant',
          error_description: 'Refresh token has expired'
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token')
        .set('X-Refresh-Token', 'expired-refresh-token')
        .set('X-Auto-Refresh', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/refresh.*expired|reauthorization.*required/i);
      expect(response.body.errorType).toBe('REFRESH_TOKEN_EXPIRED');
      expect(response.body.action).toBe('FULL_REAUTH');
      expect(response.body.reauthorizeUrl).toBeDefined();
    });

    test('should validate token expiration timing', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      // Test with valid (non-expired) token
      const validResponse = await request(app)
        .get('/api/oauth/token/validate')
        .set('Authorization', 'Bearer mock-token')
        .send({
          accessToken: 'valid_token',
          expiresAt: futureExpiry
        });

      expect(validResponse.status).toBe(200);
      expect(validResponse.body.valid).toBe(true);
      expect(validResponse.body.timeUntilExpiry).toBeGreaterThan(3000);

      // Test with expired token
      const expiredResponse = await request(app)
        .get('/api/oauth/token/validate')
        .set('Authorization', 'Bearer mock-token')
        .send({
          accessToken: 'expired_token',
          expiresAt: pastExpiry
        });

      expect(expiredResponse.status).toBe(401);
      expect(expiredResponse.body.valid).toBe(false);
      expect(expiredResponse.body.expired).toBe(true);
    });

    test('should provide early warning for soon-to-expire tokens', async () => {
      const soonToExpire = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now

      const response = await request(app)
        .get('/api/oauth/token/validate')
        .set('Authorization', 'Bearer mock-token')
        .send({
          accessToken: 'soon_to_expire_token',
          expiresAt: soonToExpire
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.warning).toBe('TOKEN_EXPIRING_SOON');
      expect(response.body.timeUntilExpiry).toBeLessThan(600); // Less than 10 minutes
      expect(response.body.shouldRefresh).toBe(true);
    });
  });

  describe('Rate Limit Recovery and Retry Logic', () => {
    test('should implement exponential backoff for rate-limited requests', async () => {
      let requestCount = 0;
      const requestTimes = [];

      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .times(4)
        .reply(() => {
          requestTimes.push(Date.now());
          requestCount++;
          if (requestCount <= 2) {
            return [429, {}, { 'retry-after': '1' }]; // Rate limited
          } else {
            return [200, { data: [], meta: { result_count: 0 } }]; // Success
          }
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token')
        .set('X-Auto-Retry', 'true')
        .set('X-Max-Retries', '3');

      expect(response.status).toBe(200);
      expect(response.body.meta.retryCount).toBeGreaterThan(0);

      // Verify exponential backoff timing
      if (requestTimes.length >= 3) {
        const firstDelay = requestTimes[1] - requestTimes[0];
        const secondDelay = requestTimes[2] - requestTimes[1];
        expect(secondDelay).toBeGreaterThanOrEqual(firstDelay);
      }
    });

    test('should respect server-provided retry-after headers', async () => {
      const retryAfterSeconds = 5;
      let firstRequestTime = 0;
      let retryRequestTime = 0;

      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(() => {
          firstRequestTime = Date.now();
          return [429, {}, { 'retry-after': retryAfterSeconds.toString() }];
        });

      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(() => {
          retryRequestTime = Date.now();
          return [200, { data: [], meta: { result_count: 0 } }];
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token')
        .set('X-Auto-Retry', 'true')
        .set('X-Respect-Retry-After', 'true');

      const actualDelay = (retryRequestTime - firstRequestTime) / 1000;
      expect(actualDelay).toBeGreaterThanOrEqual(retryAfterSeconds - 1); // Allow 1s tolerance
      expect(response.body.meta.retryDelay).toBe(retryAfterSeconds);
    });

    test('should implement jitter in retry timing to prevent thundering herd', async () => {
      const retryDelays = [];

      // Simulate multiple clients getting rate limited
      for (let i = 0; i < 5; i++) {
        nock('https://api.twitter.com')
          .get('/2/tweets/search/recent')
          .query(true)
          .reply(429, {}, { 'retry-after': '10' });

        nock('https://api.twitter.com')
          .get('/2/tweets/search/recent')
          .query(true)
          .reply(200, { data: [], meta: { result_count: 0 } });

        const startTime = Date.now();
        const response = await request(app)
          .get(`/api/integrations/twitter/tweets?query=test${i}`)
          .set('Authorization', 'Bearer mock-token')
          .set('X-Auto-Retry', 'true')
          .set('X-Add-Jitter', 'true');
        
        const actualDelay = Date.now() - startTime;
        retryDelays.push(actualDelay);
      }

      // Verify that not all delays are identical (jitter is applied)
      const uniqueDelays = new Set(retryDelays.map(d => Math.floor(d / 1000)));
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Platform-Specific Rate Limiting', () => {
    test('should handle Twitter API v2 rate limit windows correctly', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const resetTime = currentTime + 900; // 15 minutes

      nock('https://api.twitter.com')
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(429, {
          title: 'Too Many Requests',
          type: 'https://api.twitter.com/2/problems/too-many-requests'
        }, {
          'x-rate-limit-limit': '300',
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': resetTime.toString()
        });

      const response = await request(app)
        .get('/api/integrations/twitter/tweets?query=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(429);
      expect(response.body.rateLimitInfo.limit).toBe(300);
      expect(response.body.rateLimitInfo.remaining).toBe(0);
      expect(response.body.rateLimitInfo.resetTime).toBe(resetTime);
      expect(response.body.rateLimitInfo.windowMinutes).toBe(15);
    });

    test('should handle YouTube API daily quota limits', async () => {
      nock('https://www.googleapis.com')
        .get('/youtube/v3/commentThreads')
        .query(true)
        .reply(403, {
          error: {
            code: 403,
            message: 'The request cannot be completed because you have exceeded your quota.',
            errors: [{
              message: 'The request cannot be completed because you have exceeded your quota.',
              domain: 'youtube.quota',
              reason: 'quotaExceeded'
            }]
          }
        });

      const response = await request(app)
        .get('/api/integrations/youtube/comments?videoId=test')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(response.body.errorType).toBe('QUOTA_EXCEEDED');
      expect(response.body.quotaInfo.type).toBe('DAILY');
      expect(response.body.quotaInfo.resetTime).toMatch(/tomorrow/i);
      expect(response.body.suggestions).toContain('Try again tomorrow when quota resets');
    });

    test('should handle Instagram Graph API app-level rate limits', async () => {
      nock('https://graph.instagram.com')
        .get('/me/media')
        .query(true)
        .reply(429, {
          error: {
            message: 'Application request limit reached',
            type: 'OAuthRateLimitException',
            code: 4
          }
        }, {
          'x-app-usage': '{"call_count":100,"total_cputime":25,"total_time":300}',
          'retry-after': '3600'
        });

      const response = await request(app)
        .get('/api/integrations/instagram/posts')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(429);
      expect(response.body.rateLimitInfo.type).toBe('APPLICATION_LEVEL');
      expect(response.body.rateLimitInfo.callCount).toBe(100);
      expect(response.body.rateLimitInfo.retryAfter).toBe(3600);
      expect(response.body.rateLimitInfo.usagePercentage).toBe(100);
    });
  });

  describe('Webhook Token Validation', () => {
    test('should validate webhook signature tokens', async () => {
      const payload = JSON.stringify({ test: 'webhook payload' });
      const validSignature = 'sha256=valid_signature_hash';
      const invalidSignature = 'sha256=invalid_signature_hash';

      // Valid signature
      const validResponse = await request(app)
        .post('/api/webhooks/twitter')
        .set('X-Twitter-Webhook-Signature', validSignature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect([200, 401]).toContain(validResponse.status);

      // Invalid signature
      const invalidResponse = await request(app)
        .post('/api/webhooks/twitter')
        .set('X-Twitter-Webhook-Signature', invalidSignature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(invalidResponse.status).toBe(401);
      expect(invalidResponse.body.error).toMatch(/signature.*invalid|verification.*failed/i);
    });

    test('should handle webhook signature token expiration', async () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const payload = JSON.stringify({
        timestamp: expiredTimestamp,
        data: { test: 'expired webhook' }
      });

      const response = await request(app)
        .post('/api/webhooks/twitter')
        .set('X-Twitter-Webhook-Signature', 'sha256=signature_hash')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect([400, 401]).toContain(response.status);
      expect(response.body.error).toMatch(/timestamp.*expired|webhook.*too.*old/i);
    });
  });
});