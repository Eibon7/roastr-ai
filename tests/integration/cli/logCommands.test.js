/**
 * Log Commands CLI Integration Tests
 * 
 * Tests for CLI commands related to log management:
 * - backup command with various options
 * - maintain command with cleanup and monitoring
 * - Command argument parsing and validation
 * - Output formatting and error handling
 * - Integration with actual services
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Test configuration
const CLI_PATH = path.join(__dirname, '../../../src/cli.js');
const TEST_TIMEOUT = 30000;

describe('Log Commands CLI Integration', () => {
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_BACKUP_S3_BUCKET = 'test-bucket';
    process.env.LOG_BACKUP_S3_PREFIX = 'test-logs';
    process.env.AWS_REGION = 'us-east-1';
    process.env.LOG_CLEANUP_ENABLED = 'true';
    process.env.LOG_MONITORING_ENABLED = 'true';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('backup command', () => {
    test('should show help when no arguments provided', () => {
      const result = execSync(`node ${CLI_PATH} backup --help`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('backup logs to S3');
      expect(result).toContain('--days');
      expect(result).toContain('--dry-run');
      expect(result).toContain('--skip-existing');
    });

    test('should perform dry run backup', () => {
      const result = execSync(`node ${CLI_PATH} backup --days 1 --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('DRY RUN');
      expect(result).toContain('would upload');
      expect(result).not.toContain('uploaded to S3');
    });

    test('should validate days parameter', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} backup --days 0`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();

      expect(() => {
        execSync(`node ${CLI_PATH} backup --days 366`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();
    });

    test('should handle missing S3 configuration gracefully', () => {
      const testEnv = { ...process.env };
      delete testEnv.LOG_BACKUP_S3_BUCKET;

      const result = execSync(`node ${CLI_PATH} backup --days 1`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT,
        env: testEnv
      });

      expect(result).toContain('S3 backup is not configured');
    });

    test('should show progress for multi-day backup', (done) => {
      const child = spawn('node', [CLI_PATH, 'backup', '--days', '3', '--dry-run'], {
        stdio: 'pipe'
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toContain('Processing day');
        expect(output).toContain('Summary:');
        expect(output).toContain('Total days processed: 3');
        done();
      });

      setTimeout(() => {
        child.kill();
        done(new Error('Test timeout'));
      }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);

    test('should support JSON output format', () => {
      const result = execSync(`node ${CLI_PATH} backup --days 1 --dry-run --format json`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('summary');
      expect(output).toHaveProperty('results');
      expect(output.summary).toHaveProperty('totalDays');
      expect(output.summary).toHaveProperty('totalUploaded');
    });

    test('should handle specific date backup', () => {
      const result = execSync(`node ${CLI_PATH} backup --date 2024-01-01 --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('2024-01-01');
      expect(result).toContain('DRY RUN');
    });

    test('should validate date format', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} backup --date invalid-date`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();

      expect(() => {
        execSync(`node ${CLI_PATH} backup --date 2024-13-01`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();
    });
  });

  describe('maintain command', () => {
    test('should show help when no subcommand provided', () => {
      const result = execSync(`node ${CLI_PATH} maintain --help`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('log maintenance operations');
      expect(result).toContain('cleanup');
      expect(result).toContain('status');
      expect(result).toContain('health');
    });

    test('should perform cleanup dry run', () => {
      const result = execSync(`node ${CLI_PATH} maintain cleanup --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('DRY RUN');
      expect(result).toContain('would remove');
      expect(result).toContain('files');
    });

    test('should show service status', () => {
      const result = execSync(`node ${CLI_PATH} maintain status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Log Maintenance Service Status');
      expect(result).toContain('Running:');
      expect(result).toContain('Configuration:');
    });

    test('should perform health check', () => {
      const result = execSync(`node ${CLI_PATH} maintain health`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Log Health Check');
      expect(result).toContain('Status:');
      expect(result).toContain('Statistics:');
    });

    test('should support JSON output for status', () => {
      const result = execSync(`node ${CLI_PATH} maintain status --format json`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('isRunning');
      expect(output).toHaveProperty('config');
      expect(output).toHaveProperty('activeJobs');
    });

    test('should support JSON output for health check', () => {
      const result = execSync(`node ${CLI_PATH} maintain health --format json`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      const output = JSON.parse(result);
      expect(output).toHaveProperty('status');
      expect(output).toHaveProperty('timestamp');
      expect(output).toHaveProperty('statistics');
    });

    test('should allow custom retention days for cleanup', () => {
      const result = execSync(`node ${CLI_PATH} maintain cleanup --application-days 60 --audit-days 730 --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('application: 60 days');
      expect(result).toContain('audit: 730 days');
    });

    test('should validate retention day parameters', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} maintain cleanup --application-days -1`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();

      expect(() => {
        execSync(`node ${CLI_PATH} maintain cleanup --audit-days 0`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();
    });
  });

  describe('command error handling', () => {
    test('should handle invalid command gracefully', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} invalid-command`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();
    });

    test('should show helpful error for missing required arguments', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} backup`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow();
    });

    test('should handle service initialization errors', () => {
      const testEnv = { ...process.env };
      testEnv.LOG_CLEANUP_ENABLED = 'false';
      testEnv.LOG_MONITORING_ENABLED = 'false';

      const result = execSync(`node ${CLI_PATH} maintain status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT,
        env: testEnv
      });

      expect(result).toContain('disabled');
    });
  });

  describe('output formatting', () => {
    test('should format file sizes correctly', () => {
      const result = execSync(`node ${CLI_PATH} maintain health`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      // Should contain formatted sizes like "1.5 MB", "2.3 GB", etc.
      expect(result).toMatch(/\d+\.?\d*\s+(B|KB|MB|GB)/);
    });

    test('should format dates consistently', () => {
      const result = execSync(`node ${CLI_PATH} maintain health`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      // Should contain ISO date format
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should show progress indicators for long operations', (done) => {
      const child = spawn('node', [CLI_PATH, 'backup', '--days', '7', '--dry-run'], {
        stdio: 'pipe'
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toMatch(/Processing.*\d+\/\d+/);
        done();
      });

      setTimeout(() => {
        child.kill();
        done(new Error('Test timeout'));
      }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);
  });

  describe('configuration validation', () => {
    test('should validate S3 configuration for backup command', () => {
      const testEnv = { ...process.env };
      delete testEnv.AWS_REGION;

      expect(() => {
        execSync(`node ${CLI_PATH} backup --days 1`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT,
          env: testEnv
        });
      }).toThrow();
    });

    test('should show configuration in status output', () => {
      const result = execSync(`node ${CLI_PATH} maintain status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Cleanup enabled:');
      expect(result).toContain('Backup enabled:');
      expect(result).toContain('Monitoring enabled:');
    });

    test('should handle environment variable overrides', () => {
      const testEnv = { ...process.env };
      testEnv.LOG_RETENTION_APPLICATION_DAYS = '45';

      const result = execSync(`node ${CLI_PATH} maintain status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT,
        env: testEnv
      });

      expect(result).toContain('application: 45 days');
    });
  });

  describe('End-to-End Log Management Flow', () => {
    let tempLogDir;

    beforeAll(async () => {
      // Create temporary log directory for testing
      tempLogDir = path.join(__dirname, '../../../temp-test-logs');
      await fs.mkdir(tempLogDir, { recursive: true });

      // Set up test environment with temp directory
      process.env.LOG_DIR = tempLogDir;
    });

    afterAll(async () => {
      // Clean up temp directory
      await fs.rm(tempLogDir, { recursive: true, force: true });
    });

    test('should perform complete backup and cleanup cycle', async () => {
      // Create test log files
      const logFiles = [
        'application.log',
        'error.log',
        'integration.log'
      ];

      for (const logFile of logFiles) {
        const filePath = path.join(tempLogDir, logFile);
        await fs.writeFile(filePath, `Test log content for ${logFile}\n`.repeat(100));
      }

      // Run backup command
      const backupResult = execSync(`node ${CLI_PATH} backup --days 1 --dry-run --format json`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      const backupOutput = JSON.parse(backupResult);
      expect(backupOutput.summary.totalUploaded).toBeGreaterThan(0);

      // Run cleanup command
      const cleanupResult = execSync(`node ${CLI_PATH} maintain cleanup --dry-run --format json`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      const cleanupOutput = JSON.parse(cleanupResult);
      expect(cleanupOutput).toHaveProperty('filesRemoved');

      // Run health check
      const healthResult = execSync(`node ${CLI_PATH} maintain health --format json`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      const healthOutput = JSON.parse(healthResult);
      expect(healthOutput.status).toMatch(/healthy|warning/);
      expect(healthOutput.statistics).toHaveProperty('totalSize');
    }, TEST_TIMEOUT * 2);

    test('should handle service lifecycle correctly', async () => {
      // Check initial status
      const initialStatus = execSync(`node ${CLI_PATH} maintain status --format json`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      const initialOutput = JSON.parse(initialStatus);
      expect(initialOutput).toHaveProperty('isRunning');
      expect(initialOutput).toHaveProperty('config');

      // The service should be properly configured
      expect(initialOutput.config.cleanup.enabled).toBe(true);
      expect(initialOutput.config.monitoring.enabled).toBe(true);
    });
  });

  describe('End-to-End Log Management Flow', () => {
    let tempLogDir;

    beforeAll(async () => {
      // Create temporary log directory for testing
      tempLogDir = path.join(__dirname, '../../../temp-test-logs');
      await fs.mkdir(tempLogDir, { recursive: true });

      // Set up test environment with temp directory
      process.env.LOG_DIR = tempLogDir;
    });

    afterAll(async () => {
      // Clean up temp directory
      await fs.rm(tempLogDir, { recursive: true, force: true });
    });

    test('should perform complete backup and cleanup cycle', async () => {
      // Create test log files
      const logFiles = [
        'application.log',
        'error.log',
        'integration.log'
      ];

      for (const logFile of logFiles) {
        const filePath = path.join(tempLogDir, logFile);
        await fs.writeFile(filePath, `Test log content for ${logFile}\n`.repeat(100));
      }

      // Run backup command
      const backupResult = execSync(`node ${CLI_PATH} backup --days 1 --dry-run --format json`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      const backupOutput = JSON.parse(backupResult);
      expect(backupOutput.summary.totalUploaded).toBeGreaterThan(0);

      // Run cleanup command
      const cleanupResult = execSync(`node ${CLI_PATH} maintain cleanup --dry-run --format json`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      const cleanupOutput = JSON.parse(cleanupResult);
      expect(cleanupOutput).toHaveProperty('filesRemoved');

      // Run health check
      const healthResult = execSync(`node ${CLI_PATH} maintain health --format json`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      const healthOutput = JSON.parse(healthResult);
      expect(healthOutput.status).toMatch(/healthy|warning/);
      expect(healthOutput.statistics).toHaveProperty('totalSize');
    }, TEST_TIMEOUT * 2);
  });
});
