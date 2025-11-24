const BaseWorker = require('../../src/workers/BaseWorker');
const { mockMode } = require('../../src/config/mockMode');

class TestCostWorker extends BaseWorker {
  constructor({ queueServiceMock, costControl, ...options } = {}) {
    super('integration_worker', {
      pollInterval: 10,
      maxRetries: 0,
      maxConcurrency: 1,
      ...options
    });

    this.supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        }))
      }))
    };

    this.queueService = queueServiceMock || {
      initialize: jest.fn().mockResolvedValue(),
      getNextJob: jest.fn().mockResolvedValue(null),
      completeJob: jest.fn().mockResolvedValue(),
      failJob: jest.fn().mockResolvedValue(),
      shutdown: jest.fn().mockResolvedValue()
    };

    this.costControl = costControl || { recordUsage: jest.fn().mockResolvedValue({}) };
  }

  async _processJobInternal(job) {
    const usageResult = await this.costControl.recordUsage(
      job.organization_id,
      'integration_test',
      1,
      { jobId: job.id },
      job.userId || null,
      1
    );

    if (usageResult.allowed === false) {
      const error = new Error(usageResult.reason || 'blocked');
      error.permanent = true;
      throw error;
    }

    return { success: true, summary: 'job processed' };
  }
}

describe('Worker System Integration', () => {
  let worker;
  let mockQueueService;
  let mockCostControl;

  beforeEach(() => {
    mockMode.isMockMode = true;

    mockQueueService = {
      initialize: jest.fn().mockResolvedValue(),
      getNextJob: jest.fn(),
      completeJob: jest.fn().mockResolvedValue(),
      failJob: jest.fn().mockResolvedValue(),
      shutdown: jest.fn().mockResolvedValue()
    };

    mockCostControl = {
      recordUsage: jest.fn().mockResolvedValue({ allowed: true })
    };

    worker = new TestCostWorker({
      queueServiceMock: mockQueueService,
      costControl: mockCostControl
    });
  });

  afterEach(async () => {
    if (worker && worker.isRunning) {
      await worker.stop();
    }

    mockMode.isMockMode = false;
  });

  test('processes job through queue and into cost control', async () => {
    const job = {
      id: 'integration-job',
      organization_id: 'org-100',
      userId: 'user-100',
      job_type: 'integration',
      payload: { comment: 'test' }
    };

    mockQueueService.getNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);

    await worker.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await Promise.resolve();

    expect(mockQueueService.getNextJob).toHaveBeenCalled();

    expect(mockCostControl.recordUsage).toHaveBeenCalledWith(
      'org-100',
      'integration_test',
      1,
      expect.objectContaining({ jobId: 'integration-job' }),
      'user-100',
      1
    );

    expect(mockQueueService.completeJob).toHaveBeenCalledWith(
      job,
      expect.objectContaining({
        result: expect.objectContaining({ success: true }),
        completedBy: expect.any(String)
      })
    );

    expect(worker.processedJobs).toBe(1);
  });

  test('records failure when cost control blocks job', async () => {
    const job = {
      id: 'blocked-job',
      organization_id: 'org-101',
      userId: 'user-101',
      job_type: 'integration',
      payload: {}
    };

    mockQueueService.getNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);

    mockCostControl.recordUsage.mockResolvedValueOnce({ allowed: false, reason: 'limit' });

    await worker.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await Promise.resolve();

    expect(mockQueueService.getNextJob).toHaveBeenCalled();

    expect(mockQueueService.failJob).toHaveBeenCalledWith(job, expect.any(Error));
    expect(worker.failedJobs).toBe(1);
  });
});
