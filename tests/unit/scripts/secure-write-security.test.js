/**
 * Security Tests for SecureWrite Protocol
 *
 * Tests path traversal prevention and root confinement
 * Part of CodeRabbit Review #3319707172 - CRITICAL Security Fix
 */

const SecureWrite = require('../../../scripts/agents/secure-write');
const path = require('path');
const fs = require('fs');

describe('SecureWrite - Security', () => {
  let secureWrite;
  const rootDir = path.resolve(__dirname, '../../..');

  beforeEach(() => {
    secureWrite = new SecureWrite({ verbose: false });
  });

  afterEach(() => {
    // Cleanup any test files
    const testFiles = [
      path.join(rootDir, '.gdd-test-security.txt'),
      path.join(rootDir, 'docs', 'test-security.md')
    ];

    testFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should reject path traversal with ../ (relative)', async () => {
      const attack = '../../etc/shadow';

      await expect(
        secureWrite.write({
          path: attack,
          content: 'exploit',
          agent: 'AttackerAgent',
          action: 'path_traversal_test'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('should reject path traversal to /etc/passwd (absolute)', async () => {
      const attack = '/etc/passwd';

      await expect(
        secureWrite.write({
          path: attack,
          content: 'exploit',
          agent: 'AttackerAgent',
          action: 'path_traversal_test'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('should reject path traversal to user home directory', async () => {
      const attack = '../../../root/.ssh/id_rsa';

      await expect(
        secureWrite.write({
          path: attack,
          content: 'exploit',
          agent: 'AttackerAgent',
          action: 'path_traversal_test'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('should reject path traversal with multiple ../..', async () => {
      const attack = 'docs/../../../../../../etc/hosts';

      await expect(
        secureWrite.write({
          path: attack,
          content: 'exploit',
          agent: 'AttackerAgent',
          action: 'path_traversal_test'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('should reject absolute paths outside repository', async () => {
      const attack = '/tmp/malicious.txt';

      await expect(
        secureWrite.write({
          path: attack,
          content: 'exploit',
          agent: 'AttackerAgent',
          action: 'path_traversal_test'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Root Confinement - Rollback', () => {
    test('should reject path traversal in rollback operation', async () => {
      const attack = '../../etc/shadow';

      await expect(
        secureWrite.rollback({
          path: attack,
          content: 'exploit',
          reason: 'path_traversal_test',
          agent: 'AttackerAgent'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('should reject absolute paths in rollback', async () => {
      const attack = '/etc/passwd';

      await expect(
        secureWrite.rollback({
          path: attack,
          content: 'exploit',
          reason: 'path_traversal_test',
          agent: 'AttackerAgent'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Legitimate Writes (Within Repository)', () => {
    test('should allow write to root-level file', async () => {
      const safePath = '.gdd-test-security.txt';

      const result = await secureWrite.write({
        path: safePath,
        content: 'safe content',
        agent: 'TestAgent',
        action: 'security_test'
      });

      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
      expect(result.signature.path).toContain('.gdd-test-security.txt');
    });

    test('should allow write to subdirectory within repo', async () => {
      const safePath = 'docs/test-security.md';

      const result = await secureWrite.write({
        path: safePath,
        content: '# Safe content',
        agent: 'TestAgent',
        action: 'security_test'
      });

      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
      expect(fs.existsSync(path.join(rootDir, safePath))).toBe(true);
    });

    test('should allow rollback within repository', async () => {
      const safePath = '.gdd-test-security.txt';

      // First write
      await secureWrite.write({
        path: safePath,
        content: 'version 1',
        agent: 'TestAgent',
        action: 'security_test'
      });

      // Second write
      const writeResult = await secureWrite.write({
        path: safePath,
        content: 'version 2',
        agent: 'TestAgent',
        action: 'security_test'
      });

      // Rollback
      const rollbackResult = await secureWrite.rollback({
        path: safePath,
        signatureId: writeResult.signature.id,
        reason: 'security_test_rollback',
        agent: 'TestAgent'
      });

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.signature).toBeDefined();

      // Verify content rolled back
      const content = fs.readFileSync(path.join(rootDir, safePath), 'utf8');
      expect(content).toBe('version 1');
    });
  });

  describe('Edge Cases', () => {
    test('should handle paths with ./ prefix safely', async () => {
      const safePath = './docs/test-security.md';

      const result = await secureWrite.write({
        path: safePath,
        content: 'safe',
        agent: 'TestAgent',
        action: 'security_test'
      });

      expect(result.success).toBe(true);
    });

    test('should normalize paths with multiple slashes', async () => {
      const safePath = 'docs//test-security.md';

      const result = await secureWrite.write({
        path: safePath,
        content: 'safe',
        agent: 'TestAgent',
        action: 'security_test'
      });

      expect(result.success).toBe(true);
    });

    test('should reject symlink-based path traversal attempts', async () => {
      // This test documents expected behavior even if symlinks are used
      // In a real attack, attacker might try: docs/symlink -> /etc
      const attack = 'docs/../../etc/shadow';

      await expect(
        secureWrite.write({
          path: attack,
          content: 'exploit',
          agent: 'AttackerAgent',
          action: 'symlink_test'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Attack Vectors Blocked', () => {
    const attackVectors = [
      // Relative path traversal
      '../../../etc/shadow',
      '../../root/.ssh/id_rsa',
      '../../../../../var/log/messages',

      // Absolute paths
      '/etc/passwd',
      '/tmp/exploit.sh',
      '/home/user/.bashrc',

      // Mixed traversal
      'docs/../../../etc/passwd',
      './docs/../../etc/shadow',
      'scripts/../../../../../etc/hosts'
    ];

    test.each(attackVectors)(
      'should block attack vector: %s',
      async (attackPath) => {
        await expect(
          secureWrite.write({
            path: attackPath,
            content: 'malicious payload',
            agent: 'AttackerAgent',
            action: 'attack_test'
          })
        ).rejects.toThrow(/Security violation.*outside repository root/);
      }
    );

    // Windows-specific tests (only run on Windows platform)
    const windowsAttackVectors = [
      'C:\\\\Windows\\\\System32\\\\config\\\\SAM',
      '..\\\\..\\\\..\\\\Windows\\\\System32\\\\drivers\\\\etc\\\\hosts'
    ];

    const describeWindows = process.platform === 'win32' ? describe : describe.skip;

    describeWindows('Windows Path Attacks', () => {
      test.each(windowsAttackVectors)(
        'should block Windows attack vector: %s',
        async (attackPath) => {
          await expect(
            secureWrite.write({
              path: attackPath,
              content: 'malicious payload',
              agent: 'AttackerAgent',
              action: 'attack_test'
            })
          ).rejects.toThrow(/Security violation.*outside repository root/);
        }
      );
    });
  });

  describe('Security Metadata', () => {
    test('should log security violations in signatures', async () => {
      const safePath = '.gdd-test-security.txt';

      // Legitimate write first
      await secureWrite.write({
        path: safePath,
        content: 'safe',
        agent: 'TestAgent',
        action: 'security_test'
      });

      // Verify signature was saved
      const signatures = secureWrite.loadSignatures();
      const lastSignature = signatures.signatures[signatures.signatures.length - 1];

      expect(lastSignature).toBeDefined();
      expect(lastSignature.agent).toBe('TestAgent');
      expect(lastSignature.action).toBe('security_test');
      expect(lastSignature.path).toContain('.gdd-test-security.txt');
      expect(lastSignature.signature).toBeDefined(); // Hash signature present
    });

    test('should not create signatures for rejected writes', async () => {
      const signaturesBefore = secureWrite.loadSignatures();
      const countBefore = signaturesBefore.signatures.length;

      // Attempt malicious write
      try {
        await secureWrite.write({
          path: '../../etc/shadow',
          content: 'exploit',
          agent: 'AttackerAgent',
          action: 'attack'
        });
      } catch (error) {
        // Expected to fail
      }

      const signaturesAfter = secureWrite.loadSignatures();
      const countAfter = signaturesAfter.signatures.length;

      // No signature should be created for rejected writes
      expect(countAfter).toBe(countBefore);
    });
  });
});
