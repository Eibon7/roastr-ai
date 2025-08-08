/**
 * Tests for RoastGeneratorEnhanced with RQC system
 * 
 * Note: RQC is disabled by default in tests (ENABLE_RQC=false)
 * Advanced RQC tests are skipped until feature is enabled
 */

const RoastGeneratorEnhanced = require('../../../src/services/roastGeneratorEnhanced');
const RQCService = require('../../../src/services/rqcService');

// Mock dependencies
jest.mock('../../../src/services/rqcService');
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    rpc: jest.fn()
  }
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock process.env
process.env.OPENAI_API_KEY = 'test-key';

// Mock OpenAI before any requires
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

describe('RoastGeneratorEnhanced', () => {
  let generator;
  let mockRQCService;
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock OpenAI instance
    const OpenAI = require('openai');
    mockOpenAI = new OpenAI();
    
    generator = new RoastGeneratorEnhanced();
    mockRQCService = new RQCService(mockOpenAI);
    generator.rqcService = mockRQCService;
    generator.openai = mockOpenAI;
  });

  describe('Plan-based Roast Generation', () => {
    it('should use basic moderation for Free plan', async () => {
      // Mock user config fetch
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'free',
        rqc_enabled: false,
        intensity_level: 3,
        custom_style_prompt: null,
        max_regenerations: 0,
        basic_moderation_enabled: true,
        advanced_review_enabled: false,
        user_id: 'user-123'
      });

      // Mock OpenAI response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Nice try, but my grandma tells better jokes! 😄' } }]
      });

      const result = await generator.generateRoast(
        'Your jokes are terrible',
        0.3,
        'sarcastic',
        { userId: 'user-123', plan: 'free' }
      );

      expect(result.plan).toBe('free');
      expect(result.rqcEnabled).toBe(false);
      expect(result.method).toBe('basic_moderation');
      expect(result.roast).toContain('grandma');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should use basic moderation for Pro plan', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'pro',
        rqc_enabled: false,
        intensity_level: 4,
        custom_style_prompt: null,
        max_regenerations: 0,
        basic_moderation_enabled: true,
        advanced_review_enabled: false,
        user_id: 'user-456'
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Pro-level roast here! 🔥' } }]
      });

      const result = await generator.generateRoast(
        'Test comment',
        0.5,
        'direct',
        { userId: 'user-456', plan: 'pro' }
      );

      expect(result.plan).toBe('pro');
      expect(result.rqcEnabled).toBe(false);
      expect(result.method).toBe('basic_moderation');
    });

    it('should use basic moderation for Creator+ plan when RQC globally disabled', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'creator_plus',
        rqc_enabled: true,
        intensity_level: 5,
        custom_style_prompt: 'Custom creative style',
        max_regenerations: 3,
        basic_moderation_enabled: false,
        advanced_review_enabled: true,
        user_id: 'user-789'
      });

      // Mock basic roast generation (since RQC is globally disabled)
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Basic moderation roast content' } }]
      });

      const result = await generator.generateRoast(
        'Complex roast request',
        0.7,
        'sarcastic',
        { userId: 'user-789', plan: 'creator_plus' }
      );

      expect(result.plan).toBe('creator_plus');
      expect(result.rqcEnabled).toBe(false); // False because RQC globally disabled
      expect(result.method).toBe('basic_moderation'); // Falls back to basic moderation
      expect(result.roast).toBe('Basic moderation roast content');
      expect(result.tokensUsed).toBeGreaterThan(0);
      // RQC service should NOT be called when globally disabled
      expect(mockRQCService.reviewRoast).not.toHaveBeenCalled();
    });
  });

  describe.skip('RQC Approval Logic (requires ENABLE_RQC=true)', () => {
    beforeEach(() => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'creator_plus',
        rqc_enabled: true,
        intensity_level: 4,
        custom_style_prompt: null,
        max_regenerations: 3,
        basic_moderation_enabled: false,
        advanced_review_enabled: true,
        user_id: 'user-creator'
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Test roast content' } }]
      });

      generator.logRQCReview = jest.fn().mockResolvedValue();
    });

    it('should approve roast with 3 green reviewers', async () => {
      mockRQCService.reviewRoast.mockResolvedValue({
        decision: 'approved',
        moderatorPass: true,
        comedianPass: true,
        stylePass: true,
        tokensUsed: 120,
        costCents: 25,
        reviewDuration: 1200
      });

      const result = await generator.generateRoast('Test', 0.5, 'sarcastic', {
        userId: 'user-creator'
      });

      expect(result.approved).toBe(true);
      expect(result.attempt).toBe(1);
    });

    it('should approve roast with 2 green reviewers (no moderator fail)', async () => {
      mockRQCService.reviewRoast.mockResolvedValue({
        decision: 'approved',
        moderatorPass: true,
        comedianPass: true,
        stylePass: false,
        styleReason: 'Style not quite right',
        tokensUsed: 130,
        costCents: 27,
        reviewDuration: 1300
      });

      const result = await generator.generateRoast('Test', 0.5, 'sarcastic', {
        userId: 'user-creator'
      });

      expect(result.approved).toBe(true);
      expect(result.attempt).toBe(1);
    });

    it('should regenerate when moderator fails', async () => {
      mockRQCService.reviewRoast
        .mockResolvedValueOnce({
          decision: 'regenerate',
          moderatorPass: false,
          moderatorReason: 'Too aggressive for platform',
          comedianPass: true,
          stylePass: true,
          tokensUsed: 140,
          costCents: 30,
          reviewDuration: 1100
        })
        .mockResolvedValueOnce({
          decision: 'approved',
          moderatorPass: true,
          comedianPass: true,
          stylePass: true,
          tokensUsed: 130,
          costCents: 25,
          reviewDuration: 1000
        });

      // Mock multiple roast generations
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: 'First attempt roast' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Second attempt roast' } }] });

      const result = await generator.generateRoast('Test', 0.5, 'sarcastic', {
        userId: 'user-creator'
      });

      expect(result.approved).toBe(true);
      expect(result.attempt).toBe(2);
      expect(mockRQCService.reviewRoast).toHaveBeenCalledTimes(2);
    });

    it('should use fallback after max regeneration attempts', async () => {
      // Mock all attempts fail
      mockRQCService.reviewRoast.mockResolvedValue({
        decision: 'regenerate',
        moderatorPass: false,
        moderatorReason: 'Consistently fails moderation',
        comedianPass: true,
        stylePass: true,
        tokensUsed: 140,
        costCents: 30,
        reviewDuration: 1000
      });

      // Mock roast generation for attempts + fallback
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Attempt 1' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Attempt 2' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Attempt 3' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Safe fallback roast' } }] });

      const result = await generator.generateRoast('Test', 0.5, 'sarcastic', {
        userId: 'user-creator'
      });

      expect(result.approved).toBe(false);
      expect(result.method).toBe('fallback_after_rqc');
      expect(result.roast).toBe('Safe fallback roast');
      expect(mockRQCService.reviewRoast).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cost Control and Optimization', () => {
    it('should not make extra GPT calls for Free plan', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'free',
        basic_moderation_enabled: true,
        advanced_review_enabled: false
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Free plan roast' } }]
      });

      await generator.generateRoast('Test', 0.3, 'sarcastic', {
        userId: 'user-free', plan: 'free'
      });

      // Only 1 call for the roast generation (basic moderation in same prompt)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should not make extra GPT calls for Pro plan', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'pro',
        basic_moderation_enabled: true,
        advanced_review_enabled: false
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Pro plan roast' } }]
      });

      await generator.generateRoast('Test', 0.4, 'subtle', {
        userId: 'user-pro', plan: 'pro'
      });

      // Only 1 call for the roast generation (basic moderation in same prompt)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it.skip('should track tokens and costs for Creator+ RQC (requires ENABLE_RQC=true)', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'creator_plus',
        advanced_review_enabled: true,
        max_regenerations: 1
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Creator+ roast' } }]
      });

      mockRQCService.reviewRoast.mockResolvedValue({
        decision: 'approved',
        moderatorPass: true,
        comedianPass: true,
        stylePass: true,
        tokensUsed: 200, // RQC review tokens
        costCents: 40,
        reviewDuration: 1500
      });

      generator.logRQCReview = jest.fn().mockResolvedValue();

      const result = await generator.generateRoast('Test', 0.6, 'direct', {
        userId: 'user-creator+'
      });

      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.costCents).toBeGreaterThan(0);
      expect(typeof result.processingTime).toBe('number');
    });
  });

  describe('Fallback and Error Handling', () => {
    it('should fallback to safe roast on OpenAI error', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'free',
        basic_moderation_enabled: true
      });

      // First call fails, second call (fallback) succeeds
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('OpenAI API error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Safe fallback response' } }]
        });

      const result = await generator.generateRoast('Test', 0.3, 'sarcastic', {
        userId: 'user-test'
      });

      expect(result.method).toBe('fallback');
      expect(result.roast).toBe('Safe fallback response');
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      generator.getUserRQCConfig = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Default roast' } }]
      });

      const result = await generator.generateRoast('Test', 0.3, 'sarcastic', {
        userId: 'user-error'
      });

      // Should still work with default config
      expect(result.roast).toBe('Default roast');
      expect(result.plan).toBe('free'); // Default fallback
    });
  });

  describe('Basic Moderation Prompts', () => {
    it('should include intensity level in basic moderation prompt', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'pro',
        intensity_level: 4,
        basic_moderation_enabled: true,
        advanced_review_enabled: false
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Moderated roast' } }]
      });

      await generator.generateRoast('Test comment', 0.5, 'sarcastic', {
        userId: 'user-intensity'
      });

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemPrompt = callArgs.messages[0].content;
      
      expect(systemPrompt).toContain('Nivel de intensidad: 4/5');
      expect(systemPrompt).toContain('Plan: pro');
      expect(systemPrompt).toContain('políticas de contenido');
    });

    it('should customize prompt based on tone', async () => {
      generator.getUserRQCConfig = jest.fn().mockResolvedValue({
        plan: 'free',
        intensity_level: 2,
        basic_moderation_enabled: true
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Subtle roast' } }]
      });

      await generator.generateRoast('Test', 0.3, 'subtle', {
        userId: 'user-subtle'
      });

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemPrompt = callArgs.messages[0].content;
      
      expect(systemPrompt).toContain('Ironía sofisticada');
    });
  });
});