/**
 * Test for CodeRabbit Review #3318867960 - Issue #2
 *
 * Verifies that GDDCrossValidator only adds true coverage mismatches to violations array,
 * not warnings like coverage_data_unavailable, no_source_files_found, or coverage_calculation_failed.
 *
 * Related: scripts/gdd-cross-validator.js:104-109
 */

const { GDDCrossValidator } = require('../../../scripts/gdd-cross-validator');
const fs = require('fs').promises;
const path = require('path');

describe('GDDCrossValidator - Violation Classification (Issue #2)', () => {
  let validator;
  const mockRootDir = path.resolve(__dirname, '../../..');

  beforeEach(() => {
    validator = new GDDCrossValidator(mockRootDir);
    validator.violations = {
      coverage: [],
      timestamp: [],
      dependency: []
    };
  });

  describe('validateCoverage() violation classification', () => {
    test('should add violation for true coverage_mismatch', async () => {
      // Setup: Mock coverage data with actual mismatch
      validator.coverageData = {
        'src/services/testService.js': {
          statements: { total: 100, covered: 50 }
        }
      };

      // Mock getNodeSourceFiles to return test file
      validator.getNodeSourceFiles = jest.fn().mockResolvedValue(['src/services/testService.js']);

      const result = await validator.validateCoverage('test-node', 70, 3);

      // Assertions
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('coverage_mismatch');
      expect(result.declared).toBe(70);
      expect(result.actual).toBe(50);
      expect(result.diff).toBe(20);

      // KEY ASSERTION: violation should be recorded
      expect(validator.violations.coverage).toHaveLength(1);
      expect(validator.violations.coverage[0].node).toBe('test-node');
      expect(validator.violations.coverage[0].reason).toBe('coverage_mismatch');
    });

    test('should NOT add violation for coverage_data_unavailable', async () => {
      // Setup: No coverage data available
      // Mock loadCoverageData to return null (simulating no coverage file)
      validator.loadCoverageData = jest.fn().mockResolvedValue(null);
      validator.coverageData = null;

      const result = await validator.validateCoverage('test-node', 70, 3);

      // Assertions
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('coverage_data_unavailable');

      // KEY ASSERTION: NO violation should be recorded (this is a warning, not a violation)
      expect(validator.violations.coverage).toHaveLength(0);
    });

    test('should NOT add violation for no_source_files_found', async () => {
      // Setup: Coverage data exists but no source files for node
      validator.coverageData = { 'some/file.js': { statements: { total: 10, covered: 5 } } };
      validator.getNodeSourceFiles = jest.fn().mockResolvedValue([]);

      const result = await validator.validateCoverage('test-node', 70, 3);

      // Assertions
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('no_source_files_found');

      // KEY ASSERTION: NO violation should be recorded
      expect(validator.violations.coverage).toHaveLength(0);
    });

    test('should NOT add violation for coverage_calculation_failed', async () => {
      // Setup: Source files exist but coverage calculation returns null
      validator.coverageData = { 'src/services/testService.js': { /* invalid structure */ } };
      validator.getNodeSourceFiles = jest.fn().mockResolvedValue(['src/services/testService.js']);

      const result = await validator.validateCoverage('test-node', 70, 3);

      // Assertions
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('coverage_calculation_failed');

      // KEY ASSERTION: NO violation should be recorded
      expect(validator.violations.coverage).toHaveLength(0);
    });

    test('should handle multiple warnings without adding violations', async () => {
      // Mock loadCoverageData to return null
      validator.loadCoverageData = jest.fn().mockResolvedValue(null);
      validator.coverageData = null;

      // Validate multiple nodes with warnings
      await validator.validateCoverage('node-1', 70, 3);
      await validator.validateCoverage('node-2', 80, 3);
      await validator.validateCoverage('node-3', 90, 3);

      // All should be warnings (coverage_data_unavailable)
      expect(validator.violations.coverage).toHaveLength(0);
    });

    test('should only record true mismatches in violations array', async () => {
      // Setup: Mix of mismatches and warnings
      validator.coverageData = {
        'src/services/service1.js': { statements: { total: 100, covered: 50 } },
        'src/services/service2.js': { statements: { total: 100, covered: 80 } }
      };

      validator.getNodeSourceFiles = jest.fn()
        .mockResolvedValueOnce(['src/services/service1.js'])  // node-1: mismatch
        .mockResolvedValueOnce([])                             // node-2: no files (warning)
        .mockResolvedValueOnce(['src/services/service2.js']); // node-3: mismatch

      await validator.validateCoverage('node-1', 70, 3);  // Mismatch: 70 declared, 50 actual
      await validator.validateCoverage('node-2', 70, 3);  // Warning: no_source_files_found
      await validator.validateCoverage('node-3', 90, 3);  // Mismatch: 90 declared, 80 actual

      // Should only record 2 violations (node-1 and node-3), not node-2
      expect(validator.violations.coverage).toHaveLength(2);
      expect(validator.violations.coverage[0].node).toBe('node-1');
      expect(validator.violations.coverage[0].reason).toBe('coverage_mismatch');
      expect(validator.violations.coverage[1].node).toBe('node-3');
      expect(validator.violations.coverage[1].reason).toBe('coverage_mismatch');
    });

    test('should maintain backward compatibility with existing callers', async () => {
      // Ensure result structure is unchanged
      // Mock loadCoverageData to return null
      validator.loadCoverageData = jest.fn().mockResolvedValue(null);
      validator.coverageData = null;

      const result = await validator.validateCoverage('test-node', 70, 3);

      // Verify result has expected structure
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('declared');
      expect(result).toHaveProperty('actual');
      expect(result).toHaveProperty('diff');

      // No violations recorded for warnings
      expect(validator.violations.coverage).toHaveLength(0);
    });
  });
});
