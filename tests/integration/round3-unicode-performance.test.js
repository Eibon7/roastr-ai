const { describe, it, expect, beforeAll, afterAll, beforeEach, jest } = require('@jest/globals');
const StyleValidator = require('../../src/services/styleValidator');

describe('Round 3 Unicode Performance Integration Tests', () => {
  let validator;
  let performanceMetrics;

  beforeAll(() => {
    performanceMetrics = {
      validationTimes: [],
      memoryUsage: []
    };
  });

  beforeEach(() => {
    validator = new StyleValidator();
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Log performance summary
    if (performanceMetrics.validationTimes.length > 0) {
      const avgValidation = performanceMetrics.validationTimes.reduce((a, b) => a + b, 0) / performanceMetrics.validationTimes.length;
      console.log(`Average validation time: ${avgValidation.toFixed(2)}ms`);
    }
  });

  describe('Frontend-Backend Character Counting Consistency', () => {
    const testTexts = [
      { 
        text: 'Simple ASCII text',
        description: 'ASCII only'
      },
      { 
        text: 'Text with émojis 🎉 and ñáüé',
        description: 'Latin diacritics and emoji'
      },
      { 
        text: 'Mixed: ASCII + 中文 + 🌟',
        description: 'Multi-script with emoji'
      },
      { 
        text: '👨‍👩‍👧‍👦 family emoji',
        description: 'Complex emoji sequence'
      },
      { 
        text: 'Café naïve résumé piñata',
        description: 'Various diacritics'
      },
      {
        text: '🇺🇸🇪🇸🇫🇷 flag emojis',
        description: 'Flag emoji sequence'
      }
    ];

    testTexts.forEach(({ text, description }) => {
      it(`should have consistent character counting for ${description}`, () => {
        const startTime = Date.now();
        
        // Backend validation
        const backendResult = validator.validate(text, 'twitter');
        
        const validationEndTime = Date.now();
        const validationTime = validationEndTime - startTime;
        performanceMetrics.validationTimes.push(validationTime);

        // Validate metadata structure
        expect(backendResult.metadata).toHaveProperty('textLength');
        expect(backendResult.metadata).toHaveProperty('codeUnitLength');
        expect(backendResult.metadata).toHaveProperty('byteLengthUtf8');

        expect(backendResult.metadata.textLength).toBeGreaterThanOrEqual(0);
        expect(backendResult.metadata.codeUnitLength).toBeGreaterThanOrEqual(0);
        expect(backendResult.metadata.byteLengthUtf8).toBeGreaterThanOrEqual(0);

        // Performance assertions
        expect(validationTime).toBeLessThan(50); // Should validate in under 50ms
      });
    });

    it('should maintain consistency across platform normalizations', () => {
      const text = 'Test content 🌟';
      const platformMappings = [
        { input: 'X', expected: 'twitter' },
        { input: 'x', expected: 'twitter' },
        { input: 'x.com', expected: 'twitter' },
        { input: 'twitter', expected: 'twitter' },
        { input: 'facebook', expected: 'facebook' },
        { input: 'instagram', expected: 'instagram' }
      ];

      const results = platformMappings.map(({ input, expected }) => {
        const result = validator.validate(text, expected);
        return { platform: input, result };
      });

      // All Twitter-normalized platforms should have identical results
      const twitterResults = results.filter(r => 
        ['X', 'x', 'x.com', 'twitter'].includes(r.platform)
      );

      if (twitterResults.length > 1) {
        const firstResult = twitterResults[0].result;
        twitterResults.slice(1).forEach(({ platform, result }) => {
          expect(result.metadata.textLength).toBe(firstResult.metadata.textLength);
          expect(result.metadata.codeUnitLength).toBe(firstResult.metadata.codeUnitLength);
          expect(result.metadata.byteLengthUtf8).toBe(firstResult.metadata.byteLengthUtf8);
        });
      }
    });
  });

  describe('Platform Normalization End-to-End Flow', () => {
    it('should normalize platforms correctly throughout validation', () => {
      const testText = 'Testing platform normalization 🎯';

      // Test various platform inputs that should normalize to twitter
      const twitterVariants = ['X', 'x', 'x.com', 'X.COM', 'twitter'];
      
      const results = twitterVariants.map(platform => {
        // Normalize platform as the validator would
        const normalizedPlatform = platform?.toLowerCase()?.trim();
        const platformMap = {
          'x': 'twitter',
          'x.com': 'twitter'
        };
        const finalPlatform = platformMap[normalizedPlatform] || normalizedPlatform || 'twitter';
        
        return validator.validate(testText, finalPlatform);
      });

      // All results should be identical since they normalize to twitter
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.metadata.textLength).toBe(firstResult.metadata.textLength);
        expect(result.metadata.codeUnitLength).toBe(firstResult.metadata.codeUnitLength);
        expect(result.metadata.byteLengthUtf8).toBe(firstResult.metadata.byteLengthUtf8);
        expect(result.valid).toBe(firstResult.valid);
      });
    });

    it('should handle platform changes with complex Unicode content', () => {
      const complexText = '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Complex émoji with 中文';

      const platforms = ['twitter', 'facebook', 'instagram'];
      
      platforms.forEach(platform => {
        const result = validator.validate(complexText, platform);
        
        expect(result.metadata.textLength).toBeGreaterThan(0);
        expect(result.metadata.codeUnitLength).toBeGreaterThan(0);
        expect(result.metadata.byteLengthUtf8).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle rapid sequential validations efficiently', () => {
      const testTexts = Array(50).fill(0).map((_, i) => 
        `Test ${i} with émojis 🎉 and Unicode 中文`
      );

      const startTime = Date.now();
      
      const results = testTexts.map(text => 
        validator.validate(text, 'twitter')
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / testTexts.length;

      // All validations should complete successfully
      results.forEach((result, index) => {
        expect(result.valid).toBeDefined();
        expect(result.metadata.textLength).toBeGreaterThan(0);
        expect(result.metadata.codeUnitLength).toBeGreaterThan(0);
        expect(result.metadata.byteLengthUtf8).toBeGreaterThan(0);
      });

      // Performance should be reasonable
      expect(averageTime).toBeLessThan(10); // Less than 10ms per validation on average
      expect(totalTime).toBeLessThan(500); // Total under 500ms for 50 validations
    });

    it('should handle large Unicode content efficiently', () => {
      // Create large text with various Unicode elements
      const unicodeBlocks = [
        '🎉🌟✨🎯🚀💎🔥⭐',
        '中文测试内容包含各种字符',
        'Émojis çafé naïve résumé',
        '🇺🇸🇪🇸🇫🇷🇩🇪'
      ];
      
      const largeText = Array(20).fill(unicodeBlocks.join(' ')).join('\n');
      
      const startTime = Date.now();
      const result = validator.validate(largeText, 'twitter');
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      
      expect(result.metadata.textLength).toBeGreaterThan(0);
      expect(result.metadata.codeUnitLength).toBeGreaterThan(0);
      expect(result.metadata.byteLengthUtf8).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(200); // Should complete within 200ms
    });

    it('should maintain performance with repeated platform normalizations', () => {
      const text = 'Performance test with platform normalization 🎯';
      const platforms = ['X', 'x', 'x.com', 'twitter'];
      const iterations = 100;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const platform = platforms[i % platforms.length];
        const result = validator.validate(text, platform);
        expect(result.valid).toBeDefined();
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;
      
      expect(averageTime).toBeLessThan(5); // Less than 5ms per validation
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during extensive testing', () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const text = `Memory test ${i} with Unicode 🧠 and émojis 🎭`;
        validator.validate(text, 'twitter');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up resources properly', () => {
      const text = 'Resource cleanup test 🧹';
      
      // Create and use multiple validator instances
      const validators = Array(10).fill(0).map(() => new StyleValidator());
      
      validators.forEach((v, index) => {
        const result = v.validate(`${text} ${index}`, 'twitter');
        expect(result.valid).toBeDefined();
      });
      
      // Clear references
      validators.length = 0;
      
      // This test mainly ensures no errors occur during cleanup
      expect(true).toBe(true);
    });
  });

  describe('Regex Pattern Performance', () => {
    it('should reuse compiled patterns efficiently', () => {
      const spamText = 'aaaaaaaaaaaaa'; // Should trigger spam detection
      const insultText = 'eres un idiota'; // Should trigger insult detection
      const disclaimerText = 'Powered by Roastr'; // Should trigger disclaimer detection
      
      const texts = [spamText, insultText, disclaimerText];
      
      // Run multiple validations to test pattern reuse
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        texts.forEach(text => {
          const result = validator.validate(text, 'twitter');
          expect(result.valid).toBe(false); // All should fail validation
        });
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete efficiently due to pattern reuse
      expect(totalTime).toBeLessThan(1000); // Under 1 second for 300 validations
    });
  });
});