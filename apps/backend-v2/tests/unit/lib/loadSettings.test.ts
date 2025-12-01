/**
 * Tests for loadSettings.ts
 * 
 * Tests SSOT settings loading from YAML and database sources.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import yaml from 'yaml';
import {
  loadSettings,
  loadSettingsNamespace,
  getSetting,
  clearCache,
  getPublicSettings,
  resetSupabaseClient,
} from '../../../src/lib/loadSettings';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock yaml module
vi.mock('yaml', () => ({
  default: {
    parse: vi.fn(),
  },
  parse: vi.fn(),
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('loadSettings', () => {
  beforeEach(() => {
    // Set mock environment variables
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
    
    clearCache();
    resetSupabaseClient(); // Reset client to use fresh mock
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
  });

  describe('loadSettings()', () => {
    it('should load YAML config correctly', async () => {
      // Mock YAML file content
      const mockYamlContent = `
shield:
  default_aggressiveness: 0.95
  thresholds:
    critical: 0.95
analysis:
  tweet_max_length: 280
`;

      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(mockYamlContent);
      (yaml.parse as any).mockReturnValue({
        shield: {
          default_aggressiveness: 0.95,
          thresholds: { critical: 0.95 },
        },
        analysis: { tweet_max_length: 280 },
      });

      // Mock Supabase to return empty (no DB overrides)
      const { createClient } = await import('@supabase/supabase-js');
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const settings = await loadSettings();

      expect(settings).toHaveProperty('shield');
      expect(settings.shield.default_aggressiveness).toBe(0.95);
      expect(settings.analysis.tweet_max_length).toBe(280);
    });

    it('should load admin_settings from database correctly', async () => {
      // Clear cache first
      clearCache();
      
      // Mock YAML with base values
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      (yaml.parse as any).mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      // Mock Supabase to return database settings
      const { createClient } = await import('@supabase/supabase-js');
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() =>
              Promise.resolve({
                data: [{ key: 'shield.default_aggressiveness', value: 0.98 }],
                error: null,
              })
            ),
          })),
        })),
      });

      const settings = await loadSettings();

      // Database value should override YAML
      expect(settings.shield.default_aggressiveness).toBe(0.98);
    });

    it('should handle missing YAML file gracefully', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const settings = await loadSettings();

      expect(settings).toEqual({});
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      // Mock Supabase error (table doesn't exist)
      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { code: 'PGRST116', message: 'relation does not exist' },
              })
            ),
          })),
        })),
      });

      const settings = await loadSettings();

      // Should fallback to YAML only
      expect(settings.shield.default_aggressiveness).toBe(0.95);
    });

    it('should use cache on subsequent calls', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      // Clear mock call history before test
      (fs.readFileSync as any).mockClear();

      // First call
      await loadSettings();
      const firstCallCount = (fs.readFileSync as any).mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0); // Should have read file

      // Second call (should use cache)
      await loadSettings();
      const secondCallCount = (fs.readFileSync as any).mock.calls.length;

      // Should not read file again (cache hit)
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should force refresh when forceRefresh=true', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      // Clear mock call history
      (fs.readFileSync as any).mockClear();

      await loadSettings();
      const firstCallCount = (fs.readFileSync as any).mock.calls.length;

      await loadSettings(true); // Force refresh
      const secondCallCount = (fs.readFileSync as any).mock.calls.length;

      // Should read file again on force refresh
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });
  });

  describe('loadSettingsNamespace()', () => {
    it('should load settings for specific namespace', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(`
shield:
  default_aggressiveness: 0.95
analysis:
  tweet_max_length: 280
`);
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
        analysis: { tweet_max_length: 280 },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const shieldSettings = await loadSettingsNamespace('shield');

      expect(shieldSettings).toHaveProperty('default_aggressiveness');
      expect(shieldSettings.default_aggressiveness).toBe(0.95);
      expect(shieldSettings).not.toHaveProperty('tweet_max_length');
    });

    it('should return empty object for non-existent namespace', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const nonExistent = await loadSettingsNamespace('non_existent');

      expect(nonExistent).toEqual({});
    });
  });

  describe('getSetting()', () => {
    it('should get setting by key path', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(`
shield:
  default_aggressiveness: 0.95
  thresholds:
    critical: 0.95
`);
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: {
          default_aggressiveness: 0.95,
          thresholds: { critical: 0.95 },
        },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const aggressiveness = await getSetting('shield.default_aggressiveness');
      const critical = await getSetting('shield.thresholds.critical');

      expect(aggressiveness).toBe(0.95);
      expect(critical).toBe(0.95);
    });

    it('should return default value when key does not exist', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const nonExistent = await getSetting('shield.non_existent', 0.90);

      expect(nonExistent).toBe(0.90);
    });

    it('should return undefined when key does not exist and no default provided', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const nonExistent = await getSetting('shield.non_existent');

      expect(nonExistent).toBeUndefined();
    });
  });

  describe('getPublicSettings()', () => {
    it('should return only public settings', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(`
plans:
  starter:
    monthly_limit: 100
    features: [basic_roasting]
shield:
  default_aggressiveness: 0.95
platforms:
  twitter:
    max_length: 280
`);
      vi.spyOn(yaml, 'parse').mockReturnValue({
        plans: {
          starter: { monthly_limit: 100, features: ['basic_roasting'] },
        },
        shield: { default_aggressiveness: 0.95 },
        platforms: { twitter: { max_length: 280 } },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const publicSettings = await getPublicSettings();

      // Should include public namespaces
      expect(publicSettings).toHaveProperty('plans');
      expect(publicSettings).toHaveProperty('platforms');

      // Should NOT include internal settings
      expect(publicSettings).not.toHaveProperty('shield');
    });

    it('should filter sensitive fields from plans', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(`
plans:
  starter:
    monthly_limit: 100
    features: [basic_roasting]
    internal_config: secret_value
`);
      vi.spyOn(yaml, 'parse').mockReturnValue({
        plans: {
          starter: {
            monthly_limit: 100,
            features: ['basic_roasting'],
            internal_config: 'secret_value',
          },
        },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      const publicSettings = await getPublicSettings();

      // Should only include monthly_limit and features
      expect(publicSettings.plans.starter).toHaveProperty('monthly_limit');
      expect(publicSettings.plans.starter).toHaveProperty('features');
      expect(publicSettings.plans.starter).not.toHaveProperty('internal_config');
    });
  });

  describe('clearCache()', () => {
    it('should clear settings cache', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('shield:\n  default_aggressiveness: 0.95');
      vi.spyOn(yaml, 'parse').mockReturnValue({
        shield: { default_aggressiveness: 0.95 },
      });

      const { createClient } = await import('@supabase/supabase-js');
      // Mock already set up
      (createClient as any).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      });

      // Clear mock call history
      (fs.readFileSync as any).mockClear();

      // Load settings (populates cache)
      await loadSettings();
      const firstCallCount = (fs.readFileSync as any).mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0);

      // Clear cache
      clearCache();

      // Load again (should read file again)
      await loadSettings();
      const secondCallCount = (fs.readFileSync as any).mock.calls.length;

      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });
  });
});

