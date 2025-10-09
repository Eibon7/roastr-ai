#!/usr/bin/env node

/**
 * GDD Cross-Validator Helper
 *
 * Provides cross-validation utilities to verify consistency between:
 * 1. Node documentation vs actual coverage data
 * 2. Node timestamps vs git commit history
 * 3. Declared dependencies vs actual code imports
 *
 * Part of GDD 2.0 Phase 15: Cross-Validation & Extended Health Metrics
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class GDDCrossValidator {
  constructor(rootDir = null) {
    this.rootDir = rootDir || path.resolve(__dirname, '..');
    this.coverageData = null;
    this.violations = {
      coverage: [],
      timestamp: [],
      dependency: []
    };
  }

  /**
   * Load coverage data from coverage-summary.json
   */
  async loadCoverageData() {
    try {
      const coveragePath = path.join(this.rootDir, 'coverage', 'coverage-summary.json');
      const content = await fs.readFile(coveragePath, 'utf-8');
      this.coverageData = JSON.parse(content);
      return this.coverageData;
    } catch (error) {
      // Coverage file not found or invalid
      return null;
    }
  }

  /**
   * Validate coverage authenticity for a node
   * @param {string} nodeName - Node name
   * @param {number} declaredCoverage - Coverage % from node doc
   * @param {number} tolerance - Tolerance % (default 3%)
   */
  async validateCoverage(nodeName, declaredCoverage, tolerance = 3) {
    if (!this.coverageData) {
      await this.loadCoverageData();
    }

    if (!this.coverageData) {
      return {
        valid: false,
        reason: 'coverage_data_unavailable',
        declared: declaredCoverage,
        actual: null,
        diff: null
      };
    }

    // Map node name to source files
    const nodeFiles = await this.getNodeSourceFiles(nodeName);

    if (nodeFiles.length === 0) {
      return {
        valid: false,
        reason: 'no_source_files_found',
        declared: declaredCoverage,
        actual: null,
        diff: null
      };
    }

    // Calculate actual coverage for node files
    const actualCoverage = this.calculateFileCoverage(nodeFiles);

    if (actualCoverage === null) {
      return {
        valid: false,
        reason: 'coverage_calculation_failed',
        declared: declaredCoverage,
        actual: null,
        diff: null
      };
    }

    const diff = Math.abs(declaredCoverage - actualCoverage);
    const valid = diff <= tolerance;

    const result = {
      valid,
      reason: valid ? null : 'coverage_mismatch',
      declared: declaredCoverage,
      actual: actualCoverage,
      diff: parseFloat(diff.toFixed(2)),
      tolerance,
      files: nodeFiles
    };

    if (!valid) {
      this.violations.coverage.push({
        node: nodeName,
        ...result
      });
    }

    return result;
  }

  /**
   * Expand a single glob pattern recursively
   * Handles patterns like src/integrations/STAR/index.js where wildcards appear in directory names
   * @param {string} pattern - Glob pattern
   * @returns {Promise<string[]>} - Resolved file paths
   */
  async expandGlobPattern(pattern) {
    const segments = pattern.split('/').filter(Boolean);

    // Start with root as base
    let currentPaths = [''];

    // Process each path segment
    for (const segment of segments) {
      const newPaths = [];

      if (segment.includes('*')) {
        // Wildcard segment - expand it by reading directories
        const regex = new RegExp('^' + segment.replace(/\*/g, '.*') + '$');

        for (const basePath of currentPaths) {
          try {
            const searchDir = path.join(this.rootDir, basePath);
            const entries = await fs.readdir(searchDir, { withFileTypes: true });

            for (const entry of entries) {
              if (regex.test(entry.name)) {
                newPaths.push(path.join(basePath, entry.name));
              }
            }
          } catch (error) {
            // Directory not accessible or doesn't exist, skip
          }
        }
      } else {
        // Literal segment - append to all current paths
        for (const basePath of currentPaths) {
          newPaths.push(path.join(basePath, segment));
        }
      }

      currentPaths = newPaths;
    }

    // Filter to only existing files (not directories)
    const existingFiles = [];
    for (const filePath of currentPaths) {
      try {
        const fullPath = path.join(this.rootDir, filePath);
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) {
          existingFiles.push(filePath);
        }
      } catch (error) {
        // File doesn't exist or not accessible, skip
      }
    }

    return existingFiles;
  }

  /**
   * Get source files for a node
   * @param {string} nodeName - Node name
   */
  async getNodeSourceFiles(nodeName) {
    const mappings = {
      'shield': ['src/services/shieldService.js', 'src/services/shieldDecisionEngine.js', 'src/services/shieldActionExecutor.js', 'src/services/shieldPersistenceService.js', 'src/workers/ShieldActionWorker.js'],
      'roast': ['src/services/roastGeneratorEnhanced.js', 'src/services/roastPromptTemplate.js', 'src/services/csvRoastService.js'],
      'cost-control': ['src/services/costControl.js'],
      'queue-system': ['src/services/queueService.js', 'src/workers/BaseWorker.js'],
      'multi-tenant': ['src/services/multiTenantService.js'],
      'social-platforms': ['src/integrations/*/index.js', 'src/integrations/*Service.js'],
      'persona': ['src/services/personaService.js'],
      'tone': ['src/services/toneService.js'],
      'analytics': ['src/services/analyticsService.js'],
      'billing': ['src/services/billingService.js'],
      'publisher': ['src/services/publisherService.js'],
      'platform-constraints': ['src/services/platformConstraintsService.js'],
      'plan-features': ['src/services/planFeaturesService.js']
    };

    const files = mappings[nodeName] || [];

    // Resolve glob patterns and check existence
    const resolvedFiles = [];
    for (const filePattern of files) {
      if (filePattern.includes('*')) {
        // Glob pattern - use recursive expansion to handle nested wildcards
        const expanded = await this.expandGlobPattern(filePattern);
        resolvedFiles.push(...expanded);
      } else {
        // Direct file path
        try {
          await fs.access(path.join(this.rootDir, filePattern));
          resolvedFiles.push(filePattern);
        } catch (error) {
          // File not found
        }
      }
    }

    return resolvedFiles;
  }

  /**
   * Calculate coverage for specific files
   * @param {string[]} files - Array of file paths
   */
  calculateFileCoverage(files) {
    if (!this.coverageData || files.length === 0) {
      return null;
    }

    let totalStatements = 0;
    let coveredStatements = 0;

    for (const file of files) {
      const absolutePath = path.join(this.rootDir, file);
      const relPath = path.relative(this.rootDir, absolutePath);
      const relPosix = relPath.replace(/\\/g, '/');

      // Try multiple path formats to find coverage data
      // coverage-summary.json keys can be absolute, relative, or POSIX-relative
      const fileData =
        this.coverageData[absolutePath] ??       // Try absolute path
        this.coverageData[relPath] ??            // Try relative path
        this.coverageData[relPosix] ??           // Try POSIX relative path
        this.coverageData[file];                 // Try original path as-is

      if (fileData && fileData.statements) {
        totalStatements += fileData.statements.total || 0;
        coveredStatements += fileData.statements.covered || 0;
      }
    }

    if (totalStatements === 0) {
      return null;
    }

    return parseFloat(((coveredStatements / totalStatements) * 100).toFixed(2));
  }

  /**
   * Validate timestamp against git history
   * @param {string} nodeName - Node name
   * @param {string} declaredDate - Date from node doc (YYYY-MM-DD)
   */
  async validateTimestamp(nodeName, declaredDate) {
    const nodeFile = path.join('docs', 'nodes', `${nodeName}.md`);

    try {
      // Get last commit date for the node file
      const gitCommand = `git log -1 --format=%ai --follow -- ${nodeFile}`;
      const gitDate = execSync(gitCommand, {
        cwd: this.rootDir,
        encoding: 'utf-8'
      }).trim();

      if (!gitDate) {
        return {
          valid: false,
          reason: 'no_git_history',
          declared: declaredDate,
          actual: null,
          diff: null
        };
      }

      // Extract date part (YYYY-MM-DD)
      const actualDate = gitDate.split(' ')[0];

      // Compare dates
      const declared = new Date(declaredDate);
      const actual = new Date(actualDate);
      const diffDays = Math.floor((declared - actual) / (1000 * 60 * 60 * 24));

      // Valid if dates match or declared is within 1 day of actual
      const valid = Math.abs(diffDays) <= 1;

      const result = {
        valid,
        reason: valid ? null : (diffDays > 0 ? 'future_date' : 'stale_date'),
        declared: declaredDate,
        actual: actualDate,
        diffDays: Math.abs(diffDays)
      };

      if (!valid) {
        this.violations.timestamp.push({
          node: nodeName,
          ...result
        });
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        reason: 'git_command_failed',
        declared: declaredDate,
        actual: null,
        diff: null,
        error: error.message
      };
    }
  }

  /**
   * Validate dependencies against actual imports
   * @param {string} nodeName - Node name
   * @param {string[]} declaredDeps - Dependencies from node doc
   */
  async validateDependencies(nodeName, declaredDeps) {
    // Get source files for this node
    const sourceFiles = await this.getNodeSourceFiles(nodeName);

    if (sourceFiles.length === 0) {
      return {
        valid: false,
        reason: 'no_source_files',
        declared: declaredDeps,
        actual: [],
        missing: [],
        phantom: []
      };
    }

    // Extract actual dependencies from source files
    const actualDeps = await this.extractDependenciesFromFiles(sourceFiles);

    // Map node names to possible import patterns
    const depMappings = {
      'cost-control': ['costControl', 'CostControl'],
      'queue-system': ['queueService', 'QueueService', 'BaseWorker'],
      'shield': ['shieldService', 'ShieldService', 'shieldDecisionEngine'],
      'roast': ['roastGenerator', 'RoastGenerator', 'roastPrompt'],
      'multi-tenant': ['multiTenant', 'MultiTenant'],
      'social-platforms': ['integrations/', 'Service.js'],
      'persona': ['personaService', 'PersonaService'],
      'tone': ['toneService', 'ToneService'],
      'analytics': ['analyticsService', 'AnalyticsService'],
      'billing': ['billingService', 'BillingService'],
      'publisher': ['publisherService', 'PublisherService'],
      'platform-constraints': ['platformConstraints', 'PlatformConstraints'],
      'plan-features': ['planFeatures', 'PlanFeatures']
    };

    // Check which declared deps are actually used
    const detectedDeps = new Set();
    for (const dep of declaredDeps) {
      const patterns = depMappings[dep] || [dep];
      for (const pattern of patterns) {
        if (actualDeps.some(imp => imp.includes(pattern))) {
          detectedDeps.add(dep);
          break;
        }
      }
    }

    // Check which imports correspond to undeclared node dependencies (phantom deps)
    const phantomDeps = new Set();
    for (const imp of actualDeps) {
      // For each import, check if it matches any node pattern
      for (const [node, patterns] of Object.entries(depMappings)) {
        // Skip if already declared
        if (declaredDeps.includes(node)) {
          continue;
        }

        // Check if this import matches this node's patterns
        for (const pattern of patterns) {
          if (imp.includes(pattern)) {
            phantomDeps.add(node);
            break;
          }
        }
      }
    }

    // Find missing and phantom dependencies
    const missing = declaredDeps.filter(dep => !detectedDeps.has(dep));
    const phantom = Array.from(phantomDeps); // Phantom deps = imported but not declared

    const valid = missing.length === 0 && phantom.length === 0;

    const result = {
      valid,
      reason: valid ? null : 'dependency_mismatch',
      declared: declaredDeps,
      actual: Array.from(detectedDeps),
      missing,
      phantom,
      detectedImports: actualDeps.length
    };

    if (!valid) {
      this.violations.dependency.push({
        node: nodeName,
        ...result
      });
    }

    return result;
  }

  /**
   * Extract dependencies from source files
   * @param {string[]} files - Array of file paths
   */
  async extractDependenciesFromFiles(files) {
    const dependencies = new Set();

    for (const file of files) {
      try {
        const filePath = path.join(this.rootDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Extract require() statements
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
          dependencies.add(match[1]);
        }

        // Extract import statements
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        while ((match = importRegex.exec(content)) !== null) {
          dependencies.add(match[1]);
        }
      } catch (error) {
        // File read error, skip
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Get all violations
   */
  getAllViolations() {
    return {
      coverage: this.violations.coverage,
      timestamp: this.violations.timestamp,
      dependency: this.violations.dependency,
      total: this.violations.coverage.length +
             this.violations.timestamp.length +
             this.violations.dependency.length
    };
  }

  /**
   * Calculate overall cross-validation score
   */
  calculateScore(totalNodes) {
    const violations = this.getAllViolations();
    const maxPossibleViolations = totalNodes * 3; // 3 checks per node
    const actualViolations = violations.total;

    const score = Math.max(0, ((maxPossibleViolations - actualViolations) / maxPossibleViolations) * 100);
    return parseFloat(score.toFixed(1));
  }

  /**
   * Determine status from score
   */
  getStatus(score) {
    if (score >= 95) return 'HEALTHY';
    if (score >= 80) return 'WARNING';
    return 'FAIL';
  }
}

module.exports = { GDDCrossValidator };
