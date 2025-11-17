/**
 * Audit Log Service
 * 
 * Tracks critical system events for security and compliance
 */

const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const fs = require('fs').promises;
const path = require('path');

class AuditLogService {
  constructor() {
    this.logFile = path.join(process.cwd(), 'data', 'audit.log');
    this.eventTypes = {
      // Authentication events
      'auth.login': { severity: 'info', description: 'User login' },
      'auth.logout': { severity: 'info', description: 'User logout' },
      'auth.reset_request': { severity: 'warning', description: 'Password reset requested' },
      'auth.reset_complete': { severity: 'info', description: 'Password reset completed' },
      'auth.failed_login': { severity: 'warning', description: 'Failed login attempt' },
      
      // Billing events
      'billing.checkout_created': { severity: 'info', description: 'Checkout session created' },
      'billing.webhook_received': { severity: 'info', description: 'Stripe webhook received' },
      'billing.subscription_updated': { severity: 'info', description: 'Subscription updated' },
      'billing.payment_failed': { severity: 'warning', description: 'Payment failed' },
      'billing.subscription_cancelled': { severity: 'warning', description: 'Subscription cancelled' },
      
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
      'admin.backoffice_settings_changed': { severity: 'warning', description: 'Admin changed backoffice settings' },
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
   */
  async logEvent(eventType, details = {}) {
    try {
      const eventConfig = this.eventTypes[eventType];
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
          logger.warn('Failed to save audit log to database, falling back to file:', dbError.message);
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
    const { error } = await supabaseServiceClient
      .from('audit_logs')
      .insert(auditEntry);

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
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(log => log !== null)
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
   */
  async logUserLogin(userId, ipAddress, userAgent) {
    return this.logEvent('auth.login', {
      userId,
      ipAddress,
      userAgent
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

      data.forEach(log => {
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
      starter_trial: 0,  // Issue #488: 'free' renamed to 'starter_trial'
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
      changeType  // Now correctly labels transitions
    });
  }

  async logAdminUserModification(adminId, targetUserId, modifications, adminEmail) {
    return this.logEvent('admin.user_modified', {
      userId: adminId,
      targetUserId,
      modifications,  // logEvent() will stringify this in details field
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