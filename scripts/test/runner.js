#!/usr/bin/env node

/**
 * CLI Test Runner for Roastr.ai
 * Issue #277 - Complete CLI tools implementation
 * 
 * Advanced test runner with scope filtering, platform support, and mock mode
 * Also supports linting and type checking tasks
 */

const { program } = require('commander');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test scopes configuration
const TEST_SCOPES = {
  unit: {
    description: 'Run unit tests only',
    patterns: [
      'tests/unit/**/*.test.js'
    ],
    mockModeRecommended: true
  },
  integration: {
    description: 'Run integration tests only', 
    patterns: [
      'tests/integration/**/*.test.js'
    ],
    mockModeRecommended: false
  },
  smoke: {
    description: 'Run smoke tests only',
    patterns: [
      'tests/smoke/**/*.test.js'
    ],
    mockModeRecommended: true
  },
  routes: {
    description: 'Run API route tests',
    patterns: [
      'tests/unit/routes/**/*.test.js'
    ],
    mockModeRecommended: true
  },
  services: {
    description: 'Run service layer tests',
    patterns: [
      'tests/unit/services/**/*.test.js'
    ],
    mockModeRecommended: true
  },
  workers: {
    description: 'Run background worker tests',
    patterns: [
      'tests/unit/workers/**/*.test.js'
    ],
    mockModeRecommended: true
  },
  middleware: {
    description: 'Run middleware tests',
    patterns: [
      'tests/unit/middleware/**/*.test.js'
    ],
    mockModeRecommended: true
  },
  billing: {
    description: 'Run billing and payment tests',
    patterns: [
      'tests/unit/routes/billing*.test.js',
      'tests/unit/services/*billing*.test.js',
      'tests/unit/workers/*billing*.test.js'
    ],
    mockModeRecommended: true,
    requiresEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  },
  security: {
    description: 'Run security and auth tests',
    patterns: [
      'tests/unit/routes/auth*.test.js',
      'tests/unit/middleware/auth*.test.js',
      'tests/unit/services/auth*.test.js',
      'tests/unit/middleware/security*.test.js'
    ],
    mockModeRecommended: true
  },
  all: {
    description: 'Run all tests',
    patterns: [
      'tests/**/*.test.js'
    ],
    mockModeRecommended: false
  }
};

// Platform filters
const PLATFORM_FILTERS = {
  twitter: 'twitter|Twitter',
  youtube: 'youtube|YouTube',  
  instagram: 'instagram|Instagram',
  facebook: 'facebook|Facebook',
  discord: 'discord|Discord',
  twitch: 'twitch|Twitch',
  reddit: 'reddit|Reddit',
  tiktok: 'tiktok|TikTok',
  bluesky: 'bluesky|Bluesky'
};

/**
 * Print available scopes
 */
function listScopes() {
  console.log('📋 Available test scopes:\n');
  
  Object.entries(TEST_SCOPES).forEach(([scope, config]) => {
    const mockIcon = config.mockModeRecommended ? '🔶' : '🔷';
    console.log(`  ${mockIcon} ${scope.padEnd(12)} - ${config.description}`);
    
    if (config.requiresEnvVars) {
      console.log(`    ${''.padEnd(12)}   Requires: ${config.requiresEnvVars.join(', ')}`);
    }
  });
  
  console.log('\n📝 Legend:');
  console.log('  🔶 Mock mode recommended');
  console.log('  🔷 Real mode recommended');
  console.log('\n🌐 Available platforms:', Object.keys(PLATFORM_FILTERS).join(', '));
}

/**
 * Print available platforms
 */
function listPlatforms(options = {}) {
  const names = Object.keys(PLATFORM_FILTERS);
  if (options.json) {
    console.log(JSON.stringify({ platforms: names }, null, 2));
    return;
  }
  console.log('🌐 Available platforms:\n');
  names.forEach((p) => console.log(`  - ${p}`));
}

/**
 * Check if required environment variables are set
 */
function checkRequiredEnvVars(scope) {
  const scopeConfig = TEST_SCOPES[scope];
  if (!scopeConfig?.requiresEnvVars) return true;
  
  const missingVars = scopeConfig.requiresEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables for scope '${scope}':`);
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Tip: Set these variables in your .env file or use --mock-mode');
    return false;
  }
  
  return true;
}

/**
 * Build Jest command with proper configuration
 */
function buildJestCommand(scope, options) {
  const scopeConfig = TEST_SCOPES[scope];
  if (!scopeConfig) {
    const available = Object.keys(TEST_SCOPES).join(', ');
    throw new Error(`Invalid scope: '${scope}'. Available: ${available}. Use 'list-scopes' for details.`);
  }
  
  let cmd = ['npx', 'jest'];
  let env = { ...process.env };
  
  // Configure mock mode
  if (options.mockMode) {
    env.ENABLE_MOCK_MODE = 'true';
    cmd.push('--config=jest.skipExternal.config.js');
    console.log('🔶 Running in mock mode');
  } else {
    console.log('🔷 Running in real mode');
  }
  
  // Add test patterns
  if (scope !== 'all') {
    scopeConfig.patterns.forEach(pattern => {
      cmd.push(pattern);
    });
  }
  
  // Add platform filter
  if (options.platform) {
    const platformPattern = PLATFORM_FILTERS[options.platform.toLowerCase()];
    if (!platformPattern) {
      throw new Error(`Invalid platform: '${options.platform}'. Available: ${Object.keys(PLATFORM_FILTERS).join(', ')}`);
    }
    cmd.push('--testNamePattern', platformPattern);
    console.log(`🌐 Filtering by platform: ${options.platform}`);
  }
  
  // Add additional Jest options
  if (options.coverage) {
    cmd.push('--coverage');
    if (options.coverageReporters) {
      options.coverageReporters.split(',').forEach(reporter => {
        cmd.push('--coverageReporters', reporter.trim());
      });
    }
  }
  
  if (options.verbose) {
    cmd.push('--verbose');
  }
  
  if (options.silent) {
    cmd.push('--silent');
  }
  
  if (options.watchAll === false || options.ci) {
    cmd.push('--watchAll=false');
  }
  
  if (options.runInBand) {
    cmd.push('--runInBand');
  }
  
  if (options.testTimeout) {
    cmd.push('--testTimeout', options.testTimeout);
  }
  
  return { cmd, env };
}

/**
 * Execute Jest command
 */
function runJestCommand(cmd, env) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Executing: ${cmd.join(' ')}\n`);
    
    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: 'inherit',
      env,
      cwd: path.resolve(__dirname, '../..')
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Tests completed successfully');
        resolve(code);
      } else {
        console.log(`\n❌ Tests failed with exit code ${code}`);
        resolve(code);
      }
    });
    
    child.on('error', (error) => {
      console.error('❌ Failed to start test runner:', error.message);
      reject(error);
    });
  });
}

/**
 * Run a generic command with spawn and inherit stdio
 */
function runCommand(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    const cwd = options.cwd || path.resolve(__dirname, '../..');
    const env = { ...process.env, ...(options.env || {}) };
    console.log(`🚀 Executing: ${cmd.join(' ')} (cwd: ${cwd})\n`);
    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: 'inherit',
      env,
      cwd
    });
    child.on('close', (code) => resolve(code));
    child.on('error', (error) => reject(error));
  });
}

/**
 * Lint command
 */
async function runLint(options) {
  try {
    console.log('🔎 Running ESLint...');

    const cmd = ['npx', 'eslint', 'src/', 'tests/', '--quiet', '--no-error-on-unmatched-pattern'];
    if (options.fix) cmd.push('--fix');

    const exitCode = await runCommand(cmd);
    if (exitCode === 0) {
      console.log('\n✅ Lint completed successfully');
    } else {
      console.log(`\n❌ Lint failed with exit code ${exitCode}`);
    }
    if (options.json) {
      console.log(JSON.stringify({ command: 'lint', exitCode }, null, 2));
    }
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Error running lint:', error.message);
    process.exit(1);
  }
}

/**
 * Typecheck command (TypeScript if available)
 * - Looks for tsconfig.json in repo root and frontend/
 * - Runs `npx tsc --noEmit` where found
 * - Gracefully skips if no TypeScript configuration is detected
 */
async function runTypecheck() {
  try {
    console.log('🔡 Running type check...');

    const searchDirs = [path.resolve(__dirname, '../..'), path.resolve(__dirname, '../../frontend')];
    const found = searchDirs.filter(dir => fs.existsSync(path.join(dir, 'tsconfig.json')));

    if (found.length === 0) {
      console.log('ℹ️ No tsconfig.json found. Skipping typecheck.');
      if (process.env.RUNNER_JSON === '1') {
        console.log(JSON.stringify({ command: 'typecheck', skipped: true, exitCode: 0 }, null, 2));
      }
      process.exit(0);
      return;
    }

    let overallExit = 0;
    for (const dir of found) {
      console.log(`📁 Typechecking in: ${dir}`);
      const code = await runCommand(['npx', 'tsc', '--noEmit'], { cwd: dir });
      if (code !== 0) overallExit = code;
    }

    if (overallExit === 0) {
      console.log('\n✅ Typecheck passed');
    } else {
      console.log(`\n❌ Typecheck failed with exit code ${overallExit}`);
    }
    if (process.env.RUNNER_JSON === '1') {
      console.log(JSON.stringify({ command: 'typecheck', skipped: false, exitCode: overallExit }, null, 2));
    }
    process.exit(overallExit);
  } catch (error) {
    console.error('❌ Error running typecheck:', error.message);
    process.exit(1);
  }
}

/**
 * Combined check: lint then typecheck
 */
async function runCheck(options) {
  try {
    console.log('🧰 Running lint + typecheck...');
    const lintCmd = ['npx', 'eslint', 'src/', 'tests/', '--quiet', '--no-error-on-unmatched-pattern'];
    if (options.fix) lintCmd.push('--fix');
    const lintCode = await runCommand(lintCmd);
    if (lintCode !== 0) {
      console.log('\n❌ Lint failed, skipping typecheck');
      if (options.json) {
        console.log(JSON.stringify({ command: 'check', lintExitCode: lintCode, typecheck: { skipped: true } }, null, 2));
      }
      process.exit(lintCode);
      return;
    }

    // Reuse typecheck logic
    const searchDirs = [path.resolve(__dirname, '../..'), path.resolve(__dirname, '../../frontend')];
    const found = searchDirs.filter(dir => fs.existsSync(path.join(dir, 'tsconfig.json')));
    if (found.length === 0) {
      console.log('\nℹ️ No tsconfig.json found. Typecheck skipped.');
      console.log('✅ Check completed (lint passed)');
      if (options.json) {
        console.log(JSON.stringify({ command: 'check', lintExitCode: 0, typecheck: { skipped: true, exitCode: 0 } }, null, 2));
      }
      process.exit(0);
      return;
    }
    let overallExit = 0;
    for (const dir of found) {
      console.log(`\n📁 Typechecking in: ${dir}`);
      const code = await runCommand(['npx', 'tsc', '--noEmit'], { cwd: dir });
      if (code !== 0) overallExit = code;
    }
    if (options.json) {
      console.log(JSON.stringify({ command: 'check', lintExitCode: 0, typecheck: { skipped: false, exitCode: overallExit } }, null, 2));
    }
    process.exit(overallExit);
  } catch (error) {
    console.error('❌ Error running check:', error.message);
    process.exit(1);
  }
}

/**
 * Main run command
 */
async function runTests(scope, options) {
  try {
    // Validate scope
    if (!TEST_SCOPES[scope]) {
      const available = Object.keys(TEST_SCOPES).join(', ');
      console.error(`❌ Invalid scope: '${scope}'. Available: ${available}`);
      console.log("\n💡 Tip: run 'node scripts/test/runner.js list-scopes' to see details");
      process.exit(1);
    }
    
    // Check environment variables
    if (!options.mockMode && !checkRequiredEnvVars(scope)) {
      process.exit(1);
    }
    
    // Show recommendations
    const scopeConfig = TEST_SCOPES[scope];
    if (!options.mockMode && scopeConfig.mockModeRecommended) {
      console.log('💡 Consider using --mock-mode for faster execution');
    }
    
    console.log(`🧪 Running ${scope} tests...`);
    
    // Build and execute command
    const { cmd, env } = buildJestCommand(scope, options);
    const exitCode = await runJestCommand(cmd, env);
    if (options.json) {
      const summary = {
        command: 'run',
        scope,
        platform: options.platform || null,
        mockMode: !!options.mockMode,
        exitCode
      };
      console.log(JSON.stringify(summary, null, 2));
    }
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Error running tests:', error.message);
    process.exit(1);
  }
}

// CLI Configuration
program
  .name('test-runner')
  .description('Advanced CLI test runner for Roastr.ai')
  .version('1.0.0');

program
  .command('list-scopes')
  .description('List all available test scopes')
  .action(listScopes);

program
  .command('run <scope>')
  .description('Run tests for a specific scope')
  .option('--mock-mode', 'Enable mock mode for faster execution')
  .option('--platform <platform>', 'Filter tests by platform (twitter, youtube, etc.)')
  .option('--coverage', 'Generate coverage report')
  .option('--coverage-reporters <reporters>', 'Coverage reporters (comma-separated)', 'text,html')
  .option('--verbose', 'Enable verbose output')
  .option('--silent', 'Run in silent mode')
  .option('--ci', 'Run in CI mode (no watch)')
  .option('--run-in-band', 'Run tests serially')
  .option('--test-timeout <ms>', 'Test timeout in milliseconds', '10000')
  .option('--json', 'Print JSON summary for CI')
  .action(runTests);

// Lint command
program
  .command('lint')
  .description('Run ESLint on backend (src/) and tests')
  .option('--fix', 'Automatically fix problems')
  .option('--json', 'Print JSON summary for CI')
  .action(runLint);

// Typecheck command
program
  .command('typecheck')
  .description('Run TypeScript type checking if configured')
  .option('--json', 'Print JSON summary for CI')
  .action(runTypecheck);

// Combined check
program
  .command('check')
  .description('Run lint then typecheck')
  .option('--fix', 'Automatically fix problems before typecheck')
  .option('--json', 'Print JSON summary for CI')
  .action(runCheck);

// List platforms
program
  .command('list-platforms')
  .description('List available platform filters')
  .option('--json', 'Print JSON output')
  .action(listPlatforms);

// Default help
if (process.argv.length === 2) {
  program.help();
}

program.parse();
