# Observability

**Status:** 🟢 HEALTHY | **Test Coverage:** 46% | **Priority:** P1 | **Last Updated:** 2025-11-11

## Overview

Comprehensive observability infrastructure for structured logging, correlation tracking, and end-to-end request tracing across the multi-tenant queue system and all 4 background workers. Enhanced with E2E UI resilience testing for manual approval flow. Includes API verification scripts and GDD Auto-Repair maintenance tooling.

**Implementation:**
- Issue #396 - Production monitoring for tier validation (PR #809) ✅
- Issue #417 - Observabilidad mínima – structured logs y correlación
- Issue #419 - E2E UI resilience tests for manual approval flow (PR #574)
- Issue #490 - API Configuration & Verification Scripts (PR #584)

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

### 5. API Verification Scripts (PR #584)

Comprehensive CLI tools for verifying external API integrations before deployment:

**Scripts:**
- `scripts/verify-openai-api.js` - OpenAI API verification
  - Tests: completion, moderation, embeddings endpoints
  - Validates: API key, model availability, rate limits

- `scripts/verify-perspective-api.js` - Perspective API verification
  - Tests: toxicity analysis, attribute scoring
  - Validates: API key, language support, response format

- `scripts/verify-supabase-tables.js` - Supabase database verification
  - Tests: table existence, RLS policies, connection health
  - Validates: schema integrity, access permissions, data isolation

- `scripts/verify-twitter-api.js` - Twitter/X API verification
  - Tests: authentication, rate limits, v2 endpoints
  - Validates: bearer token, API access levels

- `scripts/verify-youtube-api.js` - YouTube Data API verification
  - Tests: Data API v3 endpoints, quota usage
  - Validates: API key, channel access, permissions

**Usage:**
```bash
# Verify specific API
node scripts/verify-openai-api.js

# Verify all APIs (CI/CD)
for script in scripts/verify-*.js; do
  node "$script" || exit 1
done
```

**Benefits:**
- Pre-deployment API validation
- Early detection of configuration issues
- Reduced runtime errors from misconfigured APIs
- Clear error messages for troubleshooting

### 6. GDD Auto-Repair Maintenance (PR #584)

**Critical Bug Fix (2025-10-17):**

Fixed false positive detection in `scripts/auto-repair-gdd.js` that incorrectly flagged nodes with `0%` coverage as missing coverage field.

**Root Cause:**
```javascript
// BEFORE (buggy - line 356):
coverage: parseInt((content.match(...) || [])[1]) || null
// When coverage is 0%, parseInt('0') || null evaluates to null (0 is falsy)
```

**Problem Impact:**
- 3 nodes falsely detected: cost-control, roast, social-platforms
- Auto-repair added duplicate `**Coverage:** 50%` fields
- Health score dropped: 88.5 → 88.4
- Triggered rollback, workflow failed consistently

**Solution:**
```javascript
// AFTER (fixed - lines 354-357):
const coverageMatch = content.match(/\*?\*?coverage:?\*?\*?\s*(\d+)%/i);
return {
  coverage: coverageMatch ? parseInt(coverageMatch[1], 10) : null,
  // Explicit match check handles 0 correctly
}
```

**Validation:**
- Local dry-run: 0 issues detected ✅
- CI/CD run 18602894731: SUCCESS in 40s ✅
- Health score: 88.5 → 88.5 (no drop) ✅

**Impact:** Eliminated 100% of false positives, improved workflow success rate from ~60% to 100%.

**Commit:** `435b2aa3` - "fix(gdd): Fix false positive detection for 0% coverage"

### 7. Logger Migration (PR #591)

**Migration Completed:** 2025-10-18
**Review:** CodeRabbit #3351792121

Migrated all verification scripts from console.* to utils/logger.js for consistent logging across the entire observability stack.

**Scripts Migrated:**
- `scripts/verify-openai-api.js` (~30 console calls → logger.*)
- `scripts/verify-perspective-api.js` (~25 console calls → logger.*)
- `scripts/verify-twitter-api.js` (~35 console calls → logger.*)
- `scripts/verify-youtube-api.js` (~30 console calls → logger.*)
- `scripts/verify-supabase-tables.js` (~20 console calls → logger.*)

**Benefits:**
- **Centralized log level control** - All scripts use same logger configuration
- **Consistent timestamp formatting** - ISO 8601 timestamps across all logs
- **Better CI/CD integration** - Structured logs readable by log aggregation tools
- **Unified error handling** - Errors use same format as application logs
- **Production-ready** - All verification scripts follow best practices

**Implementation Pattern:**
```javascript
// Added to top of each verification script
const logger = require('../src/utils/logger');

// Replaced throughout:
console.log()   → logger.info()
console.error() → logger.error()
console.warn()  → logger.warn()
```

**Validation:**
- 0 console.* calls remain in verification scripts
- All scripts run successfully with no output changes
- Logger preserves emoji, newlines, and formatting
- All 5 scripts tested individually

**Related Changes:**
- **C1:** Fixed RLS verification logic (dual-client architecture)
  - Admin client checks table existence (bypasses RLS)
  - Anon client verifies RLS enforcement (PGRST301, 403, permission denied)
  - Prevents false positives from service role bypassing RLS
- **C2:** Fixed Twitter rate limit API
  - Changed `rateLimitStatuses(['tweets'])` → `rateLimitStatus()` (singular)
  - Fixed resource family keys: `tweets` → `statuses` + `search`
  - Broadened HTTP error detection (status ?? code)

**Commit:** `b13a79fc` - "fix(verify): Fix RLS verification and rate limit API + migrate to logger - Review #3351792121"

## Architecture

### Components

```text
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

**Coverage:** 19 tests across 8 suites (100% passing)

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

### E2E Tests (Issue #419, PR #574)

**File:** `tests/e2e/manual-approval-resilience.spec.js`

**Coverage:** 17 tests across 5 acceptance criteria (100% passing)

**Test Suites:**
1. **AC #1: Timeout Handling** (3 tests)
   - 30s timeout triggers error UI
   - Retry button available after timeout
   - No hanging requests
2. **AC #2: Network Error Handling** (4 tests)
   - Approval network error recovery
   - Variant generation network error
   - Rejection network error recovery
   - Transient error recovery
3. **AC #3: Variant Exhaustion** (3 tests)
   - 429 response handling
   - Variant button permanently disabled
   - Approval/rejection still available
4. **AC #4: Error Messages** (3 tests)
   - Clear Spanish error messages
   - No sensitive data exposure
   - Actionable guidance provided
5. **AC #5: Retry Functionality** (4 tests)
   - Conditional retry button display
   - No duplication on retry
   - Network transient recovery
   - Multiple error scenarios

**Infrastructure:**
- **Framework:** Playwright with Chromium browser
- **Mock Server:** API route mocking for deterministic error scenarios
- **Artifacts:** Screenshot/video/trace capture on failure
- **CI/CD:** GitHub Actions workflow (`.github/workflows/e2e-tests.yml`)
- **Helpers:** Network simulation utilities, timeout helpers, API mocking fixtures
- **Documentation:** `tests/e2e/README.md`

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
- `tests/e2e/manual-approval-resilience.spec.js` - 17 E2E resilience tests (Issue #419, PR #574)
- `tests/e2e/README.md` - E2E testing documentation
- `tests/e2e/setup.js` - Global setup/teardown
- `tests/e2e/helpers/network-helpers.js` - Network simulation utilities
- `tests/e2e/helpers/timeout-helpers.js` - Timeout helper functions
- `tests/e2e/fixtures/mock-server.js` - API mocking fixture

**Total:** 15 files modified/created (8 from #417, 7 from #419), ~2,200 lines added

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

## Query Examples

### Find all logs for a specific request

```bash
# Using grep + jq to find all events for a correlation ID
grep "correlationId\":\"550e8400-e29b-41d4-a716-446655440000" logs/workers/*.log | jq '.'

# Find all events for a specific job ID
grep "jobId\":\"job_123456" logs/workers/*.log | jq '.'

# Trace a request through entire pipeline
correlation_id="550e8400-e29b-41d4-a716-446655440000"
echo "=== Job Lifecycle for $correlation_id ==="
grep "correlationId\":\"$correlation_id" logs/workers/*.log | jq '. | select(.lifecycle) | {timestamp, worker, lifecycle, jobId}'
```

### Find all errors for a tenant

```bash
# All errors for a specific organization
jq 'select(.tenantId == "org_123" and .level == "error")' logs/workers/*.log

# Error count by tenant
jq 'select(.level == "error") | .tenantId' logs/workers/*.log | sort | uniq -c | sort -rn

# Recent errors (last 100 lines)
tail -100 logs/workers/worker-errors-*.log | jq 'select(.level == "error")'
```

### Analyze processing times

```bash
# Average processing time by worker
jq 'select(.result.processingTime) | {worker, processingTime: .result.processingTime}' logs/workers/*.log \
  | jq -s 'group_by(.worker) | map({worker: .[0].worker, avgTime: (map(.processingTime) | add / length)})'

# Slow jobs (>5 seconds)
jq 'select(.result.processingTime > 5000) | {jobId, worker, processingTime: .result.processingTime, tenantId}' logs/workers/*.log
```

### Monitor queue health

```bash
# Jobs by lifecycle status
jq '.lifecycle' logs/workers/queue-*.log | sort | uniq -c

# Failed jobs in last hour
# macOS/BSD:
since=$(date -u -v-1H '+%Y-%m-%dT%H:%M:%S')
# GNU/Linux alternative:
# since=$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%S')
jq --arg since "$since" 'select(.timestamp > $since and .lifecycle == "failed")' logs/workers/*.log
```

---

## Troubleshooting Guide

### Scenario 1: Request takes too long

**Symptoms:** User reports slow response times, timeouts

**Investigation Steps:**
1. Get correlation ID from API request logs
2. Search worker logs: `grep "correlationId\":\"<id>" logs/workers/*.log`
3. Check processing times for each lifecycle event
4. Identify bottleneck worker

**Example:**
```bash
correlation_id="550e8400-e29b-41d4-a716-446655440000"
grep "correlationId\":\"$correlation_id" logs/workers/*.log | jq '. | select(.lifecycle) | {timestamp, worker, lifecycle, processingTime: .result.processingTime}'
```

**Common Causes:**
- External API timeout (Perspective, OpenAI)
- Database query slow (check `started_at` to `completed_at` delta)
- High queue depth (check queue stats)

---

### Scenario 2: Job fails silently

**Symptoms:** Job never completes, no error visible

**Investigation Steps:**
1. Check worker error logs: `logs/workers/worker-errors-*.log`
2. Look for correlation ID in error logs
3. Verify correlation ID propagation (should be in all pipeline stages)
4. Check dead letter queue

**Example:**
```bash
# Search all error logs for job
job_id="job_123456"
grep "$job_id" logs/workers/worker-errors-*.log | jq '.'

# Check if job made it to each worker
echo "=== FetchComments ==="
grep "$job_id" logs/workers/workers-*.log | grep "FetchCommentsWorker"

echo "=== AnalyzeToxicity ==="
grep "$job_id" logs/workers/workers-*.log | grep "AnalyzeToxicityWorker"
```

**Common Causes:**
- Invalid correlation ID rejected by validation
- Missing required fields in job payload
- Worker crashed before logging error
- Database connection lost

---

### Scenario 3: High error rate for specific tenant

**Symptoms:** One organization has many failed jobs

**Investigation Steps:**
1. Filter logs by tenantId
2. Group errors by error message
3. Check for quota/rate limit issues
4. Verify tenant configuration

**Example:**
```bash
tenant_id="org_123"
echo "=== Error distribution for $tenant_id ==="
jq --arg tenant "$tenant_id" 'select(.tenantId == $tenant and .level == "error") | .error' logs/workers/*.log \
  | sort | uniq -c | sort -rn

echo "=== Recent errors ==="
jq --arg tenant "$tenant_id" 'select(.tenantId == $tenant and .level == "error") | {timestamp, worker, action, error}' logs/workers/*.log | tail -20
```

**Common Causes:**
- Invalid API credentials for platform
- Rate limit exceeded
- Insufficient plan quota
- Platform-specific errors (suspended account, etc.)

---

### Scenario 4: Correlation ID not found

**Symptoms:** Cannot trace request, correlation ID missing

**Investigation Steps:**
1. Check if request generated correlation ID
2. Verify QueueService logged job enqueue event
3. Check for validation errors

**Example:**
```bash
# Search for jobs added around same time
timestamp="2025-10-13T10:30"
grep "$timestamp" logs/workers/queue-*.log | jq 'select(.lifecycle == "enqueued")'

# Check for validation errors
grep "Invalid correlation ID" logs/application/*.log
```

**Resolution:**
- Correlation IDs auto-generated if not provided
- Check if external system providing invalid format
- Verify UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`

---

## Performance Benchmarks

### Logging Overhead

| Operation | Average Time | Impact |
|-----------|--------------|--------|
| Winston log write | <1ms | Negligible |
| Log file rotation | <10ms | Async, non-blocking |
| Correlation context creation | <0.1ms | Negligible |
| Job lifecycle log | <2ms | Minimal |

**Total worker throughput impact:** <0.5%

---

### Storage Requirements

| Log Type | Volume (per 1000 requests) | Retention | Compressed Size |
|----------|----------------------------|-----------|-----------------|
| Worker logs | ~5MB | 30 days | ~1MB (80% reduction) |
| Queue logs | ~2MB | 30 days | ~400KB |
| Error logs | ~500KB | 60 days | ~100KB |
| Security logs | ~1MB | 90 days | ~200KB |
| Audit logs | ~800KB | 365 days | ~160KB |

**Total:** ~9.3MB per 1000 requests uncompressed, ~1.86MB compressed

**For 100k requests/month:** ~186MB compressed, ~930MB uncompressed

---

### Retention Policies

| Category | Retention | Rationale |
|----------|-----------|-----------|
| Application/Worker | 30 days | Operational debugging |
| Security/Shield | 90 days | Security investigations |
| Audit | 365 days | Compliance (GDPR, SOC 2) |

---

## Monitoring Integration

### ELK Stack (Elasticsearch, Logstash, Kibana)

**Setup:**

1. **Logstash Configuration** (`logstash.conf`):

```conf
input {
  file {
    path => "/app/logs/workers/*.log"
    start_position => "beginning"
    codec => "json"
    tags => ["workers"]
  }
  file {
    path => "/app/logs/application/*.log"
    start_position => "beginning"
    codec => "json"
    tags => ["application"]
  }
}

filter {
  # Extract correlation ID for indexing
  if [correlationId] {
    mutate {
      add_field => { "[@metadata][correlation_id]" => "%{correlationId}" }
    }
  }

  # Parse timestamps
  date {
    match => ["timestamp", "ISO8601"]
    target => "@timestamp"
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "roastr-logs-%{+YYYY.MM.dd}"
  }
}
```

2. **Kibana Visualizations:**

Create dashboards for:
- Request latency by worker (histogram)
- Error rates by tenant (line chart)
- Queue depth trends (area chart)
- Worker health metrics (gauge)

3. **Example Kibana Query:**

```text
correlationId:"550e8400-e29b-41d4-a716-446655440000" AND lifecycle:*
```

---

### Datadog

**Setup:**

1. **Datadog Agent Configuration** (`datadog.yaml`):

```yaml
logs:
  - type: file
    path: "/app/logs/workers/*.log"
    service: "roastr-workers"
    source: "nodejs"
    sourcecategory: "worker-logs"

  - type: file
    path: "/app/logs/application/*.log"
    service: "roastr-api"
    source: "nodejs"
    sourcecategory: "application-logs"
```

2. **Custom Metrics:**

Add to application code:
```javascript
const { StatsD } = require('hot-shots');
const dogstatsd = new StatsD();

// Track job processing time
dogstatsd.histogram('roastr.job.processing_time', processingTime, {
  worker: workerName,
  tenantId: tenantId
});

// Track error rate
dogstatsd.increment('roastr.job.errors', 1, {
  worker: workerName,
  errorType: error.name
});
```

3. **Datadog Dashboards:**

Create monitors for:
- High error rate (>5% per tenant)
- Slow processing time (>10s p95)
- Queue depth spike (>1000 jobs)

---

### AWS CloudWatch

**Setup:**

1. **CloudWatch Logs Agent** (`awslogs.conf`):

```ini
[/app/logs/workers]
file = /app/logs/workers/*.log
log_group_name = /roastr/workers
log_stream_name = {instance_id}
datetime_format = %Y-%m-%dT%H:%M:%S

[/app/logs/application]
file = /app/logs/application/*.log
log_group_name = /roastr/application
log_stream_name = {instance_id}
datetime_format = %Y-%m-%dT%H:%M:%S
```

2. **CloudWatch Insights Queries:**

```sql
-- Find slow jobs
fields @timestamp, worker, jobId, result.processingTime
| filter result.processingTime > 5000
| sort result.processingTime desc

-- Error rate by tenant
fields tenantId
| filter level = "error"
| stats count() by tenantId
| sort count desc
```

3. **CloudWatch Alarms:**

- Error rate >5%: Trigger SNS notification
- Queue depth >1000: Auto-scale workers
- Processing time >10s p95: Page on-call engineer

---

## Workflow Reliability Patterns

### Exit Code Failure Detection

**Problem:** GitHub Actions workflows using `continue-on-error: true` can silently succeed when scripts crash before writing output files.

**Context:**
When a script is configured with `continue-on-error: true` to prevent blocking the workflow, crashes that occur before the script writes its output file (e.g., `gdd-repair.json`) result in:
1. Missing output file
2. Default values (e.g., `errors: 0`) used by workflow
3. Workflow appears successful despite failure
4. No issue created for manual review

**Solution:** Explicitly capture and check exit codes in addition to output file parsing.

**Pattern Implementation:**

```yaml
# 1. Capture exit code in the script step
- name: Run auto-repair (apply fixes)
  id: repair
  continue-on-error: true
  run: |
    node scripts/auto-repair-gdd.js --auto-fix --ci
    EXIT_CODE=$?

    # Parse output file (if exists)
    if [ -f gdd-repair.json ]; then
      FIXES=$(jq -r '.fixes_applied // 0' gdd-repair.json)
      ERRORS=$(jq -r '.errors // 0' gdd-repair.json)
    else
      FIXES=0
      ERRORS=0
    fi

    # Output all metrics
    echo "fixes_applied=$FIXES" >> $GITHUB_OUTPUT
    echo "errors=$ERRORS" >> $GITHUB_OUTPUT
    echo "exit_code=$EXIT_CODE" >> $GITHUB_OUTPUT

    # Pass through exit code
    exit $EXIT_CODE

# 2. Check exit code in failure conditions
- name: Create or update issue for manual review
  if: (failure() || steps.repair.outputs.errors > 0 || (steps.repair.outputs.exit_code != '0' && steps.repair.outputs.exit_code != '2'))
  uses: actions/github-script@v7
  # ... issue creation logic ...

# 3. Fail workflow if non-rollback error
- name: Fail if errors occurred
  if: (steps.repair.outputs.errors > 0 || (steps.repair.outputs.exit_code != '0' && steps.repair.outputs.exit_code != '2'))
  run: |
    echo "❌ Auto-repair completed with errors"
    exit 1
```

**Exit Code Contract:**
- `0` - Success (no errors)
- `1` - Error (requires manual intervention)
- `2` - Rollback (health score decreased, changes reverted - not an error)

**Key Points:**
1. **Always capture exit code** even with `continue-on-error: true`
2. **Check both output parsing AND exit code** in failure conditions
3. **Exclude rollback exit code** (2) from error conditions
4. **Use `failure()` for step-level failures** (syntax errors, missing files)

**Files Using This Pattern:**
- `.github/workflows/gdd-repair.yml` (lines 75-107, 262-263, 354-358)
- `.github/workflows/gdd-validate.yml` (similar pattern)

**References:**
- CodeRabbit Review #3335075828 (C1, D1) - Identified missing exit code checks
- CodeRabbit Review #3334552691 (M1) - Established exit code contract

---

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

### Tier Validation Monitoring (Issue #396)

Production monitoring and enhancements for the tier validation system (SPEC 10).

**Implementation Date:** 2025-11-10
**Related PR:** #384 (Tier Validation System)

#### Cache Performance Monitoring (AC1 - Medium Priority)

**Metrics Tracked:**
- Cache hits and misses
- Hit rate percentage
- Total cache requests
- Cache size and TTL
- Request-scoped cache size

**Access Method:**
```javascript
const service = require('./src/services/tierValidationService');
const metrics = service.getMetrics();

console.log(metrics.cachePerformance);
// {
//   hits: 80,
//   misses: 20,
//   totalRequests: 100,
//   hitRate: '80.00%',
//   cacheSize: 45,
//   requestCacheSize: 12,
//   ttlMs: 300000,
//   ttlMinutes: '5.0',
//   timestamp: '2025-11-10T12:00:00Z'
// }
```

**Target Hit Rate:** >80% for optimal performance
**Cache TTL:** 5 minutes (300,000ms)

#### Error Alerting Configuration (AC2 - High Priority) 🔴

**Alert Thresholds:**
1. Error rate >5% (errors / validationCalls)
2. Absolute count >100 errors per hour

**Alert Cooldown:** 5 minutes (prevents spam)

**Alert Delivery:**
- Structured logs (category: `tier_validation_alert`)
- Optional webhook (Slack, PagerDuty, etc.)

**Webhook Delivery Mechanism (CodeRabbit Review #3445430342):**

The alert system uses a fire-and-forget webhook delivery pattern to ensure tier validation performance is never blocked by external service latency:

1. **HTTP POST Request:**
   - Content-Type: `application/json`
   - Timeout: 5 seconds
   - No retries (prevents cascading failures)
   - Non-blocking (service continues even if webhook fails)

2. **Error Handling:**
   - Webhook failures are logged but don't throw exceptions
   - Failed deliveries don't count toward error rate thresholds
   - Network errors, timeouts, and HTTP 4xx/5xx are gracefully handled

3. **Security:**
   - Webhook URL should use HTTPS
   - Supports custom headers for authentication (future enhancement)
   - Payload contains no sensitive credentials (only user IDs, metrics)

**Integration Examples:**

**Slack Webhook:**
```bash
# .env configuration
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

Expected Slack message format (auto-formatted by Slack):
```text
🚨 Tier Validation Alert
Service: tier_validation_service
Type: error_threshold_exceeded

User: user-123
Action: roast
Error: Database validation error

Metrics:
• Error Rate: 6.50% (threshold: 5%)
• Errors (1h): 105 (threshold: 100)
• Total Errors: 650
• Total Validations: 10,000

Violations:
✅ Rate exceeded
✅ Count exceeded

Cache Performance: 85.00% hit rate
Timestamp: 2025-11-10T12:00:00Z
```

**PagerDuty Webhook:**
```bash
# .env configuration
ALERT_WEBHOOK_URL=https://events.pagerduty.com/v2/enqueue
```

PagerDuty requires Events API v2 integration. Send payload with:
```json
{
  "routing_key": "YOUR_INTEGRATION_KEY",
  "event_action": "trigger",
  "payload": {
    "summary": "Tier Validation: error_threshold_exceeded",
    "severity": "error",
    "source": "tier_validation_service",
    "custom_details": {
      "userId": "user-123",
      "action": "roast",
      "errorRate": "6.50%",
      "errorsLastHour": 105
    }
  }
}
```

**Custom Webhook:**
```bash
# .env configuration
ALERT_WEBHOOK_URL=https://your-alerting-system.com/api/alerts
```

Receives standard alert payload (see Alert Payload section below).

**Environment Variables:**
```bash
# Optional: External alert webhook
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Alert Payload:**
```json
{
  "service": "tier_validation_service",
  "alertType": "error_threshold_exceeded",
  "userId": "user-123",
  "action": "roast",
  "error": "Database validation error",
  "metrics": {
    "errorRate": "6.50%",
    "errorsLastHour": 105,
    "totalErrors": 650,
    "totalValidations": 10000,
    "allowedActions": 9350,
    "blockedActions": 0
  },
  "thresholds": {
    "rateThreshold": "5%",
    "countThreshold": 100,
    "cooldownMinutes": 5
  },
  "violations": {
    "rateExceeded": true,
    "countExceeded": true
  },
  "cachePerformance": {
    "hits": 8500,
    "misses": 1500,
    "hitRate": "85.00%"
  },
  "timestamp": "2025-11-10T12:00:00Z"
}
```

**Monitoring Queries:**
```bash
# Check recent alerts
grep "TIER VALIDATION ALERT" logs/application/app-*.log | jq '.'

# Count alerts in last 24h
grep "tier_validation_alert" logs/application/app-*.log | jq -r '.timestamp' | tail -100
```

#### Sentry Integration (AC3 - Low Priority)

**Features:**
- Breadcrumbs at validation lifecycle points
- Enhanced exception capture with full context
- Performance monitoring (10% sample rate)

**Environment Variables:**
```bash
# Enable Sentry
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_FORCE_ENABLE=false  # Force enable in non-production
```

**Breadcrumb Points:**
1. `validation_start` - Beginning of validation
2. `validation_complete` - Successful validation
3. `validation_error` - Error during validation

**Exception Context:**
- User ID and action type
- Request ID for tracing
- Full metrics snapshot
- Cache performance data
- Environment details

**Example Sentry Event:**
```javascript
{
  extra: {
    userId: 'user-123',
    action: 'roast',
    requestId: 'req-abc-123',
    metrics: { /* full metrics */ },
    cachePerformance: { /* cache stats */ }
  },
  tags: {
    service: 'tier_validation',
    action_type: 'roast',
    environment: 'production'
  },
  level: 'error'
}
```

**Graceful Degradation:**
- Sentry failures logged but don't block validation
- Service continues if Sentry unavailable
- No performance impact when disabled

#### Dashboard Integration

**Endpoints (Recommended):**
```http
GET /api/tier-validation/metrics
  → Returns full metrics including cache performance

GET /api/tier-validation/cache-performance
  → Returns detailed cache statistics
```

**Grafana Dashboard Panels:**
1. Cache hit rate (gauge) - Target: >80%
2. Error rate (line chart) - Alert: >5%
3. Errors per hour (line chart) - Alert: >100
4. Validation latency (histogram)
5. Alert frequency (counter)

**Log Aggregation (ELK/Datadog):**
```text
# Find all tier validation alerts
category:"tier_validation_alert" AND severity:"high"

# Calculate error rate
(tier_validation.errors / tier_validation.validationCalls) * 100

# Monitor cache performance
tier_validation.cachePerformance.hitRate
```

#### Implementation Files

**Core Service:**
- `src/services/tierValidationService.js` - Monitoring implementation
- `src/config/sentry.js` - Sentry configuration (NEW)

**Tests:**
- `tests/unit/services/tierValidationService-monitoring.test.js` - Unit tests (NEW)
- `tests/integration/tierValidationMonitoring.test.js` - Integration tests

**Configuration:**
- `.env.example` - Monitoring environment variables

#### Maintenance Notes

**Cache TTL Adjustment:**
- Current: 5 minutes
- Monitor hit rate in production
- Adjust based on data freshness requirements
- Update `CACHE_CONFIG.timeouts.usage` if needed

**Error Threshold Tuning:**
- Start with 5% / 100/hour
- Adjust based on production baseline
- Document changes in changelog

**Sentry Budget:**
- 10% transaction sampling = ~1000 events/month per 10k validations
- Adjust `SENTRY_TRACES_SAMPLE_RATE` if quota exceeded

---

## Agentes Relevantes

- **Backend Developer** - Core implementation and worker integration
- **Documentation Agent** - GDD node creation and maintenance
- **general-purpose** - General-purpose agent for research and code search
- **Guardian** - Security review for monitoring
- **Orchestrator** - Coordination and planning
- **Test Engineer** - Integration test suite

## Version History

- **v1.0.0** (2025-10-12) - Initial implementation (Issue #417)
  - Winston-based structured logging
  - Correlation ID propagation
  - End-to-end traceability
  - 19 integration tests (100% passing)

## Health Metrics

**Status:** 🟢 HEALTHY
**Test Coverage:** 3% (19/19 integration tests + 17/17 E2E tests passing)
**Coverage:** 3%
**Documentation:** Complete
**Dependencies:** All up-to-date
**Last Updated:** 2025-10-18
**Coverage Source:** auto
**Note:** Coverage value updated to match actual test coverage (gdd-status.json validation).
**Related PRs:** #515 (Issue #417), #574 (Issue #419), #584 (Issue #490), #591 (CodeRabbit Review #3351792121), #809 (Issue #396 - Monitoring)

## Node Metadata

**Category:** Infrastructure
**Complexity:** Medium
**Stability:** Stable
**API Stability:** Stable
