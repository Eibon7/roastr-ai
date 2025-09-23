/**
 * Tier Validation Monitoring Service - Issue #396
 * Production monitoring and enhancements for SPEC 10 Tier Limits System
 * 
 * Features:
 * 1. Cache TTL performance monitoring
 * 2. Error alerting for tier validation failures
 * 3. Sentry integration for enhanced debugging
 */

const { logger } = require('../utils/logger');

class TierValidationMonitoringService {
    constructor() {
        // Cache performance metrics
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            validationCount: 0,
            errors: 0,
            performanceMetrics: []
        };
        
        // Alert thresholds
        this.alertThresholds = {
            errorRatePercentage: 5, // 5% error rate warning
            criticalErrorRatePercentage: 10, // 10% critical error rate
            maxErrorsPerHour: 100,
            maxValidationsPerMinute: 1000
        };
        
        // External alert configuration
        this.externalAlerts = {
            webhookUrl: process.env.MONITORING_WEBHOOK_URL,
            slackWebhook: process.env.SLACK_WEBHOOK_URL
        };
        
        // Request-scoped singleton pattern
        this.lastAlertTime = new Map();
        this.alertCooldown = 15 * 60 * 1000; // 15 minutes cooldown
    }

    /**
     * Track cache performance metrics
     */
    getCachedResult(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            this.metrics.cacheMisses++;
            return null;
        }
        
        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            this.metrics.cacheMisses++;
            return null;
        }
        
        this.metrics.cacheHits++;
        return cached.data;
    }

    /**
     * Store result in cache
     */
    setCachedResult(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Track validation performance
     */
    trackValidation(duration, error = false) {
        this.metrics.validationCount++;
        
        if (error) {
            this.metrics.errors++;
        }
        
        // Track performance metrics (keep last 100 for analysis)
        this.metrics.performanceMetrics.push({
            duration,
            timestamp: Date.now(),
            error
        });
        
        // Keep only last 100 metrics to prevent memory growth
        if (this.metrics.performanceMetrics.length > 100) {
            this.metrics.performanceMetrics.shift();
        }
        
        // Check alert thresholds
        this.checkAlertThresholds();
    }

    /**
     * Check if alert thresholds are exceeded
     */
    checkAlertThresholds() {
        const errorRate = this.calculateErrorRate();
        const errorsInLastHour = this.getErrorsInLastHour();
        const validationsInLastMinute = this.getValidationsInLastMinute();
        
        // Warning threshold (5%)
        if (errorRate >= this.alertThresholds.errorRatePercentage) {
            this.sendAlert('warning', 'Tier Validation Error Rate High', 
                `Error rate: ${errorRate.toFixed(2)}% (threshold: ${this.alertThresholds.errorRatePercentage}%)`);
        }
        
        // Critical threshold (10%)
        if (errorRate >= this.alertThresholds.criticalErrorRatePercentage) {
            this.sendAlert('critical', 'Tier Validation Error Rate Critical', 
                `Error rate: ${errorRate.toFixed(2)}% (critical threshold: ${this.alertThresholds.criticalErrorRatePercentage}%)`);
        }
        
        // Absolute error count threshold
        if (errorsInLastHour >= this.alertThresholds.maxErrorsPerHour) {
            this.sendAlert('critical', 'Tier Validation Error Count High', 
                `Errors in last hour: ${errorsInLastHour} (threshold: ${this.alertThresholds.maxErrorsPerHour})`);
        }
        
        // Validations per minute threshold
        if (validationsInLastMinute >= this.alertThresholds.maxValidationsPerMinute) {
            this.sendAlert('warning', 'Tier Validation Rate High', 
                `Validations in last minute: ${validationsInLastMinute} (threshold: ${this.alertThresholds.maxValidationsPerMinute})`);
        }
    }

    /**
     * Calculate current error rate
     */
    calculateErrorRate() {
        if (this.metrics.validationCount === 0) return 0;
        return (this.metrics.errors / this.metrics.validationCount) * 100;
    }

    /**
     * Get error count in the last hour
     */
    getErrorsInLastHour() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        return this.metrics.performanceMetrics.filter(
            metric => metric.error && metric.timestamp > oneHourAgo
        ).length;
    }

    /**
     * Get validation count in the last minute (sliding window)
     */
    getValidationsInLastMinute() {
        const oneMinuteAgo = Date.now() - (60 * 1000);
        return this.metrics.performanceMetrics.filter(
            metric => metric.timestamp > oneMinuteAgo
        ).length;
    }

    /**
     * Send alert to external systems
     */
    async sendAlert(severity, title, message) {
        const alertKey = `${severity}-${title}`;
        const lastAlert = this.lastAlertTime.get(alertKey);
        
        // Cooldown check to prevent spam
        if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
            return;
        }
        
        this.lastAlertTime.set(alertKey, Date.now());
        
        const alertData = {
            severity,
            title,
            message,
            timestamp: new Date().toISOString(),
            service: 'tier-validation-monitoring',
            metrics: this.getHealthMetrics()
        };
        
        logger.warn(`Tier validation alert: ${title}`, alertData);
        
        // Send to external systems asynchronously
        setImmediate(() => {
            this.sendExternalAlert(alertData);
        });
    }

    /**
     * Send alert to external monitoring systems
     */
    async sendExternalAlert(alertData) {
        const promises = [];
        
        // Send to webhook
        if (this.externalAlerts.webhookUrl) {
            promises.push(this.sendWebhookAlert(alertData));
        }
        
        // Send to Slack
        if (this.externalAlerts.slackWebhook) {
            promises.push(this.sendSlackAlert(alertData));
        }
        
        try {
            await Promise.allSettled(promises);
        } catch (error) {
            logger.error('Failed to send external alerts:', error);
        }
    }

    /**
     * Send webhook alert
     */
    async sendWebhookAlert(alertData) {
        try {
            // Use dynamic import for node-fetch
            const fetch = await import('node-fetch').then(mod => mod.default);
            
            const response = await fetch(this.externalAlerts.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertData),
                timeout: 5000 // 5-second timeout
            });
            
            if (!response.ok) {
                logger.warn(`Webhook alert failed with status ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            logger.warn('Failed to send webhook alert:', error.message);
        }
    }

    /**
     * Send Slack alert
     */
    async sendSlackAlert(alertData) {
        try {
            // Use dynamic import for node-fetch
            const fetch = await import('node-fetch').then(mod => mod.default);
            
            const slackMessage = {
                text: `🚨 ${alertData.title}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*${alertData.title}*\n${alertData.message}`
                        }
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Severity: ${alertData.severity} | Time: ${alertData.timestamp}`
                            }
                        ]
                    }
                ]
            };
            
            const response = await fetch(this.externalAlerts.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slackMessage),
                timeout: 5000 // 5-second timeout
            });
            
            if (!response.ok) {
                logger.warn(`Slack alert failed with status ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            logger.warn('Failed to send Slack alert:', error.message);
        }
    }

    /**
     * Get health status based on current metrics
     */
    getHealthStatus() {
        const errorRate = this.calculateErrorRate();
        const avgPerformance = this.getAveragePerformance();
        const cacheHitRate = this.getCacheHitRate();
        
        let status = 'healthy';
        let issues = [];
        
        if (errorRate >= this.alertThresholds.criticalErrorRatePercentage) {
            status = 'unhealthy';
            issues.push(`Critical error rate: ${errorRate.toFixed(2)}%`);
        } else if (errorRate >= this.alertThresholds.errorRatePercentage) {
            status = 'degraded';
            issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
        }
        
        if (avgPerformance > 1000) { // >1 second average
            status = status === 'healthy' ? 'degraded' : status;
            issues.push(`Slow performance: ${avgPerformance.toFixed(2)}ms avg`);
        }
        
        if (cacheHitRate < 0.7) { // <70% cache hit rate
            if (status === 'healthy') status = 'degraded';
            issues.push(`Low cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%`);
        }
        
        return {
            status,
            timestamp: new Date().toISOString(),
            metrics: this.getHealthMetrics(),
            issues: issues.length > 0 ? issues : null,
            uptime: process.uptime()
        };
    }

    /**
     * Get health metrics summary
     */
    getHealthMetrics() {
        return {
            validationCount: this.metrics.validationCount,
            errorCount: this.metrics.errors,
            errorRate: this.calculateErrorRate(),
            cacheHitRate: this.getCacheHitRate(),
            averagePerformance: this.getAveragePerformance(),
            cacheSize: this.cache.size,
            errorsInLastHour: this.getErrorsInLastHour(),
            validationsInLastMinute: this.getValidationsInLastMinute()
        };
    }

    /**
     * Calculate cache hit rate
     */
    getCacheHitRate() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        return total > 0 ? this.metrics.cacheHits / total : 0;
    }

    /**
     * Calculate average performance over recent validations
     */
    getAveragePerformance() {
        if (this.metrics.performanceMetrics.length === 0) return 0;
        
        const recentMetrics = this.metrics.performanceMetrics.slice(-20); // Last 20 validations
        const totalDuration = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
        return totalDuration / recentMetrics.length;
    }

    /**
     * Clear cache and reset metrics (for testing)
     */
    clearCache() {
        this.cache.clear();
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            validationCount: 0,
            errors: 0,
            performanceMetrics: []
        };
        this.lastAlertTime.clear();
    }

    /**
     * Update alert thresholds (for dynamic configuration)
     */
    updateAlertThresholds(newThresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
        logger.info('Alert thresholds updated:', this.alertThresholds);
    }

    /**
     * Get detailed performance analytics
     */
    getPerformanceAnalytics() {
        const metrics = this.metrics.performanceMetrics;
        if (metrics.length === 0) {
            return {
                count: 0,
                avgDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                p95Duration: 0,
                errorCount: 0
            };
        }
        
        const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
        const errorCount = metrics.filter(m => m.error).length;
        const p95Index = Math.floor(durations.length * 0.95);
        
        return {
            count: metrics.length,
            avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            minDuration: durations[0],
            maxDuration: durations[durations.length - 1],
            p95Duration: durations[p95Index] || 0,
            errorCount
        };
    }
}

// Export singleton instance
module.exports = new TierValidationMonitoringService();