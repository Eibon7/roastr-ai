import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest Configuration for Backend Legacy (src/)
 * 
 * This configuration replaces Jest for backend legacy tests.
 * Migrated from jest.config.js as part of ROA-328.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    
    // Test discovery - match Jest patterns
    include: [
      'tests/**/*.test.js',
      'tests/**/*.test.ts',
      'src/**/*.test.js'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'frontend/**',
      'apps/**',
      'roastr-ai-worktrees/**',
      '**/*.config.*'
    ],
    
    // Setup files
    setupFiles: ['./tests/setupEnvOnly.js'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        'coverage/**',
        '**/*.test.js',
        '**/*.test.ts',
        '**/test-*.js',
        'src/public/**',
        'frontend/**',
        'apps/**',
        'roastr-ai-worktrees/**'
      ],
      include: ['src/**/*.js'],
      thresholds: {
        global: {
          branches: 30,
          functions: 30,
          lines: 30,
          statements: 30
        },
        // Workers require higher coverage
        'src/workers/**': {
          branches: 30,
          functions: 30,
          lines: 30,
          statements: 30
        },
        // Billing requires high coverage due to financial impact
        'src/routes/billing.js': {
          branches: 50,
          functions: 60,
          lines: 60,
          statements: 60
        },
        // Services require good coverage
        'src/services/': {
          branches: 20,
          functions: 20,
          lines: 20,
          statements: 20
        },
        // Shield service requires higher coverage due to security role
        'src/services/shieldService.js': {
          branches: 20,
          functions: 20,
          lines: 20,
          statements: 20
        },
        // Decision engine under Shield requires higher coverage
        'src/services/shieldDecisionEngine.js': {
          branches: 20,
          functions: 20,
          lines: 20,
          statements: 20
        }
      }
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Output configuration
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: './junit.xml'
    },
    
    // Worker configuration (memory optimization)
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: process.env.CI ? 2 : undefined,
        minThreads: 1
      }
    },
    
    // Isolate tests
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true
  },
  
  resolve: {
    alias: {
      '@tests': path.resolve(__dirname, './tests'),
      '^src/(.*)$': path.resolve(__dirname, './src/$1')
    }
  }
});

