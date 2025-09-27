const { 
  sanitizeParameters, 
  sanitizeForLogging, 
  maskSensitiveValue 
} = require('../../../src/utils/parameterSanitizer');

describe('parameterSanitizer', () => {
  describe('sanitizeParameters', () => {
    it('should mask sensitive fields by pattern', () => {
      const input = {
        organizationId: 'org-12345',
        accessToken: 'secret-token-xyz',
        userId: 'user-456',
        normalField: 'normal-value'
      };

      const result = sanitizeParameters(input);

      expect(result.organizationId).toBe('org***');
      expect(result.accessToken).toBe('sec***');
      expect(result.userId).toBe('user-456'); // Not sensitive
      expect(result.normalField).toBe('normal-value');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          id: 'user-123',
          accessToken: 'secret-123',
          profile: {
            organizationId: 'org-456'
          }
        }
      };

      const result = sanitizeParameters(input);

      expect(result.user.id).toBe('user-123');
      expect(result.user.accessToken).toBe('sec***');
      expect(result.user.profile.organizationId).toBe('org***');
    });

    it('should handle arrays', () => {
      const input = {
        tokens: ['token1', 'token2'],
        users: [
          { id: 'user1', apiKey: 'key123' },
          { id: 'user2', secret: 'secret456' }
        ]
      };

      const result = sanitizeParameters(input);

      expect(result.tokens).toBe('***'); // tokens field itself is sensitive
      expect(result.users[0].id).toBe('user1');
      expect(result.users[0].apiKey).toBe('key***');
      expect(result.users[1].secret).toBe('sec***');
    });

    it('should preserve non-sensitive data types', () => {
      const input = {
        count: 42,
        isActive: true,
        data: null,
        undefined: undefined,
        timestamp: new Date('2025-01-01')
      };

      const result = sanitizeParameters(input);

      expect(result.count).toBe(42);
      expect(result.isActive).toBe(true);
      expect(result.data).toBe(null);
      expect(result.undefined).toBe(undefined);
      expect(result.timestamp).toEqual({});
    });

    it('should handle circular references', () => {
      const input = { name: 'test' };
      input.self = input;

      expect(() => sanitizeParameters(input)).not.toThrow();
      const result = sanitizeParameters(input);
      expect(result.name).toBe('test');
    });

    it('should respect custom mask character', () => {
      const input = { token: 'secret123' };
      const result = sanitizeParameters(input, { maskChar: 'X' });
      expect(result.token).toBe('secXXX');
    });

    it('should respect custom prefix length', () => {
      const input = { apiKey: 'verylongkey123' };
      const result = sanitizeParameters(input, { prefixLength: 5 });
      expect(result.apiKey).toBe('veryl***');
    });
  });

  describe('sanitizeForLogging', () => {
    it('should be alias for sanitizeParameters with logging defaults', () => {
      const input = { organizationId: 'org-123', token: 'secret' };
      const result = sanitizeForLogging(input);
      
      expect(result.organizationId).toBe('org***');
      expect(result.token).toBe('sec***');
    });

    it('should handle null and undefined input', () => {
      expect(sanitizeForLogging(null)).toBe(null);
      expect(sanitizeForLogging(undefined)).toBe(undefined);
    });
  });

  describe('maskSensitiveValue', () => {
    it('should mask string values correctly', () => {
      expect(maskSensitiveValue('secret123')).toBe('sec***');
      expect(maskSensitiveValue('a')).toBe('a');
      expect(maskSensitiveValue('ab')).toBe('ab');
      expect(maskSensitiveValue('abc')).toBe('abc');
      expect(maskSensitiveValue('abcd')).toBe('abc***');
    });

    it('should handle non-string values', () => {
      expect(maskSensitiveValue(123)).toBe('***');
      expect(maskSensitiveValue(true)).toBe('***');
      expect(maskSensitiveValue(null)).toBe(null);
      expect(maskSensitiveValue(undefined)).toBe(undefined);
    });

    it('should use custom options', () => {
      expect(maskSensitiveValue('secret123', { prefixLength: 5, maskChar: 'X' }))
        .toBe('secreXXX');
    });
  });

  describe('Security validation', () => {
    it('should handle malicious input safely', () => {
      const maliciousInput = {
        __proto__: { polluted: true },
        constructor: { name: 'exploit' },
        organizationId: 'org-123'
      };

      const result = sanitizeParameters(maliciousInput);
      expect(result.organizationId).toBe('org***');
      expect(result).not.toHaveProperty('polluted');
    });

    it('should handle very large objects without performance issues', () => {
      const largeInput = {};
      for (let i = 0; i < 1000; i++) {
        largeInput[`field${i}`] = `value${i}`;
        if (i % 100 === 0) {
          largeInput[`token${i}`] = `secret${i}`;
        }
      }

      const start = Date.now();
      const result = sanitizeParameters(largeInput);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.token0).toBe('sec***');
      expect(result.field1).toBe('value1');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty objects and arrays', () => {
      expect(sanitizeParameters({})).toEqual({});
      expect(sanitizeParameters([])).toEqual([]);
    });

    it('should handle functions', () => {
      const input = {
        func: () => 'test',
        token: 'secret123'
      };

      const result = sanitizeParameters(input);
      expect(typeof result.func).toBe('function');
      expect(result.token).toBe('sec***');
    });

    it('should handle deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  organizationId: 'deep-secret'
                }
              }
            }
          }
        }
      };

      const result = sanitizeParameters(input);
      expect(result.level1.level2.level3.level4.level5.organizationId).toBe('dee***');
    });
  });
});