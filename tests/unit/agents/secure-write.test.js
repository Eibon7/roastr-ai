/**
 * Unit Tests for Secure Write Protocol
 * Test Coverage: healthBefore inclusion in write results (CodeRabbit Review #3311794192)
 */

const fs = require('fs');
const path = require('path');
const SecureWriteProtocol = require('../../../scripts/agents/secure-write.js');

describe('SecureWriteProtocol - healthBefore Fix (Review #3311794192)', () => {
  let swp;
  let testFilePath;
  let testBackupDir;

  beforeEach(() => {
    // Create test instance
    swp = new SecureWriteProtocol();
    swp.validateChecksums = false; // Disable for tests

    // Setup test file
    testFilePath = path.join(__dirname, 'test-node.md');
    testBackupDir = path.join(process.cwd(), '.gdd-backups-test');

    // Override backup dir for tests
    swp.backupDir = testBackupDir;

    // Ensure directories exist
    if (!fs.existsSync(testBackupDir)) {
      fs.mkdirSync(testBackupDir, { recursive: true });
    }

    // Create test file
    fs.writeFileSync(testFilePath, '# Test Node\n\nInitial content', 'utf8');
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    if (fs.existsSync(testBackupDir)) {
      const files = fs.readdirSync(testBackupDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testBackupDir, file));
      });
      fs.rmdirSync(testBackupDir);
    }
  });

  describe('Critical Issue C1: healthBefore in write results', () => {
    test('should include healthBefore in executeWrite result', async () => {
      const operation = {
        agent: 'TestAgent',
        action: 'write_field',
        target: testFilePath,
        content: '# Test Node\n\nUpdated content',
        healthBefore: 95.5,
        validateHealth: false
      };

      const result = await swp.executeWrite(operation);

      // CRITICAL: Result must include healthBefore
      expect(result).toHaveProperty('healthBefore');
      expect(result.healthBefore).toBe(95.5);
      expect(typeof result.healthBefore).toBe('number');
    });

    test('should preserve healthBefore with different values', async () => {
      const testCases = [
        { healthBefore: 100, expected: 100 },
        { healthBefore: 0, expected: 0 },
        { healthBefore: 50.25, expected: 50.25 },
        { healthBefore: 99.99, expected: 99.99 }
      ];

      for (const testCase of testCases) {
        const operation = {
          agent: 'TestAgent',
          action: 'write_field',
          target: testFilePath,
          content: `# Test Node\n\nContent for health ${testCase.healthBefore}`,
          healthBefore: testCase.healthBefore,
          validateHealth: false
        };

        const result = await swp.executeWrite(operation);

        expect(result.healthBefore).toBe(testCase.expected);
      }
    });

    test('should allow rollbackIfNeeded to access healthBefore from result', async () => {
      const healthBefore = 95;
      const healthAfter = 90; // Health degraded

      const writeResult = await swp.executeWrite({
        agent: 'TestAgent',
        action: 'write_field',
        target: testFilePath,
        content: '# Test Node\n\nDegrading change',
        healthBefore,
        validateHealth: false
      });

      // Verify healthBefore is in result
      expect(writeResult.healthBefore).toBe(healthBefore);

      // Call rollbackIfNeeded (should detect degradation)
      const rollbackResult = await swp.rollbackIfNeeded(writeResult, healthAfter);

      // Rollback should have been triggered
      expect(rollbackResult.rollbackNeeded).toBe(true);
      expect(rollbackResult.healthBefore).toBe(healthBefore);
      expect(rollbackResult.healthAfter).toBe(healthAfter);
      expect(rollbackResult.delta).toBe(healthAfter - healthBefore);
    });

    test('should not rollback when health improves and healthBefore is accessible', async () => {
      const healthBefore = 90;
      const healthAfter = 95; // Health improved

      const writeResult = await swp.executeWrite({
        agent: 'TestAgent',
        action: 'write_field',
        target: testFilePath,
        content: '# Test Node\n\nImproving change',
        healthBefore,
        validateHealth: false
      });

      expect(writeResult.healthBefore).toBe(healthBefore);

      const rollbackResult = await swp.rollbackIfNeeded(writeResult, healthAfter);

      // No rollback should occur
      expect(rollbackResult.rollbackNeeded).toBe(false);
      expect(rollbackResult.healthBefore).toBe(healthBefore);
      expect(rollbackResult.healthAfter).toBe(healthAfter);
      expect(rollbackResult.delta).toBe(healthAfter - healthBefore);
    });

    test('should handle healthBefore=0 correctly (not falsy check)', async () => {
      // This tests the bugfix: using || 100 would default 0 to 100
      // With the fix, healthBefore=0 should be preserved
      const healthBefore = 0;
      const healthAfter = 50;

      const writeResult = await swp.executeWrite({
        agent: 'TestAgent',
        action: 'write_field',
        target: testFilePath,
        content: '# Test Node\n\nChange from 0',
        healthBefore,
        validateHealth: false
      });

      expect(writeResult.healthBefore).toBe(0);

      const rollbackResult = await swp.rollbackIfNeeded(writeResult, healthAfter);

      // Should NOT rollback (health improved from 0 to 50)
      expect(rollbackResult.rollbackNeeded).toBe(false);
      expect(rollbackResult.healthBefore).toBe(0);
      expect(rollbackResult.delta).toBe(50);
    });
  });

  describe('Integration: executeWrite + rollbackIfNeeded', () => {
    test('should complete full write-rollback cycle with healthBefore', async () => {
      const healthBefore = 95;
      const healthAfterDegraded = 85;

      // Execute write
      const writeResult = await swp.executeWrite({
        agent: 'TestAgent',
        action: 'write_field',
        target: testFilePath,
        content: '# Test Node\n\nBad change',
        healthBefore,
        validateHealth: false
      });

      // Verify write succeeded
      expect(writeResult.success).toBe(true);
      expect(writeResult.healthBefore).toBe(healthBefore);

      // Trigger rollback
      const rollbackResult = await swp.rollbackIfNeeded(writeResult, healthAfterDegraded);

      // Verify rollback occurred
      expect(rollbackResult.rollbackNeeded).toBe(true);
      expect(rollbackResult.rollbackSuccess).toBe(true);

      // Verify file was restored
      const restoredContent = fs.readFileSync(testFilePath, 'utf8');
      expect(restoredContent).toBe('# Test Node\n\nInitial content');
    });
  });

  describe('Signature and Hashing', () => {
    test('should create valid signature', () => {
      const operation = {
        agent: 'TestAgent',
        action: 'write_field',
        target: '/path/to/file.md',
        timestamp: '2025-10-08T00:00:00.000Z'
      };

      const signature = swp.createSignature(operation);

      expect(signature).toHaveProperty('agent', 'TestAgent');
      expect(signature).toHaveProperty('action', 'write_field');
      expect(signature).toHaveProperty('target', '/path/to/file.md');
      expect(signature).toHaveProperty('timestamp', '2025-10-08T00:00:00.000Z');
      expect(signature).toHaveProperty('signature');
      expect(signature).toHaveProperty('algorithm', 'SHA256');
      expect(typeof signature.signature).toBe('string');
      expect(signature.signature.length).toBe(64); // SHA-256 hex length
    });

    test('should verify valid signature', () => {
      const operation = {
        agent: 'TestAgent',
        action: 'write_field',
        target: '/path/to/file.md',
        timestamp: '2025-10-08T00:00:00.000Z'
      };

      const signature = swp.createSignature(operation);
      const isValid = swp.verifySignature(signature);

      expect(isValid).toBe(true);
    });

    test('should compute consistent hash', () => {
      const content = 'Test content';
      const hash1 = swp.computeHash(content);
      const hash2 = swp.computeHash(content);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });
  });
});
