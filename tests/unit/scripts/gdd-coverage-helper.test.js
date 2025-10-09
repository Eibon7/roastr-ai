/**
 * Unit tests for GDD Coverage Helper
 *
 * Tests the coverage lookup logic with different Jest report formats
 * (absolute paths, relative paths, mixed keys, edge cases)
 *
 * Phase 15.1: Coverage Integrity Enforcement
 * Review: #3315196723
 */

const { CoverageHelper } = require('../../../scripts/gdd-coverage-helper');
const fs = require('fs').promises;
const path = require('path');

// Mock fs.readFile
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

describe('CoverageHelper', () => {
  let coverageHelper;
  const rootDir = '/Users/test/project';

  beforeEach(() => {
    coverageHelper = new CoverageHelper();
    coverageHelper.rootDir = rootDir;
    jest.clearAllMocks();
  });

  describe('loadCoverageData', () => {
    it('should load coverage-summary.json correctly', async () => {
      const mockCoverage = {
        total: { lines: { pct: 60 } },
        'src/services/foo.js': { lines: { pct: 80 } }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockCoverage));

      const result = await coverageHelper.loadCoverageData();

      expect(result).toEqual(mockCoverage);
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(rootDir, 'coverage', 'coverage-summary.json'),
        'utf-8'
      );
    });

    it('should return null when file not found', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await coverageHelper.loadCoverageData();

      expect(result).toBeNull();
    });

    it('should cache data and not reload on second call', async () => {
      const mockCoverage = { total: { lines: { pct: 60 } } };
      fs.readFile.mockResolvedValue(JSON.stringify(mockCoverage));

      await coverageHelper.loadCoverageData();
      await coverageHelper.loadCoverageData();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadSystemMap', () => {
    it('should load system-map.yaml correctly', async () => {
      const mockMap = `
nodes:
  test-node:
    files:
      - src/services/foo.js
`;
      fs.readFile.mockResolvedValue(mockMap);

      const result = await coverageHelper.loadSystemMap();

      expect(result).toHaveProperty('nodes');
      expect(result.nodes).toHaveProperty('test-node');
    });

    it('should return empty object when file not found', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await coverageHelper.loadSystemMap();

      expect(result).toEqual({ nodes: {} });
    });

    it('should cache data and not reload on second call', async () => {
      const mockMap = 'nodes: {}';
      fs.readFile.mockResolvedValue(mockMap);

      await coverageHelper.loadSystemMap();
      await coverageHelper.loadSystemMap();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCoverageFromReport', () => {
    describe('Strategy 1: Absolute path lookup', () => {
      it('should find coverage with absolute path keys', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } },
          '/Users/test/project/src/services/foo.js': { lines: { pct: 80 } },
          '/Users/test/project/src/services/bar.js': { lines: { pct: 60 } }
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js', 'src/services/bar.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js\n      - src/services/bar.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(70); // Average of 80 and 60
      });
    });

    describe('Strategy 2: Relative path lookup', () => {
      it('should find coverage with relative path keys', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } },
          'src/services/foo.js': { lines: { pct: 80 } },
          'src/services/bar.js': { lines: { pct: 60 } }
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js', 'src/services/bar.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js\n      - src/services/bar.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(70); // Average of 80 and 60
      });
    });

    describe('Strategy 3: Normalized path comparison', () => {
      it('should find coverage with mixed key formats', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } },
          '/Users/test/project/src/services/foo.js': { lines: { pct: 80 } }, // Absolute
          'src/services/bar.js': { lines: { pct: 60 } } // Relative
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js', 'src/services/bar.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js\n      - src/services/bar.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(70); // Average of 80 and 60
      });

      it('should handle path separator differences', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } },
          '/Users/test/project/src/services/foo.js': { lines: { pct: 85 } }
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(85);
      });
    });

    describe('Edge cases', () => {
      it('should return null when node has no files', async () => {
        const mockCoverage = { total: { lines: { pct: 60 } } };
        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: []
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files: []');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBeNull();
      });

      it('should return null when node not in system map', async () => {
        const mockCoverage = { total: { lines: { pct: 60 } } };
        const mockSystemMap = { nodes: {} };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes: {}');

        const result = await coverageHelper.getCoverageFromReport('non-existent-node');

        expect(result).toBeNull();
      });

      it('should ignore files not in coverage report', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } },
          'src/services/foo.js': { lines: { pct: 80 } }
          // bar.js missing from coverage report
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js', 'src/services/bar.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js\n      - src/services/bar.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(80); // Only foo.js found, returns its coverage
      });

      it('should return null when no files found in coverage report', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } }
          // None of the node files in coverage report
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js', 'src/services/bar.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js\n      - src/services/bar.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBeNull();
      });

      it('should return null when coverage report not available', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT'));

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBeNull();
      });

      it('should skip "total" entry when normalizing keys', async () => {
        const mockCoverage = {
          total: { lines: { pct: 100 } }, // Should be skipped
          'src/services/foo.js': { lines: { pct: 80 } }
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(80); // Should not include 'total' in average
      });
    });

    describe('Multiple files', () => {
      it('should calculate average coverage correctly', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } },
          'src/services/foo.js': { lines: { pct: 80 } },
          'src/services/bar.js': { lines: { pct: 60 } },
          'src/services/baz.js': { lines: { pct: 90 } }
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js', 'src/services/bar.js', 'src/services/baz.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js\n      - src/services/bar.js\n      - src/services/baz.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(77); // Average of 80, 60, 90 = 76.67 → rounds to 77
      });

      it('should round average to nearest integer', async () => {
        const mockCoverage = {
          total: { lines: { pct: 60 } },
          'src/services/foo.js': { lines: { pct: 85 } },
          'src/services/bar.js': { lines: { pct: 86 } }
        };

        const mockSystemMap = {
          nodes: {
            'test-node': {
              files: ['src/services/foo.js', 'src/services/bar.js']
            }
          }
        };

        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockCoverage))
          .mockResolvedValueOnce('nodes:\n  test-node:\n    files:\n      - src/services/foo.js\n      - src/services/bar.js');

        const result = await coverageHelper.getCoverageFromReport('test-node');

        expect(result).toBe(86); // Average of 85 and 86 = 85.5 → rounds to 86
      });
    });
  });

  describe('validateCoverageAuthenticity', () => {
    beforeEach(() => {
      // Mock getCoverageFromReport for validation tests
      jest.spyOn(coverageHelper, 'getCoverageFromReport');
    });

    it('should validate as true when within tolerance', async () => {
      coverageHelper.getCoverageFromReport.mockResolvedValue(82);

      const result = await coverageHelper.validateCoverageAuthenticity('test-node', 80, 3);

      expect(result.valid).toBe(true);
      expect(result.actual).toBe(82);
      expect(result.declared).toBe(80);
      expect(result.diff).toBe(2);
      expect(result.severity).toBe('info');
    });

    it('should validate as false when exceeds tolerance', async () => {
      coverageHelper.getCoverageFromReport.mockResolvedValue(75);

      const result = await coverageHelper.validateCoverageAuthenticity('test-node', 80, 3);

      expect(result.valid).toBe(false);
      expect(result.actual).toBe(75);
      expect(result.declared).toBe(80);
      expect(result.diff).toBe(5);
      expect(result.severity).toBe('critical');
    });

    it('should return warning when coverage data unavailable', async () => {
      coverageHelper.getCoverageFromReport.mockResolvedValue(null);

      const result = await coverageHelper.validateCoverageAuthenticity('test-node', 80, 3);

      expect(result.valid).toBe(true);
      expect(result.actual).toBeNull();
      expect(result.declared).toBe(80);
      expect(result.diff).toBeNull();
      expect(result.severity).toBe('warning');
    });

    it('should use default tolerance of 3% when not specified', async () => {
      coverageHelper.getCoverageFromReport.mockResolvedValue(83);

      const result = await coverageHelper.validateCoverageAuthenticity('test-node', 80);

      expect(result.valid).toBe(true);
      expect(result.diff).toBe(3);
    });

    it('should handle exact match', async () => {
      coverageHelper.getCoverageFromReport.mockResolvedValue(80);

      const result = await coverageHelper.validateCoverageAuthenticity('test-node', 80, 3);

      expect(result.valid).toBe(true);
      expect(result.diff).toBe(0);
    });

    it('should handle declared higher than actual', async () => {
      coverageHelper.getCoverageFromReport.mockResolvedValue(75);

      const result = await coverageHelper.validateCoverageAuthenticity('test-node', 80, 3);

      expect(result.valid).toBe(false);
      expect(result.diff).toBe(5);
      expect(result.message).toContain('declared 80% but actual is 75%');
    });

    it('should handle actual higher than declared', async () => {
      coverageHelper.getCoverageFromReport.mockResolvedValue(85);

      const result = await coverageHelper.validateCoverageAuthenticity('test-node', 80, 3);

      expect(result.valid).toBe(false);
      expect(result.diff).toBe(5);
      expect(result.message).toContain('declared 80% but actual is 85%');
    });
  });

  describe('getCoverageSource', () => {
    it('should parse "auto" correctly', () => {
      const content = '**Coverage Source:** auto\n';
      const result = coverageHelper.getCoverageSource(content);
      expect(result).toBe('auto');
    });

    it('should parse "manual" correctly', () => {
      const content = '**Coverage Source:** manual\n';
      const result = coverageHelper.getCoverageSource(content);
      expect(result).toBe('manual');
    });

    it('should handle different markdown formats', () => {
      const formats = [
        '**Coverage Source:** auto',
        '**coverage source:** auto',
        'Coverage Source: auto',
        'coverage source: auto'
      ];

      formats.forEach(format => {
        expect(coverageHelper.getCoverageSource(format)).toBe('auto');
      });
    });

    it('should return null when not specified', () => {
      const content = '**Coverage:** 80%\n';
      const result = coverageHelper.getCoverageSource(content);
      expect(result).toBeNull();
    });

    it('should be case insensitive', () => {
      const content = '**Coverage Source:** AUTO\n';
      const result = coverageHelper.getCoverageSource(content);
      expect(result).toBe('auto');
    });
  });
});
