/**
 * Audit service for tracking subscription and plan changes
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const { withRetry, isRetryableError } = require('../utils/retry');

class AuditService {
  
  /**
   * Log a subscription change event
   * @param {Object} changeData - Change data
   * @param {string} changeData.userId - User ID
   * @param {string} changeData.eventType - Event type (plan_change, status_change, etc.)
   * @param {string} changeData.oldPlan - Previous plan
   * @param {string} changeData.newPlan - New plan
   * @param {string} changeData.oldStatus - Previous status
   * @param {string} changeData.newStatus - New status
   * @param {string} changeData.customerId - Stripe customer ID
   * @param {string} changeData.subscriptionId - Stripe subscription ID
   * @param {string} changeData.eventId - Stripe event ID
   * @param {string} changeData.reason - Change reason
   * @param {Object} changeData.metadata - Additional metadata
   * @param {string} changeData.initiatedBy - Who initiated the change
   * @returns {Promise<Object>} Result
   */
  async logSubscriptionChange(changeData) {
    try {
      const result = await withRetry(
        async () => {
          const { data, error } = await supabaseServiceClient
            .from('subscription_audit_log')
            .insert({
              user_id: changeData.userId,
              event_type: changeData.eventType,
              old_plan: changeData.oldPlan,
              new_plan: changeData.newPlan,
              old_status: changeData.oldStatus,
              new_status: changeData.newStatus,
              stripe_customer_id: changeData.customerId,
              stripe_subscription_id: changeData.subscriptionId,
              stripe_event_id: changeData.eventId,
              change_reason: changeData.reason,
              metadata: changeData.metadata || {},
              created_by: changeData.initiatedBy || 'system'
            })
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        {
          maxRetries: 3,
          shouldRetry: isRetryableError,
          context: 'Audit log creation'
        }
      );

      logger.info('📋 Subscription change logged:', {
        userId: changeData.userId,
        eventType: changeData.eventType,
        oldPlan: changeData.oldPlan,
        newPlan: changeData.newPlan
      });

      return { success: true, data: result };

    } catch (error) {
      logger.error('📋 Failed to log subscription change:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log a detailed plan change with usage snapshot
   * @param {Object} changeData - Plan change details
   * @param {string} changeData.userId - User ID
   * @param {string} changeData.organizationId - Organization ID (optional)
   * @param {string} changeData.fromPlan - Previous plan
   * @param {string} changeData.toPlan - New plan
   * @param {string} changeData.changeStatus - Change status
   * @param {string} changeData.blockedReason - Reason if blocked
   * @param {Object} changeData.usageSnapshot - Usage at time of change
   * @param {number} changeData.prorationAmount - Proration amount in cents
   * @param {Date} changeData.billingPeriodStart - Billing period start
   * @param {Date} changeData.billingPeriodEnd - Billing period end
   * @param {string} changeData.subscriptionId - Stripe subscription ID
   * @param {string} changeData.invoiceId - Stripe invoice ID
   * @param {string} changeData.initiatedBy - Who initiated the change
   * @param {Object} changeData.metadata - Additional metadata
   * @returns {Promise<Object>} Result
   */
  async logPlanChange(changeData) {
    try {
      const changeType = this.determineChangeType(changeData.fromPlan, changeData.toPlan);
      
      const result = await withRetry(
        async () => {
          const { data, error } = await supabaseServiceClient
            .from('plan_change_history')
            .insert({
              user_id: changeData.userId,
              organization_id: changeData.organizationId,
              from_plan: changeData.fromPlan,
              to_plan: changeData.toPlan,
              change_type: changeType,
              change_status: changeData.changeStatus || 'completed',
              blocked_reason: changeData.blockedReason,
              usage_snapshot: changeData.usageSnapshot || {},
              proration_amount: changeData.prorationAmount,
              billing_period_start: changeData.billingPeriodStart?.toISOString(),
              billing_period_end: changeData.billingPeriodEnd?.toISOString(),
              completed_at: changeData.changeStatus === 'completed' ? new Date().toISOString() : null,
              stripe_subscription_id: changeData.subscriptionId,
              stripe_invoice_id: changeData.invoiceId,
              initiated_by: changeData.initiatedBy || 'user',
              metadata: changeData.metadata || {}
            })
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        {
          maxRetries: 3,
          shouldRetry: isRetryableError,
          context: 'Plan change history'
        }
      );

      logger.info('📊 Plan change logged:', {
        userId: changeData.userId,
        fromPlan: changeData.fromPlan,
        toPlan: changeData.toPlan,
        changeType,
        status: changeData.changeStatus
      });

      return { success: true, data: result };

    } catch (error) {
      logger.error('📊 Failed to log plan change:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get subscription change history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Limit results
   * @param {number} options.offset - Offset results
   * @param {string} options.eventType - Filter by event type
   * @param {Date} options.since - Filter since date
   * @returns {Promise<Object>} History records
   */
  async getSubscriptionHistory(userId, options = {}) {
    try {
      let query = supabaseServiceClient
        .from('subscription_audit_log')
        .select('*')
        .eq('user_id', userId);

      if (options.eventType) {
        query = query.eq('event_type', options.eventType);
      }

      if (options.since) {
        query = query.gte('created_at', options.since.toISOString());
      }

      query = query
        .order('created_at', { ascending: false })
        .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };

    } catch (error) {
      logger.error('📋 Failed to get subscription history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get plan change history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Plan change history
   */
  async getPlanChangeHistory(userId, options = {}) {
    try {
      let query = supabaseServiceClient
        .from('plan_change_history')
        .select('*')
        .eq('user_id', userId);

      if (options.changeType) {
        query = query.eq('change_type', options.changeType);
      }

      if (options.since) {
        query = query.gte('initiated_at', options.since.toISOString());
      }

      query = query
        .order('initiated_at', { ascending: false })
        .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };

    } catch (error) {
      logger.error('📊 Failed to get plan change history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get plan change analytics
   * @param {Object} options - Query options
   * @param {Date} options.since - Since date
   * @param {Date} options.until - Until date
   * @returns {Promise<Object>} Analytics data
   */
  async getPlanChangeAnalytics(options = {}) {
    try {
      let query = supabaseServiceClient
        .from('plan_change_analytics')
        .select('*');

      if (options.since) {
        query = query.gte('month', options.since.toISOString().substring(0, 7)); // YYYY-MM format
      }

      if (options.until) {
        query = query.lte('month', options.until.toISOString().substring(0, 7));
      }

      query = query.order('month', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };

    } catch (error) {
      logger.error('📈 Failed to get plan change analytics:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update plan change status
   * @param {string} changeId - Plan change ID
   * @param {string} status - New status
   * @param {string} reason - Reason if failed/blocked
   * @returns {Promise<Object>} Result
   */
  async updatePlanChangeStatus(changeId, status, reason = null) {
    try {
      const updateData = {
        change_status: status,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      };

      if (reason) {
        updateData.blocked_reason = reason;
      }

      const { data, error } = await supabaseServiceClient
        .from('plan_change_history')
        .update(updateData)
        .eq('id', changeId)
        .select()
        .single();

      if (error) throw error;

      logger.info('📊 Plan change status updated:', {
        changeId,
        status,
        reason
      });

      return { success: true, data };

    } catch (error) {
      logger.error('📊 Failed to update plan change status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Determine change type based on plans
   * @param {string} fromPlan - From plan
   * @param {string} toPlan - To plan
   * @returns {string} Change type (upgrade, downgrade, lateral)
   */
  determineChangeType(fromPlan, toPlan) {
    const planTiers = {
      free: 0,
      pro: 1,
      creator_plus: 2
    };

    const fromTier = planTiers[fromPlan] || 0;
    const toTier = planTiers[toPlan] || 0;

    if (toTier > fromTier) return 'upgrade';
    if (toTier < fromTier) return 'downgrade';
    return 'lateral';
  }

  /**
   * Clean up old audit logs
   * @param {number} retentionDays - Days to retain logs
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean audit logs
      const { error: auditError, count: auditCount } = await supabaseServiceClient
        .from('subscription_audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (auditError) throw auditError;

      // Clean plan change history (keep longer retention)
      const planCutoffDate = new Date();
      planCutoffDate.setDate(planCutoffDate.getDate() - (retentionDays * 2));

      const { error: planError, count: planCount } = await supabaseServiceClient
        .from('plan_change_history')
        .delete()
        .lt('initiated_at', planCutoffDate.toISOString());

      if (planError) throw planError;

      logger.info('🧹 Audit logs cleaned up:', {
        auditRecordsRemoved: auditCount,
        planHistoryRemoved: planCount,
        retentionDays
      });

      return {
        success: true,
        auditRecordsRemoved: auditCount,
        planHistoryRemoved: planCount
      };

    } catch (error) {
      logger.error('🧹 Failed to cleanup audit logs:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new AuditService();