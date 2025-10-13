const { SafeUtils } = require('../../../src/utils/logger');
const {
  safeJsonParse,
  safeJsonStringify,
  safeGet,
  safeString: safeStringUtil,
  safeNumber,
  safeBoolean
} = require('../../../src/utils/safeUtils');

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

  describe('maskEmail', () => {
    it('should preserve single-character local parts', () => {
      expect(SafeUtils.maskEmail('a@example.com')).toBe('a@e****.com');
      expect(SafeUtils.maskEmail('x@test.co')).toBe('x@t***.co');
      expect(SafeUtils.maskEmail('j@domain.org')).toBe('j@d****.org');
    });

    it('should mask multi-character local parts correctly', () => {
      expect(SafeUtils.maskEmail('ab@example.com')).toBe('a*@e****.com');
      expect(SafeUtils.maskEmail('john@example.com')).toBe('j***@e****.com');
      expect(SafeUtils.maskEmail('verylongemail@domain.com')).toBe('v******@d****.com');
    });

    it('should handle invalid emails gracefully', () => {
      expect(SafeUtils.maskEmail('invalid-email')).toBe('invalid-email');
      expect(SafeUtils.maskEmail('')).toBe('unknown-email');
      expect(SafeUtils.maskEmail(null)).toBe('unknown-email');
      expect(SafeUtils.maskEmail(undefined)).toBe('unknown-email');
    });

    it('should mask domain parts correctly', () => {
      expect(SafeUtils.maskEmail('test@a.com')).toBe('t***@***.com');
      expect(SafeUtils.maskEmail('user@example.co.uk')).toBe('u***@e****.uk');
      expect(SafeUtils.maskEmail('email@x.y')).toBe('e****@***.y');
    });

    it('should handle edge cases', () => {
      expect(SafeUtils.maskEmail('a@b.c')).toBe('a@***.c');
      expect(SafeUtils.maskEmail('x@y.z')).toBe('x@***.z');
      expect(SafeUtils.maskEmail('test@')).toBeNull();
      expect(SafeUtils.maskEmail('@domain.com')).toBe('@domain.com');
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

describe('safeUtils module - Issue #540: Pure logic tests', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON correctly', () => {
      expect(safeJsonParse('{"name":"John","age":30}')).toEqual({name: 'John', age: 30});
      expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3]);
      expect(safeJsonParse('true')).toBe(true);
      expect(safeJsonParse('null')).toBe(null);
      expect(safeJsonParse('123')).toBe(123);
    });

    it('should return fallback for invalid JSON', () => {
      expect(safeJsonParse('invalid json')).toBe(null);
      expect(safeJsonParse('{broken', {default: 'value'})).toEqual({default: 'value'});
      expect(safeJsonParse('', [])).toEqual([]);
    });

    it('should handle edge cases', () => {
      // JSON.parse(null) returns null (not fallback) because null is valid JSON
      expect(safeJsonParse('null', 'fallback')).toBe(null);
      expect(safeJsonParse('""')).toBe('');
      expect(safeJsonParse('{}')).toEqual({});
      expect(safeJsonParse('[]')).toEqual([]);
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify valid objects correctly', () => {
      expect(safeJsonStringify({name: 'John'})).toBe('{"name":"John"}');
      expect(safeJsonStringify([1, 2, 3])).toBe('[1,2,3]');
      expect(safeJsonStringify(true)).toBe('true');
      expect(safeJsonStringify(null)).toBe('null');
    });

    it('should return fallback for circular references', () => {
      const circular = {};
      circular.self = circular;
      expect(safeJsonStringify(circular)).toBe('{}');
      expect(safeJsonStringify(circular, '[]')).toBe('[]');
    });

    it('should handle special values', () => {
      // JSON.stringify(undefined) returns undefined (not a string), so won't trigger catch
      // These just test that the function handles edge cases
      expect(typeof safeJsonStringify({})).toBe('string');
      expect(safeJsonStringify(NaN)).toBe('null');
      expect(safeJsonStringify(Infinity)).toBe('null');
    });
  });

  describe('safeGet', () => {
    const testObj = {
      user: {
        profile: {
          name: 'John',
          age: 30
        },
        settings: {
          theme: 'dark'
        }
      },
      items: ['a', 'b', 'c']
    };

    it('should get nested values with dot notation', () => {
      expect(safeGet(testObj, 'user.profile.name')).toBe('John');
      expect(safeGet(testObj, 'user.profile.age')).toBe(30);
      expect(safeGet(testObj, 'user.settings.theme')).toBe('dark');
    });

    it('should get nested values with array notation', () => {
      expect(safeGet(testObj, ['user', 'profile', 'name'])).toBe('John');
      expect(safeGet(testObj, ['user', 'settings', 'theme'])).toBe('dark');
    });

    it('should return fallback for non-existent paths', () => {
      expect(safeGet(testObj, 'user.profile.email')).toBe(undefined);
      expect(safeGet(testObj, 'user.profile.email', 'default')).toBe('default');
      expect(safeGet(testObj, 'nonexistent.path', 'fallback')).toBe('fallback');
    });

    it('should handle invalid inputs safely', () => {
      expect(safeGet(null, 'user.name', 'fallback')).toBe('fallback');
      expect(safeGet(undefined, 'user.name', 'fallback')).toBe('fallback');
      expect(safeGet('string', 'user.name', 'fallback')).toBe('fallback');
      expect(safeGet(123, 'user.name', 'fallback')).toBe('fallback');
    });

    it('should prevent prototype pollution attacks', () => {
      expect(safeGet(testObj, '__proto__.polluted', 'safe')).toBe('safe');
      expect(safeGet(testObj, 'constructor', 'safe')).toBe('safe');
      expect(safeGet(testObj, 'prototype', 'safe')).toBe('safe');
    });

    it('should handle empty and invalid paths', () => {
      expect(safeGet(testObj, '', 'fallback')).toBe('fallback');
      // Empty array returns the object itself (no path to traverse)
      expect(safeGet(testObj, [])).toEqual(testObj);
      expect(safeGet(testObj, null, 'fallback')).toBe('fallback');
      expect(safeGet(testObj, 123, 'fallback')).toBe('fallback');
    });
  });

  describe('safeNumber', () => {
    it('should convert valid numbers correctly', () => {
      expect(safeNumber(123)).toBe(123);
      expect(safeNumber('456')).toBe(456);
      expect(safeNumber('123.45')).toBe(123.45);
      expect(safeNumber(0)).toBe(0);
      expect(safeNumber(-100)).toBe(-100);
    });

    it('should return fallback for invalid numbers', () => {
      expect(safeNumber('invalid')).toBe(0);
      expect(safeNumber('not a number', 99)).toBe(99);
      expect(safeNumber(NaN, -1)).toBe(-1);
    });

    it('should handle null/undefined with fallback', () => {
      expect(safeNumber(null)).toBe(0);
      expect(safeNumber(undefined)).toBe(0);
      expect(safeNumber(null, 100)).toBe(100);
      expect(safeNumber(undefined, -50)).toBe(-50);
    });

    it('should handle edge cases', () => {
      expect(safeNumber(Infinity)).toBe(Infinity);
      expect(safeNumber(-Infinity)).toBe(-Infinity);
      expect(safeNumber(true)).toBe(1);
      expect(safeNumber(false)).toBe(0);
    });
  });

  describe('safeBoolean', () => {
    it('should return boolean values as-is', () => {
      expect(safeBoolean(true)).toBe(true);
      expect(safeBoolean(false)).toBe(false);
    });

    it('should convert string "true" variants', () => {
      expect(safeBoolean('true')).toBe(true);
      expect(safeBoolean('TRUE')).toBe(true);
      expect(safeBoolean('True')).toBe(true);
      expect(safeBoolean('1')).toBe(true);
      expect(safeBoolean('yes')).toBe(true);
      expect(safeBoolean('YES')).toBe(true);
    });

    it('should convert string "false" variants', () => {
      expect(safeBoolean('false')).toBe(false);
      expect(safeBoolean('FALSE')).toBe(false);
      expect(safeBoolean('0')).toBe(false);
      expect(safeBoolean('no')).toBe(false);
      expect(safeBoolean('NO')).toBe(false);
    });

    it('should convert numbers to boolean', () => {
      expect(safeBoolean(1)).toBe(true);
      expect(safeBoolean(100)).toBe(true);
      expect(safeBoolean(-1)).toBe(true);
      expect(safeBoolean(0)).toBe(false);
    });

    it('should return fallback for null/undefined', () => {
      expect(safeBoolean(null)).toBe(false);
      expect(safeBoolean(undefined)).toBe(false);
      expect(safeBoolean(null, true)).toBe(true);
      expect(safeBoolean(undefined, true)).toBe(true);
    });

    it('should return fallback for unrecognized strings', () => {
      expect(safeBoolean('invalid')).toBe(false);
      expect(safeBoolean('maybe', true)).toBe(true);
      expect(safeBoolean('', false)).toBe(false);
    });
  });
});