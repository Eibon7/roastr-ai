/**
 * GDD Coverage Helper
 *
 * Provides utilities for fetching actual coverage data from test reports
 * and mapping nodes to their source files for coverage authenticity validation.
 *
 * Phase 15.1: Coverage Integrity Enforcement
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class CoverageHelper {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.coverageData = null;
    this.systemMap = null;
  }

  /**
   * Load coverage data from coverage-summary.json
   */
  async loadCoverageData() {
    if (this.coverageData) {
      return this.coverageData;
    }

    try {
      const coveragePath = path.join(this.rootDir, 'coverage', 'coverage-summary.json');
      const content = await fs.readFile(coveragePath, 'utf-8');
      this.coverageData = JSON.parse(content);
      return this.coverageData;
    } catch (error) {
      // Coverage report not available
      return null;
    }
  }

  /**
   * Load system map
   */
  async loadSystemMap() {
    if (this.systemMap) {
      return this.systemMap;
    }

    try {
      const mapPath = path.join(this.rootDir, 'docs', 'system-map.yaml');
      const content = await fs.readFile(mapPath, 'utf-8');
      this.systemMap = yaml.parse(content);
      return this.systemMap;
    } catch (error) {
      return { nodes: {} };
    }
  }

  /**
   * Get actual coverage from report for a specific node
   *
   * @param {string} nodeName - Name of the GDD node
   * @returns {number|null} - Coverage percentage (0-100) or null if not available
   */
  async getCoverageFromReport(nodeName) {
    const coverageData = await this.loadCoverageData();
    const systemMap = await this.loadSystemMap();

    if (!coverageData || !systemMap || !systemMap.nodes) {
      return null;
    }

    const nodeConfig = systemMap.nodes[nodeName];
    if (!nodeConfig || !nodeConfig.files || nodeConfig.files.length === 0) {
      // Node has no associated files, coverage N/A
      return null;
    }

    // Calculate average coverage for all files associated with this node
    let totalCoverage = 0;
    let fileCount = 0;

    for (const filePath of nodeConfig.files) {
      // Convert relative path to absolute for coverage lookup
      const absolutePath = path.join(this.rootDir, filePath);

      // Find coverage entry for this file
      const fileEntry = coverageData[absolutePath];
      if (fileEntry && fileEntry.lines && fileEntry.lines.pct !== undefined) {
        totalCoverage += fileEntry.lines.pct;
        fileCount++;
      }
    }

    if (fileCount === 0) {
      // No coverage data found for any files
      return null;
    }

    // Return average coverage rounded to nearest integer
    return Math.round(totalCoverage / fileCount);
  }

  /**
   * Validate coverage authenticity for a node
   *
   * @param {string} nodeName - Name of the GDD node
   * @param {number} declaredCoverage - Coverage declared in node documentation
   * @param {number} tolerance - Allowed difference (default: 3%)
   * @returns {Object} - Validation result { valid, actual, declared, diff, message }
   */
  async validateCoverageAuthenticity(nodeName, declaredCoverage, tolerance = 3) {
    const actualCoverage = await this.getCoverageFromReport(nodeName);

    if (actualCoverage === null) {
      // No coverage data available, cannot validate
      return {
        valid: true,
        actual: null,
        declared: declaredCoverage,
        diff: null,
        message: 'Coverage data not available for validation',
        severity: 'warning'
      };
    }

    const diff = Math.abs(declaredCoverage - actualCoverage);

    if (diff <= tolerance) {
      return {
        valid: true,
        actual: actualCoverage,
        declared: declaredCoverage,
        diff,
        message: `Coverage authentic (${declaredCoverage}% ≈ ${actualCoverage}%)`,
        severity: 'info'
      };
    }

    return {
      valid: false,
      actual: actualCoverage,
      declared: declaredCoverage,
      diff,
      message: `Coverage mismatch: declared ${declaredCoverage}% but actual is ${actualCoverage}% (diff: ${diff}%)`,
      severity: 'critical'
    };
  }

  /**
   * Get coverage source from node content
   *
   * @param {string} content - Node markdown content
   * @returns {string|null} - 'auto', 'manual', or null if not specified
   */
  getCoverageSource(content) {
    const match = content.match(/\*?\*?coverage\s+source:?\*?\*?\s*(auto|manual)/i);
    return match ? match[1].toLowerCase() : null;
  }
}

module.exports = { CoverageHelper };
