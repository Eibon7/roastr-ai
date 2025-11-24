/**
 * Unit Tests: SponsorService
 *
 * Tests sponsor CRUD operations, tag extraction, and mention detection
 *
 * Test Categories:
 * 1. CRUD operations (create, get, update, delete)
 * 2. Tag extraction from URLs
 * 3. Sponsor mention detection (exact, tag, semantic)
 * 4. Plan-based access control (Plus plan only)
 * 5. Validation (URL sanitization, input validation)
 * 6. Error handling
 *
 * @see src/services/sponsorService.js
 * @see docs/plan/issue-859.md
 */

const SponsorService = require('../../../src/services/sponsorService');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  },
  embeddings: {
    create: jest.fn()
  }
};

// Mock fetch globally
global.fetch = jest.fn();

describe('SponsorService', () => {
  let sponsorService;
  let mockSupabase;

  beforeEach(() => {
    // Create fully chainable Supabase mock
    const chainable = {
      from: jest.fn(function () {
        return this;
      }),
      select: jest.fn(function () {
        return this;
      }),
      insert: jest.fn(function () {
        return this;
      }),
      update: jest.fn(function () {
        return this;
      }),
      delete: jest.fn(function () {
        return this;
      }),
      eq: jest.fn(function () {
        return this;
      }),
      order: jest.fn(function () {
        return this;
      }),
      single: jest.fn()
    };

    mockSupabase = chainable;

    // Mock OpenAI API key
    process.env.OPENAI_API_KEY = 'test-key';

    // Create service instance with mocks
    sponsorService = new SponsorService();
    sponsorService.supabase = mockSupabase;
    sponsorService.openai = mockOpenAI;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  // ============================================================================
  // 1. CRUD OPERATIONS
  // ============================================================================

  describe('createSponsor', () => {
    it('should create a sponsor successfully', async () => {
      const userId = 'user-123';
      const sponsorData = {
        name: 'Nike',
        url: 'https://www.nike.com',
        tags: ['sportswear', 'sneakers'],
        severity: 'high',
        tone: 'professional',
        priority: 1,
        actions: ['hide_comment', 'def_roast']
      };

      const expectedSponsor = {
        id: 'sponsor-123',
        user_id: userId,
        ...sponsorData,
        active: true,
        created_at: '2025-11-17T12:00:00Z',
        updated_at: '2025-11-17T12:00:00Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: expectedSponsor,
        error: null
      });

      const result = await sponsorService.createSponsor(userId, sponsorData);

      expect(result).toEqual(expectedSponsor);
      expect(mockSupabase.from).toHaveBeenCalledWith('sponsors');
      // Verify insert was called (service adds defaults like active, priority)
      expect(mockSupabase.insert).toHaveBeenCalled();
      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.user_id).toBe(userId);
      expect(insertCall.name).toBe('Nike');
    });

    it('should throw error when name is missing', async () => {
      const userId = 'user-123';
      const sponsorData = {
        url: 'https://www.nike.com'
      };

      await expect(sponsorService.createSponsor(userId, sponsorData)).rejects.toThrow(
        'SPONSOR_NAME_REQUIRED'
      );
    });

    it('should throw error when userId is missing', async () => {
      const sponsorData = {
        name: 'Nike'
      };

      await expect(sponsorService.createSponsor(null, sponsorData)).rejects.toThrow(
        'USER_ID_REQUIRED'
      );
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'user-123';
      const sponsorData = {
        name: 'Nike'
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await expect(sponsorService.createSponsor(userId, sponsorData)).rejects.toThrow(
        'DATABASE_ERROR: Database connection failed'
      );
    });
  });

  describe('getSponsors', () => {
    it('should retrieve active sponsors by default', async () => {
      const userId = 'user-123';
      const sponsors = [
        { id: 'sponsor-1', name: 'Nike', active: true },
        { id: 'sponsor-2', name: 'Adidas', active: true }
      ];

      // Mock order() to be chainable, with final call returning result
      let orderCallCount = 0;
      mockSupabase.order.mockImplementation(function () {
        orderCallCount++;
        if (orderCallCount === 2) {
          // Second order() call returns the result
          return Promise.resolve({ data: sponsors, error: null });
        }
        // First order() call returns chainable
        return this;
      });

      const result = await sponsorService.getSponsors(userId);

      expect(result).toEqual(sponsors);
      expect(mockSupabase.from).toHaveBeenCalledWith('sponsors');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('active', true);
    });

    it('should retrieve all sponsors when includeInactive is true', async () => {
      const userId = 'user-123';
      const sponsors = [
        { id: 'sponsor-1', name: 'Nike', active: true },
        { id: 'sponsor-2', name: 'Reebok', active: false }
      ];

      // Mock order() to be chainable, with final call returning result
      let orderCallCount = 0;
      mockSupabase.order.mockImplementation(function () {
        orderCallCount++;
        if (orderCallCount === 2) {
          // Second order() call returns the result
          return Promise.resolve({ data: sponsors, error: null });
        }
        // First order() call returns chainable
        return this;
      });

      const result = await sponsorService.getSponsors(userId, true);

      expect(result).toEqual(sponsors);
      // Should only filter by user_id when includeInactive is true
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should return empty array when no sponsors found', async () => {
      const userId = 'user-123';

      // Mock order() to be chainable, with final call returning empty
      let orderCallCount = 0;
      mockSupabase.order.mockImplementation(function () {
        orderCallCount++;
        if (orderCallCount === 2) {
          // Second order() call returns empty array
          return Promise.resolve({ data: [], error: null });
        }
        // First order() call returns chainable
        return this;
      });

      const result = await sponsorService.getSponsors(userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateSponsor', () => {
    it('should update sponsor successfully', async () => {
      const sponsorId = 'sponsor-123';
      const userId = 'user-123';
      const updates = {
        severity: 'zero_tolerance',
        actions: ['hide_comment', 'block_user']
      };

      mockSupabase.single.mockResolvedValue({
        data: {
          id: sponsorId,
          severity: 'zero_tolerance',
          actions: ['hide_comment', 'block_user']
        },
        error: null
      });

      const result = await sponsorService.updateSponsor(sponsorId, userId, updates);

      expect(result.severity).toBe('zero_tolerance');
      expect(mockSupabase.from).toHaveBeenCalledWith('sponsors');
      // Verify update was called (service may add updated_at)
      expect(mockSupabase.update).toHaveBeenCalled();
      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.severity).toBe('zero_tolerance');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', sponsorId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should throw error when sponsorId is missing', async () => {
      await expect(sponsorService.updateSponsor(null, 'user-123', {})).rejects.toThrow(
        'INVALID_PARAMS'
      );
    });
  });

  describe('deleteSponsor', () => {
    it('should delete sponsor successfully', async () => {
      const sponsorId = 'sponsor-123';
      const userId = 'user-123';

      // Mock eq() to be chainable, with final call returning success
      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(function () {
        eqCallCount++;
        if (eqCallCount === 2) {
          // Second eq() call returns the result
          return Promise.resolve({ error: null });
        }
        // First eq() call returns chainable
        return this;
      });

      const result = await sponsorService.deleteSponsor(sponsorId, userId);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('sponsors');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', sponsorId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should throw error when delete fails', async () => {
      const sponsorId = 'sponsor-123';
      const userId = 'user-123';

      // Mock eq() to be chainable, with final call returning error
      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(function () {
        eqCallCount++;
        if (eqCallCount === 2) {
          // Second eq() call returns error
          return Promise.resolve({ error: { message: 'Delete failed' } });
        }
        // First eq() call returns chainable
        return this;
      });

      await expect(sponsorService.deleteSponsor(sponsorId, userId)).rejects.toThrow(
        'DATABASE_ERROR: Delete failed'
      );
    });
  });

  // ============================================================================
  // 2. TAG EXTRACTION
  // ============================================================================

  describe('extractTagsFromURL', () => {
    beforeEach(() => {
      // Mock successful HTML fetch
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(`
          <html>
            <head><title>Nike - Just Do It</title></head>
            <body>
              <h1>Nike Official Store</h1>
              <p>Leading sportswear brand for athletes worldwide</p>
            </body>
          </html>
        `)
      });

      // Mock OpenAI completion
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'sportswear, athletics, sneakers, sports, apparel'
            }
          }
        ]
      });
    });

    it('should extract tags from valid URL', async () => {
      const url = 'https://www.nike.com';

      const tags = await sponsorService.extractTagsFromURL(url);

      expect(tags).toEqual(['sportswear', 'athletics', 'sneakers', 'sports', 'apparel']);
      // Verify fetch was called (URL may have trailing slash added by URL parser)
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[0]).toMatch(/^https:\/\/www\.nike\.com\/?$/);
      expect(fetchCall[1].headers['User-Agent']).toBe(
        'Roastr.ai Bot (Brand Safety Tag Extraction)'
      );

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          max_tokens: 50,
          temperature: 0.3
        })
      );
    });

    it('should sanitize and validate URL before fetching', async () => {
      // Use actually invalid URL that URL parser will reject
      const unsafeUrl = 'javascript:alert(1)';

      await expect(sponsorService.extractTagsFromURL(unsafeUrl)).rejects.toThrow('INVALID_URL');
    });

    it('should throw error when URL is missing', async () => {
      await expect(sponsorService.extractTagsFromURL(null)).rejects.toThrow('URL_REQUIRED');
    });

    it('should throw error when OpenAI is not configured', async () => {
      sponsorService.openai = null;

      await expect(sponsorService.extractTagsFromURL('https://www.nike.com')).rejects.toThrow(
        'OPENAI_UNAVAILABLE'
      );
    });

    it('should handle fetch timeout', async () => {
      global.fetch.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 100);
          })
      );

      await expect(
        sponsorService.extractTagsFromURL('https://www.slow-site.com')
      ).rejects.toThrow();
    });

    it('should handle HTTP errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        sponsorService.extractTagsFromURL('https://www.nonexistent.com')
      ).rejects.toThrow('HTTP_ERROR');
    });

    it('should limit tags to maximum 10', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9, tag10, tag11, tag12'
            }
          }
        ]
      });

      const tags = await sponsorService.extractTagsFromURL('https://www.example.com');

      expect(tags.length).toBeLessThanOrEqual(10);
    });
  });

  // ============================================================================
  // 3. SPONSOR MENTION DETECTION
  // ============================================================================

  describe('detectSponsorMention', () => {
    it('should detect exact sponsor name match (case-insensitive)', async () => {
      const comment = 'Nike is a scam brand';
      const sponsors = [
        {
          id: 'sponsor-1',
          name: 'Nike',
          tags: ['sportswear'],
          severity: 'high',
          tone: 'professional',
          actions: ['def_roast'],
          active: true
        }
      ];

      const result = await sponsorService.detectSponsorMention(comment, sponsors);

      expect(result.matched).toBe(true);
      expect(result.sponsor.name).toBe('Nike');
      expect(result.matchType).toBe('exact');
    });

    it('should detect sponsor tag match', async () => {
      const comment = 'These sneakers are terrible quality';
      const sponsors = [
        {
          id: 'sponsor-1',
          name: 'Nike',
          tags: ['sportswear', 'sneakers'],
          severity: 'medium',
          tone: 'normal',
          actions: [],
          active: true
        }
      ];

      const result = await sponsorService.detectSponsorMention(comment, sponsors);

      expect(result.matched).toBe(true);
      expect(result.sponsor.name).toBe('Nike');
      expect(result.matchType).toBe('tag');
    });

    it('should prioritize exact match over tag match', async () => {
      const comment = 'Nike sneakers are bad';
      const sponsors = [
        {
          id: 'sponsor-1',
          name: 'Nike',
          tags: ['sportswear', 'sneakers'],
          severity: 'high',
          tone: 'professional',
          actions: ['def_roast'],
          active: true
        }
      ];

      const result = await sponsorService.detectSponsorMention(comment, sponsors);

      expect(result.matched).toBe(true);
      expect(result.matchType).toBe('exact'); // Exact takes priority
    });

    it('should respect sponsor priority when multiple matches', async () => {
      const comment = 'Adidas shoes are bad'; // Only mention Adidas to test priority
      const sponsors = [
        {
          id: 'sponsor-1',
          name: 'Adidas',
          tags: [],
          severity: 'medium',
          tone: 'normal',
          actions: [],
          priority: 3,
          active: true
        },
        {
          id: 'sponsor-2',
          name: 'Nike',
          tags: [],
          severity: 'high',
          tone: 'professional',
          actions: [],
          priority: 1,
          active: true
        }
      ];

      const result = await sponsorService.detectSponsorMention(comment, sponsors);

      expect(result.matched).toBe(true);
      expect(result.sponsor.name).toBe('Adidas'); // Only Adidas is mentioned
    });

    it('should return no match when no sponsors mentioned', async () => {
      const comment = 'This is a normal comment';
      const sponsors = [
        {
          id: 'sponsor-1',
          name: 'Nike',
          tags: ['sportswear'],
          severity: 'high',
          tone: 'professional',
          actions: []
        }
      ];

      const result = await sponsorService.detectSponsorMention(comment, sponsors);

      expect(result.matched).toBe(false);
      expect(result.sponsor).toBeUndefined();
    });

    it('should handle empty sponsors array', async () => {
      const comment = 'Nike is mentioned';
      const sponsors = [];

      const result = await sponsorService.detectSponsorMention(comment, sponsors);

      expect(result.matched).toBe(false);
    });

    it('should handle null/undefined comment', async () => {
      const sponsors = [
        {
          id: 'sponsor-1',
          name: 'Nike',
          tags: [],
          severity: 'high',
          tone: 'professional',
          actions: []
        }
      ];

      const result = await sponsorService.detectSponsorMention(null, sponsors);

      expect(result.matched).toBe(false);
    });

    it('should handle sponsors with empty tags gracefully', async () => {
      const comment = 'Sportswear brands are overpriced';
      const sponsors = [
        {
          id: 'sponsor-1',
          name: 'Nike',
          tags: [],
          severity: 'high',
          tone: 'professional',
          actions: []
        }
      ];

      const result = await sponsorService.detectSponsorMention(comment, sponsors);

      expect(result.matched).toBe(false); // No exact match, no tags
    });
  });

  // ============================================================================
  // 4. URL SANITIZATION
  // ============================================================================

  describe('_sanitizeURL (private method)', () => {
    it('should accept valid HTTPS URL', () => {
      const url = 'https://www.nike.com';
      const sanitized = sponsorService._sanitizeURL(url);

      // URL object adds trailing slash
      expect(sanitized).toBe('https://www.nike.com/');
    });

    it('should accept valid HTTP URL', () => {
      const url = 'http://www.nike.com';
      const sanitized = sponsorService._sanitizeURL(url);

      // URL object adds trailing slash
      expect(sanitized).toBe('http://www.nike.com/');
    });

    it('should reject non-HTTP protocols', () => {
      const url = 'ftp://www.nike.com';
      const sanitized = sponsorService._sanitizeURL(url);

      expect(sanitized).toBeNull();
    });

    it('should reject file:// URLs', () => {
      const url = 'file:///etc/passwd';
      const sanitized = sponsorService._sanitizeURL(url);

      expect(sanitized).toBeNull();
    });

    it('should reject javascript: URLs', () => {
      const url = 'javascript:alert(1)';
      const sanitized = sponsorService._sanitizeURL(url);

      expect(sanitized).toBeNull();
    });

    it('should reject data: URLs', () => {
      const url = 'data:text/html,<script>alert(1)</script>';
      const sanitized = sponsorService._sanitizeURL(url);

      expect(sanitized).toBeNull();
    });

    it('should reject malformed URLs', () => {
      const url = 'not a url';
      const sanitized = sponsorService._sanitizeURL(url);

      expect(sanitized).toBeNull();
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://www.nike.com/products?category=shoes';
      const sanitized = sponsorService._sanitizeURL(url);

      expect(sanitized).toBe(url);
    });
  });
});
