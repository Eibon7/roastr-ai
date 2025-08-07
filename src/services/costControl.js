const { createClient } = require('@supabase/supabase-js');

class CostControlService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY;
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    
    // Plan configurations
    this.plans = {
      free: {
        id: 'free',
        name: 'Free',
        monthlyResponsesLimit: 100,
        integrationsLimit: 2,
        shieldEnabled: false,
        features: ['basic_integrations', 'community_support']
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        monthlyResponsesLimit: 1000,
        integrationsLimit: 5,
        shieldEnabled: true,
        features: ['all_integrations', 'shield_mode', 'priority_support', 'analytics']
      },
      creator_plus: {
        id: 'creator_plus',
        name: 'Creator Plus',
        monthlyResponsesLimit: 5000,
        integrationsLimit: 999,
        shieldEnabled: true,
        features: ['unlimited_integrations', 'shield_mode', 'custom_tones', 'api_access', 'dedicated_support']
      },
      custom: {
        id: 'custom',
        name: 'Custom',
        monthlyResponsesLimit: 999999,
        integrationsLimit: 999,
        shieldEnabled: true,
        features: ['everything', 'custom_integrations', 'sla', 'dedicated_manager']
      }
    };
    
    // Cost per operation (in cents)
    this.operationCosts = {
      fetch_comment: 0, // Free operation
      analyze_toxicity: 1, // 1 cent per analysis
      generate_reply: 5, // 5 cents per generation (OpenAI cost)
      post_response: 0 // Free operation
    };
  }

  /**
   * Check if organization can perform an operation
   */
  async canPerformOperation(organizationId, operationType = 'generate_reply') {
    try {
      const usageCheck = await this.checkUsageLimit(organizationId);
      
      if (!usageCheck.canUse) {
        return {
          allowed: false,
          reason: 'monthly_limit_exceeded',
          message: `Monthly limit of ${usageCheck.limit} responses exceeded`,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit
        };
      }

      return {
        allowed: true,
        currentUsage: usageCheck.currentUsage,
        limit: usageCheck.limit,
        percentage: usageCheck.percentage
      };

    } catch (error) {
      console.error('Error checking operation permission:', error);
      throw error;
    }
  }

  /**
   * Check current usage against limits
   */
  async checkUsageLimit(organizationId) {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Get organization plan info
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .select('plan_id, monthly_responses_limit, monthly_responses_used')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;

      // Get current month usage
      const { data: monthlyUsage, error: usageError } = await this.supabase
        .from('monthly_usage')
        .select('total_responses, limit_exceeded')
        .eq('organization_id', organizationId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single();

      const currentUsage = monthlyUsage?.total_responses || 0;
      const limit = org.monthly_responses_limit;
      const percentage = (currentUsage / limit) * 100;

      return {
        canUse: currentUsage < limit,
        currentUsage,
        limit,
        percentage: Math.round(percentage),
        isNearLimit: percentage >= 90,
        organizationId,
        planId: org.plan_id
      };

    } catch (error) {
      console.error('Error checking usage limit:', error);
      throw error;
    }
  }

  /**
   * Record usage and cost
   */
  async recordUsage(organizationId, platform, operationType, metadata = {}) {
    try {
      const cost = this.operationCosts[operationType] || 0;

      // Record in usage_records
      const { data: usageRecord, error: usageError } = await this.supabase
        .from('usage_records')
        .insert({
          organization_id: organizationId,
          platform,
          action_type: operationType,
          tokens_used: metadata.tokensUsed || 0,
          cost_cents: cost,
          metadata
        })
        .select()
        .single();

      if (usageError) throw usageError;

      // If it's a billable response generation, increment counters
      if (operationType === 'generate_reply') {
        await this.incrementUsageCounters(organizationId, platform, cost);
      }

      return {
        recorded: true,
        cost,
        usageRecordId: usageRecord.id
      };

    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    }
  }

  /**
   * Increment monthly usage counters
   */
  async incrementUsageCounters(organizationId, platform, cost = 0) {
    try {
      // Call the database function to increment usage
      const { error } = await this.supabase
        .rpc('increment_usage', {
          org_id: organizationId,
          platform_name: platform,
          cost
        });

      if (error) throw error;

      // Check if we need to send usage alerts
      const usageCheck = await this.checkUsageLimit(organizationId);
      
      if (usageCheck.isNearLimit && !usageCheck.alertSent) {
        await this.sendUsageAlert(organizationId, usageCheck);
      }

      return usageCheck;

    } catch (error) {
      console.error('Error incrementing usage:', error);
      throw error;
    }
  }

  /**
   * Send usage alert (90% threshold)
   */
  async sendUsageAlert(organizationId, usageData) {
    try {
      // Get organization and owner details
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .select(`
          name,
          plan_id,
          users!organizations_owner_id_fkey (
            email,
            name
          )
        `)
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;

      // Log the alert
      await this.supabase
        .from('app_logs')
        .insert({
          organization_id: organizationId,
          level: 'warn',
          category: 'billing',
          message: `Usage alert: ${usageData.percentage}% of monthly limit reached`,
          metadata: {
            currentUsage: usageData.currentUsage,
            limit: usageData.limit,
            percentage: usageData.percentage,
            planId: usageData.planId
          }
        });

      // Here you would integrate with your email service
      // For now, we'll just log and return a webhook payload
      const alertPayload = {
        type: 'usage_alert',
        organizationId,
        organizationName: org.name,
        userEmail: org.users.email,
        userName: org.users.name,
        currentUsage: usageData.currentUsage,
        limit: usageData.limit,
        percentage: usageData.percentage,
        planId: usageData.planId,
        upgradeUrl: this.getUpgradeUrl(usageData.planId),
        timestamp: new Date().toISOString()
      };

      console.log('🚨 Usage Alert Generated:', alertPayload);
      
      // TODO: Send email or in-app notification
      // await this.sendEmailAlert(alertPayload);
      // await this.sendWebhookAlert(alertPayload);

      return alertPayload;

    } catch (error) {
      console.error('Error sending usage alert:', error);
      throw error;
    }
  }

  /**
   * Get upgrade URL for upselling
   */
  getUpgradeUrl(currentPlanId) {
    const upgradeMap = {
      free: '/upgrade?plan=pro',
      pro: '/upgrade?plan=creator_plus',
      creator_plus: '/upgrade?plan=custom',
      custom: '/contact?type=enterprise'
    };

    return upgradeMap[currentPlanId] || '/upgrade';
  }

  /**
   * Get usage statistics for organization
   */
  async getUsageStats(organizationId, months = 3) {
    try {
      const currentDate = new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - months, 1);

      // Get monthly usage for the last N months
      const { data: monthlyStats, error: monthlyError } = await this.supabase
        .from('monthly_usage')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (monthlyError) throw monthlyError;

      // Get current organization info
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .select('plan_id, monthly_responses_limit, monthly_responses_used')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;

      // Get platform breakdown for current month
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      const { data: platformStats, error: platformError } = await this.supabase
        .from('usage_records')
        .select('platform, action_type, cost_cents')
        .eq('organization_id', organizationId)
        .gte('created_at', new Date(currentYear, currentMonth - 1, 1).toISOString())
        .lt('created_at', new Date(currentYear, currentMonth, 1).toISOString());

      if (platformError) throw platformError;

      // Process platform statistics
      const platformBreakdown = {};
      let totalCostThisMonth = 0;

      platformStats.forEach(record => {
        if (!platformBreakdown[record.platform]) {
          platformBreakdown[record.platform] = {
            responses: 0,
            cost: 0,
            operations: {}
          };
        }

        if (!platformBreakdown[record.platform].operations[record.action_type]) {
          platformBreakdown[record.platform].operations[record.action_type] = 0;
        }

        if (record.action_type === 'generate_reply') {
          platformBreakdown[record.platform].responses++;
        }

        platformBreakdown[record.platform].operations[record.action_type]++;
        platformBreakdown[record.platform].cost += record.cost_cents;
        totalCostThisMonth += record.cost_cents;
      });

      const currentUsage = await this.checkUsageLimit(organizationId);

      return {
        organizationId,
        planId: org.plan_id,
        planInfo: this.plans[org.plan_id],
        currentUsage,
        monthlyStats,
        platformBreakdown,
        totalCostThisMonth,
        currency: 'USD'
      };

    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Upgrade organization plan
   */
  async upgradePlan(organizationId, newPlanId, stripeSubscriptionId = null) {
    try {
      const newPlan = this.plans[newPlanId];
      if (!newPlan) {
        throw new Error(`Invalid plan ID: ${newPlanId}`);
      }

      const { data: org, error } = await this.supabase
        .from('organizations')
        .update({
          plan_id: newPlanId,
          monthly_responses_limit: newPlan.monthlyResponsesLimit,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select()
        .single();

      if (error) throw error;

      // Log the upgrade
      await this.supabase
        .from('app_logs')
        .insert({
          organization_id: organizationId,
          level: 'info',
          category: 'billing',
          message: `Plan upgraded to ${newPlan.name}`,
          metadata: {
            previousPlan: org.plan_id,
            newPlan: newPlanId,
            stripeSubscriptionId
          }
        });

      return {
        success: true,
        organization: org,
        newPlan
      };

    } catch (error) {
      console.error('Error upgrading plan:', error);
      throw error;
    }
  }

  /**
   * Check if organization can use Shield features
   */
  async canUseShield(organizationId) {
    try {
      const { data: org, error } = await this.supabase
        .from('organizations')
        .select('plan_id')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      const plan = this.plans[org.plan_id];
      return {
        allowed: plan.shieldEnabled,
        planId: org.plan_id,
        planName: plan.name
      };

    } catch (error) {
      console.error('Error checking Shield access:', error);
      throw error;
    }
  }

  /**
   * Get billing summary for Stripe integration
   */
  async getBillingSummary(organizationId, year, month) {
    try {
      const { data: usage, error: usageError } = await this.supabase
        .from('monthly_usage')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (usageError && usageError.code !== 'PGRST116') throw usageError; // Not found is OK

      const { data: records, error: recordsError } = await this.supabase
        .from('usage_records')
        .select('platform, action_type, cost_cents, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', new Date(year, month - 1, 1).toISOString())
        .lt('created_at', new Date(year, month, 1).toISOString());

      if (recordsError) throw recordsError;

      return {
        organizationId,
        year,
        month,
        totalResponses: usage?.total_responses || 0,
        totalCostCents: usage?.total_cost_cents || 0,
        responsesByPlatform: usage?.responses_by_platform || {},
        detailedRecords: records || [],
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting billing summary:', error);
      throw error;
    }
  }
}

module.exports = CostControlService;