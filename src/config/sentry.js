/**
 * Sentry Configuration - Issue #396 (AC3)
 * Optional Sentry integration for enhanced error tracking in tierValidationService
 *
 * Environment Variables:
 * - SENTRY_ENABLED: 'true' to enable Sentry
 * - SENTRY_DSN: Sentry Data Source Name
 * - NODE_ENV: Environment (development, production)
 */

const { logger } = require('../utils/logger');

let Sentry = null;
let SENTRY_ENABLED = false;

// Try to load Sentry, but don't fail if it's not installed
try {
    // Only attempt to load if explicitly enabled
    if (process.env.SENTRY_ENABLED === 'true' && process.env.SENTRY_DSN) {
        Sentry = require('@sentry/node');

        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || 'development',
            // Performance monitoring
            tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
            // Only in production or explicitly enabled
            enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLE === 'true',
            // Integration-specific options
            integrations: [
                // Add custom integrations here if needed
            ],
            // Before send hook for filtering/modifying events
            beforeSend(event, hint) {
                // Don't send events in test environment
                if (process.env.NODE_ENV === 'test') {
                    return null;
                }
                return event;
            }
        });

        SENTRY_ENABLED = true;
        logger.info('Sentry initialized for tier validation monitoring', {
            environment: process.env.NODE_ENV,
            tracesSampleRate: Sentry.getCurrentHub().getClient()?.getOptions().tracesSampleRate
        });
    } else {
        logger.debug('Sentry disabled or not configured', {
            enabled: process.env.SENTRY_ENABLED,
            hasDSN: !!process.env.SENTRY_DSN
        });
    }
} catch (error) {
    logger.warn('Sentry module not available - continuing without Sentry', {
        error: error.message,
        hint: 'Install with: npm install @sentry/node'
    });
    Sentry = null;
    SENTRY_ENABLED = false;
}

/**
 * Add breadcrumb with safe defaults
 * @param {Object} breadcrumb - Breadcrumb data
 */
function addBreadcrumb(breadcrumb) {
    if (!SENTRY_ENABLED || !Sentry) return;

    try {
        Sentry.addBreadcrumb({
            category: breadcrumb.category || 'default',
            message: breadcrumb.message || '',
            level: breadcrumb.level || 'info',
            data: breadcrumb.data || {},
            timestamp: Date.now() / 1000
        });
    } catch (error) {
        logger.warn('Failed to add Sentry breadcrumb', {
            error: error.message,
            breadcrumb
        });
    }
}

/**
 * Capture exception with context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function captureException(error, context = {}) {
    if (!SENTRY_ENABLED || !Sentry) return;

    try {
        Sentry.captureException(error, {
            extra: context.extra || {},
            tags: context.tags || {},
            user: context.user || {},
            level: context.level || 'error'
        });
    } catch (sentryError) {
        logger.warn('Failed to capture exception in Sentry', {
            error: sentryError.message,
            originalError: error.message
        });
    }
}

/**
 * Flush Sentry events (useful for graceful shutdown)
 * @param {number} timeout - Timeout in ms (default 2000)
 * @returns {Promise<boolean>}
 */
async function flush(timeout = 2000) {
    if (!SENTRY_ENABLED || !Sentry) {
        return Promise.resolve(true);
    }

    try {
        return await Sentry.flush(timeout);
    } catch (error) {
        logger.warn('Failed to flush Sentry events', { error: error.message });
        return false;
    }
}

module.exports = {
    Sentry,
    SENTRY_ENABLED,
    addBreadcrumb,
    captureException,
    flush
};
