/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by monitoring external service calls
 * and temporarily blocking requests when failure threshold is exceeded.
 */

class CircuitBreakerError extends Error {
  constructor(message, state) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.state = state;
  }
}

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 120000; // 2 minutes
    this.expectedErrors = options.expectedErrors || [];
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
    
    this.logger = options.logger || console;
    this.name = options.name || 'CircuitBreaker';
    
    // Reset counters periodically
    this.resetInterval = setInterval(() => {
      this.resetCounters();
    }, this.monitoringPeriod);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute(operation, fallback = null) {
    this.requestCount++;

    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.logger.info?.(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        const error = new CircuitBreakerError(
          `Circuit breaker ${this.name} is OPEN. Service temporarily unavailable.`,
          'OPEN'
        );
        
        if (fallback) {
          this.logger.warn?.(`Circuit breaker ${this.name} is OPEN, using fallback`);
          return await fallback();
        }
        
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      if (fallback && this.state === 'OPEN') {
        this.logger.warn?.(`Circuit breaker ${this.name} opened, using fallback`);
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.logger.info?.(`Circuit breaker ${this.name} reset to CLOSED after successful operation`);
    }
  }

  /**
   * Handle failed operation
   */
  onFailure(error) {
    // Don't count expected errors as failures
    if (this.isExpectedError(error)) {
      this.logger.debug?.(`Circuit breaker ${this.name} ignoring expected error: ${error.message}`);
      return;
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();

    this.logger.warn?.(`Circuit breaker ${this.name} failure ${this.failureCount}/${this.failureThreshold}`, {
      error: error.message,
      state: this.state
    });

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.logger.error?.(`Circuit breaker ${this.name} opened after failure in HALF_OPEN state`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.logger.error?.(`Circuit breaker ${this.name} opened after ${this.failureCount} failures`);
    }
  }

  /**
   * Check if error should be ignored for circuit breaker logic
   */
  isExpectedError(error) {
    return this.expectedErrors.some(expectedError => {
      if (typeof expectedError === 'string') {
        return error.message.includes(expectedError);
      }
      if (expectedError instanceof RegExp) {
        return expectedError.test(error.message);
      }
      if (typeof expectedError === 'function') {
        return expectedError(error);
      }
      return false;
    });
  }

  /**
   * Check if circuit breaker should attempt to reset
   */
  shouldAttemptReset() {
    return this.lastFailureTime && 
           (Date.now() - this.lastFailureTime) >= this.recoveryTimeout;
  }

  /**
   * Reset failure counters (called periodically)
   */
  resetCounters() {
    if (this.state === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
      this.requestCount = 0;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      failureRate: this.requestCount > 0 ? this.failureCount / this.requestCount : 0,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : null
    };
  }

  /**
   * Force circuit breaker to specific state (for testing)
   */
  forceState(state) {
    this.state = state;
    if (state === 'CLOSED') {
      this.failureCount = 0;
      this.lastFailureTime = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
  }
}

/**
 * Circuit Breaker Manager - Manages multiple circuit breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Create or get circuit breaker for service
   */
  getBreaker(serviceName, options = {}) {
    if (!this.breakers.has(serviceName)) {
      const breakerOptions = {
        name: serviceName,
        logger: options.logger || console,
        ...options
      };
      
      this.breakers.set(serviceName, new CircuitBreaker(breakerOptions));
    }
    
    return this.breakers.get(serviceName);
  }

  /**
   * Execute operation with circuit breaker for specific service
   */
  async execute(serviceName, operation, fallback = null, options = {}) {
    const breaker = this.getBreaker(serviceName, options);
    return breaker.execute(operation, fallback);
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics() {
    const metrics = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Get health status of all services
   */
  getHealthStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      const metrics = breaker.getMetrics();
      status[name] = {
        healthy: metrics.state === 'CLOSED',
        state: metrics.state,
        failureRate: metrics.failureRate
      };
    }
    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.forceState('CLOSED');
    }
  }

  /**
   * Cleanup all circuit breakers
   */
  destroy() {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

// Global circuit breaker manager instance
const globalCircuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerError,
  globalCircuitBreakerManager
};
