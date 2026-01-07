/**
 * Correlation Tracking Middleware - ROA-526
 * 
 * Generates and propagates correlation IDs for request tracking:
 * - X-Request-Id: Unique identifier for each request
 * - X-User-Id: User identifier (if authenticated)
 * 
 * These IDs are used for:
 * - Distributed tracing across services
 * - Log aggregation and correlation
 * - Rate limiting tracking
 * - Debugging and troubleshooting
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Generate X-Request-Id for correlation tracking
 * Accepts existing header or generates new UUID
 */
function correlationTrackingMiddleware(req, res, next) {
  // Check if X-Request-Id already exists (from proxy, load balancer, etc.)
  let requestId = req.headers['x-request-id'] || 
                  req.headers['x-correlation-id'] ||
                  req.get('X-Request-Id') ||
                  req.get('X-Correlation-Id');

  // Generate new UUID if not provided
  if (!requestId) {
    requestId = crypto.randomUUID();
  }

  // Attach to request object for use in other middleware/routes
  req.id = requestId;

  // Also set in headers for response (for client debugging)
  res.setHeader('X-Request-Id', requestId);

  // If user is authenticated, also track User-Id
  // This happens after auth middleware, so we check in a setImmediate
  // to allow auth middleware to populate req.user first
  setImmediate(() => {
    if (req.user && req.user.id) {
      req.userId = req.user.id;
      // Don't expose full user ID in response headers (privacy)
      // Only set it internally for logging
    }
  });

  // Log incoming request with correlation ID
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    requestId,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  });

  // Track request timing
  const startTime = Date.now();

  // Intercept response to log completion
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId: req.id,
      userId: req.userId
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Enhanced logger wrapper that automatically includes correlation IDs
 * Usage: const correlatedLogger = createCorrelatedLogger(req);
 *        correlatedLogger.info('Message', { additional: 'data' });
 */
function createCorrelatedLogger(req) {
  const baseContext = {
    requestId: req.id || 'unknown',
    userId: req.userId || req.user?.id || null,
    ip: req.ip || req.connection?.remoteAddress
  };

  return {
    info: (message, metadata = {}) => {
      logger.info(message, { ...baseContext, ...metadata });
    },
    warn: (message, metadata = {}) => {
      logger.warn(message, { ...baseContext, ...metadata });
    },
    error: (message, metadata = {}) => {
      logger.error(message, { ...baseContext, ...metadata });
    },
    debug: (message, metadata = {}) => {
      logger.debug(message, { ...baseContext, ...metadata });
    }
  };
}

/**
 * Utility to get correlation context from request
 * Returns object with requestId and userId (if available)
 */
function getCorrelationContext(req) {
  return {
    requestId: req.id || crypto.randomUUID(),
    userId: req.userId || req.user?.id || null,
    ip: req.ip || req.connection?.remoteAddress || 'unknown'
  };
}

module.exports = {
  correlationTrackingMiddleware,
  createCorrelatedLogger,
  getCorrelationContext
};

