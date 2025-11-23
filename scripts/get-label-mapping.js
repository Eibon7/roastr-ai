#!/usr/bin/env node

/**
 * Dynamic Label → Node Mapping Generator
 *
 * Generates mapping between GitHub issue labels and GDD nodes.
 * Usage: node scripts/get-label-mapping.js [--format=table|compact|json]
 */

const fs = require('fs').promises;
const path = require('path');

// Label → Nodes mapping
// Based on GDD architecture and issue labeling conventions
const LABEL_TO_NODES = {
  // Core functionality areas
  'area:api': ['roast', 'multi-tenant'],
  'area:workers': ['queue-system', 'multi-tenant'],
  'area:auth': ['multi-tenant'],
  'area:cost': ['cost-control', 'billing'],
  'area:shield': ['shield', 'guardian'],
  'area:integrations': ['social-platforms'],
  'area:database': ['multi-tenant'],
  'area:frontend': ['persona', 'tone'],
  'area:observability': ['observability', 'analytics'],

  // Feature-specific
  'feature:roast': ['roast', 'persona', 'tone'],
  'feature:moderation': ['shield', 'guardian'],
  'feature:billing': ['billing', 'cost-control', 'plan-features'],
  'feature:analytics': ['analytics', 'observability'],

  // Testing & E2E
  'test:e2e': ['observability'], // spec.md required for E2E context
  'test:integration': ['queue-system', 'multi-tenant'],
  'test:unit': [], // Determined by files changed

  // Priority (no specific nodes, but useful for task assessment)
  'priority:critical': [],
  'priority:high': [],
  'priority:medium': [],
  'priority:low': []
};

// Keyword fallback mapping (when no area:* label exists)
const KEYWORD_TO_NODES = {
  worker: ['queue-system', 'multi-tenant'],
  queue: ['queue-system'],
  auth: ['multi-tenant'],
  authentication: ['multi-tenant'],
  login: ['multi-tenant'],
  billing: ['billing', 'cost-control'],
  payment: ['billing', 'plan-features'],
  roast: ['roast', 'persona', 'tone'],
  shield: ['shield', 'guardian'],
  moderation: ['shield', 'guardian'],
  platform: ['social-platforms'],
  twitter: ['social-platforms'],
  youtube: ['social-platforms'],
  instagram: ['social-platforms'],
  facebook: ['social-platforms'],
  discord: ['social-platforms'],
  integration: ['social-platforms'],
  cost: ['cost-control', 'billing'],
  analytics: ['analytics', 'observability'],
  monitoring: ['observability'],
  telemetry: ['observability'],
  persona: ['persona', 'roast'],
  tone: ['tone', 'roast'],
  plan: ['plan-features', 'billing'],
  subscription: ['plan-features', 'billing'],
  trainer: ['trainer'],
  guardian: ['guardian', 'shield'],
  constraint: ['platform-constraints']
};

/**
 * Get all available GDD nodes
 */
async function getAllNodes() {
  const nodesDir = path.join(__dirname, '..', 'docs', 'nodes');
  const files = await fs.readdir(nodesDir);
  return files
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''))
    .sort();
}

/**
 * Format output as table
 */
function formatAsTable(mapping) {
  console.log('\n📋 GitHub Label → GDD Nodes Mapping\n');
  console.log('| Label | Nodes |');
  console.log('|-------|-------|');

  Object.entries(mapping).forEach(([label, nodes]) => {
    const nodesList = nodes.length > 0 ? nodes.join(', ') : '(none)';
    console.log(`| \`${label}\` | ${nodesList} |`);
  });

  console.log('\n📚 Keyword Fallback → GDD Nodes\n');
  console.log('| Keyword | Nodes |');
  console.log('|---------|-------|');

  Object.entries(KEYWORD_TO_NODES).forEach(([keyword, nodes]) => {
    const nodesList = nodes.length > 0 ? nodes.join(', ') : '(none)';
    console.log(`| \`${keyword}\` | ${nodesList} |`);
  });
}

/**
 * Format output as compact (for CLAUDE.md)
 */
function formatAsCompact(mapping) {
  console.log('\n**Label → Nodes:**');

  const parts = Object.entries(mapping)
    .filter(([_, nodes]) => nodes.length > 0) // Skip empty mappings
    .map(([label, nodes]) => `${label}→${nodes.join(',')}`)
    .join(' | ');

  console.log(parts);

  console.log('\n**Keyword Fallback:**');
  const keywordParts = Object.entries(KEYWORD_TO_NODES)
    .slice(0, 10) // Show first 10 only
    .map(([keyword, nodes]) => `"${keyword}"→${nodes.join(',')}`)
    .join(' | ');

  console.log(keywordParts + ' ...');
}

/**
 * Format output as JSON
 */
function formatAsJson(mapping, keywords) {
  const output = {
    labelToNodes: mapping,
    keywordToNodes: keywords,
    meta: {
      totalLabels: Object.keys(mapping).length,
      totalKeywords: Object.keys(keywords).length,
      generatedAt: new Date().toISOString()
    }
  };
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Validate that all referenced nodes exist
 */
async function validateMapping() {
  const availableNodes = await getAllNodes();
  const errors = [];

  // Check label mappings
  Object.entries(LABEL_TO_NODES).forEach(([label, nodes]) => {
    nodes.forEach((node) => {
      if (!availableNodes.includes(node)) {
        errors.push(`Label "${label}" references non-existent node: ${node}`);
      }
    });
  });

  // Check keyword mappings
  Object.entries(KEYWORD_TO_NODES).forEach(([keyword, nodes]) => {
    nodes.forEach((node) => {
      if (!availableNodes.includes(node)) {
        errors.push(`Keyword "${keyword}" references non-existent node: ${node}`);
      }
    });
  });

  if (errors.length > 0) {
    console.error('\n⚠️  Validation Errors:\n');
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('\n✅ Validation passed: All node references are valid\n');
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const format = args.find((a) => a.startsWith('--format='))?.split('=')[1] || 'table';
  const validate = args.includes('--validate');

  if (validate) {
    await validateMapping();
    return;
  }

  const availableNodes = await getAllNodes();
  console.log(`\n📦 Found ${availableNodes.length} GDD nodes\n`);

  switch (format) {
    case 'compact':
      formatAsCompact(LABEL_TO_NODES);
      break;
    case 'json':
      formatAsJson(LABEL_TO_NODES, KEYWORD_TO_NODES);
      break;
    case 'table':
    default:
      formatAsTable(LABEL_TO_NODES);
      break;
  }

  console.log(`\n💡 Usage:
  node scripts/get-label-mapping.js --format=table    # Table format (default)
  node scripts/get-label-mapping.js --format=compact  # Compact for docs
  node scripts/get-label-mapping.js --format=json     # JSON output
  node scripts/get-label-mapping.js --validate        # Validate mappings\n`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
