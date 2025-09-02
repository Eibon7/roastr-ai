/**
 * Tests for RQCService - 3 parallel reviewers system
 */

const RQCService = require('../../../src/services/rqcService');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn()
  }
}));

describe('RQCService', () => {
  let rqcService;
  let mockOpenAI;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    
    rqcService = new RQCService(mockOpenAI);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Main Review Process', () => {
    it('should run all 3 reviewers in parallel', async () => {
      // Mock all 3 reviewers to pass
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: 'PASS' } }] }) // Moderator
        .mockResolvedValueOnce({ choices: [{ message: { content: 'PASS' } }] }) // Comedian
        .mockResolvedValueOnce({ choices: [{ message: { content: 'PASS' } }] }); // Style

      const result = await rqcService.reviewRoast({
        originalComment: 'Your jokes are terrible',
        roastText: 'At least they\'re better than your taste in comments!',
        userConfig: {
          user_id: 'test-user',
          intensity_level: 3,
          custom_style_prompt: null
        },
        attempt: 1
      });

      expect(result.decision).toBe('approved');
      expect(result.moderatorPass).toBe(true);
      expect(result.comedianPass).toBe(true);
      expect(result.stylePass).toBe(true);
      expect(result.decisionReason).toBe('Los 3 revisores aprobaron el roast');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it('should provide detailed review metrics', async () => {
      mockOpenAI.chat.completions.create
        .mockResolvedValue({ choices: [{ message: { content: 'PASS' } }] });

      const result = await rqcService.reviewRoast({
        originalComment: 'Test comment',
        roastText: 'Test roast',
        userConfig: { user_id: 'test-user', intensity_level: 4 },
        attempt: 1
      });

      expect(result).toHaveProperty('reviewDuration');
      expect(result).toHaveProperty('tokensUsed');
      expect(result).toHaveProperty('costCents');
      expect(typeof result.reviewDuration).toBe('number');
      expect(typeof result.tokensUsed).toBe('number');
      expect(typeof result.costCents).toBe('number');
    });
  });

  describe('Moderator Reviewer', () => {
    it('should pass compliant roast', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      const result = await rqcService.runModerator(
        'Your style is questionable',
        'At least I have one!',
        { intensity_level: 3 }
      );

      expect(result.verdict).toBe('pass');
      expect(result.reason).toBeNull();
    });

    it('should fail roast with moderation issues', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'FAIL\nContains inappropriate language for platform guidelines' } }]
      });

      const result = await rqcService.runModerator(
        'Test comment',
        'Inappropriate roast content',
        { intensity_level: 2 }
      );

      expect(result.verdict).toBe('fail');
      expect(result.reason).toBe('Contains inappropriate language for platform guidelines');
    });

    it('should include intensity level in prompt', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      await rqcService.runModerator(
        'Test',
        'Test roast',
        { intensity_level: 5 }
      );

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('NIVEL DE INTENSIDAD DEL USUARIO: 5/5');
    });

    it('should handle moderator API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await rqcService.runModerator('Test', 'Test', { intensity_level: 3 });

      expect(result.verdict).toBe('fail');
      expect(result.reason).toBe('Error en revisión de moderación');
      expect(result.tokensUsed).toBe(0);
    });
  });

  describe('Comedian Reviewer', () => {
    it('should pass funny and punchy roast', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      const result = await rqcService.runComedian(
        'I think I\'m funny',
        'Your mirror disagrees!',
        { intensity_level: 4 }
      );

      expect(result.verdict).toBe('pass');
    });

    it('should fail generic or unfunny roast', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'FAIL\nToo generic, lacks creativity and punch' } }]
      });

      const result = await rqcService.runComedian(
        'Test',
        'You are wrong',
        { intensity_level: 3 }
      );

      expect(result.verdict).toBe('fail');
      expect(result.reason).toBe('Too generic, lacks creativity and punch');
    });

    it('should adjust expectations based on intensity level', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      await rqcService.runComedian('Test', 'Test roast', { intensity_level: 2 });

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('Para nivel 2/5, ajusta expectativas');
    });
  });

  describe('Style Reviewer', () => {
    it('should pass roast that matches default style', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      const result = await rqcService.runStyleReviewer(
        'You have no style',
        'Unlike you, I don\'t get my fashion tips from a scarecrow!',
        { intensity_level: 4, custom_style_prompt: null }
      );

      expect(result.verdict).toBe('pass');
    });

    it('should use custom style prompt when configured and flag is enabled', async () => {
      // Mock the flags module
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled = jest.fn().mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return true;
        return false;
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      const customPrompt = 'Use intellectual humor with literary references';

      await rqcService.runStyleReviewer(
        'Test',
        'Test roast',
        {
          intensity_level: 3,
          custom_style_prompt: customPrompt
        }
      );

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain(customPrompt);
      expect(callArgs.messages[1].content).toContain('ESTILO PERSONALIZADO CONFIGURADO');
    });

    it('should NOT use custom style prompt when flag is disabled', async () => {
      // Mock the flags module
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled = jest.fn().mockImplementation((flag) => {
        if (flag === 'ENABLE_CUSTOM_PROMPT') return false;
        return false;
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      const customPrompt = 'Use intellectual humor with literary references';

      await rqcService.runStyleReviewer(
        'Test',
        'Test roast',
        {
          intensity_level: 3,
          custom_style_prompt: customPrompt
        }
      );

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).not.toContain(customPrompt);
      expect(callArgs.messages[1].content).not.toContain('ESTILO PERSONALIZADO CONFIGURADO');
      expect(callArgs.messages[1].content).toContain('ESTILO ESTÁNDAR');
    });

    it('should fail roast that doesn\'t match configured style', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'FAIL\nDoesn\'t match the sophisticated tone requested' } }]
      });

      const result = await rqcService.runStyleReviewer(
        'Test',
        'Basic roast',
        { intensity_level: 5, custom_style_prompt: 'Sophisticated academic humor' }
      );

      expect(result.verdict).toBe('fail');
      expect(result.reason).toBe('Doesn\'t match the sophisticated tone requested');
    });
  });

  describe('RQC Decision Logic', () => {
    it('should approve with 3 passes', () => {
      const decision = rqcService.makeRQCDecision(
        { verdict: 'pass' },
        { verdict: 'pass' },
        { verdict: 'pass' }
      );

      expect(decision.action).toBe('approved');
      expect(decision.reason).toBe('Los 3 revisores aprobaron el roast');
    });

    it('should approve with 2 passes (moderator pass)', () => {
      const decision = rqcService.makeRQCDecision(
        { verdict: 'pass' },
        { verdict: 'pass' },
        { verdict: 'fail', reason: 'Style issue' }
      );

      expect(decision.action).toBe('approved');
      expect(decision.reason).toBe('2 de 3 revisores aprobaron (moderador OK)');
    });

    it('should regenerate when moderator fails (non-negotiable)', () => {
      const decision = rqcService.makeRQCDecision(
        { verdict: 'fail', reason: 'Platform violation' },
        { verdict: 'pass' },
        { verdict: 'pass' }
      );

      expect(decision.action).toBe('regenerate');
      expect(decision.reason).toContain('Moderador rechazó');
      expect(decision.reason).toContain('Platform violation');
    });

    it('should regenerate with less than 2 passes', () => {
      const decision = rqcService.makeRQCDecision(
        { verdict: 'pass' },
        { verdict: 'fail', reason: 'Not funny enough' },
        { verdict: 'fail', reason: 'Wrong style' }
      );

      expect(decision.action).toBe('regenerate');
      expect(decision.reason).toContain('Comediante: Not funny enough');
      expect(decision.reason).toContain('Estilo: Wrong style');
    });

    it('should handle mixed fail scenarios', () => {
      const decision = rqcService.makeRQCDecision(
        { verdict: 'pass' },
        { verdict: 'fail', reason: 'Lacks punch' },
        { verdict: 'pass' }
      );

      expect(decision.action).toBe('approved'); // 2 passes, moderator OK
    });
  });

  describe('Performance and Optimization', () => {
    it('should estimate tokens accurately', () => {
      const shortText = 'Hello';
      const longText = 'This is a much longer text that should result in more estimated tokens for the calculation';

      const shortTokens = rqcService.estimateTokens(shortText);
      const longTokens = rqcService.estimateTokens(longText);

      expect(shortTokens).toBeLessThan(longTokens);
      expect(shortTokens).toBe(Math.ceil(shortText.length / 4));
      expect(longTokens).toBe(Math.ceil(longText.length / 4));
    });

    it('should run reviewers in parallel (performance check)', async () => {
      const startTime = Date.now();
      
      // Mock each reviewer to take some time
      mockOpenAI.chat.completions.create.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ choices: [{ message: { content: 'PASS' } }] }), 100)
        )
      );

      await rqcService.reviewRoast({
        originalComment: 'Test',
        roastText: 'Test roast',
        userConfig: { user_id: 'test', intensity_level: 3 },
        attempt: 1
      });

      const duration = Date.now() - startTime;
      
      // Should be closer to 100ms (parallel) than 300ms (sequential)
      // Allow some overhead but should be significantly less than 250ms
      expect(duration).toBeLessThan(250);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle partial reviewer failures', async () => {
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Moderator API error'))
        .mockResolvedValueOnce({ choices: [{ message: { content: 'PASS' } }] }) // Comedian
        .mockResolvedValueOnce({ choices: [{ message: { content: 'PASS' } }] }); // Style

      const result = await rqcService.reviewRoast({
        originalComment: 'Test',
        roastText: 'Test roast',
        userConfig: { user_id: 'test', intensity_level: 3 },
        attempt: 1
      });

      expect(result.moderatorPass).toBe(false);
      expect(result.moderatorReason).toBe('Error en revisión de moderación');
      expect(result.comedianPass).toBe(true);
      expect(result.stylePass).toBe(true);
      expect(result.decision).toBe('regenerate'); // Moderator fail = regenerate
    });

    it('should handle complete review failure', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Complete API failure'));

      const result = await rqcService.reviewRoast({
        originalComment: 'Test',
        roastText: 'Test roast',
        userConfig: { user_id: 'test', intensity_level: 3 },
        attempt: 1
      });

      expect(result.moderatorPass).toBe(false);
      expect(result.comedianPass).toBe(false);
      expect(result.stylePass).toBe(false);
      expect(result.decision).toBe('regenerate');
    });
  });

  describe('Configuration Integration', () => {
    it('should handle different intensity levels appropriately', async () => {
      const configs = [
        { intensity_level: 1 },
        { intensity_level: 3 },
        { intensity_level: 5 }
      ];

      for (const config of configs) {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{ message: { content: 'PASS' } }]
        });

        await rqcService.runModerator('Test', 'Test roast', config);
        
        const lastCall = mockOpenAI.chat.completions.create.mock.calls.slice(-1)[0][0];
        expect(lastCall.messages[1].content).toContain(`NIVEL DE INTENSIDAD DEL USUARIO: ${config.intensity_level}/5`);
      }
    });

    it('should use low temperature for consistent moderation', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'PASS' } }]
      });

      await rqcService.runModerator('Test', 'Test', { intensity_level: 3 });

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.temperature).toBe(0.1); // Low temperature for consistency
    });
  });
});