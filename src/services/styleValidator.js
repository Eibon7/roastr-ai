/**
 * Style Validator Service for SPEC 8 - Issue #364
 * Validates edited roast content according to Roastr style guidelines
 */

const { logger } = require('../utils/logger');
const { VALIDATION_CONSTANTS } = require('../config/validationConstants');

class StyleValidator {
    constructor() {
        // Pre-compiled regex patterns for performance optimization
        this.regexPatterns = {
            repetitivePattern: /(.)\1{4,}/,
            wordRepetition: /\b(\w+)\s+\1\s+\1/i,
            insultPatterns: [
                /\b(idiota|estúpido|imbécil|tonto|gilipollas|cabrón|hijo de puta|puta|zorra|maricón|gay|negro|sudaca|moro)\b/giu,
                /\b(stupid|idiot|moron|asshole|bitch|fuck you|retard|gay|fag|nigger|spic)\b/giu,
                /\b(kill yourself|die|suicide|death|murder)\b/giu
            ],
            disclaimerPatterns: [
                /powered\s+by\s+roastr/i,
                /roastr\.ai/i,
                /generado\s+por\s+ia/i,
                /generated\s+by\s+ai/i,
                /\[roastr\]/i
                // Removed /#roastr/i to prevent blocking legitimate hashtags
            ],
            explicitPatterns: [
                /\b(sex|porno|porn|masturbat|orgasm|penis|vagina|tits|dick|cock|pussy|cum|xxx)\b/iu,
                /\b(sexo|porno|masturbación|pene|vagina|tetas|verga|coño|correrse|xxx)\b/iu
            ]
        };

        // Validation rules configuration
        this.rules = {
            // Text cannot be empty or only whitespace
            notEmpty: {
                name: 'NO_EMPTY_TEXT',
                message: 'El Roast no puede estar vacío',
                check: (text) => text && text.trim().length > 0
            },
            
            // Check character limits by platform with grapheme-aware counting
            characterLimit: {
                name: 'CHARACTER_LIMIT',
                getMessage: (limit) => `Tu Roast supera el límite de ${limit} caracteres permitido en esta red social`,
                check: (text, platform) => {
                    const normalizedPlatform = this.normalizePlatform(platform);
                    const limits = this.getCharacterLimits();
                    const limit = limits[normalizedPlatform] || limits.default;
                    const graphemeLength = this.getGraphemeLength(text);
                    return graphemeLength <= limit;
                }
            },
            
            // No spam or repetitive characters
            noSpam: {
                name: 'NO_SPAM',
                message: 'El Roast no puede ser spam o repetición de caracteres',
                check: (text) => {
                    // Use pre-compiled patterns for better performance
                    return !this.regexPatterns.repetitivePattern.test(text) && 
                           !this.regexPatterns.wordRepetition.test(text);
                }
            },
            
            // No added insults beyond original roast - improved detection with global regex
            noAddedInsults: {
                name: 'NO_ADDED_INSULTS',
                message: 'No puedes añadir insultos o ataques personales al Roast',
                check: (text, platform, originalText = null) => {
                    // Use pre-compiled patterns for better performance
                    const insultPatterns = this.regexPatterns.insultPatterns;
                    
                    // If we have original text, check if new insults were added
                    if (originalText && typeof originalText === 'string') {
                        const newInsults = new Set();
                        const originalInsults = new Set();
                        
                        // Find ALL insult matches in both texts using global regex
                        insultPatterns.forEach(pattern => {
                            // Reset regex lastIndex for global patterns
                            pattern.lastIndex = 0;
                            const textMatches = [...text.matchAll(pattern)];
                            
                            pattern.lastIndex = 0;
                            const originalMatches = [...originalText.matchAll(pattern)];
                            
                            // Add all matches to sets for comparison
                            textMatches.forEach(match => newInsults.add(match[0].toLowerCase()));
                            originalMatches.forEach(match => originalInsults.add(match[0].toLowerCase()));
                        });
                        
                        // Check if any new insults were added (not present in original)
                        for (const insult of newInsults) {
                            if (!originalInsults.has(insult)) {
                                return false; // New insult detected
                            }
                        }
                        
                        return true; // No new insults added
                    }
                    
                    // If no original text, apply standard insult detection
                    return !insultPatterns.some(pattern => {
                        pattern.lastIndex = 0; // Reset for global patterns
                        return pattern.test(text);
                    });
                }
            },
            
            // No fake Roastr disclaimers or tags
            noFakeDisclaimers: {
                name: 'NO_FAKE_DISCLAIMERS',
                message: 'No puedes incluir etiquetas o disclaimers falsos de Roastr',
                check: (text) => {
                    // Use pre-compiled patterns for better performance
                    return !this.regexPatterns.disclaimerPatterns.some(pattern => pattern.test(text));
                }
            },
            
            // No explicit or inappropriate content
            noExplicitContent: {
                name: 'NO_EXPLICIT_CONTENT',
                message: 'El Roast contiene contenido explícito o inapropiado',
                check: (text) => {
                    // Use pre-compiled patterns for better performance
                    return !this.regexPatterns.explicitPatterns.some(pattern => pattern.test(text));
                }
            }
        };
    }

    /**
     * Get character limits by platform with normalization
     */
    getCharacterLimits() {
        return {
            twitter: 280,
            x: 280, // X platform alias for Twitter
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
     * Normalize platform name (e.g., "X" → "twitter")
     */
    normalizePlatform(platform) {
        const platformMap = {
            'x': 'twitter',
            'x.com': 'twitter'
        };
        
        const normalized = platform?.toLowerCase()?.trim();
        return platformMap[normalized] || normalized || 'twitter';
    }

    /**
     * Get grapheme-aware character count for proper Unicode support
     */
    getGraphemeLength(text) {
        if (!text || typeof text !== 'string') return 0;

        // Use Intl.Segmenter for accurate grapheme counting if available
        // Use undefined locale for better Unicode support as suggested by CodeRabbit
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            try {
                const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                return Array.from(segmenter.segment(text)).length;
            } catch (error) {
                // Fallback if Intl.Segmenter fails
            }
        }

        // Fallback to Array.from for basic Unicode support
        try {
            return Array.from(text).length;
        } catch (error) {
            // Final fallback to basic length
            return text.length;
        }
    }

    /**
     * Get UTF-8 byte length for accurate byte calculations
     */
    getByteLengthUtf8(text) {
        if (!text || typeof text !== 'string') return 0;
        
        try {
            // Use Buffer.byteLength() for more accurate UTF-8 byte calculation (CodeRabbit Round 4)
            return Buffer.byteLength(text, 'utf8');
        } catch (error) {
            // Fallback to TextEncoder if Buffer is not available
            try {
                return new TextEncoder().encode(text).length;
            } catch (fallbackError) {
                // Final fallback to UTF-16 length * 2 (rough approximation)
                return text.length * 2;
            }
        }
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
        const normalizedPlatform = this.normalizePlatform(platform);
        const graphemeLength = this.getGraphemeLength(text);
        const utf8ByteLength = this.getByteLengthUtf8(text);
        
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            metadata: {
                textLength: graphemeLength, // Use grapheme-aware length
                codeUnitLength: text?.length || 0, // UTF-16 code units (original length)
                byteLengthUtf8: utf8ByteLength, // Accurate UTF-8 byte length
                byteLengthUtf16: text?.length || 0, // Keep for backward compatibility
                platform: normalizedPlatform,
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
                        passed = rule.check(text, normalizedPlatform);
                        if (!passed) {
                            const limits = this.getCharacterLimits();
                            const limit = limits[normalizedPlatform] || limits.default;
                            result.errors.push({
                                rule: rule.name,
                                message: rule.getMessage(limit)
                            });
                        }
                    } else if (ruleName === 'noAddedInsults') {
                        passed = rule.check(text, normalizedPlatform, originalText);
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
                    // GDPR-compliant logging: metadata only, no text content
                    logger.error(`Style validation rule ${ruleName} failed`, {
                        error: ruleError.message,
                        textLength: graphemeLength,
                        codeUnitLength: text?.length || 0,
                        byteLengthUtf8: utf8ByteLength,
                        platform: normalizedPlatform,
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

            // GDPR-compliant logging: metadata only, no text content
            logger.info('Style validation completed', {
                valid: result.valid,
                errorsCount: result.errors.length,
                warningsCount: result.warnings.length,
                textLength: result.metadata.textLength,
                codeUnitLength: result.metadata.codeUnitLength,
                byteLengthUtf8: result.metadata.byteLengthUtf8,
                platform: result.metadata.platform,
                validationTimeMs: result.metadata.validationTime
            });

            return result;

        } catch (error) {
            // GDPR-compliant error logging: metadata only, no text content
            logger.error('Style validation failed', {
                error: error.message,
                stack: error.stack,
                textLength: graphemeLength,
                codeUnitLength: text?.length || 0,
                byteLengthUtf8: utf8ByteLength,
                platform: normalizedPlatform
            });

            return {
                valid: false,
                errors: [{
                    rule: 'VALIDATION_ERROR',
                    message: 'Error interno de validación. Por favor, intenta de nuevo.'
                }],
                warnings: [],
                metadata: {
                    textLength: graphemeLength,
                    codeUnitLength: text?.length || 0,
                    byteLengthUtf8: utf8ByteLength,
                    byteLengthUtf16: text?.length || 0, // Keep for backward compatibility
                    platform: normalizedPlatform,
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