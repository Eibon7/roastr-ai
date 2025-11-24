#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors/safe');
const { t } = require('../utils/i18n');

/**
 * Health Monitor CLI Tool
 *
 * Provides real-time monitoring capabilities from the command line:
 * - Health status monitoring
 * - System metrics display
 * - Watch mode for continuous monitoring
 * - Alert testing and management
 */
class HealthMonitorCLI {
  constructor() {
    this.config = {
      apiUrl: process.env.ROAST_API_URL || 'http://localhost:3000',
      refreshInterval: parseInt(process.env.MONITOR_REFRESH_INTERVAL) || 5000,
      compact: process.env.MONITOR_COMPACT === 'true'
    };

    this.isWatching = false;
    this.watchInterval = null;
  }

  /**
   * Main CLI entry point
   */
  async run() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
      switch (command) {
        case 'health':
          await this.showHealth();
          break;
        case 'metrics':
          await this.showMetrics();
          break;
        case 'watch':
          await this.startWatch();
          break;
        case 'test':
          await this.runTest();
          break;
        case 'alert':
          await this.testAlert(args[1], args[2], args[3]);
          break;
        default:
          this.showUsage();
      }
    } catch (error) {
      console.error(colors.red('❌ Error:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Display health status
   */
  async showHealth() {
    try {
      console.log(colors.cyan(t('cli.health.fetching')));

      const response = await axios.get(`${this.config.apiUrl}/api/health`, {
        timeout: 10000
      });

      const health = response.data.data;
      this.displayHealthStatus(health);
    } catch (error) {
      if (error.response) {
        console.log(colors.red(t('cli.health.failed')));
        console.log(
          colors.yellow(t('cli.errors.response') + ':'),
          JSON.stringify(error.response.data, null, 2)
        );
      } else {
        console.log(colors.red(t('cli.health.cannot_connect')), error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Display system metrics
   */
  async showMetrics() {
    try {
      console.log(colors.cyan(t('cli.metrics.fetching')));

      // Note: This would require authentication in a real scenario
      const response = await axios.get(`${this.config.apiUrl}/api/metrics`, {
        timeout: 10000,
        headers: {
          // In a real implementation, you'd need to handle authentication
          Authorization: process.env.ROAST_API_KEY
            ? `Bearer ${process.env.ROAST_API_KEY}`
            : undefined
        }
      });

      const metrics = response.data.data;
      this.displayMetrics(metrics);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(colors.red(t('cli.metrics.auth_required')));
      } else if (error.response) {
        console.log(colors.red(t('cli.metrics.fetch_failed')));
        console.log(
          colors.yellow(t('cli.errors.response') + ':'),
          JSON.stringify(error.response.data, null, 2)
        );
      } else {
        console.log(colors.red(t('cli.metrics.cannot_connect')), error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Start watch mode
   */
  async startWatch() {
    console.log(colors.cyan(t('cli.monitoring.starting_watch')));
    console.log(
      colors.gray(
        t('cli.monitoring.refresh_interval', { interval: this.config.refreshInterval }) + '\n'
      )
    );

    this.isWatching = true;

    // Setup graceful shutdown
    process.on('SIGINT', () => {
      console.log(colors.yellow('\n' + t('cli.monitoring.stopping')));
      this.stopWatch();
      process.exit(0);
    });

    // Initial display
    await this.showHealthCompact();

    // Start periodic updates
    this.watchInterval = setInterval(async () => {
      if (this.isWatching) {
        console.clear();
        await this.showHealthCompact();
      }
    }, this.config.refreshInterval);
  }

  /**
   * Stop watch mode
   */
  stopWatch() {
    this.isWatching = false;
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  /**
   * Run monitoring system test
   */
  async runTest() {
    try {
      console.log(colors.cyan(t('cli.monitoring.running_test')));

      const response = await axios.post(
        `${this.config.apiUrl}/api/monitoring/test`,
        {},
        {
          timeout: 30000,
          headers: {
            Authorization: process.env.ROAST_API_KEY
              ? `Bearer ${process.env.ROAST_API_KEY}`
              : undefined
          }
        }
      );

      const results = response.data.data;
      this.displayTestResults(results);

      if (!results.overall.passed) {
        process.exit(1);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(colors.red(t('cli.alerts.auth_required')));
      } else if (error.response) {
        console.log(colors.red(t('cli.alerts.test_failed')));
        console.log(
          colors.yellow(t('cli.errors.response') + ':'),
          JSON.stringify(error.response.data, null, 2)
        );
      } else {
        console.log(colors.red(t('cli.alerts.cannot_connect')), error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Test alert system
   */
  async testAlert(
    severity = 'info',
    title = t('alert.titles.test_alert'),
    message = t('alert.messages.test_alert')
  ) {
    try {
      console.log(colors.cyan(t('cli.alerts.sending', { severity })));

      const response = await axios.post(
        `${this.config.apiUrl}/api/monitoring/alert/test`,
        {
          severity,
          title,
          message
        },
        {
          timeout: 10000,
          headers: {
            Authorization: process.env.ROAST_API_KEY
              ? `Bearer ${process.env.ROAST_API_KEY}`
              : undefined
          }
        }
      );

      const result = response.data.data;

      if (result.alertSent) {
        console.log(colors.green(t('cli.alerts.sent_successfully')));
        console.log(colors.gray(`${t('cli.alerts.severity')}: ${result.severity}`));
        console.log(colors.gray(`${t('cli.alerts.title')}: ${result.title}`));
        console.log(colors.gray(`${t('cli.alerts.message')}: ${result.message}`));
      } else {
        console.log(colors.yellow(t('cli.alerts.not_sent')));
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(colors.red(t('cli.alerts.auth_required')));
      } else if (error.response) {
        console.log(colors.red(t('cli.alerts.test_failed')));
        console.log(
          colors.yellow(t('cli.errors.response') + ':'),
          JSON.stringify(error.response.data, null, 2)
        );
      } else {
        console.log(colors.red(t('cli.alerts.cannot_connect')), error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Display health status in compact format
   */
  async showHealthCompact() {
    try {
      const response = await axios.get(`${this.config.apiUrl}/api/health`, {
        timeout: 5000
      });

      const health = response.data.data;
      const timestamp = new Date().toLocaleString();

      console.log(colors.cyan(`🏥 Health Status - ${timestamp}`));
      console.log(colors.gray('─'.repeat(60)));

      // Overall status
      const statusColor = this.getStatusColor(health.status);
      console.log(`Overall: ${statusColor(health.status.toUpperCase())}`);

      // System stats
      if (health.system) {
        console.log(`Uptime: ${colors.gray(health.system.uptime)}`);
        console.log(
          `Memory: ${this.getMemoryColor(health.system.memory.usage)}${health.system.memory.usage}%${colors.reset} (${health.system.memory.used}MB/${health.system.memory.total}MB)`
        );
      }

      // Services
      if (health.services) {
        console.log('\nServices:');
        for (const [service, status] of Object.entries(health.services)) {
          const statusText = typeof status === 'object' ? status.status : status;
          console.log(`  ${service}: ${this.getStatusColor(statusText)(statusText)}`);
        }
      }

      // Workers
      if (health.workers && health.workers.totalWorkers) {
        console.log(
          `\nWorkers: ${colors.green(health.workers.healthyWorkers)}/${colors.cyan(health.workers.totalWorkers)} healthy`
        );
      }

      // Queues
      if (health.queues) {
        console.log(`Queues: ${colors.cyan(health.queues.totalDepth || 0)} jobs pending`);
      }

      console.log(colors.gray('─'.repeat(60)));
    } catch (error) {
      console.log(colors.red(`❌ Health check failed: ${error.message}`));
    }
  }

  /**
   * Display full health status
   */
  displayHealthStatus(health) {
    console.log(colors.cyan('🏥 System Health Status'));
    console.log(colors.gray('═'.repeat(60)));

    // Overall status
    const statusColor = this.getStatusColor(health.status);
    console.log(`Overall Status: ${statusColor(health.status.toUpperCase())}`);
    console.log(`Timestamp: ${colors.gray(health.timestamp)}`);
    console.log(`Check Duration: ${colors.gray(health.checkDuration)}`);

    // System health
    if (health.system) {
      console.log(colors.cyan('\n💻 System'));
      console.log(colors.gray('─'.repeat(40)));
      console.log(`Status: ${this.getStatusColor(health.system.status)(health.system.status)}`);
      console.log(`Uptime: ${health.system.uptime}`);
      console.log(
        `Memory Usage: ${this.getMemoryColor(health.system.memory.usage)}${health.system.memory.usage}%${colors.reset}`
      );
      console.log(
        `Memory: ${health.system.memory.used}MB used / ${health.system.memory.total}MB total`
      );
      console.log(`Node Version: ${health.system.nodeVersion}`);
      console.log(`Platform: ${health.system.platform} ${health.system.arch}`);
    }

    // Services health
    if (health.services) {
      console.log(colors.cyan('\n🔧 Services'));
      console.log(colors.gray('─'.repeat(40)));
      for (const [serviceName, serviceHealth] of Object.entries(health.services)) {
        const status = typeof serviceHealth === 'object' ? serviceHealth.status : serviceHealth;
        const statusText = this.getStatusColor(status)(status);
        console.log(`${serviceName}: ${statusText}`);

        if (typeof serviceHealth === 'object' && serviceHealth.responseTime) {
          console.log(`  Response Time: ${serviceHealth.responseTime}`);
        }

        if (typeof serviceHealth === 'object' && serviceHealth.error) {
          console.log(`  Error: ${colors.red(serviceHealth.error)}`);
        }
      }
    }

    // Workers health
    if (health.workers) {
      console.log(colors.cyan('\n👷 Workers'));
      console.log(colors.gray('─'.repeat(40)));
      console.log(`Status: ${this.getStatusColor(health.workers.status)(health.workers.status)}`);
      console.log(`Total: ${health.workers.totalWorkers || 0}`);
      console.log(`Healthy: ${colors.green(health.workers.healthyWorkers || 0)}`);

      if (health.workers.workers) {
        for (const [workerType, workerHealth] of Object.entries(health.workers.workers)) {
          console.log(
            `  ${workerType}: ${this.getStatusColor(workerHealth.status)(workerHealth.status)}`
          );
        }
      }
    }

    // Queue health
    if (health.queues) {
      console.log(colors.cyan('\n📋 Queues'));
      console.log(colors.gray('─'.repeat(40)));
      console.log(`Status: ${this.getStatusColor(health.queues.status)(health.queues.status)}`);
      console.log(`Total Depth: ${colors.cyan(health.queues.totalDepth || 0)}`);
    }

    // Performance
    if (health.performance && health.performance.responseTime) {
      console.log(colors.cyan('\n⚡ Performance'));
      console.log(colors.gray('─'.repeat(40)));
      console.log(
        `Status: ${this.getStatusColor(health.performance.status)(health.performance.status)}`
      );
      console.log(`Avg Response Time: ${health.performance.responseTime.average}ms`);
      console.log(`Error Rate: ${health.performance.requests.errorRate}`);
      console.log(`Total Requests: ${health.performance.requests.total}`);
    }

    // Failed checks
    if (health.failedChecks && health.failedChecks.length > 0) {
      console.log(colors.red('\n❌ Failed Checks'));
      console.log(colors.gray('─'.repeat(40)));
      for (const check of health.failedChecks) {
        const criticalText = check.critical ? colors.red('[CRITICAL]') : colors.yellow('[WARNING]');
        console.log(`${criticalText} ${check.component}: ${check.status}`);
      }
    }

    console.log(colors.gray('═'.repeat(60)));
  }

  /**
   * Display system metrics
   */
  displayMetrics(metrics) {
    console.log(colors.cyan(t('cli.metrics.title')));
    console.log(colors.gray('═'.repeat(60)));
    console.log(`${t('cli.metrics.timestamp')}: ${colors.gray(metrics.timestamp)}`);

    // System metrics
    console.log(colors.cyan('\n' + t('cli.metrics.system')));
    console.log(colors.gray('─'.repeat(40)));
    console.log(`${t('cli.metrics.uptime')}: ${Math.floor(metrics.system.uptime / 1000)}s`);
    console.log(
      `${t('cli.metrics.memory_usage')}: ${this.getMemoryColor(metrics.system.memory.usage)}${metrics.system.memory.usage}%${colors.reset}`
    );
    console.log(
      `${t('cli.metrics.status')}: ${this.getStatusColor(metrics.system.status)(metrics.system.status)}`
    );

    // Job metrics
    console.log(colors.cyan('\n' + t('cli.metrics.jobs')));
    console.log(colors.gray('─'.repeat(40)));
    console.log(`${t('cli.metrics.processed')}: ${colors.green(metrics.jobs.processed)}`);
    console.log(`${t('cli.metrics.failed')}: ${colors.red(metrics.jobs.failed)}`);
    console.log(`${t('cli.metrics.token_usage')}: ${colors.cyan(metrics.jobs.tokenUsage)}`);

    // User metrics
    console.log(colors.cyan('\n' + t('cli.metrics.users')));
    console.log(colors.gray('─'.repeat(40)));
    console.log(`${t('cli.metrics.total')}: ${colors.cyan(metrics.users.total)}`);
    console.log(`${t('cli.metrics.active')}: ${colors.green(metrics.users.active)}`);

    // Performance metrics
    console.log(colors.cyan('\n' + t('cli.metrics.performance')));
    console.log(colors.gray('─'.repeat(40)));
    console.log(
      `${t('cli.metrics.avg_response_time')}: ${metrics.performance.averageResponseTime}ms`
    );
    console.log(`${t('cli.metrics.error_rate')}: ${metrics.performance.errorRate}`);
    console.log(`${t('cli.metrics.total_requests')}: ${metrics.performance.totalRequests}`);

    // Cost metrics
    if (metrics.costs) {
      console.log(colors.cyan('\n' + t('cli.metrics.costs')));
      console.log(colors.gray('─'.repeat(40)));
      console.log(
        `${t('cli.metrics.budget_usage')}: ${this.getCostColor(metrics.costs.budgetUsagePercentage)}${metrics.costs.budgetUsagePercentage}%${colors.reset}`
      );
      console.log(`${t('cli.metrics.monthly_spend')}: $${metrics.costs.monthlySpend}`);
    }

    console.log(colors.gray('═'.repeat(60)));
  }

  /**
   * Display test results
   */
  displayTestResults(results) {
    console.log(colors.cyan(t('cli.monitoring.test_results')));
    console.log(colors.gray('═'.repeat(60)));
    console.log(`Timestamp: ${colors.gray(results.timestamp)}`);

    const overallColor = results.overall.passed ? colors.green : colors.red;
    const overallStatus = results.overall.passed
      ? t('cli.monitoring.passed')
      : t('cli.monitoring.failed');
    console.log(`${t('cli.monitoring.overall')}: ${overallColor(overallStatus)}`);

    // Individual test results
    console.log(colors.cyan('\n' + t('cli.monitoring.test_components')));
    console.log(colors.gray('─'.repeat(40)));

    for (const [testName, testResult] of Object.entries(results)) {
      if (testName === 'timestamp' || testName === 'overall') continue;

      const statusColor = testResult.passed ? colors.green : colors.red;
      const statusText = testResult.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${testName}: ${statusColor(statusText)}`);

      if (testResult.status) {
        console.log(`  Status: ${testResult.status}`);
      }
    }

    console.log(colors.gray('═'.repeat(60)));
  }

  /**
   * Get color for status
   */
  getStatusColor(status) {
    switch (status) {
      case 'healthy':
      case 'ok':
      case 'success':
        return colors.green;
      case 'warning':
      case 'degraded':
      case 'slow':
        return colors.yellow;
      case 'critical':
      case 'unhealthy':
      case 'error':
      case 'failed':
        return colors.red;
      case 'disabled':
      case 'unknown':
        return colors.gray;
      default:
        return colors.white;
    }
  }

  /**
   * Get color for memory usage
   */
  getMemoryColor(percentage) {
    if (percentage >= 90) return colors.red;
    if (percentage >= 80) return colors.yellow;
    return colors.green;
  }

  /**
   * Get color for cost percentage
   */
  getCostColor(percentage) {
    if (percentage >= 95) return colors.red;
    if (percentage >= 80) return colors.yellow;
    return colors.green;
  }

  /**
   * Show usage information
   */
  showUsage() {
    console.log(colors.cyan(t('cli.usage.title')));
    console.log(colors.gray('═'.repeat(60)));
    console.log(t('cli.usage.usage'));
    console.log('');
    console.log(t('cli.usage.commands') + ':');
    console.log('  ' + t('cli.usage.health_cmd'));
    console.log('  ' + t('cli.usage.metrics_cmd'));
    console.log('  ' + t('cli.usage.watch_cmd'));
    console.log('  ' + t('cli.usage.test_cmd'));
    console.log('  ' + t('cli.usage.alert_cmd'));
    console.log('');
    console.log(t('cli.usage.env_vars') + ':');
    console.log('  ' + t('cli.usage.api_url'));
    console.log('  ' + t('cli.usage.api_key'));
    console.log('  ' + t('cli.usage.refresh_interval'));
    console.log('  ' + t('cli.usage.compact'));
    console.log('');
    console.log(t('cli.usage.examples') + ':');
    console.log('  ' + t('cli.usage.example_health'));
    console.log('  ' + t('cli.usage.example_watch'));
    console.log('  ' + t('cli.usage.example_alert'));
    console.log(colors.gray('═'.repeat(60)));
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new HealthMonitorCLI();
  cli.run().catch((error) => {
    console.error(colors.red(t('cli.errors.fatal_error')), error.message);
    process.exit(1);
  });
}

module.exports = HealthMonitorCLI;
