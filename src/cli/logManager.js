#!/usr/bin/env node

const { Command } = require('commander');
const advancedLogger = require('../utils/advancedLogger');
const LogBackupService = require('../services/logBackupService');
const LogMaintenanceService = require('../utils/logMaintenance');

const program = new Command();

program
  .name('log-manager')
  .description('Roastr AI Log Management CLI')
  .version('1.0.0');

// Stats command
program
  .command('stats')
  .description('Show log statistics')
  .option('-f, --format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      const stats = await advancedLogger.getLogStatistics();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('\n📊 Log Statistics\n');
        console.log(`Total Files: ${stats.totalFiles}`);
        console.log(`Total Size: ${stats.totalSizeFormatted}`);
        console.log(`Oldest Log: ${stats.oldestLog ? stats.oldestLog.file + ' (' + new Date(stats.oldestLog.mtime).toLocaleDateString() + ')' : 'None'}`);
        console.log(`Newest Log: ${stats.newestLog ? stats.newestLog.file + ' (' + new Date(stats.newestLog.mtime).toLocaleDateString() + ')' : 'None'}`);
        
        console.log('\n📁 By Directory:');
        Object.entries(stats.directories).forEach(([dir, data]) => {
          console.log(`  ${dir}: ${data.files} files, ${data.sizeFormatted}`);
        });
      }
    } catch (error) {
      console.error('❌ Error getting log statistics:', error.message);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean old log files')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--application-days <days>', 'Days to keep application logs', '30')
  .option('--integration-days <days>', 'Days to keep integration logs', '30')
  .option('--shield-days <days>', 'Days to keep shield logs', '90')
  .option('--security-days <days>', 'Days to keep security logs', '90')
  .option('--worker-days <days>', 'Days to keep worker logs', '30')
  .option('--audit-days <days>', 'Days to keep audit logs', '365')
  .action(async (options) => {
    try {
      const cleanupOptions = {
        applicationDays: parseInt(options.applicationDays),
        integrationDays: parseInt(options.integrationDays),
        shieldDays: parseInt(options.shieldDays),
        securityDays: parseInt(options.securityDays),
        workerDays: parseInt(options.workerDays),
        auditDays: parseInt(options.auditDays),
        dryRun: options.dryRun || false
      };

      console.log(`\n🧹 ${options.dryRun ? 'Simulating' : 'Performing'} log cleanup...`);
      console.log('Retention policies:');
      Object.entries(cleanupOptions).forEach(([key, value]) => {
        if (key !== 'dryRun') {
          console.log(`  ${key}: ${value} days`);
        }
      });

      const result = await advancedLogger.cleanOldLogs(cleanupOptions);
      
      console.log('\n✅ Cleanup completed!');
      console.log(`Files ${options.dryRun ? 'would be' : ''} removed: ${result.filesRemoved}`);
      console.log(`Space ${options.dryRun ? 'would be' : ''} freed: ${advancedLogger.formatFileSize(result.sizeFreed)}`);
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
      process.exit(1);
    }
  });

// Backup commands
const backupCmd = program
  .command('backup')
  .description('Manage log backups');

backupCmd
  .command('upload')
  .description('Upload logs to S3 backup')
  .option('--days <days>', 'Number of recent days to backup', '7')
  .option('--dry-run', 'Show what would be uploaded without actually uploading')
  .option('--force', 'Upload even if files already exist in S3')
  .action(async (options) => {
    try {
      const backupService = new LogBackupService();
      
      if (!backupService.isBackupEnabled()) {
        console.error('❌ S3 backup is not configured');
        console.log('Set the following environment variables:');
        console.log('  - LOG_BACKUP_S3_BUCKET');
        console.log('  - AWS_ACCESS_KEY_ID');
        console.log('  - AWS_SECRET_ACCESS_KEY');
        process.exit(1);
      }

      console.log(`\n☁️  ${options.dryRun ? 'Simulating' : 'Performing'} backup of last ${options.days} days...`);
      
      const result = await backupService.backupRecentLogs(parseInt(options.days), {
        dryRun: options.dryRun || false,
        skipExisting: !options.force
      });

      console.log('\n✅ Backup completed!');
      console.log(`Days processed: ${result.summary.totalDays}`);
      console.log(`Files uploaded: ${result.summary.totalUploaded}`);
      console.log(`Files skipped: ${result.summary.totalSkipped}`);
      console.log(`Total size: ${result.summary.totalSizeFormatted}`);
      console.log(`Success rate: ${result.summary.successRate}`);
      
      if (result.summary.errorDates.length > 0) {
        console.log(`⚠️  Errors on dates: ${result.summary.errorDates.join(', ')}`);
      }
      
    } catch (error) {
      console.error('❌ Error during backup:', error.message);
      process.exit(1);
    }
  });

backupCmd
  .command('list')
  .description('List available backups in S3')
  .option('--date <date>', 'Filter by specific date (YYYY-MM-DD)')
  .option('--max <count>', 'Maximum number of backups to list', '50')
  .action(async (options) => {
    try {
      const backupService = new LogBackupService();
      
      if (!backupService.isBackupEnabled()) {
        console.error('❌ S3 backup is not configured');
        process.exit(1);
      }

      console.log('\n☁️  Listing S3 backups...');
      
      const result = await backupService.listBackups({
        date: options.date,
        maxKeys: parseInt(options.max)
      });

      if (result.backups.length === 0) {
        console.log('No backups found');
        return;
      }

      console.log(`\nFound ${result.backups.length} backups:`);
      console.log(`Total size: ${backupService.formatFileSize(result.totalSize)}\n`);
      
      result.backups.forEach(backup => {
        console.log(`📄 ${backup.key}`);
        console.log(`   Size: ${backup.sizeFormatted}, Modified: ${new Date(backup.lastModified).toLocaleString()}`);
      });
      
      if (result.truncated) {
        console.log(`\n⚠️  Results truncated. Use --max to see more.`);
      }
      
    } catch (error) {
      console.error('❌ Error listing backups:', error.message);
      process.exit(1);
    }
  });

backupCmd
  .command('download')
  .description('Download a backup from S3')
  .argument('<s3-key>', 'S3 key of the backup to download')
  .option('--output <path>', 'Local path to save the downloaded file')
  .action(async (s3Key, options) => {
    try {
      const backupService = new LogBackupService();
      
      if (!backupService.isBackupEnabled()) {
        console.error('❌ S3 backup is not configured');
        process.exit(1);
      }

      console.log(`\n⬇️  Downloading backup: ${s3Key}`);
      
      const localPath = await backupService.downloadBackup(s3Key, options.output);
      
      console.log(`✅ Backup downloaded to: ${localPath}`);
      
    } catch (error) {
      console.error('❌ Error downloading backup:', error.message);
      process.exit(1);
    }
  });

backupCmd
  .command('cleanup')
  .description('Clean old backups from S3')
  .option('--retention-days <days>', 'Days to keep backups', '90')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (options) => {
    try {
      const backupService = new LogBackupService();
      
      if (!backupService.isBackupEnabled()) {
        console.error('❌ S3 backup is not configured');
        process.exit(1);
      }

      console.log(`\n🧹 ${options.dryRun ? 'Simulating' : 'Performing'} S3 backup cleanup...`);
      console.log(`Retention: ${options.retentionDays} days`);
      
      const result = await backupService.cleanOldBackups(
        parseInt(options.retentionDays),
        { dryRun: options.dryRun || false }
      );

      console.log('\n✅ Backup cleanup completed!');
      console.log(`Files ${options.dryRun ? 'would be' : ''} deleted: ${result.deleted.length}`);
      console.log(`Space ${options.dryRun ? 'would be' : ''} freed: ${backupService.formatFileSize(result.totalSize)}`);
      
      if (result.errors.length > 0) {
        console.log(`⚠️  Errors: ${result.errors.length}`);
      }
      
    } catch (error) {
      console.error('❌ Error during backup cleanup:', error.message);
      process.exit(1);
    }
  });

// Maintenance service commands
const maintenanceCmd = program
  .command('maintenance')
  .description('Manage log maintenance service');

maintenanceCmd
  .command('start')
  .description('Start the log maintenance service')
  .action(async () => {
    try {
      const maintenanceService = new LogMaintenanceService();
      
      console.log('🚀 Starting log maintenance service...');
      maintenanceService.start();
      
      const status = maintenanceService.getStatus();
      console.log('✅ Log maintenance service started!');
      console.log(`Active jobs: ${status.activeJobs.join(', ')}`);
      console.log('\nNext scheduled runs:');
      Object.entries(status.nextRuns).forEach(([job, time]) => {
        console.log(`  ${job}: ${new Date(time).toLocaleString()}`);
      });
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping log maintenance service...');
        maintenanceService.stop();
        process.exit(0);
      });
      
      console.log('\nPress Ctrl+C to stop the service.');
      
    } catch (error) {
      console.error('❌ Error starting maintenance service:', error.message);
      process.exit(1);
    }
  });

maintenanceCmd
  .command('status')
  .description('Show maintenance service status')
  .action(async () => {
    try {
      const maintenanceService = new LogMaintenanceService();
      const status = maintenanceService.getStatus();
      
      console.log('\n🔧 Log Maintenance Service Status\n');
      console.log(`Running: ${status.running ? '✅' : '❌'}`);
      console.log(`Active Jobs: ${status.activeJobs.length > 0 ? status.activeJobs.join(', ') : 'None'}`);
      
      console.log('\n📋 Configuration:');
      console.log(`  Cleanup Enabled: ${status.config.cleanup.enabled}`);
      console.log(`  Backup Enabled: ${status.config.backup.enabled}`);
      console.log(`  Monitoring Enabled: ${status.config.monitoring.enabled}`);
      
      console.log('\n☁️  Backup Service:');
      console.log(`  Enabled: ${status.backupService.enabled}`);
      console.log(`  Bucket: ${status.backupService.bucket || 'Not configured'}`);
      console.log(`  Region: ${status.backupService.region}`);
      
      if (status.running && Object.keys(status.nextRuns).length > 0) {
        console.log('\n⏰ Next Runs:');
        Object.entries(status.nextRuns).forEach(([job, time]) => {
          console.log(`  ${job}: ${new Date(time).toLocaleString()}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error getting maintenance status:', error.message);
      process.exit(1);
    }
  });

maintenanceCmd
  .command('health')
  .description('Run health check')
  .action(async () => {
    try {
      const maintenanceService = new LogMaintenanceService();
      
      console.log('🔍 Running log system health check...');
      const healthReport = await maintenanceService.performHealthCheck();
      
      console.log(`\n${healthReport.status === 'healthy' ? '✅' : healthReport.status === 'warning' ? '⚠️' : '❌'} Health Status: ${healthReport.status.toUpperCase()}`);
      
      if (healthReport.statistics) {
        console.log(`\n📊 Statistics:`);
        console.log(`  Total Files: ${healthReport.statistics.totalFiles}`);
        console.log(`  Total Size: ${healthReport.statistics.totalSizeFormatted}`);
      }
      
      if (healthReport.backup) {
        console.log(`\n☁️  Backup: ${healthReport.backup.enabled ? 'Enabled' : 'Disabled'}`);
        if (healthReport.backup.enabled && healthReport.backup.recentBackups !== undefined) {
          console.log(`  Recent Backups: ${healthReport.backup.recentBackups}`);
          console.log(`  Total Size: ${healthReport.backup.totalSize}`);
        }
      }
      
      if (healthReport.issues.length > 0) {
        console.log('\n⚠️  Issues Found:');
        healthReport.issues.forEach(issue => {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          console.log(`  ${icon} ${issue.type}: ${issue.message}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error during health check:', error.message);
      process.exit(1);
    }
  });

// Test command for validating log rotation
program
  .command('test')
  .description('Test log rotation and backup functionality')
  .option('--skip-backup', 'Skip backup tests')
  .action(async (options) => {
    try {
      console.log('🧪 Testing log system...\n');
      
      // Test log writing
      console.log('1. Testing log writing...');
      advancedLogger.info('Test log entry from CLI', { test: true, timestamp: new Date().toISOString() });
      advancedLogger.error('Test error log entry', { test: true, error: 'simulated' });
      advancedLogger.authEvent('Test auth event', { userId: 'test-user', action: 'login' });
      advancedLogger.integrationEvent('Test integration event', { platform: 'test', operation: 'fetch' });
      console.log('✅ Log writing test completed');
      
      // Test statistics
      console.log('\n2. Testing log statistics...');
      const stats = await advancedLogger.getLogStatistics();
      console.log(`✅ Statistics: ${stats.totalFiles} files, ${stats.totalSizeFormatted}`);
      
      // Test cleanup (dry run)
      console.log('\n3. Testing cleanup (dry run)...');
      const cleanupResult = await advancedLogger.cleanOldLogs({ dryRun: true });
      console.log(`✅ Cleanup test: ${cleanupResult.filesRemoved} files would be removed`);
      
      // Test backup if configured
      if (!options.skipBackup) {
        console.log('\n4. Testing backup...');
        const backupService = new LogBackupService();
        if (backupService.isBackupEnabled()) {
          const testDate = new Date();
          testDate.setDate(testDate.getDate() - 1); // Yesterday
          const backupResult = await backupService.backupLogsForDate(testDate, { dryRun: true });
          console.log(`✅ Backup test: ${backupResult.uploaded.length} files would be uploaded`);
        } else {
          console.log('⚠️  Backup not configured, skipping backup test');
        }
      }
      
      console.log('\n✅ All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error.message);
  process.exit(1);
});

program.parse(process.argv);