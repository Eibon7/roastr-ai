#!/usr/bin/env node

/**
 * @file validate-fixtures.js
 * @description Validates demo mode fixture files against JSON schema
 *
 * Usage:
 *   node scripts/validate-fixtures.js [--verbose]
 *
 * Exit codes:
 *   0 - All fixtures valid
 *   1 - Validation errors found
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Parse CLI args
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

// Paths
const FIXTURES_DIR = path.join(__dirname, '..', 'data', 'fixtures', 'comments');
const SCHEMA_PATH = path.join(FIXTURES_DIR, 'schema.json');
const FIXTURE_FILES = [
  path.join(FIXTURES_DIR, 'comments-es.json'),
  path.join(FIXTURES_DIR, 'comments-en.json')
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

/**
 * Validate a single fixture file
 * @param {string} filePath - Path to fixture file
 * @param {Function} validate - Ajv validation function
 * @returns {Object} Validation results
 */
function validateFixtureFile(filePath, validate) {
  const fileName = path.basename(filePath);
  const results = {
    file: fileName,
    valid: true,
    fixtureCount: 0,
    errors: []
  };

  try {
    // Read and parse fixture file
    const content = fs.readFileSync(filePath, 'utf8');
    const fixtures = JSON.parse(content);

    if (!Array.isArray(fixtures)) {
      results.valid = false;
      results.errors.push({
        message: 'Fixture file must contain an array of fixtures',
        location: 'root'
      });
      return results;
    }

    results.fixtureCount = fixtures.length;

    // Validate each fixture
    fixtures.forEach((fixture, index) => {
      const isValid = validate(fixture);

      if (!isValid) {
        results.valid = false;
        validate.errors.forEach((error) => {
          results.errors.push({
            fixtureId: fixture.id || `fixture-${index}`,
            fixtureIndex: index,
            path: error.instancePath || error.dataPath,
            message: error.message,
            params: error.params
          });
        });
      }
    });

    // Additional validation: Check for duplicate IDs
    const ids = fixtures.map((f) => f.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

    if (duplicateIds.length > 0) {
      results.valid = false;
      duplicateIds.forEach((id) => {
        results.errors.push({
          fixtureId: id,
          message: 'Duplicate fixture ID found',
          location: 'id'
        });
      });
    }
  } catch (error) {
    results.valid = false;

    if (error instanceof SyntaxError) {
      results.errors.push({
        message: `JSON parse error: ${error.message}`,
        location: 'file'
      });
    } else if (error.code === 'ENOENT') {
      results.errors.push({
        message: 'Fixture file not found',
        location: 'file'
      });
    } else {
      results.errors.push({
        message: `Unexpected error: ${error.message}`,
        location: 'file'
      });
    }
  }

  return results;
}

/**
 * Print validation results to console
 * @param {Array} results - Array of validation results
 */
function printResults(results) {
  console.log(`\n${colors.bright}=== Demo Fixture Validation ===${colors.reset}\n`);

  let totalFixtures = 0;
  let totalErrors = 0;
  let allValid = true;

  results.forEach((result) => {
    totalFixtures += result.fixtureCount;

    if (result.valid) {
      console.log(
        `${colors.green}✓${colors.reset} ${result.file} - ${result.fixtureCount} fixtures valid`
      );
    } else {
      allValid = false;
      totalErrors += result.errors.length;
      console.log(
        `${colors.red}✗${colors.reset} ${result.file} - ${result.errors.length} validation errors`
      );

      if (verbose) {
        result.errors.forEach((error) => {
          console.log(
            `  ${colors.yellow}→${colors.reset} ${error.fixtureId || 'N/A'}: ${error.message}`
          );
          if (error.path) {
            console.log(`    Path: ${error.path}`);
          }
          if (error.params) {
            console.log(`    Details: ${JSON.stringify(error.params)}`);
          }
        });
      }
    }
  });

  console.log(`\n${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Total fixtures: ${totalFixtures}`);
  console.log(`  Total errors: ${totalErrors}`);

  if (allValid) {
    console.log(`\n${colors.green}${colors.bright}✓ All fixtures valid!${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}${colors.bright}✗ Validation failed${colors.reset}`);
    console.log(`  Run with --verbose for detailed error information\n`);
  }

  return allValid;
}

/**
 * Main validation function
 */
async function main() {
  try {
    // Load JSON schema
    if (!fs.existsSync(SCHEMA_PATH)) {
      console.error(`${colors.red}Error: Schema file not found at ${SCHEMA_PATH}${colors.reset}`);
      process.exit(1);
    }

    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

    // Initialize Ajv validator
    const ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    // Validate all fixture files
    const results = FIXTURE_FILES.map((filePath) => validateFixtureFile(filePath, validate));

    // Print results
    const allValid = printResults(results);

    // Exit with appropriate code
    process.exit(allValid ? 0 : 1);
  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validateFixtureFile };
