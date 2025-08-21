/**
 * Simplified tests for GDPR rate limiting middleware
 * Issue #115: Verify rate limiting configuration
 */

const request = require('supertest');
const express = require('express');

describe('GDPR Rate Limiting Configuration', () => {
  it('should load all rate limiters without errors', () => {
    const limiters = require('../../../src/middleware/gdprRateLimiter');
    
    expect(limiters.accountDeletionLimiter).toBeDefined();
    expect(limiters.dataExportLimiter).toBeDefined();
    expect(limiters.dataDownloadLimiter).toBeDefined();
    expect(limiters.deletionCancellationLimiter).toBeDefined();
    expect(limiters.gdprGlobalLimiter).toBeDefined();
  });

  it('should have correct configuration for account deletion limiter', () => {
    const { accountDeletionLimiter } = require('../../../src/middleware/gdprRateLimiter');
    
    // Check if it's a function (middleware)
    expect(typeof accountDeletionLimiter).toBe('function');
  });

  it('should apply rate limiting to user routes', () => {
    // Check that user routes imports the rate limiters
    const userRoutesContent = require('fs').readFileSync(
      require('path').join(__dirname, '../../../src/routes/user.js'),
      'utf8'
    );
    
    // Verify imports
    expect(userRoutesContent).toContain('gdprRateLimiter');
    expect(userRoutesContent).toContain('accountDeletionLimiter');
    expect(userRoutesContent).toContain('dataExportLimiter');
    expect(userRoutesContent).toContain('dataDownloadLimiter');
    
    // Verify rate limiters are applied to endpoints
    expect(userRoutesContent).toContain('router.delete(\'/account\', authenticateToken, gdprGlobalLimiter, accountDeletionLimiter');
    expect(userRoutesContent).toContain('router.get(\'/data-export\', authenticateToken, gdprGlobalLimiter, dataExportLimiter');
    expect(userRoutesContent).toContain('router.get(\'/data-export/download/:token\', gdprGlobalLimiter, dataDownloadLimiter');
  });

  describe('Rate Limiter Behavior', () => {
    let app;
    const originalEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'development'; // Enable rate limiting
    });

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    beforeEach(() => {
      const { accountDeletionLimiter, gdprGlobalLimiter } = require('../../../src/middleware/gdprRateLimiter');
      
      app = express();
      app.use(express.json());
      
      // Simple test endpoint
      app.delete('/test', gdprGlobalLimiter, accountDeletionLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should return rate limit headers', async () => {
      const response = await request(app)
        .delete('/test')
        .set('X-Forwarded-For', '192.168.1.1'); // Use unique IP
      
      // Should have rate limit headers
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should return 429 when rate limit is exceeded', async () => {
      const uniqueIp = `10.0.0.${Math.floor(Math.random() * 255)}`;
      let successfulRequests = 0;
      let rateLimitedResponse;
      
      // Make requests until we hit rate limit
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .delete('/test')
          .set('X-Forwarded-For', uniqueIp);
        
        if (response.status === 200) {
          successfulRequests++;
        } else if (response.status === 429) {
          rateLimitedResponse = response;
          break;
        }
      }
      
      // Should have some successful requests and then hit rate limit
      expect(successfulRequests).toBeGreaterThan(0);
      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse.body.error).toContain('Too many');
    });
  });

  describe('Skip Conditions', () => {
    it('should skip rate limiting in test environment', async () => {
      process.env.NODE_ENV = 'test';
      
      const { accountDeletionLimiter, gdprGlobalLimiter } = require('../../../src/middleware/gdprRateLimiter');
      const app = express();
      
      app.delete('/test', gdprGlobalLimiter, accountDeletionLimiter, (req, res) => {
        res.json({ success: true });
      });
      
      // Should allow many requests in test mode
      for (let i = 0; i < 10; i++) {
        await request(app)
          .delete('/test')
          .expect(200);
      }
      
      process.env.NODE_ENV = 'development';
    });
  });
});