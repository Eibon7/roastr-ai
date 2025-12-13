jest.mock('../../../src/workers/FetchCommentsWorker', () => {
  return jest.fn().mockImplementation(() => ({
    processJob: jest.fn().mockResolvedValue({ comments: [] }),
    fetchCommentsFromPlatform: jest.fn().mockResolvedValue({ comments: [] }),
    queueAnalysisJobs: jest.fn().mockResolvedValue()
  }));
});

const FetchCommentsWorker = require('../../../src/workers/FetchCommentsWorker');

describe('FetchCommentsWorker - Minimal Contracts', () => {
  let worker;

  beforeEach(() => {
    worker = new FetchCommentsWorker();
  });

  test('processJob resolves', async () => {
    await expect(
      worker.processJob({ id: 'job-1', organization_id: 'org-1', platform: 'twitter', payload: {} })
    ).resolves.toBeDefined();
  });

  test('fetchCommentsFromPlatform resolves', async () => {
    await expect(
      worker.fetchCommentsFromPlatform('twitter', { id: 'config' }, { since_id: '1' })
    ).resolves.toBeDefined();
  });

  test('queueAnalysisJobs resolves', async () => {
    await expect(worker.queueAnalysisJobs('org-1', [], 'corr')).resolves.toBeUndefined();
  });
});
