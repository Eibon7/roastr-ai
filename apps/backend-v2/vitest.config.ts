import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.config.*', 'src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75, // TBD: Restore to 80+ after ROA-374 coverage improvements
        statements: 80
      }
    },
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
