/**
 * Billing routes for Stripe integration
 * Handles subscription creation, management, and webhooks
 */

const express = require('express');
const Stripe = require('stripe');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient, createUserClient } = require('../config/supabase');

const router = express.Router();

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const { lookupKey } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        if (!lookupKey) {
            return res.status(400).json({
                success: false,
                error: 'lookupKey is required'
            });
        }

        // Validate lookup key
        const validLookupKeys = [
            process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly',
            process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly'
        ];

        if (!validLookupKeys.includes(lookupKey)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid lookup key'
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
            lookup_keys: [lookupKey],
            expand: ['data.product']
        });

        if (prices.data.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Price not found for lookup key: ' + lookupKey
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
                lookup_key: lookupKey
            },
            subscription_data: {
                metadata: {
                    user_id: userId,
                    lookup_key: lookupKey
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
                url: session.url,
                sessionId: session.id
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
router.post('/create-portal-session', authenticateToken, async (req, res) => {
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
    }
}

module.exports = router;