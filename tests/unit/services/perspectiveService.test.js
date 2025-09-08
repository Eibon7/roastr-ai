/**
 * Unit tests for PerspectiveService
 * Testing attribute normalization fixes
 */

const PerspectiveService = require('../../../src/services/perspectiveService');

// Mock Google APIs
jest.mock('googleapis', () => ({
    google: {
        commentanalyzer: jest.fn(() => ({
            comments: {
                analyze: jest.fn()
            }
        }))
    }
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
    isEnabled: jest.fn(() => false) // Disable API to use mock mode
}));

describe('PerspectiveService', () => {
    let perspectiveService;

    beforeEach(() => {
        jest.clearAllMocks();
        perspectiveService = new PerspectiveService();
    });

    describe('normalizeAttributeName', () => {
        it('should convert SEVERE_TOXICITY to severeToxicity', () => {
            const result = perspectiveService.normalizeAttributeName('SEVERE_TOXICITY');
            expect(result).toBe('severeToxicity');
        });

        it('should convert IDENTITY_ATTACK to identityAttack', () => {
            const result = perspectiveService.normalizeAttributeName('IDENTITY_ATTACK');
            expect(result).toBe('identityAttack');
        });

        it('should convert single word attributes correctly', () => {
            const result = perspectiveService.normalizeAttributeName('TOXICITY');
            expect(result).toBe('toxicity');
        });

        it('should handle multiple underscores correctly', () => {
            const result = perspectiveService.normalizeAttributeName('SOME_LONG_ATTRIBUTE_NAME');
            expect(result).toBe('someLongAttributeName');
        });

        it('should handle empty or invalid input', () => {
            expect(perspectiveService.normalizeAttributeName('')).toBe('');
            expect(perspectiveService.normalizeAttributeName(null)).toBe('');
            expect(perspectiveService.normalizeAttributeName(undefined)).toBe('');
        });

        it('should handle attributes without underscores', () => {
            const result = perspectiveService.normalizeAttributeName('INSULT');
            expect(result).toBe('insult');
        });
    });

    describe('parseResponse', () => {
        it('should use normalized attribute names in analysis', () => {
            const mockData = {
                attributeScores: {
                    'TOXICITY': {
                        summaryScore: { value: 0.8 }
                    },
                    'SEVERE_TOXICITY': {
                        summaryScore: { value: 0.6 }
                    },
                    'IDENTITY_ATTACK': {
                        summaryScore: { value: 0.4 }
                    },
                    'INSULT': {
                        summaryScore: { value: 0.7 }
                    },
                    'PROFANITY': {
                        summaryScore: { value: 0.3 }
                    },
                    'THREAT': {
                        summaryScore: { value: 0.2 }
                    }
                }
            };

            const result = perspectiveService.parseResponse(mockData);

            // Check that the main response uses correct camelCase
            expect(result.toxicity).toBe(0.8);
            expect(result.severeToxicity).toBe(0.6);
            expect(result.identityAttack).toBe(0.4);
            expect(result.insult).toBe(0.7);
            expect(result.profanity).toBe(0.3);
            expect(result.threat).toBe(0.2);

            // Check that the analysis object also uses normalized names
            expect(result.analysis.toxicity).toBe(0.8);
            expect(result.analysis.severeToxicity).toBe(0.6);
            expect(result.analysis.identityAttack).toBe(0.4);
            expect(result.analysis.insult).toBe(0.7);
            expect(result.analysis.profanity).toBe(0.3);
            expect(result.analysis.threat).toBe(0.2);
        });

        it('should handle missing attribute scores gracefully', () => {
            const mockData = {
                attributeScores: {}
            };

            const result = perspectiveService.parseResponse(mockData);

            expect(result.toxicity).toBe(0);
            expect(result.severeToxicity).toBe(0);
            expect(result.identityAttack).toBe(0);
            expect(result.insult).toBe(0);
            expect(result.profanity).toBe(0);
            expect(result.threat).toBe(0);
        });
    });

    describe('analyzeText', () => {
        it('should return mock analysis when API is disabled', async () => {
            const result = await perspectiveService.analyzeText('Test text');

            expect(result).toHaveProperty('toxicity');
            expect(result).toHaveProperty('severeToxicity');
            expect(result).toHaveProperty('identityAttack');
            expect(result).toHaveProperty('insult');
            expect(result).toHaveProperty('profanity');
            expect(result).toHaveProperty('threat');
            expect(result).toHaveProperty('categories');
            expect(result).toHaveProperty('safe');
            expect(result).toHaveProperty('analysis');
            expect(result).toHaveProperty('timestamp');
        });
    });
});
