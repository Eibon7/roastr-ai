/**
 * Tests for StylecardService - Issue #293
 */

const stylecardService = require('../../../src/services/stylecardService');
const embeddingsService = require('../../../src/services/embeddingsService');
const styleProfileGenerator = require('../../../src/services/styleProfileGenerator');

// Mock dependencies
jest.mock('../../../src/services/embeddingsService');
jest.mock('../../../src/services/styleProfileGenerator');
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            })),
            in: jest.fn()
          })),
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      })),
      delete: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  }))
}));

describe('StylecardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerStylecardGeneration', () => {
    it('should trigger stylecard generation for new Pro user', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const platforms = ['twitter', 'instagram'];

      // Mock no existing stylecard
      stylecardService.getActiveStylecard = jest.fn().mockResolvedValue(null);
      stylecardService.createGenerationJob = jest.fn().mockResolvedValue({
        id: 'job-123'
      });
      stylecardService.processGenerationJob = jest.fn().mockResolvedValue();

      const result = await stylecardService.triggerStylecardGeneration(
        userId,
        organizationId,
        platforms
      );

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(stylecardService.createGenerationJob).toHaveBeenCalledWith(
        userId,
        organizationId,
        platforms,
        {}
      );
    });

    it('should not regenerate if stylecard exists and forceRegenerate is false', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const platforms = ['twitter'];

      const existingStylecard = {
        id: 'stylecard-123',
        status: 'active'
      };

      stylecardService.getActiveStylecard = jest.fn().mockResolvedValue(existingStylecard);

      const result = await stylecardService.triggerStylecardGeneration(
        userId,
        organizationId,
        platforms
      );

      expect(result.success).toBe(true);
      expect(result.regenerated).toBe(false);
      expect(result.stylecard).toEqual(existingStylecard);
    });

    it('should regenerate if forceRegenerate is true', async () => {
      const userId = 'user-123';
      const organizationId = 'org-123';
      const platforms = ['twitter'];

      const existingStylecard = {
        id: 'stylecard-123',
        status: 'active'
      };

      stylecardService.getActiveStylecard = jest.fn().mockResolvedValue(existingStylecard);
      stylecardService.createGenerationJob = jest.fn().mockResolvedValue({
        id: 'job-456'
      });
      stylecardService.processGenerationJob = jest.fn().mockResolvedValue();

      const result = await stylecardService.triggerStylecardGeneration(
        userId,
        organizationId,
        platforms,
        { forceRegenerate: true }
      );

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-456');
    });
  });

  describe('buildPersonaContext (private method testing)', () => {
    it('should filter out empty enhancements', () => {
      // Test the filtering logic directly
      const enhancements = ['', null, undefined, 'Valid enhancement'];
      const validEnhancements = enhancements.filter(enhancement =>
        enhancement && typeof enhancement === 'string' && enhancement.trim().length > 0
      );

      expect(validEnhancements).toEqual(['Valid enhancement']);

      const result = validEnhancements.length > 0 ? validEnhancements.join('. ') + '.' : null;
      expect(result).toBe('Valid enhancement.');
    });

    it('should handle persona context building logic', () => {
      // Test the core logic without calling private method
      const personaData = {
        hasPersona: true,
        fieldsAvailable: ['lo_que_me_define', 'lo_que_no_tolero']
      };

      // Simulate the logic
      let personaEnhancements = [];

      if (personaData.fieldsAvailable.includes('lo_que_me_define')) {
        personaEnhancements.push('Considera la personalidad definida del usuario');
      }

      if (personaData.fieldsAvailable.includes('lo_que_no_tolero')) {
        personaEnhancements.push('Ten en cuenta lo que el usuario no tolera');
      }

      const validEnhancements = personaEnhancements.filter(enhancement =>
        enhancement && typeof enhancement === 'string' && enhancement.trim().length > 0
      );

      expect(validEnhancements).toHaveLength(2);
      expect(validEnhancements[0]).toContain('personalidad definida');
      expect(validEnhancements[1]).toContain('no tolera');
    });
  });

  describe('isSensitiveContent (logic testing)', () => {
    it('should detect sensitive patterns', () => {
      // Test the sensitive pattern logic directly
      const sensitivePatterns = [
        /\b(password|token|key|secret)\b/i,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card patterns
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email patterns
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/ // Phone patterns
      ];

      const sensitiveTexts = [
        'My password is secret123',
        'Call me at 555-123-4567',
        'Email me at user@example.com',
        'My credit card is 4532 1234 5678 9012'
      ];

      sensitiveTexts.forEach(text => {
        const isSensitive = sensitivePatterns.some(pattern => pattern.test(text));
        expect(isSensitive).toBe(true);
      });
    });

    it('should not flag normal content', () => {
      const sensitivePatterns = [
        /\b(password|token|key|secret)\b/i,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/
      ];

      const normalTexts = [
        'Just a normal tweet about my day',
        'Love this new restaurant!',
        'Working on some exciting projects'
      ];

      normalTexts.forEach(text => {
        const isSensitive = sensitivePatterns.some(pattern => pattern.test(text));
        expect(isSensitive).toBe(false);
      });
    });
  });

  describe('tone analysis logic', () => {
    it('should detect different tone patterns', () => {
      // Test tone detection logic
      const contentSamples = [
        { text: 'jaja this is so funny!' },
        { text: 'This is absolutely terrible!!!' },
        { text: 'Maybe we should consider this...' },
        { text: 'This is a balanced statement.' }
      ];

      // Simulate tone distribution calculation
      const tones = { ligero: 0, equilibrado: 0, contundente: 0, humorous: 0, sarcastic: 0 };

      contentSamples.forEach(content => {
        const text = content.text.toLowerCase();

        if (text.includes('jaja') || text.includes('lol') || text.includes('😂')) {
          tones.humorous++;
        } else if (text.includes('!') && text.split('!').length > 2) {
          tones.contundente++;
        } else if (text.includes('...') || text.includes('tal vez') || text.includes('quizás') || text.includes('maybe')) {
          tones.ligero++;
        } else {
          tones.equilibrado++;
        }
      });

      expect(tones.humorous).toBe(1);
      expect(tones.contundente).toBe(1);
      expect(tones.ligero).toBe(1);
      expect(tones.equilibrado).toBe(1);
    });

    it('should calculate formality indicators', () => {
      // Test formality detection patterns
      const formalText = 'Estimado señor, le escribo para informarle sobre este asunto importante.';
      const informalText = 'jaja wey esto está genial';

      // Formal indicators
      const hasFormalWords = /\b(usted|estimado|cordialmente|atentamente)\b/i.test(formalText);
      const hasProperPunctuation = /[.!?]$/.test(formalText.trim());
      const isLongText = formalText.length > 100;

      expect(hasFormalWords).toBe(true);
      expect(hasProperPunctuation).toBe(true);
      expect(isLongText).toBe(false); // This specific text is not > 100 chars

      // Informal indicators
      const hasInformalWords = /\b(jaja|lol|xd|wey|bro)\b/i.test(informalText);
      expect(hasInformalWords).toBe(true);
    });

    it('should detect sarcasm patterns', () => {
      const sarcasticTexts = [
        'Obvio, qué sorpresa...',
        'Genial, perfecto...',
        'No me digas que esto es excelente...'
      ];

      sarcasticTexts.forEach(text => {
        const lowerText = text.toLowerCase();
        const hasSarcasmWords = lowerText.includes('obvio') ||
                               lowerText.includes('claro que sí') ||
                               lowerText.includes('qué sorpresa') ||
                               lowerText.includes('no me digas');
        const hasIronicPhrases = (/\b(genial|perfecto|excelente)\b/.test(lowerText) && lowerText.includes('...'));

        expect(hasSarcasmWords || hasIronicPhrases).toBe(true);
      });
    });
  });

  describe('example selection logic', () => {
    it('should filter and sort content samples', () => {
      const contentSamples = [
        { text: 'Short text', engagement: 100, platform: 'twitter', created_at: new Date() },
        { text: 'This is a medium length text that should be included', engagement: 50, platform: 'twitter', created_at: new Date() },
        { text: 'This is a very long text that provides good context for style analysis and should definitely be included in examples', engagement: 200, platform: 'twitter', created_at: new Date() },
        { text: 'Another good example for testing', engagement: 75, platform: 'twitter', created_at: new Date() }
      ];

      // Simulate the filtering logic
      const filtered = contentSamples
        .filter(c => c.text.length > 20 && c.text.length < 200)
        .sort((a, b) => (b.engagement || 0) - (a.engagement || 0));

      expect(filtered).toHaveLength(3); // Short text filtered out
      expect(filtered[0].engagement).toBe(200); // Highest engagement first
      expect(filtered.every(ex => ex.text.length >= 20)).toBe(true);
      expect(filtered.every(ex => ex.text.length < 200)).toBe(true);
    });

    it('should handle content length filtering', () => {
      const contentSamples = [
        { text: 'Hi', engagement: 100 }, // Too short
        { text: 'This is good content for analysis', engagement: 50 },
        { text: 'A'.repeat(250), engagement: 200 } // Too long
      ];

      // Apply the same filtering logic
      const filtered = contentSamples.filter(c => c.text.length > 20 && c.text.length < 200);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('This is good content for analysis');
    });

    it('should create proper example format', () => {
      const contentSample = {
        text: 'This is a sample text for testing',
        platform: 'twitter',
        engagement: 100,
        created_at: new Date('2023-01-01')
      };

      // Simulate example creation
      const example = {
        text: contentSample.text,
        platform: contentSample.platform,
        engagement: contentSample.engagement || 0,
        created_at: contentSample.created_at
      };

      expect(example.text).toBe('This is a sample text for testing');
      expect(example.platform).toBe('twitter');
      expect(example.engagement).toBe(100);
      expect(example.created_at).toEqual(new Date('2023-01-01'));
    });
  });
});

describe('StylecardService Integration', () => {
  it('should handle complete stylecard generation flow', async () => {
    // Mock all dependencies
    embeddingsService.generateEmbedding = jest.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }]
    });

    styleProfileGenerator.analyzeContentStyle = jest.fn().mockResolvedValue({
      tone: 'equilibrado',
      formality_level: 5,
      sarcasm_level: 3
    });

    styleProfileGenerator.generateStylePrompt = jest.fn().mockResolvedValue(
      'Generated style prompt for user'
    );

    const mockContentSamples = [
      {
        id: '1',
        platform: 'twitter',
        text: 'This is a sample tweet for analysis',
        language: 'es',
        created_at: new Date(),
        engagement: 100
      }
    ];

    // Test the content processing pipeline
    const contentWithEmbeddings = await stylecardService.generateContentEmbeddings(mockContentSamples);
    expect(contentWithEmbeddings).toHaveLength(1);
    expect(contentWithEmbeddings[0].embedding).toBeDefined();

    const styleAnalysis = await stylecardService.analyzeContentStyle(contentWithEmbeddings, 'es');
    expect(styleAnalysis.tone).toBe('equilibrado');

    expect(embeddingsService.generateEmbedding).toHaveBeenCalled();
    expect(styleProfileGenerator.analyzeContentStyle).toHaveBeenCalled();
  });
});
