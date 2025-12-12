jest.mock('../../../src/workers/ShieldActionWorker', () => {
  return jest.fn().mockImplementation(() => ({
    processJob: jest.fn().mockResolvedValue({ success: true }),
    getSpecificHealthDetails: jest.fn().mockResolvedValue({ workerMetrics: {} })
  }));
});

const ShieldActionWorker = require('../../../src/workers/ShieldActionWorker');

describe('ShieldActionWorker - Minimal Contracts', () => {
  let worker;

  beforeEach(() => {
    worker = new ShieldActionWorker();
  });

  test('processJob resolves', async () => {
    await expect(worker.processJob({ id: 'job-1', payload: {} })).resolves.toBeDefined();
  });

  test('health details resolves', async () => {
    await expect(worker.getSpecificHealthDetails()).resolves.toBeDefined();
  });
});
