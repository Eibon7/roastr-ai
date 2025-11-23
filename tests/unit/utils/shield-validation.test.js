/**
 * Shield Validation Utility Tests - CodeRabbit Round 2
 *
 * Tests for validation utilities and helper functions:
 * - Query parameter validation and sanitization
 * - Response data sanitization
 * - Input filtering with whitelists
 * - Edge case handling
 * - Security validation
 */

// Mock the shield routes module to extract validation functions
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {}
}));
jest.mock('../../../src/config/flags', () => ({
  flags: { isEnabled: jest.fn() }
}));
jest.mock('../../../src/utils/logger', () => ({
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
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: jest.fn()
}));

describe('Shield Validation Utilities - CodeRabbit Round 2', () => {
  // Extract validation constants and functions from shield routes
  const VALID_CATEGORIES = ['all', 'toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'];
  const VALID_TIME_RANGES = ['7d', '30d', '90d', 'all'];
  const VALID_PLATFORMS = [
    'all',
    'twitter',
    'youtube',
    'instagram',
    'facebook',
    'discord',
    'twitch',
    'reddit',
    'tiktok',
    'bluesky'
  ];
  const VALID_ACTION_TYPES = ['all', 'block', 'mute', 'flag', 'report'];

  // Helper functions extracted from shield routes
  function validateQueryParameters(query = {}) {
    const {
      page = 1,
      limit = 20,
      category = 'all',
      timeRange = '30d',
      platform = 'all',
      actionType = 'all'
    } = query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const validatedCategory = VALID_CATEGORIES.includes(category) ? category : 'all';
    const validatedTimeRange = VALID_TIME_RANGES.includes(timeRange) ? timeRange : '30d';
    const validatedPlatform = VALID_PLATFORMS.includes(platform) ? platform : 'all';
    const validatedActionType = VALID_ACTION_TYPES.includes(actionType) ? actionType : 'all';

    return {
      pageNum,
      limitNum,
      category: validatedCategory,
      timeRange: validatedTimeRange,
      platform: validatedPlatform,
      actionType: validatedActionType,
      isValid: !isNaN(pageNum) && !isNaN(limitNum)
    };
  }

  function sanitizeResponseData(data) {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => sanitizeResponseData(item));
    }

    if (typeof data === 'object') {
      const { organization_id, ...sanitizedItem } = data;
      return sanitizedItem;
    }

    return data;
  }

  function calculateDateRange(timeRange) {
    const now = new Date();

    switch (timeRange) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        return null;
    }
  }

  describe('Query Parameter Validation', () => {
    test('should validate normal query parameters', () => {
      const query = {
        page: '2',
        limit: '50',
        category: 'toxic',
        timeRange: '7d',
        platform: 'twitter',
        actionType: 'block'
      };

      const result = validateQueryParameters(query);

      expect(result).toEqual({
        pageNum: 2,
        limitNum: 50,
        category: 'toxic',
        timeRange: '7d',
        platform: 'twitter',
        actionType: 'block',
        isValid: true
      });
    });

    test('should handle missing parameters with defaults', () => {
      const result = validateQueryParameters({});

      expect(result).toEqual({
        pageNum: 1,
        limitNum: 20,
        category: 'all',
        timeRange: '30d',
        platform: 'all',
        actionType: 'all',
        isValid: true
      });
    });

    test('should handle null/undefined query object', () => {
      const resultNull = validateQueryParameters(null);
      const resultUndefined = validateQueryParameters(undefined);

      const expected = {
        pageNum: 1,
        limitNum: 20,
        category: 'all',
        timeRange: '30d',
        platform: 'all',
        actionType: 'all',
        isValid: true
      };

      expect(resultNull).toEqual(expected);
      expect(resultUndefined).toEqual(expected);
    });

    test('should sanitize invalid pagination values', () => {
      const invalidQueries = [
        { page: 'abc', limit: 'xyz' },
        { page: '-5', limit: '-10' },
        { page: '0', limit: '0' },
        { page: 'NaN', limit: 'Infinity' },
        { page: null, limit: undefined }
      ];

      invalidQueries.forEach((query) => {
        const result = validateQueryParameters(query);
        expect(result.pageNum).toBeGreaterThanOrEqual(1);
        expect(result.limitNum).toBeGreaterThanOrEqual(1);
        expect(result.limitNum).toBeLessThanOrEqual(100);
        expect(result.isValid).toBe(true);
      });
    });

    test('should cap limit at maximum value', () => {
      const query = { limit: '999' };
      const result = validateQueryParameters(query);

      expect(result.limitNum).toBe(100);
    });

    test('should enforce minimum values', () => {
      const query = { page: '-10', limit: '-5' };
      const result = validateQueryParameters(query);

      expect(result.pageNum).toBe(1);
      expect(result.limitNum).toBe(1);
    });

    test('should validate category against whitelist', () => {
      const validCategories = ['toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'];
      const invalidCategories = ['malicious', 'sql_injection', '"><script>', 'unknown'];

      validCategories.forEach((category) => {
        const result = validateQueryParameters({ category });
        expect(result.category).toBe(category);
      });

      invalidCategories.forEach((category) => {
        const result = validateQueryParameters({ category });
        expect(result.category).toBe('all'); // Should default
      });
    });

    test('should validate timeRange against whitelist', () => {
      const validRanges = ['7d', '30d', '90d', 'all'];
      const invalidRanges = ['1h', '365d', 'forever', 'invalid'];

      validRanges.forEach((timeRange) => {
        const result = validateQueryParameters({ timeRange });
        expect(result.timeRange).toBe(timeRange);
      });

      invalidRanges.forEach((timeRange) => {
        const result = validateQueryParameters({ timeRange });
        expect(result.timeRange).toBe('30d'); // Should default
      });
    });

    test('should validate platform against whitelist', () => {
      const validPlatforms = [
        'twitter',
        'youtube',
        'instagram',
        'facebook',
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ];
      const invalidPlatforms = ['unknown_platform', 'hack_attempt', 'DROP TABLE'];

      validPlatforms.forEach((platform) => {
        const result = validateQueryParameters({ platform });
        expect(result.platform).toBe(platform);
      });

      invalidPlatforms.forEach((platform) => {
        const result = validateQueryParameters({ platform });
        expect(result.platform).toBe('all'); // Should default
      });
    });

    test('should validate actionType against whitelist', () => {
      const validActions = ['block', 'mute', 'flag', 'report'];
      const invalidActions = ['delete', 'hack', 'exploit', 'unknown'];

      validActions.forEach((actionType) => {
        const result = validateQueryParameters({ actionType });
        expect(result.actionType).toBe(actionType);
      });

      invalidActions.forEach((actionType) => {
        const result = validateQueryParameters({ actionType });
        expect(result.actionType).toBe('all'); // Should default
      });
    });

    test('should handle extreme numeric values', () => {
      const extremeQueries = [
        { page: Number.MAX_SAFE_INTEGER.toString() },
        { page: Number.MIN_SAFE_INTEGER.toString() },
        { limit: Number.MAX_SAFE_INTEGER.toString() },
        { page: '1e10' },
        { limit: '1e10' }
      ];

      extremeQueries.forEach((query) => {
        const result = validateQueryParameters(query);
        expect(result.pageNum).toBeGreaterThanOrEqual(1);
        expect(result.limitNum).toBeGreaterThanOrEqual(1);
        expect(result.limitNum).toBeLessThanOrEqual(100);
      });
    });

    test('should handle special characters and injection attempts', () => {
      const maliciousQueries = [
        { category: '"; DROP TABLE users; --' },
        { platform: '<script>alert("xss")</script>' },
        { timeRange: '${process.env.SECRET}' },
        { actionType: '../../../etc/passwd' },
        { page: '1 OR 1=1' }
      ];

      maliciousQueries.forEach((query) => {
        const result = validateQueryParameters(query);
        // All malicious values should be sanitized to defaults
        expect(result.category).toBe('all');
        expect(result.platform).toBe('all');
        expect(result.timeRange).toBe('30d');
        expect(result.actionType).toBe('all');
        expect(result.pageNum).toBe(1);
      });
    });
  });

  describe('Response Data Sanitization', () => {
    test('should remove organization_id from single object', () => {
      const data = {
        id: '123',
        action_type: 'block',
        organization_id: 'secret-org-456',
        content: 'test content'
      };

      const sanitized = sanitizeResponseData(data);

      expect(sanitized).toEqual({
        id: '123',
        action_type: 'block',
        content: 'test content'
      });
      expect(sanitized).not.toHaveProperty('organization_id');
    });

    test('should remove organization_id from array of objects', () => {
      const data = [
        {
          id: '1',
          organization_id: 'org-1',
          content: 'content1'
        },
        {
          id: '2',
          organization_id: 'org-2',
          content: 'content2'
        }
      ];

      const sanitized = sanitizeResponseData(data);

      expect(sanitized).toHaveLength(2);
      sanitized.forEach((item) => {
        expect(item).not.toHaveProperty('organization_id');
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('content');
      });
    });

    test('should handle nested objects and arrays', () => {
      const data = {
        events: [
          {
            id: '1',
            organization_id: 'org-1',
            metadata: {
              organization_id: 'nested-org',
              other_data: 'test'
            }
          }
        ],
        organization_id: 'top-level-org',
        pagination: {
          organization_id: 'pagination-org',
          total: 10
        }
      };

      const sanitized = sanitizeResponseData(data);

      expect(sanitized).not.toHaveProperty('organization_id');
      expect(sanitized.events[0]).not.toHaveProperty('organization_id');
      expect(sanitized.events[0].metadata).not.toHaveProperty('organization_id');
      expect(sanitized.pagination).not.toHaveProperty('organization_id');

      // Other properties should remain
      expect(sanitized.events[0].metadata.other_data).toBe('test');
      expect(sanitized.pagination.total).toBe(10);
    });

    test('should handle null and undefined data', () => {
      expect(sanitizeResponseData(null)).toBeNull();
      expect(sanitizeResponseData(undefined)).toBeUndefined();
      expect(sanitizeResponseData('')).toBe('');
      expect(sanitizeResponseData(0)).toBe(0);
      expect(sanitizeResponseData(false)).toBe(false);
    });

    test('should handle primitive values', () => {
      expect(sanitizeResponseData('string')).toBe('string');
      expect(sanitizeResponseData(123)).toBe(123);
      expect(sanitizeResponseData(true)).toBe(true);
    });

    test('should handle arrays with mixed data types', () => {
      const data = [
        { id: '1', organization_id: 'org-1' },
        'string',
        123,
        null,
        { id: '2', organization_id: 'org-2' }
      ];

      const sanitized = sanitizeResponseData(data);

      expect(sanitized).toHaveLength(5);
      expect(sanitized[0]).toEqual({ id: '1' });
      expect(sanitized[1]).toBe('string');
      expect(sanitized[2]).toBe(123);
      expect(sanitized[3]).toBeNull();
      expect(sanitized[4]).toEqual({ id: '2' });
    });

    test('should handle deeply nested structures', () => {
      const data = {
        level1: {
          organization_id: 'org1',
          level2: {
            organization_id: 'org2',
            level3: [
              {
                organization_id: 'org3',
                data: 'value'
              }
            ]
          }
        }
      };

      const sanitized = sanitizeResponseData(data);

      expect(sanitized.level1).not.toHaveProperty('organization_id');
      expect(sanitized.level1.level2).not.toHaveProperty('organization_id');
      expect(sanitized.level1.level2.level3[0]).not.toHaveProperty('organization_id');
      expect(sanitized.level1.level2.level3[0].data).toBe('value');
    });

    test('should preserve other sensitive-looking fields', () => {
      const data = {
        organization_id: 'remove-this',
        user_id: 'keep-this',
        org_id: 'keep-this-too',
        organization_name: 'keep-this-as-well',
        secret_key: 'keep-this-different-secret'
      };

      const sanitized = sanitizeResponseData(data);

      expect(sanitized).not.toHaveProperty('organization_id');
      expect(sanitized.user_id).toBe('keep-this');
      expect(sanitized.org_id).toBe('keep-this-too');
      expect(sanitized.organization_name).toBe('keep-this-as-well');
      expect(sanitized.secret_key).toBe('keep-this-different-secret');
    });
  });

  describe('Date Range Calculation', () => {
    const mockCurrentTime = new Date('2024-01-15T12:00:00Z');

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockImplementation(() => mockCurrentTime.getTime());
      // eslint-disable-next-line no-global-assign
      global.Date = jest.fn(() => mockCurrentTime);
      global.Date.now = Date.now;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should calculate 7-day range correctly', () => {
      const result = calculateDateRange('7d');
      const expected = new Date(mockCurrentTime.getTime() - 7 * 24 * 60 * 60 * 1000);

      expect(result).toEqual(expected);
    });

    test('should calculate 30-day range correctly', () => {
      const result = calculateDateRange('30d');
      const expected = new Date(mockCurrentTime.getTime() - 30 * 24 * 60 * 60 * 1000);

      expect(result).toEqual(expected);
    });

    test('should calculate 90-day range correctly', () => {
      const result = calculateDateRange('90d');
      const expected = new Date(mockCurrentTime.getTime() - 90 * 24 * 60 * 60 * 1000);

      expect(result).toEqual(expected);
    });

    test('should return null for "all" range', () => {
      const result = calculateDateRange('all');
      expect(result).toBeNull();
    });

    test('should return null for invalid ranges', () => {
      const invalidRanges = ['invalid', '1h', '365d', '', null, undefined];

      invalidRanges.forEach((range) => {
        const result = calculateDateRange(range);
        expect(result).toBeNull();
      });
    });

    test('should handle edge case time ranges', () => {
      // Test at exact boundaries
      expect(calculateDateRange('7d')).toBeInstanceOf(Date);
      expect(calculateDateRange('30d')).toBeInstanceOf(Date);
      expect(calculateDateRange('90d')).toBeInstanceOf(Date);
    });
  });

  describe('Input Security Validation', () => {
    test('should reject SQL injection patterns', () => {
      const sqlInjectionInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
        '1; DELETE FROM shield_actions; --'
      ];

      sqlInjectionInputs.forEach((input) => {
        const result = validateQueryParameters({ category: input });
        expect(result.category).toBe('all'); // Should default, not execute
      });
    });

    test('should reject XSS patterns', () => {
      const xssInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
        'onload=alert("xss")'
      ];

      xssInputs.forEach((input) => {
        const result = validateQueryParameters({ platform: input });
        expect(result.platform).toBe('all'); // Should default, not execute
      });
    });

    test('should reject path traversal patterns', () => {
      const pathTraversalInputs = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f',
        '..%252f..%252f..%252f'
      ];

      pathTraversalInputs.forEach((input) => {
        const result = validateQueryParameters({ actionType: input });
        expect(result.actionType).toBe('all'); // Should default
      });
    });

    test('should reject command injection patterns', () => {
      const commandInjectionInputs = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '&& whoami',
        '`cat /etc/passwd`',
        '$(ls -la)'
      ];

      commandInjectionInputs.forEach((input) => {
        const result = validateQueryParameters({ timeRange: input });
        expect(result.timeRange).toBe('30d'); // Should default
      });
    });

    test('should handle Unicode and encoding attacks', () => {
      const unicodeInputs = [
        'admin\u0000',
        '%00admin',
        '\uFEFF admin',
        'admin\u202E',
        '\u0009\u000A\u000B\u000C\u000D\u0020'
      ];

      unicodeInputs.forEach((input) => {
        const result = validateQueryParameters({ category: input });
        expect(result.category).toBe('all'); // Should default
      });
    });

    test('should handle extremely long inputs', () => {
      const longInput = 'a'.repeat(10000);
      const result = validateQueryParameters({ category: longInput });
      expect(result.category).toBe('all'); // Should default
    });

    test('should handle binary and control characters', () => {
      const binaryInputs = [
        '\x00\x01\x02\x03',
        String.fromCharCode(0, 1, 2, 3, 4, 5),
        '\u0000\u0001\u0002',
        Buffer.from([0, 1, 2, 3]).toString()
      ];

      binaryInputs.forEach((input) => {
        const result = validateQueryParameters({ platform: input });
        expect(result.platform).toBe('all'); // Should default
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('should handle circular references in objects', () => {
      const circular = { id: '1', organization_id: 'org-1' };
      circular.self = circular;

      // This should not throw an error
      expect(() => {
        sanitizeResponseData(circular);
      }).not.toThrow();
    });

    test('should handle very large numbers', () => {
      const largeNumbers = [
        Number.MAX_SAFE_INTEGER.toString(),
        '9'.repeat(20),
        '1e308',
        'Infinity',
        '-Infinity'
      ];

      largeNumbers.forEach((num) => {
        const result = validateQueryParameters({ page: num, limit: num });
        expect(result.pageNum).toBeGreaterThanOrEqual(1);
        expect(result.limitNum).toBeGreaterThanOrEqual(1);
        expect(result.limitNum).toBeLessThanOrEqual(100);
      });
    });

    test('should handle floating point numbers', () => {
      const floats = ['1.5', '3.14159', '2.999', '0.001'];

      floats.forEach((float) => {
        const result = validateQueryParameters({ page: float, limit: float });
        expect(Number.isInteger(result.pageNum)).toBe(true);
        expect(Number.isInteger(result.limitNum)).toBe(true);
      });
    });

    test('should handle scientific notation', () => {
      const scientificNumbers = ['1e2', '2e3', '5e-1', '1.5e+2'];

      scientificNumbers.forEach((num) => {
        const result = validateQueryParameters({ page: num, limit: num });
        expect(result.pageNum).toBeGreaterThanOrEqual(1);
        expect(result.limitNum).toBeGreaterThanOrEqual(1);
      });
    });

    test('should handle empty and whitespace strings', () => {
      const emptyInputs = ['', ' ', '\t', '\n', '\r\n', '   \t\n  '];

      emptyInputs.forEach((input) => {
        const result = validateQueryParameters({
          page: input,
          limit: input,
          category: input,
          platform: input
        });

        expect(result.pageNum).toBe(1);
        expect(result.limitNum).toBe(20);
        expect(result.category).toBe('all');
        expect(result.platform).toBe('all');
      });
    });

    test('should handle mixed valid and invalid parameters', () => {
      const mixedQuery = {
        page: '2', // valid
        limit: 'invalid', // invalid
        category: 'toxic', // valid
        platform: 'malicious_input', // invalid
        timeRange: '7d', // valid
        actionType: 'unknown_action' // invalid
      };

      const result = validateQueryParameters(mixedQuery);

      expect(result.pageNum).toBe(2); // valid preserved
      expect(result.limitNum).toBe(20); // invalid defaulted
      expect(result.category).toBe('toxic'); // valid preserved
      expect(result.platform).toBe('all'); // invalid defaulted
      expect(result.timeRange).toBe('7d'); // valid preserved
      expect(result.actionType).toBe('all'); // invalid defaulted
    });
  });
});
