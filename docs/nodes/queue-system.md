# Queue System - Unified Redis/Database Queue Management

**Node ID:** `queue-system`
**Owner:** Back-end Dev
**Priority:** Critical
**Status:** Production
**Last Updated:** 2025-10-03

## Dependencies

- `multi-tenant` - Row Level Security (RLS) and organization isolation

## Overview

Queue System provides unified queue management for Roastr.ai with automatic Redis/Database fallback, priority queues, dead letter queue (DLQ) handling, and comprehensive monitoring. It supports high-performance Redis (Upstash) for production and PostgreSQL fallback for development/disaster recovery.

### Key Capabilities

1. **Dual-Mode Operation** - Redis (preferred) + PostgreSQL fallback
2. **Priority Queues** - 5-level priority system (1=critical to 5=low)
3. **Dead Letter Queue (DLQ)** - Failed job isolation and retry
4. **Multi-Tenant Isolation** - Organization-scoped job queues
5. **Queue Monitoring** - Real-time metrics and statistics
6. **Automatic Failover** - Seamless Redis → Database fallback

## Architecture

### Queue Types

| Queue | Priority | Use Case | Worker |
|-------|----------|----------|--------|
| **fetch_comments** | 4 (normal) | Fetch comments from platforms | FetchCommentsWorker |
| **analyze_toxicity** | 3 (medium) | Toxicity analysis | AnalyzeToxicityWorker |
| **generate_reply** | 3 (medium) | Roast generation | GenerateReplyWorker |
| **shield_action** | 1 (critical) | Shield moderation actions | ShieldActionWorker |
| **post_response** | 4 (normal) | Publish roasts to platforms | (planned) |

### Priority Levels

```javascript
priorityQueues = {
  1: 'critical',   // Shield critical actions (immediate)
  2: 'high',       // Shield high-priority (< 2s)
  3: 'medium',     // Toxicity analysis, roast gen (< 5s)
  4: 'normal',     // Standard processing (< 30s)
  5: 'low'         // Background tasks (< 5min)
}
```

### Redis Architecture (Preferred)

```
Redis Keys Structure:
├── roastr:jobs:{queue_name}:{priority}     # Priority queue (sorted set)
├── roastr:jobs:{queue_name}:processing     # In-progress jobs (hash)
├── roastr:dlq:{queue_name}                 # Dead letter queue (list)
├── roastr:metrics:{queue_name}             # Queue metrics (hash)
└── roastr:locks:{job_id}                   # Job processing locks (string)
```

**Data Structures:**
- **Sorted Sets** - Priority queues with score = priority + timestamp
- **Hashes** - Job details (payload, attempts, timestamps)
- **Lists** - DLQ for failed jobs
- **Strings** - Distributed locks (TTL-based)

### Database Fallback

**Table:** `job_queue`

```sql
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  priority INTEGER DEFAULT 4,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_job_queue_pending (organization_id, status, priority, scheduled_at)
    WHERE status = 'pending',
  INDEX idx_job_queue_processing (organization_id, status, started_at)
    WHERE status = 'processing'
);
```

## Core Methods

### Add Job to Queue

```javascript
async addJob(queueName, payload, options = {}) {
  const job = {
    id: uuid(),
    organizationId: payload.organization_id,
    jobType: queueName,
    priority: options.priority || 4,
    payload,
    maxAttempts: options.maxAttempts || 3,
    scheduledAt: options.delay ? new Date(Date.now() + options.delay) : new Date()
  };

  if (this.isRedisAvailable) {
    return await this.addJobToRedis(job);
  } else {
    return await this.addJobToDatabase(job);
  }
}
```

### Get Next Job (Priority-Based)

```javascript
async getNextJob(queueName, workerId) {
  // Try priority queues in order: 1 → 2 → 3 → 4 → 5
  for (let priority = 1; priority <= 5; priority++) {
    const job = this.isRedisAvailable
      ? await this.getJobFromRedis(queueName, priority)
      : await this.getJobFromDatabase(queueName, priority);

    if (job) {
      // Acquire distributed lock
      const locked = await this.acquireLock(job.id, workerId);
      if (locked) {
        job.workerId = workerId;
        job.startedAt = new Date();
        return job;
      }
    }
  }

  return null;  // No jobs available
}
```

### Complete Job

```javascript
async completeJob(jobId, result) {
  if (this.isRedisAvailable) {
    await this.redis.del(`roastr:jobs:processing:${jobId}`);
    await this.redis.del(`roastr:locks:${jobId}`);
    await this.incrementMetric(queueName, 'completed');
  } else {
    await this.supabase
      .from('job_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result
      })
      .eq('id', jobId);
  }
}
```

### Fail Job (DLQ)

```javascript
async failJob(jobId, error) {
  const job = await this.getJob(jobId);
  job.attempts++;

  if (job.attempts >= job.maxAttempts) {
    // Move to DLQ
    await this.moveToDLQ(job, error);
    await this.incrementMetric(job.jobType, 'failed');
  } else {
    // Retry with exponential backoff
    const delay = this.options.retryDelay * Math.pow(2, job.attempts - 1);
    job.scheduledAt = new Date(Date.now() + delay);
    await this.requeueJob(job);
  }
}
```

## Dead Letter Queue (DLQ)

### DLQ Structure

```javascript
{
  originalJob: { /* job payload */ },
  failureReason: 'OpenAI API timeout',
  failedAt: '2025-10-03T12:00:00Z',
  attempts: 3,
  lastError: {
    message: 'Request timeout after 30s',
    stack: '...',
    context: { /* additional context */ }
  },
  canRetry: false
}
```

### DLQ Operations

```javascript
// Get DLQ jobs for manual review
async getDLQJobs(queueName, limit = 100) {
  if (this.isRedisAvailable) {
    return await this.redis.lrange(`roastr:dlq:${queueName}`, 0, limit - 1);
  } else {
    return await this.supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'failed')
      .eq('job_type', queueName)
      .order('completed_at', { ascending: false })
      .limit(limit);
  }
}

// Retry DLQ job
async retryDLQJob(jobId) {
  const dlqJob = await this.getDLQJob(jobId);
  dlqJob.originalJob.attempts = 0;
  dlqJob.originalJob.status = 'pending';

  await this.addJob(dlqJob.originalJob.jobType, dlqJob.originalJob.payload);
  await this.removeDLQJob(jobId);
}

// Clear DLQ (admin only)
async clearDLQ(queueName) {
  if (this.isRedisAvailable) {
    await this.redis.del(`roastr:dlq:${queueName}`);
  } else {
    await this.supabase
      .from('job_queue')
      .delete()
      .eq('status', 'failed')
      .eq('job_type', queueName);
  }
}
```

## Queue Monitoring

### Metrics Tracked

```javascript
{
  queueName: 'analyze_toxicity',
  metrics: {
    total: 15420,           // Total jobs processed
    completed: 14892,       // Successfully completed
    failed: 328,            // Moved to DLQ
    retried: 200,           // Retried jobs
    pending: 45,            // Waiting in queue
    processing: 12,         // Currently processing
    avgProcessingTime: 2340 // ms
  },
  lastUpdated: '2025-10-03T12:00:00Z'
}
```

### Get Queue Statistics

```javascript
async getQueueStats(queueName) {
  if (this.isRedisAvailable) {
    const stats = await this.redis.hgetall(`roastr:metrics:${queueName}`);

    // Get queue sizes
    const pending = await this.redis.zcard(`roastr:jobs:${queueName}:*`);
    const processing = await this.redis.hlen(`roastr:jobs:${queueName}:processing`);
    const dlq = await this.redis.llen(`roastr:dlq:${queueName}`);

    return {
      ...stats,
      pending,
      processing,
      dlq,
      healthStatus: this.calculateHealthStatus(stats)
    };
  } else {
    // Database stats query
    const { data } = await this.supabase
      .from('job_queue')
      .select('status, count(*)')
      .eq('job_type', queueName)
      .group('status');

    return this.aggregateStats(data);
  }
}
```

### Health Status Calculation

```javascript
calculateHealthStatus(stats) {
  const failureRate = stats.failed / stats.total;
  const dlqSize = stats.dlq || 0;
  const avgProcessingTime = stats.avgProcessingTime || 0;

  if (failureRate > 0.1 || dlqSize > 100 || avgProcessingTime > 30000) {
    return 'critical';
  } else if (failureRate > 0.05 || dlqSize > 50 || avgProcessingTime > 10000) {
    return 'warning';
  } else {
    return 'healthy';
  }
}
```

## Distributed Locks

### Lock Acquisition

```javascript
async acquireLock(jobId, workerId, ttl = 300000) {
  const lockKey = `roastr:locks:${jobId}`;

  if (this.isRedisAvailable) {
    // Redis SET with NX (only if not exists) and EX (expiry)
    const acquired = await this.redis.set(
      lockKey,
      workerId,
      'PX', ttl,  // milliseconds
      'NX'        // only if not exists
    );

    return acquired === 'OK';
  } else {
    // Database-based lock using advisory locks
    const { data } = await this.supabase
      .rpc('acquire_job_lock', {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_ttl_seconds: Math.floor(ttl / 1000)
      });

    return data?.locked === true;
  }
}

async releaseLock(jobId, workerId) {
  const lockKey = `roastr:locks:${jobId}`;

  if (this.isRedisAvailable) {
    // Only release if we own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    return await this.redis.eval(script, 1, lockKey, workerId);
  } else {
    await this.supabase.rpc('release_job_lock', {
      p_job_id: jobId,
      p_worker_id: workerId
    });
  }
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
REDIS_URL=redis://localhost:6379  # Fallback

# Queue Settings
QUEUE_PREFER_REDIS=true
QUEUE_DLQ_ENABLED=true
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=5000  # ms
QUEUE_LOCK_TTL=300000   # 5 minutes

# Worker Settings
WORKER_CONCURRENCY=5
WORKER_POLL_INTERVAL=1000  # ms
```

## Testing

### Unit Tests

```javascript
describe('QueueService', () => {
  test('adds job to Redis queue with priority', async () => {
    const job = await queueService.addJob('analyze_toxicity', {
      organization_id: 'org_123',
      comment_id: 'comment_456'
    }, { priority: 2 });

    expect(job.priority).toBe(2);
    expect(job.status).toBe('pending');
  });

  test('fails over to database when Redis unavailable', async () => {
    queueService.isRedisAvailable = false;

    const job = await queueService.addJob('generate_reply', payload);

    const { data } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', job.id)
      .single();

    expect(data).toBeDefined();
    expect(data.status).toBe('pending');
  });

  test('moves job to DLQ after max retries', async () => {
    const job = { id: 'job_123', attempts: 3, maxAttempts: 3 };

    await queueService.failJob(job.id, new Error('Permanent failure'));

    const dlqJobs = await queueService.getDLQJobs('analyze_toxicity');
    expect(dlqJobs).toContainEqual(expect.objectContaining({ id: 'job_123' }));
  });
});
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|-----------|
| `Redis connection failed` | Network issue or wrong credentials | Automatic fallback to database |
| `Database connection failed` | Supabase outage | Fail fast, alert ops team |
| `Job lock acquisition failed` | Another worker processing | Skip job, try next |
| `DLQ full` | Too many failures | Alert, manual intervention |
| `Payload too large` | Job payload > 1MB | Reject job, log error |

## Monitoring & Alerting

### Key Metrics

- **Queue depth** - Jobs waiting (alert if > 1000)
- **Processing time** - Average job duration (alert if > 30s)
- **Failure rate** - % failed jobs (alert if > 10%)
- **DLQ size** - Failed jobs count (alert if > 100)
- **Lock contention** - Failed lock acquisitions (alert if > 5%)

### Grafana Dashboard

```javascript
// Prometheus metrics export
{
  queue_depth: { type: 'gauge', value: 245 },
  queue_processing_time_avg: { type: 'histogram', value: 2340 },
  queue_failure_rate: { type: 'gauge', value: 0.021 },
  queue_dlq_size: { type: 'gauge', value: 15 },
  redis_available: { type: 'gauge', value: 1 }
}
```

## Related Nodes

- **multi-tenant** - Organization isolation for job queues
- **shield** - High-priority shield_action queue
- **roast** - generate_reply queue for roast generation
- **cost-control** - Usage tracking per job execution

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Monthly or on queue infrastructure changes
**Last Reviewed:** 2025-10-03
**Version:** 1.0.0
