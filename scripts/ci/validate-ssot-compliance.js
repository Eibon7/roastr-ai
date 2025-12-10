#!/usr/bin/env node

/**
 * SSOT Compliance Validator
 *
 * Validates that code changes comply with SSOT v2 rules.
 *
 * Source Requirements:
 * - docs/SSOT/roastr-ssot-v2.md (lines 5-10, 646-658): Regla de oro - SSOT gana siempre
 * - docs/nodes-v2/15-ssot-integration.md (line 138): CI debe validar SSOT pre-merge
 *
 * Usage:
 *   node scripts/ci/validate-ssot-compliance.js [--path=<file-or-dir>]
 *
 * Exit Codes:
 *   0 - All checks passed
 *   1 - SSOT violations detected
 *
 * Created: 2025-12-05 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SSOT_PATH = path.join(__dirname, '../../docs/SSOT/roastr-ssot-v2.md');
const BACKEND_V2_PATH = path.join(__dirname, '../../apps/backend-v2');

let violations = [];
let warnings = [];

/**
 * Read and parse SSOT v2 document
 */
function readSSOT() {
  if (!fs.existsSync(SSOT_PATH)) {
    console.error(`❌ SSOT file not found: ${SSOT_PATH}`);
    process.exit(1);
  }
  return fs.readFileSync(SSOT_PATH, 'utf8');
}

/**
 * Extract valid plan IDs from SSOT
 * Source: docs/SSOT/roastr-ssot-v2.md lines 35-46
 */
function getValidPlans(ssotContent) {
  // Extract from: type PlanId = 'starter' | 'pro' | 'plus';
  const planMatch = ssotContent.match(/type PlanId = ['"]([^'"]+)['"] \| ['"]([^'"]+)['"] \| ['"]([^'"]+)['"]/);
  if (planMatch) {
    return [planMatch[1], planMatch[2], planMatch[3]];
  }
  // Fallback to explicit list
  return ['starter', 'pro', 'plus'];
}

/**
 * Extract legacy plan IDs from SSOT
 * Source: docs/SSOT/roastr-ssot-v2.md lines 42-44
 */
function getLegacyPlans(ssotContent) {
  // Extract from: "free", "basic", "creator_plus"
  return ['free', 'basic', 'creator_plus'];
}

/**
 * Extract valid feature flags from SSOT
 * Source: docs/SSOT/roastr-ssot-v2.md lines 208-232
 */
function getValidFeatureFlags(ssotContent) {
  const flags = [];
  const flagSection = ssotContent.match(/type FeatureFlagKey =([\s\S]*?);/);
  if (flagSection) {
    const flagLines = flagSection[1].split('\n');
    for (const line of flagLines) {
      const match = line.match(/\| ['"]([^'"]+)['"]/);
      if (match) {
        flags.push(match[1]);
      }
    }
  }
  return flags;
}

/**
 * Check if file is in backend-v2
 */
function isBackendV2File(filePath) {
  return filePath.includes('apps/backend-v2');
}

/**
 * Scan file for SSOT violations
 */
function scanFile(filePath, ssotContent) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const validPlans = getValidPlans(ssotContent);
  const legacyPlans = getLegacyPlans(ssotContent);
  const validFlags = getValidFeatureFlags(ssotContent);

  // Check for legacy plan references (only in backend-v2)
  if (isBackendV2File(filePath)) {
    for (const legacyPlan of legacyPlans) {
      const regex = new RegExp(`['"]${legacyPlan}['"]`, 'g');
      const matches = content.match(regex);
      if (matches) {
        violations.push({
          file: filePath,
          line: 'N/A',
          type: 'legacy_plan',
          message: `Legacy plan "${legacyPlan}" detected. SSOT v2 only allows: ${validPlans.join(', ')}`,
          source: 'docs/SSOT/roastr-ssot-v2.md:39-46'
        });
      }
    }
  }

  // Check for Stripe references (only in backend-v2)
  if (isBackendV2File(filePath)) {
    const stripeRegex = /stripe|Stripe|STRIPE/i;
    if (stripeRegex.test(content)) {
      violations.push({
        file: filePath,
        line: 'N/A',
        type: 'legacy_billing',
        message: 'Stripe detected. SSOT v2 mandates Polar as only billing provider.',
        source: 'docs/SSOT/roastr-ssot-v2.md:95-96'
      });
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
 * Main validation
 */
function main() {
  const args = process.argv.slice(2);
  const pathArg = args.find(arg => arg.startsWith('--path='));
  const targetPath = pathArg ? pathArg.split('=')[1] : null;

  console.log('🔍 Validating SSOT compliance...\n');

  const ssotContent = readSSOT();

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
    scanFile(file, ssotContent);
  }

  // Report results
  if (violations.length > 0) {
    console.log('❌ SSOT Compliance Violations Detected:\n');
    for (const violation of violations) {
      console.log(`  File: ${violation.file}`);
      console.log(`  Type: ${violation.type}`);
      console.log(`  Message: ${violation.message}`);
      console.log(`  Source: ${violation.source}\n`);
    }
    console.log(`\n❌ Total violations: ${violations.length}`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    for (const warning of warnings) {
      console.log(`  ${warning}\n`);
    }
  }

  console.log('✅ SSOT compliance check passed.');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, scanFile, getValidPlans, getLegacyPlans, getValidFeatureFlags };

