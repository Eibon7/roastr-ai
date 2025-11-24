/**
 * Kill Switch Middleware Tests
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
  feature_flags: []
});

// Mock Supabase
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const {
  killSwitchService,
  checkKillSwitch,
  shouldBlockAutopost
} = require('../../../src/middleware/killSwitch');
const { supabaseServiceClient } = require('../../../src/config/supabase');

describe('Kill Switch Middleware', () => {
  let mockSelect, mockEq, mockSingle, mockIn;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();

    // Reset kill switch service
    killSwitchService.cache.clear();
    killSwitchService.lastCacheUpdate = 0;
    killSwitchService.isInitialized = false;

    // Setup Supabase mocks
    mockSingle = jest.fn();
    mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    mockIn = jest.fn().mockReturnValue({ single: mockSingle });
    mockSelect = jest.fn().mockReturnValue({
      eq: mockEq,
      in: mockIn
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect
    });
  });

  describe('KillSwitchService', () => {
    describe('getFlag', () => {
      it('should return flag from database when not cached', async () => {
        const mockFlag = {
          flag_key: 'KILL_SWITCH_AUTOPOST',
          is_enabled: false,
          flag_value: false
        };

        mockSingle.mockResolvedValue({
          data: mockFlag,
          error: null
        });

        const result = await killSwitchService.getFlag('KILL_SWITCH_AUTOPOST');

        expect(result.is_enabled).toBe(false);
        expect(result.flag_value).toBe(false);
        expect(supabaseServiceClient.from).toHaveBeenCalledWith('feature_flags');
        expect(mockSelect).toHaveBeenCalledWith('flag_key, is_enabled, flag_value');
        expect(mockEq).toHaveBeenCalledWith('flag_key', 'KILL_SWITCH_AUTOPOST');
      });

      it('should return default values when flag not found', async () => {
        mockSingle.mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        });

        const result = await killSwitchService.getFlag('NONEXISTENT_FLAG');

        expect(result.is_enabled).toBe(false);
        expect(result.flag_value).toBe(false);
      });

      it('should handle database errors gracefully', async () => {
        mockSingle.mockRejectedValue(new Error('Database error'));

        const result = await killSwitchService.getFlag('KILL_SWITCH_AUTOPOST');

        expect(result.is_enabled).toBe(false);
        expect(result.flag_value).toBe(false);
      });
    });

    describe('isKillSwitchActive', () => {
      it('should return true when kill switch is enabled', async () => {
        mockSingle.mockResolvedValue({
          data: {
            flag_key: 'KILL_SWITCH_AUTOPOST',
            is_enabled: true,
            flag_value: true
          },
          error: null
        });

        const result = await killSwitchService.isKillSwitchActive();
        expect(result).toBe(true);
      });

      it('should return false when kill switch is disabled', async () => {
        mockSingle.mockResolvedValue({
          data: {
            flag_key: 'KILL_SWITCH_AUTOPOST',
            is_enabled: false,
            flag_value: false
          },
          error: null
        });

        const result = await killSwitchService.isKillSwitchActive();
        expect(result).toBe(false);
      });
    });

    describe('isPlatformAutopostEnabled', () => {
      it('should return true for enabled platform', async () => {
        mockSingle.mockResolvedValue({
          data: {
            flag_key: 'AUTOPOST_TWITTER',
            is_enabled: true,
            flag_value: true
          },
          error: null
        });

        const result = await killSwitchService.isPlatformAutopostEnabled('twitter');
        expect(result).toBe(true);
      });

      it('should return false for disabled platform', async () => {
        mockSingle.mockResolvedValue({
          data: {
            flag_key: 'AUTOPOST_INSTAGRAM',
            is_enabled: false,
            flag_value: false
          },
          error: null
        });

        const result = await killSwitchService.isPlatformAutopostEnabled('instagram');
        expect(result).toBe(false);
      });
    });
  });

  describe('checkKillSwitch middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        path: '/api/autopost',
        method: 'POST',
        get: jest.fn().mockReturnValue('test-user-agent'),
        ip: '127.0.0.1'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should block request when kill switch is active', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { flag_key: 'KILL_SWITCH_AUTOPOST', is_enabled: true, flag_value: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: { flag_key: 'ENABLE_AUTOPOST', is_enabled: true, flag_value: true },
          error: null
        });

      await checkKillSwitch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Autopost operations are currently disabled',
        code: 'KILL_SWITCH_ACTIVE',
        message: 'All automatic posting has been temporarily disabled by the administrator'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block request when autopost is disabled', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { flag_key: 'KILL_SWITCH_AUTOPOST', is_enabled: false, flag_value: false },
          error: null
        })
        .mockResolvedValueOnce({
          data: { flag_key: 'ENABLE_AUTOPOST', is_enabled: false, flag_value: false },
          error: null
        });

      await checkKillSwitch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Autopost is currently disabled',
        code: 'AUTOPOST_DISABLED',
        message: 'Automatic posting is currently disabled'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request when both kill switch and autopost are enabled', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { flag_key: 'KILL_SWITCH_AUTOPOST', is_enabled: false, flag_value: false },
          error: null
        })
        .mockResolvedValueOnce({
          data: { flag_key: 'ENABLE_AUTOPOST', is_enabled: true, flag_value: true },
          error: null
        });

      await checkKillSwitch(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should fail closed on database errors', async () => {
      // Mock the service methods to throw errors directly
      const isKillSwitchActiveSpy = jest
        .spyOn(killSwitchService, 'isKillSwitchActive')
        .mockRejectedValue(new Error('Database connection failed'));
      const isAutopostEnabledSpy = jest
        .spyOn(killSwitchService, 'isAutopostEnabled')
        .mockRejectedValue(new Error('Database connection failed'));

      await checkKillSwitch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Service temporarily unavailable',
        code: 'KILL_SWITCH_ERROR',
        message: 'Unable to verify system status, blocking operation for safety'
      });
      expect(next).not.toHaveBeenCalled();

      // Restore mocks
      isKillSwitchActiveSpy.mockRestore();
      isAutopostEnabledSpy.mockRestore();
    });

    it('should verify fail-open behavior for isAutopostEnabled method', async () => {
      // Mock the getFlag method to throw an error to test fail-open behavior
      const getFlagSpy = jest
        .spyOn(killSwitchService, 'getFlag')
        .mockRejectedValue(new Error('Database connection failed'));

      // Test that isAutopostEnabled fails open (returns true on error)
      const result = await killSwitchService.isAutopostEnabled();

      expect(result).toBe(true); // Should fail open
      expect(getFlagSpy).toHaveBeenCalledWith('ENABLE_AUTOPOST');

      // Restore mocks
      getFlagSpy.mockRestore();
    });
  });

  describe('shouldBlockAutopost function', () => {
    it('should block when kill switch is active', async () => {
      mockSingle.mockResolvedValue({
        data: { flag_key: 'KILL_SWITCH_AUTOPOST', is_enabled: true, flag_value: true },
        error: null
      });

      const result = await shouldBlockAutopost();

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('KILL_SWITCH_ACTIVE');
      expect(result.message).toBe('Global kill switch is active');
    });

    it('should block when platform is disabled', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { flag_key: 'KILL_SWITCH_AUTOPOST', is_enabled: false, flag_value: false },
          error: null
        })
        .mockResolvedValueOnce({
          data: { flag_key: 'ENABLE_AUTOPOST', is_enabled: true, flag_value: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: { flag_key: 'AUTOPOST_TWITTER', is_enabled: false, flag_value: false },
          error: null
        });

      const result = await shouldBlockAutopost('twitter');

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('PLATFORM_AUTOPOST_DISABLED');
      expect(result.message).toBe('Autopost is disabled for twitter');
      expect(result.platform).toBe('twitter');
    });

    it('should allow when all checks pass', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { flag_key: 'KILL_SWITCH_AUTOPOST', is_enabled: false, flag_value: false },
          error: null
        })
        .mockResolvedValueOnce({
          data: { flag_key: 'ENABLE_AUTOPOST', is_enabled: true, flag_value: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: { flag_key: 'AUTOPOST_TWITTER', is_enabled: true, flag_value: true },
          error: null
        });

      const result = await shouldBlockAutopost('twitter');

      expect(result.blocked).toBe(false);
      expect(result.reason).toBe(null);
      expect(result.message).toBe('Autopost is allowed');
    });

    it('should fail closed on errors', async () => {
      // Mock the service methods to throw errors directly
      jest
        .spyOn(killSwitchService, 'isKillSwitchActive')
        .mockRejectedValue(new Error('Database error'));

      const result = await shouldBlockAutopost();

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('CHECK_FAILED');
      expect(result.message).toBe(
        'Could not verify autopost status, blocking operation for safety'
      );
    });
  });

  describe('Cache functionality', () => {
    it('should cache flags after first load', async () => {
      const mockFlags = [
        { flag_key: 'KILL_SWITCH_AUTOPOST', is_enabled: false, flag_value: false },
        { flag_key: 'ENABLE_AUTOPOST', is_enabled: true, flag_value: true }
      ];

      // Mock the cache refresh call
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: mockFlags,
            error: null
          })
        })
      });

      await killSwitchService.refreshCache();

      expect(killSwitchService.cache.size).toBe(2);
      expect(killSwitchService.cache.get('KILL_SWITCH_AUTOPOST')).toMatchObject({
        is_enabled: false,
        flag_value: false
      });
    });

    it('should invalidate cache when requested', () => {
      killSwitchService.cache.set('test', { value: 'test' });
      killSwitchService.lastCacheUpdate = Date.now();

      killSwitchService.invalidateCache();

      expect(killSwitchService.cache.size).toBe(0);
      expect(killSwitchService.lastCacheUpdate).toBe(0);
    });
  });
});
