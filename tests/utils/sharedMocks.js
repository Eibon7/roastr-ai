/**
 * Shared mock utilities for Issue 82 - Phase 4
 * Provides consistent mocks for core system components
 */

/**
 * Mock Queue Service
 */
function createMockQueueService() {
  const jobs = new Map();
  let jobIdCounter = 1;

  return {
    addJob: jest.fn(async (queueName, jobData, options = {}) => {
      // Validate queueName is not empty
      if (!queueName || typeof queueName !== 'string' || queueName.trim() === '') {
        throw new Error('Queue name is required and must be a non-empty string');
      }

      const jobId = `job-${jobIdCounter++}`;
      const job = {
        id: jobId,
        queue: queueName,
        data: jobData,
        options, // Persist options
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      jobs.set(jobId, job);
      return job;
    }),

    getJob: jest.fn(async (jobId) => {
      return jobs.get(jobId) || null;
    }),

    processJobs: jest.fn(async (queueName, processor) => {
      // Realistic job processing: pending → processing → completed/failed
      const queueJobs = Array.from(jobs.values()).filter(
        (job) => job.queue === queueName && job.status === 'pending'
      );

      for (const job of queueJobs) {
        // Mark as processing
        job.status = 'processing';
        job.updatedAt = new Date();

        try {
          // Execute processor
          if (processor && typeof processor === 'function') {
            await processor(job);
          }

          // Mark as completed
          job.status = 'completed';
          job.completedAt = new Date();
        } catch (error) {
          // Mark as failed
          job.status = 'failed';
          job.error = error.message;
          job.failedAt = new Date();
        }

        job.updatedAt = new Date();
      }

      return queueJobs.length;
    }),

    // Test helpers
    _getAllJobs: () => Array.from(jobs.values()),
    _getJobsByQueue: (queueName) =>
      Array.from(jobs.values()).filter((job) => job.queue === queueName),
    _clearJobs: () => jobs.clear()
  };
}

/**
 * Mock Shield Service
 */
function createMockShieldService() {
  let actionIdCounter = 1;

  return {
    analyzeContent: jest.fn(async (content) => {
      // Force content to string to avoid errors with null/object
      const safeContent = String(content ?? '');
      const toxicityScore = safeContent.toLowerCase().includes('horrible') ? 0.8 : 0.2;

      return {
        toxicityScore,
        categories: toxicityScore > 0.7 ? ['TOXICITY'] : [],
        recommendation: toxicityScore > 0.7 ? 'block' : 'allow'
      };
    }),

    executeAction: jest.fn(async (action, target) => {
      return {
        id: `action-${actionIdCounter++}`,
        type: action,
        target,
        status: 'completed'
      };
    })
  };
}

/**
 * Mock Billing Service
 */
function createMockBillingService() {
  return {
    createCheckoutSession: jest.fn(async (customerId, priceId) => {
      const ts = Date.now();
      return {
        id: `cs_test_${ts}`,
        customer: customerId,
        priceId,
        url: `https://checkout.stripe.com/pay/cs_test_${ts}`,
        price: priceId // For backward compatibility
      };
    }),

    getUserUsage: jest.fn(async (userId) => {
      return {
        userId,
        roasts: 45,
        apiCalls: 120,
        cost: 2.5,
        costCents: 250 // Avoid floats for money calculations
      };
    })
  };
}

module.exports = {
  createMockQueueService,
  createMockShieldService,
  createMockBillingService
};
