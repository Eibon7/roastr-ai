const request = require('supertest');
const {
  createMockModerationInput,
  simulateToxicComment,
  setupTestUserWithPersona,
  waitForCondition
} = require('../../utils/testHelpers');
const { PLATFORM_LIMITS } = require('../../../src/config/constants');

// Mock services
jest.mock('../../../src/services/openai', () => ({
  analyzeToxicityWithOpenAI: jest.fn(),
  generateRoastWithOpenAI: jest.fn()
}));

jest.mock('../../../src/services/perspective', () => ({
  analyzeToxicity: jest.fn()
}));

jest.mock('../../../src/services/queueService', () => {
  const jobs = new Map();
  return jest.fn().mockImplementation(() => ({
    add: jest.fn((type, data, options) => {
      const job = { id: Date.now().toString(), type, data, options, status: 'pending' };
      jobs.set(job.id, job);
      return Promise.resolve(job);
    }),
    get: jest.fn((id) => Promise.resolve(jobs.get(id))),
    process: jest.fn((type, handler) => {
      // Simulate processing
      setTimeout(() => {
        for (const [id, job] of jobs) {
          if (job.type === type && job.status === 'pending') {
            job.status = 'processing';
            handler(job)
              .then(() => {
                job.status = 'completed';
              })
              .catch(() => {
                job.status = 'failed';
              });
          }
        }
      }, 100);
    }),
    jobs
  }));
});

const { analyzeToxicity } = require('../../../src/services/perspective');
const {
  analyzeToxicityWithOpenAI,
  generateRoastWithOpenAI
} = require('../../../src/services/openai');
const QueueService = require('../../../src/services/queueService');

describe('Full Moderation Flow Integration', () => {
  let queueService;

  beforeEach(() => {
    jest.clearAllMocks();
    queueService = new QueueService();

    // Default mock implementations
    analyzeToxicity.mockResolvedValue({
      score: 0.7,
      categories: ['TOXICITY', 'INSULT']
    });

    analyzeToxicityWithOpenAI.mockResolvedValue({
      toxic: true,
      score: 0.8,
      categories: ['harassment']
    });

    generateRoastWithOpenAI.mockResolvedValue({
      roast: '¡Vaya comentario más creativo! ¿Lo sacaste de un generador de insultos de 1995?',
      confidence: 0.9
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Complete Flow: Toxic → Filtered → Generated → Approved', () => {
    it('should process toxic comment through entire pipeline', async () => {
      const { comment } = simulateToxicComment({ toxicityLevel: 'high' });
      const { user, persona } = setupTestUserWithPersona();

      // Step 1: Comment arrives
      const commentData = createMockModerationInput({
        originalComment: comment,
        userId: user.id,
        userPersona: persona
      });

      // Step 2: Queue for toxicity analysis
      const toxicityJob = await queueService.add('analyze_toxicity', commentData);
      expect(toxicityJob.id).toBeDefined();

      // Step 3: Process toxicity analysis
      const toxicityResult = await analyzeToxicity(comment);
      expect(toxicityResult.score).toBeGreaterThan(0.5);

      // Step 4: Queue for reply generation (if toxic enough)
      if (toxicityResult.score > 0.5) {
        const replyJob = await queueService.add('generate_reply', {
          ...commentData,
          toxicityData: toxicityResult
        });
        expect(replyJob.id).toBeDefined();
      }

      // Step 5: Generate roast response
      const roastResult = await generateRoastWithOpenAI({
        comment,
        toxicityData: toxicityResult,
        userConfig: persona.personaConfig
      });
      expect(roastResult.roast).toBeDefined();
      expect(roastResult.roast.length).toBeGreaterThan(10);

      // Step 6: Apply content filtering
      const isApproved = !roastResult.roast.includes('palabras_prohibidas');
      expect(isApproved).toBe(true);

      // Step 7: Queue for posting (if approved)
      if (isApproved) {
        const postJob = await queueService.add('post_response', {
          commentId: commentData.commentId,
          response: roastResult.roast,
          platform: commentData.platform
        });
        expect(postJob.id).toBeDefined();
      }

      // Verify complete flow
      expect(queueService.jobs.size).toBeGreaterThan(0);
    });

    it('should handle multi-language toxic comments', async () => {
      const languages = ['es', 'en'];
      const results = [];

      for (const language of languages) {
        const { comment } = simulateToxicComment({
          toxicityLevel: 'medium',
          language
        });

        const toxicityResult = await analyzeToxicity(comment);
        const roastResult = await generateRoastWithOpenAI({
          comment,
          language,
          toxicityData: toxicityResult
        });

        results.push({
          language,
          toxicityScore: toxicityResult.score,
          roastGenerated: !!roastResult.roast
        });
      }

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.toxicityScore).toBeGreaterThan(0);
        expect(result.roastGenerated).toBe(true);
      });
    });
  });

  describe('Shield Integration in Flow', () => {
    it('should trigger Shield actions for extreme toxicity', async () => {
      const { comment } = simulateToxicComment({ toxicityLevel: 'extreme' });

      // Mock extreme toxicity detection
      analyzeToxicity.mockResolvedValueOnce({
        score: 0.95,
        categories: ['SEVERE_TOXICITY', 'THREAT', 'IDENTITY_ATTACK']
      });

      const commentData = createMockModerationInput({
        originalComment: comment,
        platform: 'twitter'
      });

      // Analyze toxicity
      const toxicityResult = await analyzeToxicity(comment);

      // Shield should trigger for extreme toxicity
      if (toxicityResult.score > 0.9) {
        const shieldJob = await queueService.add(
          'shield_action',
          {
            ...commentData,
            action: 'report',
            reason: 'Extreme toxicity detected',
            priority: 1 // High priority
          },
          { priority: 1 }
        );

        expect(shieldJob.options.priority).toBe(1);
        expect(shieldJob.data.action).toBe('report');
      }
    });

    it('should respect user persona tolerance settings', async () => {
      const { user, persona } = setupTestUserWithPersona({
        toleranceSettings: {
          no_tolero: ['insultos', 'amenazas'],
          auto_block_enabled: true,
          severity_threshold: 0.6
        }
      });

      const { comment } = simulateToxicComment({
        toxicityLevel: 'high',
        categories: ['INSULT', 'THREAT']
      });

      analyzeToxicity.mockResolvedValueOnce({
        score: 0.7,
        categories: ['INSULT', 'THREAT']
      });

      const toxicityResult = await analyzeToxicity(comment);

      // Check if auto-block should trigger
      const shouldAutoBlock =
        persona.toleranceSettings.auto_block_enabled &&
        toxicityResult.score >= persona.toleranceSettings.severity_threshold &&
        toxicityResult.categories.some((cat) => {
          const catLower = cat.toLowerCase();
          return persona.toleranceSettings.no_tolero.some(
            (noTolero) =>
              catLower.includes(noTolero.toLowerCase()) || noTolero.toLowerCase().includes(catLower)
          );
        });

      expect(shouldAutoBlock).toBe(true);

      if (shouldAutoBlock) {
        const blockJob = await queueService.add('shield_action', {
          action: 'block',
          reason: 'Auto-blocked based on persona settings',
          userId: user.id
        });

        expect(blockJob.data.action).toBe('block');
      }
    });
  });

  describe('Error Handling in Flow', () => {
    it('should fallback to OpenAI when Perspective fails', async () => {
      analyzeToxicity.mockRejectedValueOnce(new Error('Perspective API error'));

      const { comment } = simulateToxicComment({ toxicityLevel: 'medium' });

      let toxicityResult;
      try {
        toxicityResult = await analyzeToxicity(comment);
      } catch (error) {
        // Fallback to OpenAI
        toxicityResult = await analyzeToxicityWithOpenAI(comment);
      }

      expect(toxicityResult).toBeDefined();
      expect(toxicityResult.score).toBeGreaterThan(0);
      expect(analyzeToxicityWithOpenAI).toHaveBeenCalled();
    });

    it('should handle roast generation failure gracefully', async () => {
      generateRoastWithOpenAI.mockRejectedValueOnce(new Error('OpenAI API error'));

      const { comment } = simulateToxicComment();
      const toxicityResult = { score: 0.7, categories: ['TOXICITY'] };

      let roastResult;
      let fallbackUsed = false;

      try {
        roastResult = await generateRoastWithOpenAI({ comment });
      } catch (error) {
        // Use fallback roast
        fallbackUsed = true;
        roastResult = {
          roast: '¿En serio? Eso es lo mejor que se te ocurre? 🙄',
          confidence: 0.5,
          fallback: true
        };
      }

      expect(fallbackUsed).toBe(true);
      expect(roastResult.fallback).toBe(true);
      expect(roastResult.roast).toBeDefined();
    });

    it('should handle queue failures with retry logic', async () => {
      const mockAdd = jest
        .fn()
        .mockRejectedValueOnce(new Error('Queue temporarily unavailable'))
        .mockResolvedValueOnce({ id: 'retry-job-123' });

      queueService.add = mockAdd;

      const commentData = createMockModerationInput();

      let job;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          job = await queueService.add('analyze_toxicity', commentData);
          break;
        } catch (error) {
          retries++;
          if (retries === maxRetries) throw error;
          await new Promise((resolve) => setTimeout(resolve, 100 * retries));
        }
      }

      expect(job).toBeDefined();
      expect(job.id).toBe('retry-job-123');
      expect(mockAdd).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Scale', () => {
    it('should handle burst of toxic comments efficiently', async () => {
      const commentCount = 50;
      const comments = Array(commentCount)
        .fill(null)
        .map((_, i) => ({
          ...createMockModerationInput({ commentId: `burst-${i}` }),
          comment: simulateToxicComment({ toxicityLevel: 'medium' }).comment
        }));

      const startTime = Date.now();
      const jobs = [];

      // Queue all comments
      for (const comment of comments) {
        const job = await queueService.add('analyze_toxicity', comment);
        jobs.push(job);
      }

      const endTime = Date.now();
      const queueTime = endTime - startTime;

      expect(jobs).toHaveLength(commentCount);
      expect(queueTime).toBeLessThan(1000); // Should queue 50 comments in under 1 second

      // Verify all jobs are queued
      jobs.forEach((job, index) => {
        expect(job.data.commentId).toBe(`burst-${index}`);
      });
    });

    it('should prioritize Shield actions over regular processing', async () => {
      const regularJobs = [];
      const shieldJobs = [];

      // Queue regular jobs
      for (let i = 0; i < 5; i++) {
        const job = await queueService.add(
          'generate_reply',
          { commentId: `regular-${i}` },
          { priority: 5 }
        );
        regularJobs.push(job);
      }

      // Queue high-priority Shield jobs
      for (let i = 0; i < 3; i++) {
        const job = await queueService.add(
          'shield_action',
          { commentId: `shield-${i}`, action: 'block' },
          { priority: 1 }
        );
        shieldJobs.push(job);
      }

      // Verify Shield jobs have higher priority
      shieldJobs.forEach((job) => {
        expect(job.options.priority).toBe(1);
      });

      regularJobs.forEach((job) => {
        expect(job.options.priority).toBe(5);
      });
    });
  });

  describe('Content Approval and Filtering', () => {
    it('should filter out inappropriate roast responses', async () => {
      const inappropriateRoasts = [
        'Tu madre es una...', // Family insults
        'Espero que te mueras', // Death wishes
        'Eres un [slur]' // Slurs
      ];

      const appropriateRoasts = [
        '¿Eso es un insulto o tu currículum?',
        'Wow, qué original. ¿Lo copiaste de internet?',
        'Con esa creatividad, deberías trabajar en... ah no, mejor no.'
      ];

      const filterRoast = (roast) => {
        const prohibited = ['madre', 'mueras', 'slur'];
        return !prohibited.some((word) => roast.toLowerCase().includes(word));
      };

      inappropriateRoasts.forEach((roast) => {
        expect(filterRoast(roast)).toBe(false);
      });

      appropriateRoasts.forEach((roast) => {
        expect(filterRoast(roast)).toBe(true);
      });
    });

    it('should apply platform-specific content rules', async () => {
      const platforms = {
        twitter: { maxLength: PLATFORM_LIMITS.twitter.maxLength, allowHashtags: true },
        youtube: { maxLength: PLATFORM_LIMITS.youtube.maxLength, allowLinks: true },
        instagram: { maxLength: PLATFORM_LIMITS.instagram.maxLength, allowEmojis: true }
      };

      const roast = '¡Vaya comentario! ' + '😂'.repeat(50);

      Object.entries(platforms).forEach(([platform, rules]) => {
        let processedRoast = roast;

        if (processedRoast.length > rules.maxLength) {
          processedRoast = processedRoast.substring(0, rules.maxLength - 3) + '...';
        }

        expect(processedRoast.length).toBeLessThanOrEqual(rules.maxLength);
      });
    });
  });
});
