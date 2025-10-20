#!/usr/bin/env node
/**
 * Simple Comment Fixtures Validator
 *
 * Validates comment fixtures against cross-field rules
 * Part of CodeRabbit Review #3356892723 (Phase 3)
 *
 * Validation Rules:
 * - Low (0.60-0.75): severity="low", action="roast"
 * - Moderate (0.75-0.85): severity="moderate", action="mute"
 * - High (0.85-0.95): severity="high", action="block"
 * - Extreme (0.95-1.0): severity="extreme", action="report"
 */

const fs = require('fs');
const path = require('path');

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
const err = (...args) => process.stderr.write(`${args.join(' ')}\n`);

const enFixturesPath = path.join(__dirname, '..', 'data', 'fixtures', 'comments', 'comments-en.json');
const esFixturesPath = path.join(__dirname, '..', 'data', 'fixtures', 'comments', 'comments-es.json');

// Load fixtures
function loadFixtures(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    err(`❌ Failed to load ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

// Validate cross-field rules
function validateFixture(fixture, index) {
  const { id, toxicity_score, severity, expected_action } = fixture;
  const errors = [];

  // Determine expected values based on toxicity_score
  let expectedSeverity, expectedAction;

  if (toxicity_score >= 0.60 && toxicity_score < 0.75) {
    expectedSeverity = 'low';
    expectedAction = 'roast';
  } else if (toxicity_score >= 0.75 && toxicity_score < 0.85) {
    expectedSeverity = 'moderate';
    expectedAction = 'mute';
  } else if (toxicity_score >= 0.85 && toxicity_score < 0.95) {
    expectedSeverity = 'high';
    expectedAction = 'block';
  } else if (toxicity_score >= 0.95 && toxicity_score <= 1.0) {
    expectedSeverity = 'extreme';
    expectedAction = 'report';
  } else {
    errors.push(`toxicity_score ${toxicity_score} out of range (0.60-1.0)`);
    return { valid: false, errors };
  }

  // Check consistency
  if (severity !== expectedSeverity) {
    errors.push(`severity mismatch: expected "${expectedSeverity}" but got "${severity}" for toxicity_score ${toxicity_score}`);
  }

  if (expected_action !== expectedAction) {
    errors.push(`expected_action mismatch: expected "${expectedAction}" but got "${expected_action}" for toxicity_score ${toxicity_score}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    id,
    toxicity_score,
    severity,
    expected_action,
    expectedSeverity,
    expectedAction
  };
}

// Validate fixture file
function validateFixtureFile(filePath, language) {
  out(`\n📝 Validating ${language.toUpperCase()} fixtures: ${path.basename(filePath)}`);
  out('━'.repeat(60));

  const fixtures = loadFixtures(filePath);
  if (!fixtures) {
    return { total: 0, valid: 0, invalid: 0, errors: [] };
  }

  if (!Array.isArray(fixtures)) {
    err('❌ Fixtures file must contain an array');
    return { total: 0, valid: 0, invalid: 0, errors: [] };
  }

  let validCount = 0;
  let invalidCount = 0;
  const allErrors = [];

  fixtures.forEach((fixture, index) => {
    const result = validateFixture(fixture, index);

    if (result.valid) {
      validCount++;
      out(`  ✅ [${index + 1}] ${result.id} - Valid (${result.toxicity_score.toFixed(2)} → ${result.severity} → ${result.expected_action})`);
    } else {
      invalidCount++;
      out(`  ❌ [${index + 1}] ${result.id} - INVALID`);
      result.errors.forEach(errMsg => {
        out(`     - ${errMsg}`);
        allErrors.push({
          file: path.basename(filePath),
          fixture: result.id,
          index: index + 1,
          error: errMsg
        });
      });
    }
  });

  return {
    total: fixtures.length,
    valid: validCount,
    invalid: invalidCount,
    errors: allErrors
  };
}

// Main execution
out('🔍 Comment Fixtures Cross-Field Validation');
out('═'.repeat(60));
out('Validation Rules:');
out('  Low (0.60-0.75):       severity="low",      action="roast"');
out('  Moderate (0.75-0.85):  severity="moderate", action="mute"');
out('  High (0.85-0.95):      severity="high",     action="block"');
out('  Extreme (0.95-1.0):    severity="extreme",  action="report"');

const enResult = validateFixtureFile(enFixturesPath, 'en');
const esResult = validateFixtureFile(esFixturesPath, 'es');

const totalFixtures = enResult.total + esResult.total;
const validFixtures = enResult.valid + esResult.valid;
const invalidFixtures = enResult.invalid + esResult.invalid;
const allErrors = [...enResult.errors, ...esResult.errors];

// Summary
out('\n' + '═'.repeat(60));
out('📊 VALIDATION SUMMARY');
out('═'.repeat(60));
out(`Total Fixtures:   ${totalFixtures}`);
out(`Valid:            ${validFixtures} ✅`);
out(`Invalid:          ${invalidFixtures} ❌`);
out(`Success Rate:     ${((validFixtures / totalFixtures) * 100).toFixed(1)}%`);

if (invalidFixtures > 0) {
  out('\n❌ VALIDATION FAILED');
  out(`\n${allErrors.length} Cross-Field Violations:`);

  allErrors.forEach(errObj => {
    out(`  - ${errObj.file}:${errObj.index} (${errObj.fixture})`);
    out(`    ${errObj.error}`);
  });

  out('\n⚠️  Fix required: Update toxicity_score, severity, or expected_action to match rules');
  process.exit(1);
} else {
  out('\n✅ ALL FIXTURES VALID - Cross-field rules satisfied');
  out('\n🎉 Schema validation would pass with these fixtures');
  process.exit(0);
}
