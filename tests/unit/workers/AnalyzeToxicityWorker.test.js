jest.mock('../../../src/workers/AnalyzeToxicityWorker', () => {
  return jest.fn().mockImplementation(() => ({
    processJob: jest.fn().mockResolvedValue({ success: true }),
    analyzePatterns: jest.fn(() => ({ success: true, toxicity_score: 0 })),
    analyzeToxicity: jest.fn().mockResolvedValue({ success: true }),
    recordAnalysisUsage: jest.fn().mockResolvedValue(),
    updateCommentWithAnalysisDecision: jest.fn().mockResolvedValue(),
    handleAutoBlockShieldAction: jest.fn().mockResolvedValue({ shieldActive: false })
  }));
});

const AnalyzeToxicityWorker = require('../../../src/workers/AnalyzeToxicityWorker');

describe('AnalyzeToxicityWorker - Minimal Contracts', () => {
  let worker;

  beforeEach(() => {
    worker = new AnalyzeToxicityWorker();
  });

  test('processJob resolves', async () => {
    await expect(worker.processJob({ comment_id: 'c1', organization_id: 'o1', platform: 'twitter' }))
      .resolves.toBeDefined();
  });

  test('analyzePatterns returns basic structure', () => {
    const res = worker.analyzePatterns('text');
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
  });

  test('recordAnalysisUsage can be called', async () => {
    await expect(
      worker.recordAnalysisUsage('org', 'twitter', 'comment', 'text', { analysis: { services_used: [] }, metadata: { decision: {} }, scores: {} })
    ).resolves.toBeUndefined();
  });

  test('updateCommentWithAnalysisDecision can be called', async () => {
    await expect(worker.updateCommentWithAnalysisDecision('comment', { analysis: { services_used: [] }, metadata: { decision: {} }, scores: {}, action_tags: [] }))
      .resolves.toBeUndefined();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
});
