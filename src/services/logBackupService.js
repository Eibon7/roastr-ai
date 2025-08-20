const AWS = require('aws-sdk');
const fs = require('fs-extra');
const path = require('path');
const { createReadStream } = require('fs');
const advancedLogger = require('../utils/advancedLogger');

class LogBackupService {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.s3 = null;
    this.bucketName = process.env.LOG_BACKUP_S3_BUCKET;
    this.backupPrefix = process.env.LOG_BACKUP_S3_PREFIX || 'roastr-ai-logs';
    this.region = process.env.AWS_REGION || 'us-east-1';
    
    this.initializeS3();
  }

  /**
   * Initialize S3 client
   */
  initializeS3() {
    try {
      // Check if S3 backup is configured
      if (!this.bucketName) {
        advancedLogger.warn('S3 backup not configured - LOG_BACKUP_S3_BUCKET environment variable not set');
        return;
      }

      // Configure AWS SDK
      AWS.config.update({
        region: this.region,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });

      this.s3 = new AWS.S3();
      advancedLogger.info('S3 backup service initialized', { 
        bucket: this.bucketName,
        region: this.region,
        prefix: this.backupPrefix
      });

    } catch (error) {
      advancedLogger.error('Failed to initialize S3 backup service', { error: error.message });
    }
  }

  /**
   * Check if S3 backup is available
   */
  isBackupEnabled() {
    return this.s3 !== null && this.bucketName;
  }

  /**
   * Upload a single file to S3
   */
  async uploadFileToS3(filePath, s3Key, metadata = {}) {
    if (!this.isBackupEnabled()) {
      throw new Error('S3 backup is not configured');
    }

    try {
      const fileStream = createReadStream(filePath);
      const stats = await fs.stat(filePath);

      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: 'text/plain',
        ContentEncoding: 'gzip',
        Metadata: {
          originalSize: stats.size.toString(),
          uploadedAt: new Date().toISOString(),
          service: 'roastr-ai',
          ...metadata
        },
        StorageClass: 'STANDARD_IA', // Cheaper for infrequent access
        ServerSideEncryption: 'AES256'
      };

      const result = await this.s3.upload(uploadParams).promise();
      
      advancedLogger.info('File uploaded to S3', {
        localPath: path.relative(this.logsDir, filePath),
        s3Key,
        size: stats.size,
        etag: result.ETag
      });

      return result;

    } catch (error) {
      advancedLogger.error('Failed to upload file to S3', {
        filePath: path.relative(this.logsDir, filePath),
        s3Key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Backup logs for a specific date
   */
  async backupLogsForDate(targetDate, options = {}) {
    const {
      dryRun = false,
      skipExisting = true,
      includeDirectories = ['application', 'integrations', 'shield', 'security', 'workers', 'audit']
    } = options;

    if (!this.isBackupEnabled() && !dryRun) {
      throw new Error('S3 backup is not configured');
    }

    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const results = {
      uploaded: [],
      skipped: [],
      errors: [],
      totalSize: 0
    };

    advancedLogger.info(`Starting log backup for date: ${dateStr}`, { dryRun });

    for (const directory of includeDirectories) {
      const dirPath = path.join(this.logsDir, directory);
      
      if (await fs.pathExists(dirPath)) {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          // Skip audit files and only backup files for the target date
          if (file.endsWith('-audit.json') || !file.includes(dateStr)) {
            continue;
          }

          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);
          
          // Generate S3 key with organized structure
          const s3Key = `${this.backupPrefix}/${dateStr}/${directory}/${file}`;
          
          if (skipExisting && !dryRun) {
            // Check if file already exists in S3
            try {
              await this.s3.headObject({ Bucket: this.bucketName, Key: s3Key }).promise();
              results.skipped.push({ file: path.relative(this.logsDir, filePath), s3Key, reason: 'already_exists' });
              continue;
            } catch (error) {
              if (error.code !== 'NotFound') {
                results.errors.push({ file: path.relative(this.logsDir, filePath), error: error.message });
                continue;
              }
              // File doesn't exist, proceed with upload
            }
          }

          if (dryRun) {
            results.uploaded.push({ 
              file: path.relative(this.logsDir, filePath), 
              s3Key, 
              size: stats.size,
              dryRun: true
            });
            results.totalSize += stats.size;
          } else {
            try {
              await this.uploadFileToS3(filePath, s3Key, {
                logType: directory,
                backupDate: dateStr
              });
              
              results.uploaded.push({ 
                file: path.relative(this.logsDir, filePath), 
                s3Key, 
                size: stats.size 
              });
              results.totalSize += stats.size;
              
            } catch (error) {
              results.errors.push({ 
                file: path.relative(this.logsDir, filePath), 
                error: error.message 
              });
            }
          }
        }
      }
    }

    advancedLogger.info(`Log backup completed for ${dateStr}`, {
      uploaded: results.uploaded.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
      totalSize: this.formatFileSize(results.totalSize),
      dryRun
    });

    return results;
  }

  /**
   * Backup recent logs (last N days)
   */
  async backupRecentLogs(days = 7, options = {}) {
    const results = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    advancedLogger.info(`Starting backup of recent logs (${days} days)`, { 
      fromDate: startDate.toISOString().split('T')[0],
      ...options 
    });

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      try {
        const dayResult = await this.backupLogsForDate(currentDate, options);
        results.push({
          date: currentDate.toISOString().split('T')[0],
          ...dayResult
        });
      } catch (error) {
        advancedLogger.error(`Failed to backup logs for ${currentDate.toISOString().split('T')[0]}`, {
          error: error.message
        });
        results.push({
          date: currentDate.toISOString().split('T')[0],
          error: error.message
        });
      }
    }

    const summary = this.generateBackupSummary(results);
    advancedLogger.info('Recent logs backup completed', summary);

    return { results, summary };
  }

  /**
   * List backups in S3
   */
  async listBackups(options = {}) {
    if (!this.isBackupEnabled()) {
      throw new Error('S3 backup is not configured');
    }

    const {
      prefix = this.backupPrefix,
      maxKeys = 1000,
      date = null
    } = options;

    try {
      const listParams = {
        Bucket: this.bucketName,
        Prefix: date ? `${prefix}/${date}` : prefix,
        MaxKeys: maxKeys
      };

      const result = await this.s3.listObjectsV2(listParams).promise();
      
      const backups = result.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        sizeFormatted: this.formatFileSize(obj.Size)
      }));

      return {
        backups,
        truncated: result.IsTruncated,
        totalObjects: result.KeyCount,
        totalSize: backups.reduce((sum, backup) => sum + backup.size, 0)
      };

    } catch (error) {
      advancedLogger.error('Failed to list S3 backups', { error: error.message });
      throw error;
    }
  }

  /**
   * Download backup from S3
   */
  async downloadBackup(s3Key, localPath = null) {
    if (!this.isBackupEnabled()) {
      throw new Error('S3 backup is not configured');
    }

    try {
      const downloadPath = localPath || path.join(this.logsDir, 'restored', path.basename(s3Key));
      
      // Ensure restore directory exists
      await fs.ensureDir(path.dirname(downloadPath));

      const downloadParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const result = await this.s3.getObject(downloadParams).promise();
      await fs.writeFile(downloadPath, result.Body);

      advancedLogger.info('Backup downloaded from S3', {
        s3Key,
        localPath: path.relative(this.logsDir, downloadPath),
        size: result.Body.length
      });

      return downloadPath;

    } catch (error) {
      advancedLogger.error('Failed to download backup from S3', { s3Key, error: error.message });
      throw error;
    }
  }

  /**
   * Clean old backups from S3
   */
  async cleanOldBackups(retentionDays = 90, options = {}) {
    if (!this.isBackupEnabled()) {
      throw new Error('S3 backup is not configured');
    }

    const { dryRun = false } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const backups = await this.listBackups();
      const toDelete = backups.backups.filter(backup => 
        new Date(backup.lastModified) < cutoffDate
      );

      if (toDelete.length === 0) {
        advancedLogger.info('No old backups to clean');
        return { deleted: [], totalSize: 0, dryRun };
      }

      const results = {
        deleted: [],
        errors: [],
        totalSize: 0,
        dryRun
      };

      for (const backup of toDelete) {
        if (dryRun) {
          results.deleted.push(backup);
          results.totalSize += backup.size;
        } else {
          try {
            await this.s3.deleteObject({
              Bucket: this.bucketName,
              Key: backup.key
            }).promise();

            results.deleted.push(backup);
            results.totalSize += backup.size;

            advancedLogger.info('Deleted old backup', { 
              key: backup.key, 
              age: Math.floor((Date.now() - new Date(backup.lastModified)) / (1000 * 60 * 60 * 24)) + ' days'
            });

          } catch (error) {
            results.errors.push({ key: backup.key, error: error.message });
            advancedLogger.error('Failed to delete backup', { key: backup.key, error: error.message });
          }
        }
      }

      advancedLogger.info('Backup cleanup completed', {
        deleted: results.deleted.length,
        errors: results.errors.length,
        totalSizeFreed: this.formatFileSize(results.totalSize),
        retentionDays,
        dryRun
      });

      return results;

    } catch (error) {
      advancedLogger.error('Failed to clean old backups', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate backup summary
   */
  generateBackupSummary(results) {
    const summary = {
      totalDays: results.length,
      totalUploaded: 0,
      totalSkipped: 0,
      totalErrors: 0,
      totalSize: 0,
      errorDates: []
    };

    results.forEach(dayResult => {
      if (dayResult.error) {
        summary.errorDates.push(dayResult.date);
        summary.totalErrors++;
      } else {
        summary.totalUploaded += dayResult.uploaded?.length || 0;
        summary.totalSkipped += dayResult.skipped?.length || 0;
        summary.totalSize += dayResult.totalSize || 0;
      }
    });

    summary.totalSizeFormatted = this.formatFileSize(summary.totalSize);
    summary.successRate = ((summary.totalDays - summary.errorDates.length) / summary.totalDays * 100).toFixed(1) + '%';

    return summary;
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(s3Key) {
    if (!this.isBackupEnabled()) {
      throw new Error('S3 backup is not configured');
    }

    try {
      const headResult = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: s3Key
      }).promise();

      const verification = {
        exists: true,
        size: headResult.ContentLength,
        lastModified: headResult.LastModified,
        etag: headResult.ETag,
        metadata: headResult.Metadata,
        encrypted: !!headResult.ServerSideEncryption
      };

      advancedLogger.info('Backup verification completed', { s3Key, ...verification });
      return verification;

    } catch (error) {
      if (error.code === 'NotFound') {
        return { exists: false, error: 'Backup not found' };
      }
      throw error;
    }
  }

  /**
   * Get backup service status
   */
  getStatus() {
    return {
      enabled: this.isBackupEnabled(),
      bucket: this.bucketName,
      region: this.region,
      prefix: this.backupPrefix,
      configured: {
        s3: !!this.s3,
        bucket: !!this.bucketName,
        credentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      }
    };
  }
}

module.exports = LogBackupService;