const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { getPlanFeatures, getPlanByLookupKey } = require('./planService');
const { isChangeAllowed } = require('./planValidation');
const emailService = require('./emailService');
const notificationService = require('./notificationService');
const workerNotificationService = require('./workerNotificationService');
const auditService = require('./auditService');

/**
 * Get user's current usage metrics
 * @param {string} userId - User ID
 * @returns {Object} Usage metrics
 */
async function getUserUsage(userId) {
  try {
    // Get current month's usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get roasts count
    const { count: roastsCount, error: roastsError } = await supabaseServiceClient
      .from('roasts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    if (roastsError) throw roastsError;

    // Get comments count
    const { count: commentsCount, error: commentsError } = await supabaseServiceClient
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userId) // Assuming org_id for comments
      .gte('created_at', startOfMonth.toISOString());

    if (commentsError) throw commentsError;

    // Get active integrations
    const { data: integrations, error: integrationsError } = await supabaseServiceClient
      .from('user_integrations')
      .select('platform')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (integrationsError) throw integrationsError;

    return {
      roastsThisMonth: roastsCount || 0,
      commentsThisMonth: commentsCount || 0,
      activeIntegrations: integrations?.length || 0
    };
  } catch (error) {
    logger.error('Error getting user usage:', error);
    return {
      roastsThisMonth: 0,
      commentsThisMonth: 0,
      activeIntegrations: 0
    };
  }
}

/**
 * Process subscription update from Stripe webhook
 * @param {Object} subscription - Stripe subscription object
 * @returns {Object} Result of the update
 */
async function processSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;
  
  try {
    // 1. Find user by customer ID
    const { data: userSub, error: findError } = await supabaseServiceClient
      .from('user_subscriptions')
      .select('user_id, plan, stripe_subscription_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (findError || !userSub) {
      throw new Error(`User not found for customer: ${customerId}`);
    }

    const userId = userSub.user_id;
    const oldPlan = userSub.plan || 'free';

    // 2. Determine new plan from subscription
    const newPlan = await determinePlanFromSubscription(subscription);
    
    // 3. Check if this is a plan change
    const isPlanChange = oldPlan !== newPlan;
    
    // 4. Validate plan change if needed
    if (isPlanChange && subscription.status === 'active') {
      const usage = await getUserUsage(userId);
      const validation = await isChangeAllowed(oldPlan, newPlan, usage);
      
      if (!validation.allowed) {
        logger.warn('Plan change not allowed:', {
          userId,
          oldPlan,
          newPlan,
          reason: validation.reason
        });
        
        // Create notification about blocked change
        await notificationService.createPlanChangeBlockedNotification(userId, {
          oldPlan,
          newPlan,
          reason: validation.reason,
          warnings: validation.warnings
        });
        
        return {
          success: false,
          reason: validation.reason,
          warnings: validation.warnings
        };
      }
    }

    // 5. Update subscription in database
    const updateResult = await updateUserSubscription(userId, {
      plan: newPlan,
      status: subscription.status,
      subscriptionId: subscription.id,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: subscription.trial_end
    });

    if (!updateResult.success) {
      throw new Error('Failed to update subscription in database');
    }

    // 6. Log audit trail
    await logSubscriptionChange(userId, {
      oldPlan,
      newPlan,
      status: subscription.status,
      customerId,
      subscriptionId: subscription.id,
      metadata: subscription.metadata
    });

    // 7. Handle notifications and side effects
    if (isPlanChange && subscription.status === 'active') {
      await handlePlanChangeNotifications(userId, oldPlan, newPlan, customerId);
      await applyPlanLimits(userId, newPlan, subscription.status);
    }

    // 8. Handle status changes
    if (subscription.status !== 'active') {
      await handleSubscriptionStatusChange(userId, subscription.status, newPlan);
    }

    return {
      success: true,
      userId,
      oldPlan,
      newPlan,
      status: subscription.status
    };

  } catch (error) {
    logger.error('Error processing subscription update:', error);
    throw error;
  }
}

/**
 * Determine plan from Stripe subscription object
 * @param {Object} subscription - Stripe subscription
 * @returns {string} Plan ID
 */
async function determinePlanFromSubscription(subscription) {
  if (!subscription.items?.data?.length) {
    return 'free';
  }

  const price = subscription.items.data[0].price;
  
  // Try to get plan from price lookup key
  if (price.lookup_key) {
    const plan = getPlanByLookupKey(price.lookup_key);
    if (plan) return plan;
  }

  // Fallback: look up price in Stripe
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const prices = await stripe.prices.list({ limit: 100 });
    const priceData = prices.data.find(p => p.id === price.id);
    
    if (priceData?.lookup_key) {
      const plan = getPlanByLookupKey(priceData.lookup_key);
      if (plan) return plan;
    }
  } catch (error) {
    logger.error('Error looking up price:', error);
  }

  return 'free';
}

/**
 * Update user subscription in database
 * @param {string} userId - User ID
 * @param {Object} data - Subscription data
 * @returns {Object} Update result
 */
async function updateUserSubscription(userId, data) {
  try {
    const { error } = await supabaseServiceClient
      .from('user_subscriptions')
      .update({
        plan: data.plan,
        status: data.status,
        stripe_subscription_id: data.subscriptionId,
        current_period_start: data.currentPeriodStart ? 
          new Date(data.currentPeriodStart * 1000).toISOString() : null,
        current_period_end: data.currentPeriodEnd ? 
          new Date(data.currentPeriodEnd * 1000).toISOString() : null,
        cancel_at_period_end: data.cancelAtPeriodEnd,
        trial_end: data.trialEnd ? 
          new Date(data.trialEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('Database update error:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    logger.error('Failed to update subscription:', error);
    return { success: false, error };
  }
}

/**
 * Log subscription change for audit trail
 * @param {string} userId - User ID
 * @param {Object} changeData - Change data
 */
async function logSubscriptionChange(userId, changeData) {
  try {
    // Log subscription change event
    await auditService.logSubscriptionChange({
      userId,
      eventType: 'plan_change',
      oldPlan: changeData.oldPlan,
      newPlan: changeData.newPlan,
      oldStatus: changeData.oldStatus,
      newStatus: changeData.status,
      customerId: changeData.customerId,
      subscriptionId: changeData.subscriptionId,
      eventId: changeData.eventId,
      metadata: changeData.metadata,
      initiatedBy: 'stripe_webhook'
    });

    // Log detailed plan change if plans are different
    if (changeData.oldPlan !== changeData.newPlan) {
      const usage = await getUserUsage(userId);
      
      await auditService.logPlanChange({
        userId,
        fromPlan: changeData.oldPlan,
        toPlan: changeData.newPlan,
        changeStatus: 'completed',
        usageSnapshot: {
          ...usage,
          timestamp: new Date().toISOString(),
          change_trigger: 'stripe_webhook'
        },
        subscriptionId: changeData.subscriptionId,
        initiatedBy: 'stripe_webhook',
        metadata: {
          stripe_event_id: changeData.eventId,
          subscription_status: changeData.status
        }
      });
    }
  } catch (error) {
    logger.error('Error logging subscription change:', error);
  }
}

/**
 * Handle notifications for plan changes
 * @param {string} userId - User ID
 * @param {string} oldPlan - Previous plan
 * @param {string} newPlan - New plan
 * @param {string} customerId - Stripe customer ID
 */
async function handlePlanChangeNotifications(userId, oldPlan, newPlan, customerId) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const customer = await stripe.customers.retrieve(customerId);
    const userEmail = customer.email;
    
    const oldPlanFeatures = getPlanFeatures(oldPlan);
    const newPlanFeatures = getPlanFeatures(newPlan);
    
    // Send email notification
    await emailService.sendPlanChangeNotification(userEmail, {
      userName: customer.name || userEmail.split('@')[0],
      oldPlanName: oldPlanFeatures?.name || oldPlan,
      newPlanName: newPlanFeatures?.name || newPlan,
      newFeatures: newPlanFeatures?.features || [],
      effectiveDate: new Date().toLocaleDateString()
    });

    // Create in-app notification
    await notificationService.createPlanChangeNotification(userId, {
      oldPlanName: oldPlanFeatures?.name || oldPlan,
      newPlanName: newPlanFeatures?.name || newPlan,
      changeType: getPlanTier(newPlan) > getPlanTier(oldPlan) ? 'upgrade' : 'downgrade'
    });

    // Notify workers
    await workerNotificationService.notifyPlanChange(userId, oldPlan, newPlan, 'active');

    logger.info('Plan change notifications sent:', {
      userId,
      oldPlan,
      newPlan,
      email: userEmail
    });
  } catch (error) {
    logger.error('Failed to send plan change notifications:', error);
  }
}

/**
 * Handle subscription status changes
 * @param {string} userId - User ID
 * @param {string} status - New status
 * @param {string} plan - Current plan
 */
async function handleSubscriptionStatusChange(userId, status, plan) {
  try {
    const statusMessages = {
      past_due: 'Your subscription payment is past due',
      unpaid: 'Your subscription has unpaid invoices',
      incomplete: 'Your subscription setup is incomplete',
      incomplete_expired: 'Your subscription setup has expired',
      trialing: 'Your subscription is in trial period',
      canceled: 'Your subscription has been canceled'
    };

    const message = statusMessages[status] || `Your subscription status is: ${status}`;
    
    await notificationService.createSubscriptionStatusNotification(userId, {
      status,
      message,
      planName: getPlanFeatures(plan)?.name || plan
    });

    logger.info('Subscription status notification created:', {
      userId,
      status,
      plan
    });
  } catch (error) {
    logger.error('Failed to create status notification:', error);
  }
}

/**
 * Get plan tier for comparison
 * @param {string} planId - Plan ID
 * @returns {number} Tier number
 */
function getPlanTier(planId) {
  const tiers = {
    free: 0,
    pro: 1,
    creator_plus: 2
  };
  return tiers[planId] || 0;
}

/**
 * Apply plan limits when subscription changes
 * @param {string} userId - User ID
 * @param {string} plan - New plan
 * @param {string} status - Subscription status
 */
async function applyPlanLimits(userId, plan, status) {
  const planFeatures = getPlanFeatures(plan) || getPlanFeatures('free');
  const isActive = status === 'active';
  const limits = isActive ? planFeatures.limits : getPlanFeatures('free').limits;
  
  try {
    // Update user limits
    const { error: userError } = await supabaseServiceClient
      .from('users')
      .update({
        plan: plan,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userError) throw userError;

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
          monthly_responses_limit: limits.roastsPerMonth === -1 ? 999999 : limits.roastsPerMonth,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgData.id);
    }

    logger.info('Plan limits applied:', {
      userId,
      plan,
      status,
      limits
    });

  } catch (error) {
    logger.error('Failed to apply plan limits:', error);
    throw error;
  }
}

module.exports = {
  processSubscriptionUpdate,
  getUserUsage,
  determinePlanFromSubscription,
  updateUserSubscription,
  logSubscriptionChange,
  handlePlanChangeNotifications,
  handleSubscriptionStatusChange,
  applyPlanLimits
};