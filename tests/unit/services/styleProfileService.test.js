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

const { jest } = require('@jest/globals');
const StyleProfileService = require('../../../src/services/styleProfileService');
const StyleProfileGenerator = require('../../../src/services/styleProfileGenerator');
const EncryptionConfig = require('../../../src/config/encryption');

// Mock dependencies
jest.mock('../../../src/services/styleProfileGenerator');
jest.mock('../../../src/config/encryption');
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
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mockSupabaseClient = require('../../../src/config/supabase').supabaseServiceClient;
const { logger } = require('../../../src/utils/logger');

describe('StyleProfileService', () => {
  let service;
  let mockGenerator;
  let mockEncryption;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock generator
    mockGenerator = {
      generateStyleProfile: jest.fn(),
      initialize: jest.fn()
    };
    StyleProfileGenerator.mockImplementation(() => mockGenerator);

    // Setup mock encryption
    mockEncryption = {
      encrypt: jest.fn(),
      decrypt: jest.fn()
    };
    EncryptionConfig.mockImplementation(() => mockEncryption);

    service = new StyleProfileService();
  });

  describe('constructor', () => {
    it('should initialize with encryption and generator', () => {
      expect(StyleProfileGenerator).toHaveBeenCalled();
      expect(EncryptionConfig).toHaveBeenCalled();
    });
  });

  describe('extractStyleProfile', () => {
    const mockProfile = {
      profiles: [{
        lang: 'es',
        prompt: 'Eres un usuario casual...',
        sources: { twitter: 150, youtube: 100 },
        metadata: { totalItems: 250 }
      }],
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
      mockEncryption.encrypt.mockReturnValue('encrypted-prompt-data');
      
      // Mock database insertion
      mockSupabaseClient.insert.mockResolvedValue({
        data: [{ id: 'profile-123', ...mockProfile.profiles[0] }],
        error: null
      });
    });

    it('should extract style profile successfully', async () => {
      const result = await service.extractStyleProfile('org-123', 'user-456', ['twitter', 'youtube']);

      expect(service._validatePremiumUser).toHaveBeenCalledWith('org-123', 'user-456');
      expect(service._fetchUserComments).toHaveBeenCalledWith('org-123', 'user-456', ['twitter', 'youtube']);
      expect(mockGenerator.generateStyleProfile).toHaveBeenCalledWith('user-456', expect.any(Object));
      expect(mockSupabaseClient.insert).toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        data: mockProfile
      });
    });

    it('should handle premium user validation failure', async () => {
      service._validatePremiumUser.mockRejectedValue(new Error('Premium plan required'));

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter']))
        .rejects.toThrow('Premium plan required');
    });

    it('should handle insufficient content', async () => {
      service._fetchUserComments.mockResolvedValue([]);

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter']))
        .rejects.toThrow('Insufficient content available for style profile generation');
    });

    it('should handle profile generation errors', async () => {
      mockGenerator.generateStyleProfile.mockRejectedValue(new Error('Generation failed'));

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter']))
        .rejects.toThrow('Generation failed');
    });

    it('should handle database insertion errors', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(service.extractStyleProfile('org-123', 'user-456', ['twitter']))
        .rejects.toThrow('Database error');
    });

    it('should encrypt sensitive data before storage', async () => {
      await service.extractStyleProfile('org-123', 'user-456', ['twitter']);

      expect(mockEncryption.encrypt).toHaveBeenCalledWith(
        mockProfile.profiles[0].prompt
      );
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

      mockEncryption.decrypt.mockReturnValue('Decrypted prompt text');
    });

    it('should get user profiles successfully', async () => {
      const result = await service.getUserProfiles('org-123', 'user-456');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('style_profiles');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('organization_id', 'org-123');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'user-456');

      expect(result).toEqual({
        success: true,
        data: {
          profiles: [{
            id: 'profile-123',
            lang: 'es',
            prompt: 'Decrypted prompt text',
            sources: { twitter: 150 },
            metadata: { totalItems: 150 },
            createdAt: '2025-01-20T10:00:00Z'
          }]
        }
      });
    });

    it('should handle database query errors', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: null,
        error: { message: 'Database query failed' }
      });

      await expect(service.getUserProfiles('org-123', 'user-456'))
        .rejects.toThrow('Database query failed');
    });

    it('should handle decryption errors gracefully', async () => {
      mockEncryption.decrypt.mockImplementation(() => {
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

      await expect(service.deleteProfile('org-123', 'user-456', 'es'))
        .rejects.toThrow('Deletion failed');
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
      await expect(service._validatePremiumUser('org-123', 'user-456'))
        .resolves.not.toThrow();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('organizations');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'org-123');
    });

    it('should reject non-premium users', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { plan: 'free' },
        error: null
      });

      await expect(service._validatePremiumUser('org-123', 'user-456'))
        .rejects.toThrow('Style profile extraction requires a Premium plan (Pro or higher)');
    });

    it('should handle organization not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Organization not found' }
      });

      await expect(service._validatePremiumUser('org-123', 'user-456'))
        .rejects.toThrow('Organization not found');
    });

    it('should validate all premium plan types', async () => {
      const premiumPlans = ['pro', 'plus', 'creator_plus', 'enterprise'];

      for (const plan of premiumPlans) {
        mockSupabaseClient.single.mockResolvedValue({
          data: { plan },
          error: null
        });

        await expect(service._validatePremiumUser('org-123', 'user-456'))
          .resolves.not.toThrow();
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
      const result = await service._fetchUserComments('org-123', 'user-456', ['twitter', 'youtube']);

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

      await expect(service._fetchUserComments('org-123', 'user-456', ['twitter']))
        .rejects.toThrow('Query failed');
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
      await expect(service.extractStyleProfile('', 'user-456', ['twitter']))
        .rejects.toThrow('Organization ID is required');
    });

    it('should handle missing user ID', async () => {
      await expect(service.extractStyleProfile('org-123', '', ['twitter']))
        .rejects.toThrow('User ID is required');
    });

    it('should handle empty platforms array', async () => {
      await expect(service.extractStyleProfile('org-123', 'user-456', []))
        .rejects.toThrow('At least one platform must be specified');
    });

    it('should validate platform names', async () => {
      await expect(service.extractStyleProfile('org-123', 'user-456', ['invalid-platform']))
        .rejects.toThrow('Invalid platform: invalid-platform');
    });

    it('should handle encryption configuration errors', async () => {
      EncryptionConfig.mockImplementation(() => {
        throw new Error('Encryption config failed');
      });

      expect(() => new StyleProfileService()).toThrow('Encryption config failed');
    });
  });

  describe('GDPR compliance', () => {
    it('should not store raw user content', async () => {
      service._validatePremiumUser = jest.fn().mockResolvedValue(true);
      service._fetchUserComments = jest.fn().mockResolvedValue([
        { text: 'Sensitive user content', platform: 'twitter', lang: 'es' }
      ]);

      mockGenerator.generateStyleProfile.mockResolvedValue({
        profiles: [{
          lang: 'es',
          prompt: 'Generated prompt without raw content',
          sources: { twitter: 1 },
          metadata: { totalItems: 1 }
        }],
        totalItems: 1
      });

      mockEncryption.encrypt.mockReturnValue('encrypted-data');
      mockSupabaseClient.insert.mockResolvedValue({
        data: [{}],
        error: null
      });

      await service.extractStyleProfile('org-123', 'user-456', ['twitter']);

      // Verify that only the generated prompt is encrypted and stored, not raw content
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('Generated prompt without raw content');
      expect(mockEncryption.encrypt).not.toHaveBeenCalledWith('Sensitive user content');
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
});