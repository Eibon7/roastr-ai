/**
 * Environment Setup for CLI Integration Tests
 *
 * Sets up environment variables and configuration for testing
 */

// Save original environment
process.env.TEST_ORIGINAL_ENV = JSON.stringify({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_DIR: process.env.LOG_DIR
});

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.LOG_DIR = 'tmp/test-logs';

// Log backup configuration
process.env.LOG_BACKUP_S3_BUCKET = 'test-log-backup-bucket';
process.env.LOG_BACKUP_S3_PREFIX = 'test-logs';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_EC2_METADATA_DISABLED = 'true';
process.env.AWS_SDK_LOAD_CONFIG = '0';
process.env.AWS_S3_FORCE_PATH_STYLE = 'true';

// Log cleanup configuration
process.env.LOG_CLEANUP_ENABLED = 'true';
process.env.LOG_RETENTION_APPLICATION_DAYS = '30';
process.env.LOG_RETENTION_INTEGRATION_DAYS = '14';
process.env.LOG_RETENTION_SHIELD_DAYS = '7';
process.env.LOG_RETENTION_SECURITY_DAYS = '90';
process.env.LOG_RETENTION_WORKER_DAYS = '7';
process.env.LOG_RETENTION_AUDIT_DAYS = '365';
process.env.LOG_CLEANUP_SCHEDULE = '0 2 * * *';

// Log backup configuration
process.env.LOG_BACKUP_ENABLED = 'true';
process.env.LOG_BACKUP_RECENT_DAYS = '7';
process.env.LOG_BACKUP_RETENTION_DAYS = '90';
process.env.LOG_BACKUP_SCHEDULE = '0 3 * * *';
process.env.LOG_BACKUP_CLEANUP_SCHEDULE = '0 4 0 * *';

// Log monitoring configuration
process.env.LOG_MONITORING_ENABLED = 'true';
process.env.LOG_MONITORING_SCHEDULE = '0 */6 * * *';
process.env.LOG_ALERT_THRESHOLD_GB = '5.0';

// Alert configuration
process.env.LOG_ALERT_WEBHOOK_URL = 'http://127.0.0.1:65535/test-webhook';
process.env.EMAIL_ALERTS_ENABLED = 'true';
process.env.ALERTING_ENABLED = 'true';
process.env.MAX_ALERTS_PER_HOUR = '10';
process.env.ALERT_COOLDOWN_MINUTES = '15';
process.env.ALERT_EMAIL_RECIPIENTS = 'test-admin@example.com,test-ops@example.com';
