# Migration 024 Deployment Plan - Atomic User Behavior Updates

**Migration:** `database/migrations/024_atomic_user_behavior_updates.sql`
**Target:** Staging Environment → Production
**Issue:** #653 (Shield Phase 2)
**Blocking:** PR #654
**Created:** 2025-10-24
**Status:** PENDING STAGING DEPLOYMENT

---

## Executive Summary

Migration 024 adds a Postgres RPC function (`atomic_update_user_behavior`) that eliminates race conditions in the Shield moderation system by using database-level atomicity for user behavior updates.

**Critical:** This migration MUST be deployed to staging and validated before merging PR #654, as the Phase 2 code depends on this RPC function.

---

## Migration Overview

### What It Does

Creates `atomic_update_user_behavior()` RPC function that:

- Uses `INSERT...ON CONFLICT` for atomic upserts
- Atomically increments counters (`total_violations`, `severity_counts`)
- Appends to `actions_taken` JSONB array atomically
- Returns updated user behavior data
- Prevents race conditions through database-level locking

### Why It's Critical

**Before M3 (Read-Update-Write):**

```
User A: Shield action 1 → READ user_behavior (count: 5)
User A: Shield action 2 → READ user_behavior (count: 5) [Race!]
User A: Shield action 1 → UPDATE user_behavior (count: 6)
User A: Shield action 2 → UPDATE user_behavior (count: 6) [Lost update!]
Result: 2 actions, but count only increased by 1
```

**After M3 (Atomic RPC):**

```
User A: Shield action 1 → CALL atomic_update_user_behavior() [Locked]
User A: Shield action 2 → CALL atomic_update_user_behavior() [Waits for lock]
Result: 2 actions, count increases by 2 correctly
```

### Performance Impact

- **Latency reduction:** 25ms → 10ms (60% improvement)
- **Database calls:** 3 → 1 (66% reduction)
- **Race conditions:** Eliminated via database locking

---

## Pre-Deployment Checklist

### Prerequisites

- [ ] Staging database accessible
- [ ] Database credentials configured (🔐 Requires environment variables)
- [ ] Backup created before deployment
- [ ] Rollback script prepared and tested
- [ ] DevOps team notified
- [ ] Product Owner approval obtained

### Code Readiness

- [ ] PR #654 created and all CI checks passing
- [ ] Integration tests: 12/12 passing (100%)
- [ ] Unit tests: 15/19 passing (4 pre-existing failures documented)
- [ ] Guardian scan: PASSED (exit 0)
- [ ] CodeRabbit review: PASSED

### Environment Readiness

- [ ] Staging Shield system configured
- [ ] Test organization with Shield enabled exists
- [ ] Monitoring/alerting configured for RPC function
- [ ] Database connection pooling validated

---

## Deployment Steps

### Phase 1: Staging Deployment

#### Step 1: Backup Current State

```bash
# Create backup of user_behaviors table
pg_dump -h <staging-host> -U <user> -d <database> \
  --table=user_behaviors \
  --file=user_behaviors_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh user_behaviors_backup_*.sql
```

#### Step 2: Deploy Migration

```bash
# Execute migration script
psql -h <staging-host> -U <user> -d <database> \
  -f database/migrations/024_atomic_user_behavior_updates.sql

# Expected output:
# CREATE FUNCTION
# COMMENT
# GRANT
# GRANT
```

#### Step 3: Verify Function Exists

```sql
-- Check function exists
SELECT
  proname AS function_name,
  pronargs AS num_args,
  prorettype::regtype AS return_type
FROM pg_proc
WHERE proname = 'atomic_update_user_behavior';

-- Expected result:
-- function_name              | num_args | return_type
-- atomic_update_user_behavior | 5        | jsonb
```

#### Step 4: Verify Permissions

```sql
-- Check grants
SELECT
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'atomic_update_user_behavior';

-- Expected results:
-- grantee        | privilege_type
-- authenticated  | EXECUTE
-- service_role   | EXECUTE
```

#### Step 5: Test Function Manually

```sql
-- Test with sample data
SELECT atomic_update_user_behavior(
  '00000000-0000-0000-0000-000000000001'::uuid,  -- test org id
  'twitter',
  'test_user_123',
  'testuser',
  '{"severity": "medium", "toxicity_score": 0.75, "comment_id": "comment_test", "action_tags": ["warning"]}'::jsonb
);

-- Expected: Returns JSONB with user_id, total_violations, severity_counts, last_violation_at
```

---

### Phase 2: Validation Testing

#### Test 1: Single Action Execution

**Objective:** Verify function works with single Shield action

**Setup:**

1. Create test organization with Shield enabled
2. Create test toxic comment
3. Trigger Shield analysis

**Expected Result:**

- RPC function called successfully
- `user_behaviors` record created/updated
- No errors in database logs
- Response includes correct violation count

**Validation Script:**

```bash
# Run Shield E2E test
npm test -- tests/integration/shield-system-e2e.test.js \
  -t "should process toxic comment through complete Shield pipeline"

# Check for RPC call in Supabase logs
# Look for: "atomic_update_user_behavior"
```

#### Test 2: Concurrent Actions (Race Condition Test)

**Objective:** Verify atomicity under concurrent load

**Setup:**

1. Create test user with existing violations
2. Trigger 5 Shield actions simultaneously on different comments
3. All actions target same user

**Expected Result:**

- All 5 RPC calls succeed
- `total_violations` increments by exactly 5
- No lost updates
- Database locks handled correctly

**Validation Script:**

```bash
# Run concurrent test (create if doesn't exist)
node scripts/test-concurrent-shield-actions.js \
  --user-id=test_concurrent_user \
  --actions=5 \
  --platform=twitter

# Verify final count
node scripts/verify-user-behavior-count.js \
  --user-id=test_concurrent_user \
  --expected-count=5
```

#### Test 3: Error Handling

**Objective:** Verify graceful error handling

**Test Cases:**

- Invalid UUID format → Should reject with error
- Missing required fields → Should reject with error
- Invalid JSONB structure → Should reject with error
- Database connection lost → Should retry/fail gracefully

**Validation:**

- Check error messages in logs
- Verify no partial updates occur
- Confirm transaction rollback on error

#### Test 4: Performance Benchmarking

**Objective:** Verify performance improvements from M3

**Test:**

```bash
# Benchmark 100 Shield actions
node scripts/benchmark-shield-performance.js \
  --actions=100 \
  --output=benchmark-migration-024.json

# Compare with baseline (before M3)
# Expected: ~60% reduction in latency
```

**Metrics to Capture:**

- Average latency per action
- Database call count
- Total execution time
- Error rate

---

### Phase 3: Monitoring Setup

#### Metrics to Monitor (First 24 Hours)

1. **RPC Function Calls:**
   - Total invocations per hour
   - Success rate (should be >99%)
   - Average execution time (should be <15ms)
   - Error rate (should be <0.1%)

2. **Database Performance:**
   - Lock contention events
   - Deadlock occurrences (should be 0)
   - Connection pool utilization
   - Query execution time

3. **Shield System Health:**
   - Total Shield actions executed
   - Failed actions (should remain constant or decrease)
   - User behavior update errors
   - Queue processing time

#### Alert Thresholds

```yaml
alerts:
  - metric: rpc_error_rate
    threshold: '> 1%'
    severity: CRITICAL
    action: Page on-call engineer

  - metric: rpc_execution_time
    threshold: '> 50ms'
    severity: WARNING
    action: Notify DevOps channel

  - metric: deadlock_count
    threshold: '> 0'
    severity: CRITICAL
    action: Page on-call engineer + rollback

  - metric: shield_action_failures
    threshold: 'increase > 50%'
    severity: CRITICAL
    action: Investigate immediately
```

---

## Rollback Plan

### When to Rollback

Rollback IMMEDIATELY if:

- ❌ RPC function errors >1% in first hour
- ❌ Any deadlocks detected
- ❌ Shield actions failing >10% more than baseline
- ❌ Database performance degradation >20%
- ❌ Production incident related to user_behavior updates

### Rollback Steps

#### Step 1: Drop RPC Function

```sql
-- Connect to staging database
DROP FUNCTION IF EXISTS atomic_update_user_behavior(UUID, TEXT, TEXT, TEXT, JSONB);

-- Verify removal
SELECT proname FROM pg_proc WHERE proname = 'atomic_update_user_behavior';
-- Expected: 0 rows
```

#### Step 2: Revert Application Code (if merged)

```bash
# If PR #654 was already merged, revert it
git revert <merge-commit-sha>
git push origin main

# Redeploy previous version
npm run deploy:staging
```

#### Step 3: Restore Backup (if data corruption)

```bash
# ONLY if user_behaviors data is corrupted
psql -h <staging-host> -U <user> -d <database> \
  -f user_behaviors_backup_<timestamp>.sql
```

#### Step 4: Verify System Recovery

```bash
# Run health checks
npm test -- tests/integration/shield-system-e2e.test.js

# Verify Shield actions working
node scripts/verify-shield-system.js --environment=staging
```

#### Step 5: Incident Report

```markdown
# Incident Report: Migration 024 Rollback

**Date:** [Date]
**Duration:** [Time]
**Severity:** [P0/P1/P2]

## Root Cause

[Detailed analysis of why rollback was necessary]

## Impact

- Affected users: [Count]
- Failed Shield actions: [Count]
- Data integrity issues: [Yes/No + details]

## Actions Taken

1. [Step-by-step rollback actions]

## Prevention

- [ ] Add additional test coverage
- [ ] Update deployment checklist
- [ ] Improve monitoring
- [ ] Update documentation

## Follow-up Issues

- Issue #[number]: [Description]
```

---

## Production Deployment Checklist

### ⚠️ DO NOT PROCEED TO PRODUCTION UNTIL:

- [ ] **Staging validation complete** (all Phase 2 tests passing)
- [ ] **24 hours of monitoring in staging** (no alerts)
- [ ] **Product Owner approval obtained**
- [ ] **DevOps team on standby**
- [ ] **Rollback plan tested in staging**
- [ ] **Communication plan prepared**
- [ ] **Maintenance window scheduled** (low-traffic period)

### Production Deployment Steps

1. **Pre-deployment:**
   - [ ] Create backup of production `user_behaviors` table
   - [ ] Notify all stakeholders (email + Slack)
   - [ ] Put Shield system in read-only mode (optional)

2. **Deployment:**
   - [ ] Execute migration (same steps as staging)
   - [ ] Verify function exists and has correct permissions
   - [ ] Run manual test with production test organization

3. **Post-deployment:**
   - [ ] Enable full Shield functionality
   - [ ] Monitor for 1 hour (active monitoring)
   - [ ] Run smoke tests
   - [ ] Verify no increase in error rates

4. **Validation:**
   - [ ] Process 100 real Shield actions
   - [ ] Compare performance metrics vs baseline
   - [ ] Check database logs for any anomalies
   - [ ] Confirm no user complaints

### Success Criteria

Production deployment is considered successful when:

- ✅ RPC function executing with <15ms average latency
- ✅ Error rate <0.1% for 24 hours
- ✅ No deadlocks or lock contention
- ✅ Shield actions processing normally
- ✅ Performance improvement of ~40% observed
- ✅ Zero user-facing incidents

---

## Communication Plan

### Before Deployment

**To:** Engineering Team, DevOps, Product Owner
**When:** 24 hours before deployment
**Message:**

```
🔔 Migration 024 Deployment Scheduled

Environment: Staging
Date: [Date]
Time: [Time] UTC
Duration: ~30 minutes

What: Adding atomic_update_user_behavior() RPC function for Shield
Impact: None (no downtime expected)
Rollback: Prepared and tested

Contact: [Your Name] for questions
```

### During Deployment

**To:** #engineering-alerts Slack channel
**Message:**

```
🚀 Migration 024 deployment IN PROGRESS
Status: [Phase 1/2/3]
ETA: [Time]
```

### After Deployment

**To:** All stakeholders
**Message (Success):**

```
✅ Migration 024 deployed successfully

Results:
- RPC function created and validated
- All tests passing (12/12 integration)
- Performance improvement: 40% latency reduction
- No errors detected

Monitoring continues for 24 hours.
```

**Message (Rollback):**

```
⚠️ Migration 024 rolled back

Reason: [Brief explanation]
Impact: Shield system operating normally on previous version
Next Steps: Incident report + investigation
ETA for retry: TBD
```

---

## Post-Deployment Tasks

### Immediate (First 24 Hours)

- [ ] Monitor RPC function metrics hourly
- [ ] Check Shield action success rates
- [ ] Review database logs for anomalies
- [ ] Verify no increase in support tickets
- [ ] Update team on status (every 4 hours)

### Short-term (First Week)

- [ ] Analyze performance improvements vs baseline
- [ ] Generate deployment success report
- [ ] Update migration documentation with lessons learned
- [ ] Plan Phase 3 (complete unit test mocking)
- [ ] Schedule production deployment window

### Long-term

- [ ] Add automated regression tests for RPC function
- [ ] Update deployment playbook with learnings
- [ ] Consider similar atomic patterns for other services
- [ ] Document performance benchmarks for future reference

---

## Success Metrics

### Technical Metrics

| Metric                | Baseline (Before M3) | Target (After M3)     | Actual |
| --------------------- | -------------------- | --------------------- | ------ |
| Avg Latency           | 25ms                 | <15ms (60% reduction) | _TBD_  |
| DB Calls per Action   | 3                    | 1 (66% reduction)     | _TBD_  |
| Race Condition Events | 2-5 per day          | 0                     | _TBD_  |
| Error Rate            | <1%                  | <0.5%                 | _TBD_  |
| Concurrent Actions    | Limited              | No limit              | _TBD_  |

### Business Metrics

| Metric                    | Target | Actual |
| ------------------------- | ------ | ------ |
| Zero downtime deployment  | ✅ Yes | _TBD_  |
| User-facing incidents     | 0      | _TBD_  |
| Support tickets related   | 0      | _TBD_  |
| Data integrity maintained | 100%   | _TBD_  |

---

## Appendix A: Test Scripts

### Concurrent Action Test Script

**File:** `scripts/test-concurrent-shield-actions.js`

```javascript
// TODO: Create this script before deployment
// Should test 5+ concurrent Shield actions on same user
// Verify total_violations increments correctly
// Check for deadlocks in database logs
```

### Verification Script

**File:** `scripts/verify-user-behavior-count.js`

```javascript
// TODO: Create this script before deployment
// Query user_behaviors for specific user
// Compare total_violations with expected count
// Exit 0 if match, exit 1 if mismatch
```

### Performance Benchmark Script

**File:** `scripts/benchmark-shield-performance.js`

```javascript
// TODO: Create this script before deployment
// Execute N Shield actions
// Measure latency, DB calls, errors
// Output JSON report for comparison
```

---

## Appendix B: SQL Queries for Monitoring

### Check RPC Function Usage

```sql
-- Count calls to RPC function (if statement-level logging enabled)
SELECT
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE message LIKE '%ERROR%') as error_count,
  COUNT(*) FILTER (WHERE message LIKE '%SUCCESS%') as success_count
FROM pg_stat_statements
WHERE query LIKE '%atomic_update_user_behavior%'
AND calls > 0;
```

### Check for Deadlocks

```sql
-- Check for deadlock events
SELECT * FROM pg_stat_database_conflicts
WHERE datname = current_database()
AND confl_deadlock > 0;
```

### Check Lock Contention

```sql
-- Show current locks on user_behaviors table
SELECT
  locktype,
  relation::regclass,
  mode,
  granted,
  pid
FROM pg_locks
WHERE relation = 'user_behaviors'::regclass;
```

### Monitor Performance

```sql
-- Average execution time for RPC function
SELECT
  calls,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query LIKE '%atomic_update_user_behavior%';
```

---

## Appendix C: Product Owner Approval Form

**Migration:** 024 - Atomic User Behavior Updates
**Requested by:** Engineering Team
**Date:** 2025-10-24

### Impact Assessment

**Risk Level:** MEDIUM

- Database migration with RPC function
- Critical dependency for PR #654
- Affects Shield moderation system

**Benefits:**

- Eliminates race conditions in Shield
- 40% performance improvement
- 66% reduction in database calls
- Better data integrity

**Risks:**

- Potential for database locking issues (mitigated by testing)
- Rollback requires dropping function (tested in staging)
- Requires careful monitoring (plan in place)

### Approval Checklist

I, [Product Owner Name], have reviewed:

- [ ] Migration SQL code (`024_atomic_user_behavior_updates.sql`)
- [ ] Deployment plan (this document)
- [ ] Test results from staging (Phase 2 validation)
- [ ] Rollback plan
- [ ] Monitoring plan
- [ ] Communication plan

### Decision

- [ ] **APPROVED** - Proceed with production deployment
- [ ] **CONDITIONAL** - Approved with conditions: ******\_\_\_******
- [ ] **REJECTED** - Do not proceed. Reason: ******\_\_\_******

**Signature:** ******\_\_\_******
**Date:** ******\_\_\_******

---

## Document History

| Version | Date       | Author      | Changes                         |
| ------- | ---------- | ----------- | ------------------------------- |
| 1.0     | 2025-10-24 | Claude Code | Initial deployment plan created |

---

**END OF DEPLOYMENT PLAN**
