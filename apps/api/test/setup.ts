import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

// Provide a stable 32-char key so TokenEncryptionService boots in the test environment.
// This must be set before any NestJS module is compiled.
process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ?? "test-only-encryption-key-32chars!";

// 'warn' instead of 'error': health.spec.ts makes real HTTP requests to a
// NestJS test server via fetch, which MSW would reject as unhandled.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
