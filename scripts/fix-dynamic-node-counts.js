#!/usr/bin/env node
/**
 * Fix #1: Make node counts dynamic in ROA-258-COMPARISON-SUMMARY.md
 * 
 * Parses docs/system-map-v2.yaml and replaces hardcoded numbers
 * with dynamic values computed from the actual system map.
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SYSTEM_MAP_V2_PATH = path.join(ROOT_DIR, 'docs/system-map-v2.yaml');
const COMPARISON_SUMMARY_PATH = path.join(ROOT_DIR, 'docs/ROA-258-COMPARISON-SUMMARY.md');

function loadSystemMapV2() {
  try {
    const content = fs.readFileSync(SYSTEM_MAP_V2_PATH, 'utf8');
    return yaml.load(content);
  } catch (e) {
    throw new Error(`Error loading system-map-v2.yaml: ${e.message}`);
  }
}

function computeDynamicCounts(systemMap) {
  const nodes = systemMap.nodes || {};
  const nodeNames = Object.keys(nodes);
  
  const totalNodes = nodeNames.length;
  
  const criticalNodes = nodeNames.filter(nodeName => {
    const node = nodes[nodeName];
    return node && node.priority === 'critical';
  }).length;
  
  return {
    totalNodes,
    criticalNodes
  };
}

function updateComparisonSummary(counts) {
  let content = fs.readFileSync(COMPARISON_SUMMARY_PATH, 'utf8');
  
  // Replace hardcoded "25" with dynamic totalNodes
  // Look for the pattern in the table row for "Total Nodes"
  content = content.replace(
    /\|\s*\*\*Total Nodes\*\*\s*\|\s*15\s*\|\s*\d+\s*\|\s*[+-]?\d+\s*\|/,
    `| **Total Nodes** | 15 | ${counts.totalNodes} | ${counts.totalNodes - 15} |`
  );
  
  // Replace hardcoded "12" with dynamic criticalNodes
  // Look for the pattern in the table row for "Critical Nodes"
  content = content.replace(
    /\|\s*\*\*Critical Nodes\*\*\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*[+-]?\d+\s*\|/,
    `| **Critical Nodes** | 9 | ${counts.criticalNodes} | ${counts.criticalNodes - 9} |`
  );
  
  fs.writeFileSync(COMPARISON_SUMMARY_PATH, content, 'utf8');
  
  console.log('✅ Updated ROA-258-COMPARISON-SUMMARY.md with dynamic counts:');
  console.log(`   Total Nodes: ${counts.totalNodes}`);
  console.log(`   Critical Nodes: ${counts.criticalNodes}`);
}

function main() {
  try {
    console.log('📊 Loading system-map-v2.yaml...');
    const systemMap = loadSystemMapV2();
    
    console.log('🔢 Computing dynamic counts...');
    const counts = computeDynamicCounts(systemMap);
    
    console.log('📝 Updating ROA-258-COMPARISON-SUMMARY.md...');
    updateComparisonSummary(counts);
    
    console.log('✅ Fix #1 completed successfully!');
    return counts;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { loadSystemMapV2, computeDynamicCounts, updateComparisonSummary };

