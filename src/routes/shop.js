/**
 * Shop routes for addon purchases
 * Issue #260: Settings → Shop functionality
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseServiceClient } = require('../config/supabase');
const stripeWrapper = require('../services/stripeWrapper');
const { logger } = require('../utils/logger'); // Issue #618 - destructure
const flags = require('../config/flags');
const crypto = require('crypto');

// Middleware to check if shop is enabled
const requireShopEnabled = (req, res, next) => {
    if (!flags.flags.isEnabled('ENABLE_SHOP')) {
        return res.status(404).json({
            success: false,
            error: 'Shop functionality is not available'
        });
    }
    next();
};

// Zero decimal currencies (amounts are in the smallest unit, not cents)
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'
]);

const formatPrice = (minor, currency = 'USD') => {
  const cur = (currency || 'USD').toUpperCase();
  const amount = ZERO_DECIMAL_CURRENCIES.has(cur) ? minor : minor / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
};


/**
 * GET /api/shop/addons
 * Get list of available shop addons
 */
router.get('/addons', requireShopEnabled, authenticateToken, async (req, res) => {
    try {
        const { data: addons, error } = await supabaseServiceClient
            .from('shop_addons')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            logger.error('Failed to fetch shop addons:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch addons'
            });
        }

        // Group addons by category for better frontend organization
        const groupedAddons = addons.reduce((acc, addon) => {
            if (!acc[addon.category]) {
                acc[addon.category] = [];
            }
            acc[addon.category].push({
                id: addon.id,
                key: addon.addon_key,
                name: addon.name,
                description: addon.description,
                price: {
                    cents: addon.price_cents,
                    currency: addon.currency,
                    formatted: formatPrice(addon.price_cents, addon.currency)
                },
                type: addon.addon_type,
                creditAmount: addon.credit_amount,
                featureKey: addon.feature_key
            });
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                addons: groupedAddons,
                categories: {
                    roasts: 'Roasts Extra',
                    analysis: 'Análisis Extra',
                    features: 'Funcionalidades'
                }
            }
        });

    } catch (error) {
        logger.error('Shop addons error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/shop/user/addons
 * Get user's current addon status and credits
 */
router.get('/user/addons', requireShopEnabled, authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's addon credits by category
        const { data: roastCredits, error: roastCreditsError } = await supabaseServiceClient
            .rpc('get_user_addon_credits', {
                p_user_id: userId,
                p_addon_category: 'roasts'
            });

        if (roastCreditsError) {
            logger.error('Failed to fetch roast credits:', roastCreditsError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch user roast credits'
            });
        }

        const { data: analysisCredits, error: analysisCreditsError } = await supabaseServiceClient
            .rpc('get_user_addon_credits', {
                p_user_id: userId,
                p_addon_category: 'analysis'
            });

        if (analysisCreditsError) {
            logger.error('Failed to fetch analysis credits:', analysisCreditsError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch user analysis credits'
            });
        }

        // Check active feature addons
        const { data: rqcEnabled, error: rqcError } = await supabaseServiceClient
            .rpc('user_has_feature_addon', {
                p_user_id: userId,
                p_feature_key: 'rqc_enabled'
            });

        if (rqcError) {
            logger.error('Failed to check RQC feature status:', rqcError);
            return res.status(500).json({
                success: false,
                error: 'Failed to check feature status'
            });
        }


        // Get recent purchases
        const { data: recentPurchases, error: purchasesError } = await supabaseServiceClient
            .from('addon_purchase_history')
            .select(`
                addon_key,
                amount_cents,
                currency,
                status,
                completed_at,
                created_at
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (purchasesError) {
            logger.error('Failed to fetch user purchases:', purchasesError);
        }

        res.json({
            success: true,
            data: {
                credits: {
                    roasts: roastCredits || 0,
                    analysis: analysisCredits || 0
                },
                features: {
                    rqc_enabled: rqcEnabled || false
                },
                recentPurchases: recentPurchases || []
            }
        });

    } catch (error) {
        logger.error('User addons error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * POST /api/shop/checkout
 * Create Stripe checkout session for addon purchase
 */
router.post('/checkout', requireShopEnabled, authenticateToken, async (req, res) => {
    try {
        const { addonKey } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        if (!addonKey) {
            return res.status(400).json({
                success: false,
                error: 'Addon key is required'
            });
        }

        // Get addon details
        const { data: addon, error: addonError } = await supabaseServiceClient
            .from('shop_addons')
            .select('*')
            .eq('addon_key', addonKey)
            .eq('is_active', true)
            .single();

        if (addonError || !addon) {
            return res.status(404).json({
                success: false,
                error: 'Addon not found'
            });
        }

        // Get or create Stripe customer
        let customer;
        const { data: userSub } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', userId)
            .single();

        if (userSub?.stripe_customer_id) {
            try {
                customer = await stripeWrapper.customers.retrieve(userSub.stripe_customer_id);
            } catch (error) {
                logger.warn('Failed to retrieve existing customer:', error.message);
                customer = null;
            }
        }

        if (!customer) {
            customer = await stripeWrapper.customers.create({
                email: userEmail,
                metadata: { user_id: userId }
            });

            // Update user_subscriptions with customer ID only
            await supabaseServiceClient
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    stripe_customer_id: customer.id
                }, {
                    onConflict: 'user_id'
                });
        }

        // Validate FRONTEND_URL before creating session
        if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.trim() === '') {
            logger.error('FRONTEND_URL is not configured');
            return res.status(500).json({
                success: false,
                error: 'FRONTEND_URL is not configured'
            });
        }

        // Validate FRONTEND_URL format
        try {
            new URL(process.env.FRONTEND_URL);
        } catch (urlError) {
            logger.error('FRONTEND_URL is not a valid URL:', process.env.FRONTEND_URL);
            return res.status(500).json({
                success: false,
                error: 'FRONTEND_URL is not configured properly'
            });
        }

        // Get or generate idempotency key for Stripe session creation
        let idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
        // Use provided key (truncated) or fall back to a random UUID
        idempotencyKey = idempotencyKey
            ? String(idempotencyKey).slice(0, 255)
            : crypto.randomUUID();
        logger.debug('Using idempotency key for checkout session', { userId, addonKey: addon.addon_key });

        // Create checkout session for one-time payment
        const session = await stripeWrapper.checkout.sessions.create({
            customer: customer.id,
            automatic_payment_methods: { enabled: true },
            mode: 'payment', // One-time payment for addons
            line_items: [{
                price_data: {
                    currency: addon.currency.toLowerCase(),
                    product_data: {
                        name: addon.name,
                        description: addon.description,
                        metadata: {
                            addon_key: addon.addon_key,
                            category: addon.category,
                            type: addon.addon_type
                        }
                    },
                    unit_amount: addon.price_cents
                },
                quantity: 1
            }],
            success_url: `${process.env.FRONTEND_URL}/settings?tab=shop&success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/settings?tab=shop&canceled=true`,
            metadata: {
                user_id: userId,
                addon_key: addon.addon_key,
                addon_type: addon.addon_type,
                credit_amount: addon.credit_amount?.toString() || '0',
                feature_key: addon.feature_key || ''
            }
        }, {
            idempotencyKey: idempotencyKey
        });

        // Record purchase initiation
        const { data: insertData, error: insertError } = await supabaseServiceClient
            .from('addon_purchase_history')
            .insert({
                user_id: userId,
                addon_key: addon.addon_key,
                stripe_checkout_session_id: session.id,
                amount_cents: addon.price_cents,
                currency: addon.currency,
                status: 'pending'
            })
            .select(); // Return the inserted row(s)

        // Check for database insert errors
        if (insertError || !insertData || insertData.length === 0) {
            logger.error('Failed to record purchase initiation:', insertError);
            return res.status(500).json({
                success: false,
                error: 'Failed to record purchase initiation'
            });
        }

        logger.info('Addon checkout session created:', {
            userId,
            addonKey,
            sessionId: session.id,
            amount: addon.price_cents
        });

        res.json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url
            }
        });

    } catch (error) {
        logger.error('Shop checkout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create checkout session'
        });
    }
});

module.exports = router;
