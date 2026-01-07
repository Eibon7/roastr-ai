#!/usr/bin/env node

/**
 * V2 Infrastructure Audit Script
 *
 * Audits the common V2 infrastructure to detect gaps and dependencies on V1
 *
 * Issue: ROA-369 - Auditoría y completar infraestructura común V2
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

const results = {
  ssot: { status: 'unknown', issues: [] },
  supabase: { status: 'unknown', issues: [] },
  settingsLoader: { status: 'unknown', issues: [] },
  endpoints: { status: 'unknown', issues: [] },
  featureFlags: { status: 'unknown', issues: [] },
  gatekeeper: { status: 'unknown', issues: [] },
  observability: { status: 'unknown', issues: [] },
  ci: { status: 'unknown', issues: [] },
  cursorAgents: { status: 'unknown', issues: [] }
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    return { exists: true, path: fullPath };
  }
  return { exists: false, path: fullPath };
}

function checkSSOT() {
  log('\n📋 Auditing SSOT v2...', 'cyan');

  const ssotPath = 'docs/SSOT-V2.md';
  const ssotFile = checkFileExists(ssotPath, 'SSOT-V2.md');

  if (!ssotFile.exists) {
    results.ssot.status = 'missing';
    results.ssot.issues.push('SSOT-V2.md does not exist');
    return;
  }

  const content = fs.readFileSync(ssotFile.path, 'utf8');

  // Check for required sections
  const requiredSections = [
    'Planes y Límites',
    'Billing v2',
    'Feature Flags v2',
    'Gatekeeper',
    'Observabilidad'
  ];

  const missingSections = requiredSections.filter((section) => !content.includes(section));

  if (missingSections.length > 0) {
    results.ssot.status = 'incomplete';
    results.ssot.issues.push(`Missing sections: ${missingSections.join(', ')}`);
  } else {
    results.ssot.status = 'ok';
  }

  // Check for legacy plan references
  try {
    const legacyRefs = execSync(
      `grep -r "free\\|basic\\|creator_plus" src/ --exclude-dir=node_modules | head -20 || true`,
      { encoding: 'utf8', cwd: process.cwd() }
    );

    if (legacyRefs.trim()) {
      results.ssot.status = results.ssot.status === 'ok' ? 'warning' : results.ssot.status;
      results.ssot.issues.push('Legacy plan references found in code (free, basic, creator_plus)');
    }
  } catch (_) {
    // grep may fail if no matches, which is fine
  }
}

function checkSupabase() {
  log('\n🗄️  Auditing Supabase...', 'cyan');

  // Check admin_settings table migration
  const migrations = ['supabase/migrations', 'database/migrations'];

  let foundAdminSettings = false;

  for (const migrationDir of migrations) {
    const dir = checkFileExists(migrationDir, migrationDir);
    if (dir.exists) {
      try {
        const files = fs.readdirSync(dir.path);
        for (const file of files) {
          if (file.endsWith('.sql')) {
            const content = fs.readFileSync(path.join(dir.path, file), 'utf8');
            if (
              content.includes('admin_settings') ||
              content.includes('CREATE TABLE admin_settings')
            ) {
              foundAdminSettings = true;
              break;
            }
          }
        }
      } catch (_) {
        // Directory might not exist
      }
    }
  }

  if (!foundAdminSettings) {
    results.supabase.status = 'warning';
    results.supabase.issues.push('admin_settings table migration not found');
  } else {
    results.supabase.status = 'ok';
  }

  // Check schema.sql
  const schemaFile = checkFileExists('database/schema.sql', 'schema.sql');
  if (schemaFile.exists) {
    const content = fs.readFileSync(schemaFile.path, 'utf8');
    if (!content.includes('admin_settings')) {
      results.supabase.status =
        results.supabase.status === 'ok' ? 'warning' : results.supabase.status;
      results.supabase.issues.push('admin_settings not mentioned in schema.sql');
    }
  }
}

function checkSettingsLoader() {
  log('\n⚙️  Auditing SettingsLoader v2...', 'cyan');

  const loaderFile = checkFileExists('src/services/settingsLoaderV2.js', 'settingsLoaderV2.js');

  if (!loaderFile.exists) {
    results.settingsLoader.status = 'missing';
    results.settingsLoader.issues.push('settingsLoaderV2.js does not exist');
    return;
  }

  const content = fs.readFileSync(loaderFile.path, 'utf8');

  // Check for required methods
  const requiredMethods = [
    'loadStaticConfig',
    'loadDynamicConfig',
    'getMergedConfig',
    'getValue',
    'invalidateCache'
  ];

  const missingMethods = requiredMethods.filter((method) => !content.includes(method));

  if (missingMethods.length > 0) {
    results.settingsLoader.status = 'incomplete';
    results.settingsLoader.issues.push(`Missing methods: ${missingMethods.join(', ')}`);
  } else {
    results.settingsLoader.status = 'ok';
  }

  // Check for admin-controlled.yaml
  const yamlPaths = [
    'apps/backend-v2/src/config/admin-controlled.yaml',
    'config/admin-controlled.yaml'
  ];

  let foundYaml = false;
  for (const yamlPath of yamlPaths) {
    const yamlFile = checkFileExists(yamlPath, yamlPath);
    if (yamlFile.exists) {
      foundYaml = true;
      break;
    }
  }

  if (!foundYaml) {
    results.settingsLoader.status =
      results.settingsLoader.status === 'ok' ? 'warning' : results.settingsLoader.status;
    results.settingsLoader.issues.push('admin-controlled.yaml not found in expected locations');
  }
}

function checkEndpoints() {
  log('\n🌐 Auditing V2 Endpoints...', 'cyan');

  const endpoints = {
    public: checkFileExists('src/routes/v2/settings.js', 'v2/settings.js'),
    admin: checkFileExists('src/routes/v2/admin/settings.js', 'v2/admin/settings.js')
  };

  if (!endpoints.public.exists) {
    results.endpoints.status = 'missing';
    results.endpoints.issues.push('/api/v2/settings/* endpoints missing');
  } else if (!endpoints.admin.exists) {
    results.endpoints.status = 'incomplete';
    results.endpoints.issues.push('/api/v2/admin/settings/* endpoints missing');
  } else {
    results.endpoints.status = 'ok';
  }

  // Check if routes are registered in main app
  const indexFile = checkFileExists('src/index.js', 'index.js');
  if (indexFile.exists) {
    const content = fs.readFileSync(indexFile.path, 'utf8');
    if (!content.includes('/api/v2/settings') && !content.includes('v2/settings')) {
      results.endpoints.status =
        results.endpoints.status === 'ok' ? 'warning' : results.endpoints.status;
      results.endpoints.issues.push('V2 endpoints may not be registered in main app');
    }
  }
}

function checkFeatureFlags() {
  log('\n🚩 Auditing Feature Flags v2...', 'cyan');

  // Check if feature flags use admin_settings.feature_flags (SSOT v2) or separate table
  const featureFlagsFile = checkFileExists(
    'src/routes/admin/featureFlags.js',
    'admin/featureFlags.js'
  );

  if (featureFlagsFile.exists) {
    const content = fs.readFileSync(featureFlagsFile.path, 'utf8');

    // Check if it uses feature_flags table (v1) or admin_settings.feature_flags (v2)
    if (content.includes("from('feature_flags')")) {
      results.featureFlags.status = 'legacy';
      results.featureFlags.issues.push(
        'Feature flags use legacy feature_flags table instead of admin_settings.feature_flags'
      );
    } else if (content.includes('admin_settings')) {
      results.featureFlags.status = 'ok';
    } else {
      results.featureFlags.status = 'unknown';
      results.featureFlags.issues.push('Cannot determine feature flags implementation');
    }
  } else {
    results.featureFlags.status = 'missing';
    results.featureFlags.issues.push('Feature flags routes not found');
  }
}

function checkGatekeeper() {
  log('\n🛡️  Auditing Gatekeeper...', 'cyan');

  const gatekeeperFile = checkFileExists(
    'src/services/gatekeeperService.js',
    'gatekeeperService.js'
  );

  if (!gatekeeperFile.exists) {
    results.gatekeeper.status = 'missing';
    results.gatekeeper.issues.push('gatekeeperService.js does not exist');
    return;
  }

  const content = fs.readFileSync(gatekeeperFile.path, 'utf8');

  // Check if it uses SettingsLoader v2
  if (content.includes('SettingsLoader v2') || content.includes('settingsLoaderV2')) {
    results.gatekeeper.status = 'ok';
  } else {
    results.gatekeeper.status = 'warning';
    results.gatekeeper.issues.push('Gatekeeper may not be using SettingsLoader v2');
  }
}

function checkObservability() {
  log('\n📊 Auditing Observability...', 'cyan');

  const loggerFile = checkFileExists('src/utils/logger.js', 'logger.js');
  const errorTaxonomyFile = checkFileExists(
    'src/utils/authErrorTaxonomy.js',
    'authErrorTaxonomy.js'
  );

  if (!loggerFile.exists) {
    results.observability.status = 'missing';
    results.observability.issues.push('logger.js does not exist');
  } else {
    const content = fs.readFileSync(loggerFile.path, 'utf8');

    // Check for structured logging
    if (content.includes('JSON.stringify') || content.includes('structured')) {
      results.observability.status = 'ok';
    } else {
      results.observability.status = 'warning';
      results.observability.issues.push('Logger may not support structured logging');
    }
  }

  if (!errorTaxonomyFile.exists) {
    results.observability.status =
      results.observability.status === 'ok' ? 'warning' : results.observability.status;
    results.observability.issues.push('Error taxonomy file not found');
  }
}

function checkCI() {
  log('\n🔄 Auditing CI / GitHub Actions...', 'cyan');

  const ciFile = checkFileExists('.github/workflows/ci.yml', 'ci.yml');

  if (!ciFile.exists) {
    results.ci.status = 'missing';
    results.ci.issues.push('CI workflow not found');
    return;
  }

  const content = fs.readFileSync(ciFile.path, 'utf8');

  // Check for Vitest
  if (content.includes('vitest') || content.includes('Vitest')) {
    results.ci.status = 'ok';
  } else {
    results.ci.status = 'warning';
    results.ci.issues.push('CI may not be using Vitest-first approach');
  }

  // Check for v2 validators
  const validators = [
    'validate-v2-doc-paths',
    'validate-ssot-health',
    'check-system-map-drift',
    'validate-strong-concepts'
  ];

  const missingValidators = validators.filter((validator) => {
    const validatorFile = checkFileExists(`scripts/${validator}.js`, `${validator}.js`);
    return !validatorFile.exists;
  });

  if (missingValidators.length > 0) {
    results.ci.status = results.ci.status === 'ok' ? 'warning' : results.ci.status;
    results.ci.issues.push(`Missing validators: ${missingValidators.join(', ')}`);
  }
}

function checkCursorAgents() {
  log('\n🤖 Auditing Cursor / Agents...', 'cyan');

  const manifestFile = checkFileExists('agents/manifest.yaml', 'manifest.yaml');
  const autoActivationFile = checkFileExists(
    'scripts/cursor-agents/auto-gdd-activation.js',
    'auto-gdd-activation.js'
  );

  if (!manifestFile.exists) {
    results.cursorAgents.status = 'missing';
    results.cursorAgents.issues.push('Agent manifest not found');
  } else if (!autoActivationFile.exists) {
    results.cursorAgents.status = 'incomplete';
    results.cursorAgents.issues.push('Auto GDD activation script not found');
  } else {
    results.cursorAgents.status = 'ok';
  }

  // Check for SSOT enforcement rules
  const rulesDir = checkFileExists('.cursor/rules', '.cursor/rules');
  if (rulesDir.exists) {
    const files = fs.readdirSync(rulesDir.path);
    if (!files.some((f) => f.includes('ssot') || f.includes('v2'))) {
      results.cursorAgents.status =
        results.cursorAgents.status === 'ok' ? 'warning' : results.cursorAgents.status;
      results.cursorAgents.issues.push('SSOT enforcement rules may be missing');
    }
  }
}

function printResults() {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 V2 Infrastructure Audit Results', 'cyan');
  log('='.repeat(60), 'cyan');

  const components = [
    { key: 'ssot', name: 'SSOT v2' },
    { key: 'supabase', name: 'Supabase' },
    { key: 'settingsLoader', name: 'SettingsLoader v2' },
    { key: 'endpoints', name: 'V2 Endpoints' },
    { key: 'featureFlags', name: 'Feature Flags v2' },
    { key: 'gatekeeper', name: 'Gatekeeper' },
    { key: 'observability', name: 'Observability' },
    { key: 'ci', name: 'CI / GitHub Actions' },
    { key: 'cursorAgents', name: 'Cursor / Agents' }
  ];

  for (const component of components) {
    const result = results[component.key];
    let statusColor = 'green';
    let statusIcon = '✅';

    if (result.status === 'missing') {
      statusColor = 'red';
      statusIcon = '❌';
    } else if (
      result.status === 'incomplete' ||
      result.status === 'warning' ||
      result.status === 'legacy'
    ) {
      statusColor = 'yellow';
      statusIcon = '⚠️';
    }

    log(`\n${statusIcon} ${component.name}: ${result.status}`, statusColor);

    if (result.issues.length > 0) {
      result.issues.forEach((issue) => {
        log(`   • ${issue}`, 'yellow');
      });
    }
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📈 Summary', 'cyan');
  log('='.repeat(60), 'cyan');

  const okCount = Object.values(results).filter((r) => r.status === 'ok').length;
  const warningCount = Object.values(results).filter(
    (r) => r.status === 'warning' || r.status === 'incomplete' || r.status === 'legacy'
  ).length;
  const missingCount = Object.values(results).filter((r) => r.status === 'missing').length;

  log(`✅ OK: ${okCount}`, 'green');
  log(`⚠️  Warnings: ${warningCount}`, 'yellow');
  log(`❌ Missing: ${missingCount}`, 'red');

  if (warningCount === 0 && missingCount === 0) {
    log('\n🎉 All components are ready!', 'green');
  } else {
    log('\n⚠️  Some components need attention. Review issues above.', 'yellow');
  }
}

// Main execution
log('🔍 Starting V2 Infrastructure Audit...', 'blue');
log('Issue: ROA-369', 'blue');

checkSSOT();
checkSupabase();
checkSettingsLoader();
checkEndpoints();
checkFeatureFlags();
checkGatekeeper();
checkObservability();
checkCI();
checkCursorAgents();

printResults();

// Exit with appropriate code
const hasErrors = Object.values(results).some((r) => r.status === 'missing');
process.exit(hasErrors ? 1 : 0);
