const StyleProfileGenerator = require('../../../src/services/styleProfileGenerator');

describe('StyleProfileGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new StyleProfileGenerator();
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      await expect(generator.initialize()).resolves.not.toThrow();
      expect(generator.isInitialized).toBe(true);
    });

    it('should handle multiple initialization calls', async () => {
      await generator.initialize();
      await generator.initialize(); // Should not throw
      expect(generator.isInitialized).toBe(true);
    });
  });

  describe('detectLanguages', () => {
    it('should detect single dominant language', () => {
      const content = [
        { lang: 'es', text: 'Hola mundo' },
        { lang: 'es', text: 'Cómo estás' },
        { lang: 'es', text: 'Muy bien gracias' }
      ];

      const result = generator.detectLanguages(content);
      expect(result).toHaveLength(1);
      expect(result[0].lang).toBe('es');
      expect(result[0].count).toBe(3);
      expect(result[0].percentage).toBe(100);
    });

    it('should detect multiple languages with sufficient threshold', () => {
      const content = Array(200).fill(null).map((_, i) => ({
        lang: i < 120 ? 'es' : 'en',
        text: `Sample text ${i}`
      }));

      const result = generator.detectLanguages(content);
      expect(result.length).toBeGreaterThanOrEqual(1);
      
      const spanishResult = result.find(r => r.lang === 'es');
      expect(spanishResult).toBeDefined();
      expect(spanishResult.count).toBe(120);
      
      const englishResult = result.find(r => r.lang === 'en');
      expect(englishResult).toBeDefined();
      expect(englishResult.count).toBe(80);
    });

    it('should filter out languages below minimum threshold', () => {
      const content = [
        ...Array(150).fill(null).map((_, i) => ({ lang: 'es', text: `Texto ${i}` })),
        ...Array(10).fill(null).map((_, i) => ({ lang: 'en', text: `Text ${i}` })) // Only 6.25%
      ];

      const result = generator.detectLanguages(content);
      expect(result).toHaveLength(1);
      expect(result[0].lang).toBe('es');
    });

    it('should handle empty content', () => {
      const result = generator.detectLanguages([]);
      expect(result).toHaveLength(0);
    });

    it('should return most common language when none meet criteria', () => {
      const content = [
        { lang: 'es', text: 'Texto' },
        { lang: 'en', text: 'Text' }
      ];

      const result = generator.detectLanguages(content);
      expect(result).toHaveLength(1);
      expect(['es', 'en']).toContain(result[0].lang);
    });
  });

  describe('analyzeLanguageContent', () => {
    const sampleContent = [
      { 
        lang: 'es', 
        text: 'Hola! ¿Cómo estás? Muy bien gracias 😀', 
        platform: 'twitter' 
      },
      { 
        lang: 'es', 
        text: 'Obviamente esto no tiene sentido...', 
        platform: 'twitter' 
      },
      { 
        lang: 'es', 
        text: 'Gracias por compartir esta información útil', 
        platform: 'instagram' 
      },
      { 
        lang: 'en', 
        text: 'This should be ignored for Spanish analysis', 
        platform: 'twitter' 
      }
    ];

    it('should analyze Spanish content correctly', () => {
      const result = generator.analyzeLanguageContent(sampleContent, 'es');
      
      expect(result).toBeDefined();
      expect(result.totalItems).toBe(3);
      expect(result.platforms).toHaveProperty('twitter');
      expect(result.platforms).toHaveProperty('instagram');
      expect(result.platforms.twitter).toBe(2);
      expect(result.platforms.instagram).toBe(1);
      expect(result.avgLength).toBeGreaterThan(0);
      expect(result.emojiUsage).toBeGreaterThan(0);
      expect(result.questionFrequency).toBe(1);
      expect(result.exclamationFrequency).toBe(1);
    });

    it('should return null for non-existent language', () => {
      const result = generator.analyzeLanguageContent(sampleContent, 'fr');
      expect(result).toBeNull();
    });

    it('should detect tone indicators', () => {
      const contentWithTones = [
        { lang: 'es', text: 'jaja que divertido', platform: 'twitter' },
        { lang: 'es', text: 'gracias por ayudar', platform: 'twitter' },
        { lang: 'es', text: 'obviamente era de esperarse', platform: 'twitter' }
      ];

      const result = generator.analyzeLanguageContent(contentWithTones, 'es');
      expect(result.toneIndicators.humorous).toBe(1);
      expect(result.toneIndicators.friendly).toBe(1);
      expect(result.toneIndicators.sarcastic).toBe(1);
    });

    it('should count common words', () => {
      const result = generator.analyzeLanguageContent(sampleContent, 'es');
      expect(result.commonWords).toBeInstanceOf(Array);
      expect(result.commonWords.length).toBeGreaterThan(0);
      result.commonWords.forEach(word => {
        expect(word).toHaveProperty('word');
        expect(word).toHaveProperty('count');
        expect(word.count).toBeGreaterThan(0);
      });
    });
  });

  describe('generateLanguageProfile', () => {
    const mockAnalysis = {
      totalItems: 100,
      platforms: { twitter: 60, instagram: 40 },
      avgLength: 85,
      toneIndicators: {
        casual: 5,
        formal: 2,
        humorous: 8,
        sarcastic: 3,
        friendly: 10
      },
      emojiUsage: 25,
      questionFrequency: 15,
      exclamationFrequency: 30,
      commonWords: [
        { word: 'bien', count: 12 },
        { word: 'gracias', count: 8 }
      ]
    };

    it('should generate Spanish profile correctly', () => {
      const profile = generator.generateLanguageProfile(mockAnalysis, 'es');
      
      expect(profile).toBeDefined();
      expect(profile.lang).toBe('es');
      expect(profile.prompt).toBeDefined();
      expect(profile.prompt.length).toBeLessThanOrEqual(1200);
      expect(profile.sources).toEqual(mockAnalysis.platforms);
      expect(profile.createdAt).toBeDefined();
      expect(profile.metadata).toBeDefined();
      expect(profile.examples).toBeInstanceOf(Array);
      expect(profile.examples.length).toBe(2);
      
      // Check metadata
      expect(profile.metadata.totalItems).toBe(100);
      expect(profile.metadata.avgLength).toBe(85);
      expect(profile.metadata.dominantTone).toBe('friendly'); // Highest count
      expect(profile.metadata.emojiUsage).toBeGreaterThan(0);
    });

    it('should generate English profile correctly', () => {
      const profile = generator.generateLanguageProfile(mockAnalysis, 'en');
      
      expect(profile).toBeDefined();
      expect(profile.lang).toBe('en');
      expect(profile.prompt).toBeDefined();
      expect(profile.examples).toBeInstanceOf(Array);
      expect(profile.examples.length).toBe(2);
    });

    it('should handle Portuguese profile', () => {
      const profile = generator.generateLanguageProfile(mockAnalysis, 'pt');
      
      expect(profile).toBeDefined();
      expect(profile.lang).toBe('pt');
      expect(profile.prompt).toBeDefined();
    });

    it('should fallback to English for unknown language', () => {
      const profile = generator.generateLanguageProfile(mockAnalysis, 'unknown');
      
      expect(profile).toBeDefined();
      expect(profile.lang).toBe('unknown');
      expect(profile.prompt).toBeDefined();
    });

    it('should determine style types based on length', () => {
      const shortAnalysis = { ...mockAnalysis, avgLength: 30 };
      const longAnalysis = { ...mockAnalysis, avgLength: 200 };
      
      const shortProfile = generator.generateLanguageProfile(shortAnalysis, 'es');
      const longProfile = generator.generateLanguageProfile(longAnalysis, 'es');
      
      expect(shortProfile.metadata.styleType).toBe('short');
      expect(longProfile.metadata.styleType).toBe('long');
    });
  });

  describe('generateStyleProfile', () => {
    const mockContentByPlatform = {
      twitter: Array(150).fill(null).map((_, i) => ({
        id: `tw_${i}`,
        text: `Tweet en español número ${i}`,
        lang: 'es',
        platform: 'twitter',
        createdAt: new Date().toISOString()
      })),
      instagram: Array(100).fill(null).map((_, i) => ({
        id: `ig_${i}`,
        text: `Post in English number ${i}`,
        lang: 'en',
        platform: 'instagram',
        createdAt: new Date().toISOString()
      }))
    };

    it('should generate complete style profile', async () => {
      const result = await generator.generateStyleProfile('user123', mockContentByPlatform);
      
      expect(result).toBeDefined();
      expect(result.profiles).toBeInstanceOf(Array);
      expect(result.profiles.length).toBeGreaterThan(0);
      expect(result.totalItems).toBe(250);
      expect(result.sources).toHaveProperty('twitter');
      expect(result.sources).toHaveProperty('instagram');
      expect(result.sources.twitter).toBe(150);
      expect(result.sources.instagram).toBe(100);
      expect(result.createdAt).toBeDefined();
      
      // Check profile structure
      result.profiles.forEach(profile => {
        expect(profile).toHaveProperty('lang');
        expect(profile).toHaveProperty('prompt');
        expect(profile).toHaveProperty('sources');
        expect(profile).toHaveProperty('metadata');
        expect(profile).toHaveProperty('examples');
        expect(profile.prompt.length).toBeLessThanOrEqual(1200);
      });
    });

    it('should respect maxItemsPerPlatform option', async () => {
      const result = await generator.generateStyleProfile('user123', mockContentByPlatform, {
        maxItemsPerPlatform: 50
      });
      
      expect(result.totalItems).toBe(100); // 50 + 50
      expect(result.sources.twitter).toBe(50);
      expect(result.sources.instagram).toBe(50);
    });

    it('should throw error for empty content', async () => {
      await expect(
        generator.generateStyleProfile('user123', {})
      ).rejects.toThrow('No content available');
    });

    it('should throw error for insufficient content', async () => {
      const insufficientContent = {
        twitter: Array(20).fill(null).map((_, i) => ({
          id: `tw_${i}`,
          text: `Short tweet ${i}`,
          lang: 'es',
          platform: 'twitter',
          createdAt: new Date().toISOString()
        }))
      };

      await expect(
        generator.generateStyleProfile('user123', insufficientContent)
      ).rejects.toThrow('Insufficient content to generate style profile');
    });

    it('should handle multiple languages correctly', async () => {
      const multiLangContent = {
        twitter: [
          ...Array(80).fill(null).map((_, i) => ({
            id: `tw_es_${i}`,
            text: `Tweet en español ${i}`,
            lang: 'es',
            platform: 'twitter',
            createdAt: new Date().toISOString()
          })),
          ...Array(60).fill(null).map((_, i) => ({
            id: `tw_en_${i}`,
            text: `English tweet ${i}`,
            lang: 'en',
            platform: 'twitter',
            createdAt: new Date().toISOString()
          }))
        ]
      };

      const result = await generator.generateStyleProfile('user123', multiLangContent);
      
      expect(result.profiles.length).toBeGreaterThanOrEqual(1);
      
      const languages = result.profiles.map(p => p.lang);
      expect(languages).toContain('es');
      // English might not qualify if it doesn't meet the threshold
    });
  });

  describe('getProfileStats', () => {
    const mockProfiles = [
      {
        lang: 'es',
        metadata: { totalItems: 120 },
        sources: { twitter: 80, instagram: 40 },
        createdAt: '2023-01-01T00:00:00Z'
      },
      {
        lang: 'en',
        metadata: { totalItems: 80 },
        sources: { twitter: 50, youtube: 30 },
        createdAt: '2023-01-01T00:00:00Z'
      }
    ];

    it('should generate correct statistics', () => {
      const stats = generator.getProfileStats(mockProfiles);
      
      expect(stats.languageCount).toBe(2);
      expect(stats.languages).toEqual(['es', 'en']);
      expect(stats.totalSources).toBe(3); // twitter, instagram, youtube
      expect(stats.avgItemsPerLanguage).toBe(100); // (120 + 80) / 2
      expect(stats.createdAt).toBe('2023-01-01T00:00:00Z');
    });

    it('should handle empty profiles', () => {
      const stats = generator.getProfileStats([]);
      
      expect(stats.languageCount).toBe(0);
      expect(stats.languages).toEqual([]);
      expect(stats.totalSources).toBe(0);
      expect(stats.avgItemsPerLanguage).toBe(0);
      expect(stats.createdAt).toBeUndefined();
    });

    it('should handle single profile', () => {
      const stats = generator.getProfileStats([mockProfiles[0]]);
      
      expect(stats.languageCount).toBe(1);
      expect(stats.languages).toEqual(['es']);
      expect(stats.totalSources).toBe(2); // twitter, instagram
      expect(stats.avgItemsPerLanguage).toBe(120);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle content with missing fields', () => {
      const incompleteContent = [
        { lang: 'es', platform: 'twitter' }, // Missing text
        { text: 'Some text', platform: 'twitter' }, // Missing lang
        { lang: 'es', text: 'Complete item', platform: 'twitter' }
      ];

      const result = generator.analyzeLanguageContent(incompleteContent, 'es');
      expect(result).toBeDefined();
      expect(result.totalItems).toBe(1); // Only complete item counted
    });

    it('should handle very long text content', () => {
      const longTextContent = [{
        lang: 'es',
        text: 'a'.repeat(5000), // Very long text
        platform: 'twitter'
      }];

      const result = generator.analyzeLanguageContent(longTextContent, 'es');
      expect(result).toBeDefined();
      expect(result.avgLength).toBe(5000);
    });

    it('should handle special characters and emojis', () => {
      const specialContent = [{
        lang: 'es',
        text: '¡Hola! 🎉 ¿Qué tal? 😊 Ñoño... áéíóú',
        platform: 'twitter'
      }];

      const result = generator.analyzeLanguageContent(specialContent, 'es');
      expect(result).toBeDefined();
      expect(result.emojiUsage).toBe(2);
    });

    it('should handle null or undefined platform data', () => {
      const nullContent = [{
        lang: 'es',
        text: 'Test content',
        platform: null
      }];

      const result = generator.analyzeLanguageContent(nullContent, 'es');
      expect(result).toBeDefined();
      // Should not crash on null platform
    });
  });
});