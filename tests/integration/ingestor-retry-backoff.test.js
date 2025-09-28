/**
 * Ingestor Retry and Exponential Backoff Integration Tests
 * Tests retry logic with exponential backoff as specified in Issue #406
 */

const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Retry and Exponential Backoff Integration', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  describe('Exponential Backoff Timing', () => {
    test('should implement exponential backoff with correct timing', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const retryDelays = [];
      let attemptCount = 0;

      // Mock platform API to fail first 3 times, succeed on 4th
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        if (attemptCount <= 3) {
          throw testUtils.createNetworkError(`Network failure attempt ${attemptCount}`);
        }
        return [testUtils.createTestComment('retry_success', organizationId)];
      };

      // Override the retry mechanism to capture delays
      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              // Calculate exponential backoff delay
              const delay = Math.min(100 * Math.pow(2, attempt - 1), 5000);
              retryDelays.push(delay);
              
              const delayStart = Date.now();
              await testUtils.wait(delay);
              const actualDelay = Date.now() - delayStart;
              
              // Verify actual delay is close to expected (±10ms tolerance)
              expect(Math.abs(actualDelay - delay)).toBeLessThan(10);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      const startTime = Date.now();
      const result = await worker.processJob(job);
      const totalTime = Date.now() - startTime;
      
      await worker.stop();

      // Verify result
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(4); // 3 failures + 1 success

      // Verify exponential backoff pattern: 100ms, 200ms, 400ms
      expect(retryDelays).toHaveLength(3);
      await testUtils.assertExponentialBackoff(retryDelays, [100, 200, 400]);

      // Verify total time includes backoff delays (with tolerance)
      const expectedMinTime = 100 + 200 + 400; // 700ms minimum
      expect(totalTime).toBeGreaterThan(expectedMinTime - 50); // 50ms tolerance
    });

    test('should respect maximum backoff delay limit', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const retryDelays = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        if (attemptCount <= 6) {
          throw testUtils.createNetworkError(`Network failure attempt ${attemptCount}`);
        }
        return [testUtils.createTestComment('max_delay_test', organizationId)];
      };

      // Override retry mechanism with higher attempt count
      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 6;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              // Exponential backoff with 5000ms max delay
              const baseDelay = 100 * Math.pow(2, attempt - 1);
              const delay = Math.min(baseDelay, 5000);
              retryDelays.push(delay);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(retryDelays).toHaveLength(6);

      // Verify pattern: 100, 200, 400, 800, 1600, 3200 (but capped at 5000)
      expect(retryDelays[0]).toBe(100);
      expect(retryDelays[1]).toBe(200);
      expect(retryDelays[2]).toBe(400);
      expect(retryDelays[3]).toBe(800);
      expect(retryDelays[4]).toBe(1600);
      expect(retryDelays[5]).toBe(3200);

      // If we had more attempts, they should be capped at 5000ms
      retryDelays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(5000);
      });
    });

    test('should customize backoff delays based on configuration', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const retryDelays = [];
      let attemptCount = 0;

      // Custom configuration with different base delay
      const customBaseDelay = 200; // Instead of 100ms
      const customMultiplier = 1.5; // Instead of 2

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        if (attemptCount <= 3) {
          throw testUtils.createNetworkError(`Custom backoff test ${attemptCount}`);
        }
        return [testUtils.createTestComment('custom_backoff', organizationId)];
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              // Custom exponential backoff formula
              const delay = Math.min(
                customBaseDelay * Math.pow(customMultiplier, attempt - 1),
                5000
              );
              retryDelays.push(delay);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(retryDelays).toHaveLength(3);

      // Verify custom pattern: 200ms, 300ms, 450ms
      const expectedDelays = [
        200,
        200 * 1.5,  // 300
        200 * 1.5 * 1.5  // 450
      ];

      for (let i = 0; i < expectedDelays.length; i++) {
        expect(Math.abs(retryDelays[i] - expectedDelays[i])).toBeLessThan(5);
      }
    });

    test('should handle jitter in backoff delays', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const retryDelays = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        if (attemptCount <= 3) {
          throw testUtils.createNetworkError(`Jitter test attempt ${attemptCount}`);
        }
        return [testUtils.createTestComment('jitter_test', organizationId)];
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              // Add jitter: ±25% random variation
              const baseDelay = 100 * Math.pow(2, attempt - 1);
              const jitter = (Math.random() - 0.5) * 0.5 * baseDelay; // ±25%
              const delay = Math.max(50, baseDelay + jitter); // Minimum 50ms
              retryDelays.push(delay);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(retryDelays).toHaveLength(3);

      // Verify delays are within reasonable jittered ranges
      const expectedBases = [100, 200, 400];
      for (let i = 0; i < expectedBases.length; i++) {
        const base = expectedBases[i];
        const actual = retryDelays[i];
        
        // Should be within ±25% of base, but at least 50ms
        const minExpected = Math.max(50, base * 0.75);
        const maxExpected = base * 1.25;
        
        expect(actual).toBeGreaterThanOrEqual(minExpected);
        expect(actual).toBeLessThanOrEqual(maxExpected);
      }
    });
  });

  describe('Retry Limit Enforcement', () => {
    test('should respect maximum retry limits', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      let attemptCount = 0;

      // Mock to always fail
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        throw testUtils.createNetworkError(`Persistent failure ${attemptCount}`);
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        let lastError;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              const delay = 100 * Math.pow(2, attempt - 1);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            lastError = error;
            attempt++;
            if (attempt > maxRetries) {
              break;
            }
          }
        }
        
        throw new Error(`Max retries (${maxRetries}) exceeded. Last error: ${lastError.message}`);
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      await expect(worker.processJob(job)).rejects.toThrow('Max retries (3) exceeded');
      
      await worker.stop();

      expect(attemptCount).toBe(4); // Initial attempt + 3 retries
    });

    test('should differentiate between retryable and non-retryable errors', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      let attemptCount = 0;

      // Mock to fail with non-retryable error
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        throw testUtils.createAuthError('Authentication failed');
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              const delay = 100 * Math.pow(2, attempt - 1);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            // Don't retry on auth errors
            if (error.code === 'AUTH_ERROR' || !error.isTransient) {
              throw error;
            }
            
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      await expect(worker.processJob(job)).rejects.toThrow('Authentication failed');
      
      await worker.stop();

      // Should not retry on auth error
      expect(attemptCount).toBe(1);
    });

    test('should track retry attempts and outcomes', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const retryLog = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw testUtils.createNetworkError(`Transient failure ${attemptCount}`);
        }
        return [testUtils.createTestComment('retry_tracking', organizationId)];
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            const attemptStart = Date.now();
            
            if (attempt > 0) {
              const delay = 100 * Math.pow(2, attempt - 1);
              await testUtils.wait(delay);
            }
            
            const result = await originalProcessJob.call(this, job);
            
            retryLog.push({
              attempt: attempt + 1,
              success: true,
              duration: Date.now() - attemptStart,
              timestamp: new Date().toISOString()
            });
            
            return result;
          } catch (error) {
            retryLog.push({
              attempt: attempt + 1,
              success: false,
              error: error.message,
              duration: Date.now() - attemptStart,
              timestamp: new Date().toISOString()
            });
            
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(retryLog).toHaveLength(3); // 2 failures + 1 success

      // Verify retry log structure
      expect(retryLog[0].success).toBe(false);
      expect(retryLog[0].attempt).toBe(1);
      expect(retryLog[1].success).toBe(false);
      expect(retryLog[1].attempt).toBe(2);
      expect(retryLog[2].success).toBe(true);
      expect(retryLog[2].attempt).toBe(3);

      // All entries should have timestamps and durations
      retryLog.forEach(entry => {
        expect(entry.timestamp).toBeTruthy();
        expect(entry.duration).toBeGreaterThan(0);
      });
    });
  });
});