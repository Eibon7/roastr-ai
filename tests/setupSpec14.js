/**
 * SPEC 14 Test Setup
 *
 * Global setup and configuration for SPEC 14 test suite.
 * Ensures consistent test environment and proper mocking.
 */

// Extend Jest timeout for E2E tests
jest.setTimeout(30000);

// Global test environment setup
global.SPEC14_TEST_MODE = true;

// Mock external services globally for SPEC 14 tests
jest.mock('../src/services/openai', () => ({
  generateResponse: jest.fn().mockResolvedValue({
    text: 'Mock roast response for testing',
    tokens_used: 100,
    model: 'gpt-3.5-turbo'
  }),
  testConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/perspective', () => ({
  analyzeToxicity: jest.fn().mockImplementation((text) => {
    // Deterministic toxicity scoring for consistent tests
    const score = text.toLowerCase().includes('crítico')
      ? 0.9
      : text.toLowerCase().includes('intermedio')
        ? 0.5
        : 0.2;
    return Promise.resolve({
      attributeScores: {
        TOXICITY: { score }
      },
      categories: score > 0.7 ? ['TOXICITY', 'SEVERE_TOXICITY'] : ['TOXICITY']
    });
  }),
  testConnection: jest.fn().mockResolvedValue(true)
}));

// Mock Stripe for billing tests
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_mock123' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_mock123', email: 'test@example.com' })
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_mock123',
          url: 'https://checkout.stripe.com/mock',
          amount_total: 1500,
          currency: 'eur'
        })
      }
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub_mock123', status: 'active' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'sub_mock123', status: 'active' })
    },
    prices: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'price_starter', unit_amount: 500, nickname: 'Starter' },
          { id: 'price_pro', unit_amount: 1500, nickname: 'Pro' },
          { id: 'price_plus', unit_amount: 5000, nickname: 'Plus' }
        ]
      })
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation((payload, signature, secret) => ({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_mock123' } }
      }))
    }
  }));
});

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 'mock-id', created_at: new Date().toISOString() },
      error: null
    }),
    // Default mock responses for common queries
    then: jest.fn().mockResolvedValue({
      data: [],
      error: null
    })
  })
}));

// Mock Redis/Queue service
jest.mock('../src/services/queueService', () => {
  class MockQueueService {
    constructor() {}

    addJob = jest.fn().mockResolvedValue({ id: 'job-mock-123', status: 'queued' });
    getJob = jest.fn().mockResolvedValue({ id: 'job-mock-123', status: 'completed' });
    getJobStatus = jest.fn().mockResolvedValue('completed');
    removeJob = jest.fn().mockResolvedValue(true);
    getQueueStatus = jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 1,
      failed: 0
    });
    isHealthy = jest.fn().mockResolvedValue(true);
  }

  // Also export static methods for backward compatibility
  MockQueueService.addJob = jest.fn().mockResolvedValue({ id: 'job-mock-123', status: 'queued' });
  MockQueueService.getJob = jest
    .fn()
    .mockResolvedValue({ id: 'job-mock-123', status: 'completed' });
  MockQueueService.getJobStatus = jest.fn().mockResolvedValue('completed');
  MockQueueService.removeJob = jest.fn().mockResolvedValue(true);
  MockQueueService.getQueueStatus = jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 1,
    failed: 0
  });
  MockQueueService.isHealthy = jest.fn().mockResolvedValue(true);

  return MockQueueService;
});

// Mock Twitter API
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    readOnly: {
      v2: {
        search: jest.fn().mockResolvedValue({
          data: {
            data: [],
            meta: { result_count: 0 }
          }
        })
      }
    },
    v1: {
      tweet: jest.fn().mockResolvedValue({
        id_str: 'mock-tweet-123',
        text: 'Mock response tweet'
      }),
      hide: jest.fn().mockResolvedValue({ hidden: true }),
      block: jest.fn().mockResolvedValue({ blocked: true }),
      unblock: jest.fn().mockResolvedValue({ blocked: false })
    }
  }))
}));

// Setup console methods for better test output
const originalConsole = { ...console };

// Custom console methods for test environment
global.console = {
  ...originalConsole,
  log: (...args) => {
    if (process.env.JEST_VERBOSE === 'true' || process.env.NODE_ENV !== 'test') {
      originalConsole.log(...args);
    }
  },
  warn: (...args) => originalConsole.warn(...args),
  error: (...args) => originalConsole.error(...args),
  info: (...args) => {
    if (process.env.JEST_VERBOSE === 'true') {
      originalConsole.info(...args);
    }
  }
};

// Global test utilities
global.testUtils = {
  // Create mock request/response objects
  createMockReq: (overrides = {}) => ({
    headers: { authorization: 'Bearer mock-token' },
    body: {},
    params: {},
    query: {},
    user: { id: 'mock-user-id', plan: 'pro' },
    ...overrides
  }),

  createMockRes: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };
    return res;
  },

  // Wait for async operations
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Clean test data patterns
  sanitizeTestData: (data) => {
    const dataStr = JSON.stringify(data);
    const sensitivePatterns = [
      /sk_live_/g,
      /pk_live_/g,
      /@gmail\.com/g,
      /@yahoo\.com/g,
      /real_user_/g
    ];

    let sanitized = dataStr;
    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[SANITIZED]');
    });

    return JSON.parse(sanitized);
  }
};

// Setup test database if needed
beforeAll(async () => {
  // Initialize test database/services
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_MOCK_MODE = 'true';
  process.env.DRY_RUN_SHIELD = 'true';

  // Clear any existing timers
  jest.clearAllTimers();

  console.log('🧪 SPEC 14 Test Environment Initialized');
});

// Cleanup after each test
afterEach(async () => {
  // Clear all mocks to prevent test interference
  jest.clearAllMocks();

  // Reset any global state
  delete global.mockUserState;
  delete global.mockOrgState;
});

// Final cleanup
afterAll(async () => {
  // Close any open connections
  // Clear any remaining timers
  jest.clearAllTimers();

  console.log('🧹 SPEC 14 Test Environment Cleaned Up');
});

// Error handling for unhandled promises in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in SPEC 14 tests:', reason);
  // Don't exit, let Jest handle it
});

// Export test configuration
module.exports = {
  SPEC14_TEST_MODE: true,
  DEFAULT_TIMEOUT: 30000,
  MOCK_USERS: {
    free: { id: 'free-user-id', plan: 'free', credits: 100 },
    pro: { id: 'pro-user-id', plan: 'pro', credits: 1000 },
    plus: { id: 'plus-user-id', plan: 'plus', credits: 5000 }
  },
  MOCK_ORGS: {
    basic: { id: 'basic-org-id', settings: { auto_approve: false } },
    auto: { id: 'auto-org-id', settings: { auto_approve: true } }
  }
};
