import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    env: {
      VITE_AMPLITUDE_API_KEY: 'test_amplitude_api_key',
    },
    exclude: [
      'node_modules/',
      'dist/',
      'e2e/',
      '../apps/backend-v2/**',
      '../scripts/**',
      // Exclude Jest-based tests from main branch that aren't compatible with Vitest yet
      'src/contexts/__tests__/**',
      'src/hooks/__tests__/**',
      // Temporarily exclude legacy Jest suites with missing modules until migrated
      'src/components/**/__tests__/**',
      'src/pages/**/__tests__/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
        'src/contexts/__tests__/**',
        'src/hooks/__tests__/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
