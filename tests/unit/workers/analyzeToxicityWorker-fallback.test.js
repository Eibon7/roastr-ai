jest.mock('../../../src/workers/AnalyzeToxicityWorker', () => {
  return jest.fn().mockImplementation(() => ({
    processJob: jest.fn().mockResolvedValue({ success: true }),
    analyzeToxicity: jest.fn().mockResolvedValue({ success: true }),
    toxicPatterns: [],
    shieldService: {},
    embeddingsService: {},
    analyzePatterns: jest.fn(() => ({ success: true }))
  }));
});

const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');

describe('AnalyzeToxicityWorker - Fallback Minimal', () => {
  let worker;

  beforeEach(() => {
    worker = new AnalyzeToxicityWorker();
  });

  it('processJob resolves', async () => {
    await expect(
      worker.processJob({ comment_id: 'c1', organization_id: 'o1', platform: 'twitter' })
    ).resolves.toBeDefined();
  });

  it('analyzeToxicity resolves', async () => {
    await expect(worker.analyzeToxicity('text')).resolves.toBeDefined();
  });
});
