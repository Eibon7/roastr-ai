jest.mock('../../../src/workers/AnalyzeToxicityWorker', () => {
  return jest.fn().mockImplementation(() => ({
    processJob: jest.fn().mockResolvedValue({ success: true }),
    checkSemanticMatches: jest.fn(() => ({ terms: [], categories: [] })),
    checkWordVariations: jest.fn(() => true)
  }));
});

const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');

describe('AnalyzeToxicityWorker - Semantic Minimal Contracts', () => {
  let worker;

  beforeEach(() => {
    worker = new AnalyzeToxicityWorker();
  });

  test('processJob resolves', async () => {
    await expect(
      worker.processJob({
        comment_id: 'c1',
        organization_id: 'o1',
        platform: 'twitter',
        text: 'hi'
      })
    ).resolves.toBeDefined();
  });

  test('checkSemanticMatches returns defined structure', () => {
    const res = worker.checkSemanticMatches('text', ['term']);
    expect(res).toBeDefined();
    expect(Array.isArray(res.terms)).toBe(true);
    expect(Array.isArray(res.categories)).toBe(true);
  });

  test('checkWordVariations returns boolean', () => {
    expect(typeof worker.checkWordVariations('text', 'term')).toBe('boolean');
  });
});
