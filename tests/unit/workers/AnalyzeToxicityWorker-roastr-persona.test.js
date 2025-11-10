/**
 * AnalyzeToxicityWorker Roastr Persona Enhancement Tests
 * Issue #148: Test enhanced toxicity detection using user's personal identity
 * 
 * Tests the integration of Roastr Persona with toxicity analysis including:
 * - Personal attack detection
 * - Toxicity score enhancement
 * - User identity data retrieval
 * - Privacy protection in analysis
 */

const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');
const encryptionService = require('../../../src/services/encryptionService');

// Mock dependencies
const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn()
};

const mockRedis = {
    rpush: jest.fn()
};

const mockCostControl = {
    canPerformOperation: jest.fn().mockResolvedValue({ allowed: true }),
    recordUsage: jest.fn()
};

const mockShieldService = {
    analyzeForShield: jest.fn().mockResolvedValue({ shieldActive: false })
};

jest.mock('../../../src/services/costControl', () => {
    return jest.fn().mockImplementation(() => mockCostControl);
});

jest.mock('../../../src/services/shieldService', () => {
    return jest.fn().mockImplementation(() => mockShieldService);
});

// Issue #644: Include generateMockSupabaseClient to prevent worker crashes
const mockSupabaseClientForMockMode = {
    from: jest.fn(() => ({
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                single: jest.fn()
            }))
        }))
    })),
    rpc: jest.fn()
};

jest.mock('../../../src/config/mockMode', () => ({
    mockMode: {
        isMockMode: true,
        generateMockPerspective: jest.fn(),
        generateMockOpenAI: jest.fn(),
        generateMockSupabaseClient: jest.fn(() => mockSupabaseClientForMockMode)
    }
}));

describe('AnalyzeToxicityWorker Roastr Persona Enhancement', () => {
    let worker;

    beforeEach(() => {
        worker = new AnalyzeToxicityWorker();
        worker.supabase = mockSupabaseClient;
        worker.redis = mockRedis;
        
        jest.clearAllMocks();
    });

    describe('getUserRoastrPersona()', () => {
        it('should retrieve and decrypt user persona successfully', async () => {
            const testPersona = 'mujer trans, vegana, gamer';
            const encryptedPersona = encryptionService.encrypt(testPersona);

            // Mock organization owner lookup
            mockSupabaseClient.single
                .mockResolvedValueOnce({
                    data: { owner_id: 'user-123' },
                    error: null
                })
                // Mock user persona lookup
                .mockResolvedValueOnce({
                    data: { lo_que_me_define_encrypted: encryptedPersona },
                    error: null
                });

            const result = await worker.getUserRoastrPersona('org-123');
            expect(result).toBe(testPersona);
        });

        it('should return null when user has no persona defined', async () => {
            // Mock organization owner lookup
            mockSupabaseClient.single
                .mockResolvedValueOnce({
                    data: { owner_id: 'user-123' },
                    error: null
                })
                // Mock user with no persona
                .mockResolvedValueOnce({
                    data: { lo_que_me_define_encrypted: null },
                    error: null
                });

            const result = await worker.getUserRoastrPersona('org-123');
            expect(result).toBe(null);
        });

        it('should return null when organization not found', async () => {
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Organization not found' }
            });

            const result = await worker.getUserRoastrPersona('nonexistent-org');
            expect(result).toBe(null);
        });

        it('should handle decryption errors gracefully', async () => {
            // Mock organization owner lookup
            mockSupabaseClient.single
                .mockResolvedValueOnce({
                    data: { owner_id: 'user-123' },
                    error: null
                })
                // Mock user with corrupted encrypted data
                .mockResolvedValueOnce({
                    data: { lo_que_me_define_encrypted: 'corrupted-data' },
                    error: null
                });

            const result = await worker.getUserRoastrPersona('org-123');
            expect(result).toBe(null);
        });
    });

    describe('analyzePersonalAttack()', () => {
        it('should detect personal attacks based on persona terms', () => {
            const persona = 'mujer trans, vegana, gamer';
            const comment = 'Las veganas son estúpidas y locas';

            const result = worker.analyzePersonalAttack(comment, persona);

            expect(result.isPersonalAttack).toBe(true);
            expect(result.matchedTerms).toContain('vegana');
            expect(result.boostAmount).toBeGreaterThan(0);
        });

        it('should boost score more for negative context', () => {
            const persona = 'mujer trans';
            const neutralComment = 'Hay muchas mujeres trans en la industria';
            const negativeComment = 'Las mujeres trans son fake y disgusting';

            const neutralResult = worker.analyzePersonalAttack(neutralComment, persona);
            const negativeResult = worker.analyzePersonalAttack(negativeComment, persona);

            expect(negativeResult.boostAmount).toBeGreaterThan(neutralResult.boostAmount);
        });

        it('should handle multiple persona terms', () => {
            const persona = 'mujer trans, vegana, política de izquierdas';
            const comment = 'Las veganas de izquierdas son locas';

            const result = worker.analyzePersonalAttack(comment, persona);

            expect(result.isPersonalAttack).toBe(true);
            expect(result.matchedTerms.length).toBeGreaterThan(1);
        });

        it('should be case insensitive', () => {
            const persona = 'Mujer Trans';
            const comment = 'las MUJERES TRANS son raras';

            const result = worker.analyzePersonalAttack(comment, persona);

            expect(result.isPersonalAttack).toBe(true);
            expect(result.matchedTerms).toContain('mujer trans');
        });

        it('should handle persona with separators', () => {
            const persona = 'mujer trans; vegana, gamer. política';
            const comment = 'Los gamers veganos son tontos';

            const result = worker.analyzePersonalAttack(comment, persona);

            expect(result.isPersonalAttack).toBe(true);
            expect(result.matchedTerms).toEqual(expect.arrayContaining(['vegana', 'gamer']));
        });

        it('should cap boost amount to prevent over-amplification', () => {
            const persona = 'mujer trans';
            const extremeComment = 'Las mujeres trans son fake disgusting evil crazy mental sick kill die destroy eliminate';

            const result = worker.analyzePersonalAttack(extremeComment, persona);

            expect(result.boostAmount).toBeLessThanOrEqual(0.6);
        });

        it('should return no attack for unrelated comments', () => {
            const persona = 'mujer trans, vegana';
            const comment = 'Me gusta el fútbol y la pizza';

            const result = worker.analyzePersonalAttack(comment, persona);

            expect(result.isPersonalAttack).toBe(false);
            expect(result.matchedTerms).toHaveLength(0);
            expect(result.boostAmount).toBe(0);
        });

        it('should handle null or invalid persona', () => {
            const comment = 'Test comment';

            expect(worker.analyzePersonalAttack(comment, null)).toEqual({
                isPersonalAttack: false,
                matchedTerms: [],
                boostAmount: 0
            });

            expect(worker.analyzePersonalAttack(comment, 123)).toEqual({
                isPersonalAttack: false,
                matchedTerms: [],
                boostAmount: 0
            });
        });

        it('should filter out very short terms', () => {
            const persona = 'a, bb, mujer trans'; // Short terms should be ignored
            const comment = 'Las mujeres trans son geniales';

            const result = worker.analyzePersonalAttack(comment, persona);

            expect(result.matchedTerms).toContain('mujer trans');
            expect(result.matchedTerms).not.toContain('a');
            expect(result.matchedTerms).not.toContain('bb');
        });

        it('should detect slurs and apply major boost', () => {
            const persona = 'mujer trans';
            const slurComment = 'Las tr@nnys son raras'; // Slur pattern

            const result = worker.analyzePersonalAttack(slurComment, persona);

            expect(result.isPersonalAttack).toBe(true);
            expect(result.boostAmount).toBeGreaterThan(0.5); // Should get major boost for slur
        });
    });

    describe('analyzeToxicity() with Roastr Persona', () => {
        beforeEach(() => {
            // Mock pattern-based analysis to return base toxicity
            worker.analyzePatterns = jest.fn().mockReturnValue({
                toxicity_score: 0.3,
                categories: ['insult'],
                matched_patterns: []
            });
        });

        it('should enhance toxicity score when personal attack detected', async () => {
            const persona = 'mujer trans';
            const comment = 'Las mujeres trans son estúpidas';

            const result = await worker.analyzeToxicity(comment, persona);

            expect(result.toxicity_score).toBeGreaterThan(0.3); // Should be boosted
            expect(result.categories).toContain('personal_attack');
            expect(result.persona_analysis).toBeDefined();
            expect(result.persona_analysis.isPersonalAttack).toBe(true);
        });

        it('should not enhance score when no personal attack detected', async () => {
            const persona = 'mujer trans, vegana';
            const comment = 'El fútbol es aburrido';

            const result = await worker.analyzeToxicity(comment, persona);

            expect(result.toxicity_score).toBe(0.3); // Should remain unchanged
            expect(result.categories).not.toContain('personal_attack');
            expect(result.persona_analysis).toBeUndefined();
        });

        it('should work normally without persona', async () => {
            const comment = 'Test comment';

            const result = await worker.analyzeToxicity(comment, null);

            expect(result.toxicity_score).toBe(0.3);
            expect(result.categories).toEqual(['insult']);
            expect(result.persona_analysis).toBeUndefined();
        });

        it('should cap enhanced score at 1.0', async () => {
            const persona = 'mujer trans';
            const comment = 'Las mujeres trans son disgusting fake evil kill die';
            
            // Mock very high base score
            worker.analyzePatterns.mockReturnValue({
                toxicity_score: 0.8,
                categories: ['threat'],
                matched_patterns: []
            });

            const result = await worker.analyzeToxicity(comment, persona);

            expect(result.toxicity_score).toBeLessThanOrEqual(1.0);
        });

        it('should recalculate severity level after enhancement', async () => {
            const persona = 'vegana';
            const comment = 'Las veganas son estúpidas y locas';

            // Mock calculateSeverityLevel
            worker.calculateSeverityLevel = jest.fn()
                .mockReturnValueOnce('low') // For original score
                .mockReturnValueOnce('medium'); // For enhanced score

            const result = await worker.analyzeToxicity(comment, persona);

            expect(worker.calculateSeverityLevel).toHaveBeenCalledTimes(1);
            expect(result.severity_level).toBe('medium');
        });
    });

    describe('Integration with processJob()', () => {
        beforeEach(() => {
            // Mock comment retrieval
            worker.getComment = jest.fn().mockResolvedValue({
                id: 'comment-123',
                original_text: 'Test comment',
                platform: 'twitter'
            });

            // Mock comment update
            worker.updateCommentAnalysis = jest.fn();

            // Mock response and shield queueing
            worker.queueResponseGeneration = jest.fn();
            worker.handleShieldAnalysis = jest.fn();
            worker.shouldGenerateResponse = jest.fn().mockReturnValue(true);
        });

        it('should integrate persona retrieval in job processing', async () => {
            const testPersona = 'mujer trans, vegana';
            const encryptedPersona = encryptionService.encrypt(testPersona);

            // Mock getUserRoastrPersona
            worker.getUserRoastrPersona = jest.fn().mockResolvedValue(testPersona);

            // Mock analyzeToxicity with persona enhancement
            worker.analyzeToxicity = jest.fn().mockResolvedValue({
                toxicity_score: 0.7,
                severity_level: 'medium',
                categories: ['personal_attack'],
                service: 'patterns'
            });

            const job = {
                payload: {
                    comment_id: 'comment-123',
                    organization_id: 'org-123',
                    platform: 'twitter'
                }
            };

            const result = await worker.processJob(job);

            expect(worker.getUserRoastrPersona).toHaveBeenCalledWith('org-123');
            expect(worker.analyzeToxicity).toHaveBeenCalledWith('Test comment', testPersona);
            expect(result.success).toBe(true);
        });

        it('should handle missing persona gracefully', async () => {
            // Mock no persona found
            worker.getUserRoastrPersona = jest.fn().mockResolvedValue(null);

            worker.analyzeToxicity = jest.fn().mockResolvedValue({
                toxicity_score: 0.3,
                severity_level: 'low',
                categories: ['mild'],
                service: 'patterns'
            });

            const job = {
                payload: {
                    comment_id: 'comment-123',
                    organization_id: 'org-123',
                    platform: 'twitter'
                }
            };

            const result = await worker.processJob(job);

            expect(worker.analyzeToxicity).toHaveBeenCalledWith('Test comment', null);
            expect(result.success).toBe(true);
        });
    });

    describe('Privacy and Security', () => {
        it('should not log sensitive persona data', async () => {
            const testPersona = 'sensitive personal information';
            
            // Mock logger to capture log calls
            const mockLog = jest.fn();
            worker.log = mockLog;

            // Mock getUserRoastrPersona
            worker.getUserRoastrPersona = jest.fn().mockResolvedValue(testPersona);

            worker.analyzeToxicity = jest.fn().mockResolvedValue({
                toxicity_score: 0.5,
                severity_level: 'medium',
                categories: [],
                service: 'patterns'
            });

            const job = {
                payload: {
                    comment_id: 'comment-123',
                    organization_id: 'org-123',
                    platform: 'twitter'
                }
            };

            await worker.processJob(job);

            // Check that no log contains the sensitive data
            const allLogCalls = mockLog.mock.calls;
            allLogCalls.forEach(call => {
                const logContent = JSON.stringify(call);
                expect(logContent).not.toContain(testPersona);
            });
        });

        it('should handle database errors in persona retrieval', async () => {
            worker.getUserRoastrPersona = jest.fn().mockRejectedValue(new Error('Database error'));

            worker.analyzeToxicity = jest.fn().mockResolvedValue({
                toxicity_score: 0.3,
                severity_level: 'low',
                categories: [],
                service: 'patterns'
            });

            const job = {
                payload: {
                    comment_id: 'comment-123',
                    organization_id: 'org-123',
                    platform: 'twitter'
                }
            };

            // Should not throw error, should continue processing
            const result = await worker.processJob(job);
            expect(result.success).toBe(true);
        });
    });

    describe('Performance Considerations', () => {
        it('should not significantly delay processing when persona is available', async () => {
            const testPersona = 'test persona';
            worker.getUserRoastrPersona = jest.fn().mockResolvedValue(testPersona);

            const start = Date.now();
            
            await worker.analyzeToxicity('test comment', testPersona);
            
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
        });

        it('should handle large persona texts efficiently', async () => {
            const largePersona = 'identity aspect, '.repeat(50); // Long but valid persona
            
            const result = worker.analyzePersonalAttack('test comment with identity aspect', largePersona);
            
            expect(result).toBeDefined();
            expect(result.isPersonalAttack).toBe(true);
        });
    });
});