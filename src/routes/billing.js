/**
 * Billing routes for Stripe integration
 * Handles subscription creation, management, and webhooks
 *
 * Issue #413 - Refactored to use Dependency Injection for testability
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { getPlanFromStripeLookupKey, normalizePlanId, PLAN_IDS } = require('../config/planMappings');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const BillingFactory = require('./billingFactory');

const router = express.Router();

// Create controller with dependency injection (allows override in tests)
let billingController = null;

// Lazy initialization - creates controller on first access
function getController() {
  if (!billingController) {
    billingController = BillingFactory.createController();
  }
  return billingController;
}

// Get PLAN_CONFIG from factory
const PLAN_CONFIG = BillingFactory.getPlanConfig();

// Get services from controller for backward compatibility (lazy getters)
Object.defineProperty(router, 'billingInterface', {
  get: () => getController().billingInterface // TODO:Polar - Replaces stripeWrapper
});
Object.defineProperty(router, 'queueService', {
  get: () => getController().queueService
});
Object.defineProperty(router, 'entitlementsService', {
  get: () => getController().entitlementsService
});
Object.defineProperty(router, 'webhookService', {
  get: () => getController().webhookService
});

// Middleware to check billing availability
const requireBilling = (req, res, next) => {
  if (!flags.isEnabled('ENABLE_BILLING')) {
    return res.status(503).json({
      success: false,
      error: 'Billing temporarily unavailable',
      code: 'BILLING_UNAVAILABLE'
    });
  }
  next();
};

/**
 * GET /api/billing/plans
 * Get available subscription plans
 */
router.get('/plans', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        plans: PLAN_CONFIG,
        currentPlan: null // Will be filled by frontend based on user data
      }
    });
  } catch (error) {
    logger.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans'
    });
  }
});

/**
 * POST /api/billing/create-checkout-session
 * Create Stripe Checkout session for subscription
 */
router.post('/create-checkout-session', authenticateToken, requireBilling, async (req, res) => {
  try {
    const { plan, lookupKey } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Support both plan and lookupKey formats
    let targetLookupKey = lookupKey;

    if (plan && !lookupKey) {
      // Map plan to lookup key
      const planLookupMap = {
        starter: process.env.STRIPE_PRICE_LOOKUP_STARTER || 'plan_starter',
        pro: process.env.STRIPE_PRICE_LOOKUP_PRO || 'plan_pro',
        plus: process.env.STRIPE_PRICE_LOOKUP_PLUS || 'plan_plus'
      };
      targetLookupKey = planLookupMap[plan];
    }

    if (!targetLookupKey) {
      return res.status(400).json({
        success: false,
        error: 'plan is required (free|starter|pro|plus)'
      });
    }

    // Free plan doesn't require Stripe
    if (plan === PLAN_IDS.STARTER_TRIAL) {
      return res.json({
        success: true,
        data: {
          message: 'Free plan activated',
          plan: PLAN_IDS.STARTER_TRIAL
        }
      });
    }

    // Validate lookup key
    const validLookupKeys = [
      process.env.STRIPE_PRICE_LOOKUP_STARTER || 'plan_starter',
      process.env.STRIPE_PRICE_LOOKUP_PRO || 'plan_pro',
      process.env.STRIPE_PRICE_LOOKUP_PLUS || 'plan_plus'
    ];

    if (!validLookupKeys.includes(targetLookupKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan specified'
      });
    }

    // Get or create Stripe customer
    let customer = null;

    // Check if user already has a Stripe customer ID
    const { data: existingSubscription } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (existingSubscription?.stripe_customer_id) {
      // Retrieve existing customer
      try {
        customer = await getController().stripeWrapper.customers.retrieve(
          existingSubscription.stripe_customer_id
        );
      } catch (stripeError) {
        logger.warn('Failed to retrieve existing customer, creating new one:', stripeError.message);
        customer = null;
      }
    }

    // Create new customer if none exists or retrieval failed
    if (!customer) {
      customer = await getController().stripeWrapper.customers.create({
        email: userEmail,
        metadata: {
          user_id: userId
        }
      });

      // Update user_subscriptions with customer ID
      await supabaseServiceClient.from('user_subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: customer.id,
        plan: PLAN_IDS.STARTER_TRIAL, // Keep as free until checkout completes
        status: 'active'
      });
    }

    // Get price by lookup key
    const prices = await getController().stripeWrapper.prices.list({
      lookup_keys: [targetLookupKey],
      expand: ['data.product']
    });

    if (prices.data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Price not found for lookup key: ' + targetLookupKey
      });
    }

    const price = prices.data[0];

    // Create checkout session
    const session = await getController().stripeWrapper.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      metadata: {
        user_id: userId,
        lookup_key: targetLookupKey,
        plan: plan || 'unknown'
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          lookup_key: targetLookupKey,
          plan: plan || 'unknown'
        }
      }
    });

    logger.info('Stripe checkout session created:', {
      userId,
      sessionId: session.id,
      lookupKey,
      customerId: customer.id
    });

    res.json({
      success: true,
      data: {
        id: session.id,
        url: session.url
      }
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

/**
 * POST /api/billing/portal
 * Create Stripe Customer Portal session (alias for frontend compatibility)
 */
router.post('/portal', authenticateToken, requireBilling, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's Stripe customer ID
    const { data: subscription, error } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (error || !subscription?.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Create portal session
    const portalSession = await getController().stripeWrapper.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:3000/billing'
    });

    logger.info('Stripe portal session created:', {
      userId,
      customerId: subscription.stripe_customer_id,
      sessionId: portalSession.id
    });

    res.json({
      success: true,
      url: portalSession.url
    });
  } catch (error) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create portal session'
    });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Create Stripe Customer Portal session
 */
router.post('/create-portal-session', authenticateToken, requireBilling, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's Stripe customer ID
    const { data: subscription, error } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (error || !subscription?.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Create portal session
    const portalSession = await getController().stripeWrapper.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL
    });

    logger.info('Stripe portal session created:', {
      userId,
      customerId: subscription.stripe_customer_id,
      sessionId: portalSession.id
    });

    res.json({
      success: true,
      data: {
        url: portalSession.url
      }
    });
  } catch (error) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create portal session'
    });
  }
});

/**
 * POST /api/billing/cancel
 * Cancel subscription (at period end)
 * Issue #1056: Cancel subscription functionality
 */
router.post('/cancel', authenticateToken, requireBilling, async (req, res) => {
  try {
    const userId = req.user.id;
    const { immediately = false } = req.body;

    // Get subscription
    const { data: subscription, error } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    if (!subscription.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'Subscription does not have a Stripe subscription ID'
      });
    }

    // Cancel subscription via Stripe
    if (immediately) {
      // Cancel immediately
      await getController().stripeWrapper.subscriptions.cancel(
        subscription.stripe_subscription_id,
        {
          cancel_immediately: true
        }
      );

      // Update database
      await supabaseServiceClient
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      // Cancel at period end
      await getController().stripeWrapper.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: true
        }
      );

      // Update database
      await supabaseServiceClient
        .from('user_subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    }

    logger.info('Subscription cancellation initiated:', {
      userId,
      subscriptionId: subscription.stripe_subscription_id,
      immediately
    });

    res.json({
      success: true,
      data: {
        message: immediately
          ? 'Subscription canceled immediately'
          : 'Subscription will be canceled at the end of the billing period',
        activeUntil: subscription.current_period_end
      }
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

/**
 * GET /api/billing/info
 * Get comprehensive billing information including payment method, usage, and subscription status
 * Issue #1056: Complete billing information for Settings page
 */
router.get('/info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get subscription from database
    const { data: subscription, error: subError } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is OK for new users
      logger.error('Error fetching subscription:', subError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription'
      });
    }

    const sub = subscription || {
      user_id: userId,
      plan: PLAN_IDS.STARTER_TRIAL,
      status: 'active',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
      cancel_at_period_end: false
    };

    // Get usage data (from entitlements service or user usage)
    let usage = { roastsUsed: 0, apiCalls: 0 };
    let limits = { roastsPerMonth: 5, apiCallsPerMonth: 10 };

    try {
      // Try to get usage from entitlements service
      const entitlementsService = getController().entitlementsService;
      if (entitlementsService && typeof entitlementsService.getUserUsage === 'function') {
        const userUsage = await entitlementsService.getUserUsage(userId);
        usage = {
          roastsUsed: userUsage?.roasts_used || 0,
          apiCalls: userUsage?.api_calls || 0
        };
        limits = {
          roastsPerMonth: userUsage?.roast_limit || 5,
          apiCallsPerMonth: userUsage?.api_limit || 10
        };
      }
    } catch (usageError) {
      logger.warn('Could not fetch usage data:', usageError.message);
      // Use defaults
    }

    // Get payment method info from Stripe if customer exists
    let paymentMethod = null;
    let nextBillingDate = null;
    let subscriptionStatus = sub.status || 'active';
    let activeUntil = null;

    if (sub.stripe_customer_id && flags.isEnabled('ENABLE_BILLING')) {
      try {
        // Retrieve customer with expanded default payment method
        const customer = await getController().stripeWrapper.customers.retrieve(
          sub.stripe_customer_id,
          { expand: ['default_source', 'invoice_settings.default_payment_method'] }
        );

        // Get payment method last 4 digits
        if (customer.invoice_settings?.default_payment_method) {
          const pm = customer.invoice_settings.default_payment_method;
          if (typeof pm === 'object' && pm.card) {
            paymentMethod = {
              last4: pm.card.last4,
              brand: pm.card.brand,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year
            };
          } else if (typeof pm === 'string') {
            // If it's just an ID, we'd need another API call, but for now we'll skip
            // In production, you'd retrieve the payment method separately
          }
        } else if (customer.default_source) {
          // Fallback to default source (legacy)
          const source = customer.default_source;
          if (typeof source === 'object' && source.card) {
            paymentMethod = {
              last4: source.card.last4,
              brand: source.card.brand,
              expMonth: source.card.exp_month,
              expYear: source.card.exp_year
            };
          }
        }

        // Get subscription details if subscription ID exists
        if (sub.stripe_subscription_id) {
          const stripeSub = await getController().stripeWrapper.subscriptions.retrieve(
            sub.stripe_subscription_id,
            { expand: ['default_payment_method'] }
          );

          subscriptionStatus = stripeSub.status;
          nextBillingDate = stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000).toISOString()
            : sub.current_period_end;

          if (stripeSub.cancel_at_period_end || subscriptionStatus === 'canceled') {
            activeUntil = stripeSub.current_period_end
              ? new Date(stripeSub.current_period_end * 1000).toISOString()
              : sub.current_period_end;
          }

          // Get payment method from subscription if not found in customer
          if (!paymentMethod && stripeSub.default_payment_method) {
            const pm = stripeSub.default_payment_method;
            if (typeof pm === 'object' && pm.card) {
              paymentMethod = {
                last4: pm.card.last4,
                brand: pm.card.brand,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year
              };
            }
          }
        } else if (sub.current_period_end) {
          nextBillingDate = sub.current_period_end;
        }
      } catch (stripeError) {
        logger.warn('Could not fetch Stripe payment method info:', {
          error: stripeError.message,
          customerId: sub.stripe_customer_id
        });
        // Continue without payment method info
      }
    } else if (sub.current_period_end) {
      nextBillingDate = sub.current_period_end;
    }

    // Determine if subscription is cancelled
    const isCancelled = subscriptionStatus === 'canceled' || sub.cancel_at_period_end;
    if (isCancelled && sub.current_period_end) {
      activeUntil = sub.current_period_end;
    }

    res.json({
      success: true,
      data: {
        usage,
        limits,
        paymentMethod,
        nextBillingDate,
        subscriptionStatus,
        activeUntil,
        plan: sub.plan,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false
      }
    });
  } catch (error) {
    logger.error('Error fetching billing info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information'
    });
  }
});

/**
 * GET /api/billing/subscription
 * Get current user's subscription details
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: subscription, error } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error('Error fetching subscription:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription'
      });
    }

    // Get plan configuration
    const planConfig = PLAN_CONFIG[subscription?.plan || PLAN_IDS.STARTER_TRIAL];

    res.json({
      success: true,
      data: {
        subscription: subscription || {
          user_id: userId,
          plan: PLAN_IDS.STARTER_TRIAL,
          status: 'active',
          stripe_customer_id: null,
          stripe_subscription_id: null
        },
        planConfig
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription details'
    });
  }
});

/**
 * POST /webhooks/stripe
 * Handle Stripe webhooks for subscription events with enhanced security and idempotency
 */
const { stripeWebhookSecurity } = require('../middleware/webhookSecurity');

router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookSecurity({
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    tolerance: 300, // 5 minutes tolerance
    enableIdempotency: true,
    enableSuspiciousPayloadDetection: true
  }),
  async (req, res) => {
    // Early return if billing is disabled
    if (!flags.isEnabled('ENABLE_BILLING')) {
      logger.warn('Webhook received but billing is disabled');
      return res.status(503).json({ error: 'Billing temporarily unavailable' });
    }

    const requestId = req.webhookSecurity?.requestId;
    let event;

    try {
      // Parse event (already validated by security middleware)
      event = JSON.parse(req.body.toString());

      logger.info('Stripe webhook received:', {
        requestId,
        type: event.type,
        id: event.id,
        created: event.created,
        timestampAge: req.webhookSecurity?.timestampAge,
        bodySize: req.webhookSecurity?.bodySize
      });

      // Process event using the webhook service with enhanced context
      const controller = getController();
      const result = await controller.webhookService.processWebhookEvent(event, {
        requestId,
        securityContext: req.webhookSecurity
      });

      if (result.success) {
        logger.info('Webhook processed successfully:', {
          requestId,
          eventId: event.id,
          eventType: event.type,
          idempotent: result.idempotent,
          processingTime: result.processingTimeMs
        });
      } else {
        logger.error('Webhook processing failed:', {
          requestId,
          eventId: event.id,
          eventType: event.type,
          error: result.error
        });
      }

      // Always return 200 to prevent Stripe from retrying
      res.json({
        received: true,
        processed: result.success,
        idempotent: result.idempotent || false,
        message: result.message || 'Event processed',
        requestId
      });
    } catch (error) {
      logger.error('Critical webhook processing error:', {
        requestId,
        eventId: event?.id,
        eventType: event?.type,
        error: error.message,
        stack: error.stack
      });

      // Still return 200 to prevent Stripe from retrying
      res.json({
        received: true,
        processed: false,
        error: 'Processing failed but acknowledged',
        requestId
      });
    }
  }
);

/**
 * GET /api/billing/webhook-stats
 * Get webhook processing statistics (admin only)
 */
router.get('/webhook-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (userError || !user?.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const daysAgo = parseInt(req.query.days) || 7;
    const stats = await getController().webhookService.getWebhookStats(daysAgo);

    res.json({
      success: true,
      data: {
        period_days: daysAgo,
        statistics: stats.data || []
      }
    });
  } catch (error) {
    logger.error('Error fetching webhook stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhook statistics'
    });
  }
});

/**
 * POST /api/billing/webhook-cleanup
 * Cleanup old webhook events (admin only)
 */
router.post('/webhook-cleanup', express.json(), authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (userError || !user?.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const olderThanDays = parseInt(req.body.days) || 30;

    let result;
    try {
      result = await getController().webhookService.cleanupOldEvents(olderThanDays);
    } catch (cleanupError) {
      logger.error('cleanupOldEvents threw error:', cleanupError);
      throw cleanupError; // Re-throw to outer catch
    }

    res.json({
      success: result.success,
      data: {
        events_deleted: result.eventsDeleted || 0,
        older_than_days: olderThanDays
      },
      error: result.error
    });
  } catch (error) {
    logger.error('Error cleaning up webhook events:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup webhook events',
      details: process.env.NODE_ENV === 'test' ? error.message : undefined
    });
  }
});

/**
 * Helper function to export controller for testing
 * Allows tests to inject mock controller
 * IMPORTANT: Call this IMMEDIATELY after requiring billing routes, before any requests
 */
router.setController = (controller) => {
  billingController = controller;
  // Force immediate use of injected controller
  return billingController;
};

/**
 * Get current controller (for debugging/testing)
 */
router.getController = () => getController();

// Legacy functions - now delegated to controller
// Kept for backward compatibility with any external references

/**
 * Queue a billing job for processing by BillingWorker
 * @deprecated Use billingController.queueBillingJob() instead
 */
async function queueBillingJob(jobType, webhookData) {
  return getController().queueBillingJob(jobType, webhookData);
}

/**
 * Handle checkout completed
 * @deprecated Use billingController.handleCheckoutCompleted() instead
 */
async function handleCheckoutCompleted(session) {
  return getController().handleCheckoutCompleted(session);
}

/**
 * Handle subscription updated
 * @deprecated Use billingController.handleSubscriptionUpdated() instead
 */
async function handleSubscriptionUpdated(subscription) {
  return getController().handleSubscriptionUpdated(subscription);
}

/**
 * Handle subscription deleted
 * @deprecated Use billingController.handleSubscriptionDeleted() instead
 */
async function handleSubscriptionDeleted(subscription) {
  return getController().handleSubscriptionDeleted(subscription);
}

/**
 * Handle payment succeeded
 * @deprecated Use billingController.handlePaymentSucceeded() instead
 */
async function handlePaymentSucceeded(invoice) {
  return getController().handlePaymentSucceeded(invoice);
}

/**
 * Handle payment failed
 * @deprecated Use billingController.handlePaymentFailed() instead
 */
async function handlePaymentFailed(invoice) {
  return getController().handlePaymentFailed(invoice);
}

/**
 * Apply plan limits
 * @deprecated Use billingController.applyPlanLimits() instead
 */
async function applyPlanLimits(userId, plan, status) {
  return getController().applyPlanLimits(userId, plan, status);
}

/*
 * POST /api/billing/start-trial
 * Start trial period for user (Issue #678)
 */
router.post('/start-trial', authenticateToken, requireBilling, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is already in trial
    const isInTrial = await getController().entitlementsService.isInTrial(userId);
    if (isInTrial) {
      return res.status(400).json({
        success: false,
        error: 'User is already in trial period'
      });
    }

    // Start trial
    const trialResult = await getController().entitlementsService.startTrial(userId, 30);

    res.json({
      success: true,
      data: {
        message: 'Trial started successfully',
        trial_ends_at: trialResult.trial_ends_at,
        duration_days: trialResult.duration_days
      }
    });
  } catch (error) {
    logger.error('Trial start failed:', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to start trial'
    });
  }
});

// LEGACY IMPLEMENTATION BELOW - REPLACED WITH CONTROLLER

/**
 * LEGACY IMPLEMENTATION REMOVED - All business logic moved to BillingController
 * The functions above (queueBillingJob, handleCheckoutCompleted, etc.) now delegate
 * to billingController methods for backward compatibility.
 *
 * Benefits of DI refactor:
 * - Testable: Can inject mocks in tests
 * - SOLID: Follows Dependency Inversion Principle
 * - Maintainable: Business logic separated from routing
 * - Flexible: Easy to swap implementations
 *
 * See:
 * - src/routes/billingController.js for business logic
 * - src/routes/billingFactory.js for dependency creation
 * - tests/integration/stripeWebhooksFlow.test.js for testing with mocks
 */

// Export legacy functions on router for backward compatibility
router.queueBillingJob = queueBillingJob;
router.handleCheckoutCompleted = handleCheckoutCompleted;
router.handleSubscriptionUpdated = handleSubscriptionUpdated;
router.handleSubscriptionDeleted = handleSubscriptionDeleted;
router.handlePaymentSucceeded = handlePaymentSucceeded;
router.handlePaymentFailed = handlePaymentFailed;
router.applyPlanLimits = applyPlanLimits;

module.exports = router;
