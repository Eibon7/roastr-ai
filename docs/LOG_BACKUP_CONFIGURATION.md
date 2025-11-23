# Log Backup Configuration Examples

This document provides configuration examples for the log backup and maintenance system across different deployment environments.

## Overview

The log backup system supports flexible configuration through environment variables and can be adapted for different environments, from development to production scales.

## Configuration Structure

The system is configured through environment variables that control three main areas:

- **Cleanup Configuration**: Local log file retention and cleanup
- **Backup Configuration**: S3 backup schedules and settings
- **Monitoring Configuration**: Health checks and alerting

## Environment-Specific Examples

### Development Environment

Minimal configuration focused on local development:

```bash
# .env.development
NODE_ENV=development

# Cleanup Configuration - Shorter retention for dev
LOG_CLEANUP_ENABLED=true
LOG_RETENTION_APPLICATION_DAYS=7
LOG_RETENTION_INTEGRATION_DAYS=7
LOG_RETENTION_SHIELD_DAYS=14
LOG_RETENTION_SECURITY_DAYS=30
LOG_RETENTION_WORKER_DAYS=7
LOG_RETENTION_AUDIT_DAYS=90
LOG_CLEANUP_SCHEDULE="0 3 * * *"  # Daily at 3 AM

# Backup Configuration - Disabled for local dev
LOG_BACKUP_ENABLED=false
LOG_BACKUP_S3_BUCKET=""
LOG_BACKUP_S3_PREFIX=""
LOG_BACKUP_RECENT_DAYS=3
LOG_BACKUP_RETENTION_DAYS=30
LOG_BACKUP_SCHEDULE="0 4 * * 0"     # Weekly
LOG_BACKUP_CLEANUP_SCHEDULE="0 5 0 * *"  # Monthly

# Monitoring Configuration
LOG_MONITORING_ENABLED=true
LOG_MONITORING_SCHEDULE="0 */12 * * *"  # Every 12 hours
LOG_ALERT_THRESHOLD_GB=1.0

# Alerting Configuration - Console only
ALERTING_ENABLED=true
LOG_ALERT_WEBHOOK_URL=""
EMAIL_ALERTS_ENABLED=false
MAX_ALERTS_PER_HOUR=20
ALERT_COOLDOWN_MINUTES=5

# AWS Configuration - Not needed for dev
AWS_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
```

### Testing Environment

Configuration optimized for automated testing:

```bash
# .env.testing
NODE_ENV=test

# Cleanup Configuration - Very short retention for tests
LOG_CLEANUP_ENABLED=true
LOG_RETENTION_APPLICATION_DAYS=1
LOG_RETENTION_INTEGRATION_DAYS=1
LOG_RETENTION_SHIELD_DAYS=3
LOG_RETENTION_SECURITY_DAYS=7
LOG_RETENTION_WORKER_DAYS=1
LOG_RETENTION_AUDIT_DAYS=30
LOG_CLEANUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Backup Configuration - Enabled with test bucket
LOG_BACKUP_ENABLED=true
LOG_BACKUP_S3_BUCKET="roastr-ai-logs-test"
LOG_BACKUP_S3_PREFIX="test-logs"
LOG_BACKUP_RECENT_DAYS=2
LOG_BACKUP_RETENTION_DAYS=14
LOG_BACKUP_SCHEDULE="0 3 * * *"     # Daily for testing
LOG_BACKUP_CLEANUP_SCHEDULE="0 4 * * 0"  # Weekly cleanup

# Monitoring Configuration - Frequent checks
LOG_MONITORING_ENABLED=true
LOG_MONITORING_SCHEDULE="0 */6 * * *"   # Every 6 hours
LOG_ALERT_THRESHOLD_GB=0.5

# Alerting Configuration - Aggressive for test feedback
ALERTING_ENABLED=true
LOG_ALERT_WEBHOOK_URL="https://hooks.slack.com/test-channel"
EMAIL_ALERTS_ENABLED=false
MAX_ALERTS_PER_HOUR=50
ALERT_COOLDOWN_MINUTES=1

# AWS Configuration - Test credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-test-access-key
AWS_SECRET_ACCESS_KEY=your-test-secret-key
```

### Staging Environment

Production-like configuration with moderate retention:

```bash
# .env.staging
NODE_ENV=staging

# Cleanup Configuration - Medium retention
LOG_CLEANUP_ENABLED=true
LOG_RETENTION_APPLICATION_DAYS=14
LOG_RETENTION_INTEGRATION_DAYS=14
LOG_RETENTION_SHIELD_DAYS=30
LOG_RETENTION_SECURITY_DAYS=60
LOG_RETENTION_WORKER_DAYS=14
LOG_RETENTION_AUDIT_DAYS=180
LOG_CLEANUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Backup Configuration - Full backup enabled
LOG_BACKUP_ENABLED=true
LOG_BACKUP_S3_BUCKET="roastr-ai-logs-staging"
LOG_BACKUP_S3_PREFIX="staging-logs"
LOG_BACKUP_RECENT_DAYS=7
LOG_BACKUP_RETENTION_DAYS=60
LOG_BACKUP_SCHEDULE="0 3 * * *"     # Daily
LOG_BACKUP_CLEANUP_SCHEDULE="0 4 0 * *"  # Weekly cleanup

# Monitoring Configuration - Regular checks
LOG_MONITORING_ENABLED=true
LOG_MONITORING_SCHEDULE="0 */6 * * *"   # Every 6 hours
LOG_ALERT_THRESHOLD_GB=3.0

# Alerting Configuration - Balanced
ALERTING_ENABLED=true
LOG_ALERT_WEBHOOK_URL="https://hooks.slack.com/staging-alerts"
EMAIL_ALERTS_ENABLED=true
ALERT_EMAIL_RECIPIENTS="devops-staging@company.com"
MAX_ALERTS_PER_HOUR=15
ALERT_COOLDOWN_MINUTES=10

# AWS Configuration - Staging credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-staging-access-key
AWS_SECRET_ACCESS_KEY=your-staging-secret-key
```

### Production Environment

Enterprise-grade configuration with comprehensive backup and monitoring:

```bash
# .env.production
NODE_ENV=production

# Cleanup Configuration - Extended retention for production
LOG_CLEANUP_ENABLED=true
LOG_RETENTION_APPLICATION_DAYS=30
LOG_RETENTION_INTEGRATION_DAYS=30
LOG_RETENTION_SHIELD_DAYS=90
LOG_RETENTION_SECURITY_DAYS=180  # 6 months for security logs
LOG_RETENTION_WORKER_DAYS=30
LOG_RETENTION_AUDIT_DAYS=2555    # 7 years for audit logs
LOG_CLEANUP_SCHEDULE="0 1 * * *"  # Daily at 1 AM (off-peak)

# Backup Configuration - Comprehensive backup strategy
LOG_BACKUP_ENABLED=true
LOG_BACKUP_S3_BUCKET="roastr-ai-logs-production"
LOG_BACKUP_S3_PREFIX="prod-logs"
LOG_BACKUP_RECENT_DAYS=14        # Backup last 2 weeks daily
LOG_BACKUP_RETENTION_DAYS=2555   # Keep backups for 7 years
LOG_BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
LOG_BACKUP_CLEANUP_SCHEDULE="0 3 0 * *"  # Weekly cleanup

# Monitoring Configuration - Comprehensive monitoring
LOG_MONITORING_ENABLED=true
LOG_MONITORING_SCHEDULE="0 */4 * * *"    # Every 4 hours
LOG_ALERT_THRESHOLD_GB=10.0

# Alerting Configuration - Enterprise alerting
ALERTING_ENABLED=true
LOG_ALERT_WEBHOOK_URL="https://hooks.slack.com/production-critical"
EMAIL_ALERTS_ENABLED=true
ALERT_EMAIL_RECIPIENTS="devops@company.com,oncall@company.com"
MAX_ALERTS_PER_HOUR=10
ALERT_COOLDOWN_MINUTES=15

# AWS Configuration - Production with IAM role (preferred)
AWS_REGION=us-east-1
# Use IAM role instead of access keys in production
# AWS_ACCESS_KEY_ID=""
# AWS_SECRET_ACCESS_KEY=""
```

### High-Volume Production Environment

Configuration for applications with high log volume:

```bash
# .env.production-high-volume
NODE_ENV=production

# Cleanup Configuration - Aggressive cleanup for high volume
LOG_CLEANUP_ENABLED=true
LOG_RETENTION_APPLICATION_DAYS=14   # Shorter retention due to volume
LOG_RETENTION_INTEGRATION_DAYS=14
LOG_RETENTION_SHIELD_DAYS=30
LOG_RETENTION_SECURITY_DAYS=90     # Still keep security logs longer
LOG_RETENTION_WORKER_DAYS=7        # Workers generate lots of logs
LOG_RETENTION_AUDIT_DAYS=2555      # Audit logs still need long retention
LOG_CLEANUP_SCHEDULE="0 1,13 * * *"  # Twice daily cleanup

# Backup Configuration - Optimized for high volume
LOG_BACKUP_ENABLED=true
LOG_BACKUP_S3_BUCKET="roastr-ai-logs-prod-hv"
LOG_BACKUP_S3_PREFIX="hv-logs"
LOG_BACKUP_RECENT_DAYS=7          # Only backup last week
LOG_BACKUP_RETENTION_DAYS=365     # 1 year retention in S3
LOG_BACKUP_SCHEDULE="0 2 * * *"   # Daily backup
LOG_BACKUP_CLEANUP_SCHEDULE="0 3 * * 0"  # Weekly S3 cleanup

# Monitoring Configuration - Frequent monitoring for high volume
LOG_MONITORING_ENABLED=true
LOG_MONITORING_SCHEDULE="0 */2 * * *"    # Every 2 hours
LOG_ALERT_THRESHOLD_GB=25.0       # Higher threshold for high volume

# Alerting Configuration - Reduced noise
ALERTING_ENABLED=true
LOG_ALERT_WEBHOOK_URL="https://hooks.slack.com/high-volume-alerts"
EMAIL_ALERTS_ENABLED=true
ALERT_EMAIL_RECIPIENTS="platform-team@company.com"
MAX_ALERTS_PER_HOUR=5             # Lower to reduce noise
ALERT_COOLDOWN_MINUTES=30         # Longer cooldown

# AWS Configuration - Multi-region for redundancy
AWS_REGION=us-east-1
```

### Docker Compose Configuration

Example docker-compose.yml with environment-specific configs:

```yaml
# docker-compose.yml
version: '3.8'
services:
  roastr-ai:
    image: roastr-ai:latest
    environment:
      # Load from environment-specific file
      - NODE_ENV=${NODE_ENV:-development}
    env_file:
      - .env.${NODE_ENV:-development}
    volumes:
      # Mount logs directory for persistence
      - ./logs:/app/logs
      # Mount config for log maintenance service
      - ./config/log-maintenance.json:/app/config/log-maintenance.json
    restart: unless-stopped
```

### Kubernetes Configuration

Example Kubernetes ConfigMap and deployment:

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: roastr-ai-log-config
data:
  LOG_CLEANUP_ENABLED: 'true'
  LOG_RETENTION_APPLICATION_DAYS: '30'
  LOG_BACKUP_ENABLED: 'true'
  LOG_BACKUP_S3_BUCKET: 'roastr-ai-logs-k8s'
  LOG_MONITORING_ENABLED: 'true'
---
apiVersion: v1
kind: Secret
metadata:
  name: roastr-ai-aws-credentials
type: Opaque
data:
  AWS_ACCESS_KEY_ID: <base64-encoded-key>
  AWS_SECRET_ACCESS_KEY: <base64-encoded-secret>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: roastr-ai
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: roastr-ai
          image: roastr-ai:latest
          envFrom:
            - configMapRef:
                name: roastr-ai-log-config
            - secretRef:
                name: roastr-ai-aws-credentials
          volumeMounts:
            - name: logs-storage
              mountPath: /app/logs
      volumes:
        - name: logs-storage
          persistentVolumeClaim:
            claimName: roastr-ai-logs-pvc
```

## Schedule Configuration Guide

### Cron Expression Examples

| Schedule                   | Cron Expression | Use Case                  |
| -------------------------- | --------------- | ------------------------- |
| Every hour                 | `0 * * * *`     | High-frequency monitoring |
| Every 6 hours              | `0 */6 * * *`   | Regular monitoring        |
| Daily at 2 AM              | `0 2 * * *`     | Daily cleanup             |
| Weekly on Sunday at 3 AM   | `0 3 * * 0`     | Weekly backup cleanup     |
| Monthly on 1st at midnight | `0 0 1 * *`     | Monthly maintenance       |
| Twice daily (6 AM, 6 PM)   | `0 6,18 * * *`  | High-volume cleanup       |

### Best Practice Scheduling

1. **Stagger Operations**: Avoid running all maintenance tasks simultaneously

   ```
   Cleanup: 01:00 UTC
   Backup: 02:00 UTC
   Monitoring: 03:00 UTC
   ```

2. **Consider Time Zones**: Use UTC for consistency across regions

3. **Off-Peak Hours**: Schedule intensive operations during low-traffic periods

4. **Resource Constraints**: Space operations to avoid overwhelming the system

## Retention Policy Guidelines

### Application Logs

- **Development**: 1-7 days (rapid iteration)
- **Staging**: 14-30 days (debugging needs)
- **Production**: 30-90 days (troubleshooting window)

### Security Logs

- **Minimum**: 90 days (compliance requirements)
- **Recommended**: 180+ days (investigation needs)
- **Audit Logs**: 7 years (legal requirements)

### Integration Logs

- **Development**: 1-7 days (quick feedback)
- **Production**: 30-60 days (debugging integrations)

## Cost Optimization

### S3 Storage Classes

Configure lifecycle policies to optimize costs:

```json
{
  "Rules": [
    {
      "ID": "LogLifecycle",
      "Status": "Enabled",
      "Filter": { "Prefix": "logs/" },
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" },
        { "Days": 365, "StorageClass": "DEEP_ARCHIVE" }
      ]
    }
  ]
}
```

### Volume-Based Configuration

Adjust retention based on log volume:

- High volume (>1GB/day): Shorter retention, frequent cleanup
- Medium volume (100MB-1GB/day): Standard retention
- Low volume (<100MB/day): Extended retention for debugging

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Storage Usage**
   - Local disk space
   - S3 storage costs
   - Growth rate

2. **Backup Health**
   - Success/failure rates
   - Backup duration
   - Data integrity

3. **System Performance**
   - Cleanup operation duration
   - I/O impact during backup
   - Memory usage during operations

### Alert Thresholds

| Metric          | Warning          | Critical         | Action                     |
| --------------- | ---------------- | ---------------- | -------------------------- |
| Disk Usage      | 80%              | 90%              | Increase cleanup frequency |
| Backup Failures | 10%              | 25%              | Check S3 connectivity      |
| Log Volume      | 150% of baseline | 200% of baseline | Investigate log sources    |

## Troubleshooting

### Common Configuration Issues

1. **Cron Expression Validation**: Use [crontab.guru](https://crontab.guru/) to validate expressions

2. **Timezone Issues**: Always use UTC for consistent scheduling

3. **Permission Problems**: Verify IAM permissions match the configuration

4. **Resource Conflicts**: Ensure adequate CPU/memory for concurrent operations

### Validation Commands

```bash
# Test configuration loading
npm run log-maintenance:test-config

# Validate cron expressions
npm run log-maintenance:validate-schedules

# Test S3 connectivity
npm run log-maintenance:test-backup

# Check current log statistics
npm run log-maintenance:status
```

## Related Documentation

- [S3 IAM Permissions](S3_IAM_PERMISSIONS.md)
- [Log Retention Policy](LOG_RETENTION_POLICY.md)
- [Monitoring and Alerting Setup](MONITORING_SETUP.md)
