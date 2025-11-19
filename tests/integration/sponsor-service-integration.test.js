/**
 * Integration Tests: Sponsor Service with Real Supabase
 *
 * Tests SponsorService CRUD operations, tag extraction, and sponsor detection
 * with REAL Supabase database (RLS validation).
 *
 * Issue: #866 (Integration Tests for Brand Safety)
 * Parent Issue: #859 (Brand Safety for Sponsors - Plan Plus)
 * Implementation: PR #865
 *
 * Test Coverage:
 * - CRUD operations with RLS policy enforcement
 * - Tag extraction from URLs (mocked OpenAI)
 * - Sponsor mention detection (exact, tag, priority)
 * - Edge cases (null, empty, special chars, invalid data)
 *
 * @see src/services/sponsorService.js
 * @see docs/plan/issue-866.md
 */

const SponsorService = require('../../src/services/sponsorService');
const { createTestTenants, cleanupTestData, serviceClient } = require('../helpers/tenantTestUtils');
const logger = require('../../src/utils/logger');

// Mock OpenAI to avoid costs
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'sportswear, athletics, sneakers, apparel, shoes'
            }
          }]
        })
      }
    }
  }));
});

// Mock logger to reduce noise (matches export structure)
jest.mock('../../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  return Object.assign(mockLogger, {
    logger: mockLogger,
    SafeUtils: {
      safeUserIdPrefix: jest.fn(id => 'mock-user...'),
      truncateString: jest.fn(str => str)
    }
  });
});

describe('SponsorService Integration Tests (Real Supabase)', () => {
  let sponsorService;
  let testTenants;
  let userAId;
  let userBId;

  beforeAll(async () => {
    logger.info('Setting up integration tests with real Supabase...');

    /**
     * PRE-REQUISITE: Apply migration database/migrations/027_sponsors.sql
     *
     * Options to apply migration:
     * 1. Supabase Dashboard SQL Editor: Copy/paste 027_sponsors.sql
     * 2. Supabase CLI: `npx supabase db push` (applies all pending migrations)
     * 3. Manual: Run SQL from 027_sponsors.sql in your Supabase project
     *
     * If you see "DATABASE_ERROR: undefined", the table likely doesn't exist yet.
     */

    // Create test tenants with real Supabase
    testTenants = await createTestTenants();
    
    // Get user IDs from tenants
    const { data: orgA } = await serviceClient
      .from('organizations')
      .select('owner_id')
      .eq('id', testTenants.tenantA.id)
      .single();
    
    const { data: orgB } = await serviceClient
      .from('organizations')
      .select('owner_id')
      .eq('id', testTenants.tenantB.id)
      .single();
    
    userAId = orgA.owner_id;
    userBId = orgB.owner_id;

    logger.info('Test setup complete', { userAId, userBId });
  });

  afterAll(async () => {
    await cleanupTestData();
    
    // Close Supabase connections to avoid open handles
    if (serviceClient && typeof serviceClient.removeAllChannels === 'function') {
      serviceClient.removeAllChannels();
    }

    // Give a small delay for connections to close
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    sponsorService = new SponsorService();
    jest.clearAllMocks();
  });

  // ============================================================================
  // AC #1: CRUD OPERATIONS WITH RLS
  // ============================================================================

  describe('CRUD Operations with RLS Enforcement', () => {
    describe('createSponsor', () => {
      it('should create sponsor successfully with valid data', async () => {
        const sponsorData = {
          name: 'Nike',
          url: 'https://www.nike.com',
          tags: ['sportswear', 'sneakers'],
          severity: 'high',
          tone: 'professional',
          priority: 1,
          actions: ['hide_comment', 'def_roast']
        };

        const sponsor = await sponsorService.createSponsor(userAId, sponsorData);

        expect(sponsor).toBeDefined();
        expect(sponsor.id).toBeDefined();
        expect(sponsor.user_id).toBe(userAId);
        expect(sponsor.name).toBe('Nike');
        expect(sponsor.url).toMatch(/^https:\/\/www\.nike\.com\/?$/); // Allow trailing slash
        expect(sponsor.tags).toEqual(['sportswear', 'sneakers']);
        expect(sponsor.severity).toBe('high');
        expect(sponsor.tone).toBe('professional');
        expect(sponsor.priority).toBe(1);
        expect(sponsor.actions).toEqual(['hide_comment', 'def_roast']);
        expect(sponsor.active).toBe(true);
        expect(sponsor.created_at).toBeDefined();
      });

      it('should create sponsor with default values', async () => {
        const sponsorData = {
          name: 'Minimal Sponsor'
        };

        const sponsor = await sponsorService.createSponsor(userAId, sponsorData);

        expect(sponsor.name).toBe('Minimal Sponsor');
        expect(sponsor.severity).toBe('medium'); // default
        expect(sponsor.tone).toBe('normal'); // default
        expect(sponsor.priority).toBe(3); // default
        expect(sponsor.tags).toEqual([]);
        expect(sponsor.actions).toEqual([]);
        expect(sponsor.active).toBe(true);
      });

      it('should reject duplicate sponsor name for same user', async () => {
        const sponsorData = {
          name: 'Adidas',
          url: 'https://www.adidas.com'
        };

        // Create first sponsor
        await sponsorService.createSponsor(userAId, sponsorData);

        // Try to create duplicate
        await expect(
          sponsorService.createSponsor(userAId, sponsorData)
        ).rejects.toThrow('DATABASE_ERROR');
      });

      it('should allow same sponsor name for different users', async () => {
        const sponsorData = {
          name: 'Puma',
          url: 'https://www.puma.com'
        };

        const sponsorA = await sponsorService.createSponsor(userAId, sponsorData);
        const sponsorB = await sponsorService.createSponsor(userBId, sponsorData);

        expect(sponsorA.name).toBe('Puma');
        expect(sponsorB.name).toBe('Puma');
        expect(sponsorA.user_id).toBe(userAId);
        expect(sponsorB.user_id).toBe(userBId);
        expect(sponsorA.id).not.toBe(sponsorB.id);
      });

      it('should validate required fields', async () => {
        await expect(
          sponsorService.createSponsor(userAId, {})
        ).rejects.toThrow('SPONSOR_NAME_REQUIRED');

        await expect(
          sponsorService.createSponsor(null, { name: 'Test' })
        ).rejects.toThrow('USER_ID_REQUIRED');
      });

      it('should validate priority range (1-5)', async () => {
        await expect(
          sponsorService.createSponsor(userAId, {
            name: 'Invalid Priority',
            priority: 0
          })
        ).rejects.toThrow('INVALID_PRIORITY');

        await expect(
          sponsorService.createSponsor(userAId, {
            name: 'Invalid Priority',
            priority: 6
          })
        ).rejects.toThrow('INVALID_PRIORITY');
      });

      it('should sanitize URLs (reject javascript:, data:)', async () => {
        const sponsor1 = await sponsorService.createSponsor(userAId, {
          name: 'Malicious JS',
          url: 'javascript:alert(1)'
        });

        expect(sponsor1.url).toBeNull(); // Rejected

        const sponsor2 = await sponsorService.createSponsor(userAId, {
          name: 'Malicious Data',
          url: 'data:text/html,<script>alert(1)</script>'
        });

        expect(sponsor2.url).toBeNull(); // Rejected
      });
    });

    describe('getSponsors', () => {
      beforeAll(async () => {
        // Clean up any existing sponsors for this test suite
        await serviceClient
          .from('sponsors')
          .delete()
          .in('user_id', [userAId, userBId]);
      });

      beforeEach(async () => {
        // Create test sponsors for User A
        await sponsorService.createSponsor(userAId, {
          name: 'Active Sponsor 1',
          priority: 1,
          active: true
        });

        await sponsorService.createSponsor(userAId, {
          name: 'Active Sponsor 2',
          priority: 2,
          active: true
        });

        await sponsorService.createSponsor(userAId, {
          name: 'Inactive Sponsor',
          priority: 3,
          active: false
        });

        // Create sponsor for User B
        await sponsorService.createSponsor(userBId, {
          name: 'User B Sponsor',
          priority: 1
        });
      });

      afterEach(async () => {
        // Clean up after each test to avoid interference
        await serviceClient
          .from('sponsors')
          .delete()
          .in('user_id', [userAId, userBId]);
      });

      it('should return only active sponsors by default', async () => {
        const sponsors = await sponsorService.getSponsors(userAId);

        expect(sponsors).toHaveLength(2);
        expect(sponsors.every(s => s.active)).toBe(true);
        expect(sponsors.every(s => s.user_id === userAId)).toBe(true);
      });

      it('should return all sponsors when includeInactive=true', async () => {
        const sponsors = await sponsorService.getSponsors(userAId, true);

        expect(sponsors).toHaveLength(3);
        const activeCount = sponsors.filter(s => s.active).length;
        const inactiveCount = sponsors.filter(s => !s.active).length;
        expect(activeCount).toBe(2);
        expect(inactiveCount).toBe(1);
      });

      it('should sort by priority ascending (1=highest first)', async () => {
        const sponsors = await sponsorService.getSponsors(userAId);

        expect(sponsors[0].priority).toBe(1);
        expect(sponsors[1].priority).toBe(2);
      });

      it('should enforce RLS isolation (User A cannot see User B sponsors)', async () => {
        const sponsorsA = await sponsorService.getSponsors(userAId);
        const sponsorsB = await sponsorService.getSponsors(userBId);

        // User A sees only their sponsors
        expect(sponsorsA.every(s => s.user_id === userAId)).toBe(true);
        expect(sponsorsA.find(s => s.name === 'User B Sponsor')).toBeUndefined();

        // User B sees only their sponsors
        expect(sponsorsB.every(s => s.user_id === userBId)).toBe(true);
        expect(sponsorsB.find(s => s.name === 'Active Sponsor 1')).toBeUndefined();
      });

      it('should return empty array for new users', async () => {
        const newUserId = '00000000-0000-0000-0000-000000000000';
        const sponsors = await sponsorService.getSponsors(newUserId);

        expect(sponsors).toEqual([]);
      });
    });

    describe('getSponsor', () => {
      let sponsorId;

      beforeAll(async () => {
        await serviceClient.from('sponsors').delete().in('user_id', [userAId, userBId]);
      });

      beforeEach(async () => {
        const sponsor = await sponsorService.createSponsor(userAId, {
          name: 'Test Sponsor',
          url: 'https://www.test.com'
        });
        sponsorId = sponsor.id;
      });

      afterEach(async () => {
        await serviceClient.from('sponsors').delete().in('user_id', [userAId, userBId]);
      });

      it('should get sponsor by id', async () => {
        const sponsor = await sponsorService.getSponsor(sponsorId, userAId);

        expect(sponsor).toBeDefined();
        expect(sponsor.id).toBe(sponsorId);
        expect(sponsor.name).toBe('Test Sponsor');
      });

      it('should return null for non-existent sponsor', async () => {
        const sponsor = await sponsorService.getSponsor(
          '00000000-0000-0000-0000-000000000000',
          userAId
        );

        expect(sponsor).toBeNull();
      });

      it('should enforce RLS (User B cannot access User A sponsor)', async () => {
        const sponsor = await sponsorService.getSponsor(sponsorId, userBId);

        expect(sponsor).toBeNull(); // RLS blocks access
      });
    });

    describe('updateSponsor', () => {
      let sponsorId;

      beforeAll(async () => {
        await serviceClient.from('sponsors').delete().in('user_id', [userAId, userBId]);
      });

      beforeEach(async () => {
        const sponsor = await sponsorService.createSponsor(userAId, {
          name: 'Original Name',
          severity: 'medium',
          priority: 3
        });
        sponsorId = sponsor.id;
      });

      afterEach(async () => {
        await serviceClient.from('sponsors').delete().in('user_id', [userAId, userBId]);
      });

      it('should update sponsor successfully', async () => {
        const updates = {
          name: 'Updated Name',
          severity: 'high',
          priority: 1
        };

        const updated = await sponsorService.updateSponsor(sponsorId, userAId, updates);

        expect(updated.name).toBe('Updated Name');
        expect(updated.severity).toBe('high');
        expect(updated.priority).toBe(1);
        expect(updated.updated_at).toBeDefined();
      });

      it('should return null for non-existent sponsor', async () => {
        const updated = await sponsorService.updateSponsor(
          '00000000-0000-0000-0000-000000000000',
          userAId,
          { name: 'New Name' }
        );

        expect(updated).toBeNull();
      });

      it('should enforce RLS (User B cannot update User A sponsor)', async () => {
        const updated = await sponsorService.updateSponsor(
          sponsorId,
          userBId,
          { name: 'Hijacked Name' }
        );

        expect(updated).toBeNull(); // RLS blocks update

        // Verify original unchanged
        const original = await sponsorService.getSponsor(sponsorId, userAId);
        expect(original.name).toBe('Original Name');
      });

      it('should validate priority on update', async () => {
        await expect(
          sponsorService.updateSponsor(sponsorId, userAId, { priority: 10 })
        ).rejects.toThrow('INVALID_PRIORITY');
      });

      it('should sanitize URL on update', async () => {
        const updated = await sponsorService.updateSponsor(sponsorId, userAId, {
          url: 'javascript:alert(1)'
        });

        expect(updated.url).toBeNull(); // Rejected
      });
    });

    describe('deleteSponsor', () => {
      let sponsorId;

      beforeAll(async () => {
        await serviceClient.from('sponsors').delete().in('user_id', [userAId, userBId]);
      });

      beforeEach(async () => {
        const sponsor = await sponsorService.createSponsor(userAId, {
          name: 'To Delete'
        });
        sponsorId = sponsor.id;
      });

      afterEach(async () => {
        await serviceClient.from('sponsors').delete().in('user_id', [userAId, userBId]);
      });

      it('should delete sponsor successfully', async () => {
        const result = await sponsorService.deleteSponsor(sponsorId, userAId);

        expect(result).toBe(true);

        // Verify deleted
        const deleted = await sponsorService.getSponsor(sponsorId, userAId);
        expect(deleted).toBeNull();
      });

      it('should enforce RLS (User B cannot delete User A sponsor)', async () => {
        await sponsorService.deleteSponsor(sponsorId, userBId);

        // Verify still exists for User A
        const sponsor = await sponsorService.getSponsor(sponsorId, userAId);
        expect(sponsor).toBeDefined();
        expect(sponsor.name).toBe('To Delete');
      });
    });
  });

  // ============================================================================
  // AC #2: TAG EXTRACTION (Mocked OpenAI)
  // ============================================================================

  describe('Tag Extraction from URL', () => {
    it('should extract tags successfully with mocked OpenAI', async () => {
      const url = 'https://www.nike.com';

      const tags = await sponsorService.extractTagsFromURL(url);

      expect(tags).toBeDefined();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags).toEqual(['sportswear', 'athletics', 'sneakers', 'apparel', 'shoes']);
    });

    it('should reject invalid URLs', async () => {
      await expect(
        sponsorService.extractTagsFromURL('not-a-url')
      ).rejects.toThrow('INVALID_URL');

      await expect(
        sponsorService.extractTagsFromURL('javascript:alert(1)')
      ).rejects.toThrow('INVALID_URL');
    });

    it('should require URL parameter', async () => {
      await expect(
        sponsorService.extractTagsFromURL(null)
      ).rejects.toThrow('URL_REQUIRED');

      await expect(
        sponsorService.extractTagsFromURL('')
      ).rejects.toThrow('URL_REQUIRED');
    });

    it('should handle fetch timeout (mocked)', async () => {
      // Mock global fetch to simulate timeout
      global.fetch = jest.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        });
      });

      await expect(
        sponsorService.extractTagsFromURL('https://slow-site.com')
      ).rejects.toThrow();

      // Restore fetch
      delete global.fetch;
    });
  });

  // ============================================================================
  // AC #3: SPONSOR DETECTION
  // ============================================================================

  describe('Sponsor Mention Detection', () => {
    let sponsors;

      beforeAll(async () => {
        // Initialize service for this block
        const service = new SponsorService();
        
        // Clean up before creating test sponsors
        await serviceClient
          .from('sponsors')
          .delete()
          .in('user_id', [userAId, userBId]);

        // Create test sponsors once for all tests in this block
        const timestamp = Date.now();
        
        const nike = await service.createSponsor(userAId, {
          name: `Nike-${timestamp}`,
          tags: ['sportswear', 'sneakers'],
          priority: 1
        });

        const adidas = await service.createSponsor(userAId, {
          name: `Adidas-${timestamp}`,
          tags: ['athletics', 'apparel'],
          priority: 2
        });

        sponsors = [nike, adidas];
      });

    describe('Exact name matching', () => {
      it('should detect exact sponsor name (case-insensitive)', async () => {
        const comment = `${sponsors[0].name} is a great brand`;
        const result = await sponsorService.detectSponsorMention(
          comment,
          sponsors
        );

        expect(result.matched).toBe(true);
        expect(result.sponsor.name).toBe(sponsors[0].name); // Nike-{timestamp}
        expect(result.matchType).toBe('exact');
      });

      it('should match case-insensitively', async () => {
        const comment = `${sponsors[0].name.toUpperCase()} shoes are expensive`;
        const result = await sponsorService.detectSponsorMention(
          comment,
          sponsors
        );

        expect(result.matched).toBe(true);
        expect(result.sponsor.name).toBe(sponsors[0].name);
      });

      it('should match with word boundaries', async () => {
        // Test that sponsor name is detected even with punctuation
        const comment = `Check out ${sponsors[0].name}.com for deals`;
        const result = await sponsorService.detectSponsorMention(
          comment,
          sponsors
        );

        expect(result.matched).toBe(true);
      });

      it('should NOT match partial names', async () => {
        const result = await sponsorService.detectSponsorMention(
          'Nik is not a brand', // "Nik" should not match any sponsor
          sponsors
        );

        expect(result.matched).toBe(false);
      });
    });

    describe('Tag-based matching', () => {
      it('should detect sponsor by tag', async () => {
        const result = await sponsorService.detectSponsorMention(
          'I love sportswear brands',
          sponsors
        );

        expect(result.matched).toBe(true);
        expect(result.sponsor.name).toBe(sponsors[0].name); // First sponsor with "sportswear" tag
        expect(result.matchType).toBe('tag');
      });

      it('should match tags case-insensitively', async () => {
        const result = await sponsorService.detectSponsorMention(
          'SNEAKERS are cool',
          sponsors
        );

        expect(result.matched).toBe(true);
        expect(result.sponsor.name).toBe(sponsors[0].name);
      });
    });

    describe('Priority-based matching', () => {
      it('should return highest priority sponsor when multiple match', async () => {
        // Both sponsors mentioned, highest priority (1) wins
        const comment = `${sponsors[0].name} and ${sponsors[1].name} are both great`;
        const result = await sponsorService.detectSponsorMention(
          comment,
          sponsors
        );

        expect(result.matched).toBe(true);
        expect(result.sponsor.name).toBe(sponsors[0].name); // Priority 1 wins
      });
    });

    describe('Edge cases', () => {
      it('should handle null comment', async () => {
        const result = await sponsorService.detectSponsorMention(null, sponsors);

        expect(result.matched).toBe(false);
      });

      it('should handle empty string', async () => {
        const result = await sponsorService.detectSponsorMention('', sponsors);

        expect(result.matched).toBe(false);
      });

      it('should handle empty sponsors array', async () => {
        const result = await sponsorService.detectSponsorMention('Any brand is great', []);

        expect(result.matched).toBe(false);
      });

      it('should skip inactive sponsors', async () => {
        const inactiveSponsor = await sponsorService.createSponsor(userAId, {
          name: 'Reebok',
          active: false,
          priority: 1
        });

        const result = await sponsorService.detectSponsorMention(
          'Reebok is mentioned',
          [inactiveSponsor]
        );

        expect(result.matched).toBe(false); // Inactive sponsor ignored
      });

      it('should handle special characters in sponsor name', async () => {
        const sponsor = await sponsorService.createSponsor(userAId, {
          name: 'L\'Oréal',
          priority: 1
        });

        const result = await sponsorService.detectSponsorMention(
          'L\'Oréal products are great',
          [sponsor]
        );

        expect(result.matched).toBe(true);
        expect(result.sponsor.name).toBe('L\'Oréal');
      });
    });
  });
});

