/**
 * Test Cleanup Helper
 *
 * Provides reusable patterns for cleaning up resources in tests
 * to prevent Jest open handles warnings
 */

/**
 * Setup automatic cleanup for services/workers in afterAll hook
 * @param {Array} services - Array of service instances that need cleanup
 */
const setupCleanup = (services = []) => {
  afterAll(async () => {
    console.log('🧹 Running test cleanup...');

    for (const service of services) {
      if (!service) continue;

      try {
        // Try cleanup method first (most specific)
        if (typeof service.cleanup === 'function') {
          await service.cleanup();
          console.log(`✅ Cleaned up service: ${service.constructor?.name || 'unknown'}`);
          continue;
        }

        // Try shutdown method (common pattern)
        if (typeof service.shutdown === 'function') {
          await service.shutdown();
          console.log(`✅ Shut down service: ${service.constructor?.name || 'unknown'}`);
          continue;
        }

        // Try stop method (worker pattern)
        if (typeof service.stop === 'function') {
          await service.stop();
          console.log(`✅ Stopped service: ${service.constructor?.name || 'unknown'}`);
          continue;
        }

        console.log(`⚠️ No cleanup method found for: ${service.constructor?.name || 'unknown'}`);
      } catch (error) {
        console.warn(`⚠️ Error cleaning up service: ${error.message}`);
      }
    }

    console.log('🧹 Test cleanup completed');
  });
};

/**
 * Setup cleanup for timers/intervals
 * @param {Array} timers - Array of timer IDs to clear
 */
const setupTimerCleanup = (timers = []) => {
  afterAll(() => {
    console.log('⏰ Clearing timers...');

    timers.forEach((timer) => {
      if (timer) {
        clearTimeout(timer);
        clearInterval(timer);
      }
    });

    console.log(`⏰ Cleared ${timers.length} timers`);
  });
};

/**
 * Setup cleanup for event listeners
 * @param {Array} emitters - Array of EventEmitter instances
 */
const setupEventCleanup = (emitters = []) => {
  afterAll(() => {
    console.log('🎧 Removing event listeners...');

    emitters.forEach((emitter) => {
      if (emitter && typeof emitter.removeAllListeners === 'function') {
        emitter.removeAllListeners();
      }
    });

    console.log(`🎧 Cleaned up ${emitters.length} event emitters`);
  });
};

/**
 * Comprehensive cleanup for all common patterns
 * @param {Object} options - Cleanup options
 * @param {Array} options.services - Services to clean up
 * @param {Array} options.timers - Timer IDs to clear
 * @param {Array} options.emitters - Event emitters to clean up
 */
const setupComprehensiveCleanup = ({ services = [], timers = [], emitters = [] } = {}) => {
  setupCleanup(services);
  setupTimerCleanup(timers);
  setupEventCleanup(emitters);
};

module.exports = {
  setupCleanup,
  setupTimerCleanup,
  setupEventCleanup,
  setupComprehensiveCleanup
};
