/**
 * Tests for sensitive data detection utilities
 */

const {
  detectSensitiveData,
  generateWarningMessage,
  isClipboardClearingSupported,
  clearClipboard
} = require('../../../frontend/src/utils/sensitiveDataDetector.js');

describe('Sensitive Data Detector', () => {
  describe('Credit Card Detection', () => {
    it('should detect valid credit card numbers', () => {
      const validCards = [
        '4111111111111111', // Visa (test card)
        '5555555555554444', // Mastercard (test card)
        '378282246310005',  // Amex (test card)
        '6011111111111117', // Discover (test card)
        '30569309025904',   // Diners Club (test card)
        '3530111333300000', // JCB (test card)
      ];

      validCards.forEach(card => {
        const result = detectSensitiveData(card);
        expect(result.isSensitive).toBe(true);
        expect(result.detectedTypes).toContain('creditCard');
        expect(result.suggestions).toContain('Se detectaron números de tarjeta válidos');
      });
    });

    it('should not detect invalid credit card numbers', () => {
      const invalidCards = [
        '1234567890123456', // Invalid Luhn
        '4532123456789012', // Invalid Luhn for Visa
        '1111111111111111', // Invalid IIN
        '9999999999999999', // Invalid IIN
        '123456789012',     // Too short
        '12345678901234567890', // Too long
      ];

      invalidCards.forEach(card => {
        const result = detectSensitiveData(card);
        expect(result.detectedTypes).not.toContain('creditCard');
      });
    });

    it('should handle credit cards with separators', () => {
      const cardsWithSeparators = [
        '4111-1111-1111-1111',
        '4111 1111 1111 1111',
        '4111  1111  1111  1111',
      ];

      cardsWithSeparators.forEach(card => {
        const result = detectSensitiveData(card);
        expect(result.isSensitive).toBe(true);
        expect(result.detectedTypes).toContain('creditCard');
      });
    });

    it('should not flag random 16-digit sequences', () => {
      const nonCards = [
        '1234567890123456', // No valid IIN
        '0000000000000000', // All zeros
        '1111111111111111', // Repeating digits
        '9876543210987654', // Invalid Luhn
      ];

      nonCards.forEach(sequence => {
        const result = detectSensitiveData(sequence);
        expect(result.detectedTypes).not.toContain('creditCard');
      });
    });
  });

  describe('SSN Detection', () => {
    it('should detect valid SSN formats', () => {
      const validSSNs = [
        '123-45-6789',
        '456-78-9012',
        '555-12-3456',
      ];

      validSSNs.forEach(ssn => {
        const result = detectSensitiveData(ssn);
        expect(result.isSensitive).toBe(true);
        expect(result.detectedTypes).toContain('nationalId');
        expect(result.suggestions).toContain('Se detectaron números de identificación válidos');
      });
    });

    it('should not detect invalid SSN formats', () => {
      const invalidSSNs = [
        '000-12-3456', // Invalid area (000)
        '666-12-3456', // Invalid area (666)
        '987-65-4321', // Invalid area (900-999)
        '123-00-3456', // Invalid group (00)
        '123-45-0000', // Invalid serial (0000)
        '12-345-6789', // Wrong format
        '1234-56-789', // Wrong format
      ];

      invalidSSNs.forEach(ssn => {
        const result = detectSensitiveData(ssn);
        expect(result.detectedTypes).not.toContain('nationalId');
      });
    });

    it('should not flag random 9-digit sequences without proper format', () => {
      const nonSSNs = [
        '123456789 is a number',
        'The code 987654321 works',
        'ID: 555444333',
      ];

      nonSSNs.forEach(text => {
        const result = detectSensitiveData(text);
        expect(result.detectedTypes).not.toContain('nationalId');
      });
    });
  });

  describe('Bank Account Detection', () => {
    it('should detect bank accounts with context', () => {
      const bankTexts = [
        'My account number is 123456789012',
        'Bank account: 987654321098',
        'Routing number 123456789',
        'IBAN: GB82WEST12345698765432',
        'Please transfer to acct 555666777888',
      ];

      bankTexts.forEach(text => {
        const result = detectSensitiveData(text);
        expect(result.isSensitive).toBe(true);
        expect(result.detectedTypes).toContain('bankAccount');
        expect(result.suggestions).toContain('Se detectaron números de cuenta bancaria');
      });
    });

    it('should not detect random long numbers without context', () => {
      const nonBankTexts = [
        'The timestamp is 1234567890123',
        'Product ID: 987654321098765',
        'Serial number 555666777888999',
        'Reference: 123456789012345',
      ];

      nonBankTexts.forEach(text => {
        const result = detectSensitiveData(text);
        expect(result.detectedTypes).not.toContain('bankAccount');
      });
    });

    it('should detect 9-digit routing numbers', () => {
      const routingTexts = [
        'Routing: 123456789',
        'ABA number 987654321',
        'Bank routing 555666777',
      ];

      routingTexts.forEach(text => {
        const result = detectSensitiveData(text);
        expect(result.isSensitive).toBe(true);
        expect(result.detectedTypes).toContain('bankAccount');
      });
    });
  });

  describe('Email Detection', () => {
    it('should detect email addresses', () => {
      const emails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'Contact me at john.doe@company.org',
      ];

      emails.forEach(text => {
        const result = detectSensitiveData(text);
        expect(result.isSensitive).toBe(true);
        expect(result.detectedTypes).toContain('email');
        expect(result.suggestions).toContain('Se detectaron direcciones de email');
      });
    });
  });

  describe('Phone Detection', () => {
    it('should detect phone numbers', () => {
      const phones = [
        '555-123-4567',
        '(555) 123-4567',
        '+1-555-123-4567',
        'Call me at 555.123.4567',
      ];

      phones.forEach(text => {
        const result = detectSensitiveData(text);
        expect(result.isSensitive).toBe(true);
        expect(result.detectedTypes).toContain('phone');
        expect(result.suggestions).toContain('Se detectaron números de teléfono');
      });
    });
  });

  describe('Mixed Content Detection', () => {
    it('should detect multiple types in same text', () => {
      const mixedText = 'Contact John at john@example.com or 555-123-4567. His card is 4111111111111111.';
      const result = detectSensitiveData(mixedText);

      expect(result.isSensitive).toBe(true);
      expect(result.detectedTypes).toContain('email');
      expect(result.detectedTypes).toContain('phone');
      expect(result.detectedTypes).toContain('creditCard');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should not flag normal text', () => {
      const normalTexts = [
        'Just a normal message about my day',
        'I love this new restaurant downtown',
        'Working on some exciting projects this week',
        'The weather is nice today',
        'Meeting at 3pm in room 1234',
      ];

      normalTexts.forEach(text => {
        const result = detectSensitiveData(text);
        expect(result.isSensitive).toBe(false);
        expect(result.detectedTypes.length).toBe(0);
      });
    });
  });

  describe('Warning Message Generation', () => {
    it('should generate appropriate warning messages', () => {
      const detection = {
        isSensitive: true,
        detectedTypes: ['creditCard', 'email'],
        suggestions: ['Se detectaron números de tarjeta válidos', 'Se detectaron direcciones de email'],
        confidence: 0.9
      };

      const warning = generateWarningMessage(detection);
      expect(warning).toContain('⚠️ Se ha detectado información potencialmente sensible');
      expect(warning).toContain('Se detectaron números de tarjeta válidos');
      expect(warning).toContain('Asegúrate de no compartir esta información');
    });

    it('should return empty string for non-sensitive content', () => {
      const detection = {
        isSensitive: false,
        detectedTypes: [],
        suggestions: [],
        confidence: 0.1
      };

      const warning = generateWarningMessage(detection);
      expect(warning).toBe('');
    });
  });

  describe('Clipboard Functions', () => {
    it('should check clipboard clearing support', () => {
      const isSupported = isClipboardClearingSupported();
      expect(typeof isSupported).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or null input', () => {
      const inputs = ['', null, undefined];
      
      inputs.forEach(input => {
        const result = detectSensitiveData(input);
        expect(result.isSensitive).toBe(false);
        expect(result.detectedTypes).toEqual([]);
        expect(result.confidence).toBe(0);
      });
    });

    it('should handle non-string input', () => {
      const inputs = [123, {}, [], true];
      
      inputs.forEach(input => {
        const result = detectSensitiveData(input);
        expect(result.isSensitive).toBe(false);
        expect(result.detectedTypes).toEqual([]);
        expect(result.confidence).toBe(0);
      });
    });
  });
});
