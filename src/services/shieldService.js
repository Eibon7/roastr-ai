const { createClient } = require('@supabase/supabase-js');
const CostControlService = require('./costControl');

/**
 * Shield Service for Roastr.ai Multi-Tenant Architecture
 * 
 * Advanced toxicity protection and automated moderation:
 * - High-priority toxicity analysis
 * - Automated user behavior tracking
 * - Escalating response actions (mute, block, report)
 * - Reincidence detection and prevention
 * - Integration with worker queue system
 */
class ShieldService {
  constructor(options = {}) {
    this.options = {
      enabled: process.env.ROASTR_SHIELD_ENABLED === 'true',
      autoActions: process.env.SHIELD_AUTO_ACTIONS === 'true',
      reincidenceThreshold: parseInt(process.env.SHIELD_REINCIDENCE_THRESHOLD) || 3,
      severityEscalation: process.env.SHIELD_SEVERITY_ESCALATION !== 'false',
      ...options
    };
    
    // Initialize connections
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    
    this.costControl = new CostControlService();
    
    // Shield priority levels
    this.priorityLevels = {
      low: 5,      // Normal queue priority
      medium: 3,   // Elevated priority
      high: 2,     // High priority for repeat offenders
      critical: 1  // Highest priority for severe threats
    };
    
    // Action escalation matrix
    this.actionMatrix = {
      low: {
        first: 'warn',
        repeat: 'mute_temp',
        persistent: 'mute_permanent'
      },
      medium: {
        first: 'mute_temp',
        repeat: 'mute_permanent',
        persistent: 'block'
      },
      high: {
        first: 'mute_permanent',
        repeat: 'block',
        persistent: 'report'
      },
      critical: {
        first: 'block',
        repeat: 'report',
        persistent: 'escalate'
      }
    };
    
    this.log('info', 'Shield Service initialized', {
      enabled: this.options.enabled,
      autoActions: this.options.autoActions,
      reincidenceThreshold: this.options.reincidenceThreshold
    });
  }
  
  /**
   * Analyze comment for Shield-level threats
   */
  async analyzeForShield(organizationId, comment, analysisResult) {
    if (!this.options.enabled) {
      return { shieldActive: false, reason: 'disabled' };
    }
    
    try {
      // Check if organization has Shield access
      const canUseShield = await this.costControl.canUseShield(organizationId);
      
      if (!canUseShield.allowed) {
        return { 
          shieldActive: false, 
          reason: 'plan_restriction',
          planRequired: 'pro_or_higher'
        };
      }
      
      // Calculate Shield priority based on severity
      const priority = this.calculateShieldPriority(analysisResult);
      
      // Get user behavior history
      const userBehavior = await this.getUserBehavior(
        organizationId,
        comment.platform,
        comment.platform_user_id
      );
      
      // Determine Shield actions
      const shieldActions = await this.determineShieldActions(
        analysisResult,
        userBehavior,
        comment
      );
      
      // Create high-priority analysis job if needed
      if (priority <= this.priorityLevels.high) {
        await this.queueHighPriorityAnalysis(organizationId, comment, priority);
      }
      
      // Execute automatic actions if enabled
      if (this.options.autoActions && shieldActions.autoExecute) {
        await this.executeShieldActions(organizationId, comment, shieldActions);
      }
      
      // Log Shield activity
      await this.logShieldActivity(organizationId, comment, {
        priority,
        actions: shieldActions,
        userBehavior,
        analysisResult
      });
      
      return {
        shieldActive: true,
        priority,
        actions: shieldActions,
        userBehavior,
        autoExecuted: this.options.autoActions && shieldActions.autoExecute
      };
      
    } catch (error) {
      this.log('error', 'Shield analysis failed', {
        commentId: comment.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Calculate Shield priority based on toxicity analysis
   */
  calculateShieldPriority(analysisResult) {
    const { severity_level, toxicity_score, categories } = analysisResult;
    
    // Critical priority for severe threats
    if (severity_level === 'critical' || toxicity_score >= 0.95) {
      return this.priorityLevels.critical;
    }
    
    // High priority for high toxicity or threat categories
    if (severity_level === 'high' || 
        categories?.some(cat => ['threat', 'hate', 'harassment'].includes(cat))) {
      return this.priorityLevels.high;
    }
    
    // Medium priority for medium toxicity
    if (severity_level === 'medium' || toxicity_score >= 0.6) {
      return this.priorityLevels.medium;
    }
    
    // Low priority for everything else
    return this.priorityLevels.low;
  }
  
  /**
   * Get user behavior history for Shield analysis
   */
  async getUserBehavior(organizationId, platform, platformUserId) {
    try {
      const { data: behavior, error } = await this.supabase
        .from('user_behaviors')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .eq('platform_user_id', platformUserId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error;
      }
      
      return behavior || this.createNewUserBehavior(organizationId, platform, platformUserId);
      
    } catch (error) {
      this.log('error', 'Failed to get user behavior', {
        organizationId,
        platform,
        platformUserId,
        error: error.message
      });
      return this.createNewUserBehavior(organizationId, platform, platformUserId);
    }
  }
  
  /**
   * Create new user behavior record
   */
  createNewUserBehavior(organizationId, platform, platformUserId) {
    return {
      organization_id: organizationId,
      platform,
      platform_user_id: platformUserId,
      total_comments: 0,
      total_violations: 0,
      severity_counts: { low: 0, medium: 0, high: 0, critical: 0 },
      actions_taken: [],
      is_blocked: false,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };
  }
  
  /**
   * Determine Shield actions based on analysis and user history
   */
  async determineShieldActions(analysisResult, userBehavior, comment) {
    const { severity_level } = analysisResult;
    const violationCount = userBehavior.total_violations || 0;
    
    // Determine offense level
    let offenseLevel = 'first';
    if (violationCount >= this.options.reincidenceThreshold) {
      offenseLevel = 'persistent';
    } else if (violationCount > 0) {
      offenseLevel = 'repeat';
    }
    
    // Get action from matrix
    const actionType = this.actionMatrix[severity_level]?.[offenseLevel] || 'warn';
    
    const actions = {
      primary: actionType,
      severity: severity_level,
      offenseLevel,
      violationCount,
      autoExecute: this.shouldAutoExecute(actionType, severity_level),
      escalate: severity_level === 'critical' && offenseLevel === 'persistent'
    };
    
    // Add platform-specific actions
    actions.platformActions = await this.getPlatformSpecificActions(
      comment.platform,
      actionType,
      comment
    );
    
    return actions;
  }
  
  /**
   * Determine if action should be auto-executed
   */
  shouldAutoExecute(actionType, severityLevel) {
    if (!this.options.autoActions) return false;
    
    // Always auto-execute for critical severity
    if (severityLevel === 'critical') return true;
    
    // Auto-execute certain actions
    const autoActions = ['warn', 'mute_temp', 'mute_permanent'];
    return autoActions.includes(actionType);
  }
  
  /**
   * Get platform-specific Shield actions
   */
  async getPlatformSpecificActions(platform, actionType, comment) {
    const platformActions = {};
    
    switch (platform) {
      case 'twitter':
        platformActions.twitter = this.getTwitterShieldActions(actionType);
        break;
        
      case 'discord':
        platformActions.discord = this.getDiscordShieldActions(actionType);
        break;
        
      case 'twitch':
        platformActions.twitch = this.getTwitchShieldActions(actionType);
        break;
        
      case 'youtube':
        platformActions.youtube = this.getYouTubeShieldActions(actionType);
        break;
        
      default:
        platformActions[platform] = { action: actionType, available: false };
    }
    
    return platformActions;
  }
  
  /**
   * Get Twitter-specific Shield actions
   */
  getTwitterShieldActions(actionType) {
    const actions = {
      warn: { action: 'reply_warning', available: true },
      mute_temp: { action: 'mute_user', duration: '24h', available: true },
      mute_permanent: { action: 'mute_user', duration: 'permanent', available: true },
      block: { action: 'block_user', available: true },
      report: { action: 'report_user', available: true }
    };
    
    return actions[actionType] || { action: actionType, available: false };
  }
  
  /**
   * Get Discord-specific Shield actions
   */
  getDiscordShieldActions(actionType) {
    const actions = {
      warn: { action: 'send_warning_dm', available: true },
      mute_temp: { action: 'timeout_user', duration: '1h', available: true },
      mute_permanent: { action: 'remove_voice_permissions', available: true },
      block: { action: 'kick_user', available: true },
      report: { action: 'report_to_moderators', available: true }
    };
    
    return actions[actionType] || { action: actionType, available: false };
  }
  
  /**
   * Get Twitch-specific Shield actions
   */
  getTwitchShieldActions(actionType) {
    const actions = {
      warn: { action: 'timeout_user', duration: '60s', available: true },
      mute_temp: { action: 'timeout_user', duration: '10m', available: true },
      mute_permanent: { action: 'ban_user', available: true },
      block: { action: 'ban_user', available: true },
      report: { action: 'report_to_twitch', available: true }
    };
    
    return actions[actionType] || { action: actionType, available: false };
  }
  
  /**
   * Get YouTube-specific Shield actions
   */
  getYouTubeShieldActions(actionType) {
    const actions = {
      warn: { action: 'reply_warning', available: true },
      mute_temp: { action: 'hide_user_comments', duration: '24h', available: false }, // Not available in API
      mute_permanent: { action: 'ban_user_from_channel', available: false }, // Limited API access
      block: { action: 'block_user', available: false },
      report: { action: 'report_comment', available: true }
    };
    
    return actions[actionType] || { action: actionType, available: false };
  }
  
  /**
   * Execute Shield actions automatically
   */
  async executeShieldActions(organizationId, comment, shieldActions) {
    try {
      this.log('info', 'Executing Shield actions', {
        commentId: comment.id,
        platform: comment.platform,
        action: shieldActions.primary
      });
      
      const { platformActions } = shieldActions;
      const platformAction = platformActions[comment.platform];
      
      if (!platformAction?.available) {
        this.log('warn', 'Platform action not available for auto-execution', {
          platform: comment.platform,
          action: shieldActions.primary
        });
        return { executed: false, reason: 'action_not_available' };
      }
      
      // Queue platform-specific action
      await this.queuePlatformAction(organizationId, comment, platformAction);
      
      // Update user behavior
      await this.updateUserBehaviorForAction(
        organizationId,
        comment,
        shieldActions
      );
      
      return { executed: true, action: platformAction };
      
    } catch (error) {
      this.log('error', 'Failed to execute Shield actions', {
        commentId: comment.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Queue high-priority analysis job for Shield
   */
  async queueHighPriorityAnalysis(organizationId, comment, priority) {
    try {
      const analysisJob = {
        organization_id: organizationId,
        job_type: 'analyze_toxicity',
        priority,
        payload: {
          comment_id: comment.id,
          organization_id: organizationId,
          platform: comment.platform,
          text: comment.original_text,
          shield_mode: true,
          shield_priority: priority
        },
        max_attempts: 2, // Fewer retries for Shield jobs
        scheduled_at: new Date().toISOString()
      };
      
      // Insert directly to database for high priority
      const { error } = await this.supabase
        .from('job_queue')
        .insert([analysisJob]);
      
      if (error) throw error;
      
      this.log('info', 'Queued high-priority Shield analysis', {
        commentId: comment.id,
        priority,
        organizationId
      });
      
    } catch (error) {
      this.log('error', 'Failed to queue high-priority analysis', {
        commentId: comment.id,
        error: error.message
      });
    }
  }
  
  /**
   * Queue platform-specific action
   */
  async queuePlatformAction(organizationId, comment, platformAction) {
    try {
      const actionJob = {
        organization_id: organizationId,
        job_type: 'shield_action',
        priority: this.priorityLevels.high,
        payload: {
          comment_id: comment.id,
          organization_id: organizationId,
          platform: comment.platform,
          platform_user_id: comment.platform_user_id,
          platform_username: comment.platform_username,
          action: platformAction.action,
          duration: platformAction.duration,
          shield_mode: true
        },
        max_attempts: 3
      };
      
      const { error } = await this.supabase
        .from('job_queue')
        .insert([actionJob]);
      
      if (error) throw error;
      
      this.log('info', 'Queued platform Shield action', {
        commentId: comment.id,
        platform: comment.platform,
        action: platformAction.action
      });
      
    } catch (error) {
      this.log('error', 'Failed to queue platform action', {
        commentId: comment.id,
        error: error.message
      });
    }
  }
  
  /**
   * Update user behavior after Shield action
   */
  async updateUserBehaviorForAction(organizationId, comment, shieldActions) {
    try {
      const actionRecord = {
        action: shieldActions.primary,
        date: new Date().toISOString(),
        reason: `${shieldActions.severity} severity violation`,
        comment_id: comment.id
      };
      
      const { error } = await this.supabase
        .from('user_behaviors')
        .upsert({
          organization_id: organizationId,
          platform: comment.platform,
          platform_user_id: comment.platform_user_id,
          platform_username: comment.platform_username,
          actions_taken: [actionRecord], // Will be merged with existing
          is_blocked: ['block', 'ban_user'].includes(shieldActions.primary),
          last_seen_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,platform,platform_user_id',
          ignoreDuplicates: false
        });
      
      if (error) throw error;
      
    } catch (error) {
      this.log('error', 'Failed to update user behavior', {
        commentId: comment.id,
        error: error.message
      });
    }
  }
  
  /**
   * Log Shield activity for monitoring
   */
  async logShieldActivity(organizationId, comment, shieldData) {
    try {
      await this.supabase
        .from('app_logs')
        .insert({
          organization_id: organizationId,
          level: 'warn',
          category: 'shield',
          message: `Shield activated: ${shieldData.actions.primary} action for ${shieldData.analysisResult.severity_level} violation`,
          platform: comment.platform,
          metadata: {
            commentId: comment.id,
            userId: comment.platform_user_id,
            username: comment.platform_username,
            priority: shieldData.priority,
            actions: shieldData.actions,
            toxicityScore: shieldData.analysisResult.toxicity_score,
            violationCount: shieldData.userBehavior.total_violations || 0,
            autoExecuted: shieldData.autoExecuted
          }
        });
        
    } catch (error) {
      this.log('error', 'Failed to log Shield activity', {
        commentId: comment.id,
        error: error.message
      });
    }
  }
  
  /**
   * Get Shield statistics for organization
   */
  async getShieldStats(organizationId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get Shield logs
      const { data: shieldLogs, error: logsError } = await this.supabase
        .from('app_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('category', 'shield')
        .gte('created_at', startDate.toISOString());
      
      if (logsError) throw logsError;
      
      // Get user behaviors
      const { data: userBehaviors, error: behaviorsError } = await this.supabase
        .from('user_behaviors')
        .select('*')
        .eq('organization_id', organizationId);
      
      if (behaviorsError) throw behaviorsError;
      
      const stats = {
        totalShieldActivations: shieldLogs.length,
        actionBreakdown: {},
        severityBreakdown: {},
        platformBreakdown: {},
        blockedUsers: userBehaviors.filter(u => u.is_blocked).length,
        totalTrackedUsers: userBehaviors.length,
        averageViolationsPerUser: 0,
        topOffenders: []
      };
      
      // Process Shield logs
      shieldLogs.forEach(log => {
        const metadata = log.metadata || {};
        
        // Action breakdown
        const action = metadata.actions?.primary || 'unknown';
        stats.actionBreakdown[action] = (stats.actionBreakdown[action] || 0) + 1;
        
        // Severity breakdown
        const severity = metadata.toxicityScore >= 0.8 ? 'high' : 
                        metadata.toxicityScore >= 0.6 ? 'medium' : 'low';
        stats.severityBreakdown[severity] = (stats.severityBreakdown[severity] || 0) + 1;
        
        // Platform breakdown
        stats.platformBreakdown[log.platform] = (stats.platformBreakdown[log.platform] || 0) + 1;
      });
      
      // Calculate average violations
      if (userBehaviors.length > 0) {
        const totalViolations = userBehaviors.reduce((sum, user) => 
          sum + (user.total_violations || 0), 0);
        stats.averageViolationsPerUser = (totalViolations / userBehaviors.length).toFixed(2);
      }
      
      // Top offenders
      stats.topOffenders = userBehaviors
        .filter(user => user.total_violations > 0)
        .sort((a, b) => (b.total_violations || 0) - (a.total_violations || 0))
        .slice(0, 10)
        .map(user => ({
          platform: user.platform,
          username: user.platform_username,
          violations: user.total_violations,
          isBlocked: user.is_blocked
        }));
      
      return stats;
      
    } catch (error) {
      this.log('error', 'Failed to get Shield stats', {
        organizationId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Logging utility
   */
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'ShieldService',
      message,
      ...metadata
    };
    
    console.log(`[${level.toUpperCase()}] ${JSON.stringify(logEntry)}`);
  }
}

module.exports = ShieldService;