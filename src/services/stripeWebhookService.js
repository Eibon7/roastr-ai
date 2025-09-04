/**
 * Stripe Webhook Service - Issue #169
 * 
 * Handles Stripe webhook events with idempotency, customer mapping,
 * and automatic entitlements updates.
 */

const { supabaseServiceClient } = require('../config/supabase');
const EntitlementsService = require('./entitlementsService');
const StripeWrapper = require('./stripeWrapper');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class StripeWebhookService {
    constructor() {
        this.entitlementsService = new EntitlementsService();
        this.stripeWrapper = null;
        
        if (flags.isEnabled('ENABLE_BILLING')) {
            this.stripeWrapper = new StripeWrapper(process.env.STRIPE_SECRET_KEY);
        }
    }

    /**
     * Process a Stripe webhook event with idempotency
     * @param {Object} event - Stripe event object
     * @returns {Promise<Object>} Processing result
     */
    async processWebhookEvent(event) {
        const startTime = Date.now();
        
        try {
            // Check if event has already been processed (idempotency)
            const { data: isProcessed } = await supabaseServiceClient
                .rpc('is_webhook_event_processed', { event_id: event.id });

            if (isProcessed) {
                logger.info('Webhook event already processed (idempotent)', {
                    eventId: event.id,
                    eventType: event.type
                });
                
                return {
                    success: true,
                    message: 'Event already processed',
                    idempotent: true
                };
            }

            // Extract customer and subscription IDs for tracking
            const customerID = this._extractCustomerID(event);
            const subscriptionID = this._extractSubscriptionID(event);

            // Record start of processing
            const { data: webhookId } = await supabaseServiceClient
                .rpc('start_webhook_event_processing', {
                    event_id: event.id,
                    event_type_param: event.type,
                    event_data_param: event,
                    customer_id_param: customerID,
                    subscription_id_param: subscriptionID
                });

            logger.info('Processing webhook event', {
                eventId: event.id,
                eventType: event.type,
                webhookId,
                customerID,
                subscriptionID
            });

            let result;
            
            // Route to appropriate handler
            switch (event.type) {
                case 'checkout.session.completed':
                    // Check if this is an addon purchase or subscription
                    if (event.data.object?.mode === 'payment' && event.data.object?.metadata?.addon_key) {
                        result = await this._handleAddonPurchaseCompleted(event.data.object);
                    } else {
                        result = await this._handleCheckoutCompleted(event.data.object);
                    }
                    break;

                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    result = await this._handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    result = await this._handleSubscriptionDeleted(event.data.object);
                    break;

                case 'invoice.payment_succeeded':
                    result = await this._handlePaymentSucceeded(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    result = await this._handlePaymentFailed(event.data.object);
                    break;

                default:
                    logger.info('Unhandled webhook event type', {
                        eventId: event.id,
                        eventType: event.type
                    });

                    result = {
                        success: true,
                        message: 'Event type not handled',
                        handled: false
                    };
            }

            // Record successful completion
            await supabaseServiceClient
                .rpc('complete_webhook_event_processing', {
                    event_id: event.id,
                    success: result.success,
                    result_data: result,
                    account_id_param: result.accountId
                });

            const processingTime = Date.now() - startTime;
            
            logger.info('Webhook event processed successfully', {
                eventId: event.id,
                eventType: event.type,
                processingTimeMs: processingTime,
                result
            });

            return {
                ...result,
                processingTimeMs: processingTime,
                idempotent: false
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            logger.error('Webhook event processing failed', {
                eventId: event.id,
                eventType: event.type,
                processingTimeMs: processingTime,
                error: error.message,
                stack: error.stack
            });

            // Record failure
            try {
                await supabaseServiceClient
                    .rpc('complete_webhook_event_processing', {
                        event_id: event.id,
                        success: false,
                        error_msg: error.message
                    });
            } catch (recordError) {
                logger.error('Failed to record webhook failure', {
                    eventId: event.id,
                    recordError: recordError.message
                });
            }

            return {
                success: false,
                error: error.message,
                processingTimeMs: processingTime
            };
        }
    }

    /**
     * Handle checkout.session.completed event
     * @private
     */
    async _handleCheckoutCompleted(session) {
        try {
            const userId = session.metadata?.user_id;
            const customerId = session.customer;
            
            if (!userId) {
                throw new Error('No user_id in checkout session metadata');
            }

            // Get subscription details to extract price and plan information
            const subscription = await this.stripeWrapper.subscriptions.retrieve(
                session.subscription,
                { expand: ['items.data.price'] }
            );

            const priceId = subscription.items?.data?.[0]?.price?.id;
            
            if (!priceId) {
                throw new Error('No price ID found in subscription');
            }

            // Determine plan from lookup key
            const lookupKey = session.metadata?.lookup_key;
            let plan = 'free';
            
            if (lookupKey === (process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly')) {
                plan = 'pro';
            } else if (lookupKey === (process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly')) {
                plan = 'creator_plus';
            }

            // Execute atomic transaction for checkout completion
            const { data: transactionResult, error: transactionError } = await supabaseServiceClient
                .rpc('execute_checkout_completed_transaction', {
                    p_user_id: userId,
                    p_stripe_customer_id: customerId,
                    p_stripe_subscription_id: subscription.id,
                    p_plan: plan,
                    p_status: subscription.status,
                    p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                    p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                    p_cancel_at_period_end: subscription.cancel_at_period_end,
                    p_trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                    p_price_id: priceId,
                    p_metadata: {
                        source: 'checkout_completed',
                        session_id: session.id,
                        lookup_key: lookupKey
                    }
                });

            if (transactionError) {
                logger.error('Transaction failed during checkout completion:', {
                    userId,
                    subscriptionId: subscription.id,
                    error: transactionError,
                    details: transactionResult
                });
                
                return {
                    success: false,
                    accountId: userId,
                    message: 'Checkout completion transaction failed',
                    error: transactionError
                };
            }

            const success = transactionResult?.subscription_updated && transactionResult?.entitlements_updated;

            if (!success) {
                logger.warn('Checkout completion partially succeeded', {
                    userId,
                    subscriptionId: subscription.id,
                    result: transactionResult
                });
            }

            return {
                success: true,
                accountId: userId,
                message: 'Checkout completed with atomic transaction',
                entitlementsUpdated: transactionResult?.entitlements_updated || false,
                planName: transactionResult?.plan_name || plan,
                transactionResult
            };

        } catch (error) {
            throw new Error(`Checkout completion failed: ${error.message}`);
        }
    }

    /**
     * Handle addon purchase completion
     * @private
     */
    async _handleAddonPurchaseCompleted(session) {
        try {
            const userId = session.metadata.user_id;
            const addonKey = session.metadata.addon_key;
            const addonType = session.metadata.addon_type;
            const creditAmount = parseInt(session.metadata.credit_amount) || 0;
            const featureKey = session.metadata.feature_key || null;

            if (!userId || !addonKey) {
                throw new Error('Missing required metadata for addon purchase');
            }

            logger.info('Processing addon purchase completion', {
                sessionId: session.id,
                userId,
                addonKey,
                addonType,
                creditAmount
            });

            // Validate and extract payment intent ID
            let paymentIntentId;
            if (!session.payment_intent) {
                logger.error('Missing payment_intent in checkout session', {
                    sessionId: session.id,
                    userId,
                    addonKey,
                    metadata: session.metadata
                });
                throw new Error('Payment intent is required for addon purchase completion');
            }

            // Extract payment intent ID (handle both string and object formats)
            if (typeof session.payment_intent === 'string') {
                paymentIntentId = session.payment_intent;
            } else if (typeof session.payment_intent === 'object' && session.payment_intent.id) {
                paymentIntentId = session.payment_intent.id;
            } else {
                logger.error('Invalid payment_intent format in checkout session', {
                    sessionId: session.id,
                    userId,
                    addonKey,
                    paymentIntentType: typeof session.payment_intent,
                    paymentIntentValue: session.payment_intent
                });
                throw new Error('Payment intent must be a string or object with id property');
            }

            // Validate amount_total
            const amountCents = session.amount_total;
            if (typeof amountCents !== 'number' || amountCents <= 0) {
                logger.error('Invalid amount_total in checkout session', {
                    sessionId: session.id,
                    userId,
                    addonKey,
                    amountTotal: session.amount_total,
                    amountType: typeof session.amount_total
                });
                throw new Error('Invalid payment amount in checkout session');
            }

            // Execute atomic transaction for addon purchase
            const { data: transactionResult, error: transactionError } = await supabaseServiceClient
                .rpc('execute_addon_purchase_transaction', {
                    p_user_id: userId,
                    p_addon_key: addonKey,
                    p_stripe_payment_intent_id: paymentIntentId,
                    p_stripe_checkout_session_id: session.id,
                    p_amount_cents: amountCents,
                    p_addon_type: addonType,
                    p_credit_amount: creditAmount,
                    p_feature_key: featureKey
                });

            if (transactionError) {
                logger.error('Addon purchase transaction failed:', {
                    userId,
                    addonKey,
                    sessionId: session.id,
                    error: transactionError
                });

                // Update purchase history as failed
                await supabaseServiceClient
                    .from('addon_purchase_history')
                    .update({
                        status: 'failed',
                        failed_at: new Date().toISOString(),
                        error_message: transactionError.message,
                        stripe_payment_intent_id: paymentIntentId
                    })
                    .eq('stripe_checkout_session_id', session.id);

                return {
                    success: false,
                    accountId: userId,
                    message: 'Addon purchase transaction failed',
                    error: transactionError
                };
            }

            logger.info('Addon purchase completed successfully', {
                userId,
                addonKey,
                sessionId: session.id,
                creditsAdded: creditAmount,
                featureActivated: featureKey
            });

            return {
                success: true,
                accountId: userId,
                message: 'Addon purchase completed successfully',
                addonKey,
                creditsAdded: creditAmount,
                featureActivated: featureKey,
                transactionResult
            };

        } catch (error) {
            throw new Error(`Addon purchase completion failed: ${error.message}`);
        }
    }

    /**
     * Handle subscription created/updated event
     * @private
     */
    async _handleSubscriptionUpdated(subscription) {
        try {
            const customerId = subscription.customer;
            const subscriptionId = subscription.id;
            
            // Find user by customer ID
            const userId = await this._findUserByCustomerId(customerId);
            
            if (!userId) {
                throw new Error(`No user found for customer ID: ${customerId}`);
            }

            // Get price from subscription
            const priceId = subscription.items?.data?.[0]?.price?.id;
            
            if (!priceId) {
                // If no price, might be a free plan or canceled subscription
                logger.warn('No price ID in subscription update', {
                    subscriptionId,
                    customerId,
                    status: subscription.status
                });
                
                // If subscription is canceled/incomplete, reset to free plan
                if (['canceled', 'incomplete_expired'].includes(subscription.status)) {
                    return await this._resetToFreePlan(userId, 'subscription_status_changed');
                }
                
                return {
                    success: true,
                    accountId: userId,
                    message: 'No price found, no entitlements update needed'
                };
            }

            // Get price details to determine plan
            const prices = await this.stripeWrapper.prices.list({ limit: 100 });
            const priceData = prices.data.find(p => p.id === priceId);
            
            let plan = 'free';
            if (priceData?.lookup_key === (process.env.STRIPE_PRICE_LOOKUP_PRO || 'pro_monthly')) {
                plan = 'pro';
            } else if (priceData?.lookup_key === (process.env.STRIPE_PRICE_LOOKUP_CREATOR || 'creator_plus_monthly')) {
                plan = 'creator_plus';
            }

            // Execute atomic transaction for subscription update
            const { data: transactionResult, error: transactionError } = await supabaseServiceClient
                .rpc('execute_subscription_updated_transaction', {
                    p_user_id: userId,
                    p_subscription_id: subscriptionId,
                    p_customer_id: customerId,
                    p_plan: plan,
                    p_status: subscription.status,
                    p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                    p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                    p_cancel_at_period_end: subscription.cancel_at_period_end,
                    p_trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                    p_price_id: priceId,
                    p_metadata: {
                        source: 'subscription_updated',
                        subscription_status: subscription.status,
                        lookup_key: priceData?.lookup_key
                    }
                });

            if (transactionError) {
                logger.error('Transaction failed during subscription update:', {
                    userId,
                    subscriptionId,
                    error: transactionError,
                    details: transactionResult
                });
                
                return {
                    success: false,
                    accountId: userId,
                    message: 'Subscription update transaction failed',
                    error: transactionError
                };
            }

            return {
                success: true,
                accountId: userId,
                message: 'Subscription updated with atomic transaction',
                entitlementsUpdated: transactionResult?.entitlements_updated || false,
                planName: transactionResult?.new_plan || plan,
                oldPlan: transactionResult?.old_plan,
                subscriptionStatus: subscription.status,
                transactionResult
            };

        } catch (error) {
            throw new Error(`Subscription update failed: ${error.message}`);
        }
    }

    /**
     * Handle subscription deleted event
     * @private
     */
    async _handleSubscriptionDeleted(subscription) {
        try {
            const customerId = subscription.customer;
            const subscriptionId = subscription.id;
            
            // Find user by customer ID
            const userId = await this._findUserByCustomerId(customerId);
            
            if (!userId) {
                throw new Error(`No user found for customer ID: ${customerId}`);
            }

            // Execute atomic transaction for subscription deletion
            const { data: transactionResult, error: transactionError } = await supabaseServiceClient
                .rpc('execute_subscription_deleted_transaction', {
                    p_user_id: userId,
                    p_subscription_id: subscriptionId,
                    p_customer_id: customerId,
                    p_canceled_at: new Date().toISOString()
                });

            if (transactionError) {
                logger.error('Transaction failed during subscription deletion:', {
                    userId,
                    subscriptionId,
                    error: transactionError,
                    details: transactionResult
                });
                
                return {
                    success: false,
                    accountId: userId,
                    message: 'Subscription deletion transaction failed',
                    error: transactionError
                };
            }

            return {
                success: true,
                accountId: userId,
                message: 'Subscription deleted with atomic transaction',
                entitlementsReset: transactionResult?.entitlements_reset || false,
                previousPlan: transactionResult?.previous_plan || 'unknown',
                accessUntilDate: transactionResult?.access_until_date,
                planName: 'free',
                transactionResult
            };

        } catch (error) {
            throw new Error(`Subscription deletion failed: ${error.message}`);
        }
    }

    /**
     * Handle payment succeeded event
     * @private
     */
    async _handlePaymentSucceeded(invoice) {
        try {
            const customerId = invoice.customer;
            
            // Find user by customer ID
            const userId = await this._findUserByCustomerId(customerId);
            
            if (!userId) {
                // Log but don't fail - payment succeeded events are important for Stripe
                logger.warn('Payment succeeded for unknown customer', {
                    customerId,
                    invoiceId: invoice.id,
                    amount: invoice.amount_paid
                });
                
                return {
                    success: true,
                    message: 'Payment succeeded for unknown customer'
                };
            }

            // Execute atomic transaction for payment success
            const { data: transactionResult, error: transactionError } = await supabaseServiceClient
                .rpc('execute_payment_succeeded_transaction', {
                    p_user_id: userId,
                    p_customer_id: customerId,
                    p_invoice_id: invoice.id,
                    p_amount_paid: invoice.amount_paid,
                    p_payment_succeeded_at: new Date().toISOString()
                });

            if (transactionError) {
                logger.error('Transaction failed during payment success:', {
                    userId,
                    invoiceId: invoice.id,
                    error: transactionError,
                    details: transactionResult
                });
                
                return {
                    success: false,
                    accountId: userId,
                    message: 'Payment success transaction failed',
                    error: transactionError
                };
            }

            return {
                success: true,
                accountId: userId,
                message: 'Payment succeeded with atomic transaction',
                statusUpdated: transactionResult?.status_updated || false,
                invoiceId: invoice.id,
                amount: invoice.amount_paid,
                transactionResult
            };

        } catch (error) {
            throw new Error(`Payment success handling failed: ${error.message}`);
        }
    }

    /**
     * Handle payment failed event
     * @private
     */
    async _handlePaymentFailed(invoice) {
        try {
            const customerId = invoice.customer;
            
            // Find user by customer ID
            const userId = await this._findUserByCustomerId(customerId);
            
            if (!userId) {
                logger.warn('Payment failed for unknown customer', {
                    customerId,
                    invoiceId: invoice.id,
                    amount: invoice.amount_due
                });
                
                return {
                    success: true,
                    message: 'Payment failed for unknown customer'
                };
            }

            // Execute atomic transaction for payment failure
            const { data: transactionResult, error: transactionError } = await supabaseServiceClient
                .rpc('execute_payment_failed_transaction', {
                    p_user_id: userId,
                    p_customer_id: customerId,
                    p_invoice_id: invoice.id,
                    p_amount_due: invoice.amount_due,
                    p_attempt_count: invoice.attempt_count || 0,
                    p_next_attempt_date: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null,
                    p_payment_failed_at: new Date().toISOString()
                });

            if (transactionError) {
                logger.error('Transaction failed during payment failure:', {
                    userId,
                    invoiceId: invoice.id,
                    error: transactionError,
                    details: transactionResult
                });
                
                return {
                    success: false,
                    accountId: userId,
                    message: 'Payment failure transaction failed',
                    error: transactionError
                };
            }

            return {
                success: true,
                accountId: userId,
                message: 'Payment failed with atomic transaction',
                statusUpdated: transactionResult?.status_updated || false,
                planName: transactionResult?.plan_name || 'unknown',
                invoiceId: invoice.id,
                amount: invoice.amount_due,
                attemptCount: invoice.attempt_count,
                transactionResult
            };

        } catch (error) {
            throw new Error(`Payment failure handling failed: ${error.message}`);
        }
    }

    /**
     * Find user by Stripe customer ID
     * @private
     */
    async _findUserByCustomerId(customerId) {
        const { data, error } = await supabaseServiceClient
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // No user found
            }
            throw error;
        }

        return data.id;
    }

    /**
     * Update user with Stripe customer ID
     * @private
     */
    async _updateUserStripeCustomerId(userId, customerId) {
        const { error } = await supabaseServiceClient
            .from('users')
            .update({ 
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            throw error;
        }

        logger.info('User Stripe customer ID updated', {
            userId,
            customerId
        });
    }

    /**
     * Reset user to free plan entitlements
     * @private
     */
    async _resetToFreePlan(userId, reason) {
        const freeEntitlements = {
            analysis_limit_monthly: 100,
            roast_limit_monthly: 100,
            model: 'gpt-3.5-turbo',
            shield_enabled: false,
            rqc_mode: 'basic',
            stripe_price_id: null,
            stripe_product_id: null,
            plan_name: 'free',
            metadata: {
                reset_reason: reason,
                reset_at: new Date().toISOString()
            }
        };

        const result = await this.entitlementsService.setEntitlements(userId, freeEntitlements);
        
        logger.info('User reset to free plan', {
            userId,
            reason,
            success: result.success
        });

        return result;
    }

    /**
     * Extract customer ID from Stripe event
     * @private
     */
    _extractCustomerID(event) {
        const obj = event.data.object;
        
        return obj.customer || 
               obj.subscription?.customer || 
               obj.lines?.data?.[0]?.subscription?.customer ||
               null;
    }

    /**
     * Extract subscription ID from Stripe event
     * @private
     */
    _extractSubscriptionID(event) {
        const obj = event.data.object;
        
        return obj.subscription || 
               obj.id || 
               obj.lines?.data?.[0]?.subscription ||
               null;
    }

    /**
     * Get webhook processing statistics
     */
    async getWebhookStats(sinceDaysAgo = 1) {
        try {
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - sinceDaysAgo);
            
            const { data, error } = await supabaseServiceClient
                .rpc('get_webhook_stats', { 
                    since_date: sinceDate.toISOString() 
                });

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: data || []
            };

        } catch (error) {
            logger.error('Failed to get webhook stats', {
                error: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cleanup old webhook events
     */
    async cleanupOldEvents(olderThanDays = 30) {
        try {
            const { data, error } = await supabaseServiceClient
                .rpc('cleanup_webhook_events', { 
                    older_than_days: olderThanDays 
                });

            if (error) {
                throw error;
            }

            logger.info('Webhook events cleanup completed', {
                eventsDeleted: data,
                olderThanDays
            });

            return {
                success: true,
                eventsDeleted: data
            };

        } catch (error) {
            logger.error('Webhook cleanup failed', {
                error: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = StripeWebhookService;