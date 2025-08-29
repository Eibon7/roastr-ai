#!/usr/bin/env node

const { Command } = require('commander');
const { spawn } = require('child_process');
const colors = require('colors');
const path = require('path');
const glob = require('glob');

/**
 * Advanced CLI test runner with scope filtering - Issue 82 Phase 4
 * Provides comprehensive test execution with mock mode and platform filtering
 */

const program = new Command();
program.name('test-runner').description('CLI test runner with scope filtering').version('1.0.0');

const TEST_SCOPES = {
  auth: {
    name: 'Authentication & Authorization',
    patterns: ['tests/unit/auth/**/*.test.js', 'tests/integration/auth/**/*.test.js'],
    description: 'User authentication, authorization, and session management tests'
  },
  workers: {
    name: 'Background Workers',
    patterns: ['tests/unit/workers/**/*.test.js', 'tests/integration/workers/**/*.test.js'],
    description: 'Background job processing and queue management tests'
  },
  billing: {
    name: 'Billing & Subscriptions',
    patterns: ['tests/unit/routes/billing*.test.js', 'tests/integration/*billing*.test.js', 'tests/integration/plan-*.test.js', 'tests/integration/stripe*.test.js'],
    description: 'Payment processing, subscription management, and billing tests'
  },
  services: {
    name: 'Core Services',
    patterns: ['tests/unit/services/**/*.test.js'],
    description: 'Core business logic and service layer tests'
  },
  routes: {
    name: 'API Routes',
    patterns: ['tests/unit/routes/**/*.test.js'],
    description: 'API endpoint and routing tests'
  },
  integration: {
    name: 'Integration Tests',
    patterns: ['tests/integration/**/*.test.js'],
    description: 'End-to-end and integration tests'
  }
};

const PLATFORMS = ['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok'];

/**
 * Execute Jest with specified patterns and options
 */
function runJest(patterns, options = {}) {
  return new Promise((resolve, reject) => {
    const jestArgs = [];

    // Add test patterns - convert globs to regex-safe patterns
    if (patterns && patterns.length > 0) {
      const regexPatterns = patterns.map(pattern => {
        // Convert glob patterns to regex-safe patterns
        return pattern
          .replace(/\*\*/g, '.*')        // ** becomes .*
          .replace(/\*/g, '[^/]*')       // * becomes [^/]*
          .replace(/\./g, '\\.')         // Escape dots
          .replace(/\+/g, '\\+')         // Escape plus signs
          .replace(/\?/g, '\\?')         // Escape question marks
          .replace(/\[/g, '\\[')         // Escape square brackets
          .replace(/\]/g, '\\]')         // Escape square brackets
          .replace(/\(/g, '\\(')         // Escape parentheses
          .replace(/\)/g, '\\)');        // Escape parentheses
      });
      jestArgs.push('--testPathPattern', regexPatterns.join('|'));
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

// Command: List available scopes
program
  .command('scopes')
  .description('List all available test scopes')
  .action(() => {
    console.log(colors.cyan('📦 Available Test Scopes:\n'));
    Object.entries(TEST_SCOPES).forEach(([key, scope]) => {
      console.log(colors.yellow(`  ${key.padEnd(12)} - ${scope.name}`));
      console.log(colors.gray(`    ${scope.description}`));
      console.log(colors.gray(`    Patterns: ${scope.patterns.join(', ')}\n`));
    });
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

      const scopeConfig = TEST_SCOPES[scope];
      console.log(colors.cyan(`🎯 Running ${scopeConfig.name} tests...`));
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
        const glob = require('glob');
        return glob.sync(pattern).length > 0;
      });

      if (hasTests) {
        console.log(colors.green(`✅ ${key} scope has test files`));
      } else {
        console.log(colors.yellow(`⚠️  ${key} scope has no test files matching patterns`));
      }
    });

    console.log(colors.green('\n✅ Test setup validation complete'));
  });

// Error handling for unknown commands
program.on('command:*', () => {
  console.error(colors.red('❌ Invalid command: %s'), program.args.join(' '));
  console.log(colors.yellow('Available commands: scopes, run, all, platforms, validate'));
  console.log(colors.gray('Use --help for more information'));
  process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();