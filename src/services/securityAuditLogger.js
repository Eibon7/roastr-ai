const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const crypto = require('crypto');

class SecurityAuditLogger {
  constructor() {
    this.enabled = flags.isEnabled('ENABLE_SECURITY_AUDIT_LOGGING');
    this.logBuffer = [];
    this.maxBufferSize = 100;
    this.flushInterval = 30 * 1000; // 30 seconds
    
    // Start buffer flushing if enabled
    if (this.enabled) {
      setInterval(() => this.flushBuffer(), this.flushInterval);
    }
  }

  async logSecurityEvent(eventType, details = {}, req = null) {
    if (!this.enabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    
    // Sanitize PII from details to protect user privacy
    const sanitizedDetails = this.sanitizePII({
      ...details,
      method: req?.method,
      path: req?.path,
      query: req?.query ? JSON.stringify(req.query) : null,
      referrer: req?.get('Referer') || null
    });

    const eventData = {
      event_type: eventType,
      timestamp,
      ip_address: this.hashIP(req?.ip || 'unknown'), // Hash IP for privacy
      user_agent: this.sanitizeUserAgent(req?.get('User-Agent') || 'unknown'),
      user_id: req?.user?.id || null,
      organization_id: req?.user?.organization_id || null,
      session_id: req?.sessionID || req?.session?.id || null,
      request_id: req?.id || null,
      details: sanitizedDetails,
      severity: this.getSeverityLevel(eventType),
      created_at: timestamp
    };

    // Log immediately to application logs
    logger.warn('Security event detected', eventData);

    // Add to buffer for database logging
    this.logBuffer.push(eventData);

    // Flush immediately for high-severity events
    if (eventData.severity === 'critical' || eventData.severity === 'high') {
      await this.flushBuffer();
    } else if (this.logBuffer.length >= this.maxBufferSize) {
      await this.flushBuffer();
    }
  }

  getSeverityLevel(eventType) {
    const severityMap = {
      // Critical events
      'account_takeover_attempt': 'critical',
      'admin_privilege_escalation': 'critical',
      'sql_injection_attempt': 'critical',
      'data_breach_attempt': 'critical',
      
      // High events
      'brute_force_attack': 'high',
      'suspicious_login_pattern': 'high',
      'csrf_attack_attempt': 'high',
      'xss_attempt': 'high',
      'unauthorized_admin_access': 'high',
      'multiple_failed_logins': 'high',
      
      // Medium events
      'suspicious_api_usage': 'medium',
      'rate_limit_exceeded': 'medium',
      'invalid_csrf_token': 'medium',
      'suspicious_user_agent': 'medium',
      'geolocation_anomaly': 'medium',
      
      // Low events
      'failed_authentication': 'low',
      'invalid_session': 'low',
      'expired_token': 'low',
      'malformed_request': 'low'
    };

    return severityMap[eventType] || 'medium';
  }

  async flushBuffer() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      if (supabaseServiceClient && flags.isEnabled('ENABLE_SUPABASE')) {
        const { error } = await supabaseServiceClient
          .from('security_audit_logs')
          .insert(eventsToFlush);

        if (error) {
          logger.error('Failed to flush security audit logs to database', { 
            error: error.message,
            eventCount: eventsToFlush.length 
          });
          // Re-add events to buffer for retry
          this.logBuffer.unshift(...eventsToFlush);
        } else {
          logger.debug('Security audit logs flushed to database', { 
            eventCount: eventsToFlush.length 
          });
        }
      }
    } catch (error) {
      logger.error('Error flushing security audit logs', { 
        error: error.message,
        eventCount: eventsToFlush.length 
      });
      // Re-add events to buffer for retry
      this.logBuffer.unshift(...eventsToFlush);
    }
  }

  // PII protection methods
  hashIP(ip) {
    if (!ip || ip === 'unknown') return 'unknown';
    // Hash IP address for privacy while maintaining uniqueness
    return crypto.createHash('sha256').update(ip + process.env.SECURITY_SALT || 'default-salt').digest('hex').substring(0, 16);
  }

  sanitizeUserAgent(userAgent) {
    if (!userAgent || userAgent === 'unknown') return 'unknown';
    // Keep only browser family and OS, remove specific version info
    const sanitized = userAgent.replace(/[\d\.]+/g, 'x.x');
    return sanitized.length > 200 ? sanitized.substring(0, 200) + '...' : sanitized;
  }

  sanitizePII(details) {
    const sensitiveKeys = ['email', 'password', 'token', 'ssn', 'phone', 'address', 'name'];
    const sanitized = { ...details };

    // Recursively sanitize nested objects
    const sanitizeValue = (obj) => {
      if (typeof obj === 'string') {
        // Remove potential PII patterns
        return obj
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email
          .replace(/\b\d{3}-?\d{3}-?\d{4}\b/g, '[PHONE]') // Phone
          .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]') // SSN
          .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]'); // Credit card
      } else if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeValue(value);
          }
        }
        return result;
      }
      return obj;
    };

    return sanitizeValue(sanitized);
  }

  // Convenience methods for common security events
  async logFailedLogin(req, reason = 'invalid_credentials') {
    return this.logSecurityEvent('failed_authentication', { reason }, req);
  }

  async logSuspiciousActivity(req, activityType, details = {}) {
    return this.logSecurityEvent('suspicious_api_usage', { 
      activity_type: activityType, 
      ...details 
    }, req);
  }

  async logBruteForceAttempt(req, targetResource, attemptCount) {
    return this.logSecurityEvent('brute_force_attack', { 
      target_resource: targetResource,
      attempt_count: attemptCount 
    }, req);
  }

  async logCSRFAttempt(req, tokenProvided = null) {
    return this.logSecurityEvent('csrf_attack_attempt', { 
      token_provided: !!tokenProvided,
      endpoint: req.path 
    }, req);
  }

  async logRateLimitExceeded(req, limitType, currentCount, maxAllowed) {
    return this.logSecurityEvent('rate_limit_exceeded', { 
      limit_type: limitType,
      current_count: currentCount,
      max_allowed: maxAllowed 
    }, req);
  }

  async logUnauthorizedAccess(req, resourceType, requiredPermission) {
    return this.logSecurityEvent('unauthorized_admin_access', { 
      resource_type: resourceType,
      required_permission: requiredPermission 
    }, req);
  }

  async logSQLInjectionAttempt(req, suspiciousInput, field) {
    return this.logSecurityEvent('sql_injection_attempt', { 
      suspicious_input: suspiciousInput?.substring(0, 500), // Limit length
      field 
    }, req);
  }

  async logXSSAttempt(req, suspiciousInput, field) {
    return this.logSecurityEvent('xss_attempt', { 
      suspicious_input: suspiciousInput?.substring(0, 500), // Limit length
      field 
    }, req);
  }

  // Analytics methods
  async getSecurityMetrics(timeRange = '24h') {
    if (!supabaseServiceClient || !flags.isEnabled('ENABLE_SUPABASE')) {
      return { error: 'Database not available' };
    }

    try {
      const startTime = new Date();
      if (timeRange === '24h') {
        startTime.setHours(startTime.getHours() - 24);
      } else if (timeRange === '7d') {
        startTime.setDate(startTime.getDate() - 7);
      } else if (timeRange === '30d') {
        startTime.setDate(startTime.getDate() - 30);
      }

      const { data, error } = await supabaseServiceClient
        .from('security_audit_logs')
        .select('event_type, severity, created_at')
        .gte('created_at', startTime.toISOString());

      if (error) {
        throw error;
      }

      const metrics = {
        total_events: data.length,
        by_severity: {},
        by_event_type: {},
        timeline: {}
      };

      data.forEach(event => {
        // Count by severity
        metrics.by_severity[event.severity] = (metrics.by_severity[event.severity] || 0) + 1;
        
        // Count by event type
        metrics.by_event_type[event.event_type] = (metrics.by_event_type[event.event_type] || 0) + 1;
        
        // Timeline (by hour)
        const hour = new Date(event.created_at).toISOString().substring(0, 13);
        metrics.timeline[hour] = (metrics.timeline[hour] || 0) + 1;
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to get security metrics', { error: error.message });
      return { error: error.message };
    }
  }
}

// Export singleton instance
const securityAuditLogger = new SecurityAuditLogger();

module.exports = {
  securityAuditLogger,
  SecurityAuditLogger
};