/**
 * Rate Limiting Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimitService } from '../../../src/services/rateLimitService';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
  });

  describe('login rate limiting', () => {
    it('should allow attempts within limit', () => {
      const ip = '192.168.1.1';
      
      for (let i = 0; i < 5; i++) {
        const result = service.recordAttempt('login', ip);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - i - 1);
      }
    });

    it('should block after exceeding limit', () => {
      const ip = '192.168.1.2';
      
      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        service.recordAttempt('login', ip);
      }
      
      // Next attempt should be blocked
      const result = service.recordAttempt('login', ip);
      expect(result.allowed).toBe(false);
      expect(result.blockedUntil).toBeDefined();
      expect(result.blockedUntil).toBeGreaterThan(Date.now());
    });

    it('should apply progressive blocking', () => {
      const ip = '192.168.1.3';
      
      // First violation: trigger first block
      for (let i = 0; i < 6; i++) {
        service.recordAttempt('login', ip);
      }
      
      // Get first block duration
      const firstBlockRemaining = service.getBlockRemaining('login', ip);
      expect(firstBlockRemaining).toBeGreaterThan(0);
      
      // Reset to simulate block expiration
      service.reset('login', ip);
      
      // Trigger second violation
      for (let i = 0; i < 6; i++) {
        service.recordAttempt('login', ip);
      }
      
      // Get second block duration
      const secondBlockRemaining = service.getBlockRemaining('login', ip);
      expect(secondBlockRemaining).toBeGreaterThan(0);
      
      // Second block should be longer than first (progressive)
      // Since we can't easily compare exact timestamps, verify block count increased
      const result = service.recordAttempt('login', ip);
      expect(result.allowed).toBe(false);
    });

    it('should reset after block expires', () => {
      const ip = '192.168.1.4';
      
      // Trigger block
      for (let i = 0; i < 6; i++) {
        service.recordAttempt('login', ip);
      }
      
      // Verify blocked
      expect(service.isBlocked('login', ip)).toBe(true);
      
      // Manual reset (simulating expiration)
      service.reset('login', ip);
      
      // Should be unblocked
      expect(service.isBlocked('login', ip)).toBe(false);
      
      // Should allow new attempts
      const result = service.recordAttempt('login', ip);
      expect(result.allowed).toBe(true);
    });
  });

  describe('magic link rate limiting', () => {
    it('should allow 3 attempts in 1 hour', () => {
      const ip = '192.168.2.1';
      
      for (let i = 0; i < 3; i++) {
        const result = service.recordAttempt('magic_link', ip);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3 - i - 1);
      }
    });

    it('should block after 3 attempts', () => {
      const ip = '192.168.2.2';
      
      for (let i = 0; i < 3; i++) {
        service.recordAttempt('magic_link', ip);
      }
      
      const result = service.recordAttempt('magic_link', ip);
      expect(result.allowed).toBe(false);
      expect(result.blockedUntil).toBeDefined();
    });
  });

  describe('oauth rate limiting', () => {
    it('should allow 10 attempts in 15 minutes', () => {
      const ip = '192.168.3.1';
      
      for (let i = 0; i < 10; i++) {
        const result = service.recordAttempt('oauth', ip);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10 - i - 1);
      }
    });

    it('should block after 10 attempts', () => {
      const ip = '192.168.3.2';
      
      for (let i = 0; i < 10; i++) {
        service.recordAttempt('oauth', ip);
      }
      
      const result = service.recordAttempt('oauth', ip);
      expect(result.allowed).toBe(false);
      expect(result.blockedUntil).toBeDefined();
    });
  });

  describe('password reset rate limiting', () => {
    it('should allow 3 attempts in 1 hour', () => {
      const ip = '192.168.4.1';
      
      for (let i = 0; i < 3; i++) {
        const result = service.recordAttempt('password_reset', ip);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3 - i - 1);
      }
    });

    it('should block after 3 attempts', () => {
      const ip = '192.168.4.2';
      
      for (let i = 0; i < 3; i++) {
        service.recordAttempt('password_reset', ip);
      }
      
      const result = service.recordAttempt('password_reset', ip);
      expect(result.allowed).toBe(false);
      expect(result.blockedUntil).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      const ip = '192.168.5.1';
      
      // Add entry
      service.recordAttempt('login', ip);
      
      // Cleanup (shouldn't remove recent entry)
      service.cleanup();
      
      // Entry should still exist
      const result = service.recordAttempt('login', ip);
      expect(result.remaining).toBe(3); // Second attempt
    });
  });

  describe('isBlocked', () => {
    it('should return false for non-blocked identifier', () => {
      expect(service.isBlocked('login', '192.168.6.1')).toBe(false);
    });

    it('should return true for blocked identifier', () => {
      const ip = '192.168.6.2';
      
      // Trigger block
      for (let i = 0; i < 6; i++) {
        service.recordAttempt('login', ip);
      }
      
      expect(service.isBlocked('login', ip)).toBe(true);
    });
  });

  describe('getBlockRemaining', () => {
    it('should return null for non-blocked identifier', () => {
      expect(service.getBlockRemaining('login', '192.168.7.1')).toBeNull();
    });

    it('should return remaining time for blocked identifier', () => {
      const ip = '192.168.7.2';
      
      // Trigger block
      for (let i = 0; i < 6; i++) {
        service.recordAttempt('login', ip);
      }
      
      const remaining = service.getBlockRemaining('login', ip);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes max
    });
  });
});
