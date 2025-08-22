const { SafeUtils } = require('../../../src/utils/logger');

describe('SafeUtils - Issue #154: Optional chaining and safe string operations', () => {
  describe('safeUserIdPrefix', () => {
    it('should handle valid user IDs correctly', () => {
      expect(SafeUtils.safeUserIdPrefix('12345678-abcd-efgh-ijkl-mnopqrstuvwx')).toBe('12345678...');
      expect(SafeUtils.safeUserIdPrefix('short')).toBe('short...');
    });

    it('should handle undefined user ID', () => {
      expect(SafeUtils.safeUserIdPrefix(undefined)).toBe('unknown-user');
      expect(SafeUtils.safeUserIdPrefix(null)).toBe('unknown-user');
    });

    it('should handle non-string user ID', () => {
      expect(SafeUtils.safeUserIdPrefix(12345)).toBe('unknown-user');
      expect(SafeUtils.safeUserIdPrefix({})).toBe('unknown-user');
      expect(SafeUtils.safeUserIdPrefix([])).toBe('unknown-user');
    });

    it('should handle empty string user ID', () => {
      expect(SafeUtils.safeUserIdPrefix('')).toBe('unknown-user');
    });

    it('should handle custom prefix length', () => {
      expect(SafeUtils.safeUserIdPrefix('12345678-abcd-efgh', 4)).toBe('1234...');
      expect(SafeUtils.safeUserIdPrefix('abc', 10)).toBe('abc...');
    });
  });

  describe('safeString', () => {
    it('should handle valid strings correctly', () => {
      expect(SafeUtils.safeString('hello')).toBe('hello');
      expect(SafeUtils.safeString('123')).toBe('123');
    });

    it('should handle undefined/null values', () => {
      expect(SafeUtils.safeString(undefined)).toBe('');
      expect(SafeUtils.safeString(null)).toBe('');
      expect(SafeUtils.safeString(undefined, 'fallback')).toBe('fallback');
      expect(SafeUtils.safeString(null, 'fallback')).toBe('fallback');
    });

    it('should convert non-string values to strings', () => {
      expect(SafeUtils.safeString(123)).toBe('123');
      expect(SafeUtils.safeString(true)).toBe('true');
      expect(SafeUtils.safeString(false)).toBe('false');
    });
  });

  describe('safeStringOperation', () => {
    it('should handle valid string operations', () => {
      expect(SafeUtils.safeStringOperation('hello world', 'substr', 0, 5)).toBe('hello');
      expect(SafeUtils.safeStringOperation('HELLO', 'toLowerCase')).toBe('hello');
      expect(SafeUtils.safeStringOperation('hello', 'toUpperCase')).toBe('HELLO');
      expect(SafeUtils.safeStringOperation('  trim  ', 'trim')).toBe('trim');
    });

    it('should handle undefined/null strings safely', () => {
      expect(SafeUtils.safeStringOperation(undefined, 'substr', 0, 5)).toBe('');
      expect(SafeUtils.safeStringOperation(null, 'toLowerCase')).toBe('');
      expect(SafeUtils.safeStringOperation('', 'toUpperCase')).toBe('');
    });

    it('should handle non-string values safely', () => {
      expect(SafeUtils.safeStringOperation(123, 'substr', 0, 2)).toBe('');
      expect(SafeUtils.safeStringOperation({}, 'toLowerCase')).toBe('');
      expect(SafeUtils.safeStringOperation([], 'trim')).toBe('');
    });

    it('should handle invalid operations safely', () => {
      expect(SafeUtils.safeStringOperation('hello', 'nonExistentMethod')).toBe('');
    });

    it('should handle operations that throw errors', () => {
      // This tests the try-catch within safeStringOperation
      expect(SafeUtils.safeStringOperation('hello', 'substr', -1, -1)).toBe('');
    });
  });

  describe('integration with logging', () => {
    it('should work in logging scenarios to prevent crashes', () => {
      const testCases = [
        { userId: undefined, expected: 'unknown-user' },
        { userId: null, expected: 'unknown-user' },
        { userId: '', expected: 'unknown-user' },
        { userId: 'valid-user-id-1234567890', expected: 'valid-us...' }
      ];

      testCases.forEach(({ userId, expected }) => {
        const result = SafeUtils.safeUserIdPrefix(userId);
        expect(result).toBe(expected);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should prevent substr errors that could crash the application', () => {
      // These would previously cause "Cannot read property 'substr' of undefined" errors
      expect(() => SafeUtils.safeUserIdPrefix(undefined)).not.toThrow();
      expect(() => SafeUtils.safeUserIdPrefix(null)).not.toThrow();
      expect(() => SafeUtils.safeStringOperation(undefined, 'substr', 0, 8)).not.toThrow();
    });
  });
});