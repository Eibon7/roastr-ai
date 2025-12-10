#!/usr/bin/env node

/**
 * System Map Dependencies Validator
 *
 * Validates that code changes respect system-map-v2.yaml dependencies.
 *
 * Source Requirements:
 * - docs/system-map-v2.yaml: Defines node dependencies (depends_on, required_by)
 * - Plan requirement: Changes must not break system-map dependencies
 *
 * Usage:
 *   node scripts/ci/validate-system-map-dependencies.js [--node=<node-name>]
 *
 * Exit Codes:
 *   0 - Dependencies respected
 *   1 - Dependency violations detected
 *
 * Created: 2025-12-05 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SYSTEM_MAP_PATH = path.join(__dirname, '../../docs/system-map-v2.yaml');

let violations = [];
let warnings = [];

/**
 * Load and parse system-map-v2.yaml
 */
function loadSystemMap() {
  if (!fs.existsSync(SYSTEM_MAP_PATH)) {
    console.error(`❌ System Map file not found: ${SYSTEM_MAP_PATH}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(SYSTEM_MAP_PATH, 'utf8');
    return yaml.load(content);
  } catch (error) {
    console.error(`❌ Error parsing system-map-v2.yaml: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Validate bidirectional dependencies (depends_on ↔ required_by symmetry)
 */
function validateDependencySymmetry(systemMap) {
  const nodes = systemMap.nodes || {};
  const issues = [];

  for (const [nodeId, nodeConfig] of Object.entries(nodes)) {
    const dependsOn = nodeConfig.depends_on || [];
    const requiredBy = nodeConfig.required_by || [];

    // Check: If A depends_on B, then B should have A in required_by
    for (const dep of dependsOn) {
      if (nodes[dep]) {
        const depRequiredBy = nodes[dep].required_by || [];
        if (!depRequiredBy.includes(nodeId)) {
          issues.push({
            type: 'missing_required_by',
            node: nodeId,
            depends_on: dep,
            message: `Node "${nodeId}" depends_on "${dep}" but "${dep}" does not list "${nodeId}" in required_by`
          });
        }
      }
    }

    // Check: If A is in B's required_by, then A should depend_on B
    for (const req of requiredBy) {
      if (nodes[req]) {
        const reqDependsOn = nodes[req].depends_on || [];
        if (!reqDependsOn.includes(nodeId)) {
          issues.push({
            type: 'missing_depends_on',
            node: nodeId,
            required_by: req,
            message: `Node "${nodeId}" is in "${req}" required_by but "${req}" does not depend_on "${nodeId}"`
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Validate that referenced nodes exist
 */
function validateNodeReferences(systemMap) {
  const nodes = systemMap.nodes || {};
  const nodeIds = Object.keys(nodes);
  const issues = [];

  for (const [nodeId, nodeConfig] of Object.entries(nodes)) {
    const dependsOn = nodeConfig.depends_on || [];
    const requiredBy = nodeConfig.required_by || [];

    for (const dep of dependsOn) {
      if (!nodeIds.includes(dep)) {
        issues.push({
          type: 'missing_node',
          node: nodeId,
          reference: dep,
          message: `Node "${nodeId}" depends_on "${dep}" but "${dep}" does not exist`
        });
      }
    }

    for (const req of requiredBy) {
      if (!nodeIds.includes(req)) {
        issues.push({
          type: 'missing_node',
          node: nodeId,
          reference: req,
          message: `Node "${nodeId}" is required_by "${req}" but "${req}" does not exist`
        });
      }
    }
  }

  return issues;
}

/**
 * Main validation
 */
function main() {
  const args = process.argv.slice(2);
  const nodeArg = args.find(arg => arg.startsWith('--node='));
  const targetNode = nodeArg ? nodeArg.split('=')[1] : null;

  console.log('🔍 Validating system-map dependencies...\n');

  const systemMap = loadSystemMap();

  // Validate dependency symmetry
  const symmetryIssues = validateDependencySymmetry(systemMap);
  violations.push(...symmetryIssues.filter(i => i.type === 'missing_required_by' || i.type === 'missing_depends_on'));

  // Validate node references
  const referenceIssues = validateNodeReferences(systemMap);
  violations.push(...referenceIssues);

  // Filter by target node if specified
  if (targetNode) {
    violations = violations.filter(v => v.node === targetNode || v.reference === targetNode || v.depends_on === targetNode);
  }

  // Report results
  if (violations.length > 0) {
    console.log('❌ System Map Dependency Violations Detected:\n');
    for (const violation of violations) {
      console.log(`  Type: ${violation.type}`);
      console.log(`  Message: ${violation.message}`);
      console.log(`  Source: docs/system-map-v2.yaml\n`);
    }
    console.log(`\n❌ Total violations: ${violations.length}`);
    console.log('\n⚠️  System Map dependencies must be bidirectional and valid.');
    console.log('   - If A depends_on B, then B must have A in required_by');
    console.log('   - All referenced nodes must exist');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    for (const warning of warnings) {
      console.log(`  ${warning}\n`);
    }
  }

  console.log('✅ System Map dependencies are valid.');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, loadSystemMap, validateDependencySymmetry, validateNodeReferences };

