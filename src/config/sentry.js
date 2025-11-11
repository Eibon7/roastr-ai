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

/**
 * Graceful Degradation Strategy (CodeRabbit Review #3445430342):
 *
 * 1. Package not installed:
 *    - If SENTRY_ENABLED=true but @sentry/node not installed
 *    - Catch require() error, log warning, continue without Sentry
 *    - Expected behavior for optional dependency
 *
 * 2. Initialization failures:
 *    - If Sentry.init() fails (invalid DSN, network issues)
 *    - Catch error, log with diagnostic info, disable Sentry
 *    - Service validation logic never blocked
 *
 * 3. Runtime failures:
 *    - All operations (addBreadcrumb, captureException) wrapped in try-catch
 *    - Failures logged but don't throw
 *    - Performance: early return if SENTRY_ENABLED=false (no overhead)
 *
 * Package.json Strategy:
 * - @sentry/node is an OPTIONAL peerDependency
 * - Not installed by default (keeps bundle size small)
 * - Install manually if needed: npm install @sentry/node
 * - CI/production can include it conditionally
 */

// Try to load Sentry, but don't fail if it's not installed
try {
    // Only attempt to load if explicitly enabled
    if (process.env.SENTRY_ENABLED === 'true' && process.env.SENTRY_DSN) {
        try {
            // Separate try-catch for require() - handles package not installed
            Sentry = require('@sentry/node');
        } catch (requireError) {
            // Package not installed - expected when Sentry is optional
            logger.warn('Sentry package not installed - continuing without Sentry', {
                error: requireError.message,
                hint: 'Install with: npm install @sentry/node',
                context: 'This is expected if @sentry/node is not in your dependencies'
            });
            Sentry = null;
            SENTRY_ENABLED = false;
            // Early exit - no point continuing if package unavailable
            throw requireError;
        }

        // Separate try-catch for Sentry.init() - handles initialization failures
        try {
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
        } catch (initError) {
            // Initialization failed (invalid DSN, network issues, etc.)
            logger.error('Sentry initialization failed - continuing without Sentry', {
                error: initError.message,
                dsn: process.env.SENTRY_DSN ? 'configured (hidden)' : 'not configured',
                hint: 'Check SENTRY_DSN validity and network connectivity',
                stack: initError.stack
            });
            Sentry = null;
            SENTRY_ENABLED = false;
        }
    } else {
        logger.debug('Sentry disabled or not configured', {
            enabled: process.env.SENTRY_ENABLED,
            hasDSN: !!process.env.SENTRY_DSN
        });
    }
} catch (error) {
    // Outer catch for any unexpected errors
    // Most errors already handled above, but kept for safety
    if (!SENTRY_ENABLED) {
        // Already logged in inner catches
        Sentry = null;
        SENTRY_ENABLED = false;
    }
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
