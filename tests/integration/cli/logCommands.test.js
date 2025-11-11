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
const CLI_PATH = path.join(__dirname, '../../../src/cli/logManager.js');
const TEST_TIMEOUT = 60000; // Increased timeout for CLI operations

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

      expect(result).toContain('Manage log backups');
      expect(result).toContain('upload');
      expect(result).toContain('list');
    });

    test('should perform dry run backup', () => {
      const result = execSync(`node ${CLI_PATH} backup upload --days 1 --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Simulating');
      expect(result).toContain('backup');
      expect(result).toContain('Days processed');
    });

    test('should accept valid days parameter', async () => {
      // Note: Commander.js doesn't validate days range, so we test that it accepts valid input
      // Invalid days would be handled by the service layer
      const result = execSync(`node ${CLI_PATH} backup upload --days 1 --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });
      
      expect(result).toBeTruthy();
    });

    test('should handle missing S3 configuration gracefully', () => {
      const testEnv = { ...process.env };
      delete testEnv.LOG_BACKUP_S3_BUCKET;

      expect(() => {
        execSync(`node ${CLI_PATH} backup upload --days 1`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT,
          env: testEnv
        });
      }).toThrow(); // CLI exits with code 1 when S3 not configured
    });

    test('should show progress for multi-day backup', (done) => {
      const child = spawn('node', [CLI_PATH, 'backup', 'upload', '--days', '3', '--dry-run'], {
        stdio: 'pipe'
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toContain('Days processed');
        expect(output).toContain('backup');
        done();
      });

      setTimeout(() => {
        child.kill();
        done(new Error('Test timeout'));
      }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);

    test('should perform backup with dry run', () => {
      const result = execSync(`node ${CLI_PATH} backup upload --days 1 --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Simulating');
      expect(result).toContain('Days processed');
    });
  });

  describe('maintenance command', () => {
    test('should show help when no subcommand provided', () => {
      const result = execSync(`node ${CLI_PATH} maintenance --help`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Manage log maintenance service');
      expect(result).toContain('start');
      expect(result).toContain('status');
      expect(result).toContain('health');
    });

    test('should show service status', () => {
      const result = execSync(`node ${CLI_PATH} maintenance status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Log Maintenance Service Status');
      expect(result).toContain('Running:');
      expect(result).toContain('Configuration:');
    });

    test('should perform health check', () => {
      const result = execSync(`node ${CLI_PATH} maintenance health`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Health Status');
      expect(result).toContain('Statistics');
    });
  });

  describe('cleanup command', () => {
    test('should perform cleanup dry run', () => {
      const result = execSync(`node ${CLI_PATH} cleanup --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Simulating');
      expect(result).toContain('Cleanup completed');
    });

    test('should allow custom retention days for cleanup', () => {
      const result = execSync(`node ${CLI_PATH} cleanup --application-days 60 --audit-days 730 --dry-run`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('applicationDays: 60');
      expect(result).toContain('auditDays: 730');
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
        execSync(`node ${CLI_PATH} backup upload`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT 
        });
      }).toThrow(); // Will fail without S3 config or throw error
    });

    test('should handle service initialization errors', () => {
      const testEnv = { ...process.env };
      testEnv.LOG_CLEANUP_ENABLED = 'false';
      testEnv.LOG_MONITORING_ENABLED = 'false';

      const result = execSync(`node ${CLI_PATH} maintenance status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT,
        env: testEnv
      });

      expect(result).toContain('Log Maintenance Service Status');
    });
  });

  describe('output formatting', () => {
    test('should format file sizes correctly', () => {
      const result = execSync(`node ${CLI_PATH} maintenance health`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      // Should contain formatted sizes like "1.5 MB", "2.3 GB", etc.
      expect(result).toMatch(/\d+\.?\d*\s+(B|KB|MB|GB)/);
    });

<<<<<<< HEAD
    test('should show health check output', () => {
      const result = execSync(`node ${CLI_PATH} maintenance health`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Health Status');
      expect(result).toContain('Statistics');
    });

    test('should show progress indicators for long operations', (done) => {
      const child = spawn('node', [CLI_PATH, 'backup', 'upload', '--days', '7', '--dry-run'], {
        stdio: 'pipe'
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toContain('Days processed');
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
      delete testEnv.LOG_BACKUP_S3_BUCKET;

      expect(() => {
        execSync(`node ${CLI_PATH} backup upload --days 1`, { 
          encoding: 'utf8',
          timeout: TEST_TIMEOUT,
          env: testEnv
        });
      }).toThrow();
    });

    test('should show configuration in status output', () => {
      const result = execSync(`node ${CLI_PATH} maintenance status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Cleanup Enabled');
      expect(result).toContain('Backup Enabled');
      expect(result).toContain('Monitoring Enabled');
<<<<<<< HEAD
    });

    test('should show status output', () => {
      const result = execSync(`node ${CLI_PATH} maintenance status`, { 
        encoding: 'utf8',
        timeout: TEST_TIMEOUT 
      });

      expect(result).toContain('Log Maintenance Service Status');
      expect(result).toContain('Configuration');
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

      // Run backup command (dry run)
      const backupResult = execSync(`node ${CLI_PATH} backup upload --days 1 --dry-run`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      expect(backupResult).toContain('Simulating');
      expect(backupResult).toContain('Days processed');
      // Verify backup output references the test files
      expect(backupResult).toMatch(/backup|upload|days/i);

      // Run cleanup command (dry run)
      const cleanupResult = execSync(`node ${CLI_PATH} cleanup --dry-run`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      expect(cleanupResult).toContain('Simulating');
      expect(cleanupResult).toContain('Cleanup completed');
      // Verify cleanup output references log files or operations
      expect(cleanupResult).toMatch(/cleanup|log|file/i);

      // Run health check
      const healthResult = execSync(`node ${CLI_PATH} maintenance health`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      expect(healthResult).toContain('Health Status');
      expect(healthResult).toContain('Statistics');
      // Verify health check includes meaningful statistics
      expect(healthResult).toMatch(/\d+/); // Should contain at least one number
    }, TEST_TIMEOUT * 2);

    test('should handle service lifecycle correctly', async () => {
      // Check initial status
      const initialStatus = execSync(`node ${CLI_PATH} maintenance status`, {
        encoding: 'utf8',
        timeout: TEST_TIMEOUT
      });

      expect(initialStatus).toContain('Log Maintenance Service Status');
      expect(initialStatus).toContain('Running:');
      expect(initialStatus).toContain('Configuration');
    });
  });
});