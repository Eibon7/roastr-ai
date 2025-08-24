const transparencyService = require('../../../src/services/transparencyService');

describe('TransparencyService', () => {
  describe('getBioText', () => {
    it('should return Spanish bio text by default', () => {
      const bioText = transparencyService.getBioText();
      expect(bioText).toBe('Respuestas a comentarios inapropiados proporcionados por @Roastr.AI');
    });

    it('should return English bio text when specified', () => {
      const bioText = transparencyService.getBioText('en');
      expect(bioText).toBe('Inappropriate comment responses provided by @Roastr.AI');
    });
  });

  describe('getTransparencyOptions', () => {
    it('should return transparency options in Spanish by default', () => {
      const options = transparencyService.getTransparencyOptions();
      
      expect(options).toHaveLength(3);
      expect(options[0].value).toBe('bio');
      expect(options[0].label).toBe('Aviso en Bio');
      expect(options[0].is_default).toBe(true);
      
      expect(options[1].value).toBe('signature');
      expect(options[1].label).toBe('Firma clásica');
      
      expect(options[2].value).toBe('creative');
      expect(options[2].label).toBe('Disclaimers creativos');
    });

    it('should return transparency options in English', () => {
      const options = transparencyService.getTransparencyOptions('en');
      
      expect(options).toHaveLength(3);
      expect(options[0].label).toBe('Bio Notice');
      expect(options[1].label).toBe('Classic Signature');
      expect(options[2].label).toBe('Creative Disclaimers');
    });
  });

  describe('getUserTransparencyMode', () => {
    it('should return bio mode for mock mode', async () => {
      const mode = await transparencyService.getUserTransparencyMode('test-user-id');
      expect(mode).toBe('bio');
    });
  });

  describe('getRandomDisclaimer', () => {
    it('should return a Spanish disclaimer by default', async () => {
      const disclaimer = await transparencyService.getRandomDisclaimer();
      expect(typeof disclaimer).toBe('string');
      expect(disclaimer.length).toBeGreaterThan(0);
    });

    it('should return an English disclaimer when specified', async () => {
      const disclaimer = await transparencyService.getRandomDisclaimer('en');
      expect(typeof disclaimer).toBe('string');
      expect(disclaimer.length).toBeGreaterThan(0);
    });
  });

  describe('applyTransparencyDisclaimer', () => {
    const testRoast = "Your comment is so basic, it makes vanilla look exotic.";
    const testUserId = 'test-user-123';

    it('should apply bio mode correctly', async () => {
      // Mock getUserTransparencyMode to return 'bio'
      const originalMethod = transparencyService.getUserTransparencyMode;
      transparencyService.getUserTransparencyMode = jest.fn().mockResolvedValue('bio');

      const result = await transparencyService.applyTransparencyDisclaimer(testRoast, testUserId, 'es');
      
      expect(result.finalText).toBe(testRoast); // No modification to roast
      expect(result.transparencyMode).toBe('bio');
      expect(result.bioText).toBe('Respuestas a comentarios inapropiados proporcionados por @Roastr.AI');
      expect(result.disclaimer).toBe('Respuestas a comentarios inapropiados proporcionados por @Roastr.AI');

      // Restore original method
      transparencyService.getUserTransparencyMode = originalMethod;
    });

    it('should apply signature mode correctly', async () => {
      // Mock getUserTransparencyMode to return 'signature'
      const originalMethod = transparencyService.getUserTransparencyMode;
      transparencyService.getUserTransparencyMode = jest.fn().mockResolvedValue('signature');

      const result = await transparencyService.applyTransparencyDisclaimer(testRoast, testUserId, 'es');
      
      expect(result.finalText).toBe(testRoast + '\n\n— Generado por Roastr.AI');
      expect(result.transparencyMode).toBe('signature');
      expect(result.bioText).toBe(null);
      expect(result.disclaimer).toBe('— Generado por Roastr.AI');

      // Restore original method
      transparencyService.getUserTransparencyMode = originalMethod;
    });

    it('should apply creative mode correctly', async () => {
      // Mock getUserTransparencyMode to return 'creative'
      const originalGetMode = transparencyService.getUserTransparencyMode;
      const originalGetDisclaimer = transparencyService.getRandomDisclaimer;
      
      transparencyService.getUserTransparencyMode = jest.fn().mockResolvedValue('creative');
      transparencyService.getRandomDisclaimer = jest.fn().mockResolvedValue('Ningún humano perdió tiempo en ti');

      const result = await transparencyService.applyTransparencyDisclaimer(testRoast, testUserId, 'es');
      
      expect(result.finalText).toBe(testRoast + '\n\nNingún humano perdió tiempo en ti');
      expect(result.transparencyMode).toBe('creative');
      expect(result.bioText).toBe(null);
      expect(result.disclaimer).toBe('Ningún humano perdió tiempo en ti');

      // Restore original methods
      transparencyService.getUserTransparencyMode = originalGetMode;
      transparencyService.getRandomDisclaimer = originalGetDisclaimer;
    });

    it('should handle errors gracefully with fallback', async () => {
      // Mock getUserTransparencyMode to throw an error
      const originalMethod = transparencyService.getUserTransparencyMode;
      transparencyService.getUserTransparencyMode = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await transparencyService.applyTransparencyDisclaimer(testRoast, testUserId, 'es');
      
      // Should fallback to signature mode
      expect(result.finalText).toBe(testRoast + '\n\n— Generado por Roastr.AI');
      expect(result.transparencyMode).toBe('signature');
      expect(result.disclaimer).toBe('— Generado por Roastr.AI');

      // Restore original method
      transparencyService.getUserTransparencyMode = originalMethod;
    });

    it('should work with English language', async () => {
      // Mock getUserTransparencyMode to return 'signature'
      const originalMethod = transparencyService.getUserTransparencyMode;
      transparencyService.getUserTransparencyMode = jest.fn().mockResolvedValue('signature');

      const result = await transparencyService.applyTransparencyDisclaimer(testRoast, testUserId, 'en');
      
      expect(result.finalText).toBe(testRoast + '\n\n— Generated by Roastr.AI');
      expect(result.transparencyMode).toBe('signature');
      expect(result.disclaimer).toBe('— Generated by Roastr.AI');

      // Restore original method
      transparencyService.getUserTransparencyMode = originalMethod;
    });
  });
});