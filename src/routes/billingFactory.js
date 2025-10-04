/**
 * BillingFactory - Factory pattern for creating BillingController with DI
 * Issue #413 - Enables dependency injection for testability
 */

const StripeWrapper = require('../services/stripeWrapper');
const EntitlementsService = require('../services/entitlementsService');
const StripeWebhookService = require('../services/stripeWebhookService');
const QueueService = require('../services/queueService');
const { flags } = require('../config/flags');
const { logger } = require('../utils/logger');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const workerNotificationService = require('../services/workerNotificationService');
const { supabaseServiceClient } = require('../config/supabase');
const { PLAN_IDS } = require('../config/planMappings');
const BillingController = require('./billingController');

// Plan configuration using shared constants
const PLAN_CONFIG = {
  [PLAN_IDS.FREE]: {
    name: 'Free',
    price: 0,
    currency: 'eur',
    description: 'Perfect for getting started',
    features: ['10 roasts per month', '1 platform integration', 'Basic support'],
    maxPlatforms: 1,
    maxRoasts: 10
  },
  [PLAN_IDS.STARTER]: {
    name: 'Starter',
    price: 500, // €5.00 in cents
    currency: 'eur',
    description: 'Great for regular users',
    features: ['10 roasts per month', '1,000 analyses', 'Shield protection', 'Email support'],
    maxPlatforms: 1,
    maxRoasts: 10,
    lookupKey: process.env.STRIPE_PRICE_LOOKUP_STARTER || 'starter_monthly'
  },
  [PLAN_IDS.PRO]: {
    name: 'Pro',
    price: 1500, // €15.00 in cents
    currency: 'eur',
    description: 'Best for power users',
    features: ['1,000 roasts per month', '2 platform integrations', 'Shield protection', 'Priority support', 'Advanced analytics'],
    maxPlatforms: 2,
    maxRoasts: 1000,
    lookupKey: process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly'
  },
  [PLAN_IDS.PLUS]: {
    name: 'Plus',
    price: 5000, // €50.00 in cents
    currency: 'eur',
    description: 'For creators and professionals',
    features: ['5,000 roasts per month', '2 platform integrations', 'Shield protection', '24/7 support', 'Custom tones', 'API access'],
    maxPlatforms: 2,
    maxRoasts: 5000,
    lookupKey: process.env.STRIPE_PRICE_LOOKUP_PLUS || 'plus_monthly'
  }
};

class BillingFactory {
  /**
   * Create BillingController with dependency injection
   * Allows override of dependencies for testing
   *
   * @param {Object} dependencies - Optional overrides for dependencies
   * @returns {BillingController} - Configured controller instance
   */
  static createController(dependencies = {}) {
    // Allow override of dependencies (for tests)
    const {
      stripeWrapper = flags.isEnabled('ENABLE_BILLING')
        ? new StripeWrapper(process.env.STRIPE_SECRET_KEY)
        : null,
      queueService = new QueueService(),
      entitlementsService = new EntitlementsService(),
      webhookService = new StripeWebhookService(),
      supabaseClient = supabaseServiceClient,
      loggerInstance = logger,
      emailServiceInstance = emailService,
      notificationServiceInstance = notificationService,
      workerNotificationServiceInstance = workerNotificationService,
      planConfig = PLAN_CONFIG
    } = dependencies;

    // Inicializar queue si billing está habilitado
    if (flags.isEnabled('ENABLE_BILLING') && queueService && queueService.initialize) {
      queueService.initialize();
    }

    return new BillingController({
      stripeWrapper,
      queueService,
      entitlementsService,
      webhookService,
      supabaseClient,
      logger: loggerInstance,
      emailService: emailServiceInstance,
      notificationService: notificationServiceInstance,
      workerNotificationService: workerNotificationServiceInstance,
      PLAN_CONFIG: planConfig
    });
  }

  /**
   * Get PLAN_CONFIG for use in routes
   * @returns {Object} - Plan configuration
   */
  static getPlanConfig() {
    return PLAN_CONFIG;
  }
}

module.exports = BillingFactory;
