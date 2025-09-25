const InstagramAdapter = require('../../src/adapters/InstagramAdapter');
const FacebookAdapter = require('../../src/adapters/FacebookAdapter');

/**
 * SPEC 14 - QA Test Suite Integral
 * Contract Tests for Shield Adapters
 * 
 * These tests ensure all adapters implement the same interface
 * and follow consistent patterns for Shield moderation actions.
 */
describe('SPEC 14 - Shield Adapter Contracts', () => {
  const adapters = [
    { name: 'InstagramAdapter', class: InstagramAdapter, platform: 'instagram' },
    { name: 'FacebookAdapter', class: FacebookAdapter, platform: 'facebook' }
  ];

  describe('Interface Contract', () => {
    adapters.forEach(({ name, class: AdapterClass, platform }) => {
      describe(`${name}`, () => {
        let adapter;

        beforeEach(() => {
          adapter = new AdapterClass();
        });

        it('should have required properties', () => {
          expect(adapter.platform).toBe(platform);
          expect(Array.isArray(adapter.capabilities)).toBe(true);
          expect(adapter.capabilities.length).toBeGreaterThan(0);
        });

        it('should implement required methods', () => {
          expect(typeof adapter.getCapabilities).toBe('function');
          expect(typeof adapter.executeAction).toBe('function');
          expect(typeof adapter.supportsAction).toBe('function');
          expect(typeof adapter.getInfo).toBe('function');
        });

        it('should return capabilities array', () => {
          const capabilities = adapter.getCapabilities();
          expect(Array.isArray(capabilities)).toBe(true);
          expect(capabilities.length).toBeGreaterThan(0);
          capabilities.forEach(capability => {
            expect(typeof capability).toBe('string');
          });
        });

        it('should check action support correctly', () => {
          const capabilities = adapter.getCapabilities();
          
          // Test supported actions
          capabilities.forEach(capability => {
            expect(adapter.supportsAction(capability)).toBe(true);
          });

          // Test unsupported action
          expect(adapter.supportsAction('nonExistentAction')).toBe(false);
        });

        it('should return adapter info', () => {
          const info = adapter.getInfo();
          expect(typeof info).toBe('object');
          expect(info.platform).toBe(platform);
          expect(Array.isArray(info.capabilities)).toBe(true);
          expect(info.capabilities).toEqual(adapter.getCapabilities());
        });

        it('should handle unsupported actions in executeAction', async () => {
          const result = await adapter.executeAction('unsupportedAction', {});
          expect(result.success).toBe(false);
          expect(result.error).toContain('not supported');
          expect(result.platform).toBe(platform);
        });
      });
    });
  });

  describe('Capability Standards', () => {
    const commonCapabilities = ['hideComment', 'reportUser', 'reportContent'];
    const extendedCapabilities = ['blockUser', 'unblockUser', 'deleteComment'];

    it('should have consistent capability naming', () => {
      adapters.forEach(({ name, class: AdapterClass }) => {
        const adapter = new AdapterClass();
        const capabilities = adapter.getCapabilities();
        
        capabilities.forEach(capability => {
          // Capability names should be camelCase (allows digits)
          expect(capability).toMatch(/^[a-z][a-zA-Z0-9]*$/);
          
          // Should not contain spaces or special characters
          expect(capability).not.toMatch(/[\s-_]/);
        });
      });
    });

    it('should support basic moderation capabilities', () => {
      adapters.forEach(({ name, class: AdapterClass }) => {
        const adapter = new AdapterClass();
        const capabilities = adapter.getCapabilities();
        
        // All adapters should support at least some common capabilities
        const hasCommonCapability = commonCapabilities.some(cap => 
          capabilities.includes(cap)
        );
        expect(hasCommonCapability).toBe(true);
      });
    });

    describe('Platform-specific capabilities', () => {
      it('Instagram should support basic capabilities', () => {
        const adapter = new InstagramAdapter();
        const capabilities = adapter.getCapabilities();
        
        expect(capabilities).toContain('hideComment');
        expect(capabilities).toContain('reportUser');
        expect(capabilities).toContain('reportContent');
      });

      it('Facebook should support extended capabilities', () => {
        const adapter = new FacebookAdapter();
        const capabilities = adapter.getCapabilities();
        
        expect(capabilities).toContain('hideComment');
        expect(capabilities).toContain('reportUser');
        expect(capabilities).toContain('reportContent');
        expect(capabilities).toContain('blockUser');
        expect(capabilities).toContain('unblockUser');
        expect(capabilities).toContain('deleteComment');
      });
    });
  });

  describe('Action Execution Contract', () => {
    adapters.forEach(({ name, class: AdapterClass, platform }) => {
      describe(`${name} executeAction`, () => {
        let adapter;

        beforeEach(() => {
          adapter = new AdapterClass();
        });

        it('should return consistent result structure for supported actions', async () => {
          // This test verifies the structure is consistent without making actual API calls
          // We'll test with an unsupported action to ensure error structure is consistent
          const result = await adapter.executeAction('unsupportedTestAction', { test: 'params' });
          
          expect(typeof result).toBe('object');
          expect(typeof result.success).toBe('boolean');
          expect(result.action).toBe('unsupportedTestAction');
          expect(result.platform).toBe(platform);
          expect(typeof result.error).toBe('string');
        });

        it('should return error structure for unsupported actions', async () => {
          const result = await adapter.executeAction('unsupportedAction', {});
          
          expect(result).toEqual({
            success: false,
            action: 'unsupportedAction',
            platform: platform,
            error: expect.stringContaining('not supported')
          });
        });
      });
    });
  });

  describe('Constructor Contract', () => {
    adapters.forEach(({ name, class: AdapterClass, platform }) => {
      describe(`${name} constructor`, () => {
        it('should accept config parameter', () => {
          const config = { apiVersion: '1.0', testMode: true };
          const adapter = new AdapterClass(config);
          
          expect(adapter.config).toEqual(config);
        });

        it('should work with no config', () => {
          const adapter = new AdapterClass();
          
          expect(adapter.platform).toBe(platform);
          expect(Array.isArray(adapter.capabilities)).toBe(true);
        });

        it('should work with empty config', () => {
          const adapter = new AdapterClass({});
          
          expect(adapter.platform).toBe(platform);
          expect(Array.isArray(adapter.capabilities)).toBe(true);
          expect(adapter.config).toEqual({});
        });
      });
    });
  });

  describe('Error Handling Contract', () => {
    adapters.forEach(({ name, class: AdapterClass, platform }) => {
      describe(`${name} error handling`, () => {
        let adapter;

        beforeEach(() => {
          adapter = new AdapterClass();
        });

        it('should handle null parameters gracefully', async () => {
          const result = await adapter.executeAction('unsupportedAction', null);
          
          expect(result.success).toBe(false);
          expect(result.platform).toBe(platform);
          expect(typeof result.error).toBe('string');
        });

        it('should handle undefined parameters gracefully', async () => {
          const result = await adapter.executeAction('unsupportedAction', undefined);
          
          expect(result.success).toBe(false);
          expect(result.platform).toBe(platform);
          expect(typeof result.error).toBe('string');
        });

        it('should validate action parameter', async () => {
          const result = await adapter.executeAction(null, {});
          
          expect(result.success).toBe(false);
          expect(result.platform).toBe(platform);
        });
      });
    });
  });

  describe('Integration Requirements', () => {
    it('should have consistent import structure', () => {
      // Test that all adapters can be imported correctly
      expect(InstagramAdapter).toBeDefined();
      expect(FacebookAdapter).toBeDefined();

      // Test that they are constructable
      expect(() => new InstagramAdapter()).not.toThrow();
      expect(() => new FacebookAdapter()).not.toThrow();
    });

    it('should be ready for Shield service integration', () => {
      const adapters = [
        new InstagramAdapter(),
        new FacebookAdapter()
      ];

      adapters.forEach(adapter => {
        // Each adapter should be ready for Shield service integration
        expect(typeof adapter.executeAction).toBe('function');
        expect(typeof adapter.getCapabilities).toBe('function');
        expect(typeof adapter.supportsAction).toBe('function');
        expect(adapter.platform).toBeTruthy();
      });
    });
  });
});