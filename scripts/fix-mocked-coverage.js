#!/usr/bin/env node
/**
 * Fix invalid "Coverage Source: mocked" in GDD nodes
 * Replace with "Coverage Source: auto"
 */

const fs = require('fs');
const path = require('path');

const files = [
  'docs/nodes/billing.md',
  'docs/nodes/cost-control.md',
  'docs/nodes/guardian.md',
  'docs/nodes/multi-tenant.md',
  'docs/nodes/persona.md',
  'docs/nodes/platform-constraints.md',
  'docs/nodes/queue-system.md',
  'docs/nodes/tone.md',
  'docs/nodes/trainer.md'
];

let fixed = 0;

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const newContent = content.replace(/\*\*Coverage Source:\*\* mocked/g, '**Coverage Source:** auto');

  if (content !== newContent) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`✓ Fixed ${filePath}`);
    fixed++;
  } else {
    console.log(`— ${filePath} (no changes needed)`);
  }
});

console.log(`\nTotal files fixed: ${fixed}/${files.length}`);
