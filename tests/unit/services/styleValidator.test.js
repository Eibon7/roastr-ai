/**
 * Tests for StyleValidator service - SPEC 8 Issue #364
 */

const StyleValidator = require('../../../src/services/styleValidator');

describe('StyleValidator', () => {
    let validator;

    beforeEach(() => {
        validator = new StyleValidator();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor and Configuration', () => {
        it('should initialize with all validation rules', () => {
            expect(validator.rules).toBeDefined();
            expect(validator.rules.notEmpty).toBeDefined();
            expect(validator.rules.characterLimit).toBeDefined();
            expect(validator.rules.noSpam).toBeDefined();
            expect(validator.rules.noAddedInsults).toBeDefined();
            expect(validator.rules.noFakeDisclaimers).toBeDefined();
            expect(validator.rules.noExplicitContent).toBeDefined();
        });

        it('should have correct character limits for platforms', () => {
            const limits = validator.getCharacterLimits();
            expect(limits.twitter).toBe(280);
            expect(limits.instagram).toBe(2200);
            expect(limits.facebook).toBe(63206);
            expect(limits.default).toBe(280);
        });
    });

    describe('Basic Validation', () => {
        it('should validate valid roast text', () => {
            const result = validator.validate('Este es un roast válido y divertido', 'twitter');
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.textLength).toBe(35);
            expect(result.metadata.platform).toBe('twitter');
            expect(result.metadata.validationTime).toBeGreaterThan(0);
        });

        it('should reject empty text', () => {
            const result = validator.validate('', 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'NO_EMPTY_TEXT',
                message: 'El Roast no puede estar vacío'
            });
        });

        it('should reject whitespace-only text', () => {
            const result = validator.validate('   \n\t  ', 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'NO_EMPTY_TEXT',
                message: 'El Roast no puede estar vacío'
            });
        });

        it('should handle invalid input types', () => {
            const result = validator.validate(null, 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'INVALID_INPUT',
                message: 'El texto debe ser una cadena válida'
            });
        });
    });

    describe('Character Limit Validation', () => {
        it('should reject text exceeding Twitter limit', () => {
            const longText = 'a'.repeat(300);
            const result = validator.validate(longText, 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'CHARACTER_LIMIT',
                message: 'Tu Roast supera el límite de 280 caracteres permitido en esta red social'
            });
        });

        it('should accept text within Instagram limit', () => {
            const longText = 'a'.repeat(1000);
            const result = validator.validate(longText, 'instagram');
            
            // Should pass character limit but may fail other rules
            const characterLimitError = result.errors.find(e => e.rule === 'CHARACTER_LIMIT');
            expect(characterLimitError).toBeUndefined();
        });

        it('should use default limit for unknown platforms', () => {
            const longText = 'a'.repeat(300);
            const result = validator.validate(longText, 'unknown-platform');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'CHARACTER_LIMIT',
                message: 'Tu Roast supera el límite de 280 caracteres permitido en esta red social'
            });
        });
    });

    describe('Spam Detection', () => {
        it('should reject repetitive characters', () => {
            const result = validator.validate('aaaaaaaaaaaa', 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'NO_SPAM',
                message: 'El Roast no puede ser spam o repetición de caracteres'
            });
        });

        it('should reject repetitive words', () => {
            const result = validator.validate('spam spam spam repetitivo', 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'NO_SPAM',
                message: 'El Roast no puede ser spam o repetición de caracteres'
            });
        });

        it('should accept normal repetition in sentences', () => {
            const result = validator.validate('Esto es muy muy bueno', 'twitter');
            
            const spamError = result.errors.find(e => e.rule === 'NO_SPAM');
            expect(spamError).toBeUndefined();
        });
    });

    describe('Insult Detection', () => {
        it('should reject Spanish insults', () => {
            const insults = ['idiota', 'estúpido', 'imbécil', 'gilipollas'];
            
            insults.forEach(insult => {
                const result = validator.validate(`Eres un ${insult}`, 'twitter');
                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    rule: 'NO_ADDED_INSULTS',
                    message: 'No puedes añadir insultos o ataques personales al Roast'
                });
            });
        });

        it('should reject English insults', () => {
            const insults = ['stupid', 'idiot', 'moron', 'asshole'];
            
            insults.forEach(insult => {
                const result = validator.validate(`You are ${insult}`, 'twitter');
                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    rule: 'NO_ADDED_INSULTS',
                    message: 'No puedes añadir insultos o ataques personales al Roast'
                });
            });
        });

        it('should reject violence-related content', () => {
            const result = validator.validate('kill yourself', 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'NO_ADDED_INSULTS',
                message: 'No puedes añadir insultos o ataques personales al Roast'
            });
        });

        it('should accept mild criticisms', () => {
            const result = validator.validate('Tu comentario no es muy inteligente', 'twitter');
            
            const insultError = result.errors.find(e => e.rule === 'NO_ADDED_INSULTS');
            expect(insultError).toBeUndefined();
        });
    });

    describe('Fake Disclaimer Detection', () => {
        it('should reject Roastr branding attempts', () => {
            const fakeDisclaimers = [
                'Powered by Roastr',
                'Generado por Roastr.AI',
                'Generated by AI',
                '[Roastr]',
                '#roastr'
            ];
            
            fakeDisclaimers.forEach(disclaimer => {
                const result = validator.validate(`Este es un roast ${disclaimer}`, 'twitter');
                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    rule: 'NO_FAKE_DISCLAIMERS',
                    message: 'No puedes incluir etiquetas o disclaimers falsos de Roastr'
                });
            });
        });

        it('should accept normal text with similar words', () => {
            const result = validator.validate('Este roast está bien generado', 'twitter');
            
            const disclaimerError = result.errors.find(e => e.rule === 'NO_FAKE_DISCLAIMERS');
            expect(disclaimerError).toBeUndefined();
        });
    });

    describe('Explicit Content Detection', () => {
        it('should reject explicit English content', () => {
            const explicitTerms = ['sex', 'porn', 'penis', 'vagina'];
            
            explicitTerms.forEach(term => {
                const result = validator.validate(`This contains ${term}`, 'twitter');
                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    rule: 'NO_EXPLICIT_CONTENT',
                    message: 'El Roast contiene contenido explícito o inapropiado'
                });
            });
        });

        it('should reject explicit Spanish content', () => {
            const explicitTerms = ['sexo', 'porno', 'pene', 'vagina'];
            
            explicitTerms.forEach(term => {
                const result = validator.validate(`Esto contiene ${term}`, 'twitter');
                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    rule: 'NO_EXPLICIT_CONTENT',
                    message: 'El Roast contiene contenido explícito o inapropiado'
                });
            });
        });

        it('should accept non-explicit content', () => {
            const result = validator.validate('Este es un roast divertido y apropiado', 'twitter');
            
            const explicitError = result.errors.find(e => e.rule === 'NO_EXPLICIT_CONTENT');
            expect(explicitError).toBeUndefined();
        });
    });

    describe('Multiple Errors', () => {
        it('should detect multiple validation errors', () => {
            const badText = 'aaaaaaaaaa idiota powered by roastr ' + 'x'.repeat(300);
            const result = validator.validate(badText, 'twitter');
            
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(3);
            
            const errorRules = result.errors.map(e => e.rule);
            expect(errorRules).toContain('NO_SPAM');
            expect(errorRules).toContain('NO_ADDED_INSULTS');
            expect(errorRules).toContain('NO_FAKE_DISCLAIMERS');
            expect(errorRules).toContain('CHARACTER_LIMIT');
        });
    });

    describe('Error Handling', () => {
        it('should handle validation rule errors gracefully', () => {
            // Mock a rule to throw an error
            const originalRule = validator.rules.notEmpty.check;
            validator.rules.notEmpty.check = jest.fn(() => {
                throw new Error('Rule error');
            });

            const result = validator.validate('Valid text', 'twitter');
            
            expect(result.warnings).toContainEqual({
                rule: 'NOTEMPTY',
                message: 'Error interno en validación, regla omitida'
            });

            // Restore original rule
            validator.rules.notEmpty.check = originalRule;
        });

        it('should handle complete validation failure', () => {
            // Mock validator to throw during validation
            const originalValidate = validator.validate;
            
            const result = validator.validate.call({
                rules: null,
                getCharacterLimits: () => { throw new Error('Complete failure'); }
            }, 'test', 'twitter');

            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual({
                rule: 'VALIDATION_ERROR',
                message: 'Error interno de validación. Por favor, intenta de nuevo.'
            });
        });
    });

    describe('Helper Methods', () => {
        it('should return validation rules summary', () => {
            const rules = validator.getRules();
            
            expect(Array.isArray(rules)).toBe(true);
            expect(rules.length).toBeGreaterThan(0);
            
            rules.forEach(rule => {
                expect(rule).toHaveProperty('name');
                expect(rule).toHaveProperty('code');
                expect(rule).toHaveProperty('message');
            });
        });

        it('should run test cases successfully', () => {
            const results = validator.test();
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            
            results.forEach(result => {
                expect(result).toHaveProperty('text');
                expect(result).toHaveProperty('platform');
                expect(result).toHaveProperty('shouldPass');
                expect(result).toHaveProperty('result');
                expect(result).toHaveProperty('passed');
            });
        });
    });

    describe('Performance', () => {
        it('should validate quickly for normal text', () => {
            const start = Date.now();
            const result = validator.validate('Este es un roast normal', 'twitter');
            const end = Date.now();
            
            expect(result.metadata.validationTime).toBeLessThan(100); // Less than 100ms
            expect(end - start).toBeLessThan(100);
        });

        it('should handle large text efficiently', () => {
            const largeText = 'a'.repeat(10000);
            const start = Date.now();
            const result = validator.validate(largeText, 'facebook');
            const end = Date.now();
            
            expect(end - start).toBeLessThan(500); // Less than 500ms for large text
        });
    });

    describe('Platform-Specific Behavior', () => {
        it('should handle different platforms correctly', () => {
            const platforms = ['twitter', 'instagram', 'facebook', 'youtube', 'tiktok'];
            const text = 'Valid roast text';
            
            platforms.forEach(platform => {
                const result = validator.validate(text, platform);
                expect(result.metadata.platform).toBe(platform);
                expect(result.valid).toBe(true);
            });
        });

        it('should use appropriate character limits per platform', () => {
            const limits = validator.getCharacterLimits();
            
            Object.keys(limits).forEach(platform => {
                if (platform === 'default') return;
                
                const longText = 'a'.repeat(limits[platform] + 1);
                const result = validator.validate(longText, platform);
                
                expect(result.valid).toBe(false);
                expect(result.errors).toContainEqual({
                    rule: 'CHARACTER_LIMIT',
                    message: `Tu Roast supera el límite de ${limits[platform]} caracteres permitido en esta red social`
                });
            });
        });
    });
});