/**
 * Comprehensive tests for Issue #366 - Feature Flag Fixes
 * Tests the ENABLE_SHOP flag standardization and shop visibility logic
 */

const { flags } = require('../../../src/config/flags');

describe('Issue #366 - Feature Flag Fixes', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear module cache to get fresh flag instance
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('ENABLE_SHOP Flag Standardization', () => {
    it('should read from SHOP_ENABLED environment variable', () => {
      // Set the correct environment variable
      process.env.SHOP_ENABLED = 'true';
      
      // Require fresh instance after setting env
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
    });

    it('should default to false when SHOP_ENABLED is not set', () => {
      // Ensure SHOP_ENABLED is not set
      delete process.env.SHOP_ENABLED;
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(false);
    });

    it('should handle string "false" correctly', () => {
      process.env.SHOP_ENABLED = 'false';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(false);
    });

    it('should handle string "true" correctly', () => {
      process.env.SHOP_ENABLED = 'true';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
    });

    it('should handle numeric values correctly', () => {
      process.env.SHOP_ENABLED = '1';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
    });

    it('should be case insensitive for boolean strings', () => {
      process.env.SHOP_ENABLED = 'TRUE';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
    });
  });

  describe('Shop Feature Integration', () => {
    it('should include shop in service status when enabled', () => {
      process.env.SHOP_ENABLED = 'true';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      const serviceStatus = freshFlags.getServiceStatus();
      
      expect(serviceStatus.features).toHaveProperty('shop');
      expect(serviceStatus.features.shop).toBe(true);
    });

    it('should exclude shop from service status when disabled', () => {
      process.env.SHOP_ENABLED = 'false';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      const serviceStatus = freshFlags.getServiceStatus();
      
      expect(serviceStatus.features.shop).toBe(false);
    });

    it('should be included in getAllFlags() output', () => {
      process.env.SHOP_ENABLED = 'true';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      const allFlags = freshFlags.getAllFlags();
      
      expect(allFlags).toHaveProperty('ENABLE_SHOP');
      expect(allFlags.ENABLE_SHOP).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing ENABLE_SHOP checks', () => {
      process.env.SHOP_ENABLED = 'true';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      // Both old and new flag names should work
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
    });

    it('should not break when old environment variable is set', () => {
      // Set both old and new variables to test precedence
      process.env.ENABLE_SHOP = 'false';  // Old (incorrect) variable
      process.env.SHOP_ENABLED = 'true';   // New (correct) variable
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      // Should use the correct SHOP_ENABLED variable
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
    });
  });

  describe('Environment Variable Validation', () => {
    it('should handle undefined environment variable gracefully', () => {
      delete process.env.SHOP_ENABLED;
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(() => freshFlags.isEnabled('ENABLE_SHOP')).not.toThrow();
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(false);
    });

    it('should handle empty string environment variable', () => {
      process.env.SHOP_ENABLED = '';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(false);
    });

    it('should handle whitespace-only environment variable', () => {
      process.env.SHOP_ENABLED = '   ';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(false);
    });
  });

  describe('Production Safety', () => {
    it('should respect production environment settings', () => {
      process.env.NODE_ENV = 'production';
      process.env.SHOP_ENABLED = 'true';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      // Shop should still be enabled in production if explicitly set
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
    });

    it('should default to disabled in production without explicit setting', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SHOP_ENABLED;
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      // Should default to false in production
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(false);
    });
  });

  describe('Development vs Production Behavior', () => {
    it('should behave consistently across environments when explicitly set', () => {
      const testCases = ['development', 'production', 'test'];
      
      testCases.forEach(env => {
        process.env.NODE_ENV = env;
        process.env.SHOP_ENABLED = 'true';
        
        // Clear module cache for each test
        jest.resetModules();
        const { flags: freshFlags } = require('../../../src/config/flags');
        
        expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
      });
    });
  });

  describe('Flag System Integration', () => {
    it('should work with existing flag parsing infrastructure', () => {
      process.env.SHOP_ENABLED = 'true';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      // Should integrate with the existing flag system methods
      expect(typeof freshFlags.parseFlag).toBe('function');
      expect(typeof freshFlags.isEnabled).toBe('function');
      expect(typeof freshFlags.getAllFlags).toBe('function');
      expect(typeof freshFlags.getServiceStatus).toBe('function');
    });

    it('should not interfere with other flags', () => {
      process.env.SHOP_ENABLED = 'true';
      process.env.ENABLE_SUPABASE = 'true';
      
      const { flags: freshFlags } = require('../../../src/config/flags');
      
      // Both flags should work independently
      expect(freshFlags.isEnabled('ENABLE_SHOP')).toBe(true);
      expect(freshFlags.isEnabled('ENABLE_SUPABASE')).toBe(true);
    });
  });
});