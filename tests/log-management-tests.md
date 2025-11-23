# Log Management Test Coverage

This document describes the comprehensive test coverage for the log rotation and backup system as requested in Issue #131.

## Overview

The test suite covers three main components:

- **Log Backup Service** - S3 backup functionality
- **Log Maintenance Service** - Scheduled cleanup and monitoring
- **Alert Service** - Notification system for log management events

## Test Structure

### Unit Tests

#### 1. Log Backup Service (`tests/unit/services/logBackupService.test.js`)

**Coverage Areas:**

- ✅ Service initialization and configuration
- ✅ S3 client setup and validation
- ✅ File upload operations with retry logic
- ✅ Backup scheduling and retention policies
- ✅ Error handling and recovery mechanisms
- ✅ Mock mode compatibility for testing

**Key Test Scenarios:**

- S3 configuration validation
- File upload with metadata and compression
- Retry logic for failed uploads
- Backup listing and filtering
- Date range validation
- Dry run operations

#### 2. Log Maintenance Service (`tests/unit/utils/logMaintenance.test.js`)

**Coverage Areas:**

- ✅ Service lifecycle (start/stop)
- ✅ Cron job scheduling and management
- ✅ Manual cleanup operations
- ✅ Health monitoring and statistics
- ✅ Configuration validation
- ✅ Integration with backup service

**Key Test Scenarios:**

- Service initialization with environment variables
- Scheduled job creation and management
- Manual cleanup with custom retention periods
- Health check with alert generation
- Service status reporting
- Error handling for failed operations

#### 3. Alert Service (`tests/unit/services/alertService.test.js`)

**Coverage Areas:**

- ✅ Alert configuration and initialization
- ✅ Webhook and email alert delivery
- ✅ Rate limiting and cooldown mechanisms
- ✅ Alert message formatting
- ✅ Multi-channel alert distribution
- ✅ Error handling and fallback mechanisms

**Key Test Scenarios:**

- Alert building and formatting
- Webhook delivery with timeout handling
- Email template generation
- Rate limiting enforcement
- Cooldown period validation
- Multi-channel failure handling

### Integration Tests

#### CLI Commands (`tests/integration/cli/logCommands.test.js`)

**Coverage Areas:**

- ✅ `backup` command with various options
- ✅ `maintain` command with subcommands
- ✅ Command argument parsing and validation
- ✅ Output formatting (text and JSON)
- ✅ Error handling and user feedback
- ✅ End-to-end workflow testing

**Key Test Scenarios:**

- Backup command with dry-run mode
- Maintenance cleanup with custom retention
- Service status and health checks
- JSON output format validation
- Error handling for invalid arguments
- Progress indicators for long operations

## Running the Tests

### Individual Test Suites

```bash
# Run all log management tests
npm run test:log-management

# Run specific unit tests
npx jest tests/unit/services/logBackupService.test.js
npx jest tests/unit/utils/logMaintenance.test.js
npx jest tests/unit/services/alertService.test.js

# Run CLI integration tests
npx jest tests/integration/cli/logCommands.test.js
```

### Test Configuration

The tests use specific Jest configurations:

- **Unit Tests**: Standard Jest configuration with mocking
- **Integration Tests**: Custom configuration with longer timeouts
- **Coverage**: Comprehensive coverage reporting for all services

### Environment Variables

Tests require these environment variables (automatically set in test environment):

```bash
# S3 Configuration
LOG_BACKUP_S3_BUCKET=test-bucket
LOG_BACKUP_S3_PREFIX=test-logs
AWS_REGION=us-east-1

# Cleanup Configuration
LOG_CLEANUP_ENABLED=true
LOG_RETENTION_APPLICATION_DAYS=30
LOG_RETENTION_AUDIT_DAYS=365

# Monitoring Configuration
LOG_MONITORING_ENABLED=true
LOG_ALERT_THRESHOLD_GB=5.0

# Alert Configuration
ALERTING_ENABLED=true
MAX_ALERTS_PER_HOUR=10
ALERT_COOLDOWN_MINUTES=15
```

## Coverage Metrics

The test suite aims for comprehensive coverage:

- **Unit Tests**: >90% line coverage for core services
- **Integration Tests**: End-to-end workflow validation
- **Error Scenarios**: Comprehensive error handling coverage
- **Configuration**: All environment variable combinations

## Test Reports

After running tests, reports are generated in:

- `coverage/log-management/` - Coverage reports
- `test-reports/log-management/` - Test execution reports

## Mock Strategy

### Unit Tests

- **AWS SDK**: Mocked S3 operations
- **File System**: Mocked fs-extra operations
- **Cron Jobs**: Mocked cron scheduling
- **HTTP Requests**: Mocked axios for webhooks

### Integration Tests

- **CLI Commands**: Real command execution with test environment
- **File Operations**: Temporary test directories
- **Service Integration**: Real service initialization with test config

## Continuous Integration

The tests are designed to run in CI environments:

- No external dependencies required
- Mock mode for all external services
- Deterministic test execution
- Comprehensive error reporting

## Test Maintenance

### Adding New Tests

1. Follow existing test structure and naming conventions
2. Include both success and error scenarios
3. Mock external dependencies appropriately
4. Update this documentation

### Updating Tests

1. Maintain backward compatibility where possible
2. Update mocks when service interfaces change
3. Ensure coverage metrics remain high
4. Test both unit and integration levels

## Related Issues

- **Issue #131**: Add test coverage for log rotation and backup system
- Tests cover all requirements specified in the issue
- Comprehensive coverage for logBackupService, logMaintenance, and alertService
- CLI command testing for backup and maintain operations
