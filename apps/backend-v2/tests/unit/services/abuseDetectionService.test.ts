/**
 * Abuse Detection Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AbuseDetectionService } from '../../../src/services/abuseDetectionService';

describe('AbuseDetectionService', () => {
  let service: AbuseDetectionService;

  beforeEach(() => {
    service = new AbuseDetectionService();
  });

  describe('multi-IP detection', () => {
    it('should detect same email from multiple IPs', () => {
      const email = 'test@example.com';
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3', '192.168.1.4'];

      let lastResult;
      for (const ip of ips) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(true);
      expect(lastResult!.patterns).toContain('multi_ip');
    });

    it('should not flag when under threshold', () => {
      const email = 'test2@example.com';
      const ips = ['192.168.2.1', '192.168.2.2'];

      let lastResult;
      for (const ip of ips) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(false);
    });
  });

  describe('multi-email detection', () => {
    it('should detect multiple emails from same IP', () => {
      const ip = '192.168.3.1';
      const emails = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
        'user4@example.com',
        'user5@example.com',
        'user6@example.com'
      ];

      let lastResult;
      for (const email of emails) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(true);
      expect(lastResult!.patterns).toContain('multi_email');
    });

    it('should not flag when under threshold', () => {
      const ip = '192.168.3.2';
      const emails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];

      let lastResult;
      for (const email of emails) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(false);
    });
  });

  describe('burst attack detection', () => {
    it('should detect burst attack (10+ attempts in 1 minute)', () => {
      const email = 'burst@example.com';
      const ip = '192.168.4.1';

      let lastResult;
      for (let i = 0; i < 11; i++) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(true);
      expect(lastResult!.patterns).toContain('burst_attack');
    });

    it('should not flag normal rate', () => {
      const email = 'normal@example.com';
      const ip = '192.168.4.2';

      let lastResult;
      for (let i = 0; i < 5; i++) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(false);
    });
  });

  describe('slow attack detection', () => {
    it('should detect slow attack (20+ attempts in 1 hour)', () => {
      const email = 'slow@example.com';
      const ip = '192.168.5.1';

      let lastResult;
      for (let i = 0; i < 21; i++) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(true);
      expect(lastResult!.patterns).toContain('slow_attack');
    });

    it('should not flag normal usage', () => {
      const email = 'normal2@example.com';
      const ip = '192.168.5.2';

      let lastResult;
      for (let i = 0; i < 10; i++) {
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(false);
    });
  });

  describe('isAbusive', () => {
    it('should return true for abusive email', () => {
      const email = 'abuser@example.com';
      const ips = ['192.168.6.1', '192.168.6.2', '192.168.6.3', '192.168.6.4'];

      for (const ip of ips) {
        service.recordAttempt(email, ip);
      }

      expect(service.isAbusive(email)).toBe(true);
    });

    it('should return true for abusive IP', () => {
      const ip = '192.168.7.1';
      const emails = [
        'a@example.com',
        'b@example.com',
        'c@example.com',
        'd@example.com',
        'e@example.com',
        'f@example.com'
      ];

      for (const email of emails) {
        service.recordAttempt(email, ip);
      }

      expect(service.isAbusive(undefined, ip)).toBe(true);
    });

    it('should return false for clean email/IP', () => {
      expect(service.isAbusive('clean@example.com')).toBe(false);
      expect(service.isAbusive(undefined, '192.168.8.1')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset abuse tracking for email', () => {
      const email = 'reset@example.com';
      const ips = ['192.168.9.1', '192.168.9.2', '192.168.9.3', '192.168.9.4'];

      for (const ip of ips) {
        service.recordAttempt(email, ip);
      }

      expect(service.isAbusive(email)).toBe(true);

      service.reset(email);

      expect(service.isAbusive(email)).toBe(false);
    });

    it('should reset abuse tracking for IP', () => {
      const ip = '192.168.10.1';
      const emails = ['a@e.com', 'b@e.com', 'c@e.com', 'd@e.com', 'e@e.com', 'f@e.com'];

      for (const email of emails) {
        service.recordAttempt(email, ip);
      }

      expect(service.isAbusive(undefined, ip)).toBe(true);

      service.reset(undefined, ip);

      expect(service.isAbusive(undefined, ip)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove old entries', () => {
      const email = 'cleanup@example.com';
      const ip = '192.168.11.1';

      service.recordAttempt(email, ip);

      // Cleanup shouldn't remove recent entries
      service.cleanup();

      const result = service.recordAttempt(email, ip);
      expect(result.isAbuse).toBe(false);
    });
  });

  describe('multiple patterns', () => {
    it('should detect multiple abuse patterns simultaneously', () => {
      const email = 'multi@example.com';
      const ips = ['192.168.12.1', '192.168.12.2', '192.168.12.3', '192.168.12.4'];

      let lastResult;
      // Generate both multi-IP and burst attack
      for (let i = 0; i < 11; i++) {
        const ip = ips[i % ips.length];
        lastResult = service.recordAttempt(email, ip);
      }

      expect(lastResult!.isAbuse).toBe(true);
      expect(lastResult!.patterns.length).toBeGreaterThan(1);
    });
  });
});
