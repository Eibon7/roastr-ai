#!/usr/bin/env node

const { Command } = require('commander');
const { spawn } = require('child_process');
const colors = require('colors');
const glob = require('glob');

/**
 * Advanced CLI test runner with scope filtering - Issue 82 Phase 4
 * Provides comprehensive test execution with mock mode and platform filtering
 */

const program = new Command();
program.name('test-runner').description('CLI test runner with scope filtering').version('1.0.0');

const TEST_SCOPES = {
  // Enhanced scopes from PR #282
  unit: {
    description: 'Run unit tests only',
    patterns: ['tests/unit/**/*.test.js'],
    mockModeRecommended: true
  },
  integration: {
    description: 'Run integration tests only',
    patterns: ['tests/integration/**/*.test.js'],
    mockModeRecommended: false
  },
  smoke: {
    description: 'Run smoke tests only',
    patterns: ['tests/smoke/**/*.test.js'],
    mockModeRecommended: true
  },
  routes: {
    description: 'Run API route tests',
    patterns: ['tests/unit/routes/**/*.test.js'],
    mockModeRecommended: true
  },
  services: {
    description: 'Run service layer tests',
    patterns: ['tests/unit/services/**/*.test.js'],
    mockModeRecommended: true
  },
  workers: {
    description: 'Run background worker tests',
    patterns: ['tests/unit/workers/**/*.test.js'],
    mockModeRecommended: true
  },
  middleware: {
    description: 'Run middleware tests',
    patterns: ['tests/unit/middleware/**/*.test.js'],
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
  // Legacy scopes for backward compatibility
  auth: {
    name: 'Authentication & Authorization',
    patterns: ['tests/unit/auth/**/*.test.js', 'tests/integration/auth/**/*.test.js'],
    description: 'User authentication, authorization, and session management tests',
    mockModeRecommended: true
  },
  all: {
    description: 'Run all tests',
    patterns: ['tests/**/*.test.js'],
    mockModeRecommended: false
  }
};

// Enhanced platform filters from PR #282
const PLATFORM_FILTERS = {
  twitter: '\\b(?:twitter|Twitter)\\b',
  youtube: '\\b(?:youtube|YouTube)\\b',
  instagram: '\\b(?:instagram|Instagram)\\b',
  facebook: '\\b(?:facebook|Facebook)\\b',
  discord: '\\b(?:discord|Discord)\\b',
  twitch: '\\b(?:twitch|Twitch)\\b',
  reddit: '\\b(?:reddit|Reddit)\\b',
  tiktok: '\\b(?:tiktok|TikTok)\\b',
  bluesky: '\\b(?:bluesky|Bluesky)\\b'
};

const PLATFORMS = Object.keys(PLATFORM_FILTERS); // For backward compatibility

/**
 * Print available scopes with enhanced formatting from PR #282
 */
function listScopes() {
  console.log(colors.cyan('📋 Available test scopes:\n'));

  Object.entries(TEST_SCOPES).forEach(([scope, config]) => {
    const mockIcon = config.mockModeRecommended ? '🔶' : '🔷';
    console.log(`  ${mockIcon} ${scope.padEnd(12)} - ${config.description}`);

    if (config.requiresEnvVars) {
      console.log(colors.gray(`    ${''.padEnd(12)}   Requires: ${config.requiresEnvVars.join(', ')}`));
    }
  });

  console.log(colors.cyan('\n📝 Legend:'));
  console.log('  🔶 Mock mode recommended');
  console.log('  🔷 Real mode recommended');
  console.log(colors.cyan('\n🌐 Available platforms:'), Object.keys(PLATFORM_FILTERS).join(', '));
}

/**
 * Print available platforms with JSON support from PR #282
 */
function listPlatforms(options = {}) {
  const names = Object.keys(PLATFORM_FILTERS);
  if (options.json) {
    console.log(JSON.stringify({ platforms: names }, null, 2));
    return;
  }
  console.log(colors.cyan('🌐 Available platforms:\n'));
  names.forEach((p) => console.log(`  - ${p}`));
}

/**
 * Check if required environment variables are set from PR #282
 */
function checkRequiredEnvVars(scope) {
  const scopeConfig = TEST_SCOPES[scope];
  if (!scopeConfig?.requiresEnvVars) return true;

  const missingVars = scopeConfig.requiresEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(colors.yellow(`⚠️  Missing required environment variables for ${scope}:`));
    missingVars.forEach(varName => {
      console.log(colors.red(`   - ${varName}`));
    });
    console.log(colors.gray('\nSet these variables before running tests for this scope.'));
    return false;
  }

  return true;
}

/**
 * Execute Jest with specified patterns and options
 */
function runJest(patterns, options = {}) {
  return new Promise((resolve, reject) => {
    const jestArgs = [];

    // Add test patterns - use Jest's native pattern matching
    if (patterns && patterns.length > 0) {
      // Jest can handle simple glob patterns directly
      jestArgs.push('--testPathPatterns', patterns.join('|'));
    }

    // Add mock mode environment variable
    const env = { ...process.env };
    if (options.mockMode) {
      env.ENABLE_MOCK_MODE = 'true';
      console.log(colors.blue('🔧 Mock mode enabled - external services will be mocked'));
    }

    // Add CI mode options
    if (options.ci) {
      jestArgs.push('--ci', '--runInBand', '--silent');
    }

    // Add coverage options
    if (options.coverage) {
      jestArgs.push('--coverage');
    }

    // Add verbose output
    if (options.verbose) {
      jestArgs.push('--verbose');
    }

    // Add platform filtering
    if (options.platform) {
      jestArgs.push('--testNamePattern', options.platform);
      console.log(colors.magenta(`🎯 Filtering tests for platform: ${options.platform}`));
    }

    console.log(colors.green(`🚀 Running Jest with args: ${jestArgs.join(' ')}`));

    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      env
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log(colors.green('✅ Tests completed successfully'));
        resolve();
      } else {
        console.log(colors.red(`❌ Tests failed with exit code ${code}`));
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      console.error(colors.red('❌ Failed to start Jest:'), error.message);
      reject(error);
    });
  });
}

// Command: List available scopes (enhanced from PR #282)
program
  .command('scopes')
  .description('List all available test scopes')
  .action(() => {
    listScopes();
  });

// Command: Run tests by scope
program
  .command('run <scope>')
  .description('Run tests for a specific scope')
  .option('--mock-mode', 'Enable mock mode for external services')
  .option('--platform <platform>', `Filter tests by platform (${PLATFORMS.join(', ')})`)
  .option('--ci', 'Run in CI mode (silent, run in band)')
  .option('--coverage', 'Generate coverage report')
  .option('--verbose', 'Enable verbose output')
  .action(async (scope, options) => {
    try {
      if (!TEST_SCOPES[scope]) {
        console.error(colors.red(`❌ Unknown scope: ${scope}`));
        console.log(colors.yellow('Available scopes:'), Object.keys(TEST_SCOPES).join(', '));
        process.exit(1);
      }

      if (options.platform && !PLATFORMS.includes(options.platform)) {
        console.error(colors.red(`❌ Unknown platform: ${options.platform}`));
        console.log(colors.yellow('Available platforms:'), PLATFORMS.join(', '));
        process.exit(1);
      }

      // Check required environment variables (from PR #282)
      if (!checkRequiredEnvVars(scope)) {
        process.exit(1);
      }

      const scopeConfig = TEST_SCOPES[scope];
      const scopeName = scopeConfig.name || scopeConfig.description;
      console.log(colors.cyan(`🎯 Running ${scopeName} tests...`));
      console.log(colors.gray(`Description: ${scopeConfig.description}\n`));

      await runJest(scopeConfig.patterns, options);

    } catch (error) {
      console.error(colors.red('❌ Test execution failed:'), error.message);
      process.exit(1);
    }
  });

// Command: Run all tests with options
program
  .command('all')
  .description('Run all tests across all scopes')
  .option('--mock-mode', 'Enable mock mode for external services')
  .option('--platform <platform>', `Filter tests by platform (${PLATFORMS.join(', ')})`)
  .option('--ci', 'Run in CI mode (silent, run in band)')
  .option('--coverage', 'Generate coverage report')
  .option('--verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      console.log(colors.cyan('🎯 Running all tests...\n'));

      // Collect all patterns from all scopes
      const allPatterns = Object.values(TEST_SCOPES)
        .flatMap(scope => scope.patterns);

      await runJest(allPatterns, options);

    } catch (error) {
      console.error(colors.red('❌ Test execution failed:'), error.message);
      process.exit(1);
    }
  });

// Command: List platforms
program
  .command('platforms')
  .description('List all available platforms for filtering')
  .action(() => {
    console.log(colors.cyan('🌐 Available Platforms:\n'));
    PLATFORMS.forEach(platform => {
      console.log(colors.yellow(`  ${platform}`));
    });
    console.log(colors.gray('\nUse --platform <name> to filter tests by platform'));
  });

// Command: Validate test setup
program
  .command('validate')
  .description('Validate test configuration and dependencies')
  .action(() => {
    console.log(colors.cyan('🔍 Validating test setup...\n'));

    // Check if Jest is available
    try {
      require.resolve('jest');
      console.log(colors.green('✅ Jest is available'));
    } catch (error) {
      console.log(colors.red('❌ Jest is not installed'));
      return;
    }

    // Check if test directories exist
    const fs = require('fs');
    const testDirs = ['tests/unit', 'tests/integration'];

    testDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        console.log(colors.green(`✅ ${dir} directory exists`));
      } else {
        console.log(colors.yellow(`⚠️  ${dir} directory not found`));
      }
    });

    // Check scope patterns
    console.log(colors.cyan('\n📁 Checking scope patterns:'));
    Object.entries(TEST_SCOPES).forEach(([key, scope]) => {
      const hasTests = scope.patterns.some(pattern => {
        try {
          return glob.sync(pattern).length > 0;
        } catch (error) {
          console.log(colors.yellow(`⚠️  Invalid pattern for ${key}: ${pattern} - ${error.message}`));
          return false;
        }
      });

      if (hasTests) {
        console.log(colors.green(`✅ ${key} scope has test files`));
      } else {
        console.log(colors.yellow(`⚠️  ${key} scope has no test files matching patterns`));
      }
    });

    console.log(colors.green('\n✅ Test setup validation complete'));
  });

// Command: List available platforms (from PR #282)
program
  .command('list-platforms')
  .description('List available platform filters')
  .option('--json', 'Print JSON output')
  .action(listPlatforms);

// Error handling for unknown commands
program.on('command:*', () => {
  console.error(colors.red('❌ Invalid command: %s'), program.args.join(' '));
  console.log(colors.yellow('Available commands: scopes, run, all, list-platforms, validate'));
  console.log(colors.gray('Use --help for more information'));
  process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();