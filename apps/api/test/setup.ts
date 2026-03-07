import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

// 'warn' instead of 'error': health.spec.ts makes real HTTP requests to a
// NestJS test server via fetch, which MSW would reject as unhandled.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
