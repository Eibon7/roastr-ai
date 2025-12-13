/**
 * BillingWorker - Handles billing-related background jobs
 *
 * Processes billing events from Stripe webhooks with automated retry logic,
 * notifications, and comprehensive audit logging for multi-tenant billing.
 */

const BaseWorker = require('./BaseWorker');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const auditLogService = require('../services/auditLogService');
const { logger } = require('../utils/logger');
const StripeWrapper = require('../services/stripeWrapper');
const { flags } = require('../config/flags');

// Plan configuration - SINGLE SOURCE OF TRUTH from planService.js
// Issue #841: Reads from planService.js instead of hardcoded values
const { getPlanFeatures, getPlanLimits } = require('../services/planService');

function getPlanConfig(planId) {
  const plan = getPlanFeatures(planId);
  const limits = getPlanLimits(planId);

  if (!plan) {
    // Fallback to starter_trial
    return getPlanConfig('starter_trial');
  }

  return {
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    description:
      plan.duration?.type === 'fixed' ? `${plan.duration.days}-day trial` : `${plan.name} plan`,
    features: buildFeatureList(plan, limits),
    maxPlatforms: limits?.maxPlatforms || plan.limits.maxPlatforms,
    maxRoasts: limits?.maxRoasts || plan.limits.roastsPerMonth
  };
}

function buildFeatureList(plan, limits) {
  const features = [];
  if (plan.limits.roastsPerMonth > 0) {
    features.push(`${plan.limits.roastsPerMonth} roasts per month`);
  }
  features.push(
    `${plan.limits.platformIntegrations} platform integration${plan.limits.platformIntegrations > 1 ? 's' : ''}`
  );
  if (plan.features.shield) features.push('Shield protection');
  if (plan.features.customTones) features.push('Custom tones');
  if (plan.features.apiAccess) features.push('API access');
  return features;
}

// For backward compatibility, create PLAN_CONFIG object dynamically
const PLAN_CONFIG = new Proxy(
  {},
  {
    get(target, prop) {
      return getPlanConfig(prop);
    }
  }
);

class BillingWorker extends BaseWorker {
  constructor(options = {}) {
    super('billing_update', {
      maxRetries: 5, // Higher retry count for billing operations
      retryDelay: 3000, // 3 seconds initial delay
      maxConcurrency: 2, // Lower concurrency for billing safety
      ...options
    });

    // Initialize Stripe wrapper if billing is enabled
    this.stripeWrapper = null;
    if (flags.isEnabled('ENABLE_BILLING')) {
      this.stripeWrapper = new StripeWrapper(process.env.STRIPE_SECRET_KEY);
    }

    // Retry configuration for billing operations
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 3600000, // 1 hour base delay
      maxDelay: 86400000, // 24 hours max delay
      exponentialBackoff: true
    };
  }

  /**
   * Process billing jobs based on job type
   * @param {Object} job - Job data from queue
   */
  async processJob(job) {
    const { job_type, data } = job;

    this.log('info', 'Processing billing job', {
      jobType: job_type,
      jobId: job.id,
      organizationId: job.organization_id
    });

    switch (job_type) {
      case 'payment_failed':
        return await this.processPaymentFailed(job);

      case 'subscription_cancelled':
        return await this.processSubscriptionCancelled(job);

      case 'subscription_updated':
        return await this.processSubscriptionUpdated(job);

      case 'payment_succeeded':
        return await this.processPaymentSucceeded(job);

      case 'invoice_payment_action_required':
        return await this.processPaymentActionRequired(job);

      case 'billing_retry':
        return await this.processBillingRetry(job);

      default:
        throw new Error(`Unknown billing job type: ${job_type}`);
    }
  }

  /**
   * Handle payment failed events with dunning process
   * @param {Object} job - Job containing payment failure data
   */
  async processPaymentFailed(job) {
    const { userId, customerId, invoiceId, amount, attemptCount = 0 } = job.data;

    this.log('info', 'Processing payment failure', {
      userId,
      customerId,
      invoiceId,
      amount,
      attemptCount
    });

    try {
      // Get user and subscription details
      const { data: userSub, error: userError } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single();

      if (userError || !userSub) {
        throw new Error(`User subscription not found for customer: ${customerId}`);
      }

      // Update subscription status to past_due
      await this.supabase
        .from('user_subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userSub.user_id);

      // Get customer details for notifications
      let customer = null;
      if (this.stripe) {
        customer = await this.stripeWrapper.customers.retrieve(customerId);
      }

      const planConfig = PLAN_CONFIG[userSub.plan] || PLAN_CONFIG.starter_trial;
      const userEmail = customer?.email || 'unknown@example.com';
      const userName = customer?.name || userEmail.split('@')[0];

      // Calculate next retry date (Stripe typically retries in 3 days)
      const nextAttempt = new Date();
      nextAttempt.setDate(nextAttempt.getDate() + 3);

      // Send payment failed notification email
      try {
        await emailService.sendPaymentFailedNotification(userEmail, {
          userName,
          planName: planConfig.name,
          failedAmount: amount ? `€${(amount / 100).toFixed(2)}` : 'N/A',
          nextAttemptDate: nextAttempt.toLocaleDateString(),
          attemptCount: attemptCount + 1
        });

        this.log('info', '📧 Payment failed email sent', { userId: userSub.user_id });
      } catch (emailError) {
        this.log('error', '📧 Failed to send payment failed email', {
          error: emailError.message
        });
      }

      // Create in-app notification
      try {
        await notificationService.createPaymentFailedNotification(userSub.user_id, {
          planName: planConfig.name,
          failedAmount: amount ? `€${(amount / 100).toFixed(2)}` : 'N/A',
          nextAttemptDate: nextAttempt.toLocaleDateString(),
          attemptCount: attemptCount + 1
        });

        this.log('info', '📝 Payment failed notification created', { userId: userSub.user_id });
      } catch (notificationError) {
        this.log('error', '📝 Failed to create payment failed notification', {
          error: notificationError.message
        });
      }

      // Log audit event
      await auditLogService.log('billing.payment_failed', userSub.user_id, {
        customerId,
        invoiceId,
        amount,
        attemptCount: attemptCount + 1,
        nextAttemptDate: nextAttempt.toISOString(),
        workerProcessed: this.workerName
      });

      // Schedule retry if within limits
      if (attemptCount < this.retryConfig.maxRetries) {
        await this.scheduleRetry(
          'billing_retry',
          {
            ...job.data,
            attemptCount: attemptCount + 1,
            originalJobType: 'payment_failed'
          },
          this.calculateRetryDelay(attemptCount)
        );

        this.log('info', 'Payment retry scheduled', {
          userId: userSub.user_id,
          attemptCount: attemptCount + 1
        });
      } else {
        // Final failure - suspend subscription
        await this.handleFinalPaymentFailure(userSub.user_id, customerId, planConfig);
      }

      return {
        success: true,
        summary: `Payment failed processed for user ${userSub.user_id}`,
        details: {
          userId: userSub.user_id,
          customerId,
          attemptCount: attemptCount + 1,
          retryScheduled: attemptCount < this.retryConfig.maxRetries
        }
      };
    } catch (error) {
      this.log('error', 'Error processing payment failure', {
        error: error.message,
        userId,
        customerId
      });
      throw error;
    }
  }

  /**
   * Handle subscription cancelled events
   * @param {Object} job - Job containing cancellation data
   */
  async processSubscriptionCancelled(job) {
    const { userId, customerId, subscriptionId, cancelReason = 'user_requested' } = job.data;

    this.log('info', 'Processing subscription cancellation', {
      userId,
      customerId,
      subscriptionId,
      cancelReason
    });

    try {
      // Get current subscription details
      const { data: userSub, error: userError } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single();

      if (userError || !userSub) {
        throw new Error(`User subscription not found for customer: ${customerId}`);
      }

      const oldPlanConfig = PLAN_CONFIG[userSub.plan] || PLAN_CONFIG.starter_trial;

      // Reset to starter_trial plan
      await this.supabase
        .from('user_subscriptions')
        .update({
          plan: 'starter_trial',
          status: 'canceled',
          stripe_subscription_id: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
          trial_end: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userSub.user_id);

      // Update user limits
      await this.supabase
        .from('users')
        .update({
          plan: 'starter_trial',
          monthly_messages_sent: 0,
          monthly_tokens_consumed: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userSub.user_id);

      // Clean up organization limits if user is owner
      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', userSub.user_id)
        .maybeSingle();

      if (orgData) {
        await this.supabase
          .from('organizations')
          .update({
            plan_id: 'starter_trial',
            subscription_status: 'canceled',
            monthly_responses_limit: PLAN_CONFIG.starter_trial.maxRoasts,
            updated_at: new Date().toISOString()
          })
          .eq('id', orgData.id);
      }

      // Get customer details for notifications
      let customer = null;
      if (this.stripe) {
        customer = await this.stripeWrapper.customers.retrieve(customerId);
      }

      const userEmail = customer?.email || 'unknown@example.com';
      const userName = customer?.name || userEmail.split('@')[0];

      // Send cancellation notification email
      try {
        await emailService.sendSubscriptionCanceledNotification(userEmail, {
          userName,
          planName: oldPlanConfig.name,
          cancellationDate: new Date().toLocaleDateString(),
          accessUntilDate: userSub.current_period_end
            ? new Date(userSub.current_period_end).toLocaleDateString()
            : new Date().toLocaleDateString(),
          cancelReason
        });

        this.log('info', '📧 Cancellation email sent', { userId: userSub.user_id });
      } catch (emailError) {
        this.log('error', '📧 Failed to send cancellation email', {
          error: emailError.message
        });
      }

      // Create in-app notification
      try {
        await notificationService.createSubscriptionCanceledNotification(userSub.user_id, {
          planName: oldPlanConfig.name,
          cancellationDate: new Date().toLocaleDateString(),
          accessUntilDate: userSub.current_period_end
            ? new Date(userSub.current_period_end).toLocaleDateString()
            : new Date().toLocaleDateString(),
          cancelReason
        });

        this.log('info', '📝 Cancellation notification created', { userId: userSub.user_id });
      } catch (notificationError) {
        this.log('error', '📝 Failed to create cancellation notification', {
          error: notificationError.message
        });
      }

      // Log audit event
      await auditLogService.log('billing.subscription_cancelled', userSub.user_id, {
        customerId,
        subscriptionId,
        oldPlan: userSub.plan,
        newPlan: 'starter_trial',
        cancelReason,
        workerProcessed: this.workerName
      });

      return {
        success: true,
        summary: `Subscription canceled for user ${userSub.user_id}`,
        details: {
          userId: userSub.user_id,
          oldPlan: userSub.plan,
          newPlan: 'starter_trial',
          cancelReason
        }
      };
    } catch (error) {
      this.log('error', 'Error processing subscription cancellation', {
        error: error.message,
        userId,
        customerId
      });
      throw error;
    }
  }

  /**
   * Handle subscription updated events
   * @param {Object} job - Job containing subscription update data
   */
  async processSubscriptionUpdated(job) {
    const { userId, customerId, subscriptionId, newPlan, newStatus } = job.data;

    this.log('info', 'Processing subscription update', {
      userId,
      customerId,
      subscriptionId,
      newPlan,
      newStatus
    });

    try {
      // Get current subscription
      const { data: currentSub } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single();

      const oldPlan = currentSub?.plan || 'starter_trial';
      const planChanged = oldPlan !== newPlan;

      // Update subscription in database
      await this.supabase
        .from('user_subscriptions')
        .update({
          plan: newPlan,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_customer_id', customerId);

      // Send upgrade/downgrade notifications if plan changed
      if (planChanged && newStatus === 'active') {
        let customer = null;
        if (this.stripe) {
          customer = await this.stripeWrapper.customers.retrieve(customerId);
        }

        const userEmail = customer?.email || 'unknown@example.com';
        const userName = customer?.name || userEmail.split('@')[0];
        const oldPlanConfig = PLAN_CONFIG[oldPlan] || PLAN_CONFIG.starter_trial;
        const newPlanConfig = PLAN_CONFIG[newPlan] || PLAN_CONFIG.starter_trial;

        try {
          await emailService.sendUpgradeSuccessNotification(userEmail, {
            userName,
            oldPlanName: oldPlanConfig.name,
            newPlanName: newPlanConfig.name,
            newFeatures: newPlanConfig.features || [],
            activationDate: new Date().toLocaleDateString()
          });

          this.log('info', '📧 Plan change email sent', {
            userId: currentSub.user_id,
            oldPlan,
            newPlan
          });
        } catch (emailError) {
          this.log('error', '📧 Failed to send plan change email', {
            error: emailError.message
          });
        }
      }

      // Log audit event
      await auditLogService.log('billing.subscription_updated', currentSub.user_id, {
        customerId,
        subscriptionId,
        oldPlan,
        newPlan,
        newStatus,
        planChanged,
        workerProcessed: this.workerName
      });

      return {
        success: true,
        summary: `Subscription updated for user ${currentSub.user_id}`,
        details: {
          userId: currentSub.user_id,
          oldPlan,
          newPlan,
          newStatus,
          planChanged
        }
      };
    } catch (error) {
      this.log('error', 'Error processing subscription update', {
        error: error.message,
        userId,
        customerId
      });
      throw error;
    }
  }

  /**
   * Handle payment succeeded events
   * @param {Object} job - Job containing payment success data
   */
  async processPaymentSucceeded(job) {
    const { userId, customerId, invoiceId, amount } = job.data;

    this.log('info', 'Processing payment success', {
      userId,
      customerId,
      invoiceId,
      amount
    });

    try {
      // Update subscription status to active if it was past_due
      await this.supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_customer_id', customerId)
        .eq('status', 'past_due');

      // Log audit event
      await auditLogService.log('billing.payment_succeeded', userId, {
        customerId,
        invoiceId,
        amount,
        workerProcessed: this.workerName
      });

      return {
        success: true,
        summary: `Payment succeeded for user ${userId}`,
        details: {
          userId,
          customerId,
          invoiceId,
          amount
        }
      };
    } catch (error) {
      this.log('error', 'Error processing payment success', {
        error: error.message,
        userId,
        customerId
      });
      throw error;
    }
  }

  /**
   * Handle 3D Secure payment action required
   * @param {Object} job - Job containing payment action data
   */
  async processPaymentActionRequired(job) {
    const { userId, customerId, invoiceId, paymentIntentId } = job.data;

    this.log('info', 'Processing payment action required', {
      userId,
      customerId,
      invoiceId,
      paymentIntentId
    });

    try {
      // Get user subscription
      const { data: userSub } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single();

      if (!userSub) {
        throw new Error(`User subscription not found for customer: ${customerId}`);
      }

      // Get customer details
      let customer = null;
      if (this.stripe) {
        customer = await this.stripeWrapper.customers.retrieve(customerId);
      }

      const planConfig = PLAN_CONFIG[userSub.plan] || PLAN_CONFIG.starter_trial;
      const userEmail = customer?.email || 'unknown@example.com';
      const userName = customer?.name || userEmail.split('@')[0];

      // Send 3D Secure action required notification
      try {
        await notificationService.createPaymentActionRequiredNotification(userSub.user_id, {
          planName: planConfig.name,
          paymentIntentId,
          actionUrl: `${process.env.FRONTEND_URL}/billing/confirm-payment?payment_intent=${paymentIntentId}`
        });

        this.log('info', '📝 Payment action required notification created', {
          userId: userSub.user_id
        });
      } catch (notificationError) {
        this.log('error', '📝 Failed to create payment action notification', {
          error: notificationError.message
        });
      }

      // Log audit event
      await auditLogService.log('billing.payment_action_required', userSub.user_id, {
        customerId,
        invoiceId,
        paymentIntentId,
        workerProcessed: this.workerName
      });

      return {
        success: true,
        summary: `Payment action required processed for user ${userSub.user_id}`,
        details: {
          userId: userSub.user_id,
          paymentIntentId
        }
      };
    } catch (error) {
      this.log('error', 'Error processing payment action required', {
        error: error.message,
        userId,
        customerId
      });
      throw error;
    }
  }

  /**
   * Process retry jobs with exponential backoff
   * @param {Object} job - Retry job data
   */
  async processBillingRetry(job) {
    const { originalJobType, attemptCount, ...originalData } = job.data;

    this.log('info', 'Processing billing retry', {
      originalJobType,
      attemptCount,
      userId: originalData.userId
    });

    // Create new job with original type but incremented attempt count
    const retryJob = {
      ...job,
      job_type: originalJobType,
      data: {
        ...originalData,
        attemptCount
      }
    };

    // Process the original job type
    return await this.processJob(retryJob);
  }

  /**
   * Handle final payment failure after all retries exhausted
   * @param {string} userId - User ID
   * @param {string} customerId - Stripe customer ID
   * @param {Object} planConfig - Plan configuration
   */
  async handleFinalPaymentFailure(userId, customerId, planConfig) {
    this.log('info', 'Handling final payment failure', { userId, customerId });

    try {
      // Suspend subscription by downgrading to free
      await this.supabase
        .from('user_subscriptions')
        .update({
          plan: 'starter_trial',
          status: 'suspended',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      // Get customer for notifications
      let customer = null;
      if (this.stripe) {
        customer = await this.stripeWrapper.customers.retrieve(customerId);
      }

      const userEmail = customer?.email || 'unknown@example.com';
      const userName = customer?.name || userEmail.split('@')[0];

      // Send suspension notification
      try {
        await notificationService.createSubscriptionSuspendedNotification(userId, {
          planName: planConfig.name,
          suspensionDate: new Date().toLocaleDateString(),
          reason: 'payment_failed_final'
        });

        this.log('info', '📝 Suspension notification created', { userId });
      } catch (notificationError) {
        this.log('error', '📝 Failed to create suspension notification', {
          error: notificationError.message
        });
      }

      // Log final failure audit event
      await auditLogService.log('billing.subscription_suspended', userId, {
        customerId,
        reason: 'payment_failed_final',
        oldPlan: planConfig.name,
        newPlan: 'starter_trial',
        workerProcessed: this.workerName
      });
    } catch (error) {
      this.log('error', 'Error handling final payment failure', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Schedule a retry job with exponential backoff
   * @param {string} jobType - Type of retry job
   * @param {Object} data - Job data
   * @param {number} delay - Delay in milliseconds
   */
  async scheduleRetry(jobType, data, delay) {
    try {
      await this.queueService.scheduleJob({
        job_type: jobType,
        data,
        scheduled_for: new Date(Date.now() + delay),
        priority: 2, // High priority for billing retries
        organization_id: data.organizationId || null
      });

      this.log('info', 'Retry job scheduled', {
        jobType,
        delay,
        scheduledFor: new Date(Date.now() + delay).toISOString()
      });
    } catch (error) {
      this.log('error', 'Failed to schedule retry job', {
        error: error.message,
        jobType
      });
      throw error;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attemptCount - Current attempt count
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attemptCount) {
    if (!this.retryConfig.exponentialBackoff) {
      return this.retryConfig.baseDelay;
    }

    const delay = this.retryConfig.baseDelay * Math.pow(2, attemptCount);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Get billing worker specific health details
   * @returns {Object} Health details
   */
  async getSpecificHealthDetails() {
    const details = {
      billing: {
        stripeEnabled: !!this.stripe,
        emailServiceConfigured: emailService.isConfigured,
        retryConfig: this.retryConfig
      }
    };

    // Check if we can connect to Stripe
    if (this.stripeWrapper) {
      try {
        await this.stripeWrapper.raw.balance.retrieve();
        details.billing.stripeConnection = 'healthy';
      } catch (error) {
        details.billing.stripeConnection = 'unhealthy';
        details.billing.stripeError = error.message;
      }
    }

    return details;
  }
}

module.exports = BillingWorker;
