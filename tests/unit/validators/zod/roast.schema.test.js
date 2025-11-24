/**
 * Unit tests for Zod roast validation schemas
 * Issue #946 - Migration from manual validation to Zod
 *
 * Tests cover:
 * - Text validation (min/max length, trim)
 * - Tone validation (enum, default)
 * - Platform validation (enum, default, normalization)
 * - Language validation (enum, default)
 * - Complete endpoint schemas
 */

const {
  roastPreviewSchema,
  roastGenerateSchema,
  roastEngineSchema,
  roastValidateSchema,
  textSchema,
  toneSchema,
  platformSchema,
  languageSchema
} = require('../../../../src/validators/zod/roast.schema');

describe('Zod Roast Schemas - Base Schemas', () => {
  describe('textSchema', () => {
    it('should accept valid text', () => {
      const result = textSchema.parse('This is a valid comment');
      expect(result).toBe('This is a valid comment');
    });

    it('should trim whitespace', () => {
      const result = textSchema.parse('  trimmed text  ');
      expect(result).toBe('trimmed text');
    });

    it('should reject empty string', () => {
      expect(() => textSchema.parse('')).toThrow('Text cannot be empty');
    });

    it('should reject whitespace-only string', () => {
      expect(() => textSchema.parse('   ')).toThrow('Text cannot be empty');
    });

    it('should reject text exceeding max length', () => {
      const longText = 'a'.repeat(2001);
      expect(() => textSchema.parse(longText)).toThrow('Text must be at most 2000 characters');
    });

    it('should reject non-string values', () => {
      expect(() => textSchema.parse(123)).toThrow('Text must be a string');
      expect(() => textSchema.parse(null)).toThrow(); // Zod throws for null with invalid_type_error
      expect(() => textSchema.parse(undefined)).toThrow(); // Zod throws for undefined with required_error
    });

    it('should accept text at max length boundary', () => {
      const maxText = 'a'.repeat(2000);
      const result = textSchema.parse(maxText);
      expect(result).toBe(maxText);
    });
  });

  describe('toneSchema', () => {
    it('should accept valid tones', () => {
      expect(toneSchema.parse('Flanders')).toBe('Flanders');
      expect(toneSchema.parse('Balanceado')).toBe('Balanceado');
      expect(toneSchema.parse('Canalla')).toBe('Canalla');
    });

    it('should apply default tone', () => {
      const result = toneSchema.parse(undefined);
      expect(result).toBe('Balanceado');
    });

    it('should reject invalid tone', () => {
      expect(() => toneSchema.parse('invalid')).toThrow(
        'Tone must be one of: Flanders, Balanceado, Canalla'
      );
    });

    it('should normalize case-insensitive inputs', () => {
      // Issue #946: Normalization maintains backward compatibility
      expect(toneSchema.parse('flanders')).toBe('Flanders');
      expect(toneSchema.parse('FLANDERS')).toBe('Flanders');
      expect(toneSchema.parse('balanceado')).toBe('Balanceado');
      expect(toneSchema.parse('BALANCEADO')).toBe('Balanceado');
      expect(toneSchema.parse('canalla')).toBe('Canalla');
    });
  });

  describe('platformSchema', () => {
    it('should accept valid platforms', () => {
      expect(platformSchema.parse('twitter')).toBe('twitter');
      expect(platformSchema.parse('youtube')).toBe('youtube');
      expect(platformSchema.parse('instagram')).toBe('instagram');
    });

    it('should apply default platform', () => {
      const result = platformSchema.parse(undefined);
      expect(result).toBe('twitter');
    });

    it('should reject invalid platform', () => {
      expect(() => platformSchema.parse('invalid')).toThrow('Platform must be one of');
    });

    it('should normalize platform aliases (Issue #946 - AC5)', () => {
      // CRITICAL: Maintains backward compatibility
      expect(platformSchema.parse('X')).toBe('twitter');
      expect(platformSchema.parse('x.com')).toBe('twitter');
      expect(platformSchema.parse('TWITTER')).toBe('twitter');
    });
  });

  describe('languageSchema', () => {
    it('should accept valid languages', () => {
      expect(languageSchema.parse('es')).toBe('es');
      expect(languageSchema.parse('en')).toBe('en');
    });

    it('should apply default language', () => {
      const result = languageSchema.parse(undefined);
      expect(result).toBe('es');
    });

    it('should reject invalid language', () => {
      expect(() => languageSchema.parse('fr')).toThrow('Language must be one of');
    });

    it('should normalize BCP-47 locale codes (Issue #946 - AC5)', () => {
      // CRITICAL: Maintains backward compatibility with BCP-47
      expect(languageSchema.parse('en-US')).toBe('en');
      expect(languageSchema.parse('en-GB')).toBe('en');
      expect(languageSchema.parse('es-MX')).toBe('es');
      expect(languageSchema.parse('es-ES')).toBe('es');
    });
  });
});

describe('Zod Roast Schemas - Endpoint Schemas', () => {
  describe('roastPreviewSchema', () => {
    it('should accept valid preview request', () => {
      const validData = {
        text: 'Test comment',
        tone: 'Balanceado',
        platform: 'twitter'
      };
      const result = roastPreviewSchema.parse(validData);
      expect(result.text).toBe('Test comment');
      expect(result.tone).toBe('Balanceado');
      expect(result.platform).toBe('twitter');
    });

    it('should apply defaults for optional fields', () => {
      const minimalData = {
        text: 'Test comment'
      };
      const result = roastPreviewSchema.parse(minimalData);
      expect(result.tone).toBe('Balanceado');
      expect(result.platform).toBe('twitter');
    });

    it('should accept optional styleProfile', () => {
      const dataWithProfile = {
        text: 'Test comment',
        styleProfile: { custom: 'value' }
      };
      const result = roastPreviewSchema.parse(dataWithProfile);
      expect(result.styleProfile).toEqual({ custom: 'value' });
    });

    it('should accept optional persona', () => {
      const dataWithPersona = {
        text: 'Test comment',
        persona: 'friendly'
      };
      const result = roastPreviewSchema.parse(dataWithPersona);
      expect(result.persona).toBe('friendly');
    });

    it('should reject invalid text', () => {
      const invalidData = {
        text: ''
      };
      expect(() => roastPreviewSchema.parse(invalidData)).toThrow('Text cannot be empty');
    });

    it('should reject invalid tone', () => {
      const invalidData = {
        text: 'Valid text',
        tone: 'invalid-tone'
      };
      expect(() => roastPreviewSchema.parse(invalidData)).toThrow('Tone must be one of');
    });
  });

  describe('roastGenerateSchema', () => {
    it('should accept valid generate request', () => {
      const validData = {
        text: 'Test comment',
        tone: 'Canalla'
      };
      const result = roastGenerateSchema.parse(validData);
      expect(result.text).toBe('Test comment');
      expect(result.tone).toBe('Canalla');
    });

    it('should apply default tone', () => {
      const minimalData = {
        text: 'Test comment'
      };
      const result = roastGenerateSchema.parse(minimalData);
      expect(result.tone).toBe('Balanceado');
    });

    it('should reject missing text', () => {
      expect(() => roastGenerateSchema.parse({})).toThrow('Text is required');
    });
  });

  describe('roastEngineSchema', () => {
    it('should accept valid engine request', () => {
      const validData = {
        comment: 'Test comment',
        style: 'Balanceado',
        language: 'es',
        autoApprove: true,
        platform: 'twitter',
        commentId: 'comment-123'
      };
      const result = roastEngineSchema.parse(validData);
      expect(result.comment).toBe('Test comment');
      expect(result.style).toBe('Balanceado');
      expect(result.language).toBe('es');
      expect(result.autoApprove).toBe(true);
      expect(result.platform).toBe('twitter');
      expect(result.commentId).toBe('comment-123');
    });

    it('should apply all defaults', () => {
      const minimalData = {
        comment: 'Test comment'
      };
      const result = roastEngineSchema.parse(minimalData);
      expect(result.style).toBe('Balanceado');
      expect(result.language).toBe('es');
      expect(result.autoApprove).toBe(false);
      expect(result.platform).toBe('twitter');
    });

    it('should accept null commentId', () => {
      const data = {
        comment: 'Test comment',
        commentId: null
      };
      const result = roastEngineSchema.parse(data);
      expect(result.commentId).toBeNull();
    });

    it('should accept undefined commentId', () => {
      const data = {
        comment: 'Test comment'
      };
      const result = roastEngineSchema.parse(data);
      expect(result.commentId).toBeUndefined();
    });

    it('should reject invalid language', () => {
      const invalidData = {
        comment: 'Test comment',
        language: 'fr'
      };
      expect(() => roastEngineSchema.parse(invalidData)).toThrow('Language must be one of');
    });

    it('should reject non-boolean autoApprove', () => {
      const invalidData = {
        comment: 'Test comment',
        autoApprove: 'true'
      };
      expect(() => roastEngineSchema.parse(invalidData)).toThrow();
    });
  });

  describe('roastValidateSchema', () => {
    it('should accept valid validate request', () => {
      const validData = {
        text: 'Edited roast text',
        platform: 'youtube'
      };
      const result = roastValidateSchema.parse(validData);
      expect(result.text).toBe('Edited roast text');
      expect(result.platform).toBe('youtube');
    });

    it('should apply default platform', () => {
      const minimalData = {
        text: 'Edited roast text'
      };
      const result = roastValidateSchema.parse(minimalData);
      expect(result.platform).toBe('twitter');
    });

    it('should reject missing text', () => {
      expect(() => roastValidateSchema.parse({})).toThrow('Text is required');
    });

    it('should reject empty text', () => {
      const invalidData = {
        text: '   '
      };
      expect(() => roastValidateSchema.parse(invalidData)).toThrow('Text cannot be empty');
    });
  });
});

describe('Zod Roast Schemas - Edge Cases', () => {
  it('should handle unicode characters in text', () => {
    const unicodeText = 'Test with émojis 🔥 and special chars: ñ, ü, ç';
    const result = textSchema.parse(unicodeText);
    expect(result).toBe(unicodeText);
  });

  it('should handle text with newlines', () => {
    const multilineText = 'Line 1\nLine 2\nLine 3';
    const result = textSchema.parse(multilineText);
    expect(result).toBe(multilineText);
  });

  it('should handle mixed whitespace in text', () => {
    const whitespaceText = '  leading\tmiddle spaces  trailing  ';
    const result = textSchema.parse(whitespaceText);
    expect(result).toBe('leading\tmiddle spaces  trailing');
  });

  it('should preserve internal spaces when trimming', () => {
    const spacedText = '  word1   word2   word3  ';
    const result = textSchema.parse(spacedText);
    expect(result).toBe('word1   word2   word3');
  });
});

describe('Zod Roast Schemas - Type Safety', () => {
  it('should reject object for text field', () => {
    expect(() => textSchema.parse({ text: 'value' })).toThrow('Text must be a string');
  });

  it('should reject array for text field', () => {
    expect(() => textSchema.parse(['text'])).toThrow('Text must be a string');
  });

  it('should reject boolean for text field', () => {
    expect(() => textSchema.parse(true)).toThrow('Text must be a string');
  });
});
