import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest Configuration for Auth v2 CI
 *
 * Este config ejecuta SOLO tests de Auth v2 en CI.
 *
 * Scope:
 * - Tests de flow (login, register, http endpoints)
 * - Tests de integration (password recovery, feature flags, rate limit, anti-enumeration)
 * - Tests unit (authService, authPolicyGate, authFlags, authMiddleware, etc.)
 *
 * Excluye:
 * - Workers
 * - Roast
 * - Legacy
 * - E2E (requieren staging)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // SOLO tests de Auth v2
    include: [
      'tests/flow/auth-*.test.ts',
      'tests/integration/auth/*.test.ts',
      'tests/unit/services/authService*.test.ts',
      'tests/unit/services/authEmailService.test.ts',
      'tests/unit/services/authObservabilityService.test.ts',
      'tests/unit/auth/authPolicyGate.test.ts',
      'tests/unit/lib/authFlags.test.ts',
      'tests/unit/utils/authErrorTaxonomy.test.ts',
      'tests/unit/utils/authObservability.test.ts',
      'tests/unit/middleware/authMiddleware.test.ts',
      'tests/unit/routes/authHealthEndpoint.test.ts',
      'tests/unit/routes/oauthInfra.test.ts'
    ],

    // Excluir explícitamente
    exclude: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',

      // Workers (ROA-525)
      'tests/**/worker*.test.ts',
      'tests/**/Worker*.test.ts',

      // Roast (fuera de scope Auth)
      'tests/**/roast*.test.ts',

      // E2E (requieren staging)
      'tests/e2e/**',

      // Legacy tests (root tests/)
      'tests/**/*.test.js',

      // OAuth providers (fuera de Auth v2 core, pero oauthInfra.test.ts sí incluido)
      'tests/**/oauth-google*.test.ts',
      'tests/**/oauth-github*.test.ts',
      'tests/**/oauth-provider*.test.ts'
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],

      // Solo Auth v2 src files
      include: [
        'src/services/authService.ts',
        'src/services/authEmailService.ts',
        'src/lib/authFlags.ts',
        'src/utils/authErrorTaxonomy.ts',
        'src/middleware/authMiddleware.ts',
        'src/routes/auth.ts'
      ],

      exclude: [
        'node_modules/**',
        'tests/**',
        'coverage/**',
        '**/*.test.ts',
        'dist/**',
        'build/**'
      ],

      // Thresholds para Auth v2
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    },

    testTimeout: 10000,
    reporters: ['verbose'],

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
      '@': path.resolve(__dirname, './src')
    }
  }
});
