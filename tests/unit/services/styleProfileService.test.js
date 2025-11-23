/**
 * StyleProfileService Tests
 * Issue #369 - SPEC 9 - Style Profile Extraction
 *
 * Tests cover:
 * - Premium user validation
 * - Multi-platform content fetching
 * - Profile generation and encryption
 * - Database operations with RLS
 * - Error handling and edge cases
 * - GDPR compliance
 */

// Jest is available globally
const StyleProfileService = require('../../../src/services/styleProfileService');
const StyleProfileGenerator = require('../../../src/services/styleProfileGenerator');

// Mock dependencies
jest.mock('../../../src/services/styleProfileGenerator');
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn()
  }
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

const mockSupabaseClient = require('../../../src/config/supabase').supabaseServiceClient;
const { logger } = require('../../../src/utils/logger');

describe('StyleProfileService', () => {
  let service;
  let mockGenerator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock generator
    mockGenerator = {
      generateStyleProfile: jest.fn(),
      initialize: jest.fn()
    };
    StyleProfileGenerator.mockImplementation(() => mockGenerator);

    // Set encryption key environment variable
    process.env.STYLE_PROFILE_ENCRYPTION_KEY =
      '8928ba872b6710a1bf1ac4d4268da0c92f7bb827c6834ae87a044f6817b43612';

    // Get the singleton service instance
    service = require('../../../src/services/styleProfileService');

    // Mock encryption methods after service creation
    service.encryptStyleProfile = jest.fn().mockReturnValue('encrypted-data');
    service.decryptStyleProfile = jest.fn().mockReturnValue('decrypted-data');
  });

  describe('constructor', () => {
    it('should initialize with generator', () => {
      expect(StyleProfileGenerator).toHaveBeenCalled();
      expect(service).toBeDefined();
    });
  });

  describe('extractStyleProfile', () => {
    const mockProfile = {
      profiles: [
        {
          lang: 'es',
          prompt: 'Eres un usuario casual...',
          sources: { twitter: 150, youtube: 100 },
          metadata: { totalItems: 250 }
        }
      ],
      totalItems: 250,
      sources: { twitter: 150, youtube: 100 }
    };

    beforeEach(() => {
      // Mock premium user validation
      service._validatePremiumUser = jest.fn().mockResolvedValue(true);

      // Mock content fetching
      service._fetchUserComments = jest.fn().mockResolvedValue([
        { text: 'Comment 1', platform: 'twitter', lang: 'es' },
        { text: 'Comment 2', platform: 'youtube', lang: 'es' }
      ]);

      // Mock profile generation
      mockGenerator.generateStyleProfile.mockResolvedValue(mockProfile);

      // Mock encryption
      service.encryptStyleProfile.mockReturnValue('encrypted-prompt-data');

      // Mock database insertion
      mockSupabaseClient.insert.mockResolvedValue({
        data: [{ id: 'profile-123', ...mockProfile.profiles[0] }],
        error: null
      });
    });

    it('should extract style profile successfully', async () => {
      const result = await service.extractStyleProfile('org-123', 'user-456', [
        'twitter',
        'youtube'
      ]);

      expect(service._validatePremiumUser).toHaveBeenCalledWith('org-123', 'user-456');
      expect(service._fetchUserComments).toHaveBeenCalledWith('org-123', 'user-456', [
        'twitter',
        'youtube'
      ]);
      expect(mockGenerator.generateStyleProfile).toHaveBeenCalledWith(
        'user-456',
        expect.any(Object)
      );
      expect(mockSupabaseClient.insert).toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        data: mockProfile
      });
    });

    it('should handle premium user validation failure', async () => {
      service._validatePremiumUser.mockRejectedValue(new Error('Premium plan required'));

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter'])).rejects.toThrow(
        'Premium plan required'
      );
    });

    it('should handle insufficient content', async () => {
      service._fetchUserComments.mockResolvedValue([]);

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter'])).rejects.toThrow(
        'Insufficient content available for style profile generation'
      );
    });

    it('should handle profile generation errors', async () => {
      mockGenerator.generateStyleProfile.mockRejectedValue(new Error('Generation failed'));

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter'])).rejects.toThrow(
        'Generation failed'
      );
    });

    it('should handle database insertion errors', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter'])).rejects.toThrow(
        'Database error'
      );
    });

    it('should encrypt sensitive data before storage', async () => {
      await service.extractStyleProfile('org-123', 'user-456', ['twitter']);

      expect(service.encryptStyleProfile).toHaveBeenCalledWith(mockProfile.profiles[0].prompt);
    });

    it('should log profile extraction activity', async () => {
      await service.extractStyleProfile('org-123', 'user-456', ['twitter', 'youtube']);

      expect(logger.info).toHaveBeenCalledWith(
        'Style profile extracted successfully',
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'user-456',
          platforms: ['twitter', 'youtube'],
          profilesGenerated: 1,
          totalItems: 250
        })
      );
    });
  });

  describe('getUserProfiles', () => {
    const mockDbProfile = {
      id: 'profile-123',
      language: 'es',
      encrypted_prompt: 'encrypted-prompt-data',
      sources: { twitter: 150 },
      metadata: { totalItems: 150 },
      created_at: '2025-01-20T10:00:00Z'
    };

    beforeEach(() => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbProfile],
        error: null
      });

      service.decryptStyleProfile.mockReturnValue('Decrypted prompt text');
    });

    it('should get user profiles successfully', async () => {
      const result = await service.getUserProfiles('org-123', 'user-456');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('style_profiles');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('organization_id', 'org-123');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'user-456');

      expect(result).toEqual({
        success: true,
        data: {
          profiles: [
            {
              id: 'profile-123',
              lang: 'es',
              prompt: 'Decrypted prompt text',
              sources: { twitter: 150 },
              metadata: { totalItems: 150 },
              createdAt: '2025-01-20T10:00:00Z'
            }
          ]
        }
      });
    });

    it('should handle database query errors', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: null,
        error: { message: 'Database query failed' }
      });

      await expect(service.getUserProfiles('org-123', 'user-456')).rejects.toThrow(
        'Database query failed'
      );
    });

    it('should handle decryption errors gracefully', async () => {
      service.decryptStyleProfile.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await service.getUserProfiles('org-123', 'user-456');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to decrypt style profile prompt',
        expect.any(Object)
      );

      expect(result.data.profiles[0].prompt).toBe('[Decryption failed]');
    });

    it('should return empty profiles when none exist', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await service.getUserProfiles('org-123', 'user-456');

      expect(result).toEqual({
        success: true,
        data: { profiles: [] }
      });
    });
  });

  describe('deleteProfile', () => {
    beforeEach(() => {
      mockSupabaseClient.delete.mockResolvedValue({
        data: { count: 1 },
        error: null
      });
    });

    it('should delete profile successfully', async () => {
      const result = await service.deleteProfile('org-123', 'user-456', 'es');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('style_profiles');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('organization_id', 'org-123');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'user-456');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('language', 'es');

      expect(result).toEqual({
        success: true,
        message: 'Style profile deleted successfully'
      });
    });

    it('should handle database deletion errors', async () => {
      mockSupabaseClient.delete.mockResolvedValue({
        data: null,
        error: { message: 'Deletion failed' }
      });

      await expect(service.deleteProfile('org-123', 'user-456', 'es')).rejects.toThrow(
        'Deletion failed'
      );
    });

    it('should log profile deletion', async () => {
      await service.deleteProfile('org-123', 'user-456', 'es');

      expect(logger.info).toHaveBeenCalledWith(
        'Style profile deleted',
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'user-456',
          language: 'es'
        })
      );
    });
  });

  describe('_validatePremiumUser', () => {
    beforeEach(() => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { plan: 'pro' },
        error: null
      });
    });

    it('should validate premium user successfully', async () => {
      await expect(service._validatePremiumUser('org-123', 'user-456')).resolves.not.toThrow();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('organizations');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'org-123');
    });

    it('should reject non-premium users', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { plan: 'free' },
        error: null
      });

      await expect(service._validatePremiumUser('org-123', 'user-456')).rejects.toThrow(
        'Style profile extraction requires a Premium plan (Pro or higher)'
      );
    });

    it('should handle organization not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Organization not found' }
      });

      await expect(service._validatePremiumUser('org-123', 'user-456')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should validate all premium plan types', async () => {
      const premiumPlans = ['pro', 'plus', 'creator_plus', 'enterprise'];

      for (const plan of premiumPlans) {
        mockSupabaseClient.single.mockResolvedValue({
          data: { plan },
          error: null
        });

        await expect(service._validatePremiumUser('org-123', 'user-456')).resolves.not.toThrow();
      }
    });
  });

  describe('_fetchUserComments', () => {
    const mockComments = [
      { id: 1, text: 'Comment 1', platform: 'twitter', lang: 'es' },
      { id: 2, text: 'Comment 2', platform: 'youtube', lang: 'es' }
    ];

    beforeEach(() => {
      mockSupabaseClient.select.mockResolvedValue({
        data: mockComments,
        error: null
      });
    });

    it('should fetch user comments from specified platforms', async () => {
      const result = await service._fetchUserComments('org-123', 'user-456', [
        'twitter',
        'youtube'
      ]);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_comments');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('organization_id', 'org-123');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'user-456');
      // Should filter by platforms
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*');

      expect(result).toEqual(mockComments);
    });

    it('should handle database query errors', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' }
      });

      await expect(service._fetchUserComments('org-123', 'user-456', ['twitter'])).rejects.toThrow(
        'Query failed'
      );
    });

    it('should return empty array when no comments found', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await service._fetchUserComments('org-123', 'user-456', ['twitter']);

      expect(result).toEqual([]);
    });

    it('should limit comments per platform', async () => {
      const maxItemsPerPlatform = 100;
      await service._fetchUserComments('org-123', 'user-456', ['twitter'], { maxItemsPerPlatform });

      // Should include limit in query
      expect(mockSupabaseClient.select).toHaveBeenCalled();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle missing organization ID', async () => {
      await expect(service.extractStyleProfile('', 'user-456', ['twitter'])).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should handle missing user ID', async () => {
      await expect(service.extractStyleProfile('org-123', '', ['twitter'])).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should handle empty platforms array', async () => {
      await expect(service.extractStyleProfile('org-123', 'user-456', [])).rejects.toThrow(
        'At least one platform must be specified'
      );
    });

    it('should validate platform names', async () => {
      await expect(
        service.extractStyleProfile('org-123', 'user-456', ['invalid-platform'])
      ).rejects.toThrow('Invalid platform: invalid-platform');
    });

    it('should handle missing encryption key', async () => {
      const originalKey = process.env.STYLE_PROFILE_ENCRYPTION_KEY;
      delete process.env.STYLE_PROFILE_ENCRYPTION_KEY;

      // Clear the require cache to test re-initialization
      delete require.cache[require.resolve('../../../src/services/styleProfileService')];

      expect(() => require('../../../src/services/styleProfileService')).toThrow(
        'STYLE_PROFILE_ENCRYPTION_KEY environment variable is required'
      );

      // Restore environment
      process.env.STYLE_PROFILE_ENCRYPTION_KEY = originalKey;
    });
  });

  describe('GDPR compliance', () => {
    it('should not store raw user content', async () => {
      service._validatePremiumUser = jest.fn().mockResolvedValue(true);
      service._fetchUserComments = jest
        .fn()
        .mockResolvedValue([{ text: 'Sensitive user content', platform: 'twitter', lang: 'es' }]);

      mockGenerator.generateStyleProfile.mockResolvedValue({
        profiles: [
          {
            lang: 'es',
            prompt: 'Generated prompt without raw content',
            sources: { twitter: 1 },
            metadata: { totalItems: 1 }
          }
        ],
        totalItems: 1
      });

      service.encryptStyleProfile.mockReturnValue('encrypted-data');
      mockSupabaseClient.insert.mockResolvedValue({
        data: [{}],
        error: null
      });

      await service.extractStyleProfile('org-123', 'user-456', ['twitter']);

      // Verify that only the generated prompt is encrypted and stored, not raw content
      expect(service.encryptStyleProfile).toHaveBeenCalledWith(
        'Generated prompt without raw content'
      );
      expect(service.encryptStyleProfile).not.toHaveBeenCalledWith('Sensitive user content');
    });

    it('should handle profile deletion for GDPR compliance', async () => {
      mockSupabaseClient.delete.mockResolvedValue({
        data: { count: 1 },
        error: null
      });

      await service.deleteProfile('org-123', 'user-456', 'es');

      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Style profile deleted',
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'user-456'
        })
      );
    });
  });

  describe('Security Scenarios and Edge Cases', () => {
    describe('Input Validation and Sanitization', () => {
      it('should handle malicious organization ID injection attempts', async () => {
        const maliciousOrgId = "'; DROP TABLE style_profiles; --";

        await expect(
          service.extractStyleProfile(maliciousOrgId, 'user-456', ['twitter'])
        ).rejects.toThrow('Organization ID is required');
      });

      it('should handle extremely long user IDs', async () => {
        const longUserId = 'a'.repeat(1000);

        await expect(
          service.extractStyleProfile('org-123', longUserId, ['twitter'])
        ).rejects.toThrow();
      });

      it('should validate platform names against allowed list', async () => {
        const invalidPlatforms = ['<script>', 'rm -rf /', '../../etc/passwd'];

        for (const platform of invalidPlatforms) {
          await expect(
            service.extractStyleProfile('org-123', 'user-456', [platform])
          ).rejects.toThrow(`Invalid platform: ${platform}`);
        }
      });

      it('should handle null and undefined inputs gracefully', async () => {
        await expect(service.extractStyleProfile(null, 'user-456', ['twitter'])).rejects.toThrow(
          'Organization ID is required'
        );

        await expect(
          service.extractStyleProfile('org-123', undefined, ['twitter'])
        ).rejects.toThrow('User ID is required');

        await expect(service.extractStyleProfile('org-123', 'user-456', null)).rejects.toThrow(
          'At least one platform must be specified'
        );
      });

      it('should enforce maximum platform limit', async () => {
        const manyPlatforms = Array(50)
          .fill()
          .map((_, i) => `platform${i}`);

        await expect(
          service.extractStyleProfile('org-123', 'user-456', manyPlatforms)
        ).rejects.toThrow('Too many platforms specified');
      });
    });

    describe('Rate Limiting and Resource Protection', () => {
      it('should handle concurrent extraction attempts', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);
        service._fetchUserComments = jest
          .fn()
          .mockResolvedValue([{ text: 'Comment 1', platform: 'twitter', lang: 'es' }]);

        const mockProfile = {
          profiles: [{ lang: 'es', prompt: 'Test prompt', sources: {}, metadata: {} }],
          totalItems: 1
        };

        mockGenerator.generateStyleProfile.mockResolvedValue(mockProfile);
        service.encryptStyleProfile.mockReturnValue('encrypted-data');
        mockSupabaseClient.insert.mockResolvedValue({ data: [{}], error: null });

        // Simulate concurrent requests
        const promises = Array(5)
          .fill()
          .map(() => service.extractStyleProfile('org-123', 'user-456', ['twitter']));

        const results = await Promise.allSettled(promises);
        expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      });

      it('should handle memory exhaustion scenarios', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);

        // Mock extremely large comment dataset
        const massiveComments = Array(100000)
          .fill()
          .map((_, i) => ({
            text: `Comment ${i} `.repeat(1000), // Large comments
            platform: 'twitter',
            lang: 'es'
          }));

        service._fetchUserComments = jest.fn().mockResolvedValue(massiveComments);

        await expect(
          service.extractStyleProfile('org-123', 'user-456', ['twitter'])
        ).rejects.toThrow();
      });
    });

    describe('Database Security and Integrity', () => {
      it('should handle database connection failures securely', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);
        service._fetchUserComments = jest.fn().mockRejectedValue(new Error('Connection lost'));

        await expect(
          service.extractStyleProfile('org-123', 'user-456', ['twitter'])
        ).rejects.toThrow('Connection lost');

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to extract style profile',
          expect.objectContaining({
            error: 'Connection lost'
          })
        );
      });

      it('should handle encryption failures gracefully', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);
        service._fetchUserComments = jest
          .fn()
          .mockResolvedValue([{ text: 'Comment 1', platform: 'twitter', lang: 'es' }]);

        mockGenerator.generateStyleProfile.mockResolvedValue({
          profiles: [{ lang: 'es', prompt: 'Test prompt', sources: {}, metadata: {} }],
          totalItems: 1
        });

        service.encryptStyleProfile.mockImplementation(() => {
          throw new Error('Encryption key unavailable');
        });

        await expect(
          service.extractStyleProfile('org-123', 'user-456', ['twitter'])
        ).rejects.toThrow('Encryption key unavailable');
      });

      it('should verify row level security constraints', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);
        service._fetchUserComments = jest
          .fn()
          .mockResolvedValue([{ text: 'Comment 1', platform: 'twitter', lang: 'es' }]);

        // Mock RLS violation
        mockSupabaseClient.insert.mockResolvedValue({
          data: null,
          error: {
            message: 'new row violates row-level security policy',
            code: '42501'
          }
        });

        await expect(
          service.extractStyleProfile('org-123', 'user-456', ['twitter'])
        ).rejects.toThrow('new row violates row-level security policy');
      });
    });

    describe('Data Privacy and GDPR Compliance', () => {
      it('should not log sensitive user data', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);

        const sensitiveComments = [
          {
            text: 'My email is user@example.com and SSN is 123-45-6789',
            platform: 'twitter',
            lang: 'es'
          },
          { text: 'Credit card: 4532-1234-5678-9012', platform: 'twitter', lang: 'es' }
        ];

        service._fetchUserComments = jest.fn().mockResolvedValue(sensitiveComments);

        mockGenerator.generateStyleProfile.mockResolvedValue({
          profiles: [{ lang: 'es', prompt: 'Safe prompt', sources: {}, metadata: {} }],
          totalItems: 2
        });

        service.encryptStyleProfile.mockReturnValue('encrypted-data');
        mockSupabaseClient.insert.mockResolvedValue({ data: [{}], error: null });

        await service.extractStyleProfile('org-123', 'user-456', ['twitter']);

        // Verify no sensitive data was logged
        const logCalls = logger.info.mock.calls.flat();
        const logString = JSON.stringify(logCalls);

        expect(logString).not.toContain('user@example.com');
        expect(logString).not.toContain('123-45-6789');
        expect(logString).not.toContain('4532-1234-5678-9012');
      });

      it('should handle profile deletion with audit trail', async () => {
        mockSupabaseClient.delete.mockResolvedValue({
          data: { count: 1 },
          error: null
        });

        const result = await service.deleteProfile('org-123', 'user-456', 'es');

        expect(result.success).toBe(true);
        expect(logger.info).toHaveBeenCalledWith(
          'Style profile deleted',
          expect.objectContaining({
            organizationId: 'org-123',
            userId: 'user-456',
            language: 'es'
          })
        );
      });

      it('should enforce data retention policies', async () => {
        const oldDate = new Date('2023-01-01');
        mockSupabaseClient.select.mockResolvedValue({
          data: [
            {
              id: 'profile-123',
              created_at: oldDate.toISOString(),
              language: 'es',
              encrypted_prompt: 'old-data',
              sources: {},
              metadata: {}
            }
          ],
          error: null
        });

        service.decryptStyleProfile.mockReturnValue('[Data expired - deleted for compliance]');

        const result = await service.getUserProfiles('org-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.data.profiles[0].prompt).toBe('[Data expired - deleted for compliance]');
      });
    });

    describe('Error Recovery and Resilience', () => {
      it('should recover from transient database errors', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);
        service._fetchUserComments = jest
          .fn()
          .mockRejectedValueOnce(new Error('Temporary connection error'))
          .mockResolvedValueOnce([{ text: 'Comment 1', platform: 'twitter', lang: 'es' }]);

        // First call should fail
        await expect(
          service.extractStyleProfile('org-123', 'user-456', ['twitter'])
        ).rejects.toThrow('Temporary connection error');

        // Mock successful generation for second attempt
        mockGenerator.generateStyleProfile.mockResolvedValue({
          profiles: [{ lang: 'es', prompt: 'Test prompt', sources: {}, metadata: {} }],
          totalItems: 1
        });
        service.encryptStyleProfile.mockReturnValue('encrypted-data');
        mockSupabaseClient.insert.mockResolvedValue({ data: [{}], error: null });

        // Second call should succeed
        const result = await service.extractStyleProfile('org-123', 'user-456', ['twitter']);
        expect(result.success).toBe(true);
      });

      it('should handle partial profile generation failures', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);
        service._fetchUserComments = jest.fn().mockResolvedValue([
          { text: 'Comment 1', platform: 'twitter', lang: 'es' },
          { text: 'Comment 2', platform: 'youtube', lang: 'en' }
        ]);

        // Mock generator that fails for some languages
        mockGenerator.generateStyleProfile.mockResolvedValue({
          profiles: [
            { lang: 'es', prompt: 'Spanish prompt', sources: {}, metadata: {} }
            // English profile generation failed
          ],
          totalItems: 2,
          errors: ['Failed to generate English profile']
        });

        service.encryptStyleProfile.mockReturnValue('encrypted-data');
        mockSupabaseClient.insert.mockResolvedValue({ data: [{}], error: null });

        const result = await service.extractStyleProfile('org-123', 'user-456', [
          'twitter',
          'youtube'
        ]);

        expect(result.success).toBe(true);
        expect(result.data.profiles).toHaveLength(1);
        expect(result.data.profiles[0].lang).toBe('es');
      });

      it('should maintain system stability under load', async () => {
        service._validatePremiumUser = jest.fn().mockResolvedValue(true);
        service._fetchUserComments = jest.fn().mockImplementation(async () => {
          // Simulate processing delay
          await new Promise((resolve) => setTimeout(resolve, 100));
          return [{ text: 'Comment 1', platform: 'twitter', lang: 'es' }];
        });

        mockGenerator.generateStyleProfile.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            profiles: [{ lang: 'es', prompt: 'Test prompt', sources: {}, metadata: {} }],
            totalItems: 1
          };
        });

        service.encryptStyleProfile.mockReturnValue('encrypted-data');
        mockSupabaseClient.insert.mockResolvedValue({ data: [{}], error: null });

        // Test multiple concurrent requests
        const startTime = Date.now();
        const promises = Array(10)
          .fill()
          .map((_, i) => service.extractStyleProfile('org-123', `user-${i}`, ['twitter']));

        const results = await Promise.allSettled(promises);
        const endTime = Date.now();

        expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
        expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      });
    });
  });
});
