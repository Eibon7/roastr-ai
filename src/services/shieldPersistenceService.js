const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

/**
 * Shield Persistence Service
 * 
 * Manages Shield event persistence, offender tracking, and recidivism analysis
 * for the Shield decision engine. Handles GDPR-compliant data storage and retrieval.
 */
class ShieldPersistenceService {
  constructor(config = {}) {
    // Validate environment variables for Supabase connection
    this.validateEnvironment();
    
    this.supabase = config.supabase || createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    this.logger = config.logger || logger;
    this.recidivismWindowDays = config.recidivismWindowDays || 90;
  }
  
  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
    const missing = required.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      const error = `Missing required environment variables: ${missing.join(', ')}`;
      if (logger) {
        logger.error('Shield Persistence Service validation failed', { missing });
      }
      throw new Error(error);
    }
  }
  
  /**
   * Generate HMAC-based hash for text anonymization
   * Uses SHA-256 with a secret salt for secure anonymization
   */
  generateTextHash(originalText) {
    if (!originalText || typeof originalText !== 'string') {
      return { hash: null, salt: null };
    }
    
    // Generate unique salt for this record
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Use HMAC-SHA256 with salt for secure hashing
    const secret = process.env.SHIELD_ANONYMIZATION_SECRET;

    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SHIELD_ANONYMIZATION_SECRET environment variable is required in production');
      }
      // In non-production, use HMAC with deterministic fallback secret to match production behavior
      const fallbackSecret = 'shield-dev-fallback-secret-do-not-use-in-production';
      console.warn('⚠️  Using fallback secret for Shield anonymization in non-production environment');
      const hash = crypto.createHmac('sha256', fallbackSecret).update(originalText + salt).digest('hex');
      return { hash, salt };
    }
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(originalText + salt);
    const hash = hmac.digest('hex');
    
    return { hash, salt };
  }
  
  /**
   * Anonymize text records for GDPR compliance
   * Replaces original_text with hash and clears the original content
   */
  async anonymizeShieldEvents(batchSize = 100) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 80); // 80 days ago
      
      this.logger.info('Starting Shield events anonymization', { cutoffDate, batchSize });
      
      // Find records that need anonymization
      const { data: recordsToAnonymize, error: selectError } = await this.supabase
        .from('shield_events')
        .select('id, original_text')
        .is('anonymized_at', null)
        .not('original_text', 'is', null)
        .lte('created_at', cutoffDate.toISOString())
        .limit(batchSize);
      
      if (selectError) throw selectError;
      
      if (!recordsToAnonymize || recordsToAnonymize.length === 0) {
        this.logger.info('No Shield events require anonymization');
        return { processed: 0, errors: [] };
      }
      
      const results = {
        processed: 0,
        errors: []
      };
      
      // Process each record
      for (const record of recordsToAnonymize) {
        try {
          const { hash, salt } = this.generateTextHash(record.original_text);
          
          // Update with hash and remove original text
          const { error: updateError } = await this.supabase
            .from('shield_events')
            .update({
              original_text: null,
              original_text_hash: hash,
              text_salt: salt,
              anonymized_at: new Date().toISOString()
            })
            .eq('id', record.id);
          
          if (updateError) {
            this.logger.error('Failed to anonymize Shield event', {
              eventId: record.id,
              error: updateError.message
            });
            results.errors.push({ id: record.id, error: updateError.message });
          } else {
            results.processed++;
          }
          
        } catch (recordError) {
          this.logger.error('Error processing Shield event for anonymization', {
            eventId: record.id,
            error: recordError.message
          });
          results.errors.push({ id: record.id, error: recordError.message });
        }
      }
      
      this.logger.info('Shield events anonymization completed', results);
      
      // Log the anonymization operation
      await this.logRetentionOperation('anonymize', 'success', {
        recordsProcessed: recordsToAnonymize.length,
        recordsAnonymized: results.processed,
        recordsFailed: results.errors.length,
        cutoffDate: cutoffDate.toISOString()
      });
      
      return results;
      
    } catch (error) {
      this.logger.error('Shield events anonymization failed', {
        error: error.message
      });
      
      // Log failed operation
      await this.logRetentionOperation('anonymize', 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Log retention operations for audit purposes
   */
  async logRetentionOperation(operationType, status, metadata = {}) {
    try {
      const logData = {
        operation_type: operationType,
        operation_status: status,
        records_processed: metadata.recordsProcessed || 0,
        records_anonymized: metadata.recordsAnonymized || 0,
        records_purged: metadata.recordsPurged || 0,
        records_failed: metadata.recordsFailed || 0,
        completed_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      };
      
      const { error } = await this.supabase
        .from('shield_retention_log')
        .insert(logData);
      
      if (error) {
        this.logger.error('Failed to log retention operation', {
          operationType,
          status,
          error: error.message
        });
      }
      
    } catch (logError) {
      this.logger.error('Error logging retention operation', {
        operationType,
        status,
        error: logError.message
      });
    }
  }
  
  /**
   * Record a Shield event
   */
  async recordShieldEvent({
    organizationId,
    userId = null,
    platform,
    accountRef,
    externalCommentId,
    externalAuthorId,
    externalAuthorUsername,
    originalText = null, // Only for Shield-moderated comments
    toxicityScore,
    toxicityLabels = [],
    actionTaken,
    actionReason,
    actionStatus = 'pending',
    actionDetails = {},
    processedBy = 'shield_worker',
    processingTimeMs = null,
    metadata = {}
  }) {
    try {
      // Generate hash for original text if provided (for future anonymization)
      let textHash = null;
      let textSalt = null;
      if (originalText) {
        const hashResult = this.generateTextHash(originalText);
        textHash = hashResult.hash;
        textSalt = hashResult.salt;
      }
      
      const eventData = {
        organization_id: organizationId,
        user_id: userId,
        platform,
        account_ref: accountRef,
        external_comment_id: externalCommentId,
        external_author_id: externalAuthorId,
        external_author_username: externalAuthorUsername,
        original_text: originalText, // Will trigger GDPR retention schedule
        original_text_hash: textHash, // Pre-computed for faster anonymization
        text_salt: textSalt,
        toxicity_score: toxicityScore,
        toxicity_labels: toxicityLabels,
        action_taken: actionTaken,
        action_reason: actionReason,
        action_status: actionStatus,
        action_details: actionDetails,
        processed_by: processedBy,
        processing_time_ms: processingTimeMs,
        metadata,
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await this.supabase
        .from('shield_events')
        .insert(eventData)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Shield event recorded', {
        eventId: data.id,
        platform,
        actionTaken,
        externalAuthorId,
        hasOriginalText: !!originalText
      });
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to record Shield event', {
        organizationId,
        platform,
        externalAuthorId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Update Shield event status (e.g., when action is executed)
   */
  async updateShieldEventStatus(eventId, status, executedAt = null, actionDetails = null) {
    try {
      const updateData = {
        action_status: status
      };
      
      if (executedAt) {
        updateData.executed_at = executedAt;
      }
      
      if (actionDetails) {
        updateData.action_details = actionDetails;
      }
      
      const { data, error } = await this.supabase
        .from('shield_events')
        .update(updateData)
        .eq('id', eventId)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Shield event status updated', {
        eventId,
        status,
        executedAt
      });
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to update Shield event status', {
        eventId,
        status,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Purge Shield events older than 90 days for GDPR compliance
   */
  async purgeOldShieldEvents(batchSize = 100) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago
      
      this.logger.info('Starting Shield events purge', { cutoffDate, batchSize });
      
      // Delete records older than 90 days
      const { count, error } = await this.supabase
        .from('shield_events')
        .delete({ count: 'exact' })
        .lte('created_at', cutoffDate.toISOString());
      
      if (error) throw error;
      
      const purgedCount = count || 0;
      
      this.logger.info('Shield events purge completed', { purgedCount });
      
      // Log the purge operation
      await this.logRetentionOperation('purge', 'success', {
        recordsProcessed: purgedCount,
        recordsPurged: purgedCount,
        cutoffDate: cutoffDate.toISOString()
      });
      
      return { purged: purgedCount };
      
    } catch (error) {
      this.logger.error('Shield events purge failed', {
        error: error.message
      });
      
      // Log failed operation
      await this.logRetentionOperation('purge', 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get offender history for recidivism analysis
   */
  async getOffenderHistory(organizationId, platform, externalAuthorId, windowDays = null) {
    try {
      const lookbackDays = windowDays || this.recidivismWindowDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      // Get offender profile
      const { data: profile, error: profileError } = await this.supabase
        .from('offender_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .eq('external_author_id', externalAuthorId)
        .gte('last_offense_at', cutoffDate.toISOString())
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') { // Not found is OK
        throw profileError;
      }
      
      // Get recent Shield events
      const { data: events, error: eventsError } = await this.supabase
        .from('shield_events')
        .select(`
          id,
          external_comment_id,
          toxicity_score,
          toxicity_labels,
          action_taken,
          action_status,
          created_at,
          executed_at
        `)
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .eq('external_author_id', externalAuthorId)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (eventsError) throw eventsError;
      
      const history = {
        profile: profile || null,
        events: events || [],
        isRecidivist: !!profile && profile.offense_count > 1,
        riskLevel: profile?.severity_level || 'low',
        lastOffenseAt: profile?.last_offense_at || null,
        totalOffenses: profile?.offense_count || 0,
        averageToxicity: profile?.avg_toxicity_score || 0,
        maxToxicity: profile?.max_toxicity_score || 0,
        escalationLevel: profile?.escalation_level || 0,
        recentActionsSummary: this.summarizeRecentActions(events || [])
      };
      
      this.logger.debug('Retrieved offender history', {
        organizationId,
        platform,
        externalAuthorId,
        isRecidivist: history.isRecidivist,
        totalOffenses: history.totalOffenses,
        riskLevel: history.riskLevel
      });
      
      return history;
      
    } catch (error) {
      this.logger.error('Failed to get offender history', {
        organizationId,
        platform,
        externalAuthorId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Check if user is a repeat offender
   */
  async isRepeatOffender(organizationId, platform, externalAuthorId, thresholdDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);
      
      const { count, error } = await this.supabase
        .from('shield_events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .eq('external_author_id', externalAuthorId)
        .eq('action_status', 'executed')
        .gte('created_at', cutoffDate.toISOString());
      
      if (error) throw error;
      
      const isRepeat = (count || 0) > 1;
      
      this.logger.debug('Repeat offender check', {
        organizationId,
        platform,
        externalAuthorId,
        offenseCount: count,
        thresholdDays,
        isRepeat
      });
      
      return {
        isRepeat,
        offenseCount: count || 0,
        thresholdDays
      };
      
    } catch (error) {
      this.logger.error('Failed to check repeat offender status', {
        organizationId,
        platform,
        externalAuthorId,
        error: error.message
      });
      return { isRepeat: false, offenseCount: 0, error: error.message };
    }
  }
  
  /**
   * Get platform-wide offender statistics
   */
  async getPlatformOffenderStats(organizationId, platform, windowDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - windowDays);
      
      // Get overall statistics
      const { data: stats, error: statsError } = await this.supabase
        .from('shield_events')
        .select(`
          action_taken,
          action_status,
          toxicity_score,
          created_at
        `)
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .gte('created_at', cutoffDate.toISOString());
      
      if (statsError) throw statsError;
      
      // Get top offenders
      const { data: topOffenders, error: offendersError } = await this.supabase
        .from('offender_profiles')
        .select(`
          external_author_id,
          external_author_username,
          offense_count,
          severity_level,
          last_offense_at,
          actions_taken
        `)
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .gte('last_offense_at', cutoffDate.toISOString())
        .order('offense_count', { ascending: false })
        .limit(10);
      
      if (offendersError) throw offendersError;
      
      const result = {
        platform,
        windowDays,
        totalEvents: stats?.length || 0,
        actionsSummary: this.summarizeActions(stats || []),
        topOffenders: topOffenders || [],
        averageToxicity: this.calculateAverageToxicity(stats || []),
        severityDistribution: this.calculateSeverityDistribution(topOffenders || [])
      };
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to get platform offender stats', {
        organizationId,
        platform,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Search Shield events with filters
   */
  async searchShieldEvents({
    organizationId,
    platform = null,
    externalAuthorId = null,
    actionTaken = null,
    actionStatus = null,
    minToxicityScore = null,
    dateFrom = null,
    dateTo = null,
    limit = 100,
    offset = 0
  }) {
    try {
      let query = this.supabase
        .from('shield_events')
        .select(`
          id,
          platform,
          external_comment_id,
          external_author_id,
          external_author_username,
          toxicity_score,
          toxicity_labels,
          action_taken,
          action_status,
          action_reason,
          processed_by,
          created_at,
          executed_at,
          anonymized_at
        `, { count: 'exact' })
        .eq('organization_id', organizationId);
      
      if (platform) query = query.eq('platform', platform);
      if (externalAuthorId) query = query.eq('external_author_id', externalAuthorId);
      if (actionTaken) query = query.eq('action_taken', actionTaken);
      if (actionStatus) query = query.eq('action_status', actionStatus);
      if (minToxicityScore) query = query.gte('toxicity_score', minToxicityScore);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      
      return {
        events: data || [],
        total: count || 0,
        limit,
        offset
      };
      
    } catch (error) {
      this.logger.error('Failed to search Shield events', {
        organizationId,
        platform,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get retention statistics
   */
  async getRetentionStats() {
    try {
      const now = new Date();
      const day80Ago = new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000);
      const day90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      // Count records by retention status
      const { data: retentionStats, error: statsError } = await this.supabase
        .from('shield_events')
        .select(`
          created_at,
          anonymized_at,
          original_text,
          original_text_hash
        `);
      
      if (statsError) throw statsError;
      
      const stats = {
        total: retentionStats?.length || 0,
        needingAnonymization: 0,
        anonymized: 0,
        needingPurge: 0,
        withinRetention: 0
      };
      
      retentionStats?.forEach(record => {
        const createdAt = new Date(record.created_at);
        const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
        
        if (daysSinceCreation >= 90) {
          stats.needingPurge++;
        } else if (daysSinceCreation >= 80 && !record.anonymized_at) {
          stats.needingAnonymization++;
        } else if (record.anonymized_at) {
          stats.anonymized++;
        } else {
          stats.withinRetention++;
        }
      });
      
      // Get recent retention log entries
      const { data: recentLogs, error: logsError } = await this.supabase
        .from('shield_retention_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      
      if (logsError) throw logsError;
      
      return {
        ...stats,
        recentOperations: recentLogs || []
      };
      
    } catch (error) {
      this.logger.error('Failed to get retention stats', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Helper: Summarize recent actions
   */
  summarizeRecentActions(events) {
    const summary = {};
    
    events.forEach(event => {
      if (event.action_status === 'executed') {
        summary[event.action_taken] = (summary[event.action_taken] || 0) + 1;
      }
    });
    
    return summary;
  }
  
  /**
   * Helper: Summarize actions from events
   */
  summarizeActions(events) {
    const summary = {
      total: events.length,
      byAction: {},
      byStatus: {},
      executed: 0,
      failed: 0
    };
    
    events.forEach(event => {
      summary.byAction[event.action_taken] = (summary.byAction[event.action_taken] || 0) + 1;
      summary.byStatus[event.action_status] = (summary.byStatus[event.action_status] || 0) + 1;
      
      if (event.action_status === 'executed') summary.executed++;
      if (event.action_status === 'failed') summary.failed++;
    });
    
    return summary;
  }
  
  /**
   * Helper: Calculate average toxicity
   */
  calculateAverageToxicity(events) {
    const scores = events.filter(e => e.toxicity_score !== null).map(e => e.toxicity_score);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }
  
  /**
   * Helper: Calculate severity distribution
   */
  calculateSeverityDistribution(offenders) {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    
    offenders.forEach(offender => {
      if (distribution.hasOwnProperty(offender.severity_level)) {
        distribution[offender.severity_level]++;
      }
    });
    
    return distribution;
  }
}

module.exports = ShieldPersistenceService;