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
                    result = await this._handleCheckoutCompleted(event.data.object);
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

            // Update user with Stripe customer ID
            await this._updateUserStripeCustomerId(userId, customerId);

            // Get subscription details to extract price
            const subscription = await this.stripeWrapper.subscriptions.retrieve(
                session.subscription,
                { expand: ['items.data.price'] }
            );

            const priceId = subscription.items?.data?.[0]?.price?.id;
            
            if (!priceId) {
                throw new Error('No price ID found in subscription');
            }

            // Set entitlements from Stripe Price metadata
            const entitlementsResult = await this.entitlementsService.setEntitlementsFromStripePrice(
                userId,
                priceId,
                {
                    metadata: {
                        source: 'checkout_completed',
                        session_id: session.id,
                        subscription_id: subscription.id,
                        customer_id: customerId
                    }
                }
            );

            if (!entitlementsResult.success) {
                logger.warn('Failed to set entitlements after checkout', {
                    userId,
                    priceId,
                    error: entitlementsResult.error
                });
            }

            return {
                success: true,
                accountId: userId,
                message: 'Checkout completed and entitlements updated',
                entitlementsUpdated: entitlementsResult.success,
                planName: entitlementsResult.entitlements?.plan_name || 'unknown'
            };

        } catch (error) {
            throw new Error(`Checkout completion failed: ${error.message}`);
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

            // Set entitlements from Stripe Price metadata
            const entitlementsResult = await this.entitlementsService.setEntitlementsFromStripePrice(
                userId,
                priceId,
                {
                    metadata: {
                        source: 'subscription_updated',
                        subscription_id: subscriptionId,
                        customer_id: customerId,
                        subscription_status: subscription.status
                    }
                }
            );

            return {
                success: true,
                accountId: userId,
                message: 'Subscription updated and entitlements refreshed',
                entitlementsUpdated: entitlementsResult.success,
                planName: entitlementsResult.entitlements?.plan_name || 'unknown',
                subscriptionStatus: subscription.status
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

            // Reset to free plan entitlements
            const result = await this._resetToFreePlan(userId, 'subscription_deleted');

            return {
                success: true,
                accountId: userId,
                message: 'Subscription deleted and entitlements reset to free plan',
                entitlementsUpdated: result.success,
                planName: 'free'
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

            // Update user billing status if needed
            // This could be used for marking accounts as current on payment
            logger.info('Payment succeeded', {
                userId,
                customerId,
                invoiceId: invoice.id,
                amount: invoice.amount_paid
            });

            return {
                success: true,
                accountId: userId,
                message: 'Payment succeeded and logged',
                invoiceId: invoice.id,
                amount: invoice.amount_paid
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

            // Log payment failure - could trigger notifications
            logger.warn('Payment failed', {
                userId,
                customerId,
                invoiceId: invoice.id,
                amount: invoice.amount_due,
                attemptCount: invoice.attempt_count
            });

            return {
                success: true,
                accountId: userId,
                message: 'Payment failed and logged',
                invoiceId: invoice.id,
                amount: invoice.amount_due,
                attemptCount: invoice.attempt_count
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