/**
 * Shield Settings Service Tests
 *
 * Comprehensive tests for Shield configuration management
 * Issue #503 - Coverage recovery from 8.58% to ≥75%
 */

const ShieldSettingsService = require('../../../src/services/shieldSettingsService');
const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('ShieldSettingsService', () => {
  let service;
  let mockSupabase;
  let mockLogger;

  beforeEach(() => {
    // Reset logger mock
    const { logger } = require('../../../src/utils/logger');
    mockLogger = logger;
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Create fresh mock for each test
    mockSupabase = createSupabaseMock(
      {
        organization_settings: {
          organization_id: 'org-123',
          aggressiveness: 95,
          tau_roast_lower: 0.25,
          tau_shield: 0.7,
          tau_critical: 0.9,
          shield_enabled: true,
          auto_approve_shield_actions: false,
          corrective_messages_enabled: true
        },
        platform_settings: []
      },
      {
        get_effective_shield_settings: {
          data: [
            {
              organization_id: 'org-123',
              platform: 'twitter',
              aggressiveness: 95,
              tau_roast_lower: 0.25,
              tau_shield: 0.7,
              tau_critical: 0.9,
              shield_enabled: true,
              auto_approve_shield_actions: false,
              corrective_messages_enabled: true,
              response_frequency: 1.0,
              trigger_words: ['roast', 'burn', 'insult'],
              max_responses_per_hour: 50
            }
          ],
          error: null
        }
      }
    );

    service = new ShieldSettingsService({ supabase: mockSupabase, logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default config', () => {
      const defaultService = new ShieldSettingsService();

      expect(defaultService.supabase).toBeDefined();
      expect(defaultService.logger).toBeDefined();
      expect(defaultService.cache).toBeInstanceOf(Map);
      expect(defaultService.cacheTTL).toBe(5 * 60 * 1000);
      expect(mockLogger.info).toHaveBeenCalledWith('Shield Settings Service initialized');
    });

    test('should initialize with custom config', () => {
      const customLogger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const customSupabase = createSupabaseMock();

      const customService = new ShieldSettingsService({
        supabase: customSupabase,
        logger: customLogger
      });

      expect(customService.supabase).toBe(customSupabase);
      expect(customService.logger).toBe(customLogger);
      expect(customLogger.info).toHaveBeenCalledWith('Shield Settings Service initialized');
    });

    test('should have aggressiveness level mappings', () => {
      expect(service.aggressivenessLevels).toHaveProperty('90');
      expect(service.aggressivenessLevels).toHaveProperty('95');
      expect(service.aggressivenessLevels).toHaveProperty('98');
      expect(service.aggressivenessLevels).toHaveProperty('100');

      expect(service.aggressivenessLevels[95]).toEqual({
        name: 'Balanced',
        description: 'Default balanced approach',
        tau_roast_lower: 0.25,
        tau_shield: 0.7,
        tau_critical: 0.9
      });
    });
  });

  describe('Cache Management', () => {
    describe('_getCacheKey', () => {
      test('should create cache key for organization only', () => {
        const key = service._getCacheKey('org-123');
        expect(key).toBe('org-123');
      });

      test('should create cache key for organization and platform', () => {
        const key = service._getCacheKey('org-123', 'twitter');
        expect(key).toBe('org-123:twitter');
      });
    });

    describe('_getCached', () => {
      test('should return cached data if not expired', () => {
        const testData = { aggressiveness: 95 };
        service._setCached('org-123', testData);

        const cached = service._getCached('org-123');
        expect(cached).toEqual(testData);
      });

      test('should return null if cache expired', () => {
        const testData = { aggressiveness: 95 };
        service.cache.set('org-123', {
          data: testData,
          timestamp: Date.now() - 6 * 60 * 1000 // 6 minutes ago (expired)
        });

        const cached = service._getCached('org-123');
        expect(cached).toBeNull();
      });

      test('should return null if key not in cache', () => {
        const cached = service._getCached('nonexistent');
        expect(cached).toBeNull();
      });
    });

    describe('_setCached', () => {
      test('should cache data with timestamp', () => {
        const testData = { aggressiveness: 95 };
        const beforeTime = Date.now();

        service._setCached('org-123', testData);

        const cached = service.cache.get('org-123');
        expect(cached.data).toEqual(testData);
        expect(cached.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(cached.timestamp).toBeLessThanOrEqual(Date.now());
      });
    });

    describe('_clearCache', () => {
      test('should clear organization cache', () => {
        service._setCached('org-123', { aggressiveness: 95 });
        expect(service.cache.has('org-123')).toBe(true);

        service._clearCache('org-123');
        expect(service.cache.has('org-123')).toBe(false);
      });

      test('should clear platform cache and organization cache', () => {
        service._setCached('org-123', { aggressiveness: 95 });
        service._setCached('org-123:twitter', { aggressiveness: 98 });

        service._clearCache('org-123', 'twitter');

        expect(service.cache.has('org-123:twitter')).toBe(false);
        expect(service.cache.has('org-123')).toBe(false);
      });
    });
  });

  describe('getOrganizationSettings', () => {
    test('should return cached settings if available', async () => {
      const cachedSettings = {
        aggressiveness: 98,
        aggressiveness_details: service.aggressivenessLevels[98]
      };
      service._setCached('org-123', cachedSettings);

      const settings = await service.getOrganizationSettings('org-123');

      expect(settings).toEqual(cachedSettings);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Returning cached organization settings', {
        organizationId: 'org-123'
      });
    });

    test('should fetch from database if not cached', async () => {
      const dbData = {
        organization_id: 'org-123',
        aggressiveness: 95,
        tau_roast_lower: 0.25,
        tau_shield: 0.7,
        tau_critical: 0.9,
        shield_enabled: true,
        auto_approve_shield_actions: false,
        corrective_messages_enabled: true
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: dbData, error: null })
          })
        })
      });

      const settings = await service.getOrganizationSettings('org-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('organization_settings');
      expect(settings).toMatchObject(dbData);
      expect(settings.aggressiveness_details).toEqual(service.aggressivenessLevels[95]);
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved organization settings', {
        organizationId: 'org-123',
        aggressiveness: 95
      });
    });

    test('should return default settings if no data exists', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // Not found error
            })
          })
        })
      });

      const settings = await service.getOrganizationSettings('org-123');

      expect(settings).toEqual(service.getDefaultOrganizationSettings());
    });

    test('should throw error on database failure', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      });

      await expect(service.getOrganizationSettings('org-123')).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get organization settings',
        expect.objectContaining({
          organizationId: 'org-123',
          error: 'Database connection failed'
        })
      );
    });

    test('should cache fetched settings', async () => {
      const dbData = {
        organization_id: 'org-123',
        aggressiveness: 95,
        tau_roast_lower: 0.25,
        tau_shield: 0.7,
        tau_critical: 0.9,
        shield_enabled: true
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: dbData, error: null })
          })
        })
      });

      await service.getOrganizationSettings('org-123');

      const cached = service._getCached('org-123');
      expect(cached).toBeDefined();
      expect(cached.aggressiveness).toBe(95);
    });
  });

  describe('updateOrganizationSettings', () => {
    test('should update organization settings successfully', async () => {
      const updateSettings = {
        aggressiveness: 98,
        tau_roast_lower: 0.2,
        tau_shield: 0.65,
        tau_critical: 0.85,
        shield_enabled: true,
        auto_approve_shield_actions: true,
        corrective_messages_enabled: true
      };

      const updatedData = {
        organization_id: 'org-123',
        ...updateSettings
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: updatedData, error: null })
          })
        })
      });

      // Set initial cache
      service._setCached('org-123', { aggressiveness: 95 });
      expect(service.cache.has('org-123')).toBe(true);

      const result = await service.updateOrganizationSettings(
        'org-123',
        updateSettings,
        'user-456'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('organization_settings');
      expect(result).toMatchObject(updatedData);
      expect(result.aggressiveness_details).toEqual(service.aggressivenessLevels[98]);

      // Cache should be cleared
      expect(service.cache.has('org-123')).toBe(false);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Updated organization settings',
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'user-456',
          aggressiveness: 98,
          shield_enabled: true
        })
      );
    });

    test('should throw error on invalid settings', async () => {
      const invalidSettings = {
        aggressiveness: 99, // Invalid aggressiveness
        tau_roast_lower: 0.25,
        tau_shield: 0.7,
        tau_critical: 0.9,
        shield_enabled: true
      };

      await expect(
        service.updateOrganizationSettings('org-123', invalidSettings, 'user-456')
      ).rejects.toThrow('Validation failed');
    });

    test('should throw error on database failure', async () => {
      const validSettings = {
        aggressiveness: 95,
        tau_roast_lower: 0.25,
        tau_shield: 0.7,
        tau_critical: 0.9,
        shield_enabled: true,
        auto_approve_shield_actions: false,
        corrective_messages_enabled: true
      };

      const dbError = new Error('Database write failed');
      mockSupabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: dbError })
          })
        })
      });

      await expect(
        service.updateOrganizationSettings('org-123', validSettings, 'user-456')
      ).rejects.toThrow('Database write failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update organization settings',
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'user-456',
          error: 'Database write failed'
        })
      );
    });
  });

  describe('getPlatformSettings', () => {
    test('should retrieve platform settings successfully', async () => {
      const platformData = {
        organization_id: 'org-123',
        platform: 'twitter',
        aggressiveness: 98,
        tau_roast_lower: 0.2,
        tau_shield: 0.65,
        tau_critical: 0.85,
        shield_enabled: true
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: platformData, error: null })
            })
          })
        })
      });

      const settings = await service.getPlatformSettings('org-123', 'twitter');

      expect(mockSupabase.from).toHaveBeenCalledWith('platform_settings');
      expect(settings).toEqual(platformData);
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved platform settings', {
        organizationId: 'org-123',
        platform: 'twitter',
        hasSettings: true
      });
    });

    test('should return null if no platform settings exist', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      const settings = await service.getPlatformSettings('org-123', 'twitter');

      expect(settings).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved platform settings', {
        organizationId: 'org-123',
        platform: 'twitter',
        hasSettings: false
      });
    });

    test('should throw error on database failure', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: dbError })
            })
          })
        })
      });

      await expect(service.getPlatformSettings('org-123', 'twitter')).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get platform settings',
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          error: 'Database connection failed'
        })
      );
    });
  });

  describe('updatePlatformSettings', () => {
    test('should update platform settings successfully', async () => {
      const updateSettings = {
        aggressiveness: 98,
        tau_roast_lower: 0.2,
        tau_shield: 0.65,
        tau_critical: 0.85,
        shield_enabled: true,
        auto_approve_shield_actions: true,
        corrective_messages_enabled: true,
        response_frequency: 0.8,
        trigger_words: ['roast', 'burn'],
        max_responses_per_hour: 30
      };

      const updatedData = {
        organization_id: 'org-123',
        platform: 'twitter',
        ...updateSettings
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: updatedData, error: null })
          })
        })
      });

      const result = await service.updatePlatformSettings(
        'org-123',
        'twitter',
        updateSettings,
        'user-456'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('platform_settings');
      expect(result).toEqual(updatedData);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Updated platform settings',
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          userId: 'user-456',
          aggressiveness: 98
        })
      );
    });

    test('should allow null values for inheritance', async () => {
      const updateSettings = {
        aggressiveness: null, // Inherit from organization
        tau_roast_lower: 0.2,
        tau_shield: null,
        tau_critical: null,
        shield_enabled: true
      };

      const updatedData = {
        organization_id: 'org-123',
        platform: 'youtube',
        ...updateSettings
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: updatedData, error: null })
          })
        })
      });

      const result = await service.updatePlatformSettings(
        'org-123',
        'youtube',
        updateSettings,
        'user-456'
      );

      expect(result).toEqual(updatedData);
    });

    test('should throw error on invalid platform', async () => {
      const updateSettings = { aggressiveness: 95 };

      await expect(
        service.updatePlatformSettings('org-123', 'invalid-platform', updateSettings, 'user-456')
      ).rejects.toThrow('Unsupported platform');
    });

    test('should throw error on invalid settings', async () => {
      const invalidSettings = {
        aggressiveness: 99, // Invalid
        tau_roast_lower: 0.25,
        tau_shield: 0.7,
        tau_critical: 0.9
      };

      await expect(
        service.updatePlatformSettings('org-123', 'twitter', invalidSettings, 'user-456')
      ).rejects.toThrow('Validation failed');
    });

    test('should remove undefined values but keep nulls', async () => {
      const updateSettings = {
        aggressiveness: 95,
        tau_roast_lower: undefined, // Should be removed
        tau_shield: null, // Should be kept
        shield_enabled: true
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                organization_id: 'org-123',
                platform: 'twitter',
                aggressiveness: 95,
                tau_shield: null,
                shield_enabled: true
              },
              error: null
            })
          })
        })
      });

      await service.updatePlatformSettings('org-123', 'twitter', updateSettings, 'user-456');

      // Verify upsert was called without undefined values
      const upsertCall = mockSupabase.from().upsert.mock.calls[0][0];
      expect(upsertCall).not.toHaveProperty('tau_roast_lower');
      expect(upsertCall).toHaveProperty('tau_shield', null);
    });
  });

  describe('getEffectiveSettings', () => {
    test('should retrieve effective settings via RPC', async () => {
      const effectiveData = {
        organization_id: 'org-123',
        platform: 'twitter',
        aggressiveness: 95,
        tau_roast_lower: 0.25,
        tau_shield: 0.7,
        tau_critical: 0.9,
        shield_enabled: true,
        auto_approve_shield_actions: false,
        corrective_messages_enabled: true,
        response_frequency: 1.0,
        trigger_words: ['roast', 'burn', 'insult'],
        max_responses_per_hour: 50
      };

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: [effectiveData],
        error: null
      });

      const settings = await service.getEffectiveSettings('org-123', 'twitter');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_effective_shield_settings', {
        org_id: 'org-123',
        platform_name: 'twitter'
      });

      expect(settings).toMatchObject(effectiveData);
      expect(settings.aggressiveness_details).toEqual(service.aggressivenessLevels[95]);
      expect(settings.source).toBe('database');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Retrieved effective settings',
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          aggressiveness: 95,
          shield_enabled: true
        })
      );
    });

    test('should return default settings if RPC returns empty', async () => {
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: [],
        error: null
      });

      const settings = await service.getEffectiveSettings('org-123', 'twitter');

      const defaultSettings = service.getDefaultOrganizationSettings();
      expect(settings).toMatchObject({
        ...defaultSettings,
        response_frequency: 1.0,
        trigger_words: ['roast', 'burn', 'insult'],
        max_responses_per_hour: 50,
        source: 'default'
      });
    });

    test('should return default settings if RPC returns null', async () => {
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const settings = await service.getEffectiveSettings('org-123', 'youtube');

      expect(settings.source).toBe('default');
      expect(settings.response_frequency).toBe(1.0);
    });

    test('should throw error on RPC failure', async () => {
      const rpcError = new Error('RPC function not found');
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: rpcError
      });

      await expect(service.getEffectiveSettings('org-123', 'twitter')).rejects.toThrow(
        'RPC function not found'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get effective settings',
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          error: 'RPC function not found'
        })
      );
    });
  });

  describe('getAllPlatformSettings', () => {
    test('should retrieve all platform settings for organization', async () => {
      const platforms = [
        { organization_id: 'org-123', platform: 'twitter', aggressiveness: 98 },
        { organization_id: 'org-123', platform: 'youtube', aggressiveness: 90 },
        { organization_id: 'org-123', platform: 'instagram', aggressiveness: 95 }
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: platforms, error: null })
          })
        })
      });

      const settings = await service.getAllPlatformSettings('org-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('platform_settings');
      expect(settings).toEqual(platforms);
      expect(settings).toHaveLength(3);
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved all platform settings', {
        organizationId: 'org-123',
        platformCount: 3
      });
    });

    test('should return empty array if no platforms configured', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      });

      const settings = await service.getAllPlatformSettings('org-123');

      expect(settings).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved all platform settings', {
        organizationId: 'org-123',
        platformCount: 0
      });
    });

    test('should throw error on database failure', async () => {
      const dbError = new Error('Database query failed');
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: null, error: dbError })
          })
        })
      });

      await expect(service.getAllPlatformSettings('org-123')).rejects.toThrow(
        'Database query failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get all platform settings',
        expect.objectContaining({
          organizationId: 'org-123',
          error: 'Database query failed'
        })
      );
    });
  });

  describe('deletePlatformSettings', () => {
    test('should delete platform settings successfully', async () => {
      const deletedData = [
        {
          organization_id: 'org-123',
          platform: 'twitter',
          aggressiveness: 98
        }
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: deletedData, error: null })
            })
          })
        })
      });

      const result = await service.deletePlatformSettings('org-123', 'twitter', 'user-456');

      expect(mockSupabase.from).toHaveBeenCalledWith('platform_settings');
      expect(result).toEqual({ success: true, deleted: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Deleted platform settings',
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          userId: 'user-456',
          deleted: true
        })
      );
    });

    test('should return false if no settings to delete', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      const result = await service.deletePlatformSettings('org-123', 'youtube', 'user-456');

      expect(result).toEqual({ success: true, deleted: false });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Deleted platform settings',
        expect.objectContaining({ deleted: false })
      );
    });

    test('should throw error on database failure', async () => {
      const dbError = new Error('Database delete failed');
      mockSupabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: null, error: dbError })
            })
          })
        })
      });

      await expect(
        service.deletePlatformSettings('org-123', 'twitter', 'user-456')
      ).rejects.toThrow('Database delete failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete platform settings',
        expect.objectContaining({
          organizationId: 'org-123',
          platform: 'twitter',
          userId: 'user-456',
          error: 'Database delete failed'
        })
      );
    });
  });

  describe('Helper Methods', () => {
    describe('getAggressivenessLevels', () => {
      test('should return all aggressiveness levels', () => {
        const levels = service.getAggressivenessLevels();

        expect(levels).toHaveProperty('90');
        expect(levels).toHaveProperty('95');
        expect(levels).toHaveProperty('98');
        expect(levels).toHaveProperty('100');
        expect(Object.keys(levels)).toHaveLength(4);
      });
    });

    describe('getSupportedPlatforms', () => {
      test('should return all supported platforms', () => {
        const platforms = service.getSupportedPlatforms();

        expect(platforms).toContain('twitter');
        expect(platforms).toContain('youtube');
        expect(platforms).toContain('bluesky');
        expect(platforms).toContain('instagram');
        expect(platforms).toContain('facebook');
        expect(platforms).toContain('discord');
        expect(platforms).toContain('twitch');
        expect(platforms).toContain('reddit');
        expect(platforms).toContain('tiktok');
        expect(platforms).toHaveLength(9);
      });
    });

    describe('getDefaultOrganizationSettings', () => {
      test('should return default settings', () => {
        const defaults = service.getDefaultOrganizationSettings();

        expect(defaults).toEqual({
          aggressiveness: 95,
          tau_roast_lower: 0.25,
          tau_shield: 0.7,
          tau_critical: 0.9,
          shield_enabled: true,
          auto_approve_shield_actions: false,
          corrective_messages_enabled: true,
          aggressiveness_details: service.aggressivenessLevels[95]
        });
      });
    });
  });

  describe('Validation Methods', () => {
    describe('validateOrganizationSettings', () => {
      test('should validate valid organization settings', () => {
        const validSettings = {
          aggressiveness: 95,
          tau_roast_lower: 0.25,
          tau_shield: 0.7,
          tau_critical: 0.9,
          shield_enabled: true
        };

        expect(() => service.validateOrganizationSettings(validSettings)).not.toThrow();
      });

      test('should throw error for invalid aggressiveness', () => {
        const invalidSettings = {
          aggressiveness: 99
        };

        expect(() => service.validateOrganizationSettings(invalidSettings)).toThrow(
          'Validation failed: Aggressiveness must be one of: 90, 95, 98, 100'
        );
      });

      test('should throw error for tau_roast_lower out of range', () => {
        const invalidSettings = {
          tau_roast_lower: 1.5,
          tau_shield: 0.7,
          tau_critical: 0.9
        };

        expect(() => service.validateOrganizationSettings(invalidSettings)).toThrow(
          'Validation failed: tau_roast_lower must be between 0 and 1'
        );
      });

      test('should throw error for tau_shield out of range', () => {
        const invalidSettings = {
          tau_roast_lower: 0.25,
          tau_shield: -0.1,
          tau_critical: 0.9
        };

        expect(() => service.validateOrganizationSettings(invalidSettings)).toThrow(
          'Validation failed: tau_shield must be between 0 and 1'
        );
      });

      test('should throw error for tau_critical out of range', () => {
        const invalidSettings = {
          tau_roast_lower: 0.25,
          tau_shield: 0.7,
          tau_critical: 1.5
        };

        expect(() => service.validateOrganizationSettings(invalidSettings)).toThrow(
          'Validation failed: tau_critical must be between 0 and 1'
        );
      });

      test('should throw error if tau_roast_lower >= tau_shield', () => {
        const invalidSettings = {
          tau_roast_lower: 0.75,
          tau_shield: 0.7,
          tau_critical: 0.9
        };

        expect(() => service.validateOrganizationSettings(invalidSettings)).toThrow(
          'Validation failed: tau_roast_lower must be less than tau_shield'
        );
      });

      test('should throw error if tau_shield >= tau_critical', () => {
        const invalidSettings = {
          tau_roast_lower: 0.25,
          tau_shield: 0.95,
          tau_critical: 0.9
        };

        expect(() => service.validateOrganizationSettings(invalidSettings)).toThrow(
          'Validation failed: tau_shield must be less than tau_critical'
        );
      });

      test('should throw multiple validation errors', () => {
        const invalidSettings = {
          aggressiveness: 99,
          tau_roast_lower: 1.5,
          tau_shield: 0.7,
          tau_critical: 0.9
        };

        expect(() => service.validateOrganizationSettings(invalidSettings)).toThrow(
          'Validation failed'
        );
      });
    });

    describe('validatePlatformSettings', () => {
      test('should validate valid platform settings', () => {
        const validSettings = {
          aggressiveness: 98,
          tau_roast_lower: 0.2,
          tau_shield: 0.65,
          tau_critical: 0.85,
          response_frequency: 0.8,
          max_responses_per_hour: 30
        };

        expect(() => service.validatePlatformSettings(validSettings)).not.toThrow();
      });

      test('should allow null values for inheritance', () => {
        const settingsWithNulls = {
          aggressiveness: null,
          tau_roast_lower: null,
          tau_shield: 0.7,
          tau_critical: null,
          response_frequency: null,
          max_responses_per_hour: null
        };

        expect(() => service.validatePlatformSettings(settingsWithNulls)).not.toThrow();
      });

      test('should throw error for invalid response_frequency', () => {
        const invalidSettings = {
          response_frequency: 1.5
        };

        expect(() => service.validatePlatformSettings(invalidSettings)).toThrow(
          'Validation failed: response_frequency must be between 0 and 1'
        );
      });

      test('should throw error for negative max_responses_per_hour', () => {
        const invalidSettings = {
          max_responses_per_hour: -10
        };

        expect(() => service.validatePlatformSettings(invalidSettings)).toThrow(
          'Validation failed: max_responses_per_hour must be a positive integer'
        );
      });

      test('should throw error for non-integer max_responses_per_hour', () => {
        const invalidSettings = {
          max_responses_per_hour: 10.5
        };

        expect(() => service.validatePlatformSettings(invalidSettings)).toThrow(
          'Validation failed: max_responses_per_hour must be a positive integer'
        );
      });

      test('should validate threshold relationships when all provided', () => {
        const invalidSettings = {
          tau_roast_lower: 0.75,
          tau_shield: 0.7,
          tau_critical: 0.9
        };

        expect(() => service.validatePlatformSettings(invalidSettings)).toThrow(
          'Validation failed: tau_roast_lower must be less than tau_shield'
        );
      });
    });

    describe('validatePlatform', () => {
      test('should validate supported platforms', () => {
        expect(() => service.validatePlatform('twitter')).not.toThrow();
        expect(() => service.validatePlatform('youtube')).not.toThrow();
        expect(() => service.validatePlatform('bluesky')).not.toThrow();
      });

      test('should throw error for unsupported platform', () => {
        expect(() => service.validatePlatform('invalid-platform')).toThrow(
          'Unsupported platform: invalid-platform'
        );
      });
    });
  });

  describe('Utility Methods', () => {
    describe('aggressivenessToThresholds', () => {
      test('should convert aggressiveness 90 to thresholds', () => {
        const thresholds = service.aggressivenessToThresholds(90);

        expect(thresholds).toEqual({
          tau_roast_lower: 0.3,
          tau_shield: 0.75,
          tau_critical: 0.95
        });
      });

      test('should convert aggressiveness 95 to thresholds', () => {
        const thresholds = service.aggressivenessToThresholds(95);

        expect(thresholds).toEqual({
          tau_roast_lower: 0.25,
          tau_shield: 0.7,
          tau_critical: 0.9
        });
      });

      test('should convert aggressiveness 98 to thresholds', () => {
        const thresholds = service.aggressivenessToThresholds(98);

        expect(thresholds).toEqual({
          tau_roast_lower: 0.2,
          tau_shield: 0.65,
          tau_critical: 0.85
        });
      });

      test('should convert aggressiveness 100 to thresholds', () => {
        const thresholds = service.aggressivenessToThresholds(100);

        expect(thresholds).toEqual({
          tau_roast_lower: 0.15,
          tau_shield: 0.6,
          tau_critical: 0.8
        });
      });

      test('should throw error for invalid aggressiveness', () => {
        expect(() => service.aggressivenessToThresholds(99)).toThrow(
          'Invalid aggressiveness level: 99'
        );
      });
    });

    describe('getSettingsSummary', () => {
      test('should retrieve comprehensive settings summary', async () => {
        const orgSettings = {
          organization_id: 'org-123',
          aggressiveness: 95,
          tau_roast_lower: 0.25,
          tau_shield: 0.7,
          tau_critical: 0.9,
          shield_enabled: true,
          auto_approve_shield_actions: false,
          corrective_messages_enabled: true,
          aggressiveness_details: service.aggressivenessLevels[95]
        };

        const platformSettings = [
          {
            organization_id: 'org-123',
            platform: 'twitter',
            aggressiveness: 98,
            tau_roast_lower: null,
            tau_shield: null,
            tau_critical: null,
            shield_enabled: true,
            auto_approve_shield_actions: null,
            corrective_messages_enabled: null
          },
          {
            organization_id: 'org-123',
            platform: 'youtube',
            aggressiveness: null,
            tau_roast_lower: null,
            tau_shield: null,
            tau_critical: null,
            shield_enabled: false,
            auto_approve_shield_actions: null,
            corrective_messages_enabled: null
          }
        ];

        // Create a fresh service instance with proper mocking for Promise.all
        const freshMock = createSupabaseMock();
        freshMock.from = jest
          .fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: orgSettings, error: null })
              })
            })
          })
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: platformSettings, error: null })
              })
            })
          });

        const freshService = new ShieldSettingsService({ supabase: freshMock, logger: mockLogger });

        const summary = await freshService.getSettingsSummary('org-123');

        expect(summary.organization).toMatchObject({
          organization_id: 'org-123',
          aggressiveness: 95,
          shield_enabled: true
        });
        expect(summary.platforms).toHaveProperty('twitter');
        expect(summary.platforms).toHaveProperty('youtube');
        expect(summary.platforms.twitter.hasOverrides).toBe(true);
        expect(summary.platforms.youtube.hasOverrides).toBe(true);
        expect(summary.summary).toEqual({
          shield_enabled: true,
          aggressiveness_level: 'Balanced',
          platform_overrides: 2,
          active_overrides: 2
        });
      });

      test('should handle no platform overrides', async () => {
        const orgSettings = {
          organization_id: 'org-123',
          aggressiveness: 95,
          shield_enabled: true,
          aggressiveness_details: service.aggressivenessLevels[95]
        };

        const freshMock = createSupabaseMock();
        freshMock.from = jest
          .fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: orgSettings, error: null })
              })
            })
          })
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          });

        const freshService = new ShieldSettingsService({ supabase: freshMock, logger: mockLogger });

        const summary = await freshService.getSettingsSummary('org-123');

        expect(summary.summary).toEqual({
          shield_enabled: true,
          aggressiveness_level: 'Balanced',
          platform_overrides: 0,
          active_overrides: 0
        });
      });

      test('should throw error on failure', async () => {
        const orgSettings = {
          organization_id: 'org-123',
          aggressiveness: 95,
          shield_enabled: true,
          aggressiveness_details: service.aggressivenessLevels[95]
        };

        const dbError = new Error('Database error');

        // Mock successful org settings, but fail on platform settings
        const freshMock = createSupabaseMock();
        freshMock.from = jest
          .fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: orgSettings, error: null })
              })
            })
          })
          .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: null, error: dbError })
              })
            })
          });

        const freshService = new ShieldSettingsService({ supabase: freshMock, logger: mockLogger });

        await expect(freshService.getSettingsSummary('org-123')).rejects.toThrow('Database error');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get all platform settings',
          expect.objectContaining({
            organizationId: 'org-123',
            error: 'Database error'
          })
        );
      });
    });
  });
});
