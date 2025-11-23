# Log Retention and Backup Policy

## Overview

This document outlines the comprehensive log retention and backup policy for Roastr AI, implementing automated log rotation, cleanup, and cloud backup systems to ensure compliance, performance, and data protection.

## Log Categories and Retention Periods

### 1. Application Logs (`logs/application/`)

- **Purpose**: General application events, performance metrics, and operational data
- **Retention**: 30 days (configurable via `LOG_RETENTION_APPLICATION_DAYS`)
- **Rotation**: Daily rotation with gzip compression
- **File Size Limit**: 20MB per file
- **Files**:
  - `app-YYYY-MM-DD.log` - General application logs
  - `error-YYYY-MM-DD.log` - Error logs only (kept for 60 days)
  - `exceptions-YYYY-MM-DD.log` - Uncaught exceptions (kept for 90 days)
  - `rejections-YYYY-MM-DD.log` - Unhandled promise rejections (kept for 90 days)

### 2. Security Logs (`logs/security/`)

- **Purpose**: Authentication events, authorization failures, security incidents
- **Retention**: 90 days (configurable via `LOG_RETENTION_SECURITY_DAYS`)
- **Rotation**: Daily rotation with gzip compression
- **File Size Limit**: 10MB per file
- **Files**:
  - `security-YYYY-MM-DD.log` - General security events
  - `auth-YYYY-MM-DD.log` - Authentication and authorization events

### 3. Integration Logs (`logs/integrations/`)

- **Purpose**: External API calls, platform integrations, third-party service interactions
- **Retention**: 30 days (configurable via `LOG_RETENTION_INTEGRATION_DAYS`)
- **Rotation**: Daily rotation with gzip compression
- **File Size Limit**: 20MB per file
- **Files**:
  - `integrations-YYYY-MM-DD.log` - General integration events
  - `api-errors-YYYY-MM-DD.log` - API error logs (kept for 60 days)

### 4. Worker Logs (`logs/workers/`)

- **Purpose**: Background worker processes, queue management, job processing
- **Retention**: 30 days (configurable via `LOG_RETENTION_WORKER_DAYS`)
- **Rotation**: Daily rotation with gzip compression
- **File Size Limit**: 30MB per file
- **Files**:
  - `workers-YYYY-MM-DD.log` - General worker events
  - `queue-YYYY-MM-DD.log` - Queue management events
  - `worker-errors-YYYY-MM-DD.log` - Worker error logs (kept for 60 days)

### 5. Shield Logs (`logs/shield/`)

- **Purpose**: Content moderation, toxicity detection, automated actions
- **Retention**: 90 days (configurable via `LOG_RETENTION_SHIELD_DAYS`)
- **Rotation**: Daily rotation with gzip compression
- **File Size Limit**: 20MB per file
- **Special Handling**: Contains sensitive content markers for compliance
- **Files**:
  - `shield-YYYY-MM-DD.log` - General shield events
  - `actions-YYYY-MM-DD.log` - Automated moderation actions

### 6. Audit Logs (`logs/audit/`)

- **Purpose**: Compliance, regulatory requirements, admin actions, user activities
- **Retention**: 365 days (configurable via `LOG_RETENTION_AUDIT_DAYS`)
- **Rotation**: Daily rotation with gzip compression
- **File Size Limit**: 10MB per file
- **Special Handling**: Extended retention for compliance requirements
- **Files**:
  - `audit-YYYY-MM-DD.log` - General audit events
  - `user-actions-YYYY-MM-DD.log` - User activity logs
  - `admin-actions-YYYY-MM-DD.log` - Administrative actions

## Automated Log Management

### Log Rotation

- **System**: Winston with `winston-daily-rotate-file`
- **Schedule**: Daily rotation at midnight UTC
- **Compression**: Automatic gzip compression of rotated files
- **Format**: JSON structured logging with timestamps
- **Audit Files**: Winston maintains metadata for each log type

### Automatic Cleanup

- **Schedule**: Daily at 2:00 AM UTC (configurable via `LOG_CLEANUP_SCHEDULE`)
- **Process**: Removes files older than retention period
- **Safety**: Dry-run mode available for testing
- **Logging**: Cleanup operations are logged with file counts and sizes freed

### Health Monitoring

- **Schedule**: Every 6 hours (configurable via `LOG_MONITORING_SCHEDULE`)
- **Checks**:
  - Total log directory size vs. threshold (default: 5GB)
  - Oldest log file detection
  - File count and growth rate monitoring
  - Backup system health verification

## Cloud Backup System

### S3 Backup Configuration

- **Provider**: Amazon S3 (configurable to other S3-compatible services)
- **Bucket**: Configured via `LOG_BACKUP_S3_BUCKET`
- **Region**: Configurable via `AWS_REGION` (default: us-east-1)
- **Encryption**: Server-side encryption with AES-256
- **Storage Class**: Standard-IA (Infrequent Access) for cost optimization

### Backup Schedule

- **Daily Backup**: 3:00 AM UTC (configurable via `LOG_BACKUP_SCHEDULE`)
- **Scope**: Last 7 days of logs (configurable via `LOG_BACKUP_RECENT_DAYS`)
- **Process**: Incremental backup, skips existing files
- **Organization**: Files organized by date and log type in S3

### Backup Retention

- **Remote Retention**: 90 days (configurable via `LOG_BACKUP_RETENTION_DAYS`)
- **Cleanup Schedule**: Weekly on Sunday at 4:00 AM UTC
- **Verification**: Backup integrity checks with size and metadata validation

### Backup File Structure

```
s3://bucket-name/roastr-ai-logs/
├── 2024-01-15/
│   ├── application/
│   │   ├── app-2024-01-15.log.gz
│   │   └── error-2024-01-15.log.gz
│   ├── security/
│   │   ├── security-2024-01-15.log.gz
│   │   └── auth-2024-01-15.log.gz
│   └── ...
└── 2024-01-16/
    └── ...
```

## Environment Configuration

### Required Environment Variables

```bash
# S3 Backup Configuration
LOG_BACKUP_S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Optional Configuration
LOG_BACKUP_S3_PREFIX=roastr-ai-logs
LOG_BACKUP_ENABLED=true
LOG_BACKUP_RECENT_DAYS=7
LOG_BACKUP_RETENTION_DAYS=90
```

### Retention Period Configuration

```bash
# Log Retention (in days)
LOG_RETENTION_APPLICATION_DAYS=30
LOG_RETENTION_INTEGRATION_DAYS=30
LOG_RETENTION_SHIELD_DAYS=90
LOG_RETENTION_SECURITY_DAYS=90
LOG_RETENTION_WORKER_DAYS=30
LOG_RETENTION_AUDIT_DAYS=365
```

### Schedule Configuration

```bash
# Cron Schedules (UTC)
LOG_CLEANUP_SCHEDULE="0 2 * * *"        # Daily at 2 AM
LOG_BACKUP_SCHEDULE="0 3 * * *"         # Daily at 3 AM
LOG_BACKUP_CLEANUP_SCHEDULE="0 4 0 * *" # Weekly Sunday at 4 AM
LOG_MONITORING_SCHEDULE="0 */6 * * *"   # Every 6 hours
```

### Monitoring and Alerting

```bash
# Alert Configuration
LOG_CLEANUP_ENABLED=true
LOG_BACKUP_ENABLED=true
LOG_MONITORING_ENABLED=true
LOG_ALERT_THRESHOLD_GB=5.0
LOG_ALERT_WEBHOOK_URL=https://your-webhook-url
```

## Management Commands

### Statistics and Monitoring

```bash
# View log statistics
npm run logs:stats

# Check maintenance service status
npm run logs:maintenance:status

# Run health check
npm run logs:maintenance:health
```

### Manual Operations

```bash
# Manual cleanup (dry run)
npm run logs:cleanup:dry

# Manual cleanup (actual)
npm run logs:cleanup

# Manual backup
npm run logs:backup

# List backups
npm run logs:backup:list

# Test all systems
npm run logs:test
```

### Service Management

```bash
# Start maintenance service
npm run logs:maintenance:start

# Advanced cleanup with custom retention
node src/cli/logManager.js cleanup --application-days 14 --audit-days 180

# Backup specific date range
node src/cli/logManager.js backup upload --days 30

# Download specific backup
node src/cli/logManager.js backup download s3-key-here
```

## Security Considerations

### Access Control

- **S3 Bucket**: Restrict access using IAM policies
- **Encryption**: All backups encrypted at rest and in transit
- **Authentication**: AWS credentials with minimal required permissions

### Data Privacy

- **Shield Logs**: Contains sensitive content markers, handle with care
- **Audit Logs**: May contain PII, ensure compliance with data protection regulations
- **Retention Limits**: Automatic deletion ensures data isn't retained longer than necessary

### Compliance

- **Audit Trail**: All log management operations are logged
- **Immutability**: Log files are append-only with tamper detection
- **Backup Verification**: Regular integrity checks on backup files

## Disaster Recovery

### Recovery Procedures

1. **Restore from S3**: Use CLI to download specific backup files
2. **Partial Recovery**: Restore specific log types or date ranges
3. **Full Recovery**: Automated restore scripts for complete log history

### Recovery Testing

- **Schedule**: Quarterly backup restore tests
- **Verification**: Compare restored logs with original checksums
- **Documentation**: Maintain recovery runbooks and procedures

## Performance Impact

### System Resources

- **Disk I/O**: Log rotation minimizes I/O during business hours
- **Storage**: Automatic cleanup prevents unlimited growth
- **Network**: S3 uploads scheduled during low-traffic periods

### Optimization

- **Compression**: Reduces storage requirements by ~70%
- **Incremental Backups**: Only new/changed files are uploaded
- **Background Processing**: All maintenance operations run asynchronously

## Monitoring and Alerting

### Automatic Alerts

- **Cleanup Failures**: Immediate notification if scheduled cleanup fails
- **Backup Failures**: Alert on backup job failures or high error rates
- **Size Thresholds**: Warning when log directory exceeds configured size
- **Stale Backups**: Alert if backups haven't run in 48+ hours

### Health Metrics

- **Log Growth Rate**: Monitor daily log volume trends
- **Error Rates**: Track error log frequency and patterns
- **Backup Success**: Monitor backup completion rates and timing
- **Storage Utilization**: Track local and S3 storage usage

## Troubleshooting

### Common Issues

#### Cleanup Not Running

```bash
# Check service status
npm run logs:maintenance:status

# Manual cleanup test
npm run logs:cleanup:dry

# Check environment configuration
echo $LOG_CLEANUP_ENABLED
```

#### Backup Failures

```bash
# Verify S3 configuration
node src/cli/logManager.js backup list

# Test S3 credentials
aws s3 ls s3://your-bucket-name

# Check backup service status
npm run logs:maintenance:health
```

#### High Disk Usage

```bash
# Check log statistics
npm run logs:stats

# Force cleanup with shorter retention
node src/cli/logManager.js cleanup --application-days 7 --integration-days 7

# Verify cleanup actually removes files
ls -la logs/*/
```

### Emergency Procedures

- **Disk Full**: Immediate manual cleanup with aggressive retention
- **Backup Corruption**: Verify checksums and re-upload if necessary
- **Performance Issues**: Temporarily disable debug logging or increase rotation frequency

## Compliance and Legal

### Data Retention Requirements

- **GDPR**: Audit logs support right to be forgotten with user ID filtering
- **SOX**: Financial audit trails maintained for required periods
- **HIPAA**: If applicable, enhanced encryption and access controls

### Legal Hold

- **Process**: Suspend automated cleanup for specific date ranges during legal proceedings
- **Implementation**: Update retention configuration to preserve relevant logs
- **Documentation**: Maintain records of legal hold periods and scope

---

**Document Version**: 1.0  
**Last Updated**: {{ current_date }}  
**Review Schedule**: Quarterly  
**Owner**: Infrastructure Team  
**Approval**: Security and Compliance Teams
