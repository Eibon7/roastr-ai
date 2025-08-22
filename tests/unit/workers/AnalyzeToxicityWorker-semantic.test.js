const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');
const EmbeddingsService = require('../../../src/services/embeddingsService');

// Mock dependencies
jest.mock('../../../src/services/costControl');
jest.mock('../../../src/services/shieldService');
jest.mock('../../../src/services/embeddingsService');
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn()
  }
}));

describe('AnalyzeToxicityWorker - Semantic Matching (Issue #151)', () => {
  let worker;
  let mockEmbeddingsService;

  beforeEach(() => {
    // Setup mock embeddings service
    mockEmbeddingsService = {
      findSemanticMatches: jest.fn(),
      processPersonaText: jest.fn(),
      generateEmbedding: jest.fn(),
      getStats: jest.fn().mockReturnValue({ embeddings_generated: 0 })
    };
    
    EmbeddingsService.mockImplementation(() => mockEmbeddingsService);
    
    worker = new AnalyzeToxicityWorker();
    
    // Mock supabase methods
    worker.supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAutoBlock with semantic matching', () => {
    it('should use exact matching first', async () => {
      const text = 'You are so stupid';
      const intoleranceData = 'stupid, idiot, moron';
      const intoleranceEmbeddings = null;

      const result = await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms).toContain('stupid');
      expect(result.matchedCategories).toContain('general_intolerance');
      expect(mockEmbeddingsService.findSemanticMatches).not.toHaveBeenCalled();
    });

    it('should fall back to semantic matching when no exact matches', async () => {
      const text = 'You are so dumb and foolish';
      const intoleranceData = 'stupid, idiot, moron';
      const intoleranceEmbeddings = [
        { term: 'stupid', embedding: [0.1, 0.2, 0.3] },
        { term: 'idiot', embedding: [0.4, 0.5, 0.6] },
        { term: 'moron', embedding: [0.7, 0.8, 0.9] }
      ];

      // Mock semantic matches
      mockEmbeddingsService.findSemanticMatches.mockResolvedValue({
        matches: [
          { term: 'stupid', similarity: 0.87, type: 'semantic_match' }
        ],
        maxSimilarity: 0.87,
        avgSimilarity: 0.87,
        threshold: 0.85
      });

      const result = await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms).toContain('stupid (semantic: 0.87)');
      expect(result.matchedCategories).toContain('semantic_intolerance_match');
      expect(mockEmbeddingsService.findSemanticMatches).toHaveBeenCalledWith(
        text,
        intoleranceEmbeddings,
        'intolerance'
      );
    });

    it('should not block when semantic similarity is below threshold', async () => {
      const text = 'This is a completely unrelated comment about weather';
      const intoleranceData = 'stupid, idiot, moron';
      const intoleranceEmbeddings = [
        { term: 'stupid', embedding: [0.1, 0.2, 0.3] }
      ];

      mockEmbeddingsService.findSemanticMatches.mockResolvedValue({
        matches: [], // No matches above threshold
        maxSimilarity: 0.3,
        avgSimilarity: 0.3,
        threshold: 0.85
      });

      const result = await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      expect(result.shouldBlock).toBe(false);
      expect(result.matchedTerms).toHaveLength(0);
    });

    it('should handle semantic matching errors gracefully', async () => {
      const text = 'Test comment';
      const intoleranceData = 'stupid, idiot';
      const intoleranceEmbeddings = [
        { term: 'stupid', embedding: [0.1, 0.2, 0.3] }
      ];

      mockEmbeddingsService.findSemanticMatches.mockRejectedValue(new Error('API error'));

      const result = await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      // Should fall back to pattern matching
      expect(result.shouldBlock).toBe(false); // No pattern matches in this case
      expect(mockEmbeddingsService.findSemanticMatches).toHaveBeenCalled();
    });

    it('should prioritize exact matches over semantic matches', async () => {
      const text = 'You are stupid and dumb';
      const intoleranceData = 'stupid, idiot';
      const intoleranceEmbeddings = [
        { term: 'idiot', embedding: [0.1, 0.2, 0.3] }
      ];

      const result = await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      expect(result.shouldBlock).toBe(true);
      expect(result.matchedTerms).toContain('stupid'); // Exact match
      expect(mockEmbeddingsService.findSemanticMatches).not.toHaveBeenCalled();
    });
  });

  describe('checkTolerance with semantic matching', () => {
    it('should use exact matching first for tolerance', async () => {
      const text = 'You look fat today';
      const toleranceData = 'fat, ugly, appearance';
      const toleranceEmbeddings = null;

      const result = await worker.checkTolerance(text, toleranceData, toleranceEmbeddings);

      expect(result.shouldIgnore).toBe(true);
      expect(result.matchedTerms).toContain('fat');
      expect(result.matchedCategories).toContain('appearance_tolerance');
      expect(mockEmbeddingsService.findSemanticMatches).not.toHaveBeenCalled();
    });

    it('should fall back to semantic matching for tolerance', async () => {
      const text = 'You look overweight and unattractive';
      const toleranceData = 'fat, ugly, appearance';
      const toleranceEmbeddings = [
        { term: 'fat', embedding: [0.1, 0.2, 0.3] },
        { term: 'ugly', embedding: [0.4, 0.5, 0.6] }
      ];

      mockEmbeddingsService.findSemanticMatches.mockResolvedValue({
        matches: [
          { term: 'fat', similarity: 0.83, type: 'semantic_match' },
          { term: 'ugly', similarity: 0.81, type: 'semantic_match' }
        ],
        maxSimilarity: 0.83,
        avgSimilarity: 0.82,
        threshold: 0.80
      });

      const result = await worker.checkTolerance(text, toleranceData, toleranceEmbeddings);

      expect(result.shouldIgnore).toBe(true);
      expect(result.matchedTerms).toContain('fat (semantic: 0.83)');
      expect(result.matchedTerms).toContain('ugly (semantic: 0.81)');
      expect(result.matchedCategories).toContain('semantic_tolerance_match');
      expect(mockEmbeddingsService.findSemanticMatches).toHaveBeenCalledWith(
        text,
        toleranceEmbeddings,
        'tolerance'
      );
    });

    it('should not ignore when tolerance similarity is below threshold', async () => {
      const text = 'This comment is about programming';
      const toleranceData = 'fat, ugly, appearance';
      const toleranceEmbeddings = [
        { term: 'fat', embedding: [0.1, 0.2, 0.3] }
      ];

      mockEmbeddingsService.findSemanticMatches.mockResolvedValue({
        matches: [], // No matches above threshold
        maxSimilarity: 0.2,
        avgSimilarity: 0.2,
        threshold: 0.80
      });

      const result = await worker.checkTolerance(text, toleranceData, toleranceEmbeddings);

      expect(result.shouldIgnore).toBe(false);
      expect(result.matchedTerms).toHaveLength(0);
    });
  });

  describe('getUserIntolerancePreferences with embeddings', () => {
    beforeEach(() => {
      worker.supabase.single.mockResolvedValue({
        data: { owner_id: 'user-123' },
        error: null
      });
    });

    it('should return both text and embeddings when available', async () => {
      const mockUserData = {
        lo_que_no_tolero_encrypted: 'encrypted-intolerance-data',
        lo_que_no_tolero_embedding: JSON.stringify([
          { term: 'stupid', embedding: [0.1, 0.2, 0.3] },
          { term: 'idiot', embedding: [0.4, 0.5, 0.6] }
        ])
      };

      worker.supabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'user-123' }, error: null })
        .mockResolvedValueOnce({ data: mockUserData, error: null });

      // Mock encryption service
      const encryptionService = require('../../../src/services/encryptionService');
      encryptionService.decrypt = jest.fn().mockReturnValue('stupid, idiot, moron');

      const result = await worker.getUserIntolerancePreferences('org-123');

      expect(result).toEqual({
        text: 'stupid, idiot, moron',
        embeddings: [
          { term: 'stupid', embedding: [0.1, 0.2, 0.3] },
          { term: 'idiot', embedding: [0.4, 0.5, 0.6] }
        ]
      });
    });

    it('should handle missing embeddings gracefully', async () => {
      const mockUserData = {
        lo_que_no_tolero_encrypted: 'encrypted-intolerance-data',
        lo_que_no_tolero_embedding: null
      };

      worker.supabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'user-123' }, error: null })
        .mockResolvedValueOnce({ data: mockUserData, error: null });

      const encryptionService = require('../../../src/services/encryptionService');
      encryptionService.decrypt = jest.fn().mockReturnValue('stupid, idiot, moron');

      const result = await worker.getUserIntolerancePreferences('org-123');

      expect(result).toEqual({
        text: 'stupid, idiot, moron',
        embeddings: null
      });
    });

    it('should handle corrupted embeddings gracefully', async () => {
      const mockUserData = {
        lo_que_no_tolero_encrypted: 'encrypted-intolerance-data',
        lo_que_no_tolero_embedding: 'invalid-json'
      };

      worker.supabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'user-123' }, error: null })
        .mockResolvedValueOnce({ data: mockUserData, error: null });

      const encryptionService = require('../../../src/services/encryptionService');
      encryptionService.decrypt = jest.fn().mockReturnValue('stupid, idiot, moron');

      const result = await worker.getUserIntolerancePreferences('org-123');

      expect(result).toEqual({
        text: 'stupid, idiot, moron',
        embeddings: null
      });
    });
  });

  describe('getUserTolerancePreferences with embeddings', () => {
    beforeEach(() => {
      worker.supabase.single.mockResolvedValue({
        data: { owner_id: 'user-123' },
        error: null
      });
    });

    it('should return both text and embeddings when available', async () => {
      const mockUserData = {
        lo_que_me_da_igual_encrypted: 'encrypted-tolerance-data',
        lo_que_me_da_igual_embedding: JSON.stringify([
          { term: 'fat', embedding: [0.1, 0.2, 0.3] },
          { term: 'ugly', embedding: [0.4, 0.5, 0.6] }
        ])
      };

      worker.supabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'user-123' }, error: null })
        .mockResolvedValueOnce({ data: mockUserData, error: null });

      const encryptionService = require('../../../src/services/encryptionService');
      encryptionService.decrypt = jest.fn().mockReturnValue('fat, ugly, appearance');

      const result = await worker.getUserTolerancePreferences('org-123');

      expect(result).toEqual({
        text: 'fat, ugly, appearance',
        embeddings: [
          { term: 'fat', embedding: [0.1, 0.2, 0.3] },
          { term: 'ugly', embedding: [0.4, 0.5, 0.6] }
        ]
      });
    });
  });

  describe('integration with processJob', () => {
    beforeEach(() => {
      // Mock cost control
      worker.costControl = {
        canPerformOperation: jest.fn().mockResolvedValue({ allowed: true }),
        recordUsage: jest.fn().mockResolvedValue(true)
      };

      // Mock shield service
      worker.shieldService = {
        analyzeForShield: jest.fn().mockResolvedValue({ shieldActive: false })
      };

      // Mock comment data
      worker.supabase.single.mockResolvedValue({
        data: {
          id: 'comment-123',
          original_text: 'You stupid developer',
          platform: 'twitter'
        },
        error: null
      });
    });

    it('should use semantic matching in auto-block flow', async () => {
      // Mock intolerance preferences with embeddings
      worker.getUserIntolerancePreferences = jest.fn().mockResolvedValue({
        text: 'stupid, idiot',
        embeddings: [
          { term: 'stupid', embedding: [0.1, 0.2, 0.3] }
        ]
      });

      worker.getUserTolerancePreferences = jest.fn().mockResolvedValue(null);
      worker.getUserRoastrPersona = jest.fn().mockResolvedValue(null);
      worker.updateCommentAnalysis = jest.fn().mockResolvedValue(true);
      worker.handleAutoBlockShieldAction = jest.fn().mockResolvedValue({ shieldActive: true });

      const jobPayload = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        text: 'You stupid developer'
      };

      const result = await worker.processJob(jobPayload);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('auto-blocked');
      expect(result.autoBlocked).toBe(true);
      expect(worker.getUserIntolerancePreferences).toHaveBeenCalledWith('org-123');
    });

    it('should use semantic matching in tolerance flow', async () => {
      // Mock no intolerance, but tolerance preferences with embeddings
      worker.getUserIntolerancePreferences = jest.fn().mockResolvedValue(null);
      worker.getUserTolerancePreferences = jest.fn().mockResolvedValue({
        text: 'developer, programmer',
        embeddings: [
          { term: 'developer', embedding: [0.1, 0.2, 0.3] }
        ]
      });
      worker.getUserRoastrPersona = jest.fn().mockResolvedValue(null);
      worker.updateCommentAnalysis = jest.fn().mockResolvedValue(true);

      // Mock tolerance match
      mockEmbeddingsService.findSemanticMatches.mockResolvedValue({
        matches: [
          { term: 'developer', similarity: 0.95, type: 'semantic_match' }
        ],
        maxSimilarity: 0.95,
        threshold: 0.80
      });

      const jobPayload = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        text: 'You stupid developer'
      };

      const result = await worker.processJob(jobPayload);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('ignored');
      expect(result.toleranceIgnored).toBe(true);
      expect(worker.getUserTolerancePreferences).toHaveBeenCalledWith('org-123');
    });
  });

  describe('performance considerations', () => {
    it('should not call embeddings service when no embeddings are available', async () => {
      const text = 'Test comment';
      const intoleranceData = 'stupid, idiot';
      const intoleranceEmbeddings = null;

      await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      expect(mockEmbeddingsService.findSemanticMatches).not.toHaveBeenCalled();
    });

    it('should skip semantic matching when exact matches are found', async () => {
      const text = 'You are stupid';
      const intoleranceData = 'stupid, idiot';
      const intoleranceEmbeddings = [
        { term: 'idiot', embedding: [0.1, 0.2, 0.3] }
      ];

      await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      expect(mockEmbeddingsService.findSemanticMatches).not.toHaveBeenCalled();
    });

    it('should track semantic matching performance', async () => {
      const text = 'Test comment with no exact matches';
      const intoleranceData = 'different, terms';
      const intoleranceEmbeddings = [
        { term: 'different', embedding: [0.1, 0.2, 0.3] }
      ];

      mockEmbeddingsService.findSemanticMatches.mockResolvedValue({
        matches: [],
        maxSimilarity: 0.3,
        threshold: 0.85
      });

      const result = await worker.checkAutoBlock(text, intoleranceData, intoleranceEmbeddings);

      expect(result.analysisTime).toBeGreaterThan(0);
      expect(mockEmbeddingsService.findSemanticMatches).toHaveBeenCalled();
    });
  });
});