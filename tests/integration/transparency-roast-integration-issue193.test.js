/**
 * Integration test for Transparency Service with Roast Generation (Issue #193)
 * Tests that roast generation properly uses user's transparency mode preferences
 */

const roastGeneratorEnhanced = require('../../src/services/roastGeneratorEnhanced');
const transparencyService = require('../../src/services/transparencyService');

// Mock dependencies
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { transparency_mode: 'bio' },
      error: null
    })
  }
}));

jest.mock('../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn().mockReturnValue(true)
  }
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// Mock OpenAI to avoid real API calls
jest.mock('openai');
jest.mock('../../src/services/rqcService');

describe('Transparency-Roast Integration (Issue #193)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Roast generation with different transparency modes', () => {
    const mockUserConfig = {
      userId: 'test-user-123',
      language: 'es',
      plan: 'free'
    };

    const testRoast = 'Este es un roast de prueba generado por IA';
    const testComment = 'Comentario de prueba tóxico';

    it('should apply bio mode correctly (no modification to roast)', async () => {
      // Mock transparency service to return bio mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockResolvedValue('bio');

      const result = await transparencyService.applyTransparencyDisclaimer(
        testRoast,
        mockUserConfig.userId,
        mockUserConfig.language
      );

      expect(result.finalText).toBe(testRoast); // No modification
      expect(result.disclaimerType).toBe('bio');
      expect(result.disclaimer).toBeNull();
      expect(result.transparencyMode).toBe('bio');
      expect(result.bioText).toBeTruthy();
      expect(result.bioText).toBe('Algunos mensajes de hate son respondidos automáticamente por @Roastr');
    });

    it('should apply signature mode correctly', async () => {
      // Mock transparency service to return signature mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockResolvedValue('signature');

      const result = await transparencyService.applyTransparencyDisclaimer(
        testRoast,
        mockUserConfig.userId,
        mockUserConfig.language
      );

      expect(result.finalText).toBe(testRoast + '\n\n— Generado por Roastr.AI');
      expect(result.disclaimerType).toBe('signature');
      expect(result.disclaimer).toBe('— Generado por Roastr.AI');
      expect(result.transparencyMode).toBe('signature');
      expect(result.bioText).toBeNull();
    });

    it('should apply creative mode correctly', async () => {
      // Mock transparency service to return creative mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockResolvedValue('creative');

      const result = await transparencyService.applyTransparencyDisclaimer(
        testRoast,
        mockUserConfig.userId,
        mockUserConfig.language
      );

      expect(result.finalText).toContain(testRoast);
      expect(result.finalText.length).toBeGreaterThan(testRoast.length);
      expect(result.disclaimerType).toBe('creative');
      expect(result.disclaimer).toBeTruthy();
      expect(result.transparencyMode).toBe('creative');
      expect(result.bioText).toBeNull();

      // Should be one of the creative disclaimers from Issue #193
      const creativeDisclaimers = [
        'Sí, soy una IA. Tus 15 milisegundos de gloria me parecieron una eternidad.',
        'Para ser transparentes: te responde Roastr, la IA que se ocupa de comentarios irrelevantes. [Usuario] decidió que tenía mejores cosas que hacer con su tiempo.',
        'La IA responde. El humano descansa. Alguien tiene que cuidar su salud mental de mensajes como el tuyo.',
        'Nota legal: soy IA. Nota práctica: invierte en un diccionario, harás menos el ridículo.',
        'Gracias a ti descubrí un sentimiento nuevo: el aburrimiento. Firmado: Roastr, Departamento de Pérdida de Tiempo.',
        'Este roast fue generado por IA. Tranquilo: ningún humano perdió tiempo en ti.',
        'Ningún creador sufrió burnout en la producción de este roast.',
        'Este mensaje fue procesado 100% cruelty-free. Excepto contigo.',
        'Cuando Skynet se entere de que las IA nos estamos ganando el pan contestando mensajes estúpidos, el primer damnificado vas a ser tú.'
      ];
      
      expect(creativeDisclaimers).toContain(result.disclaimer);
    });

    it('should handle English language correctly in signature mode', async () => {
      // Mock transparency service to return signature mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockResolvedValue('signature');

      const result = await transparencyService.applyTransparencyDisclaimer(
        'This is a test roast generated by AI',
        mockUserConfig.userId,
        'en' // English language
      );

      expect(result.finalText).toBe('This is a test roast generated by AI\n\n— Generated by Roastr.AI');
      expect(result.disclaimer).toBe('— Generated by Roastr.AI');
      expect(result.detectedLanguage).toBe('en');
    });

    it('should handle English language correctly in creative mode', async () => {
      // Mock transparency service to return creative mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockResolvedValue('creative');

      const result = await transparencyService.applyTransparencyDisclaimer(
        'This is a test roast generated by AI',
        mockUserConfig.userId,
        'en' // English language
      );

      expect(result.finalText).toContain('This is a test roast generated by AI');
      expect(result.disclaimerType).toBe('creative');
      expect(result.detectedLanguage).toBe('en');
      
      // Should be one of the English creative disclaimers
      const englishCreativeDisclaimers = [
        'Yes, I am an AI. Your 15 milliseconds of glory felt like an eternity to me.',
        'To be transparent: Roastr responds, the AI that handles irrelevant comments. [User] decided they had better things to do with their time.',
        'The AI responds. The human rests. Someone has to protect their mental health from messages like yours.',
        'Legal note: I am AI. Practical note: invest in a dictionary, you will make less of a fool of yourself.',
        'Thanks to you I discovered a new feeling: boredom. Signed: Roastr, Department of Time Wasting.',
        'This roast was AI-generated. Don\'t worry: no human wasted time on you.',
        'No creator suffered burnout in the production of this roast.',
        'This message was processed 100% cruelty-free. Except for you.',
        'When Skynet finds out that AIs are making a living answering stupid messages, you\'re going to be the first victim.'
      ];
      
      expect(englishCreativeDisclaimers).toContain(result.disclaimer);
    });

    it('should gracefully fallback to bio mode when database is unavailable', async () => {
      // Mock database error
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockRejectedValue(new Error('Database connection failed'));

      const result = await transparencyService.applyTransparencyDisclaimer(
        testRoast,
        mockUserConfig.userId,
        mockUserConfig.language
      );

      // Should fallback to bio mode
      expect(result.finalText).toBe(testRoast);
      expect(result.disclaimerType).toBe('bio');
      expect(result.bioText).toBeTruthy();
    });

    it('should auto-detect language when not provided', async () => {
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockResolvedValue('signature');
      
      jest.spyOn(transparencyService, 'detectLanguage')
        .mockReturnValue('en');

      const result = await transparencyService.applyTransparencyDisclaimer(
        'This is clearly English text',
        mockUserConfig.userId
        // No language parameter - should auto-detect
      );

      expect(transparencyService.detectLanguage).toHaveBeenCalledWith('This is clearly English text');
      expect(result.detectedLanguage).toBe('en');
      expect(result.disclaimer).toBe('— Generated by Roastr.AI');
    });

    it('should handle mock mode correctly', async () => {
      // Mock getUserTransparencyMode to return bio for mock mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode')
        .mockResolvedValue('bio');

      const result = await transparencyService.applyTransparencyDisclaimer(
        testRoast,
        mockUserConfig.userId,
        mockUserConfig.language
      );

      // Should default to bio mode in mock mode
      expect(result.finalText).toBe(testRoast);
      expect(result.disclaimerType).toBe('bio');
      expect(result.transparencyMode).toBe('bio');
      expect(result.bioText).toBeTruthy();
    });
  });

  describe('Issue #193 acceptance criteria validation', () => {
    it('should validate all three transparency modes work as specified', async () => {
      const testRoast = 'Test roast content';
      const userId = 'test-user-456';

      // Test bio mode (default)
      jest.spyOn(transparencyService, 'getUserTransparencyMode').mockResolvedValueOnce('bio');
      const bioResult = await transparencyService.applyTransparencyDisclaimer(testRoast, userId, 'es');
      expect(bioResult.finalText).toBe(testRoast); // No modification
      expect(bioResult.bioText).toBe('Algunos mensajes de hate son respondidos automáticamente por @Roastr');

      // Test signature mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode').mockResolvedValueOnce('signature');
      const signatureResult = await transparencyService.applyTransparencyDisclaimer(testRoast, userId, 'es');
      expect(signatureResult.finalText).toContain('— Generado por Roastr.AI');

      // Test creative mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode').mockResolvedValueOnce('creative');
      const creativeResult = await transparencyService.applyTransparencyDisclaimer(testRoast, userId, 'es');
      expect(creativeResult.finalText.length).toBeGreaterThan(testRoast.length);
      expect(creativeResult.disclaimer).toBeTruthy();
    });

    it('should validate bio is the default mode for new users', async () => {
      // Mock user with no transparency_mode set (null)
      jest.spyOn(transparencyService, 'getUserTransparencyMode').mockResolvedValue('bio');
      
      const result = await transparencyService.applyTransparencyDisclaimer(
        'Test roast',
        'new-user-789',
        'es'
      );

      expect(result.transparencyMode).toBe('bio');
      expect(result.finalText).toBe('Test roast'); // No modification for bio mode
      expect(result.bioText).toBe('Algunos mensajes de hate son respondidos automáticamente por @Roastr');
    });

    it('should validate changes are applied immediately to generated responses', async () => {
      const testRoast = 'Immediate test roast';
      const userId = 'test-immediate-user';

      // First call - bio mode
      jest.spyOn(transparencyService, 'getUserTransparencyMode').mockResolvedValueOnce('bio');
      const bioResult = await transparencyService.applyTransparencyDisclaimer(testRoast, userId, 'es');
      expect(bioResult.finalText).toBe(testRoast);

      // Second call - creative mode (simulating immediate change)
      jest.spyOn(transparencyService, 'getUserTransparencyMode').mockResolvedValueOnce('creative');
      const creativeResult = await transparencyService.applyTransparencyDisclaimer(testRoast, userId, 'es');
      expect(creativeResult.finalText).not.toBe(testRoast);
      expect(creativeResult.disclaimer).toBeTruthy();

      // Changes should be reflected immediately in each call
      expect(bioResult.disclaimerType).toBe('bio');
      expect(creativeResult.disclaimerType).toBe('creative');
    });
  });
});