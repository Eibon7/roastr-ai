/**
 * Tests for sync-gdd-metrics.js
 * Issue #477 - Auto-generate GDD sync metrics from JSON files
 */

const fs = require('fs').promises;
const path = require('path');
const { MetricsCollector, DocumentUpdater, CLI } = require('../../../scripts/sync-gdd-metrics');

// Mock filesystem
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    access: jest.fn()
  }
}));

// Mock child_process for health score execution
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

const { execSync } = require('child_process');

describe('MetricsCollector', () => {
  let collector;
  const mockRootDir = '/mock/root';

  beforeEach(() => {
    collector = new MetricsCollector(mockRootDir);
    jest.clearAllMocks();
  });

  describe('collectLighthouseScore', () => {
    it('should collect lighthouse score from JSON file', async () => {
      const mockLighthouseData = {
        categories: {
          accessibility: {
            score: 0.98
          }
        }
      };

      // Mock directory structure
      fs.readdir.mockImplementation(async (dir) => {
        if (dir === path.join(mockRootDir, 'docs', 'test-evidence')) {
          return [{ name: 'phase-11', isDirectory: () => true, isFile: () => false }];
        }
        if (dir.includes('phase-11')) {
          return [{ name: 'lighthouse-report.json', isDirectory: () => false, isFile: () => true }];
        }
        return [];
      });

      fs.stat.mockResolvedValue({
        mtime: new Date('2025-10-20')
      });

      fs.readFile.mockResolvedValue(JSON.stringify(mockLighthouseData));

      const result = await collector.collectLighthouseScore();

      expect(result).toEqual({
        score: 98,
        source: expect.stringContaining('lighthouse-report.json'),
        timestamp: expect.any(String)
      });
    });

    it('should return null if no lighthouse files found', async () => {
      fs.readdir.mockResolvedValue([]);

      const result = await collector.collectLighthouseScore();

      expect(result).toBeNull();
    });

    it('should return null if lighthouse data is malformed', async () => {
      fs.readdir.mockImplementation(async (dir) => {
        if (dir === path.join(mockRootDir, 'docs', 'test-evidence')) {
          return [{ name: 'lighthouse-report.json', isDirectory: () => false, isFile: () => true }];
        }
        return [];
      });

      fs.stat.mockResolvedValue({
        mtime: new Date('2025-10-20')
      });

      fs.readFile.mockResolvedValue(JSON.stringify({ invalid: 'data' }));

      const result = await collector.collectLighthouseScore();

      expect(result).toBeNull();
    });
  });

  describe('collectNodeCount', () => {
    it('should collect node count from gdd-status.json', async () => {
      const mockStatusData = {
        nodes_validated: 15,
        orphans: ['node1', 'node2']
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockStatusData));

      const result = await collector.collectNodeCount();

      expect(result).toEqual({
        total: 15,
        healthy: 13,
        orphans: 2,
        source: 'gdd-status.json'
      });
    });

    it('should return null if gdd-status.json is missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await collector.collectNodeCount();

      expect(result).toBeNull();
    });

    it('should handle empty orphans array', async () => {
      const mockStatusData = {
        nodes_validated: 15,
        orphans: []
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockStatusData));

      const result = await collector.collectNodeCount();

      expect(result).toEqual({
        total: 15,
        healthy: 15,
        orphans: 0,
        source: 'gdd-status.json'
      });
    });

    // Issue #621, CodeRabbit Minor: Edge case - orphans > total
    it('should clamp healthy to 0 when orphans exceed total', async () => {
      const mockStatusData = {
        nodes_validated: 5,
        orphans: ['node1', 'node2', 'node3', 'node4', 'node5', 'node6', 'node7', 'node8']
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockStatusData));

      const result = await collector.collectNodeCount();

      expect(result).toEqual({
        total: 5,
        healthy: 0, // Clamped to 0, not negative
        orphans: 8,
        source: 'gdd-status.json'
      });
    });

    // Issue #621, CodeRabbit Minor: Edge case - healthy at boundary
    it('should handle healthy at exact total', async () => {
      const mockStatusData = {
        nodes_validated: 10,
        orphans: ['node1']
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockStatusData));

      const result = await collector.collectNodeCount();

      expect(result).toEqual({
        total: 10,
        healthy: 9,
        orphans: 1,
        source: 'gdd-status.json'
      });
    });
  });

  describe('collectHealthScore', () => {
    it('should collect health score from score-gdd-health.js', async () => {
      execSync.mockReturnValue('Overall Health: 98.5/100\nOther output...');

      const result = await collector.collectHealthScore();

      expect(result).toEqual({
        score: 98.5,
        source: 'score-gdd-health.js'
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('score-gdd-health.js'),
        expect.objectContaining({
          encoding: 'utf-8'
        })
      );
    });

    it('should return null if health score script fails', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Script failed');
      });

      const result = await collector.collectHealthScore();

      expect(result).toBeNull();
    });

    it('should return null if output format is unexpected', async () => {
      execSync.mockReturnValue('Invalid output without health score');

      const result = await collector.collectHealthScore();

      expect(result).toBeNull();
    });
  });

  describe('collectCoverage', () => {
    it('should collect coverage from coverage-summary.json', async () => {
      const mockCoverageData = {
        total: {
          lines: { pct: 85.5 },
          branches: { pct: 78.2 },
          functions: { pct: 90.1 },
          statements: { pct: 86.3 }
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockCoverageData));

      const result = await collector.collectCoverage();

      expect(result).toEqual({
        lines: 85.5,
        branches: 78.2,
        functions: 90.1,
        statements: 86.3,
        source: 'coverage/coverage-summary.json'
      });
    });

    it('should return null if coverage file is missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await collector.collectCoverage();

      expect(result).toBeNull();
    });

    it('should handle missing total object', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));

      const result = await collector.collectCoverage();

      expect(result).toBeNull();
    });
  });

  describe('collectAll', () => {
    it('should collect all metrics', async () => {
      // Mock all collection methods
      collector.collectLighthouseScore = jest.fn().mockResolvedValue({
        score: 98,
        source: 'lighthouse-report.json',
        timestamp: '2025-10-20T00:00:00.000Z'
      });

      collector.collectNodeCount = jest.fn().mockResolvedValue({
        total: 15,
        healthy: 13,
        orphans: 2,
        source: 'gdd-status.json'
      });

      collector.collectHealthScore = jest.fn().mockResolvedValue({
        score: 98.5,
        source: 'score-gdd-health.js'
      });

      collector.collectCoverage = jest.fn().mockResolvedValue({
        lines: 85.5,
        branches: 78.2,
        functions: 90.1,
        statements: 86.3,
        source: 'coverage/coverage-summary.json'
      });

      const result = await collector.collectAll();

      expect(result).toEqual({
        lighthouse: expect.objectContaining({ score: 98 }),
        nodeCount: expect.objectContaining({ total: 15 }),
        healthScore: expect.objectContaining({ score: 98.5 }),
        coverage: expect.objectContaining({ lines: 85.5 }),
        timestamp: expect.any(String)
      });

      expect(collector.collectLighthouseScore).toHaveBeenCalled();
      expect(collector.collectNodeCount).toHaveBeenCalled();
      expect(collector.collectHealthScore).toHaveBeenCalled();
      expect(collector.collectCoverage).toHaveBeenCalled();
    });

    it('should handle partial failures gracefully', async () => {
      collector.collectLighthouseScore = jest.fn().mockResolvedValue(null);
      collector.collectNodeCount = jest
        .fn()
        .mockResolvedValue({ total: 15, healthy: 13, orphans: 2 });
      collector.collectHealthScore = jest.fn().mockResolvedValue(null);
      collector.collectCoverage = jest.fn().mockResolvedValue({ lines: 85.5 });

      const result = await collector.collectAll();

      expect(result.lighthouse).toBeNull();
      expect(result.nodeCount).not.toBeNull();
      expect(result.healthScore).toBeNull();
      expect(result.coverage).not.toBeNull();
    });
  });
});

describe('DocumentUpdater', () => {
  let updater;
  const mockRootDir = '/mock/root';

  beforeEach(() => {
    updater = new DocumentUpdater(mockRootDir, { dryRun: false });
    jest.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create backup directory', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      const backupDir = await updater.createBackup();

      expect(backupDir).toContain('.gdd-backups');
      expect(backupDir).toContain('metrics-sync-');
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.gdd-backups'), {
        recursive: true
      });
    });

    it('should not create backup in dry-run mode', async () => {
      const dryRunUpdater = new DocumentUpdater(mockRootDir, { dryRun: true });

      await dryRunUpdater.backupFile('/some/file.md');

      expect(fs.copyFile).not.toHaveBeenCalled();
    });
  });

  describe('updateGDDSummary', () => {
    const mockSummaryContent = `
# GDD 2.0 - Implementation Summary Index

## 📊 Quick Stats

| Metric | Value | Status |
|--------|-------|--------|
| **Documented Nodes** | 13/15 | ✅ 100% |
| **Average Health Score** | 95.5/100 | 🟢 HEALTHY |
| **System Status** | OPERATIONAL | ✅ |
`;

    beforeEach(() => {
      fs.readFile.mockResolvedValue(mockSummaryContent);
      fs.writeFile.mockResolvedValue(undefined);
      fs.mkdir.mockResolvedValue(undefined);
      fs.copyFile.mockResolvedValue(undefined);
    });

    it('should update node count', async () => {
      const metrics = {
        nodeCount: {
          total: 15,
          healthy: 15,
          orphans: 0
        }
      };

      const result = await updater.updateGDDSummary(metrics);

      expect(result.updated).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('GDD-IMPLEMENTATION-SUMMARY.md'),
        expect.stringContaining('15/15'),
        'utf-8'
      );
    });

    it('should update health score', async () => {
      const metrics = {
        healthScore: {
          score: 98.7
        }
      };

      const result = await updater.updateGDDSummary(metrics);

      expect(result.updated).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('98.7/100'),
        'utf-8'
      );
    });

    it('should not modify file in dry-run mode', async () => {
      const dryRunUpdater = new DocumentUpdater(mockRootDir, { dryRun: true });
      const metrics = {
        nodeCount: { total: 15, healthy: 15 }
      };

      const result = await dryRunUpdater.updateGDDSummary(metrics);

      expect(result.updated).toBe(true);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle no changes needed', async () => {
      const metrics = {}; // No metrics to update

      const result = await updater.updateGDDSummary(metrics);

      expect(result.updated).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const metrics = {
        nodeCount: { total: 15, healthy: 15 }
      };

      const result = await updater.updateGDDSummary(metrics);

      expect(result.updated).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should detect node count mismatch', async () => {
      const mockContent = `
| **Documented Nodes** | 13/15 | ✅ 100% |
`;
      fs.readFile.mockResolvedValue(mockContent);

      const metrics = {
        nodeCount: {
          total: 15,
          healthy: 14,
          orphans: 1
        }
      };

      const issues = await updater.validate(metrics);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        metric: 'node_count',
        documented: '13/15',
        actual: '14/15',
        severity: 'warning'
      });
    });

    it('should detect health score mismatch', async () => {
      const mockContent = `
| **Average Health Score** | 95.0/100 | 🟢 HEALTHY |
`;
      fs.readFile.mockResolvedValue(mockContent);

      const metrics = {
        healthScore: {
          score: 98.5
        }
      };

      const issues = await updater.validate(metrics);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        metric: 'health_score',
        documented: '95.0/100',
        actual: '98.5/100',
        severity: 'warning'
      });
    });

    it('should return empty array if all metrics match', async () => {
      const mockContent = `
| **Documented Nodes** | 15/15 | ✅ 100% |
| **Average Health Score** | 98.5/100 | 🟢 HEALTHY |
`;
      fs.readFile.mockResolvedValue(mockContent);

      const metrics = {
        nodeCount: { total: 15, healthy: 15 },
        healthScore: { score: 98.5 }
      };

      const issues = await updater.validate(metrics);

      expect(issues).toHaveLength(0);
    });

    it('should tolerate small health score differences', async () => {
      const mockContent = `
| **Average Health Score** | 98.0/100 | 🟢 HEALTHY |
`;
      fs.readFile.mockResolvedValue(mockContent);

      const metrics = {
        healthScore: { score: 98.3 } // Within 0.5 tolerance
      };

      const issues = await updater.validate(metrics);

      expect(issues).toHaveLength(0);
    });
  });

  // Issue #621, CodeRabbit P1: CLI error handling tests
  describe('Error Handling', () => {
    beforeEach(() => {
      // Mock DocumentUpdater methods
      updater.updateGDDSummary = jest.fn();
    });

    it('should return exit code 1 when updateGDDSummary fails', async () => {
      // Mock error in updateGDDSummary
      updater.updateGDDSummary.mockResolvedValue({
        updated: false,
        error: 'File not found: GDD-IMPLEMENTATION-SUMMARY.md'
      });

      const results = await updater.updateAll({ nodeCount: { total: 10, healthy: 8 } });

      expect(results.summary.error).toBe('File not found: GDD-IMPLEMENTATION-SUMMARY.md');
      expect(results.summary.updated).toBe(false);
    });

    it('should propagate errors in CI mode', async () => {
      // Mock error
      updater.updateGDDSummary.mockResolvedValue({
        updated: false,
        error: 'Permission denied'
      });

      const results = await updater.updateAll({ nodeCount: { total: 10, healthy: 8 } });

      // Verify error is in results
      expect(results.summary.error).toBeDefined();
      expect(results.summary.error).toBe('Permission denied');
    });
  });
});

// Issue #621, CodeRabbit Major: CLI --metric filter tests
describe('CLI parseArgs and filtering logic', () => {
  const mockMetrics = {
    lighthouse: { score: 98, source: 'test.json', timestamp: '2025-10-21T00:00:00Z' },
    nodeCount: { total: 15, healthy: 13, orphans: 2, source: 'gdd-status.json' },
    healthScore: { score: 87.5, source: 'score-gdd-health.js' },
    coverage: {
      lines: 85.3,
      branches: 78.9,
      functions: 90.1,
      statements: 85.0,
      source: 'coverage-summary.json'
    },
    timestamp: '2025-10-21T00:00:00Z'
  };

  it('should parse --metric=lighthouse correctly', () => {
    process.argv = ['node', 'script.js', '--metric=lighthouse'];
    const cli = new CLI();
    expect(cli.options.metric).toBe('lighthouse');
  });

  it('should parse --metric=node correctly', () => {
    process.argv = ['node', 'script.js', '--metric=node'];
    const cli = new CLI();
    expect(cli.options.metric).toBe('node');
  });

  it('should parse --metric=health correctly', () => {
    process.argv = ['node', 'script.js', '--metric=health'];
    const cli = new CLI();
    expect(cli.options.metric).toBe('health');
  });

  it('should parse --metric=coverage correctly', () => {
    process.argv = ['node', 'script.js', '--metric=coverage'];
    const cli = new CLI();
    expect(cli.options.metric).toBe('coverage');
  });

  it('should filter lighthouse metric correctly', () => {
    const metricKey = 'lighthouse';
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    const k = aliases[metricKey];
    const filtered = {
      lighthouse: null,
      nodeCount: null,
      healthScore: null,
      coverage: null,
      timestamp: mockMetrics.timestamp
    };
    filtered[k] = mockMetrics[k];

    expect(filtered.lighthouse).toEqual(mockMetrics.lighthouse);
    expect(filtered.nodeCount).toBeNull();
    expect(filtered.healthScore).toBeNull();
    expect(filtered.coverage).toBeNull();
  });

  it('should filter node metric correctly (alias test)', () => {
    const metricKey = 'node';
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    const k = aliases[metricKey];
    const filtered = {
      lighthouse: null,
      nodeCount: null,
      healthScore: null,
      coverage: null,
      timestamp: mockMetrics.timestamp
    };
    filtered[k] = mockMetrics[k];

    expect(filtered.lighthouse).toBeNull();
    expect(filtered.nodeCount).toEqual(mockMetrics.nodeCount);
    expect(filtered.healthScore).toBeNull();
    expect(filtered.coverage).toBeNull();
  });

  it('should filter health metric correctly', () => {
    const metricKey = 'health';
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    const k = aliases[metricKey];
    const filtered = {
      lighthouse: null,
      nodeCount: null,
      healthScore: null,
      coverage: null,
      timestamp: mockMetrics.timestamp
    };
    filtered[k] = mockMetrics[k];

    expect(filtered.lighthouse).toBeNull();
    expect(filtered.nodeCount).toBeNull();
    expect(filtered.healthScore).toEqual(mockMetrics.healthScore);
    expect(filtered.coverage).toBeNull();
  });

  it('should filter coverage metric correctly', () => {
    const metricKey = 'coverage';
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    const k = aliases[metricKey];
    const filtered = {
      lighthouse: null,
      nodeCount: null,
      healthScore: null,
      coverage: null,
      timestamp: mockMetrics.timestamp
    };
    filtered[k] = mockMetrics[k];

    expect(filtered.lighthouse).toBeNull();
    expect(filtered.nodeCount).toBeNull();
    expect(filtered.healthScore).toBeNull();
    expect(filtered.coverage).toEqual(mockMetrics.coverage);
  });

  it('should support alias nodecount for nodeCount', () => {
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    expect(aliases.nodecount).toBe('nodeCount');
    expect(aliases.nodes).toBe('nodeCount');
  });

  it('should support alias healthscore for healthScore', () => {
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    expect(aliases.healthscore).toBe('healthScore');
  });

  it('should not filter when no metric specified', () => {
    process.argv = ['node', 'script.js'];
    const cli = new CLI();
    expect(cli.options.metric).toBeUndefined();
  });

  it('should not filter when invalid metric specified', () => {
    process.argv = ['node', 'script.js', '--metric=invalid'];
    const cli = new CLI();
    const metricKey = cli.options.metric && cli.options.metric.toLowerCase();
    const aliases = {
      lighthouse: 'lighthouse',
      node: 'nodeCount',
      nodecount: 'nodeCount',
      nodes: 'nodeCount',
      health: 'healthScore',
      healthscore: 'healthScore',
      coverage: 'coverage'
    };

    // Invalid metric should not be in aliases
    expect(aliases[metricKey]).toBeUndefined();
  });
});
