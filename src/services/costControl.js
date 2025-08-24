const { createClient } = require('@supabase/supabase-js');
const planLimitsService = require('./planLimitsService');

class CostControlService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY;
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    
    // Keep basic plan metadata (not limits)
    this.plans = {
      free: {
        id: 'free',
        name: 'Free',
        features: ['basic_integrations', 'community_support']
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        features: ['all_integrations', 'shield_mode', 'priority_support', 'analytics']
      },
      creator_plus: {
        id: 'creator_plus',
        name: 'Creator Plus',
        features: ['unlimited_integrations', 'shield_mode', 'custom_tones', 'api_access', 'dedicated_support']
      },
      custom: {
        id: 'custom',
        name: 'Custom',
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
  async canPerformOperation(organizationId, operationType = 'generate_reply', quantity = 1, platform = null) {
    try {
      // Map operation types to resource types
      const resourceTypeMap = {
        'generate_reply': 'roasts',
        'fetch_comment': 'api_calls',
        'analyze_toxicity': 'comment_analysis',
        'post_response': 'api_calls',
        'shield_action': 'shield_actions',
        'webhook_call': 'webhook_calls'
      };
      
      const resourceType = resourceTypeMap[operationType] || 'api_calls';
      
      // Use the enhanced database function
      const { data: result, error } = await this.supabase
        .rpc('can_perform_operation', {
          org_id: organizationId,
          resource_type_param: resourceType,
          quantity_param: quantity
        });
      
      if (error) throw error;
      
      // If operation not allowed, add contextual message
      if (!result.allowed) {
        const resourceName = this.getResourceDisplayName(resourceType);
        result.message = this.buildLimitMessage(result, resourceName);
      }
      
      return result;
      
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
        isNearLimit: percentage >= 80,
        organizationId,
        planId: org.plan_id
      };

    } catch (error) {
      console.error('Error checking usage limit:', error);
      throw error;
    }
  }

  /**
   * Record usage and cost with enhanced tracking
   */
  async recordUsage(organizationId, platform, operationType, metadata = {}, userId = null, quantity = 1) {
    try {
      const cost = this.operationCosts[operationType] || 0;
      const tokensUsed = metadata.tokensUsed || 0;
      
      // Map operation types to resource types
      const resourceTypeMap = {
        'generate_reply': 'roasts',
        'fetch_comment': 'api_calls',
        'analyze_toxicity': 'comment_analysis',
        'post_response': 'api_calls',
        'shield_action': 'shield_actions',
        'webhook_call': 'webhook_calls'
      };
      
      const resourceType = resourceTypeMap[operationType] || 'api_calls';

      // Record in usage_records (legacy table for detailed logs)
      const { data: usageRecord, error: usageError } = await this.supabase
        .from('usage_records')
        .insert({
          organization_id: organizationId,
          platform,
          action_type: operationType,
          tokens_used: tokensUsed,
          cost_cents: cost * quantity,
          metadata: { ...metadata, quantity, resourceType }
        })
        .select()
        .single();

      if (usageError) throw usageError;

      // Use enhanced usage recording function
      const { data: trackingResult, error: trackingError } = await this.supabase
        .rpc('record_usage', {
          org_id: organizationId,
          resource_type_param: resourceType,
          platform_param: platform,
          user_id_param: userId,
          quantity_param: quantity,
          cost_param: cost * quantity,
          tokens_param: tokensUsed * quantity,
          metadata_param: metadata
        });

      if (trackingError) throw trackingError;
      
      // Check for usage alerts if approaching limits (80% threshold as per Issue 72)
      if (trackingResult && (trackingResult.limit_exceeded || trackingResult.percentage_used >= 80)) {
        await this.checkAndSendUsageAlerts(organizationId, resourceType, trackingResult);
      }

      return {
        recorded: true,
        cost: cost * quantity,
        usageRecordId: usageRecord.id,
        tracking: trackingResult
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
   * Send usage alert (80% threshold as per Issue 72)
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

      const resourceType = usageData.resourceType || 'roasts';
      const thresholdPercentage = usageData.thresholdPercentage || 80;
      
      // Enhanced logging as per Issue 72 requirements
      const alertMessage = `🚨 Usage Alert: ${Math.round(usageData.percentage || 0)}% of monthly ${resourceType} limit reached (threshold: ${thresholdPercentage}%)`;
      
      // Log to console (Issue 72 requirement)
      console.log(alertMessage, {
        organizationId,
        organizationName: org.name,
        resourceType,
        currentUsage: usageData.currentUsage || usageData.current_usage,
        limit: usageData.limit || usageData.monthly_limit,
        percentage: Math.round(usageData.percentage || 0),
        thresholdPercentage,
        planId: usageData.planId || org.plan_id,
        timestamp: new Date().toISOString()
      });

      // Log to database (Issue 72 requirement)
      await this.supabase
        .from('app_logs')
        .insert({
          organization_id: organizationId,
          level: 'warn',
          category: 'usage_alert',
          message: alertMessage,
          metadata: {
            resourceType,
            currentUsage: usageData.currentUsage || usageData.current_usage,
            limit: usageData.limit || usageData.monthly_limit,
            percentage: Math.round(usageData.percentage || 0),
            thresholdPercentage,
            planId: usageData.planId || org.plan_id,
            alertType: usageData.alertType || 'soft_warning'
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
   * Get resource display name for user-friendly messages
   */
  getResourceDisplayName(resourceType) {
    const displayNames = {
      'roasts': 'roast responses',
      'api_calls': 'API calls',
      'comment_analysis': 'comment analyses',
      'shield_actions': 'shield actions',
      'webhook_calls': 'webhook calls',
      'integrations': 'active integrations'
    };
    return displayNames[resourceType] || resourceType;
  }

  /**
   * Build contextual limit exceeded message
   */
  buildLimitMessage(result, resourceName) {
    const { reason, current_usage, monthly_limit, remaining } = result;
    
    switch (reason) {
      case 'monthly_limit_exceeded':
        return `Monthly limit of ${monthly_limit} ${resourceName} exceeded. Current usage: ${current_usage}.`;
      case 'overage_allowed':
        return `Monthly limit exceeded but overage is allowed for your plan. Additional charges may apply.`;
      default:
        return `Operation not allowed: ${reason}`;
    }
  }

  /**
   * Create default usage alerts for an organization (80% threshold)
   */
  async createDefaultUsageAlerts(organizationId) {
    try {
      const resourceTypes = ['roasts', 'api_calls', 'comment_analysis', 'shield_actions'];
      const defaultAlerts = [];

      for (const resourceType of resourceTypes) {
        // Check if alert already exists
        const { data: existingAlert, error: checkError } = await this.supabase
          .from('usage_alerts')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('resource_type', resourceType)
          .eq('threshold_percentage', 80)
          .maybeSingle();

        if (checkError) throw checkError;

        if (!existingAlert) {
          defaultAlerts.push({
            organization_id: organizationId,
            resource_type: resourceType,
            threshold_percentage: 80,
            alert_type: 'in_app',
            is_active: true,
            max_alerts_per_day: 3,
            cooldown_hours: 4
          });
        }
      }

      if (defaultAlerts.length > 0) {
        const { error: insertError } = await this.supabase
          .from('usage_alerts')
          .insert(defaultAlerts);

        if (insertError) throw insertError;

        console.log(`Created ${defaultAlerts.length} default usage alerts for org ${organizationId}`);
      }

      return defaultAlerts;

    } catch (error) {
      console.error('Error creating default usage alerts:', error);
      // Don't throw - this is not critical for operation
      return [];
    }
  }

  /**
   * Check and send usage alerts when approaching limits
   */
  async checkAndSendUsageAlerts(organizationId, resourceType, usageData) {
    try {
      const percentage = usageData.percentage_used || 
        (usageData.current_usage / usageData.monthly_limit) * 100;
      
      // Get alert configurations for this org and resource
      const { data: alerts, error } = await this.supabase
        .from('usage_alerts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('resource_type', resourceType)
        .eq('is_active', true)
        .lte('threshold_percentage', Math.ceil(percentage));
      
      if (error) throw error;
      
      // Create default alerts if none exist
      if (!alerts || alerts.length === 0) {
        await this.createDefaultUsageAlerts(organizationId);
        // Retry getting alerts after creating defaults
        const { data: newAlerts } = await this.supabase
          .from('usage_alerts')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('resource_type', resourceType)
          .eq('is_active', true)
          .lte('threshold_percentage', Math.ceil(percentage));
        
        if (newAlerts && newAlerts.length > 0) {
          alerts = newAlerts;
        }
      }
      
      for (const alert of alerts || []) {
        // Check if we should send alert (cooldown, frequency limits)
        const shouldSend = await this.shouldSendAlert(alert, percentage);
        if (shouldSend) {
          await this.sendUsageAlert(organizationId, {
            ...usageData,
            resourceType,
            alertType: alert.alert_type,
            thresholdPercentage: alert.threshold_percentage
          });
          
          // Update alert sent timestamp
          await this.supabase
            .from('usage_alerts')
            .update({
              last_sent_at: new Date().toISOString(),
              sent_count: alert.sent_count + 1
            })
            .eq('id', alert.id);
        }
      }
      
    } catch (error) {
      console.error('Error checking usage alerts:', error);
      // Don't throw - alerts are not critical for operation
    }
  }

  /**
   * Determine if alert should be sent based on cooldown and frequency
   */
  async shouldSendAlert(alert, currentPercentage) {
    // Check daily limit
    if (alert.sent_count >= alert.max_alerts_per_day) {
      // Reset if it's a new day
      const lastSent = new Date(alert.last_sent_at);
      const today = new Date();
      if (lastSent.toDateString() !== today.toDateString()) {
        await this.supabase
          .from('usage_alerts')
          .update({ sent_count: 0 })
          .eq('id', alert.id);
        return true;
      }
      return false;
    }
    
    // Check cooldown period
    if (alert.last_sent_at) {
      const lastSent = new Date(alert.last_sent_at);
      const cooldownEnd = new Date(lastSent.getTime() + (alert.cooldown_hours * 60 * 60 * 1000));
      if (new Date() < cooldownEnd) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get comprehensive usage statistics with enhanced tracking
   */
  async getEnhancedUsageStats(organizationId, months = 3) {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      // Get current month detailed usage by resource type
      const { data: currentUsage, error: currentError } = await this.supabase
        .from('usage_tracking')
        .select('resource_type, platform, quantity, cost_cents, tokens_used')
        .eq('organization_id', organizationId)
        .eq('year', currentYear)
        .eq('month', currentMonth);
      
      if (currentError) throw currentError;
      
      // Get usage limits
      const { data: limits, error: limitsError } = await this.supabase
        .from('usage_limits')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      
      if (limitsError) throw limitsError;
      
      // Process current usage by resource type
      const usageByResource = {};
      const usageByPlatform = {};
      let totalCostThisMonth = 0;
      let totalTokensUsed = 0;
      
      currentUsage.forEach(record => {
        // By resource type
        if (!usageByResource[record.resource_type]) {
          usageByResource[record.resource_type] = {
            quantity: 0,
            cost_cents: 0,
            tokens_used: 0,
            platforms: {}
          };
        }
        
        usageByResource[record.resource_type].quantity += record.quantity;
        usageByResource[record.resource_type].cost_cents += record.cost_cents;
        usageByResource[record.resource_type].tokens_used += record.tokens_used;
        
        // By platform within resource
        if (record.platform) {
          if (!usageByResource[record.resource_type].platforms[record.platform]) {
            usageByResource[record.resource_type].platforms[record.platform] = 0;
          }
          usageByResource[record.resource_type].platforms[record.platform] += record.quantity;
          
          // Overall by platform
          if (!usageByPlatform[record.platform]) {
            usageByPlatform[record.platform] = 0;
          }
          usageByPlatform[record.platform] += record.quantity;
        }
        
        totalCostThisMonth += record.cost_cents;
        totalTokensUsed += record.tokens_used;
      });
      
      // Add limit information to each resource
      const limitsMap = {};
      limits.forEach(limit => {
        limitsMap[limit.resource_type] = limit;
      });
      
      Object.keys(usageByResource).forEach(resourceType => {
        const limit = limitsMap[resourceType];
        const usage = usageByResource[resourceType];
        
        if (limit) {
          usage.monthly_limit = limit.monthly_limit;
          usage.percentage_used = (usage.quantity / limit.monthly_limit) * 100;
          usage.remaining = Math.max(0, limit.monthly_limit - usage.quantity);
          usage.limit_exceeded = usage.quantity >= limit.monthly_limit;
          usage.overage_allowed = limit.allow_overage;
        }
      });
      
      // Get organization details
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .select('plan_id, monthly_responses_limit')
        .eq('id', organizationId)
        .single();
      
      if (orgError) throw orgError;
      
      return {
        organizationId,
        planId: org.plan_id,
        planInfo: this.plans[org.plan_id],
        currentMonth: {
          year: currentYear,
          month: currentMonth,
          usageByResource,
          usageByPlatform,
          totalCostCents: totalCostThisMonth,
          totalTokensUsed,
          limits: limitsMap
        },
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error getting enhanced usage stats:', error);
      throw error;
    }
  }

  /**
   * Set usage limits for organization and resource type
   */
  async setUsageLimit(organizationId, resourceType, monthlyLimit, options = {}) {
    try {
      const {
        dailyLimit = null,
        allowOverage = false,
        overageRateCents = 0,
        hardLimit = true
      } = options;
      
      const { data, error } = await this.supabase
        .from('usage_limits')
        .upsert({
          organization_id: organizationId,
          resource_type: resourceType,
          monthly_limit: monthlyLimit,
          daily_limit: dailyLimit,
          allow_overage: allowOverage,
          overage_rate_cents: overageRateCents,
          hard_limit: hardLimit,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,resource_type'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      console.error('Error setting usage limit:', error);
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

      // Get plan limits from database
      const planLimits = await planLimitsService.getPlanLimits(newPlanId);

      const { data: org, error } = await this.supabase
        .from('organizations')
        .update({
          plan_id: newPlanId,
          monthly_responses_limit: planLimits.monthlyResponsesLimit,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select()
        .single();

      if (error) throw error;

      // Update usage limits for new plan
      await this.updatePlanUsageLimits(organizationId, newPlanId);
      
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
        newPlan: {
          ...newPlan,
          ...planLimits
        }
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
      const planLimits = await planLimitsService.getPlanLimits(org.plan_id);
      
      return {
        allowed: planLimits.shieldEnabled,
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

  /**
   * Update usage limits when plan changes
   */
  async updatePlanUsageLimits(organizationId, planId) {
    try {
      const plan = this.plans[planId];
      if (!plan) throw new Error(`Invalid plan: ${planId}`);
      
      // Define limits by plan and resource type
      const planLimits = {
        free: {
          roasts: { monthly: 100, overage: false, hard: true },
          integrations: { monthly: 2, overage: false, hard: true },
          api_calls: { monthly: 200, overage: false, hard: true },
          shield_actions: { monthly: 0, overage: false, hard: true }
        },
        pro: {
          roasts: { monthly: 1000, overage: true, hard: false },
          integrations: { monthly: 5, overage: false, hard: true },
          api_calls: { monthly: 2000, overage: true, hard: false },
          shield_actions: { monthly: 500, overage: true, hard: false }
        },
        creator_plus: {
          roasts: { monthly: 5000, overage: true, hard: false },
          integrations: { monthly: 999, overage: true, hard: false },
          api_calls: { monthly: 10000, overage: true, hard: false },
          shield_actions: { monthly: 2000, overage: true, hard: false }
        },
        custom: {
          roasts: { monthly: 999999, overage: true, hard: false },
          integrations: { monthly: 999, overage: true, hard: false },
          api_calls: { monthly: 999999, overage: true, hard: false },
          shield_actions: { monthly: 999999, overage: true, hard: false }
        }
      };
      
      const limits = planLimits[planId];
      if (!limits) return;
      
      // Update or insert limits for each resource type
      for (const [resourceType, config] of Object.entries(limits)) {
        await this.setUsageLimit(organizationId, resourceType, config.monthly, {
          allowOverage: config.overage,
          hardLimit: config.hard
        });
      }
      
    } catch (error) {
      console.error('Error updating plan usage limits:', error);
      throw error;
    }
  }

  /**
   * Reset monthly usage for all organizations (cron job)
   */
  async resetAllMonthlyUsage() {
    try {
      const { data: resetCount, error } = await this.supabase
        .rpc('reset_monthly_usage');
      
      if (error) throw error;
      
      console.log(`Monthly usage reset completed for ${resetCount} organizations`);
      
      return {
        success: true,
        organizationsReset: resetCount,
        resetAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      throw error;
    }
  }

  /**
   * Get alert history for organization (Issue 72 requirement)
   */
  async getAlertHistory(organizationId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        resourceType = null,
        dateFrom = null,
        dateTo = null,
        alertType = null
      } = options;

      let query = this.supabase
        .from('app_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('category', 'usage_alert')
        .order('created_at', { ascending: false });

      // Apply filters
      if (resourceType) {
        query = query.eq('metadata->>resourceType', resourceType);
      }

      if (alertType) {
        query = query.eq('metadata->>alertType', alertType);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: alerts, error, count } = await query;

      if (error) throw error;

      // Get total count for pagination
      const { count: totalCount, error: countError } = await this.supabase
        .from('app_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('category', 'usage_alert');

      if (countError) throw countError;

      return {
        alerts: alerts || [],
        pagination: {
          limit,
          offset,
          total: totalCount || 0,
          hasMore: (offset + limit) < (totalCount || 0)
        },
        filters: {
          resourceType,
          alertType,
          dateFrom,
          dateTo
        }
      };

    } catch (error) {
      console.error('Error getting alert history:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics for organization
   */
  async getAlertStats(organizationId, days = 30) {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      // Get alert counts by resource type
      const { data: alerts, error } = await this.supabase
        .from('app_logs')
        .select('metadata')
        .eq('organization_id', organizationId)
        .eq('category', 'usage_alert')
        .gte('created_at', dateFrom.toISOString());

      if (error) throw error;

      // Process statistics
      const stats = {
        total: alerts.length,
        byResourceType: {},
        byThreshold: {},
        recentAlerts: 0
      };

      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      alerts.forEach(alert => {
        const metadata = alert.metadata || {};
        const resourceType = metadata.resourceType || 'unknown';
        const threshold = metadata.thresholdPercentage || 80;
        
        // Count by resource type
        stats.byResourceType[resourceType] = (stats.byResourceType[resourceType] || 0) + 1;
        
        // Count by threshold
        stats.byThreshold[threshold] = (stats.byThreshold[threshold] || 0) + 1;
      });

      return {
        organizationId,
        period: `${days} days`,
        stats,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting alert stats:', error);
      throw error;
    }
  }
}

module.exports = CostControlService;