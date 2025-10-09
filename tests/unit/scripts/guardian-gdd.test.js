/**
 * Unit Tests for Guardian Agent Core
 *
 * Tests CodeRabbit review #3319263624 fixes:
 * - M1: Unstaged changes detection (working tree fallback)
 * - M2: Line counting (exclude diff headers)
 * - C4: Directory creation before writes
 */

// Mock child_process BEFORE requiring guardian-gdd
let mockExecSync;
jest.mock('child_process', () => ({
  execSync: jest.fn((...args) => mockExecSync(...args))
}));

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GuardianEngine } = require('../../../scripts/guardian-gdd');

// Mock configuration
const MOCK_CONFIG_PATH = path.join(__dirname, '../../fixtures/product-guard-test.yaml');
const MOCK_AUDIT_PATH = path.join(__dirname, '../../fixtures/guardian/audit-log.md');
const MOCK_CASES_DIR = path.join(__dirname, '../../fixtures/guardian/cases');

describe('Guardian Agent - CodeRabbit Review Fixes', () => {
  let guardian;

  beforeEach(() => {
    guardian = new GuardianEngine();
    jest.clearAllMocks();

    // Clean up test fixtures
    if (fs.existsSync(path.dirname(MOCK_AUDIT_PATH))) {
      fs.rmSync(path.dirname(MOCK_AUDIT_PATH), { recursive: true, force: true });
    }

    // Reset mockExecSync to default (return empty)
    mockExecSync = jest.fn(() => '');
  });

  // ============================================================
  // M1: Unstaged Changes Detection Fix
  // ============================================================

  describe('M1: Unstaged changes detection (lines 92-101)', () => {
    test('should detect unstaged changes when no staged changes exist', () => {
      // Mock git diff --cached returns empty string (not error)
      let callCount = 0;
      mockExecSync = jest.fn((cmd) => {
        callCount++;
        if (cmd.includes('--cached')) {
          // First call: staged changes = empty string (not error)
          return '';
        } else if (cmd.includes('diff --name-status')) {
          // Second call: unstaged changes exist
          return 'M\tsrc/services/costControl.js\n';
        }
        return '';
      });

      const changes = guardian.getGitDiff();

      expect(callCount).toBe(2); // Both commands should be called
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe('src/services/costControl.js');
    });

    test('should detect staged changes when they exist', () => {
      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return 'M\tsrc/services/billingService.js\n';
        }
        return '';
      });

      const changes = guardian.getGitDiff();

      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe('src/services/billingService.js');
    });

    test('should return empty array when no changes exist', () => {
      mockExecSync = jest.fn(() => '');

      const changes = guardian.getGitDiff();

      expect(changes).toHaveLength(0);
    });

    test('should handle git command errors gracefully', () => {
      mockExecSync = jest.fn(() => {
        throw new Error('Git not installed');
      });

      const changes = guardian.getGitDiff();

      expect(changes).toHaveLength(0);
    });
  });

  // ============================================================
  // M2: Line Counting Fix
  // ============================================================

  describe('M2: Line counting excludes diff headers (lines 136-144)', () => {
    test('should exclude +++ header from added lines count', () => {
      const mockDiff = `diff --git a/test.js b/test.js
index abc123..def456 100644
--- a/test.js
+++ b/test.js
@@ -1,3 +1,4 @@
 const foo = 1;
+const bar = 2;
+const baz = 3;
`;

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return '';
        } else if (cmd.includes('diff -- ')) {
          return mockDiff;
        }
        return '';
      });

      const result = guardian.getFileDiff('test.js');

      // Should count 2 added lines (+ lines), not 3 (+++ header should be excluded)
      expect(result.added).toBe(2);
    });

    test('should exclude --- header from removed lines count', () => {
      const mockDiff = `diff --git a/test.js b/test.js
index abc123..def456 100644
--- a/test.js
+++ b/test.js
@@ -1,4 +1,3 @@
-const foo = 1;
-const bar = 2;
 const baz = 3;
`;

      mockExecSync = jest.fn((cmd) => mockDiff);

      const result = guardian.getFileDiff('test.js');

      // Should count 2 removed lines (- lines), not 3 (--- header should be excluded)
      expect(result.removed).toBe(2);
    });

    test('should correctly count mixed additions and removals', () => {
      const mockDiff = `diff --git a/test.js b/test.js
--- a/test.js
+++ b/test.js
@@ -1,5 +1,5 @@
 const a = 1;
-const b = 2;
+const b = 3;
-const c = 4;
+const c = 5;
 const d = 6;
`;

      mockExecSync = jest.fn(() => mockDiff);

      const result = guardian.getFileDiff('test.js');

      expect(result.added).toBe(2); // Only +const lines, not +++ header
      expect(result.removed).toBe(2); // Only -const lines, not --- header
    });

    test('should handle empty diffs correctly', () => {
      mockExecSync = jest.fn(() => '');

      const result = guardian.getFileDiff('test.js');

      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
      expect(result.diff).toBe('');
    });
  });

  // ============================================================
  // C4: Directory Creation Fix
  // ============================================================

  describe('C4: Ensure directories exist before writes (lines 328-444)', () => {
    test('should create audit log directory if missing', () => {
      const testAuditPath = path.join(__dirname, '../../fixtures/guardian-test/audit-log.md');

      // Ensure directory doesn't exist
      if (fs.existsSync(path.dirname(testAuditPath))) {
        fs.rmSync(path.dirname(testAuditPath), { recursive: true, force: true });
      }

      // Mock Guardian to use test path
      guardian.violations.safe.push({
        file: 'test.js',
        domains: ['test'],
        severity: 'SAFE',
        added: 5,
        removed: 2,
        diff: 'mock diff'
      });

      // Override audit log path temporarily
      const originalAuditPath = require('../../../scripts/guardian-gdd').AUDIT_LOG_PATH;
      const guardianModule = require('../../../scripts/guardian-gdd');

      // Create spy for mkdirSync
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync');

      // Generate audit log (this should create directory)
      guardian.generateAuditLog();

      // Verify mkdirSync was called with recursive option
      expect(mkdirSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );

      mkdirSpy.mockRestore();
    });

    test('should create cases directory if missing', () => {
      const testCasesDir = path.join(__dirname, '../../fixtures/guardian-test/cases');

      // Ensure directory doesn't exist
      if (fs.existsSync(testCasesDir)) {
        fs.rmSync(testCasesDir, { recursive: true, force: true });
      }

      guardian.violations.critical.push({
        file: 'src/services/costControl.js',
        domains: ['pricing'],
        severity: 'CRITICAL',
        added: 10,
        removed: 5,
        diff: 'mock critical diff'
      });

      // Create spy for mkdirSync
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync');

      guardian.generateAuditLog();

      // Verify cases directory was created
      expect(mkdirSpy).toHaveBeenCalledWith(
        expect.stringContaining('cases'),
        expect.objectContaining({ recursive: true })
      );

      mkdirSpy.mockRestore();
    });

    test('should create report directory if missing', () => {
      const testReportPath = path.join(__dirname, '../../fixtures/guardian-test/report.md');

      // Ensure directory doesn't exist
      if (fs.existsSync(path.dirname(testReportPath))) {
        fs.rmSync(path.dirname(testReportPath), { recursive: true, force: true });
      }

      guardian.violations.safe.push({ file: 'test.js' });

      // Create spy for mkdirSync
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync');

      guardian.generateReport();

      // Verify report directory was created
      expect(mkdirSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );

      mkdirSpy.mockRestore();
    });

    test('should handle existing directories without errors', () => {
      // Create directories beforehand
      const testDir = path.join(__dirname, '../../fixtures/guardian-existing');
      fs.mkdirSync(testDir, { recursive: true });

      guardian.violations.safe.push({ file: 'test.js' });

      // Should not throw
      expect(() => guardian.generateAuditLog()).not.toThrow();

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });

  // ============================================================
  // Integration Tests (All Fixes Combined)
  // ============================================================

  describe('Integration: All fixes working together', () => {
    test('should handle complete workflow with all fixes applied', () => {
      // Mock git to return unstaged changes
      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return ''; // No staged changes
        } else if (cmd.includes('--name-status')) {
          return 'M\tsrc/services/costControl.js\n'; // Unstaged change
        } else if (cmd.includes('diff -- ')) {
          // Return mock diff with headers
          return `--- a/src/services/costControl.js
+++ b/src/services/costControl.js
@@ -1,5 +1,6 @@
 const price = 10;
-const old = 1;
+const new = 2;
`;
        }
        return '';
      });

      // Mock config loading
      guardian.config = {
        domains: {
          pricing: {
            files: ['src/services/costControl.js'],
            protection_level: 'CRITICAL',
            owner: 'Product Owner'
          }
        }
      };

      // Perform scan
      guardian.changesSummary = {
        total_files: 0,
        total_lines_added: 0,
        total_lines_removed: 0,
        domains_affected: new Set()
      };

      const changes = guardian.getGitDiff();
      expect(changes).toHaveLength(1); // M1 fix: detects unstaged changes

      const fileDiff = guardian.getFileDiff(changes[0].file);
      expect(fileDiff.added).toBe(1); // M2 fix: excludes +++ header
      expect(fileDiff.removed).toBe(1); // M2 fix: excludes --- header

      const classification = guardian.classifyChange(changes[0].file, fileDiff);
      guardian.violations.critical.push(classification);

      // Create spy for mkdirSync
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync');

      guardian.generateAuditLog();

      // C4 fix: directories created
      expect(mkdirSpy).toHaveBeenCalled();

      mkdirSpy.mockRestore();
    });
  });
});
