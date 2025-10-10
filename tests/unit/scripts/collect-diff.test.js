/**
 * Unit Tests for Diff Collector
 *
 * Tests CodeRabbit review #3319263624 fixes:
 * - C2: Base commit flag implementation (commit range support)
 * - C3: Per-file diffs use commit range
 */

// Mock child_process BEFORE requiring collect-diff
let mockExecSync;
jest.mock('child_process', () => ({
  execSync: jest.fn((...args) => mockExecSync(...args))
}));

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { DiffCollector } = require('../../../scripts/collect-diff');

describe('Diff Collector - CodeRabbit Review Fixes', () => {
  let collector;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockExecSync to default (return empty)
    mockExecSync = jest.fn(() => '');
  });

  // ============================================================
  // C2: Base Commit Flag Implementation
  // ============================================================

  describe('C2: Base commit flag properly used (lines 115-150)', () => {
    test('should use commit range when base commit is specified', () => {
      collector = new DiffCollector('main');

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('git diff main --name-status')) {
          return 'M\tsrc/services/costControl.js\n';
        }
        return '';
      });

      const changes = collector.getChangedFiles();

      // Verify git diff main was called (not --cached or working tree)
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git diff main --name-status'),
        expect.any(Object)
      );
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe('src/services/costControl.js');
    });

    test('should use working tree when base commit is HEAD', () => {
      collector = new DiffCollector('HEAD');

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return 'M\tsrc/services/billingService.js\n';
        }
        return '';
      });

      const changes = collector.getChangedFiles();

      // Verify working tree commands were used (--cached)
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--cached'),
        expect.any(Object)
      );
      expect(changes).toHaveLength(1);
    });

    test('should fallback to unstaged when no staged changes and base is HEAD', () => {
      collector = new DiffCollector('HEAD');

      let callCount = 0;
      mockExecSync = jest.fn((cmd) => {
        callCount++;
        if (cmd.includes('--cached')) {
          return ''; // No staged changes
        } else if (cmd.includes('diff --name-status')) {
          return 'M\tsrc/services/roastGenerator.js\n'; // Unstaged change
        }
        return '';
      });

      const changes = collector.getChangedFiles();

      expect(callCount).toBe(2); // Both --cached and unstaged should be called
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe('src/services/roastGenerator.js');
    });

    test('should handle commit hash as base', () => {
      collector = new DiffCollector('a1b2c3d4');

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('git diff a1b2c3d4 --name-status')) {
          return 'A\tsrc/services/newService.js\n';
        } else if (cmd.includes('rev-parse')) {
          return 'a1b2c3d4\n';
        }
        return '';
      });

      const changes = collector.getChangedFiles();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git diff a1b2c3d4'),
        expect.any(Object)
      );
      expect(changes).toHaveLength(1);
      expect(changes[0].status).toBe('A');
    });

    test('should handle branch name as base', () => {
      collector = new DiffCollector('develop');

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('git diff develop --name-status')) {
          return 'M\tREADME.md\nD\told-file.js\n';
        } else if (cmd.includes('rev-parse')) {
          return 'abc123\n';
        }
        return '';
      });

      const changes = collector.getChangedFiles();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git diff develop'),
        expect.any(Object)
      );
      expect(changes).toHaveLength(2);
    });
  });

  // ============================================================
  // C3: Per-File Diffs Use Commit Range
  // ============================================================

  describe('C3: Per-file diffs use commit range (lines 152-176)', () => {
    test('should use commit range for file diff when base specified', () => {
      collector = new DiffCollector('main');

      const mockDiff = `--- a/test.js
+++ b/test.js
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
`;

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('git diff main -- ')) {
          return mockDiff;
        }
        return '';
      });

      const result = collector.getFileDiff('test.js');

      // Verify git diff main -- <file> was called
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git diff main -- "test.js"'),
        expect.any(Object)
      );
      expect(result.diff).toBe(mockDiff);
      expect(result.added).toBe(1); // Also tests M2 fix (exclude +++ header)
    });

    test('should use working tree for file diff when base is HEAD', () => {
      collector = new DiffCollector('HEAD');

      const mockDiff = `--- a/test.js
+++ b/test.js
@@ -1,5 +1,3 @@
-const old = 1;
-const legacy = 2;
 const current = 3;
`;

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--cached')) {
          return mockDiff;
        }
        return '';
      });

      const result = collector.getFileDiff('test.js');

      // Verify working tree commands were used
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--cached'),
        expect.any(Object)
      );
      expect(result.removed).toBe(2); // Also tests M2 fix (exclude --- header)
    });

    test('should fallback to unstaged for file diff when no staged changes', () => {
      collector = new DiffCollector('HEAD');

      const mockDiff = `+++ b/test.js
@@ -0,0 +1,2 @@
+const new1 = 1;
+const new2 = 2;
`;

      let callCount = 0;
      mockExecSync = jest.fn((cmd) => {
        callCount++;
        if (cmd.includes('--cached')) {
          return ''; // No staged changes
        } else if (cmd.includes('diff -- ')) {
          return mockDiff; // Unstaged changes
        }
        return '';
      });

      const result = collector.getFileDiff('test.js');

      expect(callCount).toBe(2); // Both --cached and unstaged should be called
      expect(result.added).toBe(2);
    });

    test('should correctly parse diffs with commit range', () => {
      collector = new DiffCollector('develop');

      const mockDiff = `diff --git a/complex.js b/complex.js
index 1234567..89abcdef 100644
--- a/complex.js
+++ b/complex.js
@@ -10,8 +10,10 @@ function foo() {
   const x = 1;
-  const old1 = 2;
-  const old2 = 3;
+  const new1 = 2;
+  const new2 = 3;
+  const new3 = 4;
+  const new4 = 5;
   return x;
 }
`;

      mockExecSync = jest.fn(() => mockDiff);

      const result = collector.getFileDiff('complex.js');

      expect(result.added).toBe(4); // 4 + lines (excluding +++ header)
      expect(result.removed).toBe(2); // 2 - lines (excluding --- header)
      expect(result.hash).toBeDefined();
    });
  });

  // ============================================================
  // Integration Tests (All Fixes Combined)
  // ============================================================

  describe('Integration: Commit range and line counting together', () => {
    test('should collect diffs correctly with commit range', () => {
      collector = new DiffCollector('main');

      // Mock config
      collector.config = {
        domains: {
          pricing: {
            files: ['src/services/costControl.js'],
            protection_level: 'CRITICAL',
            keywords: ['price', 'billing']
          }
        }
      };

      const mockFileDiff = `--- a/src/services/costControl.js
+++ b/src/services/costControl.js
@@ -1,5 +1,6 @@
 const price = 10;
-const oldPrice = 5;
+const newPrice = 15;
+const billing = true;
`;

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('git diff main --name-status')) {
          return 'M\tsrc/services/costControl.js\n';
        } else if (cmd.includes('git diff main -- ')) {
          return mockFileDiff;
        } else if (cmd.includes('rev-parse')) {
          return 'abc123\n';
        }
        return '';
      });

      const success = collector.collect();

      expect(success).toBe(true);
      expect(collector.diffData.files_changed).toHaveLength(1);

      const fileEntry = collector.diffData.files_changed[0];
      expect(fileEntry.lines_added).toBe(2); // Correct count (no +++ header)
      expect(fileEntry.lines_removed).toBe(1); // Correct count (no --- header)
      expect(fileEntry.protection_level).toBe('CRITICAL');
    });

    test('should handle empty diffs with commit range', () => {
      collector = new DiffCollector('feature-branch');

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('rev-parse')) {
          return 'abc123\n';
        }
        return '';
      });

      collector.config = { domains: {} };

      const success = collector.collect();

      expect(success).toBe(true);
      expect(collector.diffData.files_changed).toHaveLength(0);
    });

    test('should correctly classify multiple files with commit range', () => {
      collector = new DiffCollector('develop');

      collector.config = {
        domains: {
          pricing: {
            files: ['src/services/costControl.js'],
            protection_level: 'CRITICAL'
          },
          authentication: {
            files: ['src/services/authService.js'],
            protection_level: 'SENSITIVE'
          }
        }
      };

      mockExecSync = jest.fn((cmd) => {
        if (cmd.includes('--name-status')) {
          return 'M\tsrc/services/costControl.js\nM\tsrc/services/authService.js\n';
        } else if (cmd.includes('costControl.js')) {
          return '+const price = 10;\n';
        } else if (cmd.includes('authService.js')) {
          return '+const token = "abc";\n';
        } else if (cmd.includes('rev-parse')) {
          return 'def456\n';
        }
        return '';
      });

      const success = collector.collect();

      expect(success).toBe(true);
      expect(collector.diffData.files_changed).toHaveLength(2);
      expect(collector.diffData.severity).toBe('CRITICAL'); // Highest severity
      expect(collector.diffData.domains_affected).toContain('pricing');
      expect(collector.diffData.domains_affected).toContain('authentication');
    });
  });
});
