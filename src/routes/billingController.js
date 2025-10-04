/**
 * BillingController - Business logic for billing operations
 * Implements Dependency Injection pattern for testability
 * Issue #413 - Refactored from billing.js to support mocking
 */

const { PLAN_IDS } = require('../config/planMappings');

class BillingController {
  /**
   * Create BillingController with injected dependencies
   * @param {Object} dependencies - All service dependencies
   */
  constructor({
    stripeWrapper,
    queueService,
    entitlementsService,
    webhookService,
    supabaseClient,
    logger,
    emailService,
    notificationService,
    workerNotificationService,
    PLAN_CONFIG
  }) {
    this.stripeWrapper = stripeWrapper;
    this.queueService = queueService;
    this.entitlementsService = entitlementsService;
    this.webhookService = webhookService;
    this.supabaseClient = supabaseClient;
    this.logger = logger;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.workerNotificationService = workerNotificationService;
    this.PLAN_CONFIG = PLAN_CONFIG;
  }

  /**
   * Queue a billing job for processing by BillingWorker
   * @param {string} jobType - Type of billing job
   * @param {Object} webhookData - Webhook data from Stripe
   */
  async queueBillingJob(jobType, webhookData) {
    if (!this.queueService) {
      this.logger.error('Queue service not initialized, falling back to synchronous processing');
      // Fallback to original handlers for critical functionality
      switch (jobType) {
        case 'subscription_cancelled':
          return await this.handleSubscriptionDeleted(webhookData);
        case 'payment_succeeded':
          return await this.handlePaymentSucceeded(webhookData);
        case 'payment_failed':
          return await this.handlePaymentFailed(webhookData);
        case 'subscription_updated':
          return await this.handleSubscriptionUpdated(webhookData);
        default:
          this.logger.warn('Unknown fallback job type:', jobType);
      }
      return;
    }

    try {
      // Extract common data from webhook
      let jobData = {};

      switch (jobType) {
        case 'payment_failed':
          const { data: failedUserSub } = await this.supabaseClient
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
          const { data: cancelledUserSub } = await this.supabaseClient
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
          const { data: updatedUserSub } = await this.supabaseClient
            .from('user_subscriptions')
            .select('user_id, plan')
            .eq('stripe_customer_id', webhookData.customer)
            .single();

          // Determine plan from subscription
          let newPlan = PLAN_IDS.FREE;
          if (webhookData.items?.data?.length > 0) {
            const price = webhookData.items.data[0].price;
            const prices = await this.stripeWrapper.prices.list({ limit: 100 });
            const priceData = prices.data.find(p => p.id === price.id);

            if (priceData?.lookup_key) {
              const { getPlanFromStripeLookupKey } = require('../config/planMappings');
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
          const { data: succeededUserSub } = await this.supabaseClient
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
          const { data: actionUserSub } = await this.supabaseClient
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
      await this.queueService.addJob({
        job_type: jobType,
        data: jobData,
        priority: 2, // High priority for billing jobs
        organization_id: null // Billing jobs are system-wide
      });

      this.logger.info('Billing job queued successfully', {
        jobType,
        userId: jobData.userId,
        customerId: jobData.customerId
      });

    } catch (error) {
      this.logger.error('Failed to queue billing job, falling back to sync processing', {
        jobType,
        error: error.message
      });

      // Fallback to synchronous processing if queueing fails
      switch (jobType) {
        case 'subscription_cancelled':
          return await this.handleSubscriptionDeleted(webhookData);
        case 'payment_succeeded':
          return await this.handlePaymentSucceeded(webhookData);
        case 'payment_failed':
          return await this.handlePaymentFailed(webhookData);
        case 'subscription_updated':
          return await this.handleSubscriptionUpdated(webhookData);
        default:
          this.logger.warn('Unknown fallback job type:', jobType);
      }
    }
  }

  /**
   * Handle checkout.session.completed event with transaction support
   * Issue #95: Added database transactions to prevent inconsistent state
   */
  async handleCheckoutCompleted(session) {
    const userId = session.metadata?.user_id;

    if (!userId) {
      this.logger.error('No user_id in checkout session metadata');
      return;
    }

    const subscription = await this.stripeWrapper.subscriptions.retrieve(session.subscription);
    const customer = await this.stripeWrapper.customers.retrieve(session.customer);

    // Get the price ID from the subscription for entitlements update
    const priceId = subscription.items?.data?.[0]?.price?.id;

    // Determine plan from price lookup key using shared mappings
    let plan = PLAN_IDS.FREE;
    const lookupKey = session.metadata?.lookup_key;

    if (lookupKey) {
      const { getPlanFromStripeLookupKey } = require('../config/planMappings');
      plan = getPlanFromStripeLookupKey(lookupKey) || PLAN_IDS.FREE;
    }

    // Execute critical database operations in a transaction
    const transactionResult = await this.supabaseClient.rpc('execute_checkout_completed_transaction', {
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
      this.logger.error('Transaction failed during checkout completion:', {
        userId,
        subscriptionId: subscription.id,
        error: transactionResult.error,
        details: transactionResult.data
      });
      throw new Error(`Checkout completion transaction failed: ${transactionResult.error}`);
    }

    this.logger.info('Checkout transaction completed successfully:', {
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
        const planConfig = this.PLAN_CONFIG[plan] || {};

        await this.emailService.sendUpgradeSuccessNotification(userEmail, {
          userName: customer.name || userEmail.split('@')[0],
          oldPlanName: 'Free',
          newPlanName: planConfig.name || plan,
          newFeatures: planConfig.features || [],
          activationDate: new Date().toLocaleDateString(),
        });

        this.logger.info('📧 Upgrade success email sent:', { userId, plan, email: userEmail });
      } catch (emailError) {
        this.logger.error('📧 Failed to send upgrade success email:', emailError);
      }

      // Create in-app notification (non-critical, outside transaction)
      try {
        const planConfig = this.PLAN_CONFIG[plan] || {};

        await this.notificationService.createUpgradeSuccessNotification(userId, {
          oldPlanName: 'Free',
          newPlanName: planConfig.name || plan,
          newFeatures: planConfig.features || [],
          activationDate: new Date().toLocaleDateString(),
        });

        this.logger.info('📝 Upgrade success notification created:', { userId, plan });
      } catch (notificationError) {
        this.logger.error('📝 Failed to create upgrade success notification:', notificationError);
      }
    }
  }

  /**
   * Handle subscription updated event with transaction support
   * Issue #95: Added database transactions to prevent inconsistent state
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      // Get user ID from subscription
      const { data: userSub } = await this.supabaseClient
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (!userSub) {
        this.logger.warn('No user found for subscription update', {
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
        const prices = await this.stripeWrapper.prices.list({ limit: 100 });
        const priceData = prices.data.find(p => p.id === priceId);

        if (priceData?.lookup_key) {
          const { getPlanFromStripeLookupKey } = require('../config/planMappings');
          newPlan = getPlanFromStripeLookupKey(priceData.lookup_key) || PLAN_IDS.FREE;
        }
      }

      // Execute subscription update operations in a transaction
      const transactionResult = await this.supabaseClient.rpc('execute_subscription_updated_transaction', {
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
        this.logger.error('Transaction failed during subscription update:', {
          userId,
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          error: transactionResult.error,
          details: transactionResult.data
        });
        // Don't throw - webhook should still return success, but log the error
        return;
      }

      this.logger.info('Subscription update transaction completed successfully:', {
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
          this.logger.warn('Subscription update blocked by service:', {
            customerId: subscription.customer,
            reason: result.reason
          });
        } else {
          this.logger.info('Subscription service processed update successfully:', {
            userId: result.userId,
            oldPlan: result.oldPlan,
            newPlan: result.newPlan,
            status: result.status
          });
        }
      } catch (serviceError) {
        this.logger.info('Subscription service not available, using transaction result', {
          error: serviceError.message
        });
      }

    } catch (error) {
      this.logger.error('Failed to process subscription update:', error);
      // Don't throw - webhook should still return success
    }
  }

  /**
   * Handle subscription deleted event with transaction support
   * Issue #95: Added database transactions to prevent inconsistent state
   */
  async handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;

    const { data: userSub, error: findError } = await this.supabaseClient
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (findError || !userSub) {
      this.logger.error('Could not find user for customer:', customerId);
      return;
    }

    // Execute critical database operations in a transaction
    const transactionResult = await this.supabaseClient.rpc('execute_subscription_deleted_transaction', {
      p_user_id: userSub.user_id,
      p_subscription_id: subscription.id,
      p_customer_id: customerId,
      p_canceled_at: new Date().toISOString()
    });

    if (transactionResult.error) {
      this.logger.error('Transaction failed during subscription deletion:', {
        userId: userSub.user_id,
        subscriptionId: subscription.id,
        customerId,
        error: transactionResult.error,
        details: transactionResult.data
      });
      throw new Error(`Subscription deletion transaction failed: ${transactionResult.error}`);
    }

    this.logger.info('Subscription deletion transaction completed successfully:', {
      userId: userSub.user_id,
      subscriptionId: subscription.id,
      entitlementsReset: transactionResult.data?.entitlements_reset || false
    });

    // Send subscription canceled email notification (non-critical, outside transaction)
    try {
      const customer = await this.stripeWrapper.customers.retrieve(customerId);
      const userEmail = customer.email;

      // Get the canceled plan info from transaction result
      const planConfig = this.PLAN_CONFIG[transactionResult.data?.previous_plan] || {};

      await this.emailService.sendSubscriptionCanceledNotification(userEmail, {
        userName: customer.name || userEmail.split('@')[0],
        planName: planConfig.name || 'Pro',
        cancellationDate: new Date().toLocaleDateString(),
        accessUntilDate: transactionResult.data?.access_until_date || new Date().toLocaleDateString(),
      });

      this.logger.info('📧 Cancellation email sent:', {
        userId: userSub.user_id,
        email: userEmail
      });
    } catch (emailError) {
      this.logger.error('📧 Failed to send cancellation email:', emailError);
    }

    // Create in-app notification (non-critical, outside transaction)
    try {
      const planConfig = this.PLAN_CONFIG[transactionResult.data?.previous_plan] || {};

      await this.notificationService.createSubscriptionCanceledNotification(userSub.user_id, {
        planName: planConfig.name || 'Pro',
        cancellationDate: new Date().toLocaleDateString(),
        accessUntilDate: transactionResult.data?.access_until_date || new Date().toLocaleDateString(),
      });

      this.logger.info('📝 Cancellation notification created:', {
        userId: userSub.user_id
      });
    } catch (notificationError) {
      this.logger.error('📝 Failed to create cancellation notification:', notificationError);
    }
  }

  /**
   * Handle successful payment with transaction support
   * Issue #95: Added database transactions to prevent inconsistent state
   */
  async handlePaymentSucceeded(invoice) {
    const customerId = invoice.customer;

    const { data: userSub, error } = await this.supabaseClient
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!error && userSub) {
      // Execute payment success operations in a transaction
      const transactionResult = await this.supabaseClient.rpc('execute_payment_succeeded_transaction', {
        p_user_id: userSub.user_id,
        p_customer_id: customerId,
        p_invoice_id: invoice.id,
        p_amount_paid: invoice.amount_paid,
        p_payment_succeeded_at: new Date().toISOString()
      });

      if (transactionResult.error) {
        this.logger.error('Transaction failed during payment success:', {
          userId: userSub.user_id,
          invoiceId: invoice.id,
          customerId,
          error: transactionResult.error,
          details: transactionResult.data
        });
        throw new Error(`Payment success transaction failed: ${transactionResult.error}`);
      }

      this.logger.info('Payment succeeded transaction completed:', {
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
  async handlePaymentFailed(invoice) {
    const customerId = invoice.customer;

    const { data: userSub, error } = await this.supabaseClient
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!error && userSub) {
      // Calculate next attempt date (Stripe typically retries in 3 days)
      const nextAttempt = new Date();
      nextAttempt.setDate(nextAttempt.getDate() + 3);

      // Execute payment failure operations in a transaction
      const transactionResult = await this.supabaseClient.rpc('execute_payment_failed_transaction', {
        p_user_id: userSub.user_id,
        p_customer_id: customerId,
        p_invoice_id: invoice.id,
        p_amount_due: invoice.amount_due,
        p_attempt_count: invoice.attempt_count || 1,
        p_next_attempt_date: nextAttempt.toISOString(),
        p_payment_failed_at: new Date().toISOString()
      });

      if (transactionResult.error) {
        this.logger.error('Transaction failed during payment failure:', {
          userId: userSub.user_id,
          invoiceId: invoice.id,
          customerId,
          error: transactionResult.error,
          details: transactionResult.data
        });
        throw new Error(`Payment failure transaction failed: ${transactionResult.error}`);
      }

      this.logger.warn('Payment failed transaction completed:', {
        userId: userSub.user_id,
        invoiceId: invoice.id,
        amount: invoice.amount_due,
        statusUpdated: transactionResult.data?.status_updated || false,
        planName: transactionResult.data?.plan_name || 'unknown'
      });

      // Send payment failed email notification (non-critical, outside transaction)
      try {
        const customer = await this.stripeWrapper.customers.retrieve(customerId);
        const userEmail = customer.email;

        const planConfig = this.PLAN_CONFIG[transactionResult.data?.plan_name] || {};

        await this.emailService.sendPaymentFailedNotification(userEmail, {
          userName: customer.name || userEmail.split('@')[0],
          planName: planConfig.name || 'Pro',
          failedAmount: invoice.amount_due ? `€${(invoice.amount_due / 100).toFixed(2)}` : 'N/A',
          nextAttemptDate: nextAttempt.toLocaleDateString(),
        });

        this.logger.info('📧 Payment failed email sent:', {
          userId: userSub.user_id,
          email: userEmail,
          amount: invoice.amount_due
        });
      } catch (emailError) {
        this.logger.error('📧 Failed to send payment failed email:', emailError);
      }

      // Create in-app notification (non-critical, outside transaction)
      try {
        const planConfig = this.PLAN_CONFIG[transactionResult.data?.plan_name] || {};

        await this.notificationService.createPaymentFailedNotification(userSub.user_id, {
          planName: planConfig.name || 'Pro',
          failedAmount: invoice.amount_due ? `€${(invoice.amount_due / 100).toFixed(2)}` : 'N/A',
          nextAttemptDate: nextAttempt.toLocaleDateString(),
        });

        this.logger.info('📝 Payment failed notification created:', {
          userId: userSub.user_id,
          amount: invoice.amount_due
        });
      } catch (notificationError) {
        this.logger.error('📝 Failed to create payment failed notification:', notificationError);
      }
    }
  }

  /**
   * Apply plan limits dynamically when subscription changes
   * @param {string} userId - User ID
   * @param {string} plan - New plan (free, starter, pro, plus)
   * @param {string} status - Subscription status
   */
  async applyPlanLimits(userId, plan, status) {
    const planConfig = this.PLAN_CONFIG[plan] || this.PLAN_CONFIG.free;

    // If subscription is not active, apply limited access
    const isActive = status === 'active';
    const limits = isActive ? planConfig : this.PLAN_CONFIG.free;

    try {
      // Update user limits in the database
      const { error } = await this.supabaseClient
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
      const { data: orgData, error: orgError } = await this.supabaseClient
        .from('organizations')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();

      if (!orgError && orgData) {
        await this.supabaseClient
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
      await this.workerNotificationService.notifyStatusChange(userId, plan, status);
      this.logger.info('🔄 Plan limits updated, workers notified:', {
        userId,
        plan,
        status,
        limits: {
          maxRoasts: limits.maxRoasts,
          maxPlatforms: limits.maxPlatforms
        }
      });

    } catch (error) {
      this.logger.error('Failed to apply plan limits:', error);
      throw error;
    }
  }
}

module.exports = BillingController;
