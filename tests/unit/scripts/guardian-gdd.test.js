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

      expect(changes).toBeNull(); // Returns null on error, not empty array
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
        if (cmd.includes('--name-status')) {
          return '';
        } else if (cmd.includes('diff --cached -- "test.js"')) {
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
      // Mock Guardian to have violations
      guardian.violations.safe.push({
        file: 'test.js',
        domains: ['test'],
        severity: 'SAFE',
        added: 5,
        removed: 2,
        diff: 'mock diff'
      });

      guardian.changesSummary.domains_affected = new Set(['test']);

      // Create spy for mkdirSync and existsSync
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});

      // Generate audit log (this should create directory)
      guardian.generateAuditLog();

      // Verify mkdirSync was called with recursive option
      expect(mkdirSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );

      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      appendSpy.mockRestore();
    });

    test('should create cases directory if missing', () => {
      guardian.violations.critical.push({
        file: 'src/services/costControl.js',
        domains: ['pricing'],
        severity: 'CRITICAL',
        added: 10,
        removed: 5,
        diff: 'mock critical diff'
      });

      guardian.changesSummary.domains_affected = new Set(['pricing']);

      // Create spy for mkdirSync and mock file operations
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      const readdirSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

      guardian.generateAuditLog();

      // Verify cases directory was created
      expect(mkdirSpy).toHaveBeenCalledWith(
        expect.stringContaining('cases'),
        expect.objectContaining({ recursive: true })
      );

      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      appendSpy.mockRestore();
      readdirSpy.mockRestore();
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
        if (cmd.includes('--name-status') && cmd.includes('--cached')) {
          return ''; // No staged changes
        } else if (cmd.includes('--name-status')) {
          return 'M\tsrc/services/costControl.js\n'; // Unstaged change
        } else if (cmd.includes('diff --cached -- "src/services/costControl.js"')) {
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

      // Mock file operations for generateAuditLog
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      const readdirSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

      guardian.generateAuditLog();

      // C4 fix: directories created
      expect(mkdirSpy).toHaveBeenCalled();

      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      appendSpy.mockRestore();
      readdirSpy.mockRestore();
    });
  });

  // ============================================================
  // Phase 2: Configuration Loading Tests
  // ============================================================

  describe('Configuration Loading: loadConfig()', () => {
    test('should load valid configuration successfully', () => {
      const mockConfig = {
        domains: {
          pricing: {
            files: ['src/services/costControl.js'],
            protection_level: 'CRITICAL'
          }
        }
      };

      // Mock fs.readFileSync to return valid YAML
      const readSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(
          'domains:\n  pricing:\n    files:\n      - src/services/costControl.js\n    protection_level: CRITICAL'
        )
        .mockReturnValueOnce('ignore_patterns:\n  - "**/*.tmp"');

      const result = guardian.loadConfig();

      expect(result).toBe(true);
      expect(guardian.config).toBeDefined();
      expect(guardian.config.domains).toBeDefined();

      readSpy.mockRestore();
    });

    test('should handle missing config file (ENOENT)', () => {
      const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        const error = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        throw error;
      });

      const result = guardian.loadConfig();

      expect(result).toBe(false);
      expect(guardian.config).toBeNull();

      readSpy.mockRestore();
    });

    test('should handle malformed YAML (parse error)', () => {
      const readSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('domains:\n  invalid: [unclosed');

      const result = guardian.loadConfig();

      expect(result).toBe(false);

      readSpy.mockRestore();
    });

    test('should load ignore patterns when guardian-ignore.yaml exists', () => {
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValueOnce('domains: {}')
        .mockReturnValueOnce('ignore_patterns:\n  - "**/*.tmp"\n  - "C:\\\\Windows\\\\**"');

      guardian.loadConfig();

      expect(guardian.ignorePatterns).toHaveLength(2);
      expect(guardian.ignorePatterns).toContain('**/*.tmp');

      existsSpy.mockRestore();
      readSpy.mockRestore();
    });

    test('should handle missing ignore patterns gracefully', () => {
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValueOnce('domains: {}');

      guardian.loadConfig();

      expect(guardian.ignorePatterns).toHaveLength(0);

      existsSpy.mockRestore();
      readSpy.mockRestore();
    });
  });

  describe('Configuration Loading: shouldIgnoreFile()', () => {
    beforeEach(() => {
      guardian.ignorePatterns = [
        'C:/Windows/**', // Use forward slashes for cross-platform compatibility
        'docs/guardian/cases/**',
        '**/*.tmp',
        '**/.gdd-backups/**'
      ];
    });

    test('should ignore Windows system paths', () => {
      const result = guardian.shouldIgnoreFile('C:/Windows/System32/config.dll');
      expect(result).toBe(true);
    });

    test('should ignore test fixtures', () => {
      const result = guardian.shouldIgnoreFile('docs/guardian/cases/case-001.json');
      expect(result).toBe(true);
    });

    test('should ignore temporary files', () => {
      const result = guardian.shouldIgnoreFile('src/services/billing.tmp');
      expect(result).toBe(true);
    });

    test('should allow normal files (pattern exists but does not match)', () => {
      const result = guardian.shouldIgnoreFile('src/services/costControl.js');
      expect(result).toBe(false);
    });

    test('should match glob patterns with matchBase option', () => {
      const result = guardian.shouldIgnoreFile('nested/path/to/file.tmp');
      expect(result).toBe(true);
    });

    test('should match dotfiles', () => {
      const result = guardian.shouldIgnoreFile('.hidden/.gdd-backups/backup.json');
      expect(result).toBe(true);
    });
  });

  // ============================================================
  // Phase 2: Git Operations Expansion Tests
  // ============================================================

  describe('Git Operations: getGitDiff() extended', () => {
    test('should handle renamed files (status R100, oldPath, newFile)', () => {
      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return 'R100\told/path/file.js\tnew/path/file.js\n';
        }
        return '';
      });

      const changes = guardian.getGitDiff();

      expect(changes).toHaveLength(1);
      expect(changes[0].status).toBe('R100');
      expect(changes[0].file).toBe('new/path/file.js');
      expect(changes[0].oldPath).toBe('old/path/file.js');
      expect(changes[0].renamed).toBe(true);
    });

    test('should filter ignored files (Windows paths, test fixtures)', () => {
      guardian.ignorePatterns = ['C:/Windows/**', 'docs/guardian/cases/**'];

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return 'M\tC:/Windows/System32/file.dll\nM\tsrc/services/costControl.js\nM\tdocs/guardian/cases/case-001.json\n';
        }
        return '';
      });

      const changes = guardian.getGitDiff();

      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe('src/services/costControl.js');
    });

    test('should update changesSummary.total_files correctly', () => {
      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return 'M\tsrc/file1.js\nM\tsrc/file2.js\nM\tsrc/file3.js\n';
        }
        return '';
      });

      guardian.changesSummary.total_files = 0;
      const changes = guardian.getGitDiff();

      expect(guardian.changesSummary.total_files).toBe(3);
      expect(changes).toHaveLength(3);
    });
  });

  describe('Git Operations: getFileDiff() extended', () => {
    test('should fallback from staged to unstaged', () => {
      let callCount = 0;
      mockExecSync = jest.fn((cmd) => {
        callCount++;
        if (cmd.includes('--cached')) {
          // First call: staged diff fails/empty
          throw new Error('No staged changes');
        } else if (cmd.includes('diff -- ')) {
          // Second call: unstaged diff succeeds
          return '+added line\n-removed line\n';
        }
        return '';
      });

      const result = guardian.getFileDiff('test.js');

      expect(callCount).toBeGreaterThan(1); // Both commands attempted
      expect(result.added).toBe(1);
      expect(result.removed).toBe(1);
    });

    test('should update changesSummary counters', () => {
      mockExecSync = jest.fn(() => '+line1\n+line2\n-line3\n');

      guardian.changesSummary.total_lines_added = 0;
      guardian.changesSummary.total_lines_removed = 0;

      guardian.getFileDiff('test.js');

      expect(guardian.changesSummary.total_lines_added).toBe(2);
      expect(guardian.changesSummary.total_lines_removed).toBe(1);
    });
  });

  // ============================================================
  // Phase 2: Classification Logic Tests
  // ============================================================

  describe('Classification: classifyChange()', () => {
    beforeEach(() => {
      guardian.config = {
        domains: {
          pricing: {
            files: ['src/services/costControl.js', 'src/**/billing*.js'],
            keywords: ['price', 'cost', 'billing'],
            protection_level: 'CRITICAL'
          },
          auth: {
            files: ['src/auth/**'],
            keywords: ['password', 'token'],
            protection_level: 'SENSITIVE'
          },
          general: {
            files: ['**/*.js'],
            protection_level: 'SAFE'
          }
        }
      };
      guardian.changesSummary.domains_affected = new Set();
    });

    test('should match exact file path', () => {
      const result = guardian.classifyChange('src/services/costControl.js', {
        diff: 'some changes',
        added: 5,
        removed: 2
      });

      expect(result.severity).toBe('CRITICAL');
      expect(result.domains).toContain('pricing');
    });

    test('should match glob pattern', () => {
      const result = guardian.classifyChange('src/services/billingService.js', {
        diff: 'some changes',
        added: 3,
        removed: 1
      });

      expect(result.severity).toBe('CRITICAL');
      expect(result.domains).toContain('pricing');
    });

    test('should match keyword in diff', () => {
      const result = guardian.classifyChange('src/services/unknown.js', {
        diff: 'const price = 100; // Update pricing logic',
        added: 1,
        removed: 0
      });

      expect(result.severity).toBe('CRITICAL');
      expect(result.domains).toContain('pricing');
    });

    test('should escalate to highest severity (CRITICAL > SENSITIVE)', () => {
      guardian.config.domains.pricing.files.push('src/auth/billing.js');

      const result = guardian.classifyChange('src/auth/billing.js', {
        diff: 'billing and password logic',
        added: 5,
        removed: 2
      });

      expect(result.severity).toBe('CRITICAL');
      expect(result.domains).toContain('pricing');
      expect(result.domains).toContain('auth');
    });

    test('should match multiple domains', () => {
      const result = guardian.classifyChange('src/auth/password.js', {
        diff: 'password hashing with cost factor',
        added: 3,
        removed: 1
      });

      expect(result.domains.length).toBeGreaterThanOrEqual(1);
      expect(result.domains).toContain('auth');
    });

    test('should return SAFE for unmatched files', () => {
      const result = guardian.classifyChange('README.md', {
        diff: 'documentation update',
        added: 10,
        removed: 5
      });

      expect(result.severity).toBe('SAFE');
    });

    test('should perform case-insensitive keyword matching', () => {
      const result = guardian.classifyChange('src/services/unknown.js', {
        diff: 'const PRICE = 100; // Update PRICING',
        added: 1,
        removed: 0
      });

      expect(result.severity).toBe('CRITICAL');
      expect(result.domains).toContain('pricing');
    });

    test('should update changesSummary.domains_affected', () => {
      guardian.classifyChange('src/services/costControl.js', {
        diff: 'changes',
        added: 1,
        removed: 0
      });

      expect(guardian.changesSummary.domains_affected.has('pricing')).toBe(true);
    });

    test('should handle glob pattern with no glob chars (exact match fallback)', () => {
      guardian.config.domains.exact = {
        files: ['src/exact.js'],
        protection_level: 'CRITICAL'
      };

      const result = guardian.classifyChange('src/exact.js', {
        diff: 'exact match',
        added: 1,
        removed: 0
      });

      expect(result.severity).toBe('CRITICAL');
      expect(result.domains).toContain('exact');
    });

    test('should handle null diff (keywords skipped)', () => {
      const result = guardian.classifyChange('src/unknown.js', {
        diff: null,
        added: 0,
        removed: 0
      });

      expect(result.severity).toBe('SAFE');
    });

    test('should handle empty domains object (returns SAFE)', () => {
      guardian.config.domains = {};

      const result = guardian.classifyChange('src/any.js', {
        diff: 'any changes',
        added: 1,
        removed: 0
      });

      expect(result.severity).toBe('SAFE');
      expect(result.domains).toHaveLength(0);
    });
  });

  // ============================================================
  // Phase 2: Deduplication Tests
  // ============================================================

  describe('Deduplication: generateCaseKey()', () => {
    test('should generate deterministic hash for same inputs', () => {
      const key1 = guardian.generateCaseKey(
        ['file1.js', 'file2.js'],
        'CRITICAL',
        'REVIEW_REQUIRED',
        ['pricing', 'auth']
      );

      const key2 = guardian.generateCaseKey(
        ['file1.js', 'file2.js'],
        'CRITICAL',
        'REVIEW_REQUIRED',
        ['pricing', 'auth']
      );

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(16);
    });

    test('should generate different hash for different files', () => {
      const key1 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'REVIEW_REQUIRED', [
        'pricing'
      ]);
      const key2 = guardian.generateCaseKey(['file2.js'], 'CRITICAL', 'REVIEW_REQUIRED', [
        'pricing'
      ]);

      expect(key1).not.toBe(key2);
    });

    test('should generate different hash for different severity', () => {
      const key1 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'REVIEW_REQUIRED', [
        'pricing'
      ]);
      const key2 = guardian.generateCaseKey(['file1.js'], 'SENSITIVE', 'REVIEW_REQUIRED', [
        'pricing'
      ]);

      expect(key1).not.toBe(key2);
    });

    test('should generate different hash for different action', () => {
      const key1 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'REVIEW_REQUIRED', [
        'pricing'
      ]);
      const key2 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'APPROVED', ['pricing']);

      expect(key1).not.toBe(key2);
    });

    test('should generate different hash for different domains', () => {
      const key1 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'REVIEW_REQUIRED', [
        'pricing'
      ]);
      const key2 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'REVIEW_REQUIRED', ['auth']);

      expect(key1).not.toBe(key2);
    });

    test('should sort files before hashing (order-independent)', () => {
      const key1 = guardian.generateCaseKey(
        ['file1.js', 'file2.js'],
        'CRITICAL',
        'REVIEW_REQUIRED',
        ['pricing']
      );
      const key2 = guardian.generateCaseKey(
        ['file2.js', 'file1.js'],
        'CRITICAL',
        'REVIEW_REQUIRED',
        ['pricing']
      );

      expect(key1).toBe(key2);
    });

    test('should sort domains before hashing (order-independent)', () => {
      const key1 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'REVIEW_REQUIRED', [
        'pricing',
        'auth'
      ]);
      const key2 = guardian.generateCaseKey(['file1.js'], 'CRITICAL', 'REVIEW_REQUIRED', [
        'auth',
        'pricing'
      ]);

      expect(key1).toBe(key2);
    });
  });

  describe('Deduplication: caseExists()', () => {
    beforeEach(() => {
      // Clean up test cases directory
      if (fs.existsSync(MOCK_CASES_DIR)) {
        fs.rmSync(MOCK_CASES_DIR, { recursive: true, force: true });
      }
    });

    test('should return true for existing case (with caseId, file)', () => {
      // Use the actual CASES_DIR that Guardian uses
      const ACTUAL_CASES_DIR = path.join(__dirname, '../../../docs/guardian/cases');
      fs.mkdirSync(ACTUAL_CASES_DIR, { recursive: true });

      const caseId = '2025-11-07-15-48-00-937'; // Fixed timestamp for reproducibility
      const caseData = {
        case_id: caseId,
        files_changed: ['file1.js'],
        severity: 'CRITICAL',
        action: 'REVIEW_REQUIRED',
        domains: ['pricing']
      };

      // Calculate the actual key that will be generated from this data
      const testGuardian = new GuardianEngine();
      const expectedKey = testGuardian.generateCaseKey(
        caseData.files_changed,
        caseData.severity,
        caseData.action,
        caseData.domains
      );

      const caseFileName = `${caseId}.json`;
      const caseFilePath = path.join(ACTUAL_CASES_DIR, caseFileName);

      // Write case file
      fs.writeFileSync(caseFilePath, JSON.stringify(caseData, null, 2));

      // Search for the case using the calculated key
      const result = testGuardian.caseExists(expectedKey);

      // Clean up the test file
      fs.unlinkSync(caseFilePath);

      expect(result.exists).toBe(true);
      expect(result.caseId).toBe(caseId);
      expect(result.file).toBe(caseFileName);
    });

    test('should return false for non-existent case', () => {
      fs.mkdirSync(MOCK_CASES_DIR, { recursive: true });

      const result = guardian.caseExists('nonexistent-key');

      expect(result.exists).toBe(false);
    });

    test('should return false when cases directory missing', () => {
      const result = guardian.caseExists('any-key');

      expect(result.exists).toBe(false);
    });

    test('should skip malformed case files (invalid JSON)', () => {
      fs.mkdirSync(MOCK_CASES_DIR, { recursive: true });
      fs.writeFileSync(path.join(MOCK_CASES_DIR, 'malformed.json'), 'invalid json{');

      const result = guardian.caseExists('any-key');

      expect(result.exists).toBe(false);
    });

    test('should handle empty cases directory', () => {
      fs.mkdirSync(MOCK_CASES_DIR, { recursive: true });

      const result = guardian.caseExists('any-key');

      expect(result.exists).toBe(false);
    });
  });

  // ============================================================
  // Phase 2: Audit & Reporting Tests
  // ============================================================

  describe('Audit & Reporting: generateAuditLog() extended', () => {
    test('should append to existing audit log', () => {
      guardian.violations.safe.push({
        file: 'test.js',
        domains: ['test'],
        severity: 'SAFE',
        added: 1,
        removed: 0,
        diff: ''
      });
      guardian.changesSummary.domains_affected = new Set(['test']);

      const existsSpy = jest
        .spyOn(fs, 'existsSync')
        .mockReturnValueOnce(true)
        .mockReturnValue(false);
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const readdirSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

      guardian.generateAuditLog();

      expect(appendSpy).toHaveBeenCalled();

      existsSpy.mockRestore();
      appendSpy.mockRestore();
      writeSpy.mockRestore();
      mkdirSpy.mockRestore();
      readdirSpy.mockRestore();
    });

    test('should skip duplicate case (deduplication)', () => {
      guardian.violations.critical.push({
        file: 'dup.js',
        domains: ['test'],
        severity: 'CRITICAL',
        added: 1,
        removed: 0,
        diff: ''
      });
      guardian.changesSummary.domains_affected = new Set(['test']);

      // Mock caseExists to return true (duplicate)
      jest
        .spyOn(guardian, 'caseExists')
        .mockReturnValue({ exists: true, caseId: 'DUP-001', file: 'dup.json' });

      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});

      guardian.generateAuditLog();

      // Should not write/append if duplicate
      expect(writeSpy).not.toHaveBeenCalled();
      expect(appendSpy).not.toHaveBeenCalled();

      writeSpy.mockRestore();
      appendSpy.mockRestore();
    });

    test('should use GITHUB_ACTOR environment variable for actor', () => {
      process.env.GITHUB_ACTOR = 'github-user';
      guardian.violations.safe.push({
        file: 'test.js',
        domains: [],
        severity: 'SAFE',
        added: 1,
        removed: 0,
        diff: ''
      });
      guardian.changesSummary.domains_affected = new Set();

      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation((_path, content) => {
        expect(content).toContain('github-user');
      });
      const readdirSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

      guardian.generateAuditLog();

      delete process.env.GITHUB_ACTOR;
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      appendSpy.mockRestore();
      readdirSpy.mockRestore();
    });

    test('should handle no violations (early return)', () => {
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      guardian.generateAuditLog();

      expect(mkdirSpy).not.toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });

    test('should call sendNotification for CRITICAL severity', () => {
      guardian.violations.critical.push({
        file: 'critical.js',
        domains: ['pricing'],
        severity: 'CRITICAL',
        added: 1,
        removed: 0,
        diff: ''
      });
      guardian.changesSummary.domains_affected = new Set(['pricing']);

      const sendSpy = jest.spyOn(guardian, 'sendNotification').mockImplementation(() => {});
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      const readdirSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

      guardian.generateAuditLog();

      expect(sendSpy).toHaveBeenCalled();

      sendSpy.mockRestore();
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      appendSpy.mockRestore();
      readdirSpy.mockRestore();
    });

    test('should not call sendNotification for SAFE severity', () => {
      guardian.violations.safe.push({
        file: 'safe.js',
        domains: [],
        severity: 'SAFE',
        added: 1,
        removed: 0,
        diff: ''
      });
      guardian.changesSummary.domains_affected = new Set();

      const sendSpy = jest.spyOn(guardian, 'sendNotification').mockImplementation(() => {});
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      const readdirSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

      guardian.generateAuditLog();

      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      appendSpy.mockRestore();
      readdirSpy.mockRestore();
    });
  });

  describe('Audit & Reporting: generateReport()', () => {
    test('should generate markdown with correct structure', () => {
      guardian.violations.safe.push({ file: 'test.js', domains: ['test'], added: 1, removed: 0 });
      guardian.changesSummary = {
        total_files: 1,
        total_lines_added: 1,
        total_lines_removed: 0,
        domains_affected: new Set(['test'])
      };

      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((_path, content) => {
        expect(content).toContain('# Guardian Scan Report');
        expect(content).toContain('## Summary');
        expect(content).toContain('## Violations');
      });

      guardian.generateReport();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });

    test('should include critical violations section', () => {
      guardian.violations.critical.push({
        file: 'critical.js',
        domains: ['pricing'],
        added: 10,
        removed: 5
      });
      guardian.changesSummary.domains_affected = new Set(['pricing']);

      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((_path, content) => {
        expect(content).toContain('### 🔴 Critical (1)');
        expect(content).toContain('critical.js');
      });

      guardian.generateReport();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });

    test('should include sensitive violations section', () => {
      guardian.violations.sensitive.push({
        file: 'sensitive.js',
        domains: ['auth'],
        added: 3,
        removed: 1
      });
      guardian.changesSummary.domains_affected = new Set(['auth']);

      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((_path, content) => {
        expect(content).toContain('### 🟡 Sensitive (1)');
        expect(content).toContain('sensitive.js');
      });

      guardian.generateReport();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });

    test('should show BLOCK recommendation for critical violations', () => {
      guardian.violations.critical.push({
        file: 'block.js',
        domains: ['pricing'],
        added: 1,
        removed: 0
      });

      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((_path, content) => {
        expect(content).toContain('❌ **BLOCK MERGE**');
        expect(content).toContain('Product Owner approval required');
      });

      guardian.generateReport();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });

    test('should show MANUAL REVIEW recommendation for sensitive violations', () => {
      guardian.violations.sensitive.push({
        file: 'review.js',
        domains: ['auth'],
        added: 1,
        removed: 0
      });

      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((_path, content) => {
        expect(content).toContain('⚠️ **MANUAL REVIEW**');
        expect(content).toContain('Tech Lead approval required');
      });

      guardian.generateReport();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });

    test('should show APPROVE recommendation for safe changes', () => {
      guardian.violations.safe.push({ file: 'safe.js' });

      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((_path, content) => {
        expect(content).toContain('✅ **APPROVE**');
        expect(content).toContain('safe to merge');
      });

      guardian.generateReport();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });
  });

  describe('Audit & Reporting: sendNotification()', () => {
    test('should execute notify-guardian.js with case ID', () => {
      mockExecSync = jest.fn((cmd) => {
        expect(cmd).toContain('notify-guardian.js');
        expect(cmd).toContain('--case-id=TEST-001');
        return '';
      });

      guardian.sendNotification('TEST-001');

      expect(mockExecSync).toHaveBeenCalled();
    });

    test('should handle notification failure gracefully', () => {
      mockExecSync = jest.fn(() => {
        throw new Error('Notification service unavailable');
      });

      // Should not throw, just log error
      expect(() => guardian.sendNotification('TEST-002')).not.toThrow();
    });
  });
});
