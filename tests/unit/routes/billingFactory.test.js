/**
 * BillingFactory Tests
 * Issue #931 - Tests for billingFactory.js (0% → 70%+)
 *
 * Coverage targets:
 * - createController() - Factory with dependency injection
 * - getPlanConfig() - Plan configuration getter
 */

// Create mocks BEFORE jest.mock() calls (coderabbit-lessons.md #11)
const mockBillingInterface = {
  getSubscription: jest.fn(),
  getCustomer: jest.fn()
};

const mockQueueService = {
  initialize: jest.fn(),
  addJob: jest.fn()
};

const mockEntitlementsService = {
  isInTrial: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockEmailService = {
  sendUpgradeSuccessNotification: jest.fn()
};

const mockNotificationService = {
  createUpgradeSuccessNotification: jest.fn()
};

const mockWorkerNotificationService = {
  notifyStatusChange: jest.fn()
};

const mockSupabaseServiceClient = {
  from: jest.fn(),
  rpc: jest.fn()
};

// Mock dependencies before requiring the factory
jest.mock('../../../src/services/billingInterface', () => {
  return jest.fn().mockImplementation(() => mockBillingInterface);
});

jest.mock('../../../src/services/entitlementsService', () => {
  return jest.fn().mockImplementation(() => mockEntitlementsService);
});

jest.mock('../../../src/services/queueService', () => {
  return jest.fn().mockImplementation(() => mockQueueService);
});

jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger
}));

jest.mock('../../../src/services/emailService', () => mockEmailService);

jest.mock('../../../src/services/notificationService', () => mockNotificationService);

jest.mock('../../../src/services/workerNotificationService', () => mockWorkerNotificationService);

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient
}));

jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => flag === 'ENABLE_BILLING')
  }
}));

jest.mock('../../../src/config/planMappings', () => ({
  PLAN_IDS: {
    STARTER_TRIAL: 'starter_trial',
    STARTER: 'starter',
    PRO: 'pro',
    PLUS: 'plus'
  }
}));

// Mock BillingController
const mockBillingControllerInstance = {
  billingInterface: mockBillingInterface,
  queueService: mockQueueService,
  entitlementsService: mockEntitlementsService
};

jest.mock('../../../src/routes/billingController', () => {
  return jest.fn().mockImplementation((deps) => ({
    ...mockBillingControllerInstance,
    ...deps
  }));
});

// Import after mocking
const BillingFactory = require('../../../src/routes/billingFactory');
const BillingController = require('../../../src/routes/billingController');
const { flags } = require('../../../src/config/flags');

describe('BillingFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset flags mock
    flags.isEnabled.mockImplementation((flag) => flag === 'ENABLE_BILLING');
  });

  describe('createController', () => {
    test('should create controller with default dependencies', () => {
      const controller = BillingFactory.createController();

      expect(BillingController).toHaveBeenCalled();
      expect(controller).toBeDefined();
    });

    test('should initialize queue when billing is enabled', () => {
      BillingFactory.createController();

      expect(mockQueueService.initialize).toHaveBeenCalled();
    });

    test('should not initialize queue when billing is disabled', () => {
      flags.isEnabled.mockReturnValue(false);

      BillingFactory.createController();

      // Queue initialize should not be called when billing disabled
      expect(mockQueueService.initialize).not.toHaveBeenCalled();
    });

    test('should create controller with overridden dependencies', () => {
      const customLogger = { info: jest.fn(), error: jest.fn() };
      const customEmailService = { send: jest.fn() };

      const controller = BillingFactory.createController({
        loggerInstance: customLogger,
        emailServiceInstance: customEmailService
      });

      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: customLogger,
          emailService: customEmailService
        })
      );
      expect(controller).toBeDefined();
    });

    test('should create controller with custom supabase client', () => {
      const customSupabase = {
        from: jest.fn(),
        rpc: jest.fn()
      };

      BillingFactory.createController({
        supabaseClient: customSupabase
      });

      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          supabaseClient: customSupabase
        })
      );
    });

    test('should create controller with custom queue service', () => {
      const customQueue = {
        initialize: jest.fn(),
        addJob: jest.fn()
      };

      BillingFactory.createController({
        queueService: customQueue
      });

      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          queueService: customQueue
        })
      );
    });

    test('should create controller with custom billing interface', () => {
      const customBillingInterface = {
        getSubscription: jest.fn(),
        getCustomer: jest.fn()
      };

      BillingFactory.createController({
        billingInterface: customBillingInterface
      });

      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          billingInterface: customBillingInterface
        })
      );
    });

    test('should create controller with custom PLAN_CONFIG', () => {
      const customPlanConfig = {
        free: { name: 'Custom Free', maxRoasts: 5 },
        pro: { name: 'Custom Pro', maxRoasts: 100 }
      };

      BillingFactory.createController({
        planConfig: customPlanConfig
      });

      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          PLAN_CONFIG: customPlanConfig
        })
      );
    });

    test('should pass null billingInterface when billing is disabled', () => {
      flags.isEnabled.mockReturnValue(false);

      BillingFactory.createController();

      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          billingInterface: null
        })
      );
    });

    test('should pass webhookService as null (TODO:Polar)', () => {
      BillingFactory.createController();

      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookService: null
        })
      );
    });
  });

  describe('getPlanConfig', () => {
    test('should return PLAN_CONFIG object', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('should contain starter_trial plan', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.starter_trial).toBeDefined();
      expect(config.starter_trial.name).toBe('Starter Trial');
      expect(config.starter_trial.price).toBe(0);
    });

    test('should contain starter plan', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.starter).toBeDefined();
      expect(config.starter.name).toBe('Starter');
      expect(config.starter.price).toBe(500); // €5.00 in cents
    });

    test('should contain pro plan', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.pro).toBeDefined();
      expect(config.pro.name).toBe('Pro');
      expect(config.pro.price).toBe(1500); // €15.00 in cents
      expect(config.pro.maxPlatforms).toBe(2);
      expect(config.pro.maxRoasts).toBe(1000);
    });

    test('should contain plus plan', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.plus).toBeDefined();
      expect(config.plus.name).toBe('Plus');
      expect(config.plus.price).toBe(5000); // €50.00 in cents
      expect(config.plus.maxRoasts).toBe(5000);
    });

    test('should contain plan features', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.starter_trial.features).toBeInstanceOf(Array);
      expect(config.starter.features).toBeInstanceOf(Array);
      expect(config.pro.features).toBeInstanceOf(Array);
      expect(config.plus.features).toBeInstanceOf(Array);
    });

    test('should use EUR currency for all plans', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.starter_trial.currency).toBe('eur');
      expect(config.starter.currency).toBe('eur');
      expect(config.pro.currency).toBe('eur');
      expect(config.plus.currency).toBe('eur');
    });

    test('should have trial configuration for starter_trial', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.starter_trial.trialDays).toBe(30);
      expect(config.starter_trial.requiresCard).toBe(true);
    });

    test('should have lookup keys for paid plans', () => {
      const config = BillingFactory.getPlanConfig();

      expect(config.starter.lookupKey).toBeDefined();
      expect(config.pro.lookupKey).toBeDefined();
      expect(config.plus.lookupKey).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    test('should create working controller for test environment', () => {
      // This simulates how tests would use the factory
      const mockDeps = {
        billingInterface: {
          getSubscription: jest.fn().mockResolvedValue({ id: 'sub_123' }),
          getCustomer: jest.fn().mockResolvedValue({ id: 'cus_123' })
        },
        queueService: {
          initialize: jest.fn(),
          addJob: jest.fn().mockResolvedValue({ id: 'job_123' })
        },
        supabaseClient: {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          }),
          rpc: jest.fn().mockResolvedValue({ data: {}, error: null })
        },
        loggerInstance: mockLogger
      };

      const controller = BillingFactory.createController(mockDeps);

      expect(controller).toBeDefined();
      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          billingInterface: mockDeps.billingInterface,
          queueService: mockDeps.queueService
        })
      );
    });

    test('should allow partial dependency override', () => {
      // Only override logger, use defaults for everything else
      const customLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      };

      const controller = BillingFactory.createController({
        loggerInstance: customLogger
      });

      expect(controller).toBeDefined();
      expect(BillingController).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: customLogger
        })
      );
    });
  });
});
