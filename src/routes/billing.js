/**
 * Billing routes for Stripe integration
 * Handles subscription creation, management, and webhooks
 */

const express = require('express');
const Stripe = require('stripe');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient, createUserClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const workerNotificationService = require('../services/workerNotificationService');

const router = express.Router();

// Initialize Stripe with feature flag check
let stripe = null;
if (flags.isEnabled('ENABLE_BILLING')) {
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.log('⚠️ Stripe billing disabled - missing configuration keys');
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
                customer = await stripe.customers.retrieve(existingSubscription.stripe_customer_id);
            } catch (stripeError) {
                logger.warn('Failed to retrieve existing customer, creating new one:', stripeError.message);
                customer = null;
            }
        }

        // Create new customer if none exists or retrieval failed
        if (!customer) {
            customer = await stripe.customers.create({
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
        const prices = await stripe.prices.list({
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
        const session = await stripe.checkout.sessions.create({
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
        const portalSession = await stripe.billingPortal.sessions.create({
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
 * Handle Stripe webhooks for subscription events
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
        event = stripe.webhooks.constructEvent(
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
        id: event.id
    });

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                logger.info('Unhandled webhook event type:', event.type);
        }

        res.json({ received: true });

    } catch (error) {
        logger.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(session) {
    const userId = session.metadata?.user_id;
    
    if (!userId) {
        logger.error('No user_id in checkout session metadata');
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const customer = await stripe.customers.retrieve(session.customer);

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
    const customerId = subscription.customer;
    
    // Find user by customer ID
    const { data: userSub, error: findError } = await supabaseServiceClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (findError || !userSub) {
        logger.error('Could not find user for customer:', customerId);
        return;
    }

    // Determine plan from subscription items
    let plan = 'free';
    if (subscription.items?.data?.length > 0) {
        const price = subscription.items.data[0].price;
        // Look up plan by price ID or lookup key
        const prices = await stripe.prices.list({ limit: 100 });
        const priceData = prices.data.find(p => p.id === price.id);
        
        if (priceData?.lookup_key === (process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly')) {
            plan = 'pro';
        } else if (priceData?.lookup_key === (process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly')) {
            plan = 'creator_plus';
        }
    }

    // Update subscription
    const { error } = await supabaseServiceClient
        .from('user_subscriptions')
        .update({
            plan: plan,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
        })
        .eq('user_id', userSub.user_id);

    if (error) {
        logger.error('Failed to update subscription:', error);
    } else {
        logger.info('Subscription updated:', {
            userId: userSub.user_id,
            plan,
            status: subscription.status
        });

        // Send email notifications based on status changes
        try {
            const customer = await stripe.customers.retrieve(customerId);
            const userEmail = customer.email;
            const planConfig = PLAN_CONFIG[plan] || {};

            // Check if this is a plan upgrade/downgrade
            if (subscription.status === 'active') {
                // Get previous plan from database to compare
                const { data: currentSub } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .select('plan')
                    .eq('user_id', userSub.user_id)
                    .single();

                const oldPlan = currentSub?.plan || 'free';
                
                // Send upgrade notification if plan changed (and not initial activation)
                if (oldPlan !== plan && oldPlan !== 'free') {
                    const oldPlanConfig = PLAN_CONFIG[oldPlan] || {};
                    
                    await emailService.sendUpgradeSuccessNotification(userEmail, {
                        userName: customer.name || userEmail.split('@')[0],
                        oldPlanName: oldPlanConfig.name || oldPlan,
                        newPlanName: planConfig.name || plan,
                        newFeatures: planConfig.features || [],
                        activationDate: new Date().toLocaleDateString(),
                    });

                    logger.info('📧 Plan change email sent:', { 
                        userId: userSub.user_id, 
                        oldPlan, 
                        newPlan: plan,
                        email: userEmail 
                    });

                    // Create in-app notification for plan upgrade
                    try {
                        await notificationService.createUpgradeSuccessNotification(userSub.user_id, {
                            oldPlanName: oldPlanConfig.name || oldPlan,
                            newPlanName: planConfig.name || plan,
                            newFeatures: planConfig.features || [],
                            activationDate: new Date().toLocaleDateString(),
                        });

                        logger.info('📝 Plan change notification created:', { 
                            userId: userSub.user_id, 
                            oldPlan, 
                            newPlan: plan
                        });
                    } catch (notificationError) {
                        logger.error('📝 Failed to create plan change notification:', notificationError);
                    }
                }
            } else {
                // Handle subscription status changes that require notifications
                if (['past_due', 'unpaid', 'incomplete'].includes(subscription.status)) {
                    try {
                        await notificationService.createSubscriptionStatusNotification(userSub.user_id, {
                            status: subscription.status,
                            planName: planConfig.name || plan
                        });

                        logger.info('📝 Subscription status notification created:', { 
                            userId: userSub.user_id, 
                            status: subscription.status
                        });
                    } catch (notificationError) {
                        logger.error('📝 Failed to create subscription status notification:', notificationError);
                    }
                }
            }
        } catch (emailError) {
            logger.error('📧 Failed to send subscription update email:', emailError);
        }

        // Apply dynamic limits based on new plan
        try {
            await applyPlanLimits(userSub.user_id, plan, subscription.status);
            
            // Notify workers of plan changes
            const { data: currentSub } = await supabaseServiceClient
                .from('user_subscriptions')
                .select('plan')
                .eq('user_id', userSub.user_id)
                .single();

            const oldPlan = currentSub?.plan || 'free';
            if (oldPlan !== plan) {
                await workerNotificationService.notifyPlanChange(userSub.user_id, oldPlan, plan, subscription.status);
            }

            logger.info('🔄 Plan limits applied dynamically:', { 
                userId: userSub.user_id, 
                plan, 
                status: subscription.status 
            });
        } catch (limitsError) {
            logger.error('🔄 Failed to apply dynamic plan limits:', limitsError);
        }
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

        // Send subscription canceled email notification
        try {
            const customer = await stripe.customers.retrieve(customerId);
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
            const customer = await stripe.customers.retrieve(customerId);
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