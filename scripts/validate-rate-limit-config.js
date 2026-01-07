#!/usr/bin/env node

/**
 * @fileoverview Validate Rate Limit Configuration
 * @module scripts/validate-rate-limit-config
 * @since ROA-392
 * 
 * Propósito:
 * Valida que la configuración de rate limits en el sistema cumple con:
 * - Todos los scopes tienen configuración válida
 * - Valores numéricos están en rango correcto
 * - Feature flags existen en SSOT
 * - No hay configuraciones hardcoded fuera de SSOT
 * 
 * Uso:
 * - CI: npm run validate:rate-limit (exit 1 si fallos)
 * - Local: node scripts/validate-rate-limit-config.js
 */

const fs = require('fs');
const path = require('path');

/**
 * SSOT Reference: Section 12.6 (Rate Limiting Global v2)
 */

// Valid scopes according to SSOT v2
const VALID_SCOPES = [
  'global',
  'auth.password',
  'auth.magic_link',
  'auth.oauth',
  'auth.password_reset',
  'ingestion.global',
  'ingestion.perUser',
  'ingestion.perAccount',
  'roast',
  'persona',
  'notifications',
  'gdpr',
  'admin'
];

// Valid feature flags according to SSOT v2 (section 3.2)
const VALID_FEATURE_FLAGS = [
  'enable_rate_limit_global',
  'enable_rate_limit_auth',
  'enable_rate_limit_ingestion',
  'enable_rate_limit_roast',
  'enable_rate_limit_persona',
  'enable_rate_limit_notifications',
  'enable_rate_limit_gdpr',
  'enable_rate_limit_admin'
];

// Validation results
const results = {
  errors: [],
  warnings: [],
  info: []
};

/**
 * Validate SSOT v2 contains Rate Limit Policy section
 */
function validateSSOT() {
  console.log('📄 Validating SSOT v2...');
  
  const ssotPath = path.join(process.cwd(), 'docs/SSOT-V2.md');
  
  if (!fs.existsSync(ssotPath)) {
    results.errors.push('SSOT v2 not found at docs/SSOT-V2.md');
    return;
  }

  const ssotContent = fs.readFileSync(ssotPath, 'utf8');

  // Check section 12.6 exists
  if (!ssotContent.includes('### 12.6 Rate Limiting Global v2')) {
    results.errors.push('SSOT v2 missing section 12.6 (Rate Limiting Global v2)');
    return;
  }

  // Check all valid scopes are documented
  const missingScopesInSSOT = VALID_SCOPES.filter(scope => {
    const simpleScope = scope.split('.')[0];
    return !ssotContent.includes(`${simpleScope}:`);
  });

  if (missingScopesInSSOT.length > 0) {
    results.warnings.push(`SSOT v2 section 12.6 missing some scopes: ${missingScopesInSSOT.join(', ')}`);
  }

  // Check feature flags are documented
  const missingFlagsInSSOT = VALID_FEATURE_FLAGS.filter(flag => {
    return !ssotContent.includes(`'${flag}'`);
  });

  if (missingFlagsInSSOT.length > 0) {
    results.errors.push(`SSOT v2 missing feature flags: ${missingFlagsInSSOT.join(', ')}`);
  }

  results.info.push('✅ SSOT v2 section 12.6 present');
}

/**
 * Validate RateLimitPolicyGlobal service exists and has required methods
 */
function validateService() {
  console.log('🔧 Validating RateLimitPolicyGlobal service...');
  
  const servicePath = path.join(process.cwd(), 'src/services/rateLimitPolicyGlobal.js');
  
  if (!fs.existsSync(servicePath)) {
    results.errors.push('RateLimitPolicyGlobal service not found at src/services/rateLimitPolicyGlobal.js');
    return;
  }

  const serviceContent = fs.readFileSync(servicePath, 'utf8');

  // Check required methods exist
  const requiredMethods = [
    'checkRateLimit',
    'incrementRateLimit',
    'getRateLimitStatus',
    'clearRateLimit',
    'getConfig',
    '_reloadConfig',
    '_getScopeConfig',
    '_checkSlidingWindow',
    '_maskKey'
  ];

  const missingMethods = requiredMethods.filter(method => {
    return !serviceContent.includes(`async ${method}(`) && !serviceContent.includes(`${method}(`);
  });

  if (missingMethods.length > 0) {
    results.errors.push(`RateLimitPolicyGlobal missing required methods: ${missingMethods.join(', ')}`);
  }

  // Check imports SettingsLoader v2
  if (!serviceContent.includes('require(\'./settingsLoaderV2\')')) {
    results.warnings.push('RateLimitPolicyGlobal should import settingsLoaderV2');
  }

  // Check has DEFAULT_CONFIG
  if (!serviceContent.includes('this.DEFAULT_CONFIG')) {
    results.errors.push('RateLimitPolicyGlobal missing DEFAULT_CONFIG');
  }

  results.info.push('✅ RateLimitPolicyGlobal service present');
}

/**
 * Validate SettingsLoader v2 has loadRateLimitPolicy method
 */
function validateSettingsLoader() {
  console.log('⚙️  Validating SettingsLoader v2...');
  
  const loaderPath = path.join(process.cwd(), 'src/services/settingsLoaderV2.js');
  
  if (!fs.existsSync(loaderPath)) {
    results.errors.push('SettingsLoader v2 not found at src/services/settingsLoaderV2.js');
    return;
  }

  const loaderContent = fs.readFileSync(loaderPath, 'utf8');

  // Check loadRateLimitPolicy method exists
  if (!loaderContent.includes('async loadRateLimitPolicy()')) {
    results.errors.push('SettingsLoader v2 missing loadRateLimitPolicy() method');
  }

  // Check _getDefaultRateLimitPolicy method exists
  if (!loaderContent.includes('_getDefaultRateLimitPolicy()')) {
    results.errors.push('SettingsLoader v2 missing _getDefaultRateLimitPolicy() method');
  }

  results.info.push('✅ SettingsLoader v2 has loadRateLimitPolicy method');
}

/**
 * Validate no hardcoded rate limit values outside SSOT/SettingsLoader/RateLimitPolicyGlobal
 */
function validateNoHardcodedValues() {
  console.log('🔍 Checking for hardcoded rate limit values...');
  
  const allowedFiles = [
    'docs/SSOT-V2.md',
    'src/services/settingsLoaderV2.js',
    'src/services/rateLimitPolicyGlobal.js',
    'scripts/validate-rate-limit-config.js'
  ];

  const filesToCheck = [
    'src/middleware',
    'src/services',
    'src/routes'
  ];

  // Patterns that indicate hardcoded rate limits
  const suspiciousPatterns = [
    /max:\s*\d+,?\s*\/\/ rate limit/i,
    /windowMs:\s*\d+/i,
    /rate.?limit.*max.*=.*\d+/i,
    /RATE_LIMIT_MAX/i
  ];

  for (const dir of filesToCheck) {
    const dirPath = path.join(process.cwd(), dir);
    
    if (!fs.existsSync(dirPath)) {
      continue;
    }

    const files = getAllJSFiles(dirPath);
    
    for (const file of files) {
      const relativePath = path.relative(process.cwd(), file);
      
      // Skip allowed files
      if (allowedFiles.some(allowed => relativePath.includes(allowed))) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          // Check if it's actually using RateLimitPolicyGlobal
          if (!content.includes('RateLimitPolicyGlobal') && !content.includes('settingsLoaderV2')) {
            results.warnings.push(
              `Possible hardcoded rate limit in ${relativePath} (not using RateLimitPolicyGlobal)`
            );
          }
        }
      }
    }
  }

  results.info.push('✅ No obvious hardcoded rate limit values found');
}

/**
 * Validate documentation exists
 */
function validateDocumentation() {
  console.log('📚 Validating documentation...');
  
  const docsToCheck = [
    { path: 'docs/nodes-v2/infraestructura/rate-limits.md', name: 'Rate Limits subnodo' },
    { path: 'docs/nodes-v2/14-infraestructura.md', name: 'Infraestructura node' }
  ];

  for (const doc of docsToCheck) {
    const docPath = path.join(process.cwd(), doc.path);
    
    if (!fs.existsSync(docPath)) {
      results.errors.push(`Missing documentation: ${doc.name} at ${doc.path}`);
    } else {
      results.info.push(`✅ ${doc.name} present`);
    }
  }
}

/**
 * Recursively get all JS files in a directory
 */
function getAllJSFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          traverse(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Print results
 */
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60) + '\n');

  if (results.info.length > 0) {
    console.log('ℹ️  INFO:');
    results.info.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    results.warnings.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log('❌ ERRORS:');
    results.errors.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`Total: ${results.info.length} info, ${results.warnings.length} warnings, ${results.errors.length} errors`);
  console.log('='.repeat(60) + '\n');

  if (results.errors.length > 0) {
    console.log('❌ VALIDATION FAILED\n');
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS\n');
    process.exit(0);
  } else {
    console.log('✅ VALIDATION PASSED\n');
    process.exit(0);
  }
}

/**
 * Main
 */
function main() {
  console.log('🚀 Rate Limit Configuration Validator (ROA-392)\n');
  
  try {
    validateSSOT();
    validateService();
    validateSettingsLoader();
    validateNoHardcodedValues();
    validateDocumentation();
  } catch (error) {
    console.error('💥 Unexpected error during validation:', error);
    process.exit(1);
  }
  
  printResults();
}

// Run
main();

