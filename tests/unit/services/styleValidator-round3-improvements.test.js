const { describe, it, expect, beforeEach, jest } = require('@jest/globals');
const StyleValidator = require('../../../src/services/styleValidator');

describe('StyleValidator - Round 3 Improvements', () => {
  let validator;

  beforeEach(() => {
    validator = new StyleValidator();
  });

  describe('Performance Optimizations', () => {
    describe('Pre-compiled Regex Patterns', () => {
      it('should reuse compiled regex patterns for better performance', () => {
        const text = 'Test with repetitive aaaaa pattern';
        
        // Test that pre-compiled patterns work consistently
        const result1 = validator.validate(text, 'twitter');
        const result2 = validator.validate(text, 'twitter');
        
        expect(result1.valid).toEqual(result2.valid);
        expect(result1.errors).toEqual(result2.errors);
      });

      it('should handle regex patterns consistently across multiple calls', () => {
        const testCases = [
          'Normal text content',
          'Text with repetitive aaaaa pattern',
          'Text with idiota insult',
          'Text with Powered by Roastr disclaimer'
        ];

        const results = testCases.map(text => validator.validate(text, 'twitter'));
        
        // Validate again to ensure pattern reuse works correctly
        const secondResults = testCases.map(text => validator.validate(text, 'twitter'));
        
        expect(results).toEqual(secondResults);
        results.forEach(result => {
          expect(result).toHaveProperty('valid');
          expect(result).toHaveProperty('metadata');
        });
      });
    });
  });

  describe('UTF-8 Byte Length Calculation', () => {
    it('should calculate UTF-8 byte length correctly for ASCII text', () => {
      const text = 'Hello World';
      const result = validator.validate(text, 'twitter');
      
      expect(result.metadata.byteLengthUtf8).toBe(11); // ASCII: 1 byte per character
      expect(result.metadata.textLength).toBe(11);
      expect(result.metadata.codeUnitLength).toBe(11);
    });

    it('should calculate UTF-8 byte length correctly for Unicode characters', () => {
      const text = 'Hello 世界 🌍'; // ASCII + Chinese + Emoji
      const result = validator.validate(text, 'twitter');
      
      // UTF-8 bytes: 'Hello ' = 6, '世界' = 6, ' ' = 1, '🌍' = 4
      expect(result.metadata.byteLengthUtf8).toBe(17);
      expect(result.metadata.textLength).toBe(9); // 9 grapheme clusters
      expect(result.metadata.codeUnitLength).toBe(10); // 10 UTF-16 code units
    });

    it('should handle empty and whitespace strings', () => {
      const emptyResult = validator.validate('', 'twitter');
      expect(emptyResult.metadata.byteLengthUtf8).toBe(0);
      expect(emptyResult.metadata.textLength).toBe(0);
      expect(emptyResult.metadata.codeUnitLength).toBe(0);

      const spaceResult = validator.validate('   ', 'twitter');
      expect(spaceResult.metadata.byteLengthUtf8).toBe(3);
      expect(spaceResult.metadata.textLength).toBe(3);
      expect(spaceResult.metadata.codeUnitLength).toBe(3);
    });
  });

  describe('Unicode Handling with Intl.Segmenter', () => {
    it('should handle undefined locale gracefully', () => {
      const text = 'Test with émojis 🎉 and ñ characters';
      
      // Should not throw when locale is undefined
      expect(() => {
        validator.validate(text, 'twitter');
      }).not.toThrow();
      
      const result = validator.validate(text, 'twitter');
      expect(result.metadata.textLength).toBeGreaterThan(0);
      expect(typeof result.metadata.textLength).toBe('number');
    });

    it('should count grapheme clusters correctly', () => {
      const testCases = [
        { text: 'café', expected: 4 }, // é is one grapheme
        { text: '🇺🇸🇪🇸', expected: 2 }, // Flag emojis
        { text: 'simple', expected: 6 } // ASCII baseline
      ];

      testCases.forEach(({ text, expected }) => {
        const result = validator.validate(text, 'twitter');
        expect(result.metadata.textLength).toBe(expected);
      });
    });
  });

  describe('Enhanced Metadata Validation', () => {
    it('should provide complete metadata for all text types', () => {
      const text = 'Sample text with emoji 🎉';
      const result = validator.validate(text, 'twitter');
      
      expect(result.metadata).toHaveProperty('textLength');
      expect(result.metadata).toHaveProperty('codeUnitLength');
      expect(result.metadata).toHaveProperty('byteLengthUtf8');
      expect(result.metadata).toHaveProperty('platform');
      
      expect(typeof result.metadata.textLength).toBe('number');
      expect(typeof result.metadata.codeUnitLength).toBe('number');
      expect(typeof result.metadata.byteLengthUtf8).toBe('number');
    });

    it('should calculate metadata consistently across platforms', () => {
      const text = 'Test content 🌟';
      const platforms = ['twitter', 'facebook', 'instagram'];
      
      const results = platforms.map(platform => 
        validator.validate(text, platform)
      );
      
      // Metadata should be consistent across platforms
      const firstMetadata = results[0].metadata;
      results.forEach(result => {
        expect(result.metadata.textLength).toBe(firstMetadata.textLength);
        expect(result.metadata.codeUnitLength).toBe(firstMetadata.codeUnitLength);
        expect(result.metadata.byteLengthUtf8).toBe(firstMetadata.byteLengthUtf8);
      });
    });
  });

  describe('Edge Cases for Null/Undefined Inputs', () => {
    it('should handle null text input gracefully', () => {
      expect(() => {
        validator.validate(null, 'twitter');
      }).not.toThrow();
      
      const result = validator.validate(null, 'twitter');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined text input gracefully', () => {
      expect(() => {
        validator.validate(undefined, 'twitter');
      }).not.toThrow();
      
      const result = validator.validate(undefined, 'twitter');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle non-string text input gracefully', () => {
      const nonStringInputs = [123, {}, [], true];
      
      nonStringInputs.forEach(input => {
        expect(() => {
          validator.validate(input, 'twitter');
        }).not.toThrow();
        
        const result = validator.validate(input, 'twitter');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should provide default metadata for invalid inputs', () => {
      const result = validator.validate(null, 'twitter');
      
      expect(result.metadata).toHaveProperty('textLength');
      expect(result.metadata).toHaveProperty('codeUnitLength');
      expect(result.metadata).toHaveProperty('byteLengthUtf8');
      expect(result.metadata.textLength).toBe(0);
      expect(result.metadata.codeUnitLength).toBe(0);
      expect(result.metadata.byteLengthUtf8).toBe(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should validate text efficiently for large inputs', () => {
      // Create a large text with various Unicode elements
      const largeText = Array(100).fill('Sample text with émojis 🎉 ').join('');
      
      const startTime = Date.now();
      const result = validator.validate(largeText, 'twitter');
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('metadata');
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain performance with repeated validations', () => {
      const text = 'Performance test with Unicode 🚀';
      const iterations = 50;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        validator.validate(text, 'twitter');
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;
      
      expect(averageTime).toBeLessThan(20); // Average should be less than 20ms per validation
    });
  });
});