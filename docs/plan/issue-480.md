# Epic #480: Test Suite Stabilization - Implementation Plan

**Date Created:** 2025-10-30
**Owner:** Orchestrator + TestEngineer
**Priority:** P0 CRITICAL
**Status:** 🔴 In Progress
**Current Baseline:** 182 failing test suites, 1161 failing tests (56% failure rate)

---

## Executive Summary

**Goal:** Reduce test failures from 182 suites → <10 suites (<3% failure rate)

**Approach:** Option C (Hybrid) - Baseline protection + systematic bug smashing

**Timeline:** 4 weeks, ~120 hours estimated

**Critical Blocker:** Completion validation currently blocks all PRs. Must implement baseline comparison FIRST.

---

## Estado Actual (Assessment Results)

### Current Test Status
```
Test Suites: 182 failed, 3 skipped, 142 passed, 324 of 327 total
Tests:       1161 failed, 72 skipped, 4131 passed, 5364 total
Failure Rate: 56% (CRITICAL)
```

### Gap from Original Estimate
- **Estimated:** ~30 failing suites (9% failure rate)
- **Actual:** 182 failing suites (56% failure rate)
- **Gap:** 6x worse than estimated

### Root Causes Identified
1. Missing database functions in test environment
2. Encryption key configuration issues
3. Shield event recording failures (logger issues)
4. OAuth mock structure mismatch
5. RLS policies not validated in tests
6. Rate limiter issues (partially fixed in #618)
7. Module-level initialization (partially fixed in #618)

---

## Week-by-Week Execution Plan

### Week 1: Baseline Protection + P0 Critical (Target: <150 failing)

#### Days 1-2: Baseline Protection (BLOCKER)
**Objective:** Allow PRs that don't make things worse

**Tasks:**
- [ ] Modify `scripts/ci/validate-completion.js` to use baseline comparison
- [ ] Store baseline snapshot: 182 failing suites (as of 2025-10-30)
- [ ] Update `.github/workflows/pre-merge-validation.yml`
- [ ] Update `docs/policies/completion-validation.md` with new policy
- [ ] Test with PR #630 (should now pass - improved baseline by 3 suites)

**Acceptance Criteria:**
- CI passes if `prFailures <= baselineFailures`
- Regression detection working (fails if introduces new failures)
- Documentation updated

**Files:**
- `scripts/ci/validate-completion.js` - Add baseline comparison
- `.github/workflows/pre-merge-validation.yml` - Update workflow
- `docs/policies/completion-validation.md` - Document policy

---

#### Days 3-5: OAuth Integration (Issue #638) - 12 hours
**Objective:** Fix 20+ failing OAuth tests

**Failing Suite:** `tests/integration/oauth-mock.test.js`

**Root Causes (Hypothesis):**
1. OAuth mock service doesn't match OAuthService interface
2. State parameter validation broken
3. Token refresh mechanism not working

**TDD Approach:**
1. Run: `npm test oauth-mock.test.js` → capture all failures
2. Fix first failure (likely callback flow)
3. Verify test passes
4. Move to next failure
5. Document patterns in coderabbit-lessons.md

**Files to Investigate:**
- `src/services/oauthService.js`
- `src/services/oauthMockService.js`
- `tests/helpers/oauth-test-utils.js`
- `tests/integration/oauth-mock.test.js`

**Acceptance Criteria:**
- [ ] All 5 platform callbacks passing (Twitter, Instagram, YouTube, Facebook, Bluesky)
- [ ] Token refresh working
- [ ] Disconnect flow validated
- [ ] Mock toggle functional
- [ ] 100% passing in oauth-mock.test.js

---

#### Days 3-5: Database Security (Issue #639) - 8 hours (PARALLEL)
**Objective:** Validate RLS policies and multi-tenant isolation

**Failing Suite:** `tests/integration/database/security.test.js`

**Root Causes (Hypothesis):**
1. Test DB not configured (missing DATABASE_URL)
2. RLS policies not applied in test environment
3. Schema mismatch between test and production

**TDD Approach:**
1. Verify DATABASE_URL configured
2. Run schema setup for test DB
3. Run: `npm test database/security.test.js`
4. Fix RLS policy issues
5. Validate cross-tenant isolation

**Files to Investigate:**
- `database/schema.sql` - RLS definitions
- `tests/integration/database/security.test.js`
- `tests/helpers/test-db-setup.js`
- Test environment configuration

**Acceptance Criteria:**
- [ ] All RLS policies tested
- [ ] Cross-tenant isolation validated
- [ ] Trigger functions security confirmed
- [ ] 100% passing in database/security.test.js

**Blocker Check:** Must verify DATABASE_URL is set and test DB accessible

---

### Week 2: P0 Core Flows (Target: <100 failing)

#### Days 1-3: Ingestor + Shield
**Issues:** #481 (3 suites, 6h) + #482/#633 (10 suites, 10h)

**Ingestor (Issue #481):**
- Failing suites: Comment fetching, queue processing
- Files: `src/services/ingestorService.js`, `src/workers/FetchCommentsWorker.js`

**Shield (Issues #482 + #633):**
- Failing suites: Shield decision engine, action executor
- 6 suites currently skipped (from #633)
- Files: `src/services/shieldService.js`, `src/workers/ShieldActionWorker.js`
- GDD: shield.md (86% coverage)

**Estimated:** 16 hours total

---

#### Days 4-5: Roast Generation + Integration Routes
**Issues:** #483 (5 suites, 6h) + #641 (12 suites, 6h)

**Roast Generation (Issue #483):**
- Failing suites: Master prompt template, RoastEngine, CSV service
- Files: `src/services/roastEngine.js`, `src/services/roastGeneratorEnhanced.js`
- GDD: roast.md (60% coverage)

**Integration Routes (Issue #641):**
- Failing suites: Platform connection endpoints
- Files: `src/routes/integrations.js`, platform-specific routes

**Estimated:** 12 hours total

---

### Week 3: P1 Bulk Fixes (Target: <50 failing)

#### Days 1-3: Multi-Tenant & Tier Validation
**Issues:** #484 (8 suites, 8h) + #642 (8 suites, 4h)

**Multi-Tenant & Billing (Issue #484):**
- Failing suites: RLS validation, billing logic
- Files: `database/schema.sql`, `src/services/billingService.js`
- GDD: multi-tenant.md (0% coverage), billing.md

**Tier Validation (Issue #642):**
- Failing suites: Plan limits, feature access control
- Files: `src/services/tierValidationService.js`

**Estimated:** 12 hours total

---

#### Days 4-5: Frontend + Workers
**Issues:** #643 (10 suites, 8h) + #644 (12 suites, 10h)

**Frontend/UI (Issue #643):**
- Failing suites: Component tests, E2E flows
- Requires Playwright MCP for visual validation
- Files: `frontend/components/`, E2E test suites

**Workers (Issue #644):**
- Failing suites: Background job processing
- Files: `src/workers/`, queue processing logic

**Estimated:** 18 hours total

---

### Week 4: P2 Cleanup + Long Tail (Target: <10 failing ✅ GOAL)

#### Days 1-3: Unit Tests
**Issue:** #485 (~15 suites, 8h)

**Unit Tests:**
- Failing suites: Routes, middleware, services
- Files: `tests/unit/routes/`, `tests/unit/services/`

**Estimated:** 8 hours

---

#### Days 4-5: CLI + Remaining
**Issues:** #645 (8 suites, 3h) + #646 (remaining, 16h)

**CLI (Issue #645):**
- Failing suites: Developer tooling
- Files: `src/cli.js`, CLI test suites

**Remaining Long Tail (Issue #646):**
- Comprehensive audit of remaining failures
- Systematic fixes for edge cases
- Final documentation pass

**Estimated:** 19 hours total

---

## Milestones & Validation Criteria

### Milestone 1 (Week 1 end): <150 failing suites
**Validation:**
- Baseline protection implemented and working
- OAuth tests passing
- Database security validated
- No regression from baseline

### Milestone 2 (Week 2 end): <100 failing suites
**Validation:**
- All P0 core flows passing
- Ingestor, Shield, Roast, Integration Routes green
- GDD nodes updated with coverage

### Milestone 3 (Week 3 end): <50 failing suites
**Validation:**
- P1 bulk fixes complete
- Multi-tenant, billing, frontend, workers passing
- Visual evidence for UI changes

### Final Goal (Week 4 end): <10 failing suites (<3% failure rate)
**Validation:**
- ✅ 100% P0 tests passing
- ✅ >90% P1 tests passing
- ✅ Main branch stable
- ✅ Completion validation unblocked
- ✅ Baseline protection proven
- ✅ All GDD nodes updated
- ✅ Test evidence documentation complete

---

## Agents & Skills Coordination

### Agents Invoked

1. **TaskAssessor** (✅ Complete)
   - Assessment: `docs/plan/issue-480-assessment.md`
   - Recommendation: Option C (Hybrid Approach)

2. **TestEngineer** (Pending)
   - Systematic test fixing across all priority tiers
   - TDD approach enforcement
   - Test evidence generation
   - Receipt: `docs/agents/receipts/480-TestEngineer.md`

3. **Guardian** (Pending - Week 2)
   - Validate security-critical changes (RLS, billing)
   - Review database schema modifications
   - Completion script: `node scripts/guardian-gdd.js --full`

4. **general-purpose** (Continuous)
   - Monitor PR status
   - Inspect CI/CD jobs
   - CodeRabbit review coordination

### Skills Used

- **systematic-debugging-skill**: Root cause analysis for each failure category
- **root-cause-tracing-skill**: Trace errors back to original triggers
- **test-driven-development-skill**: Write tests before fixes (RED→GREEN→REFACTOR)
- **verification-before-completion-skill**: Evidence-based completion claims
- **dispatching-parallel-agents-skill**: Week 1 parallel work (OAuth + Database)

### MCPs Used

- **Playwright MCP**: Visual validation for frontend tests (Week 3)
- **IDE MCP**: Diagnostics for complex failures

---

## Risk Assessment

### High Risk
- **Database configuration:** If test DB not accessible, Week 1 blocked
- **Encryption keys:** Persona tests may fail without proper PERSONA_ENCRYPTION_KEY
- **API credentials:** Some tests may need mock mode fixes

### Medium Risk
- **Frontend tests:** May require significant Playwright setup
- **Worker tests:** May need Redis/Upstash configuration

### Low Risk
- **Unit tests:** Should be straightforward with TDD approach
- **CLI tests:** Developer tooling typically isolated

### Mitigation Strategies
- Verify all env vars before starting each week
- Use mock mode aggressively to avoid API dependencies
- Document blockers immediately and escalate
- Parallel work where possible to maximize throughput

---

## Documentation Requirements

### Test Evidence (Per Week)
- `docs/test-evidence/issue-480/week-1/`
  - Summary of fixes
  - Before/after test output
  - Root cause documentation
  - Patterns identified

### GDD Updates
- Update coverage after each issue completion
- Add agents to "Agentes Relevantes" as invoked
- Run validation before each commit

### Agent Receipts
- Generate receipt for each agent invoked
- Document decisions, artifacts, guardrails
- SKIPPED receipts if agent not needed

### CodeRabbit Lessons
- Update `docs/patterns/coderabbit-lessons.md` with new patterns (≥2 occurrences)
- Reduce repetition rate to <10%

---

## Success Criteria (Final)

**Quantitative:**
- ✅ <10 failing test suites (<3% failure rate)
- ✅ >95% test pass rate
- ✅ 0 regressions from baseline
- ✅ All P0 core flows at 100%

**Qualitative:**
- ✅ Main branch stable for new PRs
- ✅ Completion validation unblocked
- ✅ CI/CD pipeline reliable
- ✅ Test suite runs in reasonable time (<10 mins)
- ✅ All GDD nodes reflect accurate coverage

**Documentation:**
- ✅ All sub-issues documented and closed
- ✅ Test evidence generated per issue
- ✅ Agent receipts complete
- ✅ Patterns documented in coderabbit-lessons.md

---

## Agentes Relevantes

- **TestEngineer**: Primary agent for systematic test fixing
- **TaskAssessor**: Assessment and prioritization
- **Guardian**: Security validation (RLS, billing, encryption)
- **general-purpose**: PR monitoring and CI/CD coordination

---

## Archivos Afectados (Week 1 Only)

### Baseline Protection
- `.github/workflows/pre-merge-validation.yml`
- `scripts/ci/validate-completion.js`
- `docs/policies/completion-validation.md`

### OAuth Integration (#638)
- `src/services/oauthService.js`
- `src/services/oauthMockService.js`
- `tests/integration/oauth-mock.test.js`
- `tests/helpers/oauth-test-utils.js`

### Database Security (#639)
- `database/schema.sql`
- `tests/integration/database/security.test.js`
- `tests/helpers/test-db-setup.js`
- Test environment configuration

---

## Referencias

- **Issue:** #480 (EPIC)
- **Sub-Issues:** #481-485, #638-646
- **Assessment:** `docs/plan/issue-480-assessment.md`
- **Quality Standards:** `docs/QUALITY-STANDARDS.md`
- **Testing Guide:** `docs/TESTING-GUIDE.md`
- **GDD Activation:** `docs/GDD-ACTIVATION-GUIDE.md`
- **CodeRabbit Lessons:** `docs/patterns/coderabbit-lessons.md`

---

**Next Action:** Invoke TestEngineer agent for Week 1 Day 1-2 (Baseline Protection implementation)
