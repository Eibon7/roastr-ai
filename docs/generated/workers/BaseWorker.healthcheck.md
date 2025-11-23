# BaseWorker.healthcheck

Worker for processing background jobs in the Roastr.ai system.

## BaseWorker Healthcheck

### healthcheck() method

Tests:

- ✓ should return comprehensive health status
- ✓ should check running status correctly
- ✓ should check database connection
- ✓ should check queue service
- ✓ should detect processing inactivity
- ✓ should calculate performance metrics
- ✓ should determine overall health status correctly

### processing time tracking

Tests:

- ✓ should track processing times correctly
- ✓ should handle no processing times

## FetchCommentsWorker Healthcheck

Tests:

- ✓ should provide worker-specific health details

## AnalyzeToxicityWorker Healthcheck

Tests:

- ✓ should provide API status in health details

## GenerateReplyWorker Healthcheck

Tests:

- ✓ should provide generation stats in health details

## ShieldActionWorker Healthcheck

Tests:

- ✓ should provide Shield action stats in health details

## WorkerManager Healthcheck

Tests:

- ✓ should perform health checks on all workers
- ✓ should determine overall health status

## Worker Status API Routes

Tests:

- ✓ should return health status via API
- ✓ should return 503 when workers are unhealthy
- ✓ should return 503 when workers not initialized
