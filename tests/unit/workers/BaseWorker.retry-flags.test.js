/**
 * Focused tests for BaseWorker retry flag behaviour.
 *
 * These tests ensure that explicit `error.permanent` / `error.retriable`
 * flags short-circuit the default status/message heuristics inside BaseWorker.
 * This guards against regressions like the one reported in PR #830.
 */

const BaseWorker = require('../../../src/workers/BaseWorker');

// Minimal mocks for BaseWorker dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({ data: [], error: null }))
      }))
    }))
  }))
}));

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    getNextJob: jest.fn(),
    completeJob: jest.fn(),
    failJob: jest.fn(),
    shutdown: jest.fn()
  }));
});

const { createClient } = require('@supabase/supabase-js');
const QueueService = require('../../../src/services/queueService');

class FlagAwareWorker extends BaseWorker {
  constructor(overrides = {}) {
    super('flag_aware', {
      maxRetries: 2,
      retryDelay: 1,
      ...overrides
    });

    this.attempts = [];
  }

  async _processJobInternal(job) {
    this.attempts.push(job);

    if (job.behaviour === 'permanent') {
      const error = new Error('Permanent failure');
      error.permanent = true;
      error.retriable = false;
      error.statusCode = 404;
      throw error;
    }

    if (job.behaviour === 'retriable') {
      const error = new Error('Transient failure');
      error.retriable = true;
      error.permanent = false;
      error.statusCode = 500;
      throw error;
    }

    return { success: true };
  }
}

describe('BaseWorker retry flags', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
  });

  afterAll(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not retry when error is marked permanent', async () => {
    const worker = new FlagAwareWorker();
    const sleepSpy = jest.spyOn(worker, 'sleep');

    await expect(
      worker.executeJobWithRetry({ id: 'job-permanent', behaviour: 'permanent' })
    ).rejects.toThrow('Permanent failure');

    expect(worker.attempts).toHaveLength(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test('retries when error is marked retriable even with 4xx', async () => {
    const worker = new FlagAwareWorker({ maxRetries: 1, retryDelay: 1 });
    const sleepSpy = jest.spyOn(worker, 'sleep').mockResolvedValue();

    await expect(
      worker.executeJobWithRetry({ id: 'job-retriable', behaviour: 'retriable' })
    ).rejects.toThrow('Transient failure');

    // initial attempt + one retry (maxRetries=1 -> total attempts 2)
    expect(worker.attempts).toHaveLength(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
  });

  test('success when no error thrown', async () => {
    const worker = new FlagAwareWorker();
    await expect(
      worker.executeJobWithRetry({ id: 'job-success' })
    ).resolves.toEqual({ success: true });

    expect(worker.attempts).toHaveLength(1);
  });
});

