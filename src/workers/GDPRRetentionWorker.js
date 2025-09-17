const BaseWorker = require('./BaseWorker');
const crypto = require('crypto');

/**
 * GDPR Retention Worker
 * 
 * Handles GDPR-compliant data retention for Shield events:
 * - Day 80: Anonymize original_text → HMAC-SHA-256 hash + salt
 * - Day 90: Purge original_text completely
 * - Cleanup old offender profiles beyond 90 days
 */
class GDPRRetentionWorker extends BaseWorker {
  constructor(options = {}) {
    super('gdpr_retention', {
      maxConcurrency: 1, // Single instance for data consistency
      pollInterval: 3600000, // Run every hour
      maxRetries: 3,
      ...options
    });
    
    // Verify Supabase client injection with service-role
    if (!this.supabase) {
      throw new Error('GDPRRetentionWorker requires a Supabase client with service-role permissions');
    }
    
    // Verify service key is available for privileged operations
    if (!process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_KEY is required for GDPR retention operations');
    }
    
    // Verify HMAC pepper for secure anonymization (not required in dry-run mode)
    if (!process.env.GDPR_HMAC_PEPPER && !options.dryRun) {
      throw new Error('GDPR_HMAC_PEPPER environment variable is required for secure anonymization');
    }
    
    this.batchSize = options.batchSize || 1000;
    this.dryRun = options.dryRun || false;
    this.hmacPepper = process.env.GDPR_HMAC_PEPPER;
    
    // Statistics tracking
    this.stats = {
      totalProcessed: 0,
      anonymized: 0,
      purged: 0,
      cleaned: 0,
      errors: 0,
      lastRun: null
    };
  }
  
  /**
   * Get worker-specific health details
   */
  async getSpecificHealthDetails() {
    return {
      gdprRetention: {
        ...this.stats,
        batchSize: this.batchSize,
        dryRun: this.dryRun,
        nextScheduledRun: this.getNextScheduledRun(),
        pendingRecords: await this.getPendingRecordsCounts()
      }
    };
  }
  
  /**
   * Process GDPR retention job
   */
  async processJob(job) {
    const { operation, batchId } = job.payload || job;
    const startTime = Date.now();
    
    this.log('info', 'Starting GDPR retention operation', {
      operation,
      batchId,
      batchSize: this.batchSize
    });
    
    try {
      let result;
      
      switch (operation) {
        case 'anonymize':
          result = await this.anonymizeOldRecords(batchId);
          break;
          
        case 'purge':
          result = await this.purgeOldRecords(batchId);
          break;
          
        case 'cleanup':
          result = await this.cleanupOldProfiles(batchId);
          break;
          
        case 'full_retention':
          result = await this.runFullRetentionCycle(batchId);
          break;
          
        default:
          throw new Error(`Unknown GDPR retention operation: ${operation}`);
      }
      
      const processingTime = Date.now() - startTime;
      this.stats.lastRun = new Date().toISOString();
      
      this.log('info', 'GDPR retention operation completed', {
        operation,
        ...result,
        processingTimeMs: processingTime
      });
      
      return {
        success: true,
        operation,
        ...result,
        processingTimeMs: processingTime
      };
      
    } catch (error) {
      this.stats.errors++;
      this.log('error', 'GDPR retention operation failed', {
        operation,
        error: error.message
      });
      
      // Log failure to retention log
      await this.logRetentionOperation({
        operation_type: operation,
        operation_status: 'failed',
        batch_id: batchId,
        error_message: error.message,
        error_details: { stack: error.stack },
        processing_time_ms: Date.now() - startTime
      });
      
      throw error;
    }
  }
  
  /**
   * Anonymize records older than 80 days
   */
  async anonymizeOldRecords(batchId) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 80);
    
    this.log('info', 'Starting anonymization process', {
      cutoffDate: cutoffDate.toISOString(),
      batchSize: this.batchSize
    });
    
    let totalProcessed = 0;
    let totalAnonymized = 0;
    let totalErrors = 0;
    
    try {
      // Get records that need anonymization
      const { data: records, error: selectError } = await this.supabase
        .from('shield_events')
        .select('id, original_text, created_at')
        .lt('created_at', cutoffDate.toISOString())
        .is('anonymized_at', null)
        .not('original_text', 'is', null)
        .limit(this.batchSize)
        .order('created_at', { ascending: true });
      
      if (selectError) throw selectError;
      
      if (!records || records.length === 0) {
        this.log('info', 'No records found for anonymization');
        return { processed: 0, anonymized: 0, errors: 0 };
      }
      
      this.log('info', `Found ${records.length} records for anonymization`);
      
      // Process records in smaller batches for better performance
      const processingBatchSize = Math.min(100, this.batchSize);
      
      for (let i = 0; i < records.length; i += processingBatchSize) {
        const batch = records.slice(i, i + processingBatchSize);
        const batchResult = await this.anonymizeBatch(batch, batchId);
        
        totalProcessed += batchResult.processed;
        totalAnonymized += batchResult.anonymized;
        totalErrors += batchResult.errors;
        
        // Small delay between batches to avoid overwhelming the database
        if (i + processingBatchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Update statistics
      this.stats.totalProcessed += totalProcessed;
      this.stats.anonymized += totalAnonymized;
      this.stats.errors += totalErrors;
      
      // Log the operation
      await this.logRetentionOperation({
        operation_type: 'anonymize',
        operation_status: totalErrors === 0 ? 'success' : 'partial',
        batch_id: batchId,
        records_processed: totalProcessed,
        records_anonymized: totalAnonymized,
        records_failed: totalErrors,
        metadata: { cutoff_date: cutoffDate.toISOString() }
      });
      
      return {
        processed: totalProcessed,
        anonymized: totalAnonymized,
        errors: totalErrors
      };
      
    } catch (error) {
      this.log('error', 'Anonymization process failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Anonymize a batch of records
   */
  async anonymizeBatch(records, batchId) {
    let processed = 0;
    let anonymized = 0;
    let errors = 0;
    
    for (const record of records) {
      try {
        processed++;
        
        if (this.dryRun) {
          this.log('info', 'DRY RUN: Would anonymize record', { id: record.id });
          anonymized++;
          continue;
        }
        
        // Generate salt and HMAC hash with server-side pepper
        const salt = crypto.randomBytes(16).toString('hex');
        let hash;
        
        try {
          hash = crypto
            .createHmac('sha256', this.hmacPepper)
            .update(record.original_text + salt)
            .digest('hex');
        } catch (error) {
          this.log('error', 'Failed to create HMAC hash', {
            id: record.id,
            error: error.message
          });
          throw new Error(`HMAC generation failed: ${error.message}`);
        }
        
        // Update record
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
          throw updateError;
        }
        
        anonymized++;
        this.log('debug', 'Record anonymized', { 
          id: record.id, 
          hash: hash.substring(0, 16) + '...' 
        });
        
      } catch (error) {
        errors++;
        this.log('error', 'Failed to anonymize record', {
          id: record.id,
          error: error.message
        });
      }
    }
    
    return { processed, anonymized, errors };
  }
  
  /**
   * Purge records older than 90 days
   */
  async purgeOldRecords(batchId) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    this.log('info', 'Starting purge process', {
      cutoffDate: cutoffDate.toISOString(),
      batchSize: this.batchSize
    });
    
    try {
      if (this.dryRun) {
        // Count records that would be purged (exact same filter as live purge)
        const { count, error: countError } = await this.supabase
          .from('shield_events')
          .select('*', { count: 'exact', head: true })
          .lt('created_at', cutoffDate.toISOString());
        
        if (countError) throw countError;
        
        this.log('info', 'DRY RUN: Would purge records', { 
          count, 
          cutoffDate: cutoffDate.toISOString() 
        });
        return { processed: count || 0, purged: count || 0, errors: 0 };
      }
      
      // Delete records older than 90 days
      const { error: deleteError } = await this.supabase
        .from('shield_events')
        .delete()
        .lt('created_at', cutoffDate.toISOString());
      
      if (deleteError) throw deleteError;
      
      // Note: PostgreSQL doesn't return count from DELETE, so we'll log the operation
      this.log('info', 'Purge completed', { cutoffDate: cutoffDate.toISOString() });
      
      // Log the operation
      await this.logRetentionOperation({
        operation_type: 'purge',
        operation_status: 'success',
        batch_id: batchId,
        metadata: { cutoff_date: cutoffDate.toISOString() }
      });
      
      return { processed: 'unknown', purged: 'completed', errors: 0 };
      
    } catch (error) {
      this.log('error', 'Purge process failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Clean up old offender profiles beyond 90 days
   */
  async cleanupOldProfiles(batchId) {
    this.log('info', 'Starting offender profiles cleanup');
    
    try {
      if (this.dryRun) {
        this.log('info', 'DRY RUN: Would run cleanup_old_offender_profiles()');
        return { cleaned: 'dry_run', errors: 0 };
      }
      
      // Call the database function to clean up old profiles
      const { data, error } = await this.supabase
        .rpc('cleanup_old_offender_profiles');
      
      if (error) throw error;
      
      const cleanedCount = data || 0;
      this.stats.cleaned += cleanedCount;
      
      this.log('info', 'Offender profiles cleanup completed', { 
        cleanedCount 
      });
      
      return { cleaned: cleanedCount, errors: 0 };
      
    } catch (error) {
      this.log('error', 'Cleanup process failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Run full retention cycle (anonymize + purge + cleanup)
   */
  async runFullRetentionCycle(batchId) {
    this.log('info', 'Starting full retention cycle');
    
    const results = {
      anonymize: { processed: 0, anonymized: 0, errors: 0 },
      purge: { processed: 0, purged: 0, errors: 0 },
      cleanup: { cleaned: 0, errors: 0 }
    };
    
    try {
      // Step 1: Anonymize 80+ day old records
      results.anonymize = await this.anonymizeOldRecords(batchId);
      
      // Step 2: Purge 90+ day old records
      results.purge = await this.purgeOldRecords(batchId);
      
      // Step 3: Cleanup old offender profiles
      results.cleanup = await this.cleanupOldProfiles(batchId);
      
      this.log('info', 'Full retention cycle completed', results);
      
      return {
        fullCycle: true,
        ...results,
        totalErrors: results.anonymize.errors + results.purge.errors + results.cleanup.errors
      };
      
    } catch (error) {
      this.log('error', 'Full retention cycle failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Log retention operation to audit table
   */
  async logRetentionOperation(logData) {
    try {
      const { error } = await this.supabase
        .from('shield_retention_log')
        .insert({
          ...logData,
          completed_at: new Date().toISOString(),
          processing_time_ms: logData.processing_time_ms || 0
        });
      
      if (error) {
        this.log('error', 'Failed to log retention operation', { error: error.message });
      }
    } catch (error) {
      this.log('error', 'Failed to log retention operation', { error: error.message });
    }
  }
  
  /**
   * Get next scheduled run time
   */
  getNextScheduledRun() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    return nextHour.toISOString();
  }
  
  /**
   * Get counts of pending records for each operation
   */
  async getPendingRecordsCounts() {
    try {
      const now = new Date();
      const day80Ago = new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000);
      const day90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      // Count records needing anonymization
      const { count: anonymizeCount } = await this.supabase
        .from('shield_events')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', day80Ago.toISOString())
        .is('anonymized_at', null)
        .not('original_text', 'is', null);
      
      // Count records needing purging
      const { count: purgeCount } = await this.supabase
        .from('shield_events')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', day90Ago.toISOString());
      
      // Count old offender profiles
      const { count: cleanupCount } = await this.supabase
        .from('offender_profiles')
        .select('*', { count: 'exact', head: true })
        .lt('last_offense_at', day90Ago.toISOString());
      
      return {
        needingAnonymization: anonymizeCount || 0,
        needingPurge: purgeCount || 0,
        needingCleanup: cleanupCount || 0
      };
      
    } catch (error) {
      this.log('error', 'Failed to get pending records counts', { error: error.message });
      return {
        needingAnonymization: 'error',
        needingPurge: 'error',
        needingCleanup: 'error'
      };
    }
  }
  
  /**
   * Create scheduled retention jobs
   */
  static createScheduledJobs() {
    return [
      {
        name: 'gdpr_anonymize_daily',
        schedule: '0 2 * * *', // Daily at 2 AM
        payload: { operation: 'anonymize' }
      },
      {
        name: 'gdpr_purge_daily',
        schedule: '0 3 * * *', // Daily at 3 AM
        payload: { operation: 'purge' }
      },
      {
        name: 'gdpr_cleanup_weekly',
        schedule: '0 4 * * 0', // Weekly on Sunday at 4 AM
        payload: { operation: 'cleanup' }
      },
      {
        name: 'gdpr_full_cycle_weekly',
        schedule: '0 1 * * 1', // Weekly on Monday at 1 AM
        payload: { operation: 'full_retention' }
      }
    ];
  }
}

module.exports = GDPRRetentionWorker;