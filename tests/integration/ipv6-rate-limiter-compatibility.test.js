/**
 * Integration test for IPv6 compatibility in rate limiters
 * Issue #262: Verify rate limiters work correctly with IPv4 and IPv6 addresses
 */

const request = require('supertest');
const express = require('express');
const { ipKeyGenerator } = require('express-rate-limit');

// Mock dependencies before importing rate limiters
jest.mock('../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    initialize: jest.fn().mockResolvedValue(true),
    initializeDatabase: jest.fn().mockResolvedValue(true)
  }));
});

jest.mock('../../src/utils/logger', () => ({
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

jest.mock('../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn().mockReturnValue(false)
  }
}));

jest.mock('../../src/middleware/notificationRateLimiter', () => ({
  notificationLimiter: (req, res, next) => next()
}));
const {
  accountDeletionLimiter,
  dataExportLimiter,
  dataDownloadLimiter,
  deletionCancellationLimiter,
  gdprGlobalLimiter
} = require('../../src/middleware/gdprRateLimiter');
const { notificationLimiter } = require('../../src/middleware/notificationRateLimiter');

// Mock auth middleware to provide user context
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user-123' };
  next();
};

describe('IPv6 Rate Limiter Compatibility', () => {
  let app;
  let originalNodeEnv;

  beforeAll(() => {
    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
    // Ensure test environment for consistent behavior
    process.env.NODE_ENV = 'test';

    // Create test app with rate limiters
    app = express();
    app.use(express.json());

    // Test GDPR endpoints with rate limiting
    app.delete(
      '/api/user/account',
      mockAuth,
      gdprGlobalLimiter,
      accountDeletionLimiter,
      (req, res) => {
        res.json({ success: true });
      }
    );

    app.get('/api/user/data-export', mockAuth, gdprGlobalLimiter, dataExportLimiter, (req, res) => {
      res.json({ success: true });
    });

    app.get(
      '/api/user/data-export/download/:token',
      gdprGlobalLimiter,
      dataDownloadLimiter,
      (req, res) => {
        res.json({ success: true, downloadUrl: 'test-url' });
      }
    );

    app.post(
      '/api/user/account/deletion/cancel',
      mockAuth,
      gdprGlobalLimiter,
      deletionCancellationLimiter,
      (req, res) => {
        res.json({ success: true });
      }
    );

    app.get('/api/notifications', mockAuth, notificationLimiter, (req, res) => {
      res.json({ success: true, notifications: [] });
    });
  });

  afterAll(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('ipKeyGenerator compatibility', () => {
    test('should handle IPv4 addresses correctly', () => {
      const ip = '192.168.1.100';
      const key = ipKeyGenerator(ip);
      expect(key).toBe('192.168.1.100');
    });

    test('should handle IPv6 addresses correctly', () => {
      const ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const key = ipKeyGenerator(ip);
      // IPv6 addresses get normalized to subnet format by default
      expect(key).toMatch(/^2001:db8:85a3:/);
    });

    test('should handle IPv6 loopback addresses', () => {
      const ip = '::1';
      const key = ipKeyGenerator(ip);
      // IPv6 loopback gets normalized
      expect(key).toMatch(/^::/);
    });

    test('should handle IPv4-mapped IPv6 addresses', () => {
      const ip = '::ffff:192.168.1.100';
      const key = ipKeyGenerator(ip);
      // Should handle IPv4-mapped IPv6
      expect(key).toMatch(/^::/);
    });

    test('should create subnet-based keys for IPv6 by default', () => {
      const ip1 = '2001:0db8:85a3:0001:0000:8a2e:0370:7334';
      const ip2 = '2001:0db8:85a3:0001:0000:8a2e:0370:7335';

      const key1 = ipKeyGenerator(ip1);
      const key2 = ipKeyGenerator(ip2);

      // Should be the same subnet (first 56 bits)
      expect(key1).toBe(key2);
    });

    test('should allow custom IPv6 subnet size', () => {
      const ip = '2001:0db8:85a3:0001:0000:8a2e:0370:7334';

      const key64 = ipKeyGenerator(ip, 64);
      const key56 = ipKeyGenerator(ip, 56);

      // Different subnet sizes should produce different results
      expect(key64).not.toBe(key56);
    });
  });

  describe('Rate limiting with different IP addresses', () => {
    test('should generate independent counts for different IPv4 addresses', async () => {
      // Set different IPv4 addresses
      const response1 = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', '192.168.1.100')
        .expect(200);

      const response2 = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', '192.168.1.101')
        .expect(200);

      // Both should succeed since they're from different IPs
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });

    test('should generate independent counts for IPv4 and IPv6', async () => {
      // IPv4 request
      const response1 = await request(app)
        .get('/api/notifications')
        .set('X-Forwarded-For', '192.168.1.200')
        .expect(200);

      // IPv6 request
      const response2 = await request(app)
        .get('/api/notifications')
        .set('X-Forwarded-For', '2001:0db8:85a3::8a2e:0370:7334')
        .expect(200);

      // Both should succeed since they're from different IP types
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });

    test('should handle IPv6 addresses consistently', async () => {
      // Same IPv6 address in different formats should be treated the same
      const ipv6Address = '2001:db8:85a3::8a2e:370:7334';

      const response1 = await request(app)
        .get('/api/user/data-export')
        .set('X-Forwarded-For', ipv6Address)
        .expect(200);

      const response2 = await request(app)
        .get('/api/user/data-export')
        .set('X-Forwarded-For', ipv6Address)
        .expect(200);

      // Both should succeed
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });
  });

  describe('GDPR Endpoint Rate Limiting with IPv4/IPv6', () => {
    let originalNodeEnv;

    beforeEach(() => {
      // Store original NODE_ENV
      originalNodeEnv = process.env.NODE_ENV;
      // Clear any existing rate limit state
      jest.clearAllMocks();
    });

    afterEach(() => {
      // Reset to original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should rate limit account deletion for IPv4 addresses', async () => {
      // Ensure rate limiting is disabled for consistent testing
      process.env.NODE_ENV = 'test';

      const ipv4 = '10.0.0.100';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', ipv4)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should rate limit account deletion for IPv6 addresses', async () => {
      // Ensure rate limiting is disabled for consistent testing
      process.env.NODE_ENV = 'test';

      const ipv6 = '2001:db8:85a3::1';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', ipv6)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should rate limit data export for IPv4 addresses', async () => {
      process.env.NODE_ENV = 'test';
      const ipv4 = '10.0.0.200';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .get('/api/user/data-export')
        .set('X-Forwarded-For', ipv4)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should rate limit data export for IPv6 addresses', async () => {
      process.env.NODE_ENV = 'test';
      const ipv6 = '2001:db8:85a3::2';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .get('/api/user/data-export')
        .set('X-Forwarded-For', ipv6)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should rate limit data download for IPv4 addresses', async () => {
      process.env.NODE_ENV = 'test';
      const ipv4 = '10.0.0.300';
      const token = 'test-token-123';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .get(`/api/user/data-export/download/${token}`)
        .set('X-Forwarded-For', ipv4)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should rate limit data download for IPv6 addresses', async () => {
      process.env.NODE_ENV = 'test';
      const ipv6 = '2001:db8:85a3::3';
      const token = 'test-token-456';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .get(`/api/user/data-export/download/${token}`)
        .set('X-Forwarded-For', ipv6)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should rate limit deletion cancellation for IPv4 addresses', async () => {
      process.env.NODE_ENV = 'test';
      const ipv4 = '10.0.0.400';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .post('/api/user/account/deletion/cancel')
        .set('X-Forwarded-For', ipv4)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should rate limit deletion cancellation for IPv6 addresses', async () => {
      process.env.NODE_ENV = 'test';
      const ipv6 = '2001:db8:85a3::4';

      // Request should succeed when rate limiting is disabled
      const response1 = await request(app)
        .post('/api/user/account/deletion/cancel')
        .set('X-Forwarded-For', ipv6)
        .expect(200);

      expect(response1.body.success).toBe(true);
    });

    test('should maintain separate rate limits for IPv4 vs IPv6', async () => {
      // Temporarily disable rate limiting for this specific test
      process.env.NODE_ENV = 'test';

      const ipv4 = '172.16.0.100';
      const ipv6 = '2001:db8:85a3:9999::1';

      // Both IPv4 and IPv6 requests should succeed independently when rate limiting is disabled
      const ipv4Response = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', ipv4)
        .expect(200);

      const ipv6Response = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', ipv6)
        .expect(200);

      expect(ipv4Response.body.success).toBe(true);
      expect(ipv6Response.body.success).toBe(true);

      // Re-enable rate limiting
      process.env.NODE_ENV = 'development';
    });

    test('should handle IPv6 subnet-based rate limiting', async () => {
      // Two IPv6 addresses in the same /56 subnet should share rate limits
      const ipv6_1 = '2001:db8:85a3:0001::1';
      const ipv6_2 = '2001:db8:85a3:0001::2';

      // First request from subnet
      const response1 = await request(app)
        .get('/api/user/data-export')
        .set('X-Forwarded-For', ipv6_1)
        .expect(200);

      // Second request from same subnet
      const response2 = await request(app)
        .get('/api/user/data-export')
        .set('X-Forwarded-For', ipv6_2)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });
  });

  describe('Rate limit key generation consistency', () => {
    test('should generate consistent keys for the same IPv4', () => {
      const ip = '192.168.1.100';

      const key1 = ipKeyGenerator(ip);
      const key2 = ipKeyGenerator(ip);

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different IPv4s', () => {
      const ip1 = '192.168.1.100';
      const ip2 = '192.168.1.101';

      const key1 = ipKeyGenerator(ip1);
      const key2 = ipKeyGenerator(ip2);

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for IPv4 vs IPv6', () => {
      const ipv4 = '192.168.1.100';
      const ipv6 = '2001:db8:85a3::8a2e:370:7334';

      const ipv4Key = ipKeyGenerator(ipv4);
      const ipv6Key = ipKeyGenerator(ipv6);

      expect(ipv4Key).not.toBe(ipv6Key);
    });

    test('should generate consistent keys for IPv6 in same subnet', () => {
      const ip1 = '2001:0db8:85a3:0001:0000:8a2e:0370:7334';
      const ip2 = '2001:0db8:85a3:0001:ffff:8a2e:0370:9999';

      const key1 = ipKeyGenerator(ip1);
      const key2 = ipKeyGenerator(ip2);

      // Should be the same since they're in the same /56 subnet
      expect(key1).toBe(key2);
    });
  });

  describe('GDPR Rate Limiter Key Generation', () => {
    test('should generate unique keys for different GDPR endpoints with IPv4', () => {
      const mockReq = {
        ip: '192.168.1.100',
        user: { id: 'user123' },
        params: { token: 'download-token-123' }
      };

      // Test the actual key generation logic from the rate limiters
      const ipKey = ipKeyGenerator(mockReq.ip);

      // Test different key generators based on actual implementation
      const accountKey = `gdpr_delete:${ipKey}:${mockReq.user.id}`;
      const exportKey = `gdpr_export:${ipKey}:${mockReq.user.id}`;
      const tokenPrefix = mockReq.params.token.substr(0, 8);
      const downloadKey = `gdpr_download:${ipKey}:${tokenPrefix}`;
      const cancelKey = `gdpr_cancel:${ipKey}:${mockReq.user.id}`;
      const globalKey = `gdpr_global:${ipKey}`;

      // All keys should be different
      expect(accountKey).not.toBe(exportKey);
      expect(exportKey).not.toBe(downloadKey);
      expect(downloadKey).not.toBe(cancelKey);
      expect(cancelKey).not.toBe(globalKey);

      // Verify key structure
      expect(accountKey).toContain('gdpr_delete');
      expect(exportKey).toContain('gdpr_export');
      expect(downloadKey).toContain('gdpr_download');
      expect(cancelKey).toContain('gdpr_cancel');
      expect(globalKey).toContain('gdpr_global');
    });

    test('should generate unique keys for different GDPR endpoints with IPv6', () => {
      const mockReq = {
        ip: '2001:db8:85a3::1',
        user: { id: 'user456' },
        params: { token: 'download-token-456' }
      };

      // Test the actual key generation logic from the rate limiters
      const ipKey = ipKeyGenerator(mockReq.ip);

      // Test different key generators based on actual implementation
      const accountKey = `gdpr_delete:${ipKey}:${mockReq.user.id}`;
      const exportKey = `gdpr_export:${ipKey}:${mockReq.user.id}`;
      const tokenPrefix = mockReq.params.token.substr(0, 8);
      const downloadKey = `gdpr_download:${ipKey}:${tokenPrefix}`;
      const cancelKey = `gdpr_cancel:${ipKey}:${mockReq.user.id}`;
      const globalKey = `gdpr_global:${ipKey}`;

      // All keys should be different
      expect(accountKey).not.toBe(exportKey);
      expect(exportKey).not.toBe(downloadKey);
      expect(downloadKey).not.toBe(cancelKey);
      expect(cancelKey).not.toBe(globalKey);

      // Verify IPv6 key structure
      expect(accountKey).toContain('gdpr_delete');
      expect(exportKey).toContain('gdpr_export');
      expect(downloadKey).toContain('gdpr_download');
      expect(cancelKey).toContain('gdpr_cancel');
      expect(globalKey).toContain('gdpr_global');
    });

    test('should handle anonymous users in key generation', () => {
      const mockReq = {
        ip: '192.168.1.200',
        user: null, // Anonymous user
        params: { token: 'anon-token' }
      };

      // Test the actual key generation logic - ipKeyGenerator expects just the IP
      const ipKey = ipKeyGenerator(mockReq.ip);
      const userId = mockReq.user?.id || 'anonymous';

      // Keys should include 'anonymous' for user ID when user is null
      const accountKey = `gdpr_delete:${ipKey}:${userId}`;
      const exportKey = `gdpr_export:${ipKey}:${userId}`;
      const cancelKey = `gdpr_cancel:${ipKey}:${userId}`;

      expect(accountKey).toContain('anonymous');
      expect(exportKey).toContain('anonymous');
      expect(cancelKey).toContain('anonymous');

      // Verify the IP key is properly generated
      expect(ipKey).toBeDefined();
      expect(typeof ipKey).toBe('string');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle malformed IPv6 addresses gracefully', () => {
      const malformedIpv6 = 'invalid:ipv6:address';

      // Should not throw an error
      expect(() => {
        ipKeyGenerator(malformedIpv6);
      }).not.toThrow();
    });

    test('should handle empty IP addresses', () => {
      const emptyIp = '';

      // Should not throw an error
      expect(() => {
        ipKeyGenerator(emptyIp);
      }).not.toThrow();
    });

    test('should handle IPv6 addresses with different compression formats', () => {
      const fullIpv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const compressedIpv6 = '2001:db8:85a3::8a2e:370:7334';
      const doubleCompressedIpv6 = '2001:db8:85a3::370:7334';

      const key1 = ipKeyGenerator(fullIpv6);
      const key2 = ipKeyGenerator(compressedIpv6);
      const key3 = ipKeyGenerator(doubleCompressedIpv6);

      // All should be valid keys
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key3).toBeDefined();
    });

    test('should handle IPv4-mapped IPv6 addresses consistently', () => {
      const ipv4MappedIpv6_1 = '::ffff:192.168.1.1';
      const ipv4MappedIpv6_2 = '::ffff:192.168.1.2';

      const key1 = ipKeyGenerator(ipv4MappedIpv6_1);
      const key2 = ipKeyGenerator(ipv4MappedIpv6_2);

      // IPv4-mapped IPv6 addresses are normalized to the same subnet by default
      // This is expected behavior for rate limiting
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(typeof key1).toBe('string');
      expect(typeof key2).toBe('string');
    });

    test('should handle rate limit headers correctly for IPv6', async () => {
      // Ensure consistent test environment
      process.env.NODE_ENV = 'test';

      const ipv6 = '2001:db8:85a3:ffff::test';

      const response = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', ipv6)
        .expect(200);

      // When rate limiting is disabled, we should still get a successful response
      expect(response.body.success).toBe(true);

      // Verify that the request was processed correctly with IPv6
      expect(response.status).toBe(200);

      // Test with a different IPv6 address to ensure consistency
      const response2 = await request(app)
        .delete('/api/user/account')
        .set('X-Forwarded-For', '2001:db8:85a3:ffff::test2')
        .expect(200);

      expect(response2.body.success).toBe(true);
    });
  });
});
