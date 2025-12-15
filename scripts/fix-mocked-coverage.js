#!/usr/bin/env node
/**
 * Fix invalid "Coverage Source: mocked" in GDD nodes
 * Replace with "Coverage Source: auto"
 *
 * ⚠️ DEPRECATED: This script references legacy v1 nodes in docs/nodes/
 * These files have been moved to docs/legacy/v1/nodes/ (Issue ROA-329)
 * This script is kept for historical reference only and should NOT be used.
 * Use docs/nodes-v2/ instead.
 */

const fs = require('fs');
const path = require('path');

// ⚠️ DEPRECATED: Legacy v1 nodes - DO NOT USE
// These files are in docs/legacy/v1/nodes/ and should not be modified
const files = [
  'docs/legacy/v1/nodes/billing.md',
  'docs/legacy/v1/nodes/cost-control.md',
  'docs/legacy/v1/nodes/guardian.md',
  'docs/legacy/v1/nodes/multi-tenant.md',
  'docs/legacy/v1/nodes/persona.md',
  'docs/legacy/v1/nodes/platform-constraints.md',
  'docs/legacy/v1/nodes/queue-system.md',
  'docs/legacy/v1/nodes/tone.md',
  'docs/legacy/v1/nodes/trainer.md'
];

let fixed = 0;

files.forEach((filePath) => {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const newContent = content.replace(
    /\*\*Coverage Source:\*\* mocked/g,
    '**Coverage Source:** auto'
  );

  if (content !== newContent) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`✓ Fixed ${filePath}`);
    fixed++;
  } else {
    console.log(`— ${filePath} (no changes needed)`);
  }
});

console.log(`\nTotal files fixed: ${fixed}/${files.length}`);
