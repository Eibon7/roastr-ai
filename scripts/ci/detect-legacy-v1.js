#!/usr/bin/env node

/**
 * Legacy v1 Detector
 *
 * Detects references to legacy v1 elements (plans, billing) in code v2.
 *
 * Source Requirements:
 * - docs/SSOT/roastr-ssot-v2.md (lines 39-46): Legacy plans prohibited
 * - docs/SSOT/roastr-ssot-v2.md (lines 95-96): Stripe prohibited, only Polar allowed
 * - docs/nodes-v2/15-ssot-integration.md (lines 78-80): CI must detect and reject legacy v1
 *
 * Usage:
 *   node scripts/ci/detect-legacy-v1.js [--path=<file-or-dir>]
 *
 * Exit Codes:
 *   0 - No legacy v1 references found
 *   1 - Legacy v1 references detected
 *
 * Created: 2025-12-05 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKEND_V2_PATH = path.join(__dirname, '../../apps/backend-v2');

// Legacy plans from SSOT v2
// Source: docs/SSOT/roastr-ssot-v2.md lines 42-44
const LEGACY_PLANS = ['free', 'basic', 'creator_plus'];

// Legacy billing providers
// Source: docs/SSOT/roastr-ssot-v2.md lines 95-96
const LEGACY_BILLING = ['stripe', 'Stripe', 'STRIPE'];

let violations = [];

/**
 * Check if file is in backend-v2
 */
function isBackendV2File(filePath) {
  return filePath.includes('apps/backend-v2');
}

/**
 * Scan file for legacy v1 references
 */
function scanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Only check backend-v2 files
  if (!isBackendV2File(filePath)) {
    return;
  }

  // Check for legacy plans
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const legacyPlan of LEGACY_PLANS) {
      // Match quoted strings and type definitions
      const regex = new RegExp(`['"]${legacyPlan}['"]|\\b${legacyPlan}\\b`, 'gi');
      if (regex.test(line)) {
        violations.push({
          file: filePath,
          line: lineNum,
          type: 'legacy_plan',
          message: `Legacy plan "${legacyPlan}" detected. SSOT v2 only allows: starter, pro, plus (no starter_trial in SSOT v2)`,
          source: 'docs/SSOT/roastr-ssot-v2.md:39-46',
          code: line.trim()
        });
      }
    }

    // Check for Stripe references
    for (const stripeRef of LEGACY_BILLING) {
      if (line.includes(stripeRef) && !line.includes('// legacy') && !line.includes('// v1')) {
        violations.push({
          file: filePath,
          line: lineNum,
          type: 'legacy_billing',
          message: `Stripe reference detected. SSOT v2 mandates Polar as only billing provider.`,
          source: 'docs/SSOT/roastr-ssot-v2.md:95-96',
          code: line.trim()
        });
      }
    }
  }
}

/**
 * Get changed files from git
 */
function getChangedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD origin/main 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || echo ""', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return output.trim().split('\n').filter(f => f && f.length > 0);
  } catch (error) {
    return [];
  }
}

/**
 * Main detection
 */
function main() {
  const args = process.argv.slice(2);
  const pathArg = args.find(arg => arg.startsWith('--path='));
  const targetPath = pathArg ? pathArg.split('=')[1] : null;

  console.log('🔍 Detecting legacy v1 references...\n');

  let filesToCheck = [];

  if (targetPath) {
    const fullPath = path.resolve(targetPath);
    if (fs.statSync(fullPath).isDirectory()) {
      // Recursively find all JS/TS files
      function findFiles(dir) {
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...findFiles(fullPath));
          } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
            files.push(fullPath);
          }
        }
        return files;
      }
      filesToCheck = findFiles(fullPath);
    } else {
      filesToCheck = [fullPath];
    }
  } else {
    // Check changed files in backend-v2
    const changedFiles = getChangedFiles();
    filesToCheck = changedFiles
      .filter(f => f.includes('apps/backend-v2'))
      .map(f => path.resolve(f));
  }

  if (filesToCheck.length === 0) {
    console.log('ℹ️  No files to check.');
    process.exit(0);
  }

  console.log(`📁 Checking ${filesToCheck.length} file(s)...\n`);

  for (const file of filesToCheck) {
    scanFile(file);
  }

  // Report results
  if (violations.length > 0) {
    console.log('❌ Legacy v1 References Detected:\n');
    for (const violation of violations) {
      console.log(`  File: ${violation.file}`);
      console.log(`  Line: ${violation.line}`);
      console.log(`  Type: ${violation.type}`);
      console.log(`  Message: ${violation.message}`);
      console.log(`  Source: ${violation.source}`);
      console.log(`  Code: ${violation.code}\n`);
    }
    console.log(`\n❌ Total violations: ${violations.length}`);
    console.log('\n⚠️  Legacy v1 elements are prohibited in code v2.');
    console.log('   Update code to use v2 equivalents or mark as legacy with explicit comment.');
    process.exit(1);
  }

  console.log('✅ No legacy v1 references found.');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, scanFile, LEGACY_PLANS, LEGACY_BILLING };

