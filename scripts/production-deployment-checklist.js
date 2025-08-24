#!/usr/bin/env node

/**
 * Production Deployment Checklist Script
 * Issue #90: Automated validation of production readiness for social integrations
 * 
 * This script validates all requirements for deploying social media integrations to production
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default || require('node-fetch');

class ProductionReadinessChecker {
  constructor() {
    this.checks = [];
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
    this.requiredEnvVars = [
      'TWITTER_CLIENT_ID',
      'TWITTER_CLIENT_SECRET', 
      'YOUTUBE_CLIENT_ID',
      'YOUTUBE_CLIENT_SECRET',
      'INSTAGRAM_CLIENT_ID',
      'INSTAGRAM_CLIENT_SECRET',
      'TWITTER_WEBHOOK_SECRET',
      'YOUTUBE_WEBHOOK_SECRET',
      'PUBLIC_URL'
    ];
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green  
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'     // Reset
    };

    const icon = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    console.log(`${colors[type]}${icon[type]} ${message}${colors.reset}`);
  }

  async runCheck(name, checkFunction, required = true) {
    try {
      this.log(`Checking: ${name}`, 'info');
      const result = await checkFunction();
      
      if (result.passed) {
        this.results.passed++;
        this.log(`${name}: PASSED`, 'success');
        if (result.details) {
          console.log(`   ${result.details}`);
        }
      } else {
        if (required) {
          this.results.failed++;
          this.log(`${name}: FAILED - ${result.message}`, 'error');
        } else {
          this.results.warnings++;
          this.log(`${name}: WARNING - ${result.message}`, 'warning');
        }
      }

      this.results.details.push({
        name,
        passed: result.passed,
        message: result.message,
        details: result.details,
        required
      });

    } catch (error) {
      this.results.failed++;
      this.log(`${name}: ERROR - ${error.message}`, 'error');
      this.results.details.push({
        name,
        passed: false,
        message: error.message,
        required
      });
    }
  }

  // Environment variable validation
  async checkEnvironmentVariables() {
    const missing = [];
    const present = [];

    for (const envVar of this.requiredEnvVars) {
      if (process.env[envVar]) {
        present.push(envVar);
      } else {
        missing.push(envVar);
      }
    }

    return {
      passed: missing.length === 0,
      message: missing.length > 0 
        ? `Missing required environment variables: ${missing.join(', ')}`
        : `All ${present.length} required environment variables are set`,
      details: `Present: ${present.length}, Missing: ${missing.length}`
    };
  }

  // SSL/HTTPS configuration check
  async checkSSLConfiguration() {
    const publicUrl = process.env.PUBLIC_URL;
    
    if (!publicUrl) {
      return {
        passed: false,
        message: 'PUBLIC_URL environment variable not set'
      };
    }

    if (!publicUrl.startsWith('https://')) {
      return {
        passed: false,
        message: 'PUBLIC_URL must use HTTPS for webhook security'
      };
    }

    try {
      // Basic connectivity test
      const response = await fetch(`${publicUrl}/health`, { 
        timeout: 5000,
        method: 'GET'
      });
      
      return {
        passed: response.ok || response.status === 404, // 404 is fine, means server is responding
        message: response.ok 
          ? 'HTTPS endpoint accessible'
          : `Server responding but health check failed (${response.status})`,
        details: `URL: ${publicUrl}`
      };
    } catch (error) {
      return {
        passed: false,
        message: `HTTPS endpoint not accessible: ${error.message}`,
        details: `URL: ${publicUrl}`
      };
    }
  }

  // Database connectivity check
  async checkDatabaseConnectivity() {
    try {
      // Check if database configuration exists
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return {
          passed: false,
          message: 'Database credentials not configured (SUPABASE_URL/SUPABASE_SERVICE_KEY)'
        };
      }

      // Basic connectivity test (without making actual requests)
      const isValidUrl = supabaseUrl.startsWith('https://') && supabaseUrl.includes('supabase');
      const hasValidKey = supabaseKey.startsWith('eyJ');

      return {
        passed: isValidUrl && hasValidKey,
        message: isValidUrl && hasValidKey 
          ? 'Database configuration appears valid'
          : 'Database configuration format invalid',
        details: `URL format valid: ${isValidUrl}, Key format valid: ${hasValidKey}`
      };
    } catch (error) {
      return {
        passed: false,
        message: `Database connectivity check failed: ${error.message}`
      };
    }
  }

  // File system permissions check
  async checkFileSystemPermissions() {
    const testPaths = [
      './logs',
      './data',
      './temp'
    ];

    const results = [];
    for (const testPath of testPaths) {
      try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(testPath)) {
          fs.mkdirSync(testPath, { recursive: true });
        }

        // Test write permission
        const testFile = path.join(testPath, `test-${Date.now()}.tmp`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        
        results.push(`${testPath}: OK`);
      } catch (error) {
        results.push(`${testPath}: ERROR - ${error.message}`);
      }
    }

    const allPassed = results.every(r => r.includes('OK'));
    
    return {
      passed: allPassed,
      message: allPassed 
        ? 'File system permissions verified'
        : 'Some directories have permission issues',
      details: results.join(', ')
    };
  }

  // OAuth provider configuration validation
  async checkOAuthConfiguration() {
    const platforms = ['twitter', 'youtube', 'instagram'];
    const issues = [];
    const validConfigs = [];

    for (const platform of platforms) {
      const clientIdKey = `${platform.toUpperCase()}_CLIENT_ID`;
      const clientSecretKey = `${platform.toUpperCase()}_CLIENT_SECRET`;
      
      const clientId = process.env[clientIdKey];
      const clientSecret = process.env[clientSecretKey];

      if (!clientId || !clientSecret) {
        issues.push(`${platform}: Missing credentials`);
        continue;
      }

      // Basic format validation
      let validFormat = true;
      let formatIssues = [];

      // Platform-specific validation
      switch (platform) {
        case 'twitter':
          if (!clientId.match(/^[a-zA-Z0-9_-]{15,25}$/)) {
            formatIssues.push('Client ID format invalid');
            validFormat = false;
          }
          if (clientSecret.length < 40) {
            formatIssues.push('Client Secret too short');
            validFormat = false;
          }
          break;
        
        case 'youtube':
          if (!clientId.includes('.apps.googleusercontent.com')) {
            formatIssues.push('Client ID should be Google OAuth format');
            validFormat = false;
          }
          break;
          
        case 'instagram':
          if (clientId.length < 10) {
            formatIssues.push('Client ID too short');
            validFormat = false;
          }
          break;
      }

      if (validFormat) {
        validConfigs.push(platform);
      } else {
        issues.push(`${platform}: ${formatIssues.join(', ')}`);
      }
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0 
        ? `OAuth configuration valid for all ${validConfigs.length} platforms`
        : `OAuth configuration issues: ${issues.join('; ')}`,
      details: `Valid: ${validConfigs.join(', ')}, Issues: ${issues.length}`
    };
  }

  // Webhook security validation
  async checkWebhookSecurity() {
    const webhookSecrets = [
      'TWITTER_WEBHOOK_SECRET',
      'YOUTUBE_WEBHOOK_SECRET'
    ];

    const issues = [];
    const validSecrets = [];

    for (const secretVar of webhookSecrets) {
      const secret = process.env[secretVar];
      
      if (!secret) {
        issues.push(`${secretVar} not set`);
        continue;
      }

      // Security requirements for webhook secrets
      if (secret.length < 32) {
        issues.push(`${secretVar} too short (minimum 32 characters)`);
      } else if (secret === 'your_webhook_secret' || secret.includes('test')) {
        issues.push(`${secretVar} appears to be a placeholder/test value`);
      } else {
        validSecrets.push(secretVar);
      }
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0 
        ? `All ${validSecrets.length} webhook secrets properly configured`
        : `Webhook security issues: ${issues.join('; ')}`,
      details: `Valid secrets: ${validSecrets.length}, Issues: ${issues.length}`
    };
  }

  // Production mode validation
  async checkProductionMode() {
    const nodeEnv = process.env.NODE_ENV;
    const mockMode = process.env.ENABLE_MOCK_MODE === 'true';
    const debugMode = process.env.DEBUG === 'true';

    const issues = [];
    
    if (nodeEnv !== 'production') {
      issues.push(`NODE_ENV is '${nodeEnv}', should be 'production'`);
    }
    
    if (mockMode) {
      issues.push('ENABLE_MOCK_MODE is enabled - should be disabled for production');
    }
    
    if (debugMode) {
      issues.push('DEBUG mode is enabled - consider disabling for production');
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0 
        ? 'Production environment configuration correct'
        : `Environment issues: ${issues.join('; ')}`,
      details: `NODE_ENV: ${nodeEnv}, Mock: ${mockMode}, Debug: ${debugMode}`
    };
  }

  // Dependencies and security check
  async checkDependencies() {
    try {
      const packageJson = require('../package.json');
      const issues = [];
      
      // Check for security-sensitive packages
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Basic security checks
      let securityPackages = 0;
      if (dependencies['helmet']) securityPackages++;
      if (dependencies['express-rate-limit']) securityPackages++;
      if (dependencies['cors']) securityPackages++;
      
      if (securityPackages < 2) {
        issues.push('Missing recommended security packages (helmet, express-rate-limit, cors)');
      }

      // Check for outdated critical packages  
      const criticalPackages = ['express', 'jsonwebtoken', 'bcrypt'];
      for (const pkg of criticalPackages) {
        if (dependencies[pkg] && dependencies[pkg].startsWith('^0.')) {
          issues.push(`${pkg} version may be outdated (${dependencies[pkg]})`);
        }
      }

      return {
        passed: issues.length === 0,
        message: issues.length === 0 
          ? 'Dependencies and security packages validated'
          : `Dependency issues: ${issues.join('; ')}`,
        details: `Security packages: ${securityPackages}, Total deps: ${Object.keys(dependencies).length}`
      };
    } catch (error) {
      return {
        passed: false,
        message: `Failed to check dependencies: ${error.message}`
      };
    }
  }

  // API endpoints accessibility check
  async checkAPIEndpoints() {
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
    const endpoints = [
      '/api/webhooks/status',
      '/api/integrations/platforms',
      '/health'
    ];

    const results = [];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          timeout: 3000,
          headers: { 'User-Agent': 'ProductionReadinessChecker/1.0' }
        });
        
        results.push({
          endpoint,
          status: response.status,
          accessible: response.status < 500
        });
      } catch (error) {
        results.push({
          endpoint,
          status: 'ERROR',
          accessible: false,
          error: error.message
        });
      }
    }

    const accessibleCount = results.filter(r => r.accessible).length;
    
    return {
      passed: accessibleCount === endpoints.length,
      message: accessibleCount === endpoints.length 
        ? 'All API endpoints accessible'
        : `${accessibleCount}/${endpoints.length} endpoints accessible`,
      details: results.map(r => `${r.endpoint}: ${r.status}`).join(', ')
    };
  }

  // Generate deployment report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.passed + this.results.failed + this.results.warnings,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        readyForProduction: this.results.failed === 0
      },
      checks: this.results.details,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.failed > 0) {
      recommendations.push('❌ BLOCKING: Address all failed checks before deploying to production');
    }
    
    if (this.results.warnings > 0) {
      recommendations.push('⚠️ RECOMMENDED: Address warnings to improve production stability');
    }
    
    if (this.results.failed === 0 && this.results.warnings === 0) {
      recommendations.push('✅ READY: All checks passed - deployment can proceed');
    }

    // Additional production recommendations
    recommendations.push('📊 MONITORING: Set up webhook endpoint monitoring and alerting');
    recommendations.push('🔒 SECURITY: Regularly rotate webhook secrets and OAuth credentials');
    recommendations.push('📈 SCALING: Monitor queue depth and processing times under load');
    recommendations.push('🔄 BACKUP: Ensure token storage backup and recovery procedures');

    return recommendations;
  }

  // Main execution
  async run() {
    this.log('🚀 Production Readiness Check for Social Media Integrations', 'info');
    this.log('=' .repeat(60), 'info');

    // Run all checks
    await this.runCheck('Environment Variables', () => this.checkEnvironmentVariables());
    await this.runCheck('SSL/HTTPS Configuration', () => this.checkSSLConfiguration());
    await this.runCheck('Database Connectivity', () => this.checkDatabaseConnectivity());
    await this.runCheck('File System Permissions', () => this.checkFileSystemPermissions());
    await this.runCheck('OAuth Configuration', () => this.checkOAuthConfiguration());
    await this.runCheck('Webhook Security', () => this.checkWebhookSecurity());
    await this.runCheck('Production Mode', () => this.checkProductionMode());
    await this.runCheck('Dependencies & Security', () => this.checkDependencies());
    await this.runCheck('API Endpoints', () => this.checkAPIEndpoints(), false); // Not required if server isn't running

    // Generate and display report
    const report = this.generateReport();
    
    this.log('=' .repeat(60), 'info');
    this.log('📊 DEPLOYMENT READINESS REPORT', 'info');
    this.log('=' .repeat(60), 'info');
    
    this.log(`Total Checks: ${report.summary.total}`, 'info');
    this.log(`Passed: ${report.summary.passed}`, 'success');
    
    if (report.summary.failed > 0) {
      this.log(`Failed: ${report.summary.failed}`, 'error');
    }
    
    if (report.summary.warnings > 0) {
      this.log(`Warnings: ${report.summary.warnings}`, 'warning');
    }

    // Overall status
    if (report.summary.readyForProduction) {
      this.log('🎉 PRODUCTION READY: All critical checks passed!', 'success');
    } else {
      this.log('🛑 NOT READY: Please address failed checks before deployment', 'error');
    }

    // Recommendations
    this.log('\n📋 RECOMMENDATIONS:', 'info');
    report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });

    // Save detailed report
    const reportPath = path.join(__dirname, '..', 'logs', `production-readiness-${Date.now()}.json`);
    try {
      if (!fs.existsSync(path.dirname(reportPath))) {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      }
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.log(`📄 Detailed report saved to: ${reportPath}`, 'info');
    } catch (error) {
      this.log(`⚠️ Could not save report: ${error.message}`, 'warning');
    }

    // Exit with appropriate code
    process.exit(report.summary.readyForProduction ? 0 : 1);
  }
}

// Execute if run directly
if (require.main === module) {
  const checker = new ProductionReadinessChecker();
  checker.run().catch(error => {
    console.error('❌ Production readiness check failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionReadinessChecker;