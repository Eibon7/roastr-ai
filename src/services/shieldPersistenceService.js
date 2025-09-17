const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

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
      const eventData = {
        organization_id: organizationId,
        user_id: userId,
        platform,
        account_ref: accountRef,
        external_comment_id: externalCommentId,
        external_author_id: externalAuthorId,
        external_author_username: externalAuthorUsername,
        original_text: originalText, // Will trigger GDPR retention schedule
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
        externalAuthorId
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
        action_status: status,
        updated_at: new Date().toISOString()
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