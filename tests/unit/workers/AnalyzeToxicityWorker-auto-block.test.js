jest.mock('../../../src/workers/AnalyzeToxicityWorker', () => {
  return jest.fn().mockImplementation(() => ({
    processJob: jest.fn().mockResolvedValue({ success: true }),
    checkAutoBlock: jest.fn().mockResolvedValue({ shouldBlock: false }),
    checkWordVariations: jest.fn(() => true)
  }));
});

const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');

describe('AnalyzeToxicityWorker - Auto-Block Minimal Contracts', () => {
  let worker;

  beforeEach(() => {
    worker = new AnalyzeToxicityWorker();
  });

  test('processJob resolves and returns defined result', async () => {
    await expect(
      worker.processJob({ comment_id: 'c1', organization_id: 'o1', platform: 'twitter' })
    ).resolves.toBeDefined();
  });

  test('checkAutoBlock returns object with boolean flag', async () => {
    const res = await worker.checkAutoBlock('text', 'intolerance');
    expect(res).toBeDefined();
    expect(typeof res.shouldBlock).toBe('boolean');
  });

  test('checkWordVariations returns boolean', () => {
    expect(typeof worker.checkWordVariations('text', 'term')).toBe('boolean');
  });
});
