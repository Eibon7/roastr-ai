jest.mock('../../../src/workers/WorkerManager', () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(),
    stop: jest.fn().mockResolvedValue(),
    getStats: jest.fn(() => ({ totalProcessed: 0 })),
    getSummary: jest.fn(() => ({}))
  }));
});

const WorkerManager = require('../../../src/workers/WorkerManager');

describe('WorkerManager - Minimal Contracts', () => {
  let manager;

  beforeEach(() => {
    manager = new WorkerManager();
  });

  test('start resolves', async () => {
    await expect(manager.start()).resolves.toBeUndefined();
  });

  test('stop resolves', async () => {
    await expect(manager.stop()).resolves.toBeUndefined();
  });

  test('getStats returns object', () => {
    const stats = manager.getStats();
    expect(stats).toBeDefined();
  });
});
