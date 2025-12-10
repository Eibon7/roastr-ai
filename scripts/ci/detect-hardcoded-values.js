#!/usr/bin/env node

/**
 * Hardcoded Values Detector
 *
 * Detects hardcoded values that should come from SSOT instead.
 *
 * Source Requirements:
 * - docs/nodes-v2/15-ssot-integration.md (line 132): Backend must NOT use hardcoded values
 * - docs/spec/roastr-spec-v2.md (lines 151-160): V2 uses SSOT, no hardcoded values
 * - docs/SSOT/roastr-ssot-v2.md: Defines all configurable values
 *
 * Usage:
 *   node scripts/ci/detect-hardcoded-values.js [--path=<file-or-dir>]
 *
 * Exit Codes:
 *   0 - No hardcoded values detected (or all justified)
 *   1 - Hardcoded values detected that should come from SSOT
 *
 * Created: 2025-12-05 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SSOT_PATH = path.join(__dirname, '../../docs/SSOT/roastr-ssot-v2.md');
const BACKEND_V2_PATH = path.join(__dirname, '../../apps/backend-v2');

// Values that MUST come from SSOT (from SSOT v2 document)
// These are patterns to detect hardcoded values that should be loaded from SSOT
const SSOT_DEFINED_VALUES = {
  // Plans (from SSOT v2 section 1)
  plans: {
    patterns: [
      /plan\s*[=:]\s*['"](starter|pro|plus)['"]/i,
      /planId\s*[=:]\s*['"](starter|pro|plus)['"]/i
    ],
    source: 'docs/SSOT/roastr-ssot-v2.md:31-88'
  },
  // Feature flags (from SSOT v2 section 3)
  featureFlags: {
    patterns: [
      /featureFlag\s*[=:]\s*['"](autopost_enabled|manual_approval_enabled|enable_shield|enable_roast)['"]/i
    ],
    source: 'docs/SSOT/roastr-ssot-v2.md:208-232'
  },
  // Thresholds (from SSOT v2 section 4)
  thresholds: {
    patterns: [
      /threshold\s*[=:]\s*0\.\d+/,
      /roastLower\s*[=:]\s*0\.\d+/,
      /shield\s*[=:]\s*0\.\d+/,
      /critical\s*[=:]\s*0\.\d+/
    ],
    source: 'docs/SSOT/roastr-ssot-v2.md:279-289'
  },
  // Weights (from SSOT v2 section 4.2)
  weights: {
    patterns: [
      /lineaRoja\s*[=:]\s*1\.\d+/,
      /identidad\s*[=:]\s*1\.\d+/,
      /strike1\s*[=:]\s*1\.\d+/,
      /strike2\s*[=:]\s*1\.\d+/
    ],
    source: 'docs/SSOT/roastr-ssot-v2.md:291-303'
  }
};

let violations = [];

/**
 * Check if file is in backend-v2
 */
function isBackendV2File(filePath) {
  return filePath.includes('apps/backend-v2');
}

/**
 * Check if file is a settings loader (allowed to have config)
 */
function isSettingsLoader(filePath) {
  return filePath.includes('loadSettings') || filePath.includes('admin-controlled.yaml');
}

/**
 * Check if line is a comment or test
 */
function isCommentOrTest(line, filePath) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('#') ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    trimmed.includes('// TODO') ||
    trimmed.includes('// FIXME')
  );
}

/**
 * Scan file for hardcoded values
 */
function scanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  // Only check backend-v2 files (excluding settings loaders)
  if (!isBackendV2File(filePath) || isSettingsLoader(filePath)) {
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`⚠️  Error reading file ${filePath}: ${error.message}`);
    return;
  }
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and tests
    if (isCommentOrTest(line, filePath)) {
      continue;
    }

    // Check each SSOT-defined value category
    for (const [category, config] of Object.entries(SSOT_DEFINED_VALUES)) {
      for (const pattern of config.patterns) {
        if (pattern.test(line)) {
          // Check if it's loading from SSOT (acceptable)
          if (line.includes('loadSettings') || line.includes('getSetting') || line.includes('SSOT')) {
            continue;
          }

          violations.push({
            file: filePath,
            line: lineNum,
            type: `hardcoded_${category}`,
            message: `Hardcoded ${category} value detected. Should be loaded from SSOT.`,
            source: config.source,
            code: line.trim()
          });
        }
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
  const ciMode = args.includes('--ci');

  if (!ciMode) {
    console.log('🔍 Detecting hardcoded values that should come from SSOT...\n');
  }

  let filesToCheck = [];

  if (targetPath) {
    // Normalize path to prevent path traversal issues
    const normalizedPath = path.normalize(targetPath);
    const fullPath = path.resolve(normalizedPath);
    
    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (error) {
      console.error(`❌ Error accessing path: ${error.message}`);
      process.exit(1);
    }
    
    if (stats.isDirectory()) {
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
      .map(f => path.resolve(path.normalize(f)));
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
    scanFile(file);
  }

  // Report results
  if (violations.length > 0) {
    console.error('❌ Hardcoded Values Detected:\n');
    for (const violation of violations) {
      console.error(`  File: ${violation.file}`);
      console.error(`  Line: ${violation.line}`);
      console.error(`  Type: ${violation.type}`);
      console.error(`  Message: ${violation.message}`);
      console.error(`  Source: ${violation.source}`);
      console.error(`  Code: ${violation.code}\n`);
    }
    console.error(`\n❌ Total violations: ${violations.length}`);
    console.error('\n⚠️  Values defined in SSOT must be loaded from SSOT, not hardcoded.');
    console.error('   Use loadSettings() or getSetting() to load from SSOT.');
    process.exit(1);
  }

  if (!ciMode) {
    console.log('✅ No hardcoded values detected (or all values properly loaded from SSOT).');
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, scanFile, SSOT_DEFINED_VALUES };

