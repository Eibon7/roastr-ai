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

// Plan configuration
const PLAN_CONFIG = {
    free: {
        name: 'Free',
        price: 0,
        currency: 'eur',
        description: 'Perfect for getting started',
        features: ['100 roasts per month', '1 platform integration', 'Basic support'],
        maxPlatforms: 1,
        maxRoasts: 100
    },
    pro: {
        name: 'Pro',
        price: 2000, // €20.00 in cents
        currency: 'eur',
        description: 'Best for regular users',
        features: ['1,000 roasts per month', '5 platform integrations', 'Priority support', 'Advanced analytics'],
        maxPlatforms: 5,
        maxRoasts: 1000,
        lookupKey: process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly'
    },
    creator_plus: {
        name: 'Creator+',
        price: 5000, // €50.00 in cents
        currency: 'eur', 
        description: 'For power users and creators',
        features: ['Unlimited roasts', 'All platform integrations', '24/7 support', 'Custom tones', 'API access'],
        maxPlatforms: -1,
        maxRoasts: -1,
        lookupKey: process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly'
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
                'pro': process.env.STRIPE_PRICE_LOOKUP_PRO || 'plan_pro',
                'creator_plus': process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'plan_creator_plus'
            };
            targetLookupKey = planLookupMap[plan];
        }

        if (!targetLookupKey) {
            return res.status(400).json({
                success: false,
                error: 'plan is required (free|pro|creator_plus)'
            });
        }

        // Free plan doesn't require Stripe
        if (plan === 'free') {
            return res.json({
                success: true,
                data: {
                    message: 'Free plan activated',
                    plan: 'free'
                }
            });
        }

        // Validate lookup key
        const validLookupKeys = [
            process.env.STRIPE_PRICE_LOOKUP_PRO || 'plan_pro',
            process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'plan_creator_plus'
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
                    plan: 'free', // Keep as free until checkout completes
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
        const planConfig = PLAN_CONFIG[subscription?.plan || 'free'];

        res.json({
            success: true,
            data: {
                subscription: subscription || {
                    user_id: userId,
                    plan: 'free',
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
 * Handle Stripe webhooks for subscription events with idempotency
 */
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    // Early return if billing is disabled
    if (!flags.isEnabled('ENABLE_BILLING')) {
        logger.warn('Webhook received but billing is disabled');
        return res.status(503).json({ error: 'Billing temporarily unavailable' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature
        event = stripeWrapper.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        logger.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    logger.info('Stripe webhook received:', {
        type: event.type,
        id: event.id,
        created: event.created
    });

    try {
        // Process event using the new webhook service with idempotency
        const result = await webhookService.processWebhookEvent(event);

        if (result.success) {
            logger.info('Webhook processed successfully:', {
                eventId: event.id,
                eventType: event.type,
                idempotent: result.idempotent,
                processingTime: result.processingTimeMs
            });
        } else {
            logger.error('Webhook processing failed:', {
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
            message: result.message || 'Event processed'
        });

    } catch (error) {
        logger.error('Critical webhook processing error:', {
            eventId: event.id,
            eventType: event.type,
            error: error.message,
            stack: error.stack
        });

        // Still return 200 to prevent Stripe from retrying
        res.json({ 
            received: true,
            processed: false,
            error: 'Processing failed but acknowledged'
        });
    }
});

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
                let newPlan = 'free';
                if (webhookData.items?.data?.length > 0) {
                    const price = webhookData.items.data[0].price;
                    const prices = await stripeWrapper.prices.list({ limit: 100 });
                    const priceData = prices.data.find(p => p.id === price.id);
                    
                    if (priceData?.lookup_key === (process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly')) {
                        newPlan = 'pro';
                    } else if (priceData?.lookup_key === (process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly')) {
                        newPlan = 'creator_plus';
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
 * Handle checkout.session.completed event
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
    
    // Determine plan from price lookup key or metadata
    let plan = 'free';
    const lookupKey = session.metadata?.lookup_key;
    
    if (lookupKey === (process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly')) {
        plan = 'pro';
    } else if (lookupKey === (process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly')) {
        plan = 'creator_plus';
    }

    // Update subscription in database
    const { error } = await supabaseServiceClient
        .from('user_subscriptions')
        .upsert({
            user_id: userId,
            stripe_customer_id: customer.id,
            stripe_subscription_id: subscription.id,
            plan: plan,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
        });

    if (error) {
        logger.error('Failed to update subscription after checkout:', error);
    } else {
        logger.info('Subscription created/updated after checkout:', {
            userId,
            plan,
            subscriptionId: subscription.id
        });

        // Update entitlements based on Stripe Price metadata
        if (entitlementsService && priceId) {
            try {
                const entitlementsResult = await entitlementsService.setEntitlementsFromStripePrice(
                    userId, 
                    priceId,
                    {
                        metadata: {
                            subscription_id: subscription.id,
                            customer_id: customer.id,
                            checkout_session_id: session.id,
                            updated_from: 'checkout_completed'
                        }
                    }
                );

                if (entitlementsResult.success) {
                    logger.info('Entitlements updated after checkout completion', {
                        userId,
                        priceId,
                        planName: entitlementsResult.entitlements.plan_name,
                        analysisLimit: entitlementsResult.entitlements.analysis_limit_monthly,
                        roastLimit: entitlementsResult.entitlements.roast_limit_monthly
                    });
                } else {
                    logger.error('Failed to update entitlements after checkout', {
                        userId,
                        priceId,
                        error: entitlementsResult.error,
                        fallbackApplied: entitlementsResult.fallback_applied
                    });
                }
            } catch (entitlementsError) {
                logger.error('Exception updating entitlements after checkout', {
                    userId,
                    priceId,
                    error: entitlementsError.message
                });
            }
        }

        // Send upgrade success email notification
        if (plan !== 'free') {
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

            // Create in-app notification
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
}

/**
 * Handle subscription updated event
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

        // Update entitlements based on new subscription
        if (entitlementsService && subscription.items?.data?.[0]?.price?.id) {
            const priceId = subscription.items.data[0].price.id;
            
            try {
                const entitlementsResult = await entitlementsService.setEntitlementsFromStripePrice(
                    userId, 
                    priceId,
                    {
                        metadata: {
                            subscription_id: subscription.id,
                            customer_id: subscription.customer,
                            updated_from: 'subscription_updated',
                            subscription_status: subscription.status
                        }
                    }
                );

                if (entitlementsResult.success) {
                    logger.info('Entitlements updated after subscription update', {
                        userId,
                        subscriptionId: subscription.id,
                        priceId,
                        planName: entitlementsResult.entitlements.plan_name,
                        status: subscription.status
                    });
                } else {
                    logger.error('Failed to update entitlements after subscription update', {
                        userId,
                        subscriptionId: subscription.id,
                        priceId,
                        error: entitlementsResult.error
                    });
                }
            } catch (entitlementsError) {
                logger.error('Exception updating entitlements after subscription update', {
                    userId,
                    subscriptionId: subscription.id,
                    error: entitlementsError.message
                });
            }
        }

        // Try to use existing subscription service if available
        try {
            const subscriptionService = require('../services/subscriptionService');
            const result = await subscriptionService.processSubscriptionUpdate(subscription);
            
            if (!result.success) {
                logger.warn('Subscription update blocked:', {
                    customerId: subscription.customer,
                    reason: result.reason
                });
            } else {
                logger.info('Subscription update processed successfully:', {
                    userId: result.userId,
                    oldPlan: result.oldPlan,
                    newPlan: result.newPlan,
                    status: result.status
                });
            }
        } catch (serviceError) {
            logger.info('Subscription service not available, using basic update logic', {
                error: serviceError.message
            });
        }

    } catch (error) {
        logger.error('Failed to process subscription update:', error);
        // Don't throw - webhook should still return success
    }
}

/**
 * Handle subscription deleted event
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

    // Reset to free plan
    const { error } = await supabaseServiceClient
        .from('user_subscriptions')
        .update({
            plan: 'free',
            status: 'canceled',
            stripe_subscription_id: null,
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
            trial_end: null
        })
        .eq('user_id', userSub.user_id);

    if (error) {
        logger.error('Failed to reset subscription to free:', error);
    } else {
        logger.info('Subscription reset to free:', {
            userId: userSub.user_id
        });

        // Reset entitlements to free plan
        if (entitlementsService) {
            try {
                const entitlementsResult = await entitlementsService.setEntitlements(
                    userSub.user_id,
                    {
                        analysis_limit_monthly: 100,
                        roast_limit_monthly: 100,
                        model: 'gpt-3.5-turbo',
                        shield_enabled: false,
                        rqc_mode: 'basic',
                        stripe_price_id: null,
                        stripe_product_id: null,
                        plan_name: 'free',
                        metadata: {
                            updated_from: 'subscription_canceled',
                            subscription_id: subscription.id,
                            customer_id: customerId,
                            canceled_at: new Date().toISOString()
                        }
                    }
                );

                if (entitlementsResult.success) {
                    logger.info('Entitlements reset to free plan after cancellation', {
                        userId: userSub.user_id,
                        subscriptionId: subscription.id
                    });
                } else {
                    logger.error('Failed to reset entitlements to free plan', {
                        userId: userSub.user_id,
                        subscriptionId: subscription.id,
                        error: entitlementsResult.error
                    });
                }
            } catch (entitlementsError) {
                logger.error('Exception resetting entitlements to free plan', {
                    userId: userSub.user_id,
                    subscriptionId: subscription.id,
                    error: entitlementsError.message
                });
            }
        }

        // Send subscription canceled email notification
        try {
            const customer = await stripeWrapper.customers.retrieve(customerId);
            const userEmail = customer.email;
            
            // Get the canceled plan info
            const { data: canceledSub } = await supabaseServiceClient
                .from('user_subscriptions')
                .select('plan, current_period_end')
                .eq('user_id', userSub.user_id)
                .single();

            const planConfig = PLAN_CONFIG[canceledSub?.plan] || {};
            
            await emailService.sendSubscriptionCanceledNotification(userEmail, {
                userName: customer.name || userEmail.split('@')[0],
                planName: planConfig.name || 'Pro',
                cancellationDate: new Date().toLocaleDateString(),
                accessUntilDate: canceledSub?.current_period_end ? 
                    new Date(canceledSub.current_period_end).toLocaleDateString() : 
                    new Date().toLocaleDateString(),
            });

            logger.info('📧 Cancellation email sent:', { 
                userId: userSub.user_id, 
                email: userEmail 
            });
        } catch (emailError) {
            logger.error('📧 Failed to send cancellation email:', emailError);
        }

        // Create in-app notification
        try {
            await notificationService.createSubscriptionCanceledNotification(userSub.user_id, {
                planName: planConfig.name || 'Pro',
                cancellationDate: new Date().toLocaleDateString(),
                accessUntilDate: canceledSub?.current_period_end ? 
                    new Date(canceledSub.current_period_end).toLocaleDateString() : 
                    new Date().toLocaleDateString(),
            });

            logger.info('📝 Cancellation notification created:', { 
                userId: userSub.user_id 
            });
        } catch (notificationError) {
            logger.error('📝 Failed to create cancellation notification:', notificationError);
        }
    }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
    const customerId = invoice.customer;
    
    const { data: userSub, error } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!error && userSub) {
        // Update subscription status to active if it was past_due
        await supabaseServiceClient
            .from('user_subscriptions')
            .update({ status: 'active' })
            .eq('user_id', userSub.user_id)
            .eq('status', 'past_due');

        logger.info('Payment succeeded for user:', userSub.user_id);
    }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
    const customerId = invoice.customer;
    
    const { data: userSub, error } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!error && userSub) {
        // Mark subscription as past_due
        await supabaseServiceClient
            .from('user_subscriptions')
            .update({ status: 'past_due' })
            .eq('user_id', userSub.user_id);

        logger.warn('Payment failed for user:', userSub.user_id);

        // Send payment failed email notification
        try {
            const customer = await stripeWrapper.customers.retrieve(customerId);
            const userEmail = customer.email;
            
            // Get subscription details
            const { data: currentSub } = await supabaseServiceClient
                .from('user_subscriptions')
                .select('plan, current_period_end')
                .eq('user_id', userSub.user_id)
                .single();

            const planConfig = PLAN_CONFIG[currentSub?.plan] || {};
            
            // Calculate next attempt date (Stripe typically retries in 3 days)
            const nextAttempt = new Date();
            nextAttempt.setDate(nextAttempt.getDate() + 3);
            
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

        // Create in-app notification
        try {
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
 * @param {string} plan - New plan (free, pro, creator_plus)
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
                monthly_messages_sent: plan !== 'free' ? 0 : undefined,
                monthly_tokens_consumed: plan !== 'free' ? 0 : undefined,
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