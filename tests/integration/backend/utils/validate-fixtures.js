#!/usr/bin/env node
/**
 * Validate Backend Fixtures Utility
 *
 * Validates fixture files for integrity, schema compliance, and freshness
 * Usage: npm run fixtures:validate
 */

const fs = require('fs').promises;
const path = require('path');

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const MAX_FIXTURE_AGE_DAYS = 30; // Fixtures older than this are considered stale

/**
 * Expected schema for different fixture types
 */
const FIXTURE_SCHEMAS = {
  'accounts.json': {
    requiredFields: ['success', 'data', 'timestamp'],
    dataFields: ['accounts', 'networks'],
    accountFields: ['id', 'network', 'handle', 'status']
  },
  'roasts.json': {
    requiredFields: ['success', 'data', 'timestamp'],
    dataFields: ['roasts', 'pagination'],
    roastFields: ['id', 'original', 'roast', 'status', 'createdAt']
  },
  'settings.json': {
    requiredFields: ['success', 'data', 'timestamp'],
    dataFields: ['settings', 'availableOptions']
  },
  'shield.json': {
    requiredFields: ['success', 'data', 'timestamp'],
    dataFields: ['intercepted', 'summary'],
    itemFields: ['id', 'category', 'action', 'toxicityScore']
  }
};

/**
 * Validation results collector
 */
class ValidationResults {
  constructor() {
    this.results = [];
    this.summary = {
      total: 0,
      valid: 0,
      warnings: 0,
      errors: 0
    };
  }

  addResult(filename, status, message, details = null) {
    const result = {
      filename,
      status, // 'valid', 'warning', 'error'
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    this.summary.total++;
    this.summary[status]++;

    // Log result
    const emoji = status === 'valid' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    console.log(`${emoji} ${filename}: ${message}`);

    if (details) {
      console.log(`   Details: ${details}`);
    }
  }

  hasErrors() {
    return this.summary.errors > 0;
  }

  hasWarnings() {
    return this.summary.warnings > 0;
  }

  printSummary() {
    console.log('\n📊 Validation Summary:');
    console.log(`   Total fixtures: ${this.summary.total}`);
    console.log(`   ✅ Valid: ${this.summary.valid}`);
    console.log(`   ⚠️  Warnings: ${this.summary.warnings}`);
    console.log(`   ❌ Errors: ${this.summary.errors}`);
  }
}

/**
 * Check if fixture file exists and is readable
 */
async function validateFileExists(filename) {
  try {
    const fixturePath = path.join(FIXTURES_DIR, filename);
    await fs.access(fixturePath, fs.constants.R_OK);
    return { exists: true };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

/**
 * Parse and validate JSON structure
 */
async function validateJsonStructure(filename) {
  try {
    const fixturePath = path.join(FIXTURES_DIR, filename);
    const content = await fs.readFile(fixturePath, 'utf-8');

    if (!content.trim()) {
      return { valid: false, error: 'Empty file' };
    }

    const data = JSON.parse(content);
    return {
      valid: true,
      data,
      size: content.length,
      formatted: content.includes('\n  ') // Check if properly formatted
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Validate fixture metadata
 */
function validateMetadata(data, filename) {
  const issues = [];

  // Check for fixture metadata
  if (!data._fixtureMetadata) {
    issues.push('Missing _fixtureMetadata');
  } else {
    const meta = data._fixtureMetadata;

    if (!meta.generatedAt) {
      issues.push('Missing generatedAt in metadata');
    } else {
      const generatedDate = new Date(meta.generatedAt);
      const daysSinceGenerated = (Date.now() - generatedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceGenerated > MAX_FIXTURE_AGE_DAYS) {
        issues.push(
          `Fixture is ${Math.round(daysSinceGenerated)} days old (max: ${MAX_FIXTURE_AGE_DAYS})`
        );
      }
    }

    if (!meta.source) {
      issues.push('Missing source in metadata');
    }

    if (!meta.checksum) {
      issues.push('Missing checksum in metadata');
    }
  }

  return issues;
}

/**
 * Validate fixture schema
 */
function validateSchema(data, filename) {
  const schema = FIXTURE_SCHEMAS[filename];
  if (!schema) {
    return { issues: [`No schema defined for ${filename}`], severity: 'warning' };
  }

  const issues = [];

  // Check required top-level fields
  schema.requiredFields.forEach((field) => {
    if (!(field in data)) {
      issues.push(`Missing required field: ${field}`);
    }
  });

  // Check data structure
  if (data.data && schema.dataFields) {
    schema.dataFields.forEach((field) => {
      if (!(field in data.data)) {
        issues.push(`Missing data field: ${field}`);
      }
    });
  }

  // Validate array items if schemas are defined
  if (schema.accountFields && data.data?.accounts) {
    const sampleAccount = data.data.accounts[0];
    if (sampleAccount) {
      schema.accountFields.forEach((field) => {
        if (!(field in sampleAccount)) {
          issues.push(`Missing account field: ${field}`);
        }
      });
    }
  }

  if (schema.roastFields && data.data?.roasts) {
    const sampleRoast = data.data.roasts[0];
    if (sampleRoast) {
      schema.roastFields.forEach((field) => {
        if (!(field in sampleRoast)) {
          issues.push(`Missing roast field: ${field}`);
        }
      });
    }
  }

  if (schema.itemFields && data.data?.intercepted) {
    const sampleItem = data.data.intercepted[0];
    if (sampleItem) {
      schema.itemFields.forEach((field) => {
        if (!(field in sampleItem)) {
          issues.push(`Missing shield item field: ${field}`);
        }
      });
    }
  }

  return { issues, severity: issues.length > 0 ? 'error' : 'valid' };
}

/**
 * Validate data consistency and quality
 */
function validateDataQuality(data, filename) {
  const issues = [];

  // Check for reasonable data quantities
  if (data.data) {
    if (data.data.accounts && data.data.accounts.length === 0) {
      issues.push('Accounts array is empty');
    }

    if (data.data.roasts && data.data.roasts.length === 0) {
      issues.push('Roasts array is empty');
    }

    if (data.data.intercepted && data.data.intercepted.length === 0) {
      issues.push('Intercepted items array is empty');
    }

    // Check for test-specific data patterns
    if (data.data.accounts) {
      const testAccounts = data.data.accounts.filter(
        (acc) => (acc.handle && acc.handle.includes('test')) || acc.handle.includes('fixture')
      );
      if (testAccounts.length === 0) {
        issues.push('No test accounts found - fixture may contain production data');
      }
    }
  }

  // Check timestamp validity
  if (data.timestamp) {
    const timestamp = new Date(data.timestamp);
    if (isNaN(timestamp.getTime())) {
      issues.push('Invalid timestamp format');
    }
  }

  return { issues, severity: issues.length > 0 ? 'warning' : 'valid' };
}

/**
 * Validate checksum integrity
 */
function validateChecksum(data, filename) {
  if (!data._fixtureMetadata?.checksum) {
    return { valid: false, error: 'No checksum found' };
  }

  // Create a copy without metadata for checksum calculation
  const dataWithoutMeta = { ...data };
  delete dataWithoutMeta._fixtureMetadata;

  // Generate checksum
  const str = JSON.stringify(dataWithoutMeta, null, 0);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const calculatedChecksum = Math.abs(hash).toString(16);

  const storedChecksum = data._fixtureMetadata.checksum;
  const matches = calculatedChecksum === storedChecksum;

  return {
    valid: matches,
    calculatedChecksum,
    storedChecksum,
    error: matches ? null : 'Checksum mismatch - data may be corrupted'
  };
}

/**
 * Validate a single fixture file
 */
async function validateFixture(filename, results) {
  console.log(`\n🔍 Validating fixture: ${filename}`);

  // Check file existence
  const fileCheck = await validateFileExists(filename);
  if (!fileCheck.exists) {
    results.addResult(filename, 'error', 'File does not exist', fileCheck.error);
    return;
  }

  // Parse JSON
  const jsonCheck = await validateJsonStructure(filename);
  if (!jsonCheck.valid) {
    results.addResult(filename, 'error', 'Invalid JSON structure', jsonCheck.error);
    return;
  }

  const { data, size, formatted } = jsonCheck;

  if (!formatted) {
    results.addResult(filename, 'warning', 'File not properly formatted (should be indented JSON)');
  }

  // Validate metadata
  const metadataIssues = validateMetadata(data, filename);
  if (metadataIssues.length > 0) {
    metadataIssues.forEach((issue) => {
      results.addResult(filename, 'warning', `Metadata issue: ${issue}`);
    });
  }

  // Validate schema
  const schemaCheck = validateSchema(data, filename);
  if (schemaCheck.issues.length > 0) {
    schemaCheck.issues.forEach((issue) => {
      results.addResult(filename, schemaCheck.severity, `Schema issue: ${issue}`);
    });
  }

  // Validate data quality
  const qualityCheck = validateDataQuality(data, filename);
  if (qualityCheck.issues.length > 0) {
    qualityCheck.issues.forEach((issue) => {
      results.addResult(filename, qualityCheck.severity, `Data quality: ${issue}`);
    });
  }

  // Validate checksum
  const checksumCheck = validateChecksum(data, filename);
  if (!checksumCheck.valid) {
    results.addResult(filename, 'error', 'Checksum validation failed', checksumCheck.error);
  }

  // Success message if no major issues
  if (schemaCheck.severity === 'valid' && checksumCheck.valid) {
    results.addResult(filename, 'valid', `Valid fixture (${Math.round(size / 1024)}KB)`);
  }
}

/**
 * Main validation function
 */
async function validateAllFixtures() {
  console.log('🚀 Starting fixture validation...');
  console.log(`📁 Fixtures directory: ${FIXTURES_DIR}\n`);

  const results = new ValidationResults();

  try {
    // Ensure fixtures directory exists
    await fs.access(FIXTURES_DIR);

    // Get list of fixture files
    const fixtureFiles = Object.keys(FIXTURE_SCHEMAS);

    // Validate each fixture
    for (const filename of fixtureFiles) {
      await validateFixture(filename, results);
    }

    // Check for extra files
    const allFiles = await fs.readdir(FIXTURES_DIR);
    const extraFiles = allFiles.filter(
      (file) =>
        file.endsWith('.json') && !fixtureFiles.includes(file) && file !== 'update-summary.json'
    );

    extraFiles.forEach((file) => {
      results.addResult(file, 'warning', 'Unexpected fixture file found');
    });

    // Print summary
    results.printSummary();

    // Save validation report
    const report = {
      timestamp: new Date().toISOString(),
      summary: results.summary,
      results: results.results,
      configuration: {
        maxFixtureAgeDays: MAX_FIXTURE_AGE_DAYS,
        validatedSchemas: Object.keys(FIXTURE_SCHEMAS)
      }
    };

    const reportPath = path.join(FIXTURES_DIR, 'validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Validation report saved to: ${reportPath}`);

    // Exit with appropriate code
    if (results.hasErrors()) {
      console.log('\n❌ Validation failed with errors!');
      process.exit(1);
    } else if (results.hasWarnings()) {
      console.log('\n⚠️  Validation completed with warnings');
      process.exit(0);
    } else {
      console.log('\n✅ All fixtures are valid!');
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ Validation failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * CLI handling
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Backend Fixtures Validation Utility

Usage:
  node validate-fixtures.js [options]
  npm run fixtures:validate

Options:
  --help, -h     Show this help message
  --verbose, -v  Show detailed validation output

Description:
  Validates fixture files for:
  - JSON structure and formatting
  - Schema compliance
  - Data integrity (checksums)
  - Freshness (age checks)
  - Data quality

Exit codes:
  0 = All fixtures valid (or warnings only)
  1 = Validation errors found

Examples:
  npm run fixtures:validate
  node tests/integration/backend/utils/validate-fixtures.js
    `);
    process.exit(0);
  }

  validateAllFixtures();
}
