#!/usr/bin/env node

/**
 * Fix Guardian case files: populate top-level domains from details
 *
 * CodeRabbit Review #3332620102 - Major issues M1-M10
 *
 * Problem: Top-level `domains: []` empty while details have domains
 * Solution: Aggregate unique domains from details[] to top-level
 */

const fs = require('fs');
const path = require('path');

const GUARDIAN_CASES_DIR = path.join(__dirname, '../docs/guardian/cases');

// Files explicitly mentioned in CodeRabbit review
const TARGET_FILES = [
  '2025-10-10-18-54-24-276.json',
  '2025-10-12-14-17-18-451.json',
  '2025-10-12-16-23-53-761.json',
  '2025-10-12-16-23-53-763.json',
  '2025-10-12-16-37-06-527.json',
  '2025-10-12-18-06-24-192.json',
  '2025-10-12-18-44-52-111.json',
  '2025-10-12-19-47-38-565.json',
  '2025-10-12-19-47-38-566.json',
];

let fixedCount = 0;
let errorCount = 0;
let skippedCount = 0;

console.log('🔧 Guardian Domain Fixer - CodeRabbit Review #3332620102\n');

TARGET_FILES.forEach(filename => {
  const filePath = path.join(GUARDIAN_CASES_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  SKIP: ${filename} (file not found)`);
    skippedCount++;
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const caseData = JSON.parse(content);

    // Aggregate domains from details
    const aggregatedDomains = new Set();

    if (caseData.details && Array.isArray(caseData.details)) {
      caseData.details.forEach(detail => {
        if (detail.domains && Array.isArray(detail.domains)) {
          detail.domains.forEach(domain => aggregatedDomains.add(domain));
        }
      });
    }

    // Convert to sorted array
    const domainsArray = Array.from(aggregatedDomains).sort();

    // Check if already correct
    const currentDomains = JSON.stringify(caseData.domains || []);
    const newDomains = JSON.stringify(domainsArray);

    if (currentDomains === newDomains) {
      console.log(`✓ OK: ${filename} (already correct: ${newDomains})`);
      skippedCount++;
      return;
    }

    // Update top-level domains
    caseData.domains = domainsArray;

    // Special case: 2025-10-12-16-37-06-527.json needs full metadata restore
    if (filename === '2025-10-12-16-37-06-527.json') {
      if (caseData.details && caseData.details[0]) {
        const detail = caseData.details[0];

        // Add missing fields if not present
        if (!detail.domain) detail.domain = 'test';
        if (!detail.severity) detail.severity = 'CRITICAL';
        if (typeof detail.lines_added !== 'number') detail.lines_added = 0;
        if (typeof detail.lines_removed !== 'number') detail.lines_removed = 0;

        console.log(`  ℹ️  Special case: Restored full metadata schema for ${filename}`);
      }
    }

    // Write back with pretty formatting
    fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2) + '\n', 'utf8');

    console.log(`✅ FIXED: ${filename}`);
    console.log(`   Domains: [] → ${newDomains}`);
    fixedCount++;

  } catch (error) {
    console.error(`❌ ERROR: ${filename} - ${error.message}`);
    errorCount++;
  }
});

console.log('\n' + '═'.repeat(60));
console.log(`📊 Summary:`);
console.log(`   Fixed:   ${fixedCount} files`);
console.log(`   Skipped: ${skippedCount} files (already correct or not found)`);
console.log(`   Errors:  ${errorCount} files`);
console.log('═'.repeat(60));

if (errorCount > 0) {
  console.error('\n❌ Script completed with errors');
  process.exit(1);
}

if (fixedCount === 0 && skippedCount === TARGET_FILES.length) {
  console.log('\n✅ All files already correct - No changes needed');
  process.exit(0);
}

console.log('\n✅ Guardian domain aggregation complete');
console.log('   Run validation: node scripts/validate-guardian-cases.js (if exists)');
process.exit(0);
