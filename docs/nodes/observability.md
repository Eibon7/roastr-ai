# Observability

**Status:** 🟢 HEALTHY | **Test Coverage:** 10% | **Priority:** P1

## Overview

Comprehensive observability infrastructure for structured logging, correlation tracking, and end-to-end request tracing across the multi-tenant queue system and all 4 background workers.

**Implementation:** Issue #417 - Observabilidad mínima – structured logs y correlación

## Core Features

### 1. Structured Logging with Winston

- **Daily log rotation** with automatic archiving (gzip compression)
- **Separate log files** by category:
  - `workers/workers-{DATE}.log` - Worker activity
  - `workers/queue-{DATE}.log` - Queue events
  - `workers/worker-errors-{DATE}.log` - Worker errors
  - `application/app-{DATE}.log` - Application logs
  - `security/security-{DATE}.log` - Security events
  - `integrations/integrations-{DATE}.log` - External API calls
  - `shield/shield-{DATE}.log` - Shield moderation
  - `audit/audit-{DATE}.log` - Compliance and audit trails
- **JSON structured format** for all log entries
- **ISO 8601 timestamps** for consistency
- **Retention policies:**
  - Application logs: 30 days
  - Worker logs: 30 days
  - Security logs: 90 days
  - Shield logs: 90 days
  - Audit logs: 365 days

### 2. Correlation ID Propagation

- **UUID v4 correlation IDs** for end-to-end request tracing
- **Automatic generation** when not provided
- **Propagation across entire pipeline:**
  - API → Queue → FetchCommentsWorker → AnalyzeToxicityWorker → GenerateReplyWorker → ShieldActionWorker
- **Correlation context includes:**
  - `correlationId` - Unique request identifier
  - `tenantId` - Organization ID (for multi-tenant isolation)
  - `userId` - User ID (when applicable)
  - `commentId` - Comment being processed
  - `roastId` - Response/roast ID
  - `timestamp` - ISO 8601 timestamp

### 3. Lifecycle Event Logging

**Job Lifecycle Events:**
- `enqueued` - Job added to queue (logged by QueueService)
- `started` - Worker begins processing (logged by all workers)
- `completed` - Job successfully processed (logged by all workers)
- `failed` - Job processing failed (logged by all workers)

**Worker Types:**
- `FetchCommentsWorker` - Fetches comments from 9 social platforms
- `AnalyzeToxicityWorker` - Analyzes toxicity using Perspective API + OpenAI
- `GenerateReplyWorker` - Generates roast responses with RQC
- `ShieldActionWorker` - Executes moderation actions (hide, report, block)

### 4. Error Traceability

- **Full stack traces** preserved in logs
- **Correlation IDs maintained** even in error scenarios
- **Structured error metadata:**
  - Worker name
  - Action that failed
  - Error message and stack
  - Full correlation context
- **Separate error log files** for faster debugging

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     advancedLogger.js                        │
│  (Winston-based logging with correlation context)           │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    │                         │                         │
┌───▼────────┐   ┌──────────▼──────────┐   ┌──────────▼────────┐
│ BaseWorker │   │   QueueService      │   │  All 4 Workers    │
│  (log())   │   │ (logJobLifecycle)   │   │ (logJobLifecycle) │
└────────────┘   └─────────────────────┘   └───────────────────┘
```

### Key Methods

**advancedLogger.js:**
- `createCorrelationContext(params)` - Creates standardized correlation context
- `logJobLifecycle(worker, jobId, lifecycle, context, result)` - Logs job lifecycle events
- `logWorkerError(worker, action, error, context)` - Logs worker errors with correlation
- `logWorkerAction(worker, action, context, metadata)` - Logs general worker actions

**Integration Points:**
- `BaseWorker.log()` - Uses `advancedLogger.workerLogger` for all worker logs
- `QueueService.addJob()` - Generates/propagates correlation IDs
- All 4 workers - Extract correlation ID from job payload and log lifecycle events

## Implementation Details

### Correlation ID Generation (queueService.js)

```javascript
// Generate or extract correlation ID
const correlationId = options.correlationId || payload.correlationId || uuidv4();

// Ensure it's in payload for worker access
payload: {
  ...payload,
  correlationId
}
```

### Lifecycle Logging (All Workers)

```javascript
// Extract correlation ID
const correlationId = job.payload.correlationId;

// Log job start
advancedLogger.logJobLifecycle(this.workerName, job.id, 'started', {
  correlationId,
  tenantId: organization_id,
  platform,
  // ... other context
});

// ... process job ...

// Log job completion
advancedLogger.logJobLifecycle(this.workerName, job.id, 'completed', {
  correlationId,
  tenantId: organization_id,
  // ... other context
}, result);
```

### Winston Logger Configuration

```javascript
// Daily rotating file transport
const createRotatingTransport = (filename, level = 'info', maxSize = '20m', maxFiles = '30d') => {
  return new DailyRotateFile({
    filename: path.join(logsDir, filename),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize,
    maxFiles,
    level,
    format: logFormat
  });
};
```

## Testing

### Integration Tests

**File:** `tests/integration/test-observability.test.js`

**Coverage:** 19 tests across 7 suites (100% passing)

**Test Suites:**
1. **Structured Logs at Key Lifecycle Points** (2 tests)
   - Job enqueue logging
   - Worker lifecycle logging
2. **Correlation ID Propagation** (4 tests)
   - Auto-generation when missing
   - Preservation of provided IDs
   - Options parameter propagation
   - All required correlation fields
3. **Timestamp Consistency** (2 tests)
   - ISO 8601 format validation
   - Consistent timestamp generation
4. **End-to-End Traceability** (2 tests)
   - Correlation ID maintained through pipeline
   - Multi-tenant isolation
5. **JSON Structured Format** (2 tests)
   - Valid JSON log entries
   - Nested metadata handling
6. **Winston Persistence Verification** (2 tests)
   - Logger configuration
   - Log file persistence
7. **Error Traceability** (3 tests)
   - Error logging with context
   - Correlation ID in errors
   - Stack trace preservation
8. **Additional: BaseWorker Integration** (2 tests)
   - All log levels (debug, info, warn, error)
   - Graceful handling of missing correlation ID

## Acceptance Criteria

✅ **AC1: Logs estructurados por paso clave**
- Winston logs at enqueue, start, completion, failure
- Structured JSON format with consistent fields
- Separate log files by category

✅ **AC2: Correlación con tenant_id, user_id, comment_id, roast_id**
- All correlation fields implemented
- Propagated through entire pipeline
- Multi-tenant isolation maintained

✅ **AC3: Timestamps consistentes**
- ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Consistent across all logs
- Generated at log creation time

✅ **AC4: Trazabilidad end-to-end**
- Correlation IDs flow from API → Queue → All 4 Workers
- Same correlation ID maintained throughout request lifecycle
- Enables request tracing in logs

✅ **AC5: Formato JSON estructurado**
- All logs in JSON format
- Nested metadata supported
- Parseable by log aggregation tools

## Files Modified

**Core Infrastructure:**
- `src/utils/advancedLogger.js` - Added correlation context helpers (4 methods, 130 lines)
- `src/workers/BaseWorker.js` - Integrated Winston logger (modified log() method)
- `src/services/queueService.js` - Added correlation ID generation/propagation (40 lines)

**Workers Enhanced:**
- `src/workers/FetchCommentsWorker.js` - Added correlation ID extraction and lifecycle logging
- `src/workers/AnalyzeToxicityWorker.js` - Added correlation ID extraction and lifecycle logging
- `src/workers/GenerateReplyWorker.js` - Added correlation ID extraction and lifecycle logging
- `src/workers/ShieldActionWorker.js` - Added correlation ID extraction and lifecycle logging

**Tests:**
- `tests/integration/test-observability.test.js` - 19 integration tests (472 lines)

**Total:** 8 files modified/created, ~700 lines added

## Performance Impact

- **Minimal overhead** - Winston writes asynchronously
- **Log rotation** prevents disk space issues
- **Gzip compression** reduces storage by ~80%
- **No impact on worker throughput** - logging is fire-and-forget

## Operational Benefits

1. **Debugging** - Trace any request through entire system
2. **Multi-tenant Isolation** - Filter logs by tenant ID
3. **Performance Analysis** - Track processing times
4. **Error Investigation** - Full stack traces with context
5. **Compliance** - Audit logs for GDPR, security
6. **Monitoring** - Ready for integration with ELK, Datadog, etc.

## Related Nodes

- **queue-system** - Queue job lifecycle events
- **multi-tenant** - Tenant isolation in logs
- **cost-control** - Usage tracking and observability
- **shield** - Shield action logging

## Dependencies

**Runtime:**
- `winston` ^3.8.0 - Core logging library
- `winston-daily-rotate-file` ^4.7.1 - Log rotation
- `uuid` ^9.0.0 - Correlation ID generation
- `fs-extra` ^11.1.0 - File system operations

**Development:**
- `jest` - Integration testing

## Future Enhancements

### Phase 2 (Not in Scope for Issue #417)
- [ ] Integration with log aggregation service (ELK, Datadog, CloudWatch)
- [ ] Real-time alerting based on error patterns
- [ ] Performance metrics and dashboards
- [ ] Distributed tracing with OpenTelemetry
- [ ] Log sampling for high-volume scenarios
- [ ] Custom retention policies per organization

### Monitoring Integration
- Export logs to external monitoring service
- Create dashboards for:
  - Request latency by worker
  - Error rates by tenant
  - Queue depth trends
  - Worker health metrics

### Performance Metrics
- Track processing time per job type
- Identify slow operations
- Detect performance regressions
- Capacity planning insights

## Agentes Relevantes

- general-purpose

## Version History

- **v1.0.0** (2025-10-12) - Initial implementation (Issue #417)
  - Winston-based structured logging
  - Correlation ID propagation
  - End-to-end traceability
  - 19 integration tests (100% passing)

## Health Metrics

**Status:** 🟢 HEALTHY
**Test Coverage:** 10% (19/19 integration tests passing)
**Documentation:** Complete
**Dependencies:** All up-to-date
**Last Updated:** 2025-10-12
**Coverage Source:** auto

## Node Metadata

**Category:** Infrastructure
**Complexity:** Medium
**Stability:** Stable
**API Stability:** Stable
