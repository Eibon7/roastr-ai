/**
 * Integration test for IPv6 compatibility in rate limiters
 * Issue #262: Verify rate limiters work correctly with IPv4 and IPv6 addresses
 */

const request = require('supertest');
const express = require('express');
const { ipKeyGenerator } = require('express-rate-limit');
const { 
  accountDeletionLimiter, 
  dataExportLimiter,
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

  beforeAll(() => {
    // Create test app with rate limiters
    app = express();
    app.use(express.json());
    
    // Test GDPR endpoints with rate limiting
    app.delete('/api/user/account', mockAuth, accountDeletionLimiter, (req, res) => {
      res.json({ success: true });
    });
    
    app.get('/api/user/data-export', mockAuth, dataExportLimiter, (req, res) => {
      res.json({ success: true });
    });
    
    app.get('/api/notifications', mockAuth, notificationLimiter, (req, res) => {
      res.json({ success: true, notifications: [] });
    });
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
});