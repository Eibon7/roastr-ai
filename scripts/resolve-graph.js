#!/usr/bin/env node

/**
 * Graph Driven Development (GDD) - Dependency Resolver
 *
 * Resuelve dependencias de nodos en el system-map.yaml y retorna
 * la lista de archivos .md necesarios para trabajar en una feature.
 *
 * Usage:
 *   node scripts/resolve-graph.js roast
 *   node scripts/resolve-graph.js shield --verbose
 *   node scripts/resolve-graph.js roast --format=json
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ============================================================================
// Configuration
// ============================================================================

const SYSTEM_MAP_PATH = path.join(__dirname, '..', 'docs', 'system-map.yaml');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const FORMAT = process.argv.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'text';

// ============================================================================
// Graph Resolver
// ============================================================================

class GraphResolver {
  constructor(systemMapPath) {
    this.systemMap = this.loadSystemMap(systemMapPath);
    this.visited = new Set();
    this.resolvedDocs = [];
    this.dependencyChain = [];
  }

  loadSystemMap(filePath) {
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      return yaml.load(fileContents);
    } catch (error) {
      console.error(`❌ Error loading system map: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Resolve a node and all its dependencies
   * @param {string} nodeName - Name of the node to resolve
   * @returns {Object} - { docs: [], chain: [], stats: {} }
   */
  resolve(nodeName) {
    this.visited.clear();
    this.resolvedDocs = [];
    this.dependencyChain = [];

    if (!this.systemMap.features[nodeName]) {
      throw new Error(`Node "${nodeName}" not found in system map`);
    }

    this.traverse(nodeName, 0);

    return {
      docs: [...new Set(this.resolvedDocs)], // Remove duplicates
      chain: this.dependencyChain,
      stats: this.getStats()
    };
  }

  /**
   * Traverse the dependency graph recursively
   * @param {string} nodeName - Current node
   * @param {number} depth - Current depth in the graph
   */
  traverse(nodeName, depth) {
    // Cycle detection
    if (this.visited.has(nodeName)) {
      if (VERBOSE) {
        console.log(`  ${'  '.repeat(depth)}↺ Cycle detected: ${nodeName} (skipping)`);
      }
      return;
    }

    // Max depth check
    const maxDepth = this.systemMap.validation?.max_dependency_depth || 5;
    if (depth > maxDepth) {
      console.warn(`⚠️  Max depth (${maxDepth}) exceeded for node: ${nodeName}`);
      return;
    }

    this.visited.add(nodeName);
    const node = this.systemMap.features[nodeName];

    if (!node) {
      console.warn(`⚠️  Node not found: ${nodeName}`);
      return;
    }

    if (VERBOSE) {
      const indent = '  '.repeat(depth);
      console.log(`${indent}→ ${nodeName} (${node.priority || 'N/A'})`);
    }

    // Add this node to dependency chain
    this.dependencyChain.push({
      node: nodeName,
      depth,
      priority: node.priority
    });

    // Collect docs from this node
    if (node.docs && Array.isArray(node.docs)) {
      this.resolvedDocs.push(...node.docs);

      if (VERBOSE) {
        node.docs.forEach(doc => {
          console.log(`${'  '.repeat(depth + 1)}📄 ${doc}`);
        });
      }
    }

    // Recursively resolve dependencies
    if (node.depends_on && Array.isArray(node.depends_on)) {
      node.depends_on.forEach(dep => {
        this.traverse(dep, depth + 1);
      });
    }
  }

  /**
   * Get statistics about the resolution
   */
  getStats() {
    return {
      totalNodes: this.visited.size,
      totalDocs: this.resolvedDocs.length,
      uniqueDocs: new Set(this.resolvedDocs).size,
      maxDepth: Math.max(...this.dependencyChain.map(c => c.depth)),
      criticalNodes: this.dependencyChain.filter(c =>
        this.systemMap.features[c.node]?.priority === 'critical'
      ).length
    };
  }

  /**
   * Validate the entire system map
   * @returns {Object} - { valid: boolean, errors: [], warnings: [] }
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check for circular dependencies
    for (const nodeName in this.systemMap.features) {
      try {
        const visited = new Set();
        const stack = new Set();

        const detectCycle = (node, path = []) => {
          if (stack.has(node)) {
            errors.push({
              type: 'circular_dependency',
              message: `Circular dependency detected: ${path.join(' → ')} → ${node}`
            });
            return true;
          }

          if (visited.has(node)) return false;

          visited.add(node);
          stack.add(node);
          path.push(node);

          const nodeData = this.systemMap.features[node];
          if (nodeData?.depends_on) {
            for (const dep of nodeData.depends_on) {
              if (detectCycle(dep, [...path])) return true;
            }
          }

          stack.delete(node);
          return false;
        };

        detectCycle(nodeName);
      } catch (error) {
        errors.push({
          type: 'validation_error',
          message: `Error validating ${nodeName}: ${error.message}`
        });
      }
    }

    // Check for missing dependencies
    for (const nodeName in this.systemMap.features) {
      const node = this.systemMap.features[nodeName];
      if (node.depends_on) {
        for (const dep of node.depends_on) {
          if (!this.systemMap.features[dep]) {
            errors.push({
              type: 'missing_dependency',
              message: `Node "${nodeName}" depends on "${dep}" which doesn't exist`
            });
          }
        }
      }
    }

    // Check for missing docs
    if (this.systemMap.validation?.require_docs) {
      for (const nodeName in this.systemMap.features) {
        const node = this.systemMap.features[nodeName];
        if (!node.docs || node.docs.length === 0) {
          warnings.push({
            type: 'missing_docs',
            message: `Node "${nodeName}" has no documentation files`
          });
        }
      }
    }

    // Check for missing owners
    if (this.systemMap.validation?.require_owners) {
      for (const nodeName in this.systemMap.features) {
        const node = this.systemMap.features[nodeName];
        if (!node.owners || node.owners.length === 0) {
          warnings.push({
            type: 'missing_owners',
            message: `Node "${nodeName}" has no owners assigned`
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate Mermaid graph diagram
   */
  generateMermaidGraph() {
    let mermaid = 'graph TD\n';

    for (const nodeName in this.systemMap.features) {
      const node = this.systemMap.features[nodeName];
      const nodeStyle = node.priority === 'critical' ? ':::critical' :
                       node.priority === 'high' ? ':::high' : '';

      mermaid += `  ${nodeName}[${nodeName}]${nodeStyle}\n`;

      if (node.depends_on && node.depends_on.length > 0) {
        for (const dep of node.depends_on) {
          mermaid += `  ${nodeName} --> ${dep}\n`;
        }
      }
    }

    mermaid += '\n  classDef critical fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px\n';
    mermaid += '  classDef high fill:#ffd43b,stroke:#f59f00,stroke-width:2px\n';

    return mermaid;
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

function printUsage() {
  console.log(`
📊 Graph Driven Development - Dependency Resolver

Usage:
  node scripts/resolve-graph.js <node-name> [options]
  node scripts/resolve-graph.js --validate
  node scripts/resolve-graph.js --graph

Options:
  --verbose, -v          Show detailed resolution process
  --format=<format>      Output format: text, json, mermaid
  --validate             Validate the entire system map
  --graph                Generate Mermaid graph diagram

Examples:
  node scripts/resolve-graph.js roast
  node scripts/resolve-graph.js shield --verbose
  node scripts/resolve-graph.js roast --format=json
  node scripts/resolve-graph.js --validate
  node scripts/resolve-graph.js --graph > docs/system-graph.md
  `);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const resolver = new GraphResolver(SYSTEM_MAP_PATH);

  // Validate command
  if (args.includes('--validate')) {
    console.log('🔍 Validating system map...\n');
    const validation = resolver.validate();

    if (validation.errors.length > 0) {
      console.log('❌ Errors found:\n');
      validation.errors.forEach(err => {
        console.log(`  • ${err.message}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:\n');
      validation.warnings.forEach(warn => {
        console.log(`  • ${warn.message}`);
      });
    }

    if (validation.valid && validation.warnings.length === 0) {
      console.log('✅ System map is valid!');
    }

    process.exit(validation.valid ? 0 : 1);
  }

  // Graph command
  if (args.includes('--graph')) {
    console.log(resolver.generateMermaidGraph());
    process.exit(0);
  }

  // Resolve command
  const nodeName = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));

  if (!nodeName) {
    console.error('❌ No node name provided');
    printUsage();
    process.exit(1);
  }

  try {
    if (VERBOSE) {
      console.log(`🔍 Resolving dependencies for: ${nodeName}\n`);
    }

    const result = resolver.resolve(nodeName);

    if (FORMAT === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (FORMAT === 'mermaid') {
      console.log(resolver.generateMermaidGraph());
    } else {
      // Text format
      console.log(`\n📚 Required documentation for "${nodeName}":\n`);
      result.docs.forEach((doc, i) => {
        console.log(`  ${i + 1}. ${doc}`);
      });

      console.log(`\n📊 Statistics:`);
      console.log(`  • Total nodes: ${result.stats.totalNodes}`);
      console.log(`  • Total docs: ${result.stats.uniqueDocs}`);
      console.log(`  • Max depth: ${result.stats.maxDepth}`);
      console.log(`  • Critical nodes: ${result.stats.criticalNodes}`);

      if (VERBOSE) {
        console.log(`\n🔗 Dependency chain:`);
        result.chain.forEach(item => {
          const indent = '  '.repeat(item.depth);
          console.log(`${indent}→ ${item.node} (${item.priority})`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { GraphResolver };
