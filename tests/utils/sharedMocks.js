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
      const jobId = `job-${jobIdCounter++}`;
      const job = {
        id: jobId,
        queue: queueName,
        data: jobData,
        status: 'pending',
        createdAt: new Date()
      };
      jobs.set(jobId, job);
      return job;
    }),

    getJob: jest.fn(async (jobId) => {
      return jobs.get(jobId) || null;
    }),

    processJobs: jest.fn(async (queueName, processor) => {
      // Mock job processing
      return Promise.resolve();
    }),

    // Test helpers
    _getAllJobs: () => Array.from(jobs.values())
  };
}

/**
 * Mock Shield Service
 */
function createMockShieldService() {
  return {
    analyzeContent: jest.fn(async (content) => {
      const toxicityScore = content.toLowerCase().includes('horrible') ? 0.8 : 0.2;
      
      return {
        toxicityScore,
        categories: toxicityScore > 0.7 ? ['TOXICITY'] : [],
        recommendation: toxicityScore > 0.7 ? 'block' : 'allow'
      };
    }),

    executeAction: jest.fn(async (action, target) => {
      return {
        id: `action-${Date.now()}`,
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
      return {
        id: `cs_test_${Date.now()}`,
        customer: customerId,
        url: `https://checkout.stripe.com/pay/cs_test_${Date.now()}`
      };
    }),

    getUserUsage: jest.fn(async (userId) => {
      return {
        userId,
        roasts: 45,
        apiCalls: 120,
        cost: 2.50
      };
    })
  };
}

module.exports = {
  createMockQueueService,
  createMockShieldService,
  createMockBillingService
};