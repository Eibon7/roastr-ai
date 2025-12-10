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

/**
 * Recursively find all JS/TS files in a directory
 */
function findFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const normalizedPath = entryPath.replace(/\\/g, '/');
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...findFiles(entryPath));
    } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
      files.push(normalizedPath);
    }
  }
  return files;
}

/**
 * Read and parse SSOT v2 document
 */
function readSSOT() {
  if (!fs.existsSync(SSOT_PATH)) {
    console.error(`❌ SSOT file not found: ${SSOT_PATH}`);
    process.exit(1);
  }
  try {
    return fs.readFileSync(SSOT_PATH, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading SSOT file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Extract valid plan IDs from SSOT
 * Source: docs/SSOT/roastr-ssot-v2.md lines 35-46
 */
function getValidPlans(ssotContent) {
  // Extract from: type PlanId = 'starter' | 'pro' | 'plus';
  // Source: docs/SSOT/roastr-ssot-v2.md lines 35-36
  const planMatch = ssotContent.match(/type PlanId = ['"]([^'"]+)['"] \| ['"]([^'"]+)['"] \| ['"]([^'"]+)['"]/);
  if (planMatch) {
    return [planMatch[1], planMatch[2], planMatch[3]];
  }
  // If parsing fails, this is a validation error - SSOT format may have changed
  throw new Error('Failed to parse valid plan IDs from SSOT v2. SSOT may be malformed. Expected: type PlanId = \'starter\' | \'pro\' | \'plus\'');
}

/**
 * Extract legacy plan IDs from SSOT
 * Source: docs/SSOT/roastr-ssot-v2.md lines 42-44
 */
function getLegacyPlans(ssotContent) {
  // Legacy plans from SSOT v2 lines 42-44
  // These are prohibited plan IDs that should not appear in backend-v2 code
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
function scanFile(filePath, ssotContent, violations) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`⚠️  Error reading file ${filePath}: ${error.message}`);
    return;
  }
  const validPlans = getValidPlans(ssotContent);
  const legacyPlans = getLegacyPlans(ssotContent);
  const validFlags = getValidFeatureFlags(ssotContent);

  // Check for legacy plan references (only in backend-v2)
  if (isBackendV2File(filePath)) {
    for (const legacyPlan of legacyPlans) {
      // Escape special regex characters in plan name for safety
      const escapedPlan = legacyPlan.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`['"]${escapedPlan}['"]`, 'g');
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
    const stripeRegex = /stripe/i;
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
    // Try to fetch main branch for comparison (works in full checkout)
    // Use deeper fetch to avoid shallow clone issues
    try {
      execSync('git fetch origin main --depth=100 2>/dev/null || true', { stdio: 'pipe' });
    } catch {
      // Ignore fetch errors
    }
    // Try multiple strategies for shallow clones
    let output = '';
    try {
      output = execSync('git diff --name-only HEAD origin/main 2>/dev/null', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch {
      try {
        output = execSync('git diff --name-only HEAD~1 HEAD 2>/dev/null', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch {
        // In shallow clones, return empty - will check all backend-v2 as fallback
        output = '';
      }
    }
    return output.trim().split('\n').filter(f => f && f.length > 0);
  } catch (error) {
    return [];
  }
}

/**
 * Main validation
 */
function main() {
  // Reset state for each invocation
  const violations = [];
  const warnings = [];

  const args = process.argv.slice(2);
  const pathArg = args.find(arg => arg.startsWith('--path='));
  const targetPath = pathArg ? pathArg.split('=')[1] : null;
  const ciMode = args.includes('--ci');

  if (!ciMode) {
    console.log('🔍 Validating SSOT compliance...\n');
  }

  const ssotContent = readSSOT();

  let filesToCheck = [];

  if (targetPath) {
    // Normalize path to prevent path traversal issues
    const normalizedPath = path.normalize(targetPath).replace(/\\/g, '/');
    const fullPath = path.resolve(normalizedPath);
    
    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (error) {
      console.error(`❌ Error accessing path: ${error.message}`);
      process.exit(1);
    }
    
    if (stats.isDirectory()) {
      filesToCheck = findFiles(fullPath);
    } else {
      filesToCheck = [fullPath];
    }
  } else {
    // Check changed files in backend-v2
    const changedFiles = getChangedFiles();
    if (changedFiles.length === 0) {
      // In shallow clones, if no changed files detected, check all backend-v2 files
      // This is a fallback - ideally CI should use fetch-depth: 0
      if (!ciMode) {
        console.log('⚠️  No changed files detected (shallow clone?). Checking all backend-v2 files...');
      }
      const backendV2Path = path.join(__dirname, '../../apps/backend-v2');
      if (fs.existsSync(backendV2Path)) {
        filesToCheck = findFiles(backendV2Path);
      } else {
        if (!ciMode) {
          console.log('ℹ️  No files to check.');
        }
        process.exit(0);
      }
    } else {
      filesToCheck = changedFiles
        .filter(f => f.includes('apps/backend-v2'))
        .map(f => {
          const normalized = path.normalize(f).replace(/\\/g, '/');
          return path.resolve(normalized);
        });
    }
  }

  if (filesToCheck.length === 0) {
    if (!ciMode) {
      console.log('ℹ️  No files to check.');
    }
    process.exit(0);
  }

  if (!ciMode) {
    console.log(`📁 Checking ${filesToCheck.length} file(s)...\n`);
  }

  for (const file of filesToCheck) {
    scanFile(file, ssotContent, violations);
  }

  // Report results
  if (violations.length > 0) {
    console.error('❌ SSOT Compliance Violations Detected:\n');
    for (const violation of violations) {
      console.error(`  File: ${violation.file}`);
      console.error(`  Type: ${violation.type}`);
      console.error(`  Message: ${violation.message}`);
      console.error(`  Source: ${violation.source}\n`);
    }
    console.error(`\n❌ Total violations: ${violations.length}`);
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

