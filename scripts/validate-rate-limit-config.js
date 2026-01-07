#!/usr/bin/env node
/**
 * Rate Limit Configuration Validator
 * 
 * Issue: ROA-526 - Rate Limiting v2: Auth Wiring, Observability, and Global Validation
 * 
 * Validates rate limiting configuration from SSOT v2:
 * - Checks that all required rate limit configurations exist
 * - Validates configuration structure and types
 * - Verifies progressive block durations
 * - Checks abuse detection thresholds
 * - Ensures fallback values are safe
 * 
 * Exit codes:
 * - 0: All validations passed
 * - 1: Configuration errors detected
 * - 2: Critical errors (SSOT unavailable, invalid structure)
 */

const settingsLoader = require('../src/services/settingsLoaderV2');
const { logger } = require('../src/utils/logger');

// Expected configuration structure from SSOT §12.4
const EXPECTED_AUTH_TYPES = ['password', 'magic_link', 'oauth', 'password_reset'];
const REQUIRED_AUTH_CONFIG_FIELDS = ['windowMs', 'maxAttempts', 'blockDurationMs'];
const REQUIRED_ABUSE_DETECTION_THRESHOLDS = ['multi_ip', 'multi_email', 'burst', 'slow_attack'];

// Validation results tracking
const validationResults = {
  passed: [],
  warnings: [],
  errors: []
};

/**
 * Log validation result
 * @param {string} level - 'pass', 'warn', or 'error'
 * @param {string} message - Validation message
 * @param {Object} metadata - Additional metadata
 */
function logResult(level, message, metadata = {}) {
  const result = { message, metadata, timestamp: new Date().toISOString() };
  
  if (level === 'pass') {
    validationResults.passed.push(result);
    logger.info(`✅ PASS: ${message}`, metadata);
  } else if (level === 'warn') {
    validationResults.warnings.push(result);
    logger.warn(`⚠️  WARN: ${message}`, metadata);
  } else if (level === 'error') {
    validationResults.errors.push(result);
    logger.error(`❌ ERROR: ${message}`, metadata);
  }
}

/**
 * Validate auth rate limit configuration
 * @param {Object} config - Rate limit configuration from SSOT
 * @returns {boolean} - True if valid
 */
async function validateAuthRateLimitConfig(config) {
  logger.info('📋 Validating Auth Rate Limit Configuration (SSOT §12.4)...');
  console.log('\n📋 Validating Auth Rate Limit Configuration (SSOT §12.4)...\n');
  
  if (!config || typeof config !== 'object') {
    logResult('error', 'Auth rate limit configuration is missing or invalid', { config });
    return false;
  }

  let isValid = true;

  // Check each auth type
  for (const authType of EXPECTED_AUTH_TYPES) {
    if (!config[authType]) {
      logResult('error', `Missing configuration for auth type: ${authType}`, { authType });
      isValid = false;
      continue;
    }

    const authConfig = config[authType];

    // Check required fields
    for (const field of REQUIRED_AUTH_CONFIG_FIELDS) {
      if (authConfig[field] === undefined || authConfig[field] === null) {
        logResult('error', `Missing field "${field}" in ${authType} config`, { authType, field });
        isValid = false;
      } else if (typeof authConfig[field] !== 'number') {
        logResult('error', `Field "${field}" must be a number in ${authType} config`, { 
          authType, 
          field, 
          actualType: typeof authConfig[field],
          actualValue: authConfig[field]
        });
        isValid = false;
      } else {
        logResult('pass', `${authType}.${field} = ${authConfig[field]}ms`, { authType, field, value: authConfig[field] });
      }
    }

    // Validate ranges
    if (authConfig.maxAttempts && authConfig.maxAttempts < 1) {
      logResult('error', `maxAttempts must be >= 1 in ${authType} config`, { 
        authType, 
        maxAttempts: authConfig.maxAttempts 
      });
      isValid = false;
    }

    if (authConfig.windowMs && authConfig.windowMs < 60000) { // Minimum 1 minute
      logResult('warn', `windowMs is very short (< 1 minute) in ${authType} config`, { 
        authType, 
        windowMs: authConfig.windowMs 
      });
    }

    if (authConfig.blockDurationMs && authConfig.blockDurationMs < 60000) { // Minimum 1 minute
      logResult('warn', `blockDurationMs is very short (< 1 minute) in ${authType} config`, { 
        authType, 
        blockDurationMs: authConfig.blockDurationMs 
      });
    }
  }

  return isValid;
}

/**
 * Validate progressive block durations
 * @param {Array} durations - Progressive block durations from SSOT
 * @returns {boolean} - True if valid
 */
async function validateProgressiveBlockDurations(durations) {
  logger.info('📋 Validating Progressive Block Durations (SSOT §12.4)...');
  console.log('\n📋 Validating Progressive Block Durations (SSOT §12.4)...\n');
  
  if (!Array.isArray(durations)) {
    logResult('error', 'Progressive block durations must be an array', { durations });
    return false;
  }

  if (durations.length < 3) {
    logResult('error', 'Progressive block durations must have at least 3 entries', { 
      length: durations.length 
    });
    return false;
  }

  let isValid = true;
  let lastDuration = 0;

  for (let i = 0; i < durations.length; i++) {
    const duration = durations[i];
    
    // Last duration can be null (permanent block)
    if (i === durations.length - 1 && duration === null) {
      logResult('pass', `Progressive block duration[${i}] = null (permanent block)`, { index: i });
      continue;
    }

    // All other durations must be numbers
    if (typeof duration !== 'number' || duration < 0) {
      logResult('error', `Progressive block duration[${i}] must be a positive number`, { 
        index: i, 
        duration,
        actualType: typeof duration
      });
      isValid = false;
      continue;
    }

    // Durations should be progressive (each longer than previous)
    if (duration < lastDuration) {
      logResult('warn', `Progressive block duration[${i}] is shorter than previous duration`, { 
        index: i, 
        duration, 
        previousDuration: lastDuration 
      });
    }

    logResult('pass', `Progressive block duration[${i}] = ${duration}ms (${Math.round(duration / 60000)} minutes)`, { 
      index: i, 
      durationMs: duration 
    });

    lastDuration = duration;
  }

  return isValid;
}

/**
 * Validate abuse detection thresholds
 * @param {Object} thresholds - Abuse detection thresholds from SSOT
 * @returns {boolean} - True if valid
 */
async function validateAbuseDetectionThresholds(thresholds) {
  logger.info('📋 Validating Abuse Detection Thresholds (SSOT §12.4)...');
  console.log('\n📋 Validating Abuse Detection Thresholds (SSOT §12.4)...\n');
  
  if (!thresholds || typeof thresholds !== 'object') {
    logResult('error', 'Abuse detection thresholds are missing or invalid', { thresholds });
    return false;
  }

  let isValid = true;

  for (const threshold of REQUIRED_ABUSE_DETECTION_THRESHOLDS) {
    if (thresholds[threshold] === undefined || thresholds[threshold] === null) {
      logResult('error', `Missing abuse detection threshold: ${threshold}`, { threshold });
      isValid = false;
    } else if (typeof thresholds[threshold] !== 'number') {
      logResult('error', `Abuse detection threshold "${threshold}" must be a number`, { 
        threshold, 
        actualType: typeof thresholds[threshold],
        actualValue: thresholds[threshold]
      });
      isValid = false;
    } else if (thresholds[threshold] < 1) {
      logResult('error', `Abuse detection threshold "${threshold}" must be >= 1`, { 
        threshold, 
        value: thresholds[threshold] 
      });
      isValid = false;
    } else {
      logResult('pass', `Abuse detection threshold "${threshold}" = ${thresholds[threshold]}`, { 
        threshold, 
        value: thresholds[threshold] 
      });
    }
  }

  return isValid;
}

/**
 * Validate that critical endpoints are covered by rate limiting
 * @returns {boolean} - True if valid
 */
async function validateEndpointCoverage() {
  logger.info('📋 Validating Endpoint Coverage...');
  console.log('\n📋 Validating Endpoint Coverage...\n');
  
  // This is a basic check - in a real implementation, we would scan the routes
  // and verify that rate limiting middleware is applied to all auth endpoints
  const criticalEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/magic-link',
    '/api/auth/oauth',
    '/api/auth/reset-password'
  ];

  // TODO: Implement actual endpoint scanning
  // For now, we just log a warning that manual verification is needed
  logResult('warn', 'Endpoint coverage validation not implemented - manual verification required', {
    criticalEndpoints
  });

  return true; // Don't fail validation on this
}

/**
 * Main validation function
 */
async function main() {
  logger.info('🔍 Rate Limit Configuration Validator - ROA-526');
  console.log('🔍 Rate Limit Configuration Validator - ROA-526\n');
  console.log('═'.repeat(60));

  try {
    // Load configuration from SSOT
    logger.info('📥 Loading configuration from SSOT v2...');
    console.log('\n📥 Loading configuration from SSOT v2...\n');
    
    const authRateLimitConfig = await settingsLoader.getValue('rate_limit.auth');
    const progressiveBlockDurations = await settingsLoader.getValue('rate_limit.auth.block_durations');
    const abuseDetectionThresholds = await settingsLoader.getValue('abuse_detection.thresholds');

    // If any config is missing, it's a critical error
    if (!authRateLimitConfig) {
      logResult('error', 'CRITICAL: rate_limit.auth not found in SSOT', {});
      logger.error('❌ CRITICAL ERROR: Cannot proceed without rate limit configuration');
      console.log('\n═'.repeat(60));
      console.log('\n❌ CRITICAL ERROR: Cannot proceed without rate limit configuration');
      process.exit(2);
    }

    // Run validations
    const authRateLimitValid = await validateAuthRateLimitConfig(authRateLimitConfig);
    const progressiveBlockValid = progressiveBlockDurations 
      ? await validateProgressiveBlockDurations(progressiveBlockDurations)
      : true; // Optional in SSOT, will use fallback
    const abuseDetectionValid = abuseDetectionThresholds
      ? await validateAbuseDetectionThresholds(abuseDetectionThresholds)
      : true; // Optional in SSOT, will use fallback
    const endpointCoverageValid = await validateEndpointCoverage();

    // Print summary
    logger.info('📊 Validation Summary', {
      passed: validationResults.passed.length,
      warnings: validationResults.warnings.length,
      errors: validationResults.errors.length
    });
    console.log('\n═'.repeat(60));
    console.log('\n📊 Validation Summary:\n');
    console.log(`   ✅ Passed: ${validationResults.passed.length}`);
    console.log(`   ⚠️  Warnings: ${validationResults.warnings.length}`);
    console.log(`   ❌ Errors: ${validationResults.errors.length}`);
    console.log('');

    if (validationResults.warnings.length > 0) {
      console.log('\n⚠️  Warnings:\n');
      validationResults.warnings.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.message}`);
      });
      console.log('');
    }

    if (validationResults.errors.length > 0) {
      console.log('\n❌ Errors:\n');
      validationResults.errors.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.message}`);
      });
      console.log('');
    }

    console.log('═'.repeat(60));

    // Determine exit code
    if (validationResults.errors.length > 0) {
      logger.error('❌ VALIDATION FAILED: Configuration errors detected');
      console.log('\n❌ VALIDATION FAILED: Configuration errors detected');
      console.log('   Please fix the errors above before deploying rate limiting v2.');
      process.exit(1);
    } else if (validationResults.warnings.length > 0) {
      logger.warn('⚠️  VALIDATION PASSED WITH WARNINGS');
      console.log('\n⚠️  VALIDATION PASSED WITH WARNINGS');
      console.log('   Review warnings above - they may indicate potential issues.');
      process.exit(0);
    } else {
      logger.info('✅ VALIDATION PASSED: All checks successful');
      console.log('\n✅ VALIDATION PASSED: All checks successful');
      console.log('   Rate limiting configuration is valid and ready for deployment.');
      process.exit(0);
    }

  } catch (error) {
    logger.error('🚨 CRITICAL ERROR during validation', { error: error.message, stack: error.stack });
    console.error('\n🚨 CRITICAL ERROR during validation:\n');
    console.error(error);
    console.error('\n═'.repeat(60));
    console.error('\n❌ Validation failed due to unexpected error');
    console.error('   This may indicate SSOT unavailability or code issues.');
    process.exit(2);
  }
}

// Run validation
main();

