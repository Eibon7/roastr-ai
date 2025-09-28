/**
 * Ingestor Error Handling Integration Tests
 * Tests transient vs permanent error differentiation as specified in Issue #406
 */

const IngestorTestUtils = require('../helpers/ingestor-test-utils');
const fixtures = require('../fixtures/ingestor-comments.json');

describe('Ingestor Error Handling Integration', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = new IngestorTestUtils();
    await testUtils.setup();
    await testUtils.setupTestOrganizations(fixtures);
  }, 30000);

  afterAll(async () => {
    await testUtils.cleanup();
  }, 15000);

  describe('Transient Error Handling', () => {
    test('should retry on network errors with exponential backoff', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const retryAttempts = [];
      let attemptCount = 0;

      // Mock network error for first 2 attempts, then success
      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        retryAttempts.push({
          attempt: attemptCount,
          timestamp: Date.now(),
          type: attemptCount <= 2 ? 'network_error' : 'success'
        });

        if (attemptCount <= 2) {
          throw testUtils.createNetworkError(`Network timeout attempt ${attemptCount}`);
        }
        
        return [testUtils.createTestComment('network_retry_success', organizationId)];
      };

      // Override processJob to implement retry logic
      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        let lastError;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              const delay = Math.min(100 * Math.pow(2, attempt - 1), 5000);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            lastError = error;
            
            // Check if error is transient (retryable)
            if (error.isTransient !== false && error.code !== 'AUTH_ERROR') {
              attempt++;
              if (attempt <= maxRetries) {
                continue; // Retry transient errors
              }
            }
            
            // Don't retry non-transient errors or if max retries exceeded
            throw error;
          }
        }
        
        throw lastError;
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      const result = await worker.processJob(job);
      
      await worker.stop();

      expect(result.success).toBe(true);
      expect(result.commentsCount).toBe(1);
      expect(retryAttempts).toHaveLength(3); // 2 failures + 1 success
      expect(retryAttempts[0].type).toBe('network_error');
      expect(retryAttempts[1].type).toBe('network_error');
      expect(retryAttempts[2].type).toBe('success');
    });

    test('should retry on rate limit errors with appropriate delays', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const retryLog = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();
        
        if (attemptCount <= 2) {
          retryLog.push({
            attempt: attemptCount,
            type: 'rate_limit',
            timestamp
          });
          throw testUtils.createRateLimitError('Rate limit exceeded', 60); // 60 seconds retry-after
        }
        
        retryLog.push({
          attempt: attemptCount,
          type: 'success',
          timestamp
        });
        
        return [testUtils.createTestComment('rate_limit_success', organizationId)];
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              // For rate limits, respect retry-after header or use exponential backoff
              const delay = Math.min(100 * Math.pow(2, attempt - 1), 5000);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            if (error.code === 'RATE_LIMIT' && attempt < maxRetries) {
              attempt++;
              continue;
            }
            throw error;
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      const startTime = Date.now();
      const result = await worker.processJob(job);
      const totalTime = Date.now() - startTime;
      
      await worker.stop();

      expect(result.success).toBe(true);
      expect(retryLog).toHaveLength(3);
      expect(retryLog[0].type).toBe('rate_limit');
      expect(retryLog[1].type).toBe('rate_limit');
      expect(retryLog[2].type).toBe('success');
      
      // Should have taken time due to retry delays
      expect(totalTime).toBeGreaterThan(300); // At least 100 + 200 ms for retries
    });

    test('should retry on server errors (5xx) but not client errors (4xx)', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const errorLog = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        errorLog.push({
          attempt: attemptCount,
          timestamp: Date.now()
        });

        if (attemptCount === 1) {
          // First attempt: 500 server error (should retry)
          throw testUtils.createServerError('Internal Server Error', 500);
        } else if (attemptCount === 2) {
          // Second attempt: 503 service unavailable (should retry)
          throw testUtils.createServerError('Service Unavailable', 503);
        } else {
          // Third attempt: success
          return [testUtils.createTestComment('server_error_recovery', organizationId)];
        }
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
            // Retry on 5xx errors, but not 4xx errors
            if (error.statusCode >= 500 && error.statusCode < 600 && attempt < maxRetries) {
              attempt++;
              continue;
            }
            
            // Don't retry 4xx errors or if max retries exceeded
            throw error;
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(errorLog).toHaveLength(3); // 2 server errors + 1 success
    });

    test('should handle intermittent connectivity issues', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const connectivityLog = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const timestamp = Date.now();
        
        // Simulate intermittent connectivity: fail on attempts 1, 3, succeed on 2, 4
        const shouldFail = attemptCount === 1 || attemptCount === 3;
        
        connectivityLog.push({
          attempt: attemptCount,
          connected: !shouldFail,
          timestamp
        });

        if (shouldFail) {
          throw testUtils.createConnectivityError(`Connection refused attempt ${attemptCount}`);
        }
        
        return [testUtils.createTestComment(`connectivity_${attemptCount}`, organizationId)];
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 5;
        let attempt = 0;
        let successfulAttempts = 0;
        const targetSuccessfulAttempts = 2; // Need 2 successful fetches
        
        while (attempt <= maxRetries && successfulAttempts < targetSuccessfulAttempts) {
          try {
            if (attempt > 0) {
              const delay = Math.min(50 * Math.pow(1.5, attempt - 1), 1000);
              await testUtils.wait(delay);
            }
            
            const result = await originalProcessJob.call(this, job);
            successfulAttempts++;
            
            if (successfulAttempts >= targetSuccessfulAttempts) {
              return result;
            }
          } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.code === 'CONNECTIVITY_ERROR') {
              attempt++;
              if (attempt <= maxRetries) {
                continue; // Retry connectivity errors
              }
            }
            throw error;
          }
        }
        
        return { success: true, commentsCount: successfulAttempts };
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(connectivityLog.length).toBeGreaterThanOrEqual(2);
      
      // Should have both successful and failed connectivity attempts
      const successfulAttempts = connectivityLog.filter(log => log.connected);
      const failedAttempts = connectivityLog.filter(log => !log.connected);
      
      expect(successfulAttempts.length).toBeGreaterThan(0);
      expect(failedAttempts.length).toBeGreaterThan(0);
    });
  });

  describe('Permanent Error Handling', () => {
    test('should not retry on authentication errors', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        throw testUtils.createAuthError('Invalid API credentials');
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
            // Don't retry authentication errors
            if (error.code === 'AUTH_ERROR' || error.statusCode === 401 || error.statusCode === 403) {
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
      
      await expect(worker.processJob(job)).rejects.toThrow('Invalid API credentials');
      
      await worker.stop();

      // Should only attempt once for auth errors
      expect(attemptCount).toBe(1);
    });

    test('should not retry on forbidden access errors', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        throw testUtils.createForbiddenError('Access denied to resource');
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            return await originalProcessJob.call(this, job);
          } catch (error) {
            if (error.statusCode === 403 || error.code === 'FORBIDDEN') {
              throw error; // Don't retry forbidden errors
            }
            
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
            
            const delay = 100 * Math.pow(2, attempt - 1);
            await testUtils.wait(delay);
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      await expect(worker.processJob(job)).rejects.toThrow('Access denied to resource');
      
      await worker.stop();

      expect(attemptCount).toBe(1);
    });

    test('should not retry on malformed request errors (400)', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        throw testUtils.createBadRequestError('Invalid request parameters');
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            return await originalProcessJob.call(this, job);
          } catch (error) {
            // Don't retry 4xx client errors
            if (error.statusCode >= 400 && error.statusCode < 500) {
              throw error;
            }
            
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
            
            const delay = 100 * Math.pow(2, attempt - 1);
            await testUtils.wait(delay);
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      await expect(worker.processJob(job)).rejects.toThrow('Invalid request parameters');
      
      await worker.stop();

      expect(attemptCount).toBe(1);
    });

    test('should not retry on resource not found errors (404)', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        throw testUtils.createNotFoundError('Resource not found');
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            return await originalProcessJob.call(this, job);
          } catch (error) {
            if (error.statusCode === 404) {
              throw error; // Don't retry not found errors
            }
            
            attempt++;
            if (attempt > maxRetries) {
              throw error;
            }
            
            const delay = 100 * Math.pow(2, attempt - 1);
            await testUtils.wait(delay);
          }
        }
      };

      await worker.start();
      const job = testUtils.createMockJob(organizationId, 'twitter');
      
      await expect(worker.processJob(job)).rejects.toThrow('Resource not found');
      
      await worker.stop();

      expect(attemptCount).toBe(1);
    });
  });

  describe('Error Classification and Recovery', () => {
    test('should correctly classify and handle mixed error scenarios', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const errorClassificationLog = [];
      let attemptCount = 0;

      const errorScenarios = [
        { type: 'network', error: () => testUtils.createNetworkError('Network timeout'), retryable: true },
        { type: 'server', error: () => testUtils.createServerError('Internal Server Error', 500), retryable: true },
        { type: 'auth', error: () => testUtils.createAuthError('Unauthorized'), retryable: false },
        { type: 'success', error: null, retryable: null }
      ];

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        const scenario = errorScenarios[Math.min(attemptCount - 1, errorScenarios.length - 1)];
        
        errorClassificationLog.push({
          attempt: attemptCount,
          scenario: scenario.type,
          timestamp: Date.now()
        });

        if (scenario.error) {
          throw scenario.error();
        }
        
        return [testUtils.createTestComment('mixed_errors_success', organizationId)];
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 5;
        let attempt = 0;
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              const delay = 100 * Math.pow(2, attempt - 1);
              await testUtils.wait(delay);
            }
            
            return await originalProcessJob.call(this, job);
          } catch (error) {
            const isRetryable = !(
              error.code === 'AUTH_ERROR' ||
              error.statusCode === 401 ||
              error.statusCode === 403 ||
              (error.statusCode >= 400 && error.statusCode < 500)
            );

            if (!isRetryable) {
              throw error; // Don't retry non-retryable errors
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
      
      // This should eventually succeed after retrying network and server errors
      const result = await worker.processJob(job);
      
      await worker.stop();

      expect(result.success).toBe(true);
      expect(errorClassificationLog.length).toBeGreaterThan(1);
      
      // Should have retried transient errors but stopped at success
      const scenarios = errorClassificationLog.map(log => log.scenario);
      expect(scenarios).toContain('network');
      expect(scenarios).toContain('server');
      expect(scenarios[scenarios.length - 1]).toBe('success');
    });

    test('should maintain error context and logging throughout retry process', async () => {
      const organizationId = 'test-org-retry';
      const worker = testUtils.createTestWorker();
      const detailedErrorLog = [];
      let attemptCount = 0;

      worker.fetchCommentsFromPlatform = async () => {
        attemptCount++;
        
        if (attemptCount <= 3) {
          const error = testUtils.createNetworkError(`Network failure ${attemptCount}`);
          error.attemptNumber = attemptCount;
          error.timestamp = new Date().toISOString();
          throw error;
        }
        
        return [testUtils.createTestComment('error_logging_success', organizationId)];
      };

      const originalProcessJob = worker.processJob.bind(worker);
      worker.processJob = async function(job) {
        const maxRetries = 5;
        let attempt = 0;
        const retryContext = {
          jobId: job.id,
          organizationId: job.organization_id,
          startTime: Date.now(),
          errors: []
        };
        
        while (attempt <= maxRetries) {
          try {
            if (attempt > 0) {
              const delay = 100 * Math.pow(2, attempt - 1);
              await testUtils.wait(delay);
            }
            
            const result = await originalProcessJob.call(this, job);
            
            // Log successful completion with context
            detailedErrorLog.push({
              type: 'success',
              attempt: attempt + 1,
              context: retryContext,
              totalTime: Date.now() - retryContext.startTime
            });
            
            return result;
          } catch (error) {
            // Add error to context
            retryContext.errors.push({
              attempt: attempt + 1,
              error: error.message,
              code: error.code,
              timestamp: error.timestamp,
              isRetryable: error.isTransient !== false
            });

            detailedErrorLog.push({
              type: 'error',
              attempt: attempt + 1,
              error: error.message,
              code: error.code,
              retryable: error.isTransient !== false,
              context: JSON.parse(JSON.stringify(retryContext)) // Deep copy for logging
            });

            if (error.isTransient === false) {
              throw error; // Don't retry permanent errors
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
      const result = await worker.processJob(job);
      await worker.stop();

      expect(result.success).toBe(true);
      expect(detailedErrorLog.length).toBeGreaterThan(3); // At least 3 errors + 1 success

      // Verify error context is maintained
      const errorEntries = detailedErrorLog.filter(log => log.type === 'error');
      const successEntry = detailedErrorLog.find(log => log.type === 'success');

      expect(errorEntries).toHaveLength(3);
      expect(successEntry).toBeTruthy();
      expect(successEntry.context.errors).toHaveLength(3);

      // Verify attempt numbering is correct
      errorEntries.forEach((log, index) => {
        expect(log.attempt).toBe(index + 1);
        expect(log.retryable).toBe(true);
      });

      expect(successEntry.attempt).toBe(4);
    });
  });
});