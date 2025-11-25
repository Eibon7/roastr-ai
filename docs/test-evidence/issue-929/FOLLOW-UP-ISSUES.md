# Follow-Up Issues for Issue #929

**Parent Issue:** #929 - [Coverage] Fase 3.1: Tests para Services de Negocio Críticos  
**Status:** Partial Completion (70% AC) - PR #968  
**Created:** 2025-11-23

---

## Issue #XXX: shieldService Integration Tests (62.5% → 75%+)

**Type:** 🧪 Test Coverage - Integration Tests  
**Priority:** 🔴 HIGH  
**Estimated Effort:** 2-3 days

### Context

PR #968 achieved **62.5% coverage** for `shieldService.js` through comprehensive unit tests. The remaining **12.5% gap to reach 75%+** requires integration tests that validate complex multi-step workflows and external platform interactions.

### Goal

Add integration tests to increase `shieldService.js` coverage from **62.5% to 75%+**.

### Scope

**Integration Tests Needed:**

1. **Multi-Step Escalation Policies**
   - Test full escalation workflow: warn → mute_temp → mute_permanent → block
   - Validate recidivism tracking across multiple violations
   - Test time-window modifiers (aggressive, standard, reduced, minimal)
   - Verify action persistence in database

2. **Platform API Interactions**
   - Twitter: Block user, hide tweet, mute user
   - YouTube: Hide comment, block channel
   - Instagram: Hide comment, report user
   - Discord: Timeout user, delete message
   - Mock platform APIs (no real API calls in tests)

3. **Circuit Breaker Recovery**
   - Test circuit breaker activation after N failures
   - Validate circuit breaker reset after cooldown
   - Verify half-open state behavior
   - Test circuit breaker metrics

4. **End-to-End Shield Workflows**
   - Full flow: Comment → Analysis → Action → User Behavior Update → Logging
   - Multiple users, multiple platforms
   - Concurrent violations from same user
   - Red line violations (immediate ban)

### Prerequisites

- **Integration Test Infrastructure:**
  - Test organization accounts (Twitter, YouTube, Instagram, Discord)
  - Mock platform API servers (or use nock/msw)
  - Database seeding utilities
  - Test data cleanup utilities

- **Test Utilities:**
  - `tests/helpers/shieldTestHelpers.js` (seed data, mock platforms)
  - `tests/integration/services/shieldService.integration.test.js`

### Acceptance Criteria

- [ ] `shieldService.js` coverage ≥75%
- [ ] Integration tests cover multi-step escalation
- [ ] Integration tests cover platform API interactions
- [ ] Integration tests cover circuit breaker
- [ ] Integration tests cover end-to-end workflows
- [ ] All tests pass (100%)
- [ ] Tests use mocks (no real API calls)
- [ ] Tests clean up after themselves (database, Redis)

### Files to Create/Modify

- 🆕 `tests/integration/services/shieldService.integration.test.js`
- 🆕 `tests/helpers/shieldTestHelpers.js`
- ✅ Update `docs/nodes/shield.md` (coverage to 75%+)

### References

- **Current Tests:** `tests/unit/services/shieldService.test.js` (68 tests)
- **Service Code:** `src/services/shieldService.js`
- **GDD Node:** `docs/nodes/shield.md`
- **Parent Issue:** #929

---

## Issue #YYY: authService + costControl Integration Tests (50.75%/28.86% → 85%+)

**Type:** 🧪 Test Coverage - Integration Tests  
**Priority:** 🟡 MEDIUM  
**Estimated Effort:** 3-4 days

### Context

PR #968 achieved:
- **authService.js:** 50.75% coverage (gap: -34.25% to 85%)
- **costControl.js:** 28.86% coverage (gap: -56.14% to 85%)

Both services require integration tests for complex workflows involving external services (Supabase Auth, Stripe).

### Goal

Add integration tests to increase coverage to **85%+** for both services.

### Scope - authService.js

**Integration Tests Needed:**

1. **OAuth Flows**
   - Google OAuth callback
   - Twitter OAuth callback
   - Profile creation on first login
   - Profile update on subsequent logins
   - Mock Supabase Auth (no real OAuth)

2. **GDPR Data Export**
   - Export user profile
   - Export user activities
   - Export user integrations
   - Export user organizations
   - Verify JSON structure

3. **Account Deletion Workflow**
   - Request account deletion
   - Cancel account deletion
   - Process scheduled deletions (cron job)
   - Verify data is actually deleted

4. **Email Change Workflow**
   - Initiate email change
   - Confirm email change with token
   - Verify old email is updated
   - Test invalid token rejection

### Scope - costControl.js

**Integration Tests Needed:**

1. **Stripe Billing Integration**
   - Mock Stripe API calls
   - Verify subscription creation
   - Verify subscription update
   - Verify usage reporting to Stripe
   - Test webhook handling (payment success/failure)

2. **Monthly Usage Reset**
   - Test monthly reset cron job
   - Verify usage counters reset to 0
   - Verify plan limits are refreshed
   - Test timezone handling (UTC)

3. **Concurrent Usage Tracking**
   - Simulate concurrent API calls
   - Test race condition handling
   - Verify usage increments are accurate
   - Test distributed lock mechanism

4. **Plan Upgrade/Downgrade**
   - Test mid-month upgrade (prorated)
   - Test mid-month downgrade (prorated)
   - Verify usage limits update immediately
   - Test plan change rollback on error

### Prerequisites

- **Integration Test Infrastructure:**
  - Test Stripe account (or Stripe mock server)
  - Supabase Auth mock utilities
  - Time-based test utilities (mock Date.now, cron jobs)
  - Concurrency test utilities (Promise.all, race conditions)

- **Test Utilities:**
  - `tests/helpers/authTestHelpers.js` (mock OAuth, Supabase Auth)
  - `tests/helpers/billingTestHelpers.js` (mock Stripe, seed data)
  - `tests/integration/services/authService.integration.test.js`
  - `tests/integration/services/costControl.integration.test.js`

### Acceptance Criteria

**authService.js:**

- [ ] `authService.js` coverage ≥85%
- [ ] Integration tests cover OAuth flows
- [ ] Integration tests cover GDPR data export
- [ ] Integration tests cover account deletion
- [ ] Integration tests cover email change workflow
- [ ] All tests pass (100%)

**costControl.js:**

- [ ] `costControl.js` coverage ≥85%
- [ ] Integration tests cover Stripe billing
- [ ] Integration tests cover monthly reset
- [ ] Integration tests cover concurrent usage
- [ ] Integration tests cover plan upgrade/downgrade
- [ ] All tests pass (100%)

### Files to Create/Modify

**authService:**

- 🆕 `tests/integration/services/authService.integration.test.js`
- 🆕 `tests/helpers/authTestHelpers.js`
- ✅ Update `docs/nodes/auth.md` (coverage to 85%+)

**costControl:**

- 🆕 `tests/integration/services/costControl.integration.test.js`
- 🆕 `tests/helpers/billingTestHelpers.js`
- ✅ Update `docs/nodes/cost-control.md` (coverage to 85%+)

### References

- **Current Tests:**
  - `tests/unit/services/authService.test.js` (63 tests)
  - `tests/unit/services/costControl.test.js` (45 tests)
- **Service Code:**
  - `src/services/authService.js`
  - `src/services/costControl.js`
- **GDD Nodes:**
  - `docs/nodes/auth.md`
  - `docs/nodes/cost-control.md`
- **Parent Issue:** #929

---

## Summary

**Total Follow-Up Issues:** 2  
**Total Estimated Effort:** 5-7 days  
**Total Coverage Gap:** -63.14% (combined)

**Priority Order:**

1. **Issue #XXX (shieldService)** - HIGH priority, security-critical
2. **Issue #YYY (authService + costControl)** - MEDIUM priority, foundational services

**Next Steps:**

1. Create GitHub issues with descriptions above
2. Link to parent issue #929
3. Link to PR #968
4. Add to project board (Coverage Improvement)
5. Assign priority labels

---

**Created:** 2025-11-23  
**Related PR:** #968  
**Related Issue:** #929

