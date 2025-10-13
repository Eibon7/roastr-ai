const {
  normalizeUnicode,
  sanitizeUrl,
  normalizeQuotes,
  normalizeSpaces,
  normalizeText
} = require('../../../src/utils/textNormalizer');

describe('textNormalizer', () => {
  describe('normalizeUnicode', () => {
    // AC1: Tables of test cases for unicode
    const unicodeTestCases = [
      { input: 'café', form: 'NFC', expected: 'café', description: 'Composed form (é as single character)' },
      { input: 'café', form: 'NFD', expected: 'café', description: 'Decomposed form (é as e + combining accent)' },
      { input: 'Å', form: 'NFC', expected: 'Å', description: 'Latin capital A with ring above (composed)' },
      { input: 'Å', form: 'NFD', expected: 'Å', description: 'Latin capital A with ring above (decomposed)' },
      { input: '①②③', form: 'NFKC', expected: '123', description: 'Circled numbers to ASCII' },
      { input: 'ﬁle', form: 'NFKC', expected: 'file', description: 'Ligature to separate letters' },
      { input: '🔥', form: 'NFC', expected: '🔥', description: 'Emoji normalization' },
      { input: '👨‍👩‍👧‍👦', form: 'NFC', expected: '👨‍👩‍👧‍👦', description: 'Family emoji with ZWJ' }
    ];

    unicodeTestCases.forEach(({ input, form, expected, description }) => {
      it(`should normalize "${input}" to ${form}: ${description}`, () => {
        const result = normalizeUnicode(input, form);
        expect(result.normalize(form)).toBe(expected.normalize(form));
      });
    });

    // AC2: Edge cases
    it('should handle empty string', () => {
      expect(normalizeUnicode('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(normalizeUnicode(null)).toBe(null);
      expect(normalizeUnicode(undefined)).toBe(undefined);
      expect(normalizeUnicode(123)).toBe(123);
    });

    it('should throw error for invalid normalization form', () => {
      expect(() => normalizeUnicode('test', 'INVALID')).toThrow('Invalid normalization form');
    });

    // AC3: Special characters validation
    it('should handle combining characters', () => {
      const input = 'e\u0301'; // e + combining acute accent
      const normalized = normalizeUnicode(input, 'NFC');
      expect(normalized).toBe('é');
    });

    it('should handle multiple combining marks', () => {
      const input = 'o\u0308\u0304'; // o + diaeresis + macron
      const normalized = normalizeUnicode(input, 'NFC');
      expect(normalized.length).toBeLessThan(input.length);
    });

    // AC4: Consistent normalization
    it('should produce consistent results for repeated normalization', () => {
      const input = 'café';
      const first = normalizeUnicode(input, 'NFC');
      const second = normalizeUnicode(first, 'NFC');
      expect(first).toBe(second);
    });

    // AC5: Performance for high volume
    it('should normalize large text efficiently', () => {
      const largeText = 'café '.repeat(10000);
      const start = Date.now();
      normalizeUnicode(largeText, 'NFC');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // Should complete in <500ms
    });
  });

  describe('sanitizeUrl', () => {
    // AC1: Tables of test cases for URLs
    const urlTestCases = [
      {
        input: 'https://example.com',
        expected: 'https://example.com/',
        valid: true,
        description: 'Valid HTTPS URL'
      },
      {
        input: 'http://example.com/path',
        expected: 'http://example.com/path',
        valid: true,
        description: 'Valid HTTP URL with path'
      },
      {
        input: 'javascript:alert(1)',
        expected: null,
        valid: false,
        description: 'XSS javascript protocol'
      },
      {
        input: 'data:text/html,<script>alert(1)</script>',
        expected: null,
        valid: false,
        description: 'XSS data protocol'
      },
      {
        input: 'vbscript:msgbox(1)',
        expected: null,
        valid: false,
        description: 'XSS vbscript protocol'
      },
      {
        input: 'file:///etc/passwd',
        expected: null,
        valid: false,
        description: 'File protocol (security risk)'
      },
      {
        input: 'ftp://example.com',
        expected: null,
        valid: false,
        description: 'FTP protocol (not allowed by default)'
      },
      {
        input: 'not-a-url',
        expected: null,
        valid: false,
        description: 'Malformed URL'
      },
      {
        input: '//example.com',
        expected: null,
        valid: false,
        description: 'Protocol-relative URL (missing protocol)'
      }
    ];

    urlTestCases.forEach(({ input, expected, valid, description }) => {
      it(`should ${valid ? 'accept' : 'reject'} ${description}: "${input}"`, () => {
        const result = sanitizeUrl(input);
        expect(result).toBe(expected);
      });
    });

    // AC2: Edge cases
    it('should handle empty string', () => {
      expect(sanitizeUrl('')).toBe(null);
    });

    it('should handle whitespace-only string', () => {
      expect(sanitizeUrl('   ')).toBe(null);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeUrl(null)).toBe(null);
      expect(sanitizeUrl(undefined)).toBe(null);
    });

    it('should handle non-string input', () => {
      expect(sanitizeUrl(123)).toBe(null);
      expect(sanitizeUrl({})).toBe(null);
    });

    // Options testing
    it('should remove query params when option is set', () => {
      const url = 'https://example.com/path?foo=bar&baz=qux';
      const result = sanitizeUrl(url, { removeQueryParams: true });
      expect(result).toBe('https://example.com/path');
    });

    it('should remove fragment when option is set', () => {
      const url = 'https://example.com/path#section';
      const result = sanitizeUrl(url, { removeFragment: true });
      expect(result).toBe('https://example.com/path');
    });

    it('should allow custom protocols', () => {
      const url = 'ftp://example.com';
      const result = sanitizeUrl(url, { allowedProtocols: ['ftp:'] });
      expect(result).toBe('ftp://example.com/');
    });

    // AC3: Special characters in URLs
    it('should handle URLs with special characters', () => {
      const url = 'https://example.com/path%20with%20spaces';
      const result = sanitizeUrl(url);
      expect(result).toContain('path%20with%20spaces');
    });

    it('should handle international domain names', () => {
      const url = 'https://münchen.de';
      const result = sanitizeUrl(url);
      expect(result).not.toBe(null);
    });

    // AC4: Consistent sanitization
    it('should produce same result when sanitized twice', () => {
      const url = 'https://example.com';
      const first = sanitizeUrl(url);
      const second = sanitizeUrl(first);
      expect(first).toBe(second);
    });

    // AC5: Performance
    it('should sanitize URLs efficiently', () => {
      const urls = Array(1000).fill('https://example.com/path');
      const start = Date.now();
      urls.forEach(url => sanitizeUrl(url));
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // Should complete in <500ms
    });
  });

  describe('normalizeQuotes', () => {
    // AC1: Tables of test cases for quotes
    const quoteTestCases = [
      { input: '\u201Chello\u201D', expected: '"hello"', style: 'straight', description: 'Smart double quotes to straight' },
      { input: '\u2018hello\u2019', expected: "'hello'", style: 'straight', description: 'Smart single quotes to straight' },
      { input: '\u201Ahello\u2019', expected: "'hello'", style: 'straight', description: 'Low-9 quote to straight' },
      { input: '\u201Ehello\u201D', expected: '"hello"', style: 'straight', description: 'Double low-9 quote to straight' },
      { input: '\u2032hello\u2032', expected: "'hello'", style: 'straight', description: 'Prime marks to straight quotes' },
      { input: '"hello"', expected: '\u201Chello\u201D', style: 'smart', description: 'Straight to smart double quotes' },
      { input: "'hello'", expected: '\u2018hello\u2019', style: 'smart', description: 'Straight to smart single quotes' }
    ];

    quoteTestCases.forEach(({ input, expected, style, description }) => {
      it(`should normalize ${description}`, () => {
        const result = normalizeQuotes(input, { style });
        expect(result).toBe(expected);
      });
    });

    // AC2: Edge cases
    it('should handle empty string', () => {
      expect(normalizeQuotes('')).toBe('');
    });

    it('should handle string without quotes', () => {
      expect(normalizeQuotes('hello world')).toBe('hello world');
    });

    it('should handle non-string input', () => {
      expect(normalizeQuotes(null)).toBe(null);
      expect(normalizeQuotes(undefined)).toBe(undefined);
      expect(normalizeQuotes(123)).toBe(123);
    });

    // AC3: Nested quotes
    it('should handle nested quotes', () => {
      const input = '\u201CShe said \u2018hello\u2019\u201D';
      const result = normalizeQuotes(input, { style: 'straight' });
      expect(result).toBe('"She said \'hello\'"');
    });

    it('should handle mixed quote types', () => {
      const input = '\u201Chello\u201D and \u2018world\u2019';
      const result = normalizeQuotes(input, { style: 'straight' });
      expect(result).toBe('"hello" and \'world\'');
    });

    // AC4: Consistency
    it('should produce consistent results', () => {
      const input = '\u201Chello\u201D';
      const first = normalizeQuotes(input);
      const second = normalizeQuotes(first);
      expect(first).toBe(second);
    });

    // AC5: Performance
    it('should normalize large text with many quotes efficiently', () => {
      const largeText = '"test" '.repeat(10000);
      const start = Date.now();
      normalizeQuotes(largeText);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('normalizeSpaces', () => {
    // AC1: Tables of test cases for spaces
    const spaceTestCases = [
      { input: '  hello  ', expected: 'hello', options: {}, description: 'Trim leading/trailing spaces' },
      { input: 'hello  world', expected: 'hello world', options: {}, description: 'Collapse multiple spaces' },
      { input: 'hello\t\tworld', expected: 'hello world', options: {}, description: 'Collapse multiple tabs' },
      { input: 'hello\u00A0world', expected: 'hello world', options: { removeNonBreaking: true }, description: 'Remove non-breaking spaces' },
      { input: 'hello\r\nworld', expected: 'hello\nworld', options: { normalizeLineBreaks: true }, description: 'Normalize CRLF to LF' },
      { input: 'hello\rworld', expected: 'hello\nworld', options: { normalizeLineBreaks: true }, description: 'Normalize CR to LF' },
      { input: '  hello  ', expected: ' hello ', options: { trim: false }, description: 'Keep leading/trailing with trim=false (but still collapse)' },
      { input: 'hello  world', expected: 'hello  world', options: { collapseMultiple: false }, description: 'Keep multiple spaces with collapseMultiple=false' }
    ];

    spaceTestCases.forEach(({ input, expected, options, description }) => {
      it(`should ${description}`, () => {
        const result = normalizeSpaces(input, options);
        expect(result).toBe(expected);
      });
    });

    // AC2: Edge cases
    it('should handle empty string', () => {
      expect(normalizeSpaces('')).toBe('');
    });

    it('should handle string with only spaces', () => {
      expect(normalizeSpaces('     ')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(normalizeSpaces(null)).toBe(null);
      expect(normalizeSpaces(undefined)).toBe(undefined);
      expect(normalizeSpaces(123)).toBe(123);
    });

    // AC3: Special whitespace characters
    it('should handle various whitespace types', () => {
      const input = 'hello\u00A0\u202F\u2007world'; // Non-breaking, narrow no-break, figure space
      const result = normalizeSpaces(input, { removeNonBreaking: true });
      expect(result).not.toMatch(/[\u00A0\u202F\u2007]/);
    });

    it('should preserve regular spaces when not collapsing', () => {
      const input = 'hello world  test';
      const result = normalizeSpaces(input, { collapseMultiple: false });
      expect(result).toMatch(/  /); // Should still have double space
    });

    // AC4: Consistency
    it('should produce consistent results', () => {
      const input = '  hello  world  ';
      const first = normalizeSpaces(input);
      const second = normalizeSpaces(first);
      expect(first).toBe(second);
    });

    // AC5: Performance
    it('should normalize large text efficiently', () => {
      const largeText = '  hello  '.repeat(10000);
      const start = Date.now();
      normalizeSpaces(largeText);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('normalizeText (combined)', () => {
    it('should apply all normalizations by default', () => {
      const input = '  "café"  test  ';
      const result = normalizeText(input);
      expect(result).toBe('"café" test');
    });

    it('should handle unicode + quotes + spaces together', () => {
      const input = '  \u201Ccafé\u201D  and  \u2018naïve\u2019  ';
      const result = normalizeText(input, {
        unicode: true,
        quotes: true,
        spaces: true
      });
      expect(result).not.toMatch(/  /); // No double spaces
      expect(result).not.toMatch(/^[\s]/); // No leading space
      expect(result).not.toMatch(/[\s]$/); // No trailing space
    });

    it('should allow selective normalization', () => {
      const input = '  "hello"  ';
      const result = normalizeText(input, {
        unicode: false,
        quotes: false,
        spaces: true
      });
      expect(result).toBe('"hello"'); // Only spaces normalized
    });

    it('should handle non-string input gracefully', () => {
      expect(normalizeText(null)).toBe(null);
      expect(normalizeText(undefined)).toBe(undefined);
      expect(normalizeText(123)).toBe(123);
    });

    // AC4: Consistency across all operations
    it('should produce same result when normalized multiple times', () => {
      const input = '  \u201Ccafé\u201D  and  \u2018test\u2019  ';
      const first = normalizeText(input);
      const second = normalizeText(first);
      expect(first).toBe(second);
    });

    // AC5: Performance with all operations
    it('should normalize large complex text efficiently', () => {
      const largeText = '  \u201Ccafé\u201D  and  \u2018test\u2019  '.repeat(1000);
      const start = Date.now();
      normalizeText(largeText);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Combined operations in <1s
    });
  });

  describe('Integration scenarios', () => {
    it('should normalize user input for database storage', () => {
      const userInput = '  "Hello,  world!"  ';
      const normalized = normalizeText(userInput, {
        unicode: true,
        unicodeForm: 'NFC',
        quotes: true,
        quotesStyle: 'straight',
        spaces: true,
        trimSpaces: true,
        collapseSpaces: true
      });
      expect(normalized).toBe('"Hello, world!"');
    });

    it('should sanitize URL while normalizing surrounding text', () => {
      const input = '  Check  "this"  URL:  https://example.com  ';
      const normalizedText = normalizeText(input);
      expect(normalizedText).toBe('Check "this" URL: https://example.com');
    });

    it('should handle mixed content with unicode, quotes, and spaces', () => {
      const input = '  \u201Ccafé\u201D  é  and  \u2018naïve\u2019  ideas  ';
      const result = normalizeText(input);
      expect(result).toMatch(/^[^\s]/); // No leading space
      expect(result).toMatch(/[^\s]$/); // No trailing space
      expect(result).not.toMatch(/  /); // No double spaces
    });
  });

  describe('Security edge cases', () => {
    it('should not break on malicious unicode sequences', () => {
      const malicious = '\u202E\u202D'; // RTL/LTR override
      expect(() => normalizeUnicode(malicious)).not.toThrow();
    });

    it('should reject URLs with XSS attempts', () => {
      const xssUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox',
        'file:///etc/passwd'
      ];
      xssUrls.forEach(url => {
        expect(sanitizeUrl(url)).toBe(null);
      });
    });

    it('should handle extremely long input without crashing', () => {
      const veryLongText = 'a'.repeat(1000000);
      expect(() => normalizeText(veryLongText)).not.toThrow();
    });

    it('should handle text with zero-width characters', () => {
      const input = 'hello\u200Bworld\u200C\u200Dtest';
      const result = normalizeUnicode(input, 'NFC');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
