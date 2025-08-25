#!/usr/bin/env node

/**
 * API Readiness Validation Script - Issue #90
 * 
 * Comprehensive validation script that runs all readiness tests and generates a report.
 * This script can be used in CI/CD pipelines to validate API integration readiness.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Import environment configuration
const {
  getCurrentEnvironment,
  validateCredentials,
  isRealApiEnabled
} = require('../config/environments');

class ApiReadinessValidator {
  constructor() {
    this.results = {
      environment: null,
      credentials: null,
      tests: {
        realApiValidation: { status: 'pending', details: null },
        environmentConfig: { status: 'pending', details: null },
        oauthFlows: { status: 'pending', details: null },
        errorHandling: { status: 'pending', details: null },
        rateLimiting: { status: 'pending', details: null }
      },
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        readyForProduction: false
      }
    };
  }

  /**
   * Run all validation checks
   */
  async validate() {
    console.log('🔍 Starting API Readiness Validation...\n');

    try {
      await this.validateEnvironment();
      await this.validateCredentials();
      await this.runTestSuites();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate current environment setup
   */
  async validateEnvironment() {
    console.log('📋 Validating environment configuration...');
    
    try {
      const env = getCurrentEnvironment();
      this.results.environment = {
        name: env.name,
        features: env.features,
        limits: env.limits
      };

      console.log(`✅ Environment: ${env.name}`);
      console.log(`   Real API calls: ${env.features.realApiCalls ? 'Enabled' : 'Disabled'}`);
      console.log(`   Error simulation: ${env.features.errorSimulation ? 'Enabled' : 'Disabled'}`);
      console.log(`   Rate limit testing: ${env.features.rateLimitTesting ? 'Enabled' : 'Disabled'}\n`);
    } catch (error) {
      console.error('❌ Environment validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate API credentials
   */
  async validateCredentials() {
    console.log('🔑 Validating API credentials...');

    try {
      const validation = validateCredentials();
      this.results.credentials = validation;

      if (validation.valid) {
        console.log('✅ All required credentials are present');
      } else {
        console.log('⚠️  Some credentials are missing:');
        validation.missing.forEach(cred => {
          console.log(`   - ${cred}`);
        });
      }

      if (validation.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        validation.warnings.forEach(warning => {
          console.log(`   - ${warning}`);
        });
      }

      console.log('');
    } catch (error) {
      console.error('❌ Credential validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Run test suites
   */
  async runTestSuites() {
    console.log('🧪 Running test suites...\n');

    const testSuites = [
      {
        name: 'realApiValidation',
        description: 'Real API Validation Tests',
        file: 'tests/integration/real-api-validation.test.js'
      },
      {
        name: 'environmentConfig',
        description: 'Environment Configuration Tests',
        file: 'tests/unit/config/environment-validation.test.js'
      },
      {
        name: 'oauthFlows',
        description: 'OAuth Flow Validation Tests',
        file: 'tests/integration/oauth-flow-validation.test.js'
      },
      {
        name: 'errorHandling',
        description: 'Production Error Handling Tests',
        file: 'tests/integration/production-error-handling.test.js'
      },
      {
        name: 'rateLimiting',
        description: 'Rate Limiting and Token Expiration Tests',
        file: 'tests/integration/rate-limiting-token-expiration.test.js'
      }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }
  }

  /**
   * Run individual test suite
   */
  async runTestSuite(suite) {
    console.log(`📝 Running ${suite.description}...`);

    try {
      const result = await this.executeTest(suite.file);
      
      this.results.tests[suite.name] = {
        status: result.success ? 'passed' : 'failed',
        details: {
          testsRun: result.testsRun,
          testsPassed: result.testsPassed,
          testsFailed: result.testsFailed,
          duration: result.duration,
          output: result.output
        }
      };

      if (result.success) {
        console.log(`✅ ${suite.description}: ${result.testsPassed}/${result.testsRun} tests passed`);
        this.results.summary.passed++;
      } else {
        console.log(`❌ ${suite.description}: ${result.testsFailed}/${result.testsRun} tests failed`);
        this.results.summary.failed++;
      }

      console.log('');
    } catch (error) {
      console.log(`❌ ${suite.description}: Test execution failed`);
      console.log(`   Error: ${error.message}\n`);
      
      this.results.tests[suite.name] = {
        status: 'failed',
        details: { error: error.message }
      };
      this.results.summary.failed++;
    }
  }

  /**
   * Execute test file
   */
  async executeTest(testFile) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const testProcess = spawn('npm', ['test', '--', testFile, '--reporter=json'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ENABLE_MOCK_MODE: 'true' }
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        try {
          // Try to parse Jest JSON output
          const lines = stdout.split('\n').filter(line => line.trim());
          const jsonLine = lines.find(line => line.startsWith('{') && line.includes('"testResults"'));
          
          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            const summary = result.testResults[0];
            
            resolve({
              success: code === 0,
              testsRun: summary.numPassingTests + summary.numFailingTests,
              testsPassed: summary.numPassingTests,
              testsFailed: summary.numFailingTests,
              duration,
              output: stdout
            });
          } else {
            // Fallback for non-JSON output
            resolve({
              success: code === 0,
              testsRun: 1,
              testsPassed: code === 0 ? 1 : 0,
              testsFailed: code === 0 ? 0 : 1,
              duration,
              output: stdout + stderr
            });
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse test output: ${parseError.message}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate final report
   */
  async generateReport() {
    console.log('📊 Generating validation report...\n');

    // Determine production readiness
    const allTestsPassed = this.results.summary.failed === 0;
    const hasValidCredentials = this.results.credentials?.valid || !getCurrentEnvironment().credentials.required;
    
    this.results.summary.readyForProduction = allTestsPassed && hasValidCredentials;

    // Print summary
    console.log('=' * 60);
    console.log('📋 API READINESS VALIDATION SUMMARY');
    console.log('=' * 60);
    console.log(`Environment: ${this.results.environment.name}`);
    console.log(`Tests Passed: ${this.results.summary.passed}`);
    console.log(`Tests Failed: ${this.results.summary.failed}`);
    console.log(`Warnings: ${this.results.summary.warnings}`);
    console.log(`Production Ready: ${this.results.summary.readyForProduction ? '✅ YES' : '❌ NO'}`);
    console.log('=' * 60);

    // Detailed test results
    console.log('\n📝 DETAILED TEST RESULTS:');
    Object.entries(this.results.tests).forEach(([testName, result]) => {
      const status = result.status === 'passed' ? '✅' : '❌';
      console.log(`${status} ${testName}: ${result.status}`);
      
      if (result.details && result.details.testsRun) {
        console.log(`   Tests: ${result.details.testsPassed}/${result.details.testsRun} passed`);
        console.log(`   Duration: ${result.details.duration}ms`);
      }
      
      if (result.details && result.details.error) {
        console.log(`   Error: ${result.details.error}`);
      }
    });

    // Production readiness recommendations
    console.log('\n🎯 PRODUCTION READINESS CHECKLIST:');
    
    if (this.results.summary.readyForProduction) {
      console.log('✅ All validation checks passed');
      console.log('✅ API integration is ready for production deployment');
    } else {
      console.log('❌ Some validation checks failed or require attention:');
      
      if (this.results.summary.failed > 0) {
        console.log('   - Fix failing test suites before deployment');
      }
      
      if (!this.results.credentials?.valid && getCurrentEnvironment().credentials.required) {
        console.log('   - Configure missing API credentials');
        this.results.credentials.missing.forEach(cred => {
          console.log(`     * ${cred}`);
        });
      }
    }

    // Save report to file
    const reportPath = path.join(process.cwd(), 'api-readiness-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(this.results.summary.readyForProduction ? 0 : 1);
  }
}

// CLI interface
if (require.main === module) {
  const validator = new ApiReadinessValidator();
  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ApiReadinessValidator;