#!/usr/bin/env node

/**
 * Feature Flags Validator
 *
 * Validates that only authorized feature flags from SSOT are used.
 *
 * Source Requirements:
 * - docs/SSOT/roastr-ssot-v2.md (lines 208-236): Only flags in FeatureFlagKey are authorized
 * - docs/SSOT/roastr-ssot-v2.md (line 234-235): Any flag outside list is unauthorized
 *
 * Usage:
 *   node scripts/ci/validate-feature-flags.js [--path=<file-or-dir>]
 *
 * Exit Codes:
 *   0 - All feature flags are authorized
 *   1 - Unauthorized feature flags detected
 *
 * Created: 2025-12-05 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Authorized feature flags from SSOT v2
// Source: docs/SSOT/roastr-ssot-v2.md lines 208-232
const AUTHORIZED_FLAGS = [
  'autopost_enabled',
  'manual_approval_enabled',
  'custom_prompt_enabled',
  'sponsor_feature_enabled',
  'personal_tone_enabled',
  'nsfw_tone_enabled',
  'kill_switch_autopost',
  'enable_shield',
  'enable_roast',
  'enable_perspective_fallback_classifier',
  'show_two_roast_variants',
  'show_transparency_disclaimer',
  'enable_style_validator',
  'enable_advanced_tones',
  'enable_beta_sponsor_ui'
];

/**
 * Check if file is in backend-v2
 */
function isBackendV2File(filePath) {
  return filePath.includes('apps/backend-v2');
}

/**
 * Check if line is a comment or test
 */
function isCommentOrTest(line, filePath) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*/') ||
    trimmed.startsWith('#') ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    trimmed.includes('// TODO') ||
    trimmed.includes('// FIXME')
  );
}

/**
 * Extract feature flag references from line
 */
function extractFeatureFlags(line) {
  const flags = [];

  // Pattern: Only match flag-like patterns (with _enabled, _feature, _flag suffix or explicit flag access)
  const patterns = [
    /featureFlag\s*[=:]\s*['"]([a-z_]+)['"]/gi,
    /flag\s*[=:]\s*['"]([a-z_]+)['"]/gi,
    /feature_flags\.([a-z_]+)/gi,
    // Only match snake_case strings ending in flag-like suffixes
    /['"]([a-z_]+_(?:enabled|feature|flag))['"]/gi
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0; // Reset before each use to prevent infinite loops
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const flag = match[1] || match[0];
      if (flag && flag.includes('_') && flag.length > 3) {
        flags.push(flag);
      }
    }
  }

  return flags;
}

/**
 * Scan file for unauthorized feature flags
 */
function scanFile(filePath, violations) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  // Only check backend-v2 files
  if (!isBackendV2File(filePath)) {
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

    // Extract feature flags from line
    const flags = extractFeatureFlags(line);

    for (const flag of flags) {
      // Check if flag is authorized
      if (!AUTHORIZED_FLAGS.includes(flag)) {
        // Check if it's a known pattern (like 'key', 'value', etc. - false positives)
        const commonWords = ['key', 'value', 'type', 'name', 'id', 'flag', 'flags', 'feature'];
        if (commonWords.includes(flag)) {
          continue;
        }

        violations.push({
          file: filePath,
          line: lineNum,
          type: 'unauthorized_flag',
          message: `Unauthorized feature flag "${flag}" detected. Only flags from SSOT v2 are allowed.`,
          source: 'docs/SSOT/roastr-ssot-v2.md:208-236',
          code: line.trim(),
          authorizedFlags: AUTHORIZED_FLAGS
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
    const output = execSync(
      'git diff --name-only HEAD origin/main 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || echo ""',
      {
        encoding: 'utf8',
        stdio: 'pipe'
      }
    );
    return output
      .trim()
      .split('\n')
      .filter((f) => f && f.length > 0);
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

  const args = process.argv.slice(2);
  const pathArg = args.find((arg) => arg.startsWith('--path='));
  const targetPath = pathArg ? pathArg.split('=')[1] : null;
  const ciMode = args.includes('--ci');

  if (!ciMode) {
    console.log('🔍 Validating feature flags...\n');
  }

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
      // Recursively find all JS/TS files
      function findFiles(dir) {
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...findFiles(entryPath));
          } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
            files.push(entryPath);
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
      .filter((f) => f.includes('apps/backend-v2'))
      .map((f) => {
        const normalized = path.normalize(f).replace(/\\/g, '/');
        return path.resolve(normalized);
      });
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
    scanFile(file, violations);
  }

  // Report results
  if (violations.length > 0) {
    console.error('❌ Unauthorized Feature Flags Detected:\n');
    for (const violation of violations) {
      console.error(`  File: ${violation.file}`);
      console.error(`  Line: ${violation.line}`);
      console.error(`  Flag: ${violation.message.match(/"([^"]+)"/)?.[1] || 'unknown'}`);
      console.error(`  Message: ${violation.message}`);
      console.error(`  Source: ${violation.source}`);
      console.error(`  Code: ${violation.code}\n`);
    }
    console.error(`\n❌ Total violations: ${violations.length}`);
    console.error('\n⚠️  Only feature flags defined in SSOT v2 are authorized.');
    console.error('   Authorized flags:', AUTHORIZED_FLAGS.join(', '));
    console.error('   To add a new flag, update SSOT v2 first.');
    process.exit(1);
  }

  if (!ciMode) {
    console.log('✅ All feature flags are authorized.');
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, scanFile, AUTHORIZED_FLAGS };
