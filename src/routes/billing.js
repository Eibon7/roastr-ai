/**
 * Billing routes for Stripe integration
 * Handles subscription creation, management, and webhooks
 */

const express = require('express');
const StripeWrapper = require('../services/stripeWrapper');
const EntitlementsService = require('../services/entitlementsService');
const StripeWebhookService = require('../services/stripeWebhookService');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { getPlanFromStripeLookupKey, normalizePlanId, PLAN_IDS } = require('../config/planMappings');
const { supabaseServiceClient, createUserClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const workerNotificationService = require('../services/workerNotificationService');
const QueueService = require('../services/queueService');
const { createWebhookRetryHandler } = require('../utils/retry');

const router = express.Router();

// Initialize Stripe Wrapper, Queue Service, Entitlements Service, and Webhook Service
let stripeWrapper = null;
let queueService = null;
let entitlementsService = null;
let webhookService = null;

if (flags.isEnabled('ENABLE_BILLING')) {
  stripeWrapper = new StripeWrapper(process.env.STRIPE_SECRET_KEY);
  queueService = new QueueService();
  queueService.initialize();
  entitlementsService = new EntitlementsService();
  webhookService = new StripeWebhookService();
} else {
  console.log('⚠️ Stripe billing disabled - missing configuration keys');
  entitlementsService = new EntitlementsService(); // Always available for free plans
  webhookService = new StripeWebhookService(); // Always available for webhook processing
}

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

// Plan configuration using shared constants
const PLAN_CONFIG = {
    [PLAN_IDS.FREE]: {
        name: 'Free',
        price: 0,
        currency: 'eur',
        description: 'Perfect for getting started',
        features: ['50 roasts per month', '1 platform integration', 'Basic support'],
        maxPlatforms: 1,
        maxRoasts: 50
    },
    [PLAN_IDS.STARTER]: {
        name: 'Starter',
        price: 500, // €5.00 in cents
        currency: 'eur',
        description: 'Great for regular users',
        features: ['100 roasts per month', '2 platform integrations', 'Shield protection', 'Email support'],
        maxPlatforms: 2,
        maxRoasts: 100,
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
                'starter': process.env.STRIPE_PRICE_LOOKUP_STARTER || 'plan_starter',
                'pro': process.env.STRIPE_PRICE_LOOKUP_PRO || 'plan_pro',
                'plus': process.env.STRIPE_PRICE_LOOKUP_PLUS || 'plan_plus'
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
        if (plan === PLAN_IDS.FREE) {
            return res.json({
                success: true,
                data: {
                    message: 'Free plan activated',
                    plan: PLAN_IDS.FREE
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
                customer = await stripeWrapper.customers.retrieve(existingSubscription.stripe_customer_id);
            } catch (stripeError) {
                logger.warn('Failed to retrieve existing customer, creating new one:', stripeError.message);
                customer = null;
            }
        }

        // Create new customer if none exists or retrieval failed
        if (!customer) {
            customer = await stripeWrapper.customers.create({
                email: userEmail,
                metadata: {
                    user_id: userId
                }
            });

            // Update user_subscriptions with customer ID
            await supabaseServiceClient
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    stripe_customer_id: customer.id,
                    plan: PLAN_IDS.FREE, // Keep as free until checkout completes
                    status: 'active'
                });
        }

        // Get price by lookup key
        const prices = await stripeWrapper.prices.list({
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
        const session = await stripeWrapper.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: price.id,
                quantity: 1
            }],
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
        const portalSession = await stripeWrapper.billingPortal.sessions.create({
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
        const portalSession = await stripeWrapper.billingPortal.sessions.create({
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
        const planConfig = PLAN_CONFIG[subscription?.plan || PLAN_IDS.FREE];

        res.json({
            success: true,
            data: {
                subscription: subscription || {
                    user_id: userId,
                    plan: PLAN_IDS.FREE,
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

router.post('/webhooks/stripe', 
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
            const result = await webhookService.processWebhookEvent(event, {
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
        const stats = await webhookService.getWebhookStats(daysAgo);

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
router.post('/webhook-cleanup', authenticateToken, async (req, res) => {
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
        const result = await webhookService.cleanupOldEvents(olderThanDays);

        res.json({
            success: result.success,
            data: {
                events_deleted: result.eventsDeleted || 0,
                older_than_days: olderThanDays
            },
            error: result.error
        });

    } catch (error) {
        logger.error('Error cleaning up webhook events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup webhook events'
        });
    }
});

/**
 * Queue a billing job for processing by BillingWorker
 * @param {string} jobType - Type of billing job
 * @param {Object} webhookData - Webhook data from Stripe
 */
async function queueBillingJob(jobType, webhookData) {
    if (!queueService) {
        logger.error('Queue service not initialized, falling back to synchronous processing');
        // Fallback to original handlers for critical functionality
        switch (jobType) {
            case 'subscription_cancelled':
                return await handleSubscriptionDeleted(webhookData);
            case 'payment_succeeded':
                return await handlePaymentSucceeded(webhookData);
            case 'payment_failed':
                return await handlePaymentFailed(webhookData);
            case 'subscription_updated':
                return await handleSubscriptionUpdated(webhookData);
            default:
                logger.warn('Unknown fallback job type:', jobType);
        }
        return;
    }

    try {
        // Extract common data from webhook
        let jobData = {};

        switch (jobType) {
            case 'payment_failed':
                const { data: failedUserSub } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', webhookData.customer)
                    .single();

                jobData = {
                    userId: failedUserSub?.user_id,
                    customerId: webhookData.customer,
                    invoiceId: webhookData.id,
                    amount: webhookData.amount_due,
                    attemptCount: 0
                };
                break;

            case 'subscription_cancelled':
                const { data: cancelledUserSub } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', webhookData.customer)
                    .single();

                jobData = {
                    userId: cancelledUserSub?.user_id,
                    customerId: webhookData.customer,
                    subscriptionId: webhookData.id,
                    cancelReason: webhookData.cancellation_details?.reason || 'user_requested'
                };
                break;

            case 'subscription_updated':
                const { data: updatedUserSub } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .select('user_id, plan')
                    .eq('stripe_customer_id', webhookData.customer)
                    .single();

                // Determine plan from subscription
                let newPlan = PLAN_IDS.FREE;
                if (webhookData.items?.data?.length > 0) {
                    const price = webhookData.items.data[0].price;
                    const prices = await stripeWrapper.prices.list({ limit: 100 });
                    const priceData = prices.data.find(p => p.id === price.id);
                    
                    if (priceData?.lookup_key) {
                        newPlan = getPlanFromStripeLookupKey(priceData.lookup_key) || PLAN_IDS.FREE;
                    }
                }

                jobData = {
                    userId: updatedUserSub?.user_id,
                    customerId: webhookData.customer,
                    subscriptionId: webhookData.id,
                    newPlan,
                    newStatus: webhookData.status
                };
                break;

            case 'payment_succeeded':
                const { data: succeededUserSub } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', webhookData.customer)
                    .single();

                jobData = {
                    userId: succeededUserSub?.user_id,
                    customerId: webhookData.customer,
                    invoiceId: webhookData.id,
                    amount: webhookData.amount_paid
                };
                break;

            case 'invoice_payment_action_required':
                const { data: actionUserSub } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', webhookData.customer)
                    .single();

                jobData = {
                    userId: actionUserSub?.user_id,
                    customerId: webhookData.customer,
                    invoiceId: webhookData.id,
                    paymentIntentId: webhookData.payment_intent
                };
                break;
        }

        // Queue the job for BillingWorker
        await queueService.addJob({
            job_type: jobType,
            data: jobData,
            priority: 2, // High priority for billing jobs
            organization_id: null // Billing jobs are system-wide
        });

        logger.info('Billing job queued successfully', {
            jobType,
            userId: jobData.userId,
            customerId: jobData.customerId
        });

    } catch (error) {
        logger.error('Failed to queue billing job, falling back to sync processing', {
            jobType,
            error: error.message
        });

        // Fallback to synchronous processing if queueing fails
        switch (jobType) {
            case 'subscription_cancelled':
                return await handleSubscriptionDeleted(webhookData);
            case 'payment_succeeded':
                return await handlePaymentSucceeded(webhookData);
            case 'payment_failed':
                return await handlePaymentFailed(webhookData);
            case 'subscription_updated':
                return await handleSubscriptionUpdated(webhookData);
            default:
                logger.warn('Unknown fallback job type:', jobType);
        }
    }
}

/**
 * Handle checkout.session.completed event with transaction support
 * Issue #95: Added database transactions to prevent inconsistent state
 */
async function handleCheckoutCompleted(session) {
    const userId = session.metadata?.user_id;
    
    if (!userId) {
        logger.error('No user_id in checkout session metadata');
        return;
    }

    const subscription = await stripeWrapper.subscriptions.retrieve(session.subscription);
    const customer = await stripeWrapper.customers.retrieve(session.customer);

    // Get the price ID from the subscription for entitlements update
    const priceId = subscription.items?.data?.[0]?.price?.id;
    
    // Determine plan from price lookup key using shared mappings
    let plan = PLAN_IDS.FREE;
    const lookupKey = session.metadata?.lookup_key;
    
    if (lookupKey) {
        plan = getPlanFromStripeLookupKey(lookupKey) || PLAN_IDS.FREE;
    }

    // Execute critical database operations in a transaction
    const transactionResult = await supabaseServiceClient.rpc('execute_checkout_completed_transaction', {
        p_user_id: userId,
        p_stripe_customer_id: customer.id,
        p_stripe_subscription_id: subscription.id,
        p_plan: plan,
        p_status: subscription.status,
        p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        p_cancel_at_period_end: subscription.cancel_at_period_end,
        p_trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        p_price_id: priceId,
        p_metadata: JSON.stringify({
            subscription_id: subscription.id,
            customer_id: customer.id,
            checkout_session_id: session.id,
            updated_from: 'checkout_completed'
        })
    });

    if (transactionResult.error) {
        logger.error('Transaction failed during checkout completion:', {
            userId,
            subscriptionId: subscription.id,
            error: transactionResult.error,
            details: transactionResult.data
        });
        throw new Error(`Checkout completion transaction failed: ${transactionResult.error}`);
    }

    logger.info('Checkout transaction completed successfully:', {
        userId,
        plan,
        subscriptionId: subscription.id,
        entitlementsUpdated: transactionResult.data?.entitlements_updated || false,
        planName: transactionResult.data?.plan_name || plan
    });

    // Send upgrade success email notification (non-critical, outside transaction)
    if (plan !== PLAN_IDS.FREE) {
        try {
            // Get user email from customer
            const userEmail = customer.email;
            const planConfig = PLAN_CONFIG[plan] || {};
            
            await emailService.sendUpgradeSuccessNotification(userEmail, {
                userName: customer.name || userEmail.split('@')[0],
                oldPlanName: 'Free',
                newPlanName: planConfig.name || plan,
                newFeatures: planConfig.features || [],
                activationDate: new Date().toLocaleDateString(),
            });

            logger.info('📧 Upgrade success email sent:', { userId, plan, email: userEmail });
        } catch (emailError) {
            logger.error('📧 Failed to send upgrade success email:', emailError);
        }

        // Create in-app notification (non-critical, outside transaction)
        try {
            await notificationService.createUpgradeSuccessNotification(userId, {
                oldPlanName: 'Free',
                newPlanName: planConfig.name || plan,
                newFeatures: planConfig.features || [],
                activationDate: new Date().toLocaleDateString(),
            });

            logger.info('📝 Upgrade success notification created:', { userId, plan });
        } catch (notificationError) {
            logger.error('📝 Failed to create upgrade success notification:', notificationError);
        }
    }
}

/**
 * Handle subscription updated event with transaction support
 * Issue #95: Added database transactions to prevent inconsistent state
 */
async function handleSubscriptionUpdated(subscription) {
    try {
        // Get user ID from subscription
        const { data: userSub } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .single();

        if (!userSub) {
            logger.warn('No user found for subscription update', {
                subscriptionId: subscription.id,
                customerId: subscription.customer
            });
            return;
        }

        const userId = userSub.user_id;
        const priceId = subscription.items?.data?.[0]?.price?.id;

        // Determine plan from subscription items using shared mappings
        let newPlan = PLAN_IDS.FREE;
        if (priceId) {
            const prices = await stripeWrapper.prices.list({ limit: 100 });
            const priceData = prices.data.find(p => p.id === priceId);
            
            if (priceData?.lookup_key) {
                newPlan = getPlanFromStripeLookupKey(priceData.lookup_key) || PLAN_IDS.FREE;
            }
        }

        // Execute subscription update operations in a transaction
        const transactionResult = await supabaseServiceClient.rpc('execute_subscription_updated_transaction', {
            p_user_id: userId,
            p_subscription_id: subscription.id,
            p_customer_id: subscription.customer,
            p_plan: newPlan,
            p_status: subscription.status,
            p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            p_cancel_at_period_end: subscription.cancel_at_period_end,
            p_trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            p_price_id: priceId,
            p_metadata: JSON.stringify({
                subscription_id: subscription.id,
                customer_id: subscription.customer,
                updated_from: 'subscription_updated',
                subscription_status: subscription.status
            })
        });

        if (transactionResult.error) {
            logger.error('Transaction failed during subscription update:', {
                userId,
                subscriptionId: subscription.id,
                customerId: subscription.customer,
                error: transactionResult.error,
                details: transactionResult.data
            });
            // Don't throw - webhook should still return success, but log the error
            return;
        }

        logger.info('Subscription update transaction completed successfully:', {
            userId,
            subscriptionId: subscription.id,
            oldPlan: transactionResult.data?.old_plan || 'unknown',
            newPlan: transactionResult.data?.new_plan || newPlan,
            status: subscription.status,
            entitlementsUpdated: transactionResult.data?.entitlements_updated || false
        });

        // Try to use existing subscription service if available (non-critical)
        try {
            const subscriptionService = require('../services/subscriptionService');
            const result = await subscriptionService.processSubscriptionUpdate(subscription);
            
            if (!result.success) {
                logger.warn('Subscription update blocked by service:', {
                    customerId: subscription.customer,
                    reason: result.reason
                });
            } else {
                logger.info('Subscription service processed update successfully:', {
                    userId: result.userId,
                    oldPlan: result.oldPlan,
                    newPlan: result.newPlan,
                    status: result.status
                });
            }
        } catch (serviceError) {
            logger.info('Subscription service not available, using transaction result', {
                error: serviceError.message
            });
        }

    } catch (error) {
        logger.error('Failed to process subscription update:', error);
        // Don't throw - webhook should still return success
    }
}

/**
 * Handle subscription deleted event with transaction support
 * Issue #95: Added database transactions to prevent inconsistent state
 */
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    
    const { data: userSub, error: findError } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (findError || !userSub) {
        logger.error('Could not find user for customer:', customerId);
        return;
    }

    // Execute critical database operations in a transaction
    const transactionResult = await supabaseServiceClient.rpc('execute_subscription_deleted_transaction', {
        p_user_id: userSub.user_id,
        p_subscription_id: subscription.id,
        p_customer_id: customerId,
        p_canceled_at: new Date().toISOString()
    });

    if (transactionResult.error) {
        logger.error('Transaction failed during subscription deletion:', {
            userId: userSub.user_id,
            subscriptionId: subscription.id,
            customerId,
            error: transactionResult.error,
            details: transactionResult.data
        });
        throw new Error(`Subscription deletion transaction failed: ${transactionResult.error}`);
    }

    logger.info('Subscription deletion transaction completed successfully:', {
        userId: userSub.user_id,
        subscriptionId: subscription.id,
        entitlementsReset: transactionResult.data?.entitlements_reset || false
    });

    // Send subscription canceled email notification (non-critical, outside transaction)
    try {
        const customer = await stripeWrapper.customers.retrieve(customerId);
        const userEmail = customer.email;
        
        // Get the canceled plan info from transaction result
        const planConfig = PLAN_CONFIG[transactionResult.data?.previous_plan] || {};
        
        await emailService.sendSubscriptionCanceledNotification(userEmail, {
            userName: customer.name || userEmail.split('@')[0],
            planName: planConfig.name || 'Pro',
            cancellationDate: new Date().toLocaleDateString(),
            accessUntilDate: transactionResult.data?.access_until_date || new Date().toLocaleDateString(),
        });

        logger.info('📧 Cancellation email sent:', { 
            userId: userSub.user_id, 
            email: userEmail 
        });
    } catch (emailError) {
        logger.error('📧 Failed to send cancellation email:', emailError);
    }

    // Create in-app notification (non-critical, outside transaction)
    try {
        const planConfig = PLAN_CONFIG[transactionResult.data?.previous_plan] || {};
        
        await notificationService.createSubscriptionCanceledNotification(userSub.user_id, {
            planName: planConfig.name || 'Pro',
            cancellationDate: new Date().toLocaleDateString(),
            accessUntilDate: transactionResult.data?.access_until_date || new Date().toLocaleDateString(),
        });

        logger.info('📝 Cancellation notification created:', { 
            userId: userSub.user_id 
        });
    } catch (notificationError) {
        logger.error('📝 Failed to create cancellation notification:', notificationError);
    }
}

/**
 * Handle successful payment with transaction support
 * Issue #95: Added database transactions to prevent inconsistent state
 */
async function handlePaymentSucceeded(invoice) {
    const customerId = invoice.customer;
    
    const { data: userSub, error } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!error && userSub) {
        // Execute payment success operations in a transaction
        const transactionResult = await supabaseServiceClient.rpc('execute_payment_succeeded_transaction', {
            p_user_id: userSub.user_id,
            p_customer_id: customerId,
            p_invoice_id: invoice.id,
            p_amount_paid: invoice.amount_paid,
            p_payment_succeeded_at: new Date().toISOString()
        });

        if (transactionResult.error) {
            logger.error('Transaction failed during payment success:', {
                userId: userSub.user_id,
                invoiceId: invoice.id,
                customerId,
                error: transactionResult.error,
                details: transactionResult.data
            });
            throw new Error(`Payment success transaction failed: ${transactionResult.error}`);
        }

        logger.info('Payment succeeded transaction completed:', {
            userId: userSub.user_id,
            invoiceId: invoice.id,
            amount: invoice.amount_paid,
            statusUpdated: transactionResult.data?.status_updated || false
        });
    }
}

/**
 * Handle failed payment with transaction support
 * Issue #95: Added database transactions to prevent inconsistent state
 */
async function handlePaymentFailed(invoice) {
    const customerId = invoice.customer;
    
    const { data: userSub, error } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!error && userSub) {
        // Calculate next attempt date (Stripe typically retries in 3 days)
        const nextAttempt = new Date();
        nextAttempt.setDate(nextAttempt.getDate() + 3);

        // Execute payment failure operations in a transaction
        const transactionResult = await supabaseServiceClient.rpc('execute_payment_failed_transaction', {
            p_user_id: userSub.user_id,
            p_customer_id: customerId,
            p_invoice_id: invoice.id,
            p_amount_due: invoice.amount_due,
            p_attempt_count: invoice.attempt_count || 1,
            p_next_attempt_date: nextAttempt.toISOString(),
            p_payment_failed_at: new Date().toISOString()
        });

        if (transactionResult.error) {
            logger.error('Transaction failed during payment failure:', {
                userId: userSub.user_id,
                invoiceId: invoice.id,
                customerId,
                error: transactionResult.error,
                details: transactionResult.data
            });
            throw new Error(`Payment failure transaction failed: ${transactionResult.error}`);
        }

        logger.warn('Payment failed transaction completed:', {
            userId: userSub.user_id,
            invoiceId: invoice.id,
            amount: invoice.amount_due,
            statusUpdated: transactionResult.data?.status_updated || false,
            planName: transactionResult.data?.plan_name || 'unknown'
        });

        // Send payment failed email notification (non-critical, outside transaction)
        try {
            const customer = await stripeWrapper.customers.retrieve(customerId);
            const userEmail = customer.email;
            
            const planConfig = PLAN_CONFIG[transactionResult.data?.plan_name] || {};
            
            await emailService.sendPaymentFailedNotification(userEmail, {
                userName: customer.name || userEmail.split('@')[0],
                planName: planConfig.name || 'Pro',
                failedAmount: invoice.amount_due ? `€${(invoice.amount_due / 100).toFixed(2)}` : 'N/A',
                nextAttemptDate: nextAttempt.toLocaleDateString(),
            });

            logger.info('📧 Payment failed email sent:', { 
                userId: userSub.user_id, 
                email: userEmail,
                amount: invoice.amount_due 
            });
        } catch (emailError) {
            logger.error('📧 Failed to send payment failed email:', emailError);
        }

        // Create in-app notification (non-critical, outside transaction)
        try {
            const planConfig = PLAN_CONFIG[transactionResult.data?.plan_name] || {};
            
            await notificationService.createPaymentFailedNotification(userSub.user_id, {
                planName: planConfig.name || 'Pro',
                failedAmount: invoice.amount_due ? `€${(invoice.amount_due / 100).toFixed(2)}` : 'N/A',
                nextAttemptDate: nextAttempt.toLocaleDateString(),
            });

            logger.info('📝 Payment failed notification created:', { 
                userId: userSub.user_id,
                amount: invoice.amount_due 
            });
        } catch (notificationError) {
            logger.error('📝 Failed to create payment failed notification:', notificationError);
        }
    }
}

/**
 * Apply plan limits dynamically when subscription changes
 * @param {string} userId - User ID
 * @param {string} plan - New plan (free, starter, pro, plus)
 * @param {string} status - Subscription status
 */
async function applyPlanLimits(userId, plan, status) {
    const planConfig = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
    
    // If subscription is not active, apply limited access
    const isActive = status === 'active';
    const limits = isActive ? planConfig : PLAN_CONFIG.free;
    
    try {
        // Update user limits in the database
        const { error } = await supabaseServiceClient
            .from('users')
            .update({
                plan: plan,
                // Reset monthly usage if upgrading to higher plan
                monthly_messages_sent: plan !== PLAN_IDS.FREE ? 0 : undefined,
                monthly_tokens_consumed: plan !== PLAN_IDS.FREE ? 0 : undefined,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            throw error;
        }

        // Update organization limits if user is owner
        const { data: orgData, error: orgError } = await supabaseServiceClient
            .from('organizations')
            .select('id')
            .eq('owner_id', userId)
            .maybeSingle();

        if (!orgError && orgData) {
            await supabaseServiceClient
                .from('organizations')
                .update({
                    plan_id: plan,
                    subscription_status: status,
                    monthly_responses_limit: limits.maxRoasts === -1 ? 999999 : limits.maxRoasts,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orgData.id);
        }

        // Notify worker system of limit changes
        await workerNotificationService.notifyStatusChange(userId, plan, status);
        logger.info('🔄 Plan limits updated, workers notified:', {
            userId,
            plan,
            status,
            limits: {
                maxRoasts: limits.maxRoasts,
                maxPlatforms: limits.maxPlatforms
            }
        });

    } catch (error) {
        logger.error('Failed to apply plan limits:', error);
        throw error;
    }
}

module.exports = router;