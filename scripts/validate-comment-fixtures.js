#!/usr/bin/env node
/**
 * Comment Fixtures Validator
 *
 * Validates comment fixtures against schema.json
 * Part of CodeRabbit Review #3356892723 (Phase 3)
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

const schemaPath = path.join(__dirname, '..', 'data', 'fixtures', 'comments', 'schema.json');
const enFixturesPath = path.join(__dirname, '..', 'data', 'fixtures', 'comments', 'comments-en.json');
const esFixturesPath = path.join(__dirname, '..', 'data', 'fixtures', 'comments', 'comments-es.json');

// Load schema
let schema;
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  console.log('✅ Schema loaded:', schemaPath);
} catch (error) {
  console.error('❌ Failed to load schema:', error.message);
  process.exit(1);
}

// Compile schema
let validate;
try {
  validate = ajv.compile(schema);
  console.log('✅ Schema compiled successfully\n');
} catch (error) {
  console.error('❌ Failed to compile schema:', error.message);
  process.exit(1);
}

// Validate fixtures
let totalFixtures = 0;
let validFixtures = 0;
let invalidFixtures = 0;
const errors = [];

function validateFixtureFile(filePath, language) {
  console.log(`\n📝 Validating ${language.toUpperCase()} fixtures: ${path.basename(filePath)}`);
  console.log('━'.repeat(60));

  let fixtures;
  try {
    fixtures = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ Failed to load fixtures: ${error.message}`);
    return;
  }

  if (!Array.isArray(fixtures)) {
    console.error('❌ Fixtures file must contain an array');
    return;
  }

  fixtures.forEach((fixture, index) => {
    totalFixtures++;
    const valid = validate(fixture);

    if (valid) {
      validFixtures++;
      console.log(`  ✅ [${index + 1}] ${fixture.id} - Valid`);
    } else {
      invalidFixtures++;
      console.log(`  ❌ [${index + 1}] ${fixture.id} - INVALID`);

      validate.errors.forEach(error => {
        const errorMsg = `    - ${error.instancePath || 'root'}: ${error.message}`;
        console.log(errorMsg);
        errors.push({
          file: path.basename(filePath),
          fixture: fixture.id,
          index: index + 1,
          path: error.instancePath || 'root',
          message: error.message,
          params: error.params
        });
      });
    }
  });
}

// Validate both files
validateFixtureFile(enFixturesPath, 'en');
validateFixtureFile(esFixturesPath, 'es');

// Summary
console.log('\n' + '═'.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('═'.repeat(60));
console.log(`Total Fixtures:   ${totalFixtures}`);
console.log(`Valid:            ${validFixtures} ✅`);
console.log(`Invalid:          ${invalidFixtures} ❌`);
console.log(`Success Rate:     ${((validFixtures / totalFixtures) * 100).toFixed(1)}%`);

if (invalidFixtures > 0) {
  console.log('\n❌ VALIDATION FAILED');
  console.log('\nErrors by Category:');

  // Group errors by type
  const errorTypes = {};
  errors.forEach(err => {
    const key = err.message;
    if (!errorTypes[key]) {
      errorTypes[key] = [];
    }
    errorTypes[key].push(err);
  });

  Object.entries(errorTypes).forEach(([message, errs]) => {
    console.log(`\n  "${message}"`);
    errs.forEach(err => {
      console.log(`    - ${err.file}:${err.index} (${err.fixture})`);
    });
  });

  process.exit(1);
} else {
  console.log('\n✅ ALL FIXTURES VALID');
  process.exit(0);
}
