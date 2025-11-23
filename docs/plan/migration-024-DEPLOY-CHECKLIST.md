# Migration 024 Deployment Checklist - EXECUTABLE

**Migration:** `database/migrations/024_atomic_user_behavior_updates.sql`
**Issue:** #653 (Shield Phase 2)
**Blocking:** PR #654 merge
**Created:** 2025-10-24
**Status:** 🔴 **PENDING STAGING DEPLOYMENT**

---

## 🚨 CRITICAL ALERT

**PR #654 CANNOT be merged until Migration 024 is deployed to production.**

**Reason:** Phase 2 code (M3: Atomic Updates) calls `atomic_update_user_behavior()` RPC function. If merged without the migration, the Shield system will FAIL in production.

**Risk Level:** P0 - PRODUCTION BLOCKER

---

## Phase 1: Staging Deployment (Day 1)

### Pre-Flight Checks

- [ ] **Backup Created**

  ```bash
  pg_dump -h <staging-host> -U <user> -d <database> \
    --table=user_behaviors \
    --file=user_behaviors_backup_$(date +%Y%m%d_%H%M%S).sql

  # Verify backup size
  ls -lh user_behaviors_backup_*.sql
  ```

- [ ] **Environment Variables Configured**
  - [ ] 🔐 Requires environment variables configured (see configuration documentation)
  - [ ] Database credentials valid

- [ ] **DevOps Team Notified**
  - [ ] Slack notification sent to #engineering-alerts
  - [ ] Expected downtime communicated: ~0 minutes (zero downtime)
  - [ ] Rollback plan shared

### Deployment Execution

- [ ] **Deploy Migration Script**

  ```bash
  psql -h <staging-host> -U <user> -d <database> \
    -f database/migrations/024_atomic_user_behavior_updates.sql

  # Expected output:
  # CREATE FUNCTION
  # COMMENT
  # GRANT
  # GRANT
  ```

- [ ] **Verify Function Exists**

  ```sql
  SELECT
    proname AS function_name,
    pronargs AS num_args,
    prorettype::regtype AS return_type
  FROM pg_proc
  WHERE proname = 'atomic_update_user_behavior';

  -- Expected: 1 row (atomic_update_user_behavior, 5, jsonb)
  ```

- [ ] **Verify Permissions**

  ```sql
  SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
  WHERE routine_name = 'atomic_update_user_behavior';

  -- Expected: authenticated (EXECUTE), service_role (EXECUTE)
  ```

- [ ] **Manual RPC Test**

  ```sql
  SELECT atomic_update_user_behavior(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'twitter',
    'test_migration_024',
    'testuser_migration',
    '{"severity": "medium", "toxicity_score": 0.75, "comment_id": "test_comment", "action_tags": ["warning"]}'::jsonb
  );

  -- Expected: Returns JSONB with user_id, total_violations, severity_counts, last_violation_at
  ```

### Post-Deployment Validation

- [ ] **Run Concurrent Actions Test**

  ```bash
  cd /Users/emiliopostigo/roastr-ai
  node scripts/test-concurrent-shield-actions.js \
    --user-id=test_concurrent_staging \
    --actions=5 \
    --platform=twitter

  # Expected: Exit 0 (all 5 actions applied, no race conditions)
  ```

- [ ] **Verify Count Accuracy**

  ```bash
  node scripts/verify-user-behavior-count.js \
    --user-id=test_concurrent_staging \
    --expected-count=5

  # Expected: Exit 0 (count matches)
  ```

- [ ] **Check Database Logs**
  - [ ] No deadlocks detected
  - [ ] No error messages related to atomic_update_user_behavior
  - [ ] RPC function calls completing <15ms

- [ ] **Run Shield E2E Tests**

  ```bash
  npm test -- tests/integration/shield-system-e2e.test.js

  # Expected: 12/12 tests passing
  ```

---

## Phase 2: 24-Hour Monitoring (Days 1-2)

### Metrics to Monitor

- [ ] **Hour 1: Active Monitoring**
  - [ ] RPC function call count
  - [ ] Average execution time (<15ms target)
  - [ ] Error rate (<0.1% target)
  - [ ] No deadlocks or lock contention

- [ ] **Hours 2-4: Regular Checks** (every 2 hours)
  - [ ] Shield action success rate (should maintain baseline)
  - [ ] Database CPU/memory usage (should remain stable)
  - [ ] No increase in user_behavior update errors

- [ ] **Hours 5-24: Passive Monitoring**
  - [ ] Automated alerts configured
  - [ ] On-call engineer assigned
  - [ ] No critical alerts triggered

### Performance Benchmarking

- [ ] **Capture Baseline Metrics** (before Migration 024)
  - Avg Shield action latency: **\_\_\_**ms
  - Avg DB calls per action: **\_\_\_**
  - Race condition events (last 24h): **\_\_\_**

- [ ] **Measure Post-Migration Metrics** (after 24 hours)
  - Avg Shield action latency: **\_\_\_**ms (target: <50ms)
  - Avg DB calls per action: **\_\_\_** (target: ≤2)
  - Race condition events: **\_\_\_** (target: 0)

### Rollback Criteria

**Rollback IMMEDIATELY if any of these occur:**

- [ ] RPC function error rate >1% in first hour
- [ ] Any deadlocks detected
- [ ] Shield action failures increase >10% vs baseline
- [ ] Database performance degradation >20%
- [ ] Production incident related to user_behavior updates

**Rollback Procedure:**

1. Drop RPC function: `DROP FUNCTION IF EXISTS atomic_update_user_behavior(...);`
2. Verify removal: `SELECT proname FROM pg_proc WHERE proname = 'atomic_update_user_behavior';`
3. Restore backup if data corrupted
4. Notify stakeholders
5. Create incident report

---

## Phase 3: Product Owner Approval (Day 2 End)

### Approval Requirements

- [ ] **All staging validation tests passed**
- [ ] **24-hour monitoring complete with no issues**
- [ ] **Performance improvements confirmed** (~40% latency reduction)
- [ ] **Zero race conditions detected**
- [ ] **Rollback plan tested (dry-run)**

### Sign-Off

**Product Owner:** **********\_\_\_**********
**Date:** **********\_\_\_**********
**Approval Decision:**

- [ ] APPROVED - Proceed to production
- [ ] CONDITIONAL - Address: **********\_\_\_**********
- [ ] REJECTED - Reason: **********\_\_\_**********

---

## Phase 4: Production Deployment (Day 3+)

### Pre-Deployment Final Checks

- [ ] **Product Owner approval obtained** (see Phase 3)
- [ ] **Maintenance window scheduled** (low-traffic period preferred)
- [ ] **DevOps team on standby**
- [ ] **Communication sent to stakeholders**
  - [ ] Email to engineering team
  - [ ] Slack notification to #engineering-alerts
  - [ ] Status page update (if applicable)

### Production Backup

- [ ] **Create Production Backup**

  ```bash
  pg_dump -h <production-host> -U <user> -d <database> \
    --table=user_behaviors \
    --file=user_behaviors_production_backup_$(date +%Y%m%d_%H%M%S).sql

  # Verify backup
  ls -lh user_behaviors_production_backup_*.sql

  # Store in secure location
  # IMPORTANT: Keep backup for at least 30 days
  ```

### Production Deployment Execution

- [ ] **Deploy Migration to Production**

  ```bash
  psql -h <production-host> -U <user> -d <database> \
    -f database/migrations/024_atomic_user_behavior_updates.sql
  ```

- [ ] **Verify Function in Production**

  ```sql
  SELECT proname, pronargs, prorettype::regtype
  FROM pg_proc
  WHERE proname = 'atomic_update_user_behavior';
  ```

- [ ] **Verify Permissions in Production**

  ```sql
  SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
  WHERE routine_name = 'atomic_update_user_behavior';
  ```

- [ ] **Manual Test in Production** (using test organization)
  ```sql
  SELECT atomic_update_user_behavior(
    '<test-org-uuid>'::uuid,
    'twitter',
    'test_production_validation',
    'testuser_prod',
    '{"severity": "low", "toxicity_score": 0.6, "comment_id": "prod_test", "action_tags": ["warning"]}'::jsonb
  );
  ```

### Post-Production Validation

- [ ] **Run Smoke Tests** (first 10 minutes)
  - [ ] Process 10 real Shield actions
  - [ ] Verify all succeed
  - [ ] Check database logs for errors

- [ ] **Active Monitoring** (first hour)
  - [ ] RPC function metrics nominal
  - [ ] No increase in error rates
  - [ ] Performance improvements visible
  - [ ] No user complaints

- [ ] **Extended Monitoring** (first 24 hours)
  - [ ] Shield system operating normally
  - [ ] No regressions detected
  - [ ] Performance metrics at target levels
  - [ ] Zero race conditions observed

---

## Phase 5: Merge PR #654 (After Production Deployment)

### Final Pre-Merge Checks

- [ ] **Migration 024 deployed to production** ✅
- [ ] **RPC function operational in production** ✅
- [ ] **No production incidents in last 24 hours** ✅
- [ ] **Performance metrics meeting targets** ✅

### Merge Execution

- [ ] **Verify PR #654 Status**

  ```bash
  gh pr view 654 --json mergeable,mergeStateStatus,statusCheckRollup

  # Expected:
  # "mergeable": "MERGEABLE"
  # "mergeStateStatus": "CLEAN"
  # All CI checks passing
  ```

- [ ] **Final Code Review**
  - [ ] All CodeRabbit comments resolved (0 pending)
  - [ ] All CI checks passing (26/26)
  - [ ] Integration tests: 12/12 passing
  - [ ] Guardian scan: SUCCESS

- [ ] **Merge PR #654**

  ```bash
  gh pr merge 654 --squash --delete-branch

  # OR via GitHub UI with squash merge
  ```

- [ ] **Monitor Post-Merge** (first hour after merge)
  - [ ] Deployment to production triggered
  - [ ] Phase 2 code deployed successfully
  - [ ] Shield system operating with M1+M2+M3 improvements
  - [ ] Performance improvements confirmed (~40% latency reduction)

---

## Success Criteria

### Technical Metrics

- [ ] **RPC Function**
  - Avg execution time <15ms ✅/❌
  - Error rate <0.5% ✅/❌
  - Zero deadlocks ✅/❌

- [ ] **Shield Performance**
  - Avg latency reduced to ~45ms (from ~75ms) ✅/❌
  - DB calls reduced by 66% ✅/❌
  - Race conditions eliminated ✅/❌

- [ ] **System Stability**
  - Zero downtime deployment ✅/❌
  - No user-facing incidents ✅/❌
  - No data integrity issues ✅/❌

### Business Metrics

- [ ] **User Impact**
  - Zero support tickets related to deployment ✅/❌
  - No performance degradation reported ✅/❌
  - Shield system operating transparently ✅/❌

---

## Rollback Decision Tree

```
Deployment Issue Detected
    ↓
Is it RPC-related?
    ├─ YES → Drop RPC function immediately
    │        Notify team
    │        Create incident report
    │
    └─ NO → Is it data corruption?
           ├─ YES → Restore backup
           │        Drop RPC function
           │        Full incident protocol
           │
           └─ NO → Monitor closely
                   Assess severity
                   Decide based on impact
```

---

## Contacts & Escalation

**Primary Contact:**

- Name: [Product Owner Name]
- Role: Product Owner
- Slack: @[username]
- Email: [email]

**On-Call Engineer:**

- Name: [Engineer Name]
- Slack: @[username]
- Phone: [number]

**Escalation Path:**

1. On-Call Engineer (immediate issues)
2. Product Owner (approval/decisions)
3. CTO (critical incidents)

---

## Documentation Links

- **Migration Script:** `database/migrations/024_atomic_user_behavior_updates.sql`
- **Deployment Plan:** `docs/plan/migration-024-deployment.md`
- **Test Scripts:**
  - `scripts/test-concurrent-shield-actions.js`
  - `scripts/verify-user-behavior-count.js`
- **Test Results:** `docs/test-evidence/issue-653/PHASE2-TEST-RESULTS.md`
- **PR #654:** https://github.com/[org]/roastr-ai/pull/654
- **Issue #653:** https://github.com/[org]/roastr-ai/issues/653

---

## Completion Status

**Last Updated:** 2025-10-24
**Current Phase:** 🔴 Phase 1 (Staging Deployment) - NOT STARTED
**Overall Progress:** 0% (0/5 phases complete)

**Phase Statuses:**

- Phase 1: 🔴 NOT STARTED
- Phase 2: 🔴 NOT STARTED
- Phase 3: 🔴 NOT STARTED
- Phase 4: 🔴 NOT STARTED
- Phase 5: 🔴 NOT STARTED

---

**END OF EXECUTABLE CHECKLIST**
