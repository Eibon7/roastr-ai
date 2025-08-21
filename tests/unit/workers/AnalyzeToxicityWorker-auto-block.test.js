const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');
const { mockMode } = require('../../../src/config/mockMode');

describe('AnalyzeToxicityWorker - Auto-Block Functionality (Issue #149)', () => {
  let worker;
  let mockSupabase;
  let mockCostControl;
  let mockShieldService;
  let mockEncryptionService;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      rpush: jest.fn()
    };

    // Mock cost control service
    mockCostControl = {
      canPerformOperation: jest.fn().mockResolvedValue({ allowed: true }),
      recordUsage: jest.fn().mockResolvedValue(true)
    };

    // Mock shield service
    mockShieldService = {
      analyzeForShield: jest.fn().mockResolvedValue({
        shieldActive: true,
        priority: 1,
        actions: { primary: ['block', 'mute'] },
        autoExecuted: true
      })
    };

    // Mock encryption service
    mockEncryptionService = {
      decrypt: jest.fn((encrypted) => {
        if (encrypted === 'encrypted_test_preferences') {
          return 'insultos raciales, comentarios sobre peso, odio hacia veganos';
        }
        if (encrypted === 'encrypted_identity') {
          return 'mujer trans, vegana';
        }
        throw new Error('Invalid encrypted data');
      })
    };

    // Mock dependencies
    jest.mock('../../../src/services/costControl', () => {
      return jest.fn().mockImplementation(() => mockCostControl);
    });

    jest.mock('../../../src/services/shieldService', () => {
      return jest.fn().mockImplementation(() => mockShieldService);
    });

    jest.mock('../../../src/services/encryptionService', () => mockEncryptionService);

    jest.mock('../../../src/config/mockMode', () => ({
      mockMode: { isMockMode: true },
      generateMockPerspective: jest.fn(),
      generateMockOpenAI: jest.fn()
    }));

    // Create worker instance
    worker = new AnalyzeToxicityWorker({
      maxConcurrency: 1,
      pollInterval: 100
    });

    // Mock the Supabase connection
    worker.supabase = mockSupabase;
    worker.redis = { rpush: jest.fn() };

    // Mock logger
    worker.log = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('getUserIntolerancePreferences', () => {
    it('should retrieve and decrypt user intolerance preferences', async () => {
      const organizationId = 'test-org-id';
      const userId = 'test-user-id';

      // Mock organization lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { owner_id: userId },
          error: null
        })
        // Mock user intolerance data lookup
        .mockResolvedValueOnce({
          data: { lo_que_no_tolero_encrypted: 'encrypted_test_preferences' },
          error: null
        });

      const result = await worker.getUserIntolerancePreferences(organizationId);

      expect(result).toBe('insultos raciales, comentarios sobre peso, odio hacia veganos');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted_test_preferences');
      expect(worker.log).toHaveBeenCalledWith('debug', expect.stringContaining('Retrieved user intolerance preferences'), expect.any(Object));
    });

    it('should return null when user has no intolerance preferences', async () => {
      const organizationId = 'test-org-id';
      const userId = 'test-user-id';

      // Mock organization lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { owner_id: userId },
          error: null
        })
        // Mock user with no intolerance data
        .mockResolvedValueOnce({
          data: { lo_que_no_tolero_encrypted: null },
          error: null
        });

      const result = await worker.getUserIntolerancePreferences(organizationId);

      expect(result).toBe(null);
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it('should handle decryption errors gracefully', async () => {
      const organizationId = 'test-org-id';
      const userId = 'test-user-id';

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { owner_id: userId },
          error: null
        })
        .mockResolvedValueOnce({
          data: { lo_que_no_tolero_encrypted: 'invalid_encrypted_data' },
          error: null
        });

      const result = await worker.getUserIntolerancePreferences(organizationId);

      expect(result).toBe(null);
      expect(worker.log).toHaveBeenCalledWith('error', expect.stringContaining('Failed to decrypt'), expect.any(Object));
    });

    it('should return null when organization is not found', async () => {
      const organizationId = 'nonexistent-org-id';

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Organization not found' }
      });

      const result = await worker.getUserIntolerancePreferences(organizationId);

      expect(result).toBe(null);
      expect(worker.log).toHaveBeenCalledWith('warn', expect.stringContaining('Could not get organization owner'), expect.any(Object));
    });
  });

  describe('checkAutoBlock', () => {
    it('should block comments containing exact intolerance terms', async () => {
      const text = 'Eres una persona horrible con comentarios sobre peso que no toleramos';
      const intoleranceData = 'insultos raciales, comentarios sobre peso, odio hacia veganos';

      const result = await worker.checkAutoBlock(text, intoleranceData);

      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms).toContain('comentarios sobre peso');
      expect(result.matchedCategories).toContain('body_shaming_intolerance');
      expect(result.reason).toContain('comentarios sobre peso');
      expect(result.analysisTime).toBeGreaterThan(0);
    });

    it('should block comments with multiple matching terms', async () => {
      const text = 'Eres vegana estúpida y tus insultos raciales son patéticos';
      const intoleranceData = 'insultos raciales, comentarios sobre peso, odio hacia veganos';

      const result = await worker.checkAutoBlock(text, intoleranceData);

      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms).toEqual(expect.arrayContaining(['insultos raciales', 'odio hacia veganos']));
      expect(result.matchedCategories).toEqual(expect.arrayContaining(['racial_intolerance', 'general_intolerance']));
    });

    it('should categorize different types of intolerance correctly', async () => {
      const testCases = [
        {
          text: 'comentarios raciales horrible',
          intolerance: 'comentarios raciales',
          expectedCategory: 'racial_intolerance'
        },
        {
          text: 'comentarios sobre tu peso',
          intolerance: 'comentarios sobre peso',
          expectedCategory: 'body_shaming_intolerance'
        },
        {
          text: 'política de izquierdas',
          intolerance: 'política de izquierdas',
          expectedCategory: 'political_intolerance'
        },
        {
          text: 'personas trans',
          intolerance: 'trans',
          expectedCategory: 'identity_intolerance'
        }
      ];

      for (const testCase of testCases) {
        const result = await worker.checkAutoBlock(testCase.text, testCase.intolerance);
        expect(result.shouldBlock).toBe(true);
        expect(result.matchedCategories).toContain(testCase.expectedCategory);
      }
    });

    it('should not block comments without matching terms', async () => {
      const text = 'Este es un comentario normal sin contenido problemático';
      const intoleranceData = 'insultos raciales, comentarios sobre peso, odio hacia veganos';

      const result = await worker.checkAutoBlock(text, intoleranceData);

      expect(result.shouldBlock).toBe(false);
      expect(result.matchedTerms).toHaveLength(0);
      expect(result.matchedCategories).toHaveLength(0);
      expect(result.reason).toBe('');
    });

    it('should handle empty or null intolerance data', async () => {
      const text = 'Cualquier comentario';

      const nullResult = await worker.checkAutoBlock(text, null);
      expect(nullResult.shouldBlock).toBe(false);
      expect(nullResult.reason).toContain('No intolerance preferences defined');

      const emptyResult = await worker.checkAutoBlock(text, '');
      expect(emptyResult.shouldBlock).toBe(false);

      const undefinedResult = await worker.checkAutoBlock(text, undefined);
      expect(undefinedResult.shouldBlock).toBe(false);
    });

    it('should handle case-insensitive matching', async () => {
      const text = 'INSULTOS RACIALES en mayúsculas';
      const intoleranceData = 'insultos raciales';

      const result = await worker.checkAutoBlock(text, intoleranceData);

      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms).toContain('insultos raciales');
    });

    it('should check semantic matches when no exact matches found', async () => {
      const text = 'odio veganos estúpidos';
      const intoleranceData = 'odio hacia veganos';

      const result = await worker.checkAutoBlock(text, intoleranceData);

      // Should match through semantic analysis (most words present)
      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms.length).toBeGreaterThan(0);
      expect(result.matchedCategories).toEqual(expect.arrayContaining(['semantic_match']));
    });

    it('should filter out very short terms', async () => {
      const text = 'Este comentario contiene la palabra "es"';
      const intoleranceData = 'es, un, comentario, insultos raciales'; // Short terms should be filtered

      const result = await worker.checkAutoBlock(text, intoleranceData);

      expect(result.shouldBlock).toBe(false); // Only long term "insultos raciales" should be considered
    });
  });

  describe('checkWordVariations', () => {
    it('should detect plurals', () => {
      expect(worker.checkWordVariations('insultos raciales', 'insulto')).toBe(true);
      expect(worker.checkWordVariations('comentarios malos', 'comentario')).toBe(true);
    });

    it('should detect l33t speak variations', () => {
      expect(worker.checkWordVariations('h@t3 speech', 'hate')).toBe(true);
      expect(worker.checkWordVariations('r@c1st comment', 'racist')).toBe(true);
    });

    it('should detect word stems', () => {
      expect(worker.checkWordVariations('running fast', 'run')).toBe(true);
      expect(worker.checkWordVariations('beautiful person', 'beauty')).toBe(true);
    });

    it('should not match unrelated words', () => {
      expect(worker.checkWordVariations('hello world', 'goodbye')).toBe(false);
      expect(worker.checkWordVariations('nice person', 'terrible')).toBe(false);
    });
  });

  describe('Integration: processJob with auto-blocking', () => {
    it('should auto-block comment and skip normal analysis when intolerance match found', async () => {
      const job = {
        comment_id: 'test-comment-id',
        organization_id: 'test-org-id',
        platform: 'twitter',
        text: 'Eres vegana estúpida y tus insultos raciales son patéticos'
      };

      // Mock comment lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'test-comment-id',
            original_text: job.text,
            platform: 'twitter'
          },
          error: null
        })
        // Mock organization lookup for intolerance
        .mockResolvedValueOnce({
          data: { owner_id: 'test-user-id' },
          error: null
        })
        // Mock user intolerance data
        .mockResolvedValueOnce({
          data: { lo_que_no_tolero_encrypted: 'encrypted_test_preferences' },
          error: null
        });

      // Mock comment update
      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.autoBlocked).toBe(true);
      expect(result.toxicityScore).toBe(1.0);
      expect(result.severityLevel).toBe('critical');
      expect(result.service).toBe('auto_block');
      expect(result.matchedTerms).toEqual(expect.arrayContaining(['insultos raciales', 'odio hacia veganos']));

      // Verify comment was updated with auto-block analysis
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          toxicity_score: 1.0,
          severity_level: 'critical',
          categories: expect.arrayContaining(['auto_blocked', 'user_intolerance']),
          status: 'processed'
        })
      );

      // Verify usage was recorded for auto-blocking
      expect(mockCostControl.recordUsage).toHaveBeenCalledWith(
        'test-org-id',
        'twitter',
        'auto_block_intolerance',
        expect.objectContaining({
          commentId: 'test-comment-id',
          analysisService: 'auto_block',
          severity: 'critical',
          toxicityScore: 1.0
        }),
        null,
        1
      );

      // Verify Shield was activated with highest priority
      expect(mockShieldService.analyzeForShield).toHaveBeenCalledWith(
        'test-org-id',
        expect.any(Object),
        expect.objectContaining({
          auto_blocked: true,
          shield_priority: 0,
          auto_block_shield: true,
          immediate_action: true
        })
      );
    });

    it('should proceed with normal analysis when no intolerance match found', async () => {
      const job = {
        comment_id: 'test-comment-id',
        organization_id: 'test-org-id',
        platform: 'twitter',
        text: 'Este es un comentario normal'
      };

      // Mock comment lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'test-comment-id',
            original_text: job.text,
            platform: 'twitter'
          },
          error: null
        })
        // Mock organization lookup for intolerance
        .mockResolvedValueOnce({
          data: { owner_id: 'test-user-id' },
          error: null
        })
        // Mock user intolerance data
        .mockResolvedValueOnce({
          data: { lo_que_no_tolero_encrypted: 'encrypted_test_preferences' },
          error: null
        })
        // Mock organization lookup for persona
        .mockResolvedValueOnce({
          data: { owner_id: 'test-user-id' },
          error: null
        })
        // Mock user persona data
        .mockResolvedValueOnce({
          data: { lo_que_me_define_encrypted: 'encrypted_identity' },
          error: null
        });

      // Mock comment update
      mockSupabase.update.mockResolvedValue({ error: null });

      // Mock pattern-based analysis (since we're in mock mode)
      worker.analyzePatterns = jest.fn().mockReturnValue({
        toxicity_score: 0.2,
        categories: ['low_toxicity'],
        matched_patterns: []
      });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.autoBlocked).toBeUndefined(); // Not auto-blocked
      expect(result.toxicityScore).toBe(0.2); // From normal analysis
      expect(result.service).toBe('patterns'); // Normal analysis service

      // Verify normal analysis was performed
      expect(worker.analyzePatterns).toHaveBeenCalledWith('Este es un comentario normal');
    });

    it('should handle auto-blocking when user has no normal persona but has intolerance preferences', async () => {
      const job = {
        comment_id: 'test-comment-id',
        organization_id: 'test-org-id',
        platform: 'twitter',
        text: 'Comentarios sobre peso son horribles'
      };

      // Mock comment lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'test-comment-id',
            original_text: job.text,
            platform: 'twitter'
          },
          error: null
        })
        // Mock organization lookup for intolerance
        .mockResolvedValueOnce({
          data: { owner_id: 'test-user-id' },
          error: null
        })
        // Mock user with intolerance but no identity persona
        .mockResolvedValueOnce({
          data: { lo_que_no_tolero_encrypted: 'encrypted_test_preferences' },
          error: null
        });

      // Mock comment update
      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await worker.processJob(job);

      expect(result.success).toBe(true);
      expect(result.autoBlocked).toBe(true);
      expect(result.matchedTerms).toContain('comentarios sobre peso');

      // Verify auto-blocking worked even without identity persona
      expect(result.toxicityScore).toBe(1.0);
      expect(result.severityLevel).toBe('critical');
    });
  });

  describe('Security and Performance', () => {
    it('should handle large intolerance preference lists efficiently', async () => {
      const largeIntoleranceList = Array.from({ length: 100 }, (_, i) => `term${i}`).join(', ');
      const text = 'This contains term50 which should be detected';

      const startTime = Date.now();
      const result = await worker.checkAutoBlock(text, largeIntoleranceList);
      const endTime = Date.now();

      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms).toContain('term50');
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should not log sensitive intolerance terms in debug logs', async () => {
      const organizationId = 'test-org-id';
      const userId = 'test-user-id';
      const sensitiveTerms = 'private personal information';

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { owner_id: userId },
          error: null
        })
        .mockResolvedValueOnce({
          data: { lo_que_no_tolero_encrypted: 'encrypted_sensitive' },
          error: null
        });

      mockEncryptionService.decrypt.mockReturnValue(sensitiveTerms);

      await worker.getUserIntolerancePreferences(organizationId);

      // Check that sensitive terms are not logged
      const logCalls = worker.log.mock.calls;
      const debugLogCall = logCalls.find(call => call[0] === 'debug');
      
      expect(debugLogCall).toBeTruthy();
      expect(debugLogCall[2]).not.toHaveProperty('intoleranceTerms');
      expect(debugLogCall[2]).not.toHaveProperty('decryptedContent');
    });

    it('should handle concurrent auto-block checks safely', async () => {
      const text = 'comentarios sobre peso';
      const intoleranceData = 'comentarios sobre peso, insultos raciales';

      // Run multiple concurrent checks
      const promises = Array.from({ length: 10 }, () =>
        worker.checkAutoBlock(text, intoleranceData)
      );

      const results = await Promise.all(promises);

      // All should return consistent results
      results.forEach(result => {
        expect(result.shouldBlock).toBe(true);
        expect(result.matchedTerms).toContain('comentarios sobre peso');
      });
    });

    it('should prevent injection attacks through intolerance preferences', async () => {
      const maliciousInput = 'normal text';
      const maliciousIntolerance = '"; DROP TABLE users; --';

      const result = await worker.checkAutoBlock(maliciousInput, maliciousIntolerance);

      // Should treat malicious intolerance as regular text, not cause errors
      expect(result.shouldBlock).toBe(false);
      expect(() => result).not.toThrow();
    });
  });
});