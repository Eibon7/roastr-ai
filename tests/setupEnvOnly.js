/**
 * Test setup file for environment variables only (Node.js tests)
 */

// Mock environment variables for tests
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NODE_ENV = 'test';

// Force RQC disabled for all tests
process.env.ENABLE_RQC = 'false';
process.env.ENABLE_SHIELD = 'false';

// Mock console to suppress logs in tests unless needed
// Vitest setup - use vi instead of jest
import { vi } from 'vitest';

global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};

// Add polyfills for Node.js tests
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock fetch globally for all tests
global.fetch = vi.fn();

// NOTE: Global mock for feature flags REMOVED (Issue #618)
// Why: This global mock was interfering with integration tests that need
// the real FeatureFlags behavior. Unit tests that need mocks should use
// their own vi.mock() calls specific to their needs.
//
// If you need to mock flags in a unit test, add this to your test file:
//   vi.mock('../../../src/config/flags', () => ({
//     flags: { isEnabled: vi.fn(), ... }
//   }));

// Global test teardown to prevent Vitest from hanging
afterAll(async () => {
  try {
    // Clean up AlertingService intervals
    // NOTE: This requires legacy src/ - it's cleanup only (read-only), not active use
    // Try-catch ensures tests pass even if alertingService doesn't exist
    try {
      const alertingService = require('../src/services/alertingService');
      if (alertingService && typeof alertingService.shutdown === 'function') {
        alertingService.shutdown();
      }
    } catch (requireError) {
      // alertingService may not exist in v2-only environments, that's OK
    }

    // Clean up any other resources that might prevent Jest from exiting
    if (global.gc) {
      global.gc();
    }
    
    // GDD/SSOT validation (post-test hook)
    // Only run in CI or when explicitly enabled
    if (process.env.CI || process.env.RUN_GDD_VALIDATION === 'true') {
      console.log('\n🔍 Running GDD/SSOT validation...\n');
      
      const { execSync } = require('child_process');
      const path = require('path');
      
      try {
        // Validate GDD runtime
        execSync('node scripts/validate-gdd-runtime.js --full', {
          encoding: 'utf-8',
          stdio: 'inherit',
          cwd: path.resolve(__dirname, '..')
        });
        
        // Validate health score
        const healthOutput = execSync('node scripts/score-gdd-health.js --ci', {
          encoding: 'utf-8',
          cwd: path.resolve(__dirname, '..')
        });
        
        // Parse health score from output
        const scoreMatch = healthOutput.match(/Health Score:\s*(\d+)/);
        if (scoreMatch) {
          const healthScore = parseInt(scoreMatch[1], 10);
          console.log(`\n✅ GDD Health Score: ${healthScore}`);
          
          if (healthScore < 87) {
            throw new Error(`GDD health score ${healthScore} is below threshold 87`);
          }
        } else {
          console.warn('⚠️  Could not parse GDD health score from output');
        }
        
        console.log('✅ GDD/SSOT validation passed\n');
      } catch (error) {
        console.error('❌ GDD/SSOT validation failed:', error.message);
        throw error; // Fail the test suite
      }
    }
  } catch (error) {
    // Ignore cleanup errors in tests (but not GDD validation errors)
    if (error.message.includes('GDD')) {
      throw error;
    }
    console.log('Test cleanup error (ignored):', error.message);
  }
});
