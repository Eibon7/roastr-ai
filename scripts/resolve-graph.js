#!/usr/bin/env node
/**
 * Graph Driven Development (GDD) - Dependency Graph Resolver
 *
 * Resolves documentation dependencies from system-map.yaml and generates
 * optimized context loading for Claude Code agents.
 *
 * Features:
 * - Dependency resolution with cycle detection
 * - Graph validation (circular deps, missing deps, missing docs)
 * - Mermaid visualization generation
 * - Multiple output formats (text, JSON, Mermaid)
 * - Verbose mode for debugging
 *
 * Usage:
 *   node scripts/resolve-graph.js <node-name>           # Resolve dependencies
 *   node scripts/resolve-graph.js --validate            # Validate graph
 *   node scripts/resolve-graph.js --graph               # Generate Mermaid diagram
 *   node scripts/resolve-graph.js roast --verbose       # Verbose output
 *   node scripts/resolve-graph.js roast --format=json   # JSON output
 *
 * Examples:
 *   node scripts/resolve-graph.js roast
 *   node scripts/resolve-graph.js shield --verbose
 *   node scripts/resolve-graph.js --validate
 *   node scripts/resolve-graph.js --graph > docs/system-graph.mmd
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class GraphResolver {
  constructor(systemMapPath) {
    this.systemMapPath = systemMapPath;
    this.systemMap = this.loadSystemMap();
    this.visited = new Set();
    this.resolvedDocs = [];
    this.dependencyChain = [];
  }

  /**
   * Load and parse system-map.yaml
   */
  loadSystemMap() {
    try {
      const content = fs.readFileSync(this.systemMapPath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      console.error(`${colors.red}Error loading system map:${colors.reset}`, error.message);
      process.exit(1);
    }
  }

  /**
   * Resolve all dependencies for a given node
   * @param {string} nodeName - Name of the node to resolve
   * @returns {Object} - Resolved docs and dependency chain
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
      chain: this.dependencyChain
    };
  }

  /**
   * Traverse dependency graph depth-first
   * @param {string} nodeName - Current node
   * @param {number} depth - Current depth (for visualization)
   */
  traverse(nodeName, depth) {
    // Detect cycles
    if (this.visited.has(nodeName)) {
      throw new Error(`Circular dependency detected: ${nodeName} appears in its own dependency chain`);
    }

    const node = this.systemMap.features[nodeName];
    if (!node) {
      throw new Error(`Node "${nodeName}" not found in system map`);
    }

    this.visited.add(nodeName);
    this.dependencyChain.push({ name: nodeName, depth });

    // Recursively resolve dependencies
    if (node.depends_on && node.depends_on.length > 0) {
      for (const dep of node.depends_on) {
        this.traverse(dep, depth + 1);
      }
    }

    // Add docs from this node
    if (node.docs && node.docs.length > 0) {
      this.resolvedDocs.push(...node.docs);
    }

    this.visited.delete(nodeName);
  }

  /**
   * Validate the entire graph for common issues
   * @returns {Object} - Validation results
   */
  validate() {
    const issues = {
      circularDeps: [],
      missingDeps: [],
      missingDocs: [],
      orphanedNodes: []
    };

    // Check each node
    for (const [nodeName, node] of Object.entries(this.systemMap.features)) {
      // Check for circular dependencies
      try {
        this.resolve(nodeName);
      } catch (error) {
        if (error.message.includes('Circular dependency')) {
          issues.circularDeps.push({
            node: nodeName,
            error: error.message
          });
        }
      }

      // Check for missing dependencies
      if (node.depends_on && node.depends_on.length > 0) {
        for (const dep of node.depends_on) {
          if (!this.systemMap.features[dep]) {
            issues.missingDeps.push({
              node: nodeName,
              missingDep: dep
            });
          }
        }
      }

      // Check for missing documentation files
      if (node.docs && node.docs.length > 0) {
        for (const docPath of node.docs) {
          const fullPath = path.join(process.cwd(), docPath);
          if (!fs.existsSync(fullPath)) {
            issues.missingDocs.push({
              node: nodeName,
              missingDoc: docPath
            });
          }
        }
      }

      // Check for orphaned nodes (no incoming dependencies)
      const hasIncoming = Object.values(this.systemMap.features).some(
        otherNode => otherNode.depends_on && otherNode.depends_on.includes(nodeName)
      );
      if (!hasIncoming && node.depends_on && node.depends_on.length > 0) {
        // This is a leaf node with dependencies - OK
      } else if (!hasIncoming && (!node.depends_on || node.depends_on.length === 0)) {
        // This is a root node - also OK
      }
    }

    return issues;
  }

  /**
   * Generate Mermaid diagram of the dependency graph
   * @returns {string} - Mermaid diagram code
   */
  generateMermaidDiagram() {
    let mermaid = 'graph TD\n';

    // Add nodes with styling based on priority
    for (const [nodeName, node] of Object.entries(this.systemMap.features)) {
      const label = nodeName.replace(/-/g, '_');
      const priority = node.priority || 'medium';
      const status = node.status || 'active';

      let styleClass = '';
      if (priority === 'critical') {
        styleClass = ':::critical';
      } else if (priority === 'high') {
        styleClass = ':::high';
      } else if (status === 'planned') {
        styleClass = ':::planned';
      }

      mermaid += `  ${label}["${nodeName}"${styleClass}]\n`;
    }

    // Add dependencies
    mermaid += '\n';
    for (const [nodeName, node] of Object.entries(this.systemMap.features)) {
      const label = nodeName.replace(/-/g, '_');

      if (node.depends_on && node.depends_on.length > 0) {
        for (const dep of node.depends_on) {
          const depLabel = dep.replace(/-/g, '_');
          mermaid += `  ${label} --> ${depLabel}\n`;
        }
      }
    }

    // Add styling
    mermaid += `\n`;
    mermaid += `  classDef critical fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px,color:#fff\n`;
    mermaid += `  classDef high fill:#ffd43b,stroke:#fab005,stroke-width:2px\n`;
    mermaid += `  classDef planned fill:#e9ecef,stroke:#adb5bd,stroke-width:1px,stroke-dasharray: 5 5\n`;

    return mermaid;
  }

  /**
   * Print resolution results to console
   * @param {string} nodeName - Node that was resolved
   * @param {Object} result - Resolution result
   * @param {boolean} verbose - Whether to print verbose output
   */
  printResolution(nodeName, result, verbose = false) {
    console.log(`\n${colors.bright}${colors.cyan}📊 Dependency Resolution for: ${nodeName}${colors.reset}\n`);

    // Print dependency chain
    console.log(`${colors.bright}Dependency Chain:${colors.reset}`);
    for (const { name, depth } of result.chain) {
      const indent = '  '.repeat(depth);
      const arrow = depth > 0 ? '└─ ' : '';
      console.log(`${indent}${arrow}${colors.green}${name}${colors.reset}`);
    }

    // Print resolved docs
    console.log(`\n${colors.bright}Resolved Documentation Files (${result.docs.length}):${colors.reset}`);
    for (const doc of result.docs) {
      const exists = fs.existsSync(path.join(process.cwd(), doc));
      const status = exists ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
      console.log(`  ${status} ${doc}`);
    }

    // Print statistics
    const totalLines = this.estimateTotalLines(result.docs);
    const estimatedTokens = Math.ceil(totalLines * 4); // Rough estimate: 4 tokens per line

    console.log(`\n${colors.bright}Statistics:${colors.reset}`);
    console.log(`  Total Nodes: ${result.chain.length}`);
    console.log(`  Total Docs: ${result.docs.length}`);
    console.log(`  Estimated Lines: ${totalLines}`);
    console.log(`  Estimated Tokens: ${estimatedTokens}`);

    // Verbose output
    if (verbose) {
      console.log(`\n${colors.dim}Verbose Output:${colors.reset}`);
      console.log(JSON.stringify(result, null, 2));
    }
  }

  /**
   * Estimate total lines in all resolved docs
   * @param {Array<string>} docs - List of document paths
   * @returns {number} - Estimated total lines
   */
  estimateTotalLines(docs) {
    let totalLines = 0;
    for (const doc of docs) {
      const fullPath = path.join(process.cwd(), doc);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        totalLines += content.split('\n').length;
      }
    }
    return totalLines;
  }

  /**
   * Print validation results to console
   * @param {Object} issues - Validation issues
   */
  printValidation(issues) {
    console.log(`\n${colors.bright}${colors.cyan}🔍 Graph Validation Results${colors.reset}\n`);

    let hasIssues = false;

    // Circular dependencies
    if (issues.circularDeps.length > 0) {
      hasIssues = true;
      console.log(`${colors.red}❌ Circular Dependencies (${issues.circularDeps.length}):${colors.reset}`);
      for (const issue of issues.circularDeps) {
        console.log(`  - ${issue.node}: ${issue.error}`);
      }
      console.log();
    }

    // Missing dependencies
    if (issues.missingDeps.length > 0) {
      hasIssues = true;
      console.log(`${colors.yellow}⚠️  Missing Dependencies (${issues.missingDeps.length}):${colors.reset}`);
      for (const issue of issues.missingDeps) {
        console.log(`  - ${issue.node} depends on non-existent node: ${issue.missingDep}`);
      }
      console.log();
    }

    // Missing documentation files
    if (issues.missingDocs.length > 0) {
      hasIssues = true;
      console.log(`${colors.yellow}⚠️  Missing Documentation Files (${issues.missingDocs.length}):${colors.reset}`);
      for (const issue of issues.missingDocs) {
        console.log(`  - ${issue.node}: ${issue.missingDoc}`);
      }
      console.log();
    }

    // Summary
    if (!hasIssues) {
      console.log(`${colors.green}✅ Graph validation passed! No issues found.${colors.reset}\n`);
    } else {
      console.log(`${colors.red}❌ Graph validation failed with ${issues.circularDeps.length + issues.missingDeps.length + issues.missingDocs.length} issues.${colors.reset}\n`);
      process.exit(1);
    }
  }
}

// CLI Entry Point
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let nodeName = null;
  let verbose = false;
  let format = 'text';
  let mode = 'resolve'; // resolve, validate, graph

  for (const arg of args) {
    if (arg === '--validate') {
      mode = 'validate';
    } else if (arg === '--graph') {
      mode = 'graph';
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg.startsWith('--format=')) {
      format = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      nodeName = arg;
    }
  }

  const systemMapPath = path.join(process.cwd(), 'docs', 'system-map.yaml');
  const resolver = new GraphResolver(systemMapPath);

  try {
    if (mode === 'validate') {
      // Validate entire graph
      const issues = resolver.validate();
      resolver.printValidation(issues);
    } else if (mode === 'graph') {
      // Generate Mermaid diagram
      const mermaid = resolver.generateMermaidDiagram();
      console.log(mermaid);
    } else {
      // Resolve dependencies for specific node
      if (!nodeName) {
        console.error(`${colors.red}Error: Node name required${colors.reset}`);
        console.log('Usage: node scripts/resolve-graph.js <node-name> [--verbose] [--format=json|text]');
        process.exit(1);
      }

      const result = resolver.resolve(nodeName);

      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        resolver.printResolution(nodeName, result, verbose);
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
${colors.bright}Graph Driven Development (GDD) - Dependency Graph Resolver${colors.reset}

${colors.bright}USAGE:${colors.reset}
  node scripts/resolve-graph.js <node-name> [options]
  node scripts/resolve-graph.js --validate
  node scripts/resolve-graph.js --graph

${colors.bright}OPTIONS:${colors.reset}
  --validate              Validate entire graph for issues
  --graph                 Generate Mermaid diagram of dependencies
  --verbose, -v           Enable verbose output
  --format=<format>       Output format (text, json)
  --help, -h              Show this help message

${colors.bright}EXAMPLES:${colors.reset}
  ${colors.dim}# Resolve dependencies for roast node${colors.reset}
  node scripts/resolve-graph.js roast

  ${colors.dim}# Resolve with verbose output${colors.reset}
  node scripts/resolve-graph.js shield --verbose

  ${colors.dim}# Validate entire graph${colors.reset}
  node scripts/resolve-graph.js --validate

  ${colors.dim}# Generate Mermaid diagram${colors.reset}
  node scripts/resolve-graph.js --graph > docs/system-graph.mmd

  ${colors.dim}# JSON output for automation${colors.reset}
  node scripts/resolve-graph.js roast --format=json
`);
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}

module.exports = { GraphResolver };
