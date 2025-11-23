/**
 * Test for CodeRabbit Review #3318867960 - Issue #3
 *
 * Verifies that ValidateGDDCross correctly handles violation vs warning classification:
 * - Warnings (coverage_data_unavailable, no_source_files_found, coverage_calculation_failed)
 *   should increment skipped counter, NOT be added to violations array
 * - True mismatches (coverage_mismatch) should be added to violations array
 *
 * Related: scripts/validate-gdd-cross.js:211-231
 */

const { CrossValidationRunner } = require('../../../scripts/validate-gdd-cross');
const { GDDCrossValidator } = require('../../../scripts/gdd-cross-validator');
const fs = require('fs').promises;
const path = require('path');

describe('CrossValidationRunner - Validation Structure (Issue #3)', () => {
  let validator;
  const mockRootDir = path.resolve(__dirname, '../../..');

  beforeEach(() => {
    validator = new CrossValidationRunner({ silent: true });

    // Reset results
    validator.results = {
      nodes_validated: 0,
      coverage_validation: {
        total: 0,
        matched: 0,
        mismatched: 0,
        skipped: 0,
        violations: []
      },
      timestamp_validation: {
        total: 0,
        valid: 0,
        stale: 0,
        future: 0,
        violations: []
      },
      dependency_validation: {
        total: 0,
        valid: 0,
        missing_deps: 0,
        phantom_deps: 0,
        violations: []
      },
      overall_score: 0,
      status: 'HEALTHY'
    };
  });

  describe('Skipped counter for warnings', () => {
    test('should increment skipped counter for coverage_data_unavailable', async () => {
      // Mock validateCoverage to return warning
      validator.validator.validateCoverage = jest.fn().mockResolvedValue({
        valid: false,
        reason: 'coverage_data_unavailable',
        declared: 70,
        actual: null,
        diff: null
      });

      // Mock node data
      const mockNodeData = {
        metadata: { coverage: 70, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('test-node', mockNodeData);

      // Assertions
      expect(validator.results.coverage_validation.total).toBe(1);
      expect(validator.results.coverage_validation.matched).toBe(0);
      expect(validator.results.coverage_validation.mismatched).toBe(0);
      expect(validator.results.coverage_validation.skipped).toBe(1);
      expect(validator.results.coverage_validation.violations).toHaveLength(0);
    });

    test('should increment skipped counter for no_source_files_found', async () => {
      validator.validator.validateCoverage = jest.fn().mockResolvedValue({
        valid: false,
        reason: 'no_source_files_found',
        declared: 80,
        actual: null,
        diff: null
      });

      const mockNodeData = {
        metadata: { coverage: 80, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('test-node', mockNodeData);

      expect(validator.results.coverage_validation.skipped).toBe(1);
      expect(validator.results.coverage_validation.violations).toHaveLength(0);
    });

    test('should increment skipped counter for coverage_calculation_failed', async () => {
      validator.validator.validateCoverage = jest.fn().mockResolvedValue({
        valid: false,
        reason: 'coverage_calculation_failed',
        declared: 90,
        actual: null,
        diff: null
      });

      const mockNodeData = {
        metadata: { coverage: 90, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('test-node', mockNodeData);

      expect(validator.results.coverage_validation.skipped).toBe(1);
      expect(validator.results.coverage_validation.violations).toHaveLength(0);
    });
  });

  describe('Violations array for true mismatches', () => {
    test('should add violation and increment mismatched for coverage_mismatch', async () => {
      validator.validator.validateCoverage = jest.fn().mockResolvedValue({
        valid: false,
        reason: 'coverage_mismatch',
        declared: 70,
        actual: 50,
        diff: 20
      });

      const mockNodeData = {
        metadata: { coverage: 70, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('test-node', mockNodeData);

      // Assertions
      expect(validator.results.coverage_validation.mismatched).toBe(1);
      expect(validator.results.coverage_validation.skipped).toBe(0);
      expect(validator.results.coverage_validation.violations).toHaveLength(1);
      expect(validator.results.coverage_validation.violations[0]).toEqual({
        node: 'test-node',
        declared: 70,
        actual: 50,
        diff: 20,
        reason: 'coverage_mismatch'
      });
    });
  });

  describe('Mixed scenarios', () => {
    test('should correctly separate warnings and violations', async () => {
      // Node 1: Warning (coverage_data_unavailable)
      validator.validator.validateCoverage = jest.fn().mockResolvedValueOnce({
        valid: false,
        reason: 'coverage_data_unavailable',
        declared: 70,
        actual: null,
        diff: null
      });

      const mockNodeData1 = {
        metadata: { coverage: 70, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('node-1', mockNodeData1);

      // Node 2: True mismatch
      validator.validator.validateCoverage = jest.fn().mockResolvedValueOnce({
        valid: false,
        reason: 'coverage_mismatch',
        declared: 80,
        actual: 60,
        diff: 20
      });

      const mockNodeData2 = {
        metadata: { coverage: 80, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('node-2', mockNodeData2);

      // Node 3: Another warning (no_source_files_found)
      validator.validator.validateCoverage = jest.fn().mockResolvedValueOnce({
        valid: false,
        reason: 'no_source_files_found',
        declared: 90,
        actual: null,
        diff: null
      });

      const mockNodeData3 = {
        metadata: { coverage: 90, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('node-3', mockNodeData3);

      // Assertions
      expect(validator.results.coverage_validation.total).toBe(3);
      expect(validator.results.coverage_validation.matched).toBe(0);
      expect(validator.results.coverage_validation.mismatched).toBe(1);
      expect(validator.results.coverage_validation.skipped).toBe(2);
      expect(validator.results.coverage_validation.violations).toHaveLength(1);
      expect(validator.results.coverage_validation.violations[0].node).toBe('node-2');
    });

    test('should not affect matched counter when coverage is valid', async () => {
      validator.validator.validateCoverage = jest.fn().mockResolvedValue({
        valid: true,
        reason: null,
        declared: 80,
        actual: 82,
        diff: 2
      });

      const mockNodeData = {
        metadata: { coverage: 80, last_updated: null },
        depends_on: []
      };

      await validator.validateNode('test-node', mockNodeData);

      expect(validator.results.coverage_validation.matched).toBe(1);
      expect(validator.results.coverage_validation.mismatched).toBe(0);
      expect(validator.results.coverage_validation.skipped).toBe(0);
      expect(validator.results.coverage_validation.violations).toHaveLength(0);
    });
  });

  describe('Initialization', () => {
    test('should initialize with skipped counter at 0', () => {
      const freshValidator = new CrossValidationRunner({ silent: true });

      expect(freshValidator.results.coverage_validation).toHaveProperty('skipped');
      expect(freshValidator.results.coverage_validation.skipped).toBe(0);
    });
  });
});
