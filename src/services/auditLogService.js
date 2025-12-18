/**
 * Audit Log Service
 *
 * Tracks critical system events for security and compliance
 * ROA-357: Updated to support Auth Events Taxonomy v2
 */

const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const fs = require('fs').promises;
const path = require('path');
const {
  getFlatEventTypes,
  getEventConfig,
  mapV1ToV2,
  isValidV2EventId
} = require('../config/authEventsTaxonomy');

class AuditLogService {
  constructor() {
    this.logFile = path.join(process.cwd(), 'data', 'audit.log');
    
    // ROA-357: Combine v1 events (for backward compatibility) with v2 taxonomy
    const v2AuthEvents = getFlatEventTypes();
    this.eventTypes = {
      // Authentication events v1 (legacy - maintained for backward compatibility)
      'auth.login': { severity: 'info', description: 'User login' },
      'auth.logout': { severity: 'info', description: 'User logout' },
      'auth.reset_request': { severity: 'warning', description: 'Password reset requested' },
      'auth.reset_complete': { severity: 'info', description: 'Password reset completed' },
      'auth.failed_login': { severity: 'warning', description: 'Failed login attempt' },
      
      // Authentication events v2 (ROA-357: New hierarchical taxonomy)
      ...v2AuthEvents,

      // Billing events
      'billing.checkout_created': { severity: 'info', description: 'Checkout session created' },
      'billing.webhook_received': { severity: 'info', description: 'Stripe webhook received' },
      'billing.subscription_updated': { severity: 'info', description: 'Subscription updated' },
      'billing.payment_failed': { severity: 'warning', description: 'Payment failed' },
      'billing.subscription_cancelled': {
        severity: 'warning',
        description: 'Subscription cancelled'
      },

      // Integration events
      'integrations.connect': { severity: 'info', description: 'Platform connected' },
      'integrations.disconnect': { severity: 'info', description: 'Platform disconnected' },
      'integrations.oauth_failed': { severity: 'warning', description: 'OAuth failed' },

      // User management
      'user.suspend': { severity: 'warning', description: 'User suspended' },
      'user.reactivate': { severity: 'info', description: 'User reactivated' },
      'user.created': { severity: 'info', description: 'User account created' },
      'user.deleted': { severity: 'warning', description: 'User account deleted' },

      // Admin actions (Issue #261: Centralized security audit logging)
      'admin.user_plan_changed': { severity: 'warning', description: 'Admin changed user plan' },
      'admin.user_suspended': { severity: 'warning', description: 'Admin suspended user' },
      'admin.user_reactivated': { severity: 'info', description: 'Admin reactivated user' },
      'admin.user_modified': { severity: 'info', description: 'Admin modified user data' },
      'admin.bulk_action': { severity: 'warning', description: 'Admin performed bulk action' },
      'admin.feature_flag_changed': { severity: 'info', description: 'Admin changed feature flag' },
      'admin.backoffice_settings_changed': {
        severity: 'warning',
        description: 'Admin changed backoffice settings'
      },
      'admin.plan_update': { severity: 'warning', description: 'Admin updated plan limits' },
      'admin.access_denied': { severity: 'error', description: 'Admin access denied' },

      // System events
      'system.api_error': { severity: 'error', description: 'API error occurred' },
      'system.rate_limit': { severity: 'warning', description: 'Rate limit triggered' },
      'system.feature_flag_changed': { severity: 'info', description: 'Feature flag changed' }
    };
  }

  /**
   * Log an audit event
   * ROA-357: Supports both v1 and v2 event formats
   * 
   * @param {string} eventType - Event type (v1 or v2 format)
   * @param {object} details - Event details
   * @returns {Promise<boolean>} Success status
   */
  async logEvent(eventType, details = {}) {
    try {
      // ROA-357: Try v2 taxonomy first, then fallback to v1
      let eventConfig = null;
      
      // Check if it's a v2 event
      if (eventType.startsWith('auth.') && isValidV2EventId(eventType)) {
        const v2Config = getEventConfig(eventType);
        if (v2Config) {
          eventConfig = v2Config;
        }
      }
      
      // Fallback to v1 or other event types
      if (!eventConfig) {
        eventConfig = this.eventTypes[eventType];
      }
      
      // If still not found, try mapping v1 to v2
      if (!eventConfig && eventType.startsWith('auth.')) {
        const v2EventId = mapV1ToV2(eventType);
        if (v2EventId) {
          const v2Config = getEventConfig(v2EventId);
          if (v2Config) {
            eventConfig = v2Config;
            // Log with v2 event ID for better taxonomy
            eventType = v2EventId;
          }
        }
      }
      
      if (!eventConfig) {
        logger.warn('Unknown audit event type:', eventType);
        return false;
      }

      const auditEntry = {
        event_type: eventType,
        severity: eventConfig.severity,
        description: eventConfig.description,
        user_id: details.userId || null,
        ip_address: details.ipAddress || null,
        user_agent: details.userAgent || null,
        details: JSON.stringify({
          ...details,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development'
        }),
        created_at: new Date().toISOString()
      };

      // Try to save to database first
      if (flags.isEnabled('ENABLE_SUPABASE')) {
        try {
          await this.saveToDatabaseAuditLog(auditEntry);
          logger.debug('Audit event saved to database:', eventType);
          return true;
        } catch (dbError) {
          logger.warn(
            'Failed to save audit log to database, falling back to file:',
            dbError.message
          );
        }
      }

      // Fallback to file logging
      await this.saveToFileAuditLog(auditEntry);
      logger.debug('Audit event saved to file:', eventType);
      return true;
    } catch (error) {
      logger.error('Failed to log audit event:', error);
      return false;
    }
  }

  /**
   * Save audit log to database
   */
  async saveToDatabaseAuditLog(auditEntry) {
    const { error } = await supabaseServiceClient.from('audit_logs').insert(auditEntry);

    if (error) {
      throw new Error(`Database audit log error: ${error.message}`);
    }
  }

  /**
   * Save audit log to file
   */
  async saveToFileAuditLog(auditEntry) {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(this.logFile), { recursive: true });

    const logLine = JSON.stringify(auditEntry) + '\n';
    await fs.appendFile(this.logFile, logLine);
  }

  /**
   * Get recent audit logs (for admin interface)
   */
  async getRecentLogs(filters = {}) {
    try {
      if (flags.isEnabled('ENABLE_SUPABASE')) {
        return await this.getLogsFromDatabase(filters);
      } else {
        return await this.getLogsFromFile(filters);
      }
    } catch (error) {
      logger.error('Failed to retrieve audit logs:', error);
      return {
        success: false,
        error: 'Failed to retrieve audit logs'
      };
    }
  }

  /**
   * Get logs from database
   */
  async getLogsFromDatabase(filters = {}) {
    let query = supabaseServiceClient
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100);

    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    return {
      success: true,
      data: data || [],
      source: 'database'
    };
  }

  /**
   * Get logs from file (simplified implementation)
   */
  async getLogsFromFile(filters = {}) {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const lines = content.trim().split('\n');

      const logs = lines
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((log) => log !== null)
        .slice(0, filters.limit || 100);

      return {
        success: true,
        data: logs,
        source: 'file'
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: true,
          data: [],
          source: 'file'
        };
      }
      throw error;
    }
  }

  /**
   * Helper methods for common events
   * ROA-357: Updated to use v2 taxonomy
   */
  
  // Session events
  async logUserLogin(userId, ipAddress, userAgent) {
    // Use v2 event ID
    return this.logEvent('auth.session.login.success', {
      userId,
      ipAddress,
      userAgent
    });
  }
  
  async logUserLoginFailed(userId, ipAddress, userAgent, reason = 'invalid_credentials') {
    return this.logEvent('auth.session.login.failed', {
      userId,
      ipAddress,
      userAgent,
      reason
    });
  }
  
  async logUserLoginBlocked(userId, ipAddress, userAgent, reason) {
    return this.logEvent('auth.session.login.blocked', {
      userId,
      ipAddress,
      userAgent,
      reason
    });
  }
  
  async logUserLogout(userId, ipAddress, userAgent, type = 'manual') {
    const eventId = type === 'automatic' 
      ? 'auth.session.logout.automatic'
      : 'auth.session.logout.manual';
    return this.logEvent(eventId, {
      userId,
      ipAddress,
      userAgent
    });
  }
  
  async logSessionExpired(userId, ipAddress) {
    return this.logEvent('auth.session.expired', {
      userId,
      ipAddress
    });
  }
  
  async logSessionRefresh(userId, success = true) {
    const eventId = success 
      ? 'auth.session.refresh.success'
      : 'auth.session.refresh.failed';
    return this.logEvent(eventId, {
      userId
    });
  }
  
  // Registration events
  async logUserSignup(userId, email, success = true) {
    const eventId = success
      ? 'auth.registration.signup.success'
      : 'auth.registration.signup.failed';
    return this.logEvent(eventId, {
      userId,
      email
    });
  }
  
  async logEmailVerificationSent(userId, email) {
    return this.logEvent('auth.registration.email_verification.sent', {
      userId,
      email
    });
  }
  
  async logEmailVerificationVerified(userId, email) {
    return this.logEvent('auth.registration.email_verification.verified', {
      userId,
      email
    });
  }
  
  async logEmailVerificationExpired(userId, email) {
    return this.logEvent('auth.registration.email_verification.expired', {
      userId,
      email
    });
  }
  
  // Password events
  async logPasswordResetRequested(userId, email) {
    return this.logEvent('auth.password.reset.requested', {
      userId,
      email
    });
  }
  
  async logPasswordResetCompleted(userId, email) {
    return this.logEvent('auth.password.reset.completed', {
      userId,
      email
    });
  }
  
  async logPasswordResetFailed(userId, email, reason) {
    return this.logEvent('auth.password.reset.failed', {
      userId,
      email,
      reason
    });
  }
  
  async logPasswordChange(userId, success = true, reason = null) {
    const eventId = success
      ? 'auth.password.change.success'
      : 'auth.password.change.failed';
    return this.logEvent(eventId, {
      userId,
      reason
    });
  }
  
  // Magic link events
  async logMagicLinkLoginSent(userId, email) {
    return this.logEvent('auth.magic_link.login.sent', {
      userId,
      email
    });
  }
  
  async logMagicLinkLoginUsed(userId, email) {
    return this.logEvent('auth.magic_link.login.used', {
      userId,
      email
    });
  }
  
  async logMagicLinkLoginExpired(userId, email) {
    return this.logEvent('auth.magic_link.login.expired', {
      userId,
      email
    });
  }
  
  async logMagicLinkSignupSent(email) {
    return this.logEvent('auth.magic_link.signup.sent', {
      email
    });
  }
  
  async logMagicLinkSignupUsed(userId, email) {
    return this.logEvent('auth.magic_link.signup.used', {
      userId,
      email
    });
  }
  
  async logMagicLinkSignupExpired(email) {
    return this.logEvent('auth.magic_link.signup.expired', {
      email
    });
  }
  
  // OAuth events
  async logOAuthInitiated(provider, userId = null) {
    return this.logEvent('auth.oauth.initiated', {
      provider,
      userId
    });
  }
  
  async logOAuthCallback(provider, userId, success = true, error = null) {
    const eventId = success
      ? 'auth.oauth.callback.success'
      : 'auth.oauth.callback.failed';
    return this.logEvent(eventId, {
      provider,
      userId,
      error
    });
  }
  
  async logOAuthTokenRefresh(provider, userId, success = true) {
    const eventId = success
      ? 'auth.oauth.token_refresh.success'
      : 'auth.oauth.token_refresh.failed';
    return this.logEvent(eventId, {
      provider,
      userId
    });
  }

  async logBillingEvent(eventType, details) {
    return this.logEvent(`billing.${eventType}`, details);
  }

  async logIntegrationEvent(eventType, userId, platform, details = {}) {
    return this.logEvent(`integrations.${eventType}`, {
      userId,
      platform,
      ...details
    });
  }

  async logSystemEvent(eventType, details) {
    return this.logEvent(`system.${eventType}`, details);
  }

  /**
   * Get event type statistics
   */
  async getEventStats(timeRange = '24h') {
    try {
      if (!flags.isEnabled('ENABLE_SUPABASE')) {
        return {
          success: false,
          error: 'Statistics only available with database'
        };
      }

      const startDate = this.getStartDateForRange(timeRange);

      const { data, error } = await supabaseServiceClient
        .from('audit_logs')
        .select('event_type, severity, created_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const stats = {
        total: data.length,
        byType: {},
        bySeverity: {
          info: 0,
          warning: 0,
          error: 0
        }
      };

      data.forEach((log) => {
        // Count by type
        stats.byType[log.event_type] = (stats.byType[log.event_type] || 0) + 1;

        // Count by severity
        stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      });

      return {
        success: true,
        data: stats,
        timeRange
      };
    } catch (error) {
      logger.error('Failed to get event stats:', error);
      return {
        success: false,
        error: 'Failed to retrieve event statistics'
      };
    }
  }

  /**
   * Get start date for time range
   */
  getStartDateForRange(timeRange) {
    const now = new Date();

    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }
  }

  /**
   * Clean old audit logs (for maintenance)
   */
  async cleanOldLogs(olderThanDays = 90) {
    try {
      if (flags.isEnabled('ENABLE_SUPABASE')) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const { error } = await supabaseServiceClient
          .from('audit_logs')
          .delete()
          .lt('created_at', cutoffDate.toISOString());

        if (error) {
          throw error;
        }

        logger.info(`Cleaned audit logs older than ${olderThanDays} days`);
        return true;
      } else {
        logger.info('File-based audit logs require manual cleanup');
        return false;
      }
    } catch (error) {
      logger.error('Failed to clean old audit logs:', error);
      return false;
    }
  }

  /**
   * Helper methods for admin events (Issue #261)
   */
  async logAdminPlanChange(adminId, targetUserId, oldPlan, newPlan, adminEmail) {
    // CRITICAL FIX M2: Use plan weight comparison, not lexicographical
    // Plan hierarchy aligned with billing system
    const PLAN_WEIGHTS = {
      starter_trial: 0, // Issue #488: 'free' renamed to 'starter_trial'
      starter: 1,
      pro: 2,
      creator_plus: 3,
      plus: 4,
      enterprise: 5,
      custom: 6
    };

    const oldWeight = PLAN_WEIGHTS[oldPlan] ?? -1;
    const newWeight = PLAN_WEIGHTS[newPlan] ?? -1;

    let changeType;
    if (oldWeight < newWeight) {
      changeType = 'upgrade';
    } else if (oldWeight > newWeight) {
      changeType = 'downgrade';
    } else {
      changeType = 'no_change';
    }

    return this.logEvent('admin.user_plan_changed', {
      userId: adminId,
      targetUserId,
      oldPlan,
      newPlan,
      adminEmail,
      action: 'plan_change',
      changeType // Now correctly labels transitions
    });
  }

  async logAdminUserModification(adminId, targetUserId, modifications, adminEmail) {
    return this.logEvent('admin.user_modified', {
      userId: adminId,
      targetUserId,
      modifications, // logEvent() will stringify this in details field
      adminEmail,
      action: 'user_modification'
    });
  }

  async logAdminBulkAction(adminId, action, affectedCount, adminEmail, details = {}) {
    return this.logEvent('admin.bulk_action', {
      userId: adminId,
      action,
      affectedCount,
      adminEmail,
      ...details
    });
  }

  async logAdminAccessDenied(userId, attemptedAction, reason, ipAddress) {
    return this.logEvent('admin.access_denied', {
      userId,
      attemptedAction,
      reason,
      ipAddress
    });
  }
}

// Create singleton instance
const auditLogger = new AuditLogService();

module.exports = {
  auditLogger,
  AuditLogService
};
