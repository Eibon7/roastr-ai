import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

// Provide a stable 32-char key so TokenEncryptionService boots in the test environment.
// This must be set before any NestJS module is compiled.
process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ?? "test-only-encryption-key-32chars!";

// Modules that construct a real bullmq.Queue (e.g. OAuthModule's ingestion
// queue, via a plain factory provider — see queue.config.ts's INGESTION_QUEUE)
// would otherwise try to connect to Redis during tests. Mock the library so
// any Queue/Worker/FlowProducer constructed is an inert stub. Tests that
// bootstrap the full AppModule additionally override INGESTION_QUEUE
// explicitly (see health.spec.ts) for clarity/defense-in-depth.
vi.mock('bullmq', () => {
  class Queue {
    name: string;
    opts: unknown;
    add = vi.fn().mockResolvedValue(undefined);
    addBulk = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    constructor(name: string, opts?: unknown) {
      this.name = name;
      this.opts = opts;
    }
  }
  class Worker {
    on = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
    constructor(..._args: unknown[]) {}
  }
  class FlowProducer {
    close = vi.fn().mockResolvedValue(undefined);
    constructor(..._args: unknown[]) {}
  }
  return { Queue, Worker, FlowProducer };
});

// 'warn' instead of 'error': health.spec.ts makes real HTTP requests to a
// NestJS test server via fetch, which MSW would reject as unhandled.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
