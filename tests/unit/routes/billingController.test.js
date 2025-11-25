/**
 * BillingController Tests
 * Issue #931 - Tests for billingController.js (0% → 70%+)
 *
 * Coverage targets:
 * - queueBillingJob() - Job queuing with sync fallback
 * - handleCheckoutCompleted() - Checkout processing
 * - handleSubscriptionUpdated() - Subscription update handling
 * - handleSubscriptionDeleted() - Subscription cancellation
 * - handlePaymentSucceeded() - Successful payment handling
 * - handlePaymentFailed() - Failed payment handling
 * - applyPlanLimits() - Plan limits application
 */

// Create mocks BEFORE jest.mock() calls (coderabbit-lessons.md #11)
const mockSupabaseFrom = jest.fn();
const mockSupabaseRpc = jest.fn();

const mockSupabase = {
  from: mockSupabaseFrom,
  rpc: mockSupabaseRpc
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockQueueService = {
  addJob: jest.fn()
};

const mockBillingInterface = {
  getSubscription: jest.fn(),
  getCustomer: jest.fn(),
  getPrices: jest.fn()
};

const mockEntitlementsService = {
  isInTrial: jest.fn(),
  startTrial: jest.fn()
};

const mockWebhookService = {
  processWebhookEvent: jest.fn()
};

const mockEmailService = {
  sendUpgradeSuccessNotification: jest.fn(),
  sendSubscriptionCanceledNotification: jest.fn(),
  sendPaymentFailedNotification: jest.fn()
};

const mockNotificationService = {
  createUpgradeSuccessNotification: jest.fn(),
  createSubscriptionCanceledNotification: jest.fn(),
  createPaymentFailedNotification: jest.fn()
};

const mockWorkerNotificationService = {
  notifyStatusChange: jest.fn()
};

// Mock PLAN_CONFIG
const PLAN_CONFIG = {
  starter_trial: {
    name: 'Starter Trial',
    maxRoasts: 10,
    maxPlatforms: 1,
    features: ['10 roasts per month']
  },
  starter: {
    name: 'Starter',
    maxRoasts: 10,
    maxPlatforms: 1,
    features: ['10 roasts per month', 'Email support']
  },
  pro: {
    name: 'Pro',
    maxRoasts: 1000,
    maxPlatforms: 2,
    features: ['1,000 roasts per month', 'Priority support']
  },
  plus: {
    name: 'Plus',
    maxRoasts: 5000,
    maxPlatforms: 2,
    features: ['5,000 roasts per month', 'API access']
  },
  free: {
    name: 'Free',
    maxRoasts: 0,
    maxPlatforms: 0,
    features: []
  }
};

// Mock planMappings
jest.mock('../../../src/config/planMappings', () => ({
  PLAN_IDS: {
    STARTER_TRIAL: 'starter_trial',
    STARTER: 'starter',
    PRO: 'pro',
    PLUS: 'plus'
  },
  getPlanFromStripeLookupKey: jest.fn((lookupKey) => {
    const mapping = {
      plan_starter: 'starter',
      plan_pro: 'pro',
      plan_plus: 'plus'
    };
    return mapping[lookupKey] || null;
  })
}));

// Import after mocking
const BillingController = require('../../../src/routes/billingController');
const { PLAN_IDS } = require('../../../src/config/planMappings');

describe('BillingController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockSupabaseFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ data: {}, error: null })
    });

    mockSupabaseRpc.mockResolvedValue({ data: { success: true }, error: null });

    // Create controller instance with mocked dependencies
    controller = new BillingController({
      billingInterface: mockBillingInterface,
      queueService: mockQueueService,
      entitlementsService: mockEntitlementsService,
      webhookService: mockWebhookService,
      supabaseClient: mockSupabase,
      logger: mockLogger,
      emailService: mockEmailService,
      notificationService: mockNotificationService,
      workerNotificationService: mockWorkerNotificationService,
      PLAN_CONFIG
    });
  });

  describe('constructor', () => {
    test('should initialize with all dependencies', () => {
      expect(controller.billingInterface).toBe(mockBillingInterface);
      expect(controller.queueService).toBe(mockQueueService);
      expect(controller.supabaseClient).toBe(mockSupabase);
      expect(controller.logger).toBe(mockLogger);
      expect(controller.PLAN_CONFIG).toBe(PLAN_CONFIG);
    });
  });

  describe('queueBillingJob', () => {
    const mockWebhookData = {
      customer: 'cus_test123',
      id: 'evt_test',
      amount_due: 1500
    };

    test('should queue payment_failed job successfully', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);
      mockQueueService.addJob.mockResolvedValue({ id: 'job_123' });

      await controller.queueBillingJob('payment_failed', mockWebhookData);

      expect(mockQueueService.addJob).toHaveBeenCalledWith({
        job_type: 'payment_failed',
        data: expect.objectContaining({
          userId: 'user_123',
          customerId: 'cus_test123'
        }),
        priority: 2,
        organization_id: null
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Billing job queued successfully',
        expect.any(Object)
      );
    });

    test('should queue subscription_cancelled job successfully', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);
      mockQueueService.addJob.mockResolvedValue({ id: 'job_123' });

      await controller.queueBillingJob('subscription_cancelled', {
        ...mockWebhookData,
        cancellation_details: { reason: 'user_requested' }
      });

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          job_type: 'subscription_cancelled',
          data: expect.objectContaining({
            cancelReason: 'user_requested'
          })
        })
      );
    });

    test('should queue subscription_updated job successfully', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123', plan: 'starter' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);
      mockBillingInterface.getPrices = jest.fn().mockResolvedValue({
        data: [{ id: 'price_123', lookup_key: 'plan_pro' }]
      });
      mockQueueService.addJob.mockResolvedValue({ id: 'job_123' });

      await controller.queueBillingJob('subscription_updated', {
        ...mockWebhookData,
        items: { data: [{ price: { id: 'price_123' } }] },
        status: 'active'
      });

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          job_type: 'subscription_updated'
        })
      );
    });

    test('should queue payment_succeeded job successfully', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);
      mockQueueService.addJob.mockResolvedValue({ id: 'job_123' });

      await controller.queueBillingJob('payment_succeeded', {
        ...mockWebhookData,
        amount_paid: 1500
      });

      expect(mockQueueService.addJob).toHaveBeenCalled();
    });

    test('should queue invoice_payment_action_required job', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);
      mockQueueService.addJob.mockResolvedValue({ id: 'job_123' });

      await controller.queueBillingJob('invoice_payment_action_required', {
        ...mockWebhookData,
        payment_intent: 'pi_123'
      });

      expect(mockQueueService.addJob).toHaveBeenCalled();
    });

    test('should fall back to sync processing when queueService is null', async () => {
      const controllerNoQueue = new BillingController({
        billingInterface: mockBillingInterface,
        queueService: null,
        supabaseClient: mockSupabase,
        logger: mockLogger,
        emailService: mockEmailService,
        notificationService: mockNotificationService,
        workerNotificationService: mockWorkerNotificationService,
        PLAN_CONFIG
      });

      // Mock handlePaymentSucceeded
      controllerNoQueue.handlePaymentSucceeded = jest.fn().mockResolvedValue();

      await controllerNoQueue.queueBillingJob('payment_succeeded', mockWebhookData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Queue service not initialized, falling back to synchronous processing'
      );
      expect(controllerNoQueue.handlePaymentSucceeded).toHaveBeenCalledWith(mockWebhookData);
    });

    test('should fall back to sync processing when queue fails', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);
      mockQueueService.addJob.mockRejectedValue(new Error('Queue error'));

      // Mock sync handler
      controller.handlePaymentFailed = jest.fn().mockResolvedValue();

      await controller.queueBillingJob('payment_failed', mockWebhookData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to queue billing job, falling back to sync processing',
        expect.any(Object)
      );
      expect(controller.handlePaymentFailed).toHaveBeenCalledWith(mockWebhookData);
    });

    test('should log warning for unknown job type in fallback', async () => {
      const controllerNoQueue = new BillingController({
        billingInterface: mockBillingInterface,
        queueService: null,
        supabaseClient: mockSupabase,
        logger: mockLogger,
        emailService: mockEmailService,
        notificationService: mockNotificationService,
        workerNotificationService: mockWorkerNotificationService,
        PLAN_CONFIG
      });

      await controllerNoQueue.queueBillingJob('unknown_type', mockWebhookData);

      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown fallback job type:', 'unknown_type');
    });
  });

  describe('handleCheckoutCompleted', () => {
    const mockSession = {
      id: 'sess_123',
      customer: 'cus_123',
      subscription: 'sub_123',
      metadata: {
        user_id: 'user_123',
        lookup_key: 'plan_pro'
      }
    };

    beforeEach(() => {
      mockBillingInterface.getSubscription = jest.fn().mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        trial_end: null,
        items: {
          data: [{ price: { id: 'price_pro' } }]
        }
      });

      mockBillingInterface.getCustomer = jest.fn().mockResolvedValue({
        id: 'cus_123',
        email: 'user@example.com',
        name: 'Test User'
      });

      mockSupabaseRpc.mockResolvedValue({
        data: {
          success: true,
          entitlements_updated: true,
          plan_name: 'pro'
        },
        error: null
      });
    });

    test('should process checkout successfully', async () => {
      await controller.handleCheckoutCompleted(mockSession);

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'execute_checkout_completed_transaction',
        expect.objectContaining({
          p_user_id: 'user_123',
          p_plan: 'pro'
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Checkout transaction completed successfully:',
        expect.any(Object)
      );
    });

    test('should send upgrade notification for non-free plans', async () => {
      await controller.handleCheckoutCompleted(mockSession);

      expect(mockEmailService.sendUpgradeSuccessNotification).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          userName: 'Test User',
          newPlanName: 'Pro'
        })
      );

      expect(mockNotificationService.createUpgradeSuccessNotification).toHaveBeenCalledWith(
        'user_123',
        expect.any(Object)
      );
    });

    test('should handle missing user_id in metadata', async () => {
      const sessionNoUserId = {
        ...mockSession,
        metadata: {}
      };

      await controller.handleCheckoutCompleted(sessionNoUserId);

      expect(mockLogger.error).toHaveBeenCalledWith('No user_id in checkout session metadata');
      expect(mockSupabaseRpc).not.toHaveBeenCalled();
    });

    test('should handle transaction failure', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: 'Transaction failed'
      });

      await expect(controller.handleCheckoutCompleted(mockSession)).rejects.toThrow(
        'Checkout completion transaction failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Transaction failed during checkout completion:',
        expect.any(Object)
      );
    });

    test('should handle email notification failure gracefully', async () => {
      mockEmailService.sendUpgradeSuccessNotification.mockRejectedValue(new Error('Email error'));

      // Should not throw
      await controller.handleCheckoutCompleted(mockSession);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '📧 Failed to send upgrade success email:',
        expect.any(Error)
      );
    });

    test('should handle in-app notification failure gracefully', async () => {
      mockNotificationService.createUpgradeSuccessNotification.mockRejectedValue(
        new Error('Notification error')
      );

      // Should not throw
      await controller.handleCheckoutCompleted(mockSession);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '📝 Failed to create upgrade success notification:',
        expect.any(Error)
      );
    });
  });

  describe('handleSubscriptionUpdated', () => {
    const mockSubscription = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      cancel_at_period_end: false,
      trial_end: null,
      items: {
        data: [{ price: { id: 'price_pro' } }]
      }
    };

    beforeEach(() => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      mockBillingInterface.getPrices = jest.fn().mockResolvedValue({
        data: [{ id: 'price_pro', lookup_key: 'plan_pro' }]
      });

      mockSupabaseRpc.mockResolvedValue({
        data: {
          success: true,
          old_plan: 'starter',
          new_plan: 'pro',
          entitlements_updated: true
        },
        error: null
      });
    });

    test('should update subscription successfully', async () => {
      await controller.handleSubscriptionUpdated(mockSubscription);

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'execute_subscription_updated_transaction',
        expect.objectContaining({
          p_subscription_id: 'sub_123',
          p_status: 'active'
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Subscription update transaction completed successfully:',
        expect.any(Object)
      );
    });

    test('should handle missing user for subscription', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      await controller.handleSubscriptionUpdated(mockSubscription);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No user found for subscription update',
        expect.any(Object)
      );
      expect(mockSupabaseRpc).not.toHaveBeenCalled();
    });

    test('should handle transaction failure gracefully (no throw)', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: 'Transaction failed'
      });

      // Should not throw - only log error
      await controller.handleSubscriptionUpdated(mockSubscription);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Transaction failed during subscription update:',
        expect.any(Object)
      );
    });

    test('should handle general errors gracefully', async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error('DB connection error');
      });

      // Should not throw - only log error
      await controller.handleSubscriptionUpdated(mockSubscription);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process subscription update:',
        expect.any(Error)
      );
    });
  });

  describe('handleSubscriptionDeleted', () => {
    const mockSubscription = {
      id: 'sub_123',
      customer: 'cus_123'
    };

    beforeEach(() => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      mockSupabaseRpc.mockResolvedValue({
        data: {
          success: true,
          entitlements_reset: true,
          previous_plan: 'pro',
          access_until_date: new Date().toLocaleDateString()
        },
        error: null
      });

      mockBillingInterface.getCustomer = jest.fn().mockResolvedValue({
        id: 'cus_123',
        email: 'user@example.com',
        name: 'Test User'
      });
    });

    test('should delete subscription successfully', async () => {
      await controller.handleSubscriptionDeleted(mockSubscription);

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'execute_subscription_deleted_transaction',
        expect.objectContaining({
          p_subscription_id: 'sub_123',
          p_customer_id: 'cus_123'
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Subscription deletion transaction completed successfully:',
        expect.any(Object)
      );
    });

    test('should send cancellation notifications', async () => {
      await controller.handleSubscriptionDeleted(mockSubscription);

      expect(mockEmailService.sendSubscriptionCanceledNotification).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          userName: 'Test User'
        })
      );

      expect(mockNotificationService.createSubscriptionCanceledNotification).toHaveBeenCalled();
    });

    test('should handle missing user for customer', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: 'Not found'
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      await controller.handleSubscriptionDeleted(mockSubscription);

      expect(mockLogger.error).toHaveBeenCalledWith('Could not find user for customer:', 'cus_123');
    });

    test('should handle transaction failure', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: 'Transaction failed'
      });

      await expect(controller.handleSubscriptionDeleted(mockSubscription)).rejects.toThrow(
        'Subscription deletion transaction failed'
      );
    });
  });

  describe('handlePaymentSucceeded', () => {
    const mockInvoice = {
      id: 'inv_123',
      customer: 'cus_123',
      amount_paid: 1500
    };

    beforeEach(() => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      mockSupabaseRpc.mockResolvedValue({
        data: { success: true, status_updated: true },
        error: null
      });
    });

    test('should handle payment success', async () => {
      await controller.handlePaymentSucceeded(mockInvoice);

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'execute_payment_succeeded_transaction',
        expect.objectContaining({
          p_invoice_id: 'inv_123',
          p_amount_paid: 1500
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Payment succeeded transaction completed:',
        expect.any(Object)
      );
    });

    test('should handle transaction failure', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: 'Transaction failed'
      });

      await expect(controller.handlePaymentSucceeded(mockInvoice)).rejects.toThrow(
        'Payment success transaction failed'
      );
    });

    test('should handle missing user subscription', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: 'Not found'
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      // Should not call RPC if no user found
      await controller.handlePaymentSucceeded(mockInvoice);

      expect(mockSupabaseRpc).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentFailed', () => {
    const mockInvoice = {
      id: 'inv_123',
      customer: 'cus_123',
      amount_due: 1500,
      attempt_count: 1
    };

    beforeEach(() => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user_123' },
          error: null
        })
      };
      mockSupabaseFrom.mockReturnValue(mockChain);

      mockSupabaseRpc.mockResolvedValue({
        data: {
          success: true,
          status_updated: true,
          plan_name: 'pro'
        },
        error: null
      });

      mockBillingInterface.getCustomer = jest.fn().mockResolvedValue({
        id: 'cus_123',
        email: 'user@example.com',
        name: 'Test User'
      });
    });

    test('should handle payment failure', async () => {
      await controller.handlePaymentFailed(mockInvoice);

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'execute_payment_failed_transaction',
        expect.objectContaining({
          p_invoice_id: 'inv_123',
          p_amount_due: 1500,
          p_attempt_count: 1
        })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Payment failed transaction completed:',
        expect.any(Object)
      );
    });

    test('should send payment failed notifications', async () => {
      await controller.handlePaymentFailed(mockInvoice);

      expect(mockEmailService.sendPaymentFailedNotification).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          userName: 'Test User',
          failedAmount: '€15.00'
        })
      );

      expect(mockNotificationService.createPaymentFailedNotification).toHaveBeenCalled();
    });

    test('should handle email notification failure gracefully', async () => {
      mockEmailService.sendPaymentFailedNotification.mockRejectedValue(new Error('Email error'));

      await controller.handlePaymentFailed(mockInvoice);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '📧 Failed to send payment failed email:',
        expect.any(Error)
      );
    });

    test('should handle transaction failure', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: 'Transaction failed'
      });

      await expect(controller.handlePaymentFailed(mockInvoice)).rejects.toThrow(
        'Payment failure transaction failed'
      );
    });
  });

  describe('applyPlanLimits', () => {
    test('should apply plan limits successfully', async () => {
      // Mock chain that handles both users.update and organizations.select
      let callCount = 0;
      mockSupabaseFrom.mockImplementation((tableName) => {
        if (tableName === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'org_123' },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null })
        };
      });

      await controller.applyPlanLimits('user_123', 'pro', 'active');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('users');
      expect(mockWorkerNotificationService.notifyStatusChange).toHaveBeenCalledWith(
        'user_123',
        'pro',
        'active'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔄 Plan limits updated, workers notified:',
        expect.any(Object)
      );
    });

    test('should apply free plan limits for inactive status', async () => {
      mockSupabaseFrom.mockImplementation((tableName) => {
        if (tableName === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'org_123' },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null })
        };
      });

      await controller.applyPlanLimits('user_123', 'pro', 'past_due');

      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔄 Plan limits updated, workers notified:',
        expect.objectContaining({
          status: 'past_due'
        })
      );
    });

    test('should handle database error', async () => {
      mockSupabaseFrom.mockImplementation((tableName) => {
        if (tableName === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: new Error('DB error') })
            })
          };
        }
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null })
        };
      });

      await expect(controller.applyPlanLimits('user_123', 'pro', 'active')).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to apply plan limits:',
        expect.any(Error)
      );
    });

    test('should update organization limits when user is owner', async () => {
      mockSupabaseFrom.mockImplementation((tableName) => {
        if (tableName === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'org_123' },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        return {};
      });

      await controller.applyPlanLimits('user_123', 'pro', 'active');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('organizations');
    });

    test('should not update organization if user is not owner', async () => {
      mockSupabaseFrom.mockImplementation((tableName) => {
        if (tableName === 'users') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        if (tableName === 'organizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null, // No organization found
                  error: null
                })
              })
            })
          };
        }
        return {};
      });

      await controller.applyPlanLimits('user_123', 'pro', 'active');

      // Should still complete successfully
      expect(mockWorkerNotificationService.notifyStatusChange).toHaveBeenCalled();
    });
  });
});
