/**
 * Style Validator Service for SPEC 8 - Issue #364
 * Validates edited roast content according to Roastr style guidelines
 */

const { logger } = require('../utils/logger');
const { VALIDATION_CONSTANTS } = require('../config/validationConstants');

class StyleValidator {
    constructor() {
        // Validation rules configuration
        this.rules = {
            // Text cannot be empty or only whitespace
            notEmpty: {
                name: 'NO_EMPTY_TEXT',
                message: 'El Roast no puede estar vacío',
                check: (text) => text && text.trim().length > 0
            },
            
            // Check character limits by platform
            characterLimit: {
                name: 'CHARACTER_LIMIT',
                getMessage: (limit) => `Tu Roast supera el límite de ${limit} caracteres permitido en esta red social`,
                check: (text, platform) => {
                    const limits = this.getCharacterLimits();
                    const limit = limits[platform] || limits.default;
                    return text.length <= limit;
                }
            },
            
            // No spam or repetitive characters
            noSpam: {
                name: 'NO_SPAM',
                message: 'El Roast no puede ser spam o repetición de caracteres',
                check: (text) => {
                    // Check for repetitive patterns
                    const repetitivePattern = /(.)\1{4,}/; // Same character 5+ times
                    const wordRepetition = /\b(\w+)\s+\1\s+\1/i; // Same word 3+ times
                    
                    return !repetitivePattern.test(text) && !wordRepetition.test(text);
                }
            },
            
            // No added insults beyond original roast
            noAddedInsults: {
                name: 'NO_ADDED_INSULTS',
                message: 'No puedes añadir insultos o ataques personales al Roast',
                check: (text, platform, originalText = null) => {
                    // Common insult patterns (basic detection)
                    const insultPatterns = [
                        /\b(idiota|estúpido|imbécil|tonto|gilipollas|cabrón|hijo de puta|puta|zorra|maricón|gay|negro|sudaca|moro)\b/i,
                        /\b(stupid|idiot|moron|asshole|bitch|fuck you|retard|gay|fag|nigger|spic)\b/i,
                        /\b(kill yourself|die|suicide|death|murder)\b/i
                    ];
                    
                    // If we have original text, check if new insults were added
                    if (originalText && typeof originalText === 'string') {
                        const newInsults = [];
                        const originalInsults = [];
                        
                        // Find insults in both texts
                        insultPatterns.forEach(pattern => {
                            const textMatches = text.match(pattern) || [];
                            const originalMatches = originalText.match(pattern) || [];
                            
                            textMatches.forEach(match => {
                                if (!originalMatches.includes(match)) {
                                    newInsults.push(match);
                                }
                            });
                        });
                        
                        // Only flag if new insults were added
                        return newInsults.length === 0;
                    }
                    
                    // If no original text, apply standard insult detection
                    return !insultPatterns.some(pattern => pattern.test(text));
                }
            },
            
            // No fake Roastr disclaimers or tags
            noFakeDisclaimers: {
                name: 'NO_FAKE_DISCLAIMERS',
                message: 'No puedes incluir etiquetas o disclaimers falsos de Roastr',
                check: (text) => {
                    const disclaimerPatterns = [
                        /powered\s+by\s+roastr/i,
                        /roastr\.ai/i,
                        /generado\s+por\s+ia/i,
                        /generated\s+by\s+ai/i,
                        /\[roastr\]/i,
                        /\#roastr/i
                    ];
                    
                    return !disclaimerPatterns.some(pattern => pattern.test(text));
                }
            },
            
            // No explicit or inappropriate content
            noExplicitContent: {
                name: 'NO_EXPLICIT_CONTENT',
                message: 'El Roast contiene contenido explícito o inapropiado',
                check: (text) => {
                    const explicitPatterns = [
                        /\b(sex|porno|porn|masturbat|orgasm|penis|vagina|tits|dick|cock|pussy|cum|xxx)\b/i,
                        /\b(sexo|porno|masturbación|pene|vagina|tetas|verga|coño|correrse|xxx)\b/i
                    ];
                    
                    return !explicitPatterns.some(pattern => pattern.test(text));
                }
            }
        };
    }

    /**
     * Get character limits by platform
     */
    getCharacterLimits() {
        return {
            twitter: 280,
            instagram: 2200,
            facebook: 63206,
            youtube: 10000,
            tiktok: 2200,
            linkedin: 3000,
            reddit: 10000,
            discord: 2000,
            bluesky: 300,
            default: 280 // Conservative default
        };
    }

    /**
     * Validate edited roast text
     * @param {string} text - The edited roast text
     * @param {string} platform - The target platform
     * @param {string} originalText - Original roast text for comparison (optional)
     * @returns {object} Validation result
     */
    validate(text, platform = 'twitter', originalText = null) {
        const startTime = Date.now();
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            metadata: {
                textLength: text?.length || 0,
                platform,
                validationTime: null
            }
        };

        try {
            // Basic input validation
            if (typeof text !== 'string') {
                result.valid = false;
                result.errors.push({
                    rule: 'INVALID_INPUT',
                    message: 'El texto debe ser una cadena válida'
                });
                return result;
            }

            // Apply all validation rules
            for (const [ruleName, rule] of Object.entries(this.rules)) {
                try {
                    let passed = false;
                    
                    if (ruleName === 'characterLimit') {
                        passed = rule.check(text, platform);
                        if (!passed) {
                            const limits = this.getCharacterLimits();
                            const limit = limits[platform] || limits.default;
                            result.errors.push({
                                rule: rule.name,
                                message: rule.getMessage(limit)
                            });
                        }
                    } else if (ruleName === 'noAddedInsults') {
                        passed = rule.check(text, platform, originalText);
                        if (!passed) {
                            result.errors.push({
                                rule: rule.name,
                                message: rule.message
                            });
                        }
                    } else {
                        passed = rule.check(text);
                        if (!passed) {
                            result.errors.push({
                                rule: rule.name,
                                message: rule.message
                            });
                        }
                    }
                    
                    if (!passed) {
                        result.valid = false;
                    }
                } catch (ruleError) {
                    logger.error(`Style validation rule ${ruleName} failed`, {
                        error: ruleError.message,
                        textLength: text?.length || 0,
                        platform: platform,
                        ruleName: ruleName
                    });
                    
                    // Don't fail validation for rule errors, but log them
                    result.warnings.push({
                        rule: ruleName.toUpperCase(),
                        message: 'Error interno en validación, regla omitida'
                    });
                }
            }

            result.metadata.validationTime = Date.now() - startTime;

            logger.info('Style validation completed', {
                valid: result.valid,
                errorsCount: result.errors.length,
                warningsCount: result.warnings.length,
                textLength: result.metadata.textLength,
                platform,
                validationTimeMs: result.metadata.validationTime
            });

            return result;

        } catch (error) {
            logger.error('Style validation failed', {
                error: error.message,
                stack: error.stack,
                textLength: text?.length || 0,
                platform
            });

            return {
                valid: false,
                errors: [{
                    rule: 'VALIDATION_ERROR',
                    message: 'Error interno de validación. Por favor, intenta de nuevo.'
                }],
                warnings: [],
                metadata: {
                    textLength: text?.length || 0,
                    platform,
                    validationTime: Date.now() - startTime,
                    error: error.message
                }
            };
        }
    }

    /**
     * Get validation rules summary (for documentation/debugging)
     */
    getRules() {
        return Object.keys(this.rules).map(ruleName => ({
            name: ruleName,
            code: this.rules[ruleName].name,
            message: this.rules[ruleName].message || 'Dynamic message'
        }));
    }

    /**
     * Test validation with sample inputs (for testing/debugging)
     */
    test() {
        const testCases = [
            { text: 'Este es un roast válido y divertido', platform: 'twitter', shouldPass: true },
            { text: '', platform: 'twitter', shouldPass: false }, // Empty
            { text: 'aaaaaaaaaaaaaaa', platform: 'twitter', shouldPass: false }, // Spam
            { text: 'Eres un idiota total', platform: 'twitter', shouldPass: false }, // Insult
            { text: 'Powered by Roastr.AI', platform: 'twitter', shouldPass: false }, // Fake disclaimer
            { text: 'a'.repeat(300), platform: 'twitter', shouldPass: false }, // Too long
        ];

        const results = testCases.map(testCase => ({
            ...testCase,
            result: this.validate(testCase.text, testCase.platform),
            passed: this.validate(testCase.text, testCase.platform).valid === testCase.shouldPass
        }));

        logger.info('Style validator test results', {
            totalTests: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length
        });

        return results;
    }
}

module.exports = StyleValidator;