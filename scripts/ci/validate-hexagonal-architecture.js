#!/usr/bin/env node

/**
 * Hexagonal Architecture Validator
 *
 * Validates that backend v2 follows hexagonal architecture rules.
 *
 * Source Requirements:
 * - docs/spec/roastr-spec-v2.md (lines 600-637): Hexagonal architecture definition
 * - docs/spec/roastr-spec-v2.md (lines 630-637): Absolute prohibitions in domain layer
 *
 * Usage:
 *   node scripts/ci/validate-hexagonal-architecture.js [--path=<file-or-dir>]
 *
 * Exit Codes:
 *   0 - Architecture rules followed
 *   1 - Architecture violations detected
 *
 * Created: 2025-12-05 (ROA-308)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKEND_V2_PATH = path.join(__dirname, '../../apps/backend-v2');

// Prohibitions in domain layer (services/)
// Source: docs/spec/roastr-spec-v2.md lines 630-637
const DOMAIN_PROHIBITIONS = [
  {
    pattern: /require\(['"]http|import.*from ['"]http|fetch\(|axios\.|request\(/i,
    message: 'No HTTP calls allowed in domain layer',
    source: 'docs/spec/roastr-spec-v2.md:632'
  },
  {
    pattern: /from ['"]@supabase|supabase\.from\(|\.query\(|\.select\(/i,
    message: 'No direct DB access allowed in domain layer',
    source: 'docs/spec/roastr-spec-v2.md:633'
  },
  {
    pattern: /express|Router|Request|Response|req\.|res\./i,
    message: 'No Express logic allowed in domain layer',
    source: 'docs/spec/roastr-spec-v2.md:634'
  },
  {
    pattern: /worker|Worker|queue|Queue|enqueue/i,
    message: 'No worker logic allowed in domain layer',
    source: 'docs/spec/roastr-spec-v2.md:635'
  },
  {
    pattern: /JSON\.stringify|JSON\.parse|serialize|deserialize/i,
    message: 'No serialization logic allowed in domain layer',
    source: 'docs/spec/roastr-spec-v2.md:636'
  }
];

let violations = [];

/**
 * Check if file is in services/ (domain layer)
 */
function isDomainLayer(filePath) {
  return filePath.includes('apps/backend-v2') && filePath.includes('/services/');
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
    trimmed.includes('// FIXME') ||
    trimmed.includes('// Import for type only')
  );
}

/**
 * Check if import is type-only (TypeScript)
 */
function isTypeOnlyImport(line) {
  return line.includes('import type') || line.includes('import { type');
}

/**
 * Scan file for architecture violations
 */
function scanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  // Only check domain layer (services/)
  if (!isDomainLayer(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and tests
    if (isCommentOrTest(line, filePath)) {
      continue;
    }

    // Skip type-only imports
    if (isTypeOnlyImport(line)) {
      continue;
    }

    // Check each prohibition
    for (const prohibition of DOMAIN_PROHIBITIONS) {
      if (prohibition.pattern.test(line)) {
        violations.push({
          file: filePath,
          line: lineNum,
          type: 'architecture_violation',
          message: prohibition.message,
          source: prohibition.source,
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
 * Main validation
 */
function main() {
  const args = process.argv.slice(2);
  const pathArg = args.find(arg => arg.startsWith('--path='));
  const targetPath = pathArg ? pathArg.split('=')[1] : null;

  console.log('🔍 Validating hexagonal architecture...\n');

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
    // Check changed files in backend-v2 services/
    const changedFiles = getChangedFiles();
    filesToCheck = changedFiles
      .filter(f => f.includes('apps/backend-v2') && f.includes('/services/'))
      .map(f => path.resolve(f));
  }

  if (filesToCheck.length === 0) {
    console.log('ℹ️  No domain layer files to check.');
    process.exit(0);
  }

  console.log(`📁 Checking ${filesToCheck.length} file(s) in domain layer...\n`);

  for (const file of filesToCheck) {
    scanFile(file);
  }

  // Report results
  if (violations.length > 0) {
    console.log('❌ Hexagonal Architecture Violations Detected:\n');
    for (const violation of violations) {
      console.log(`  File: ${violation.file}`);
      console.log(`  Line: ${violation.line}`);
      console.log(`  Message: ${violation.message}`);
      console.log(`  Source: ${violation.source}`);
      console.log(`  Code: ${violation.code}\n`);
    }
    console.log(`\n❌ Total violations: ${violations.length}`);
    console.log('\n⚠️  Domain layer (services/) must not contain:');
    console.log('   - HTTP calls');
    console.log('   - Direct DB access');
    console.log('   - Express logic');
    console.log('   - Worker logic');
    console.log('   - Serialization logic');
    process.exit(1);
  }

  console.log('✅ Hexagonal architecture rules followed.');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main, scanFile, DOMAIN_PROHIBITIONS };

