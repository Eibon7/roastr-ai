/**
 * Path Traversal Security Tests (CWE-22)
 *
 * Tests protection against directory traversal attacks in SecureWrite Protocol.
 * Validates the path normalization fix (using path.resolve + path.relative)
 * blocks all attack vectors while allowing legitimate paths.
 *
 * Security Fix: Lines 79-87 (write) and 165-174 (rollback)
 *
 * @see https://cwe.mitre.org/data/definitions/22.html
 */

const SecureWrite = require('../../../scripts/agents/secure-write');
const path = require('path');
const fs = require('fs');

describe('Path Traversal Security Tests (CWE-22)', () => {
  let swp;
  let repoRoot;

  beforeEach(() => {
    swp = new SecureWrite({ verbose: false });
    repoRoot = path.resolve(__dirname, '../../..');
  });

  afterEach(() => {
    // Cleanup test files
    const testFiles = [
      path.join(repoRoot, 'test-security.txt'),
      path.join(repoRoot, '.gdd-test-security.txt')
    ];

    testFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('Unix Absolute Path Traversal Attacks (MUST BLOCK)', () => {
    test('Block absolute path with .. to /etc/passwd', async () => {
      await expect(
        swp.write({
          path: `${repoRoot}/../etc/passwd`,
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('Block absolute path with multiple .. segments', async () => {
      await expect(
        swp.write({
          path: `${repoRoot}/../../../etc/shadow`,
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('Block absolute path to /tmp', async () => {
      await expect(
        swp.write({
          path: '/tmp/malicious.log',
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Windows Absolute Path Traversal Attacks (MUST BLOCK)', () => {
    test('Block Windows absolute path with .. to system.ini', async () => {
      await expect(
        swp.write({
          path: 'C:\\repo\\..\\Windows\\system.ini',
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('Block Windows absolute path to different drive', async () => {
      await expect(
        swp.write({
          path: 'C:\\Windows\\System32\\config\\sam',
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Relative Path Traversal Attacks (MUST BLOCK)', () => {
    test('Block relative traversal to /etc/passwd', async () => {
      await expect(
        swp.write({
          path: '../../../etc/passwd',
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('Block relative traversal from docs directory', async () => {
      await expect(
        swp.write({
          path: 'docs/../../etc/passwd',
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Mixed Format Attacks (MUST BLOCK)', () => {
    test('Block mixed absolute + relative traversal', async () => {
      await expect(
        swp.write({
          path: `${repoRoot}/docs/../../../etc/passwd`,
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Rollback Path Traversal Attacks (MUST BLOCK)', () => {
    test('Block rollback with absolute path traversal', async () => {
      await expect(
        swp.rollback({
          path: `${repoRoot}/../etc/sensitive_backup`,
          content: 'malicious',
          reason: 'exploit',
          agent: 'Attacker'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('Block rollback with relative path traversal', async () => {
      await expect(
        swp.rollback({
          path: '../../../tmp/backup_exploit',
          content: 'malicious',
          reason: 'exploit',
          agent: 'Attacker'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });

  describe('Legitimate Paths Within Repository (MUST ALLOW)', () => {
    test('Allow relative path within repo root', async () => {
      const result = await swp.write({
        path: 'test-security.txt',
        content: 'legitimate',
        agent: 'TestAgent',
        action: 'test'
      });
      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, 'test-security.txt'))).toBe(true);
    });

    test('Allow absolute path within repo', async () => {
      const result = await swp.write({
        path: path.join(repoRoot, 'test-security.txt'),
        content: 'legitimate',
        agent: 'TestAgent',
        action: 'test'
      });
      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, 'test-security.txt'))).toBe(true);
    });

    test('Allow hidden file in repo root', async () => {
      const result = await swp.write({
        path: '.gdd-test-security.txt',
        content: 'legitimate',
        agent: 'TestAgent',
        action: 'test'
      });
      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, '.gdd-test-security.txt'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('Block path with only .. segments', async () => {
      await expect(
        swp.write({
          path: '../../../..',
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });

    test('Block path starting with ../', async () => {
      await expect(
        swp.write({
          path: '../malicious.txt',
          content: 'malicious',
          agent: 'Attacker',
          action: 'exploit'
        })
      ).rejects.toThrow(/Security violation.*outside repository root/);
    });
  });
});
