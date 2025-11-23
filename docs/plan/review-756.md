# CodeRabbit Review Plan - PR #756

**PR:** https://github.com/Eibon7/roastr-ai/pull/756
**Review ID:** #3436780029
**Created:** 2025-11-08
**Branch:** claude/work-on-issues-011CUu8p8q5FGKti8WseVqbw

---

## 1. Analysis by Severity

### CRITICAL Issues (2)

#### C1: DEFAULT_TIER_LIMITS Fallback Uses Non-Existent 'free' Plan

- **File:** `src/services/planLimitsService.js`
- **Lines:** 423-425
- **Type:** Bug - Wrong default value
- **Impact:** Breaks fail-closed security pattern
- **Issue:** Line 424 returns `DEFAULT_TIER_LIMITS.free`, but 'free' key doesn't exist in tierConfig.js
- **Result:** Returns `undefined`, breaking fail-closed security
- **Fix:** Change to `DEFAULT_TIER_LIMITS.starter_trial`

#### C2: autoApprovalMappings Missing 'starter_trial' Entry

- **File:** `src/services/planLimitsService.js`
- **Lines:** 519-549
- **Type:** Bug - Missing configuration
- **Impact:** Breaks plan-specific auto-approval logic
- **Issue:** When `normalizePlan()` returns 'starter_trial', lookup fails and falls back to 'free'
- **Fix:** Add 'starter_trial' entry with zero limits matching free tier

### Nitpick Issues (2)

#### N1: docs/plan/issue-484.md Enhancement

- **Severity:** Nit
- **Type:** Documentation
- **Suggestion:** Add "Lessons Learned" section post-implementation
- **Action:** Will add after fixes applied

#### N2: Receipt Could Reference Inconsistency

- **Severity:** Nit
- **Type:** Documentation
- **File:** `docs/agents/receipts/claude-work-on-issues-011CUu8p8q5FGKti8WseVqbw-TestEngineer.md`
- **Suggestion:** Reference the `{ free: this.getDefaultLimits('starter_trial') }` inconsistency
- **Action:** Will update after fixes

---

## 2. GDD Nodes Affected

**Primary Nodes:**

- `docs/nodes/billing.md` - Plan limits logic
- `docs/nodes/roast.md` - Auto-approval feature

**Will load via GDD skill in next step.**

---

## 3. Subagent Assignment

| Issue          | Severity | Subagent               | Reason                                            |
| -------------- | -------- | ---------------------- | ------------------------------------------------- |
| C1, C2         | CRITICAL | Test Engineer          | Verify fixes don't break tests, maintain coverage |
| Pattern Search | CRITICAL | Explore Agent          | Find all 'free' references in codebase            |
| N1, N2         | Nit      | Documentation (inline) | Simple doc updates                                |

---

## 4. Files to Modify

### Critical Changes

1. **src/services/planLimitsService.js**
   - Line 424: Change 'free' → 'starter_trial'
   - Lines 519-549: Add 'starter_trial' entry to autoApprovalMappings
   - **Dependencies:** None
   - **Tests:** tests/integration/plan-limits-integration.test.js

### Documentation Updates

2. **docs/plan/issue-484.md**
   - Add "Lessons Learned" section at end

3. **docs/agents/receipts/claude-work-on-issues-011CUu8p8q5FGKti8WseVqbw-TestEngineer.md**
   - Reference autoApprovalMappings inconsistency in findings

---

## 5. Strategy

### Phase 1: Verification (DONE)

- [x] Read coderabbit-lessons.md
- [x] Verify branch: claude/work-on-issues-011CUu8p8q5FGKti8WseVqbw
- [x] Create review plan

### Phase 2: Pattern Search (NEXT)

- [ ] Search entire codebase for 'free' plan references
- [ ] Identify all locations that need 'starter_trial' migration
- [ ] Document findings in this plan

### Phase 3: Critical Fixes

- [ ] Fix C1: Line 424 'free' → 'starter_trial'
- [ ] Fix C2: Add 'starter_trial' to autoApprovalMappings
- [ ] Apply consistency fixes from pattern search

### Phase 4: Testing

- [ ] Run full test suite: `npm test`
- [ ] Verify plan-limits-integration.test.js: 12/12 passing
- [ ] Verify credits-api.test.js: 15/15 passing
- [ ] Verify stripeWebhooksFlow.test.js: 17/17 passing
- [ ] **Target:** 44/44 tests passing (maintain current state)

### Phase 5: GDD Validation

- [ ] Run: `node scripts/validate-gdd-runtime.js --full`
- [ ] Run: `node scripts/score-gdd-health.js --ci` (≥87 required)
- [ ] Run: `node scripts/predict-gdd-drift.js --full` (<60 risk)
- [ ] Update GDD nodes if needed

### Phase 6: Documentation

- [ ] Add "Lessons Learned" to docs/plan/issue-484.md
- [ ] Update TestEngineer receipt with findings
- [ ] Generate test evidence in docs/test-evidence/review-756/

### Phase 7: Commit & Push

- [ ] Create commit with proper format
- [ ] Push to origin/claude/work-on-issues-011CUu8p8q5FGKti8WseVqbw
- [ ] Report completion status

---

## 6. Success Criteria

✅ **Completion means:**

- 100% of CRITICAL issues resolved (C1, C2)
- 100% of Nitpick issues addressed (N1, N2)
- All tests passing: 44/44 (no regressions)
- Coverage maintained or improved
- GDD health ≥87
- GDD drift <60
- Pattern search completed with codebase-wide consistency
- Test evidence generated
- 0 regressions in functionality
- Code follows fail-closed security pattern everywhere

---

## 7. Testing Plan

### Pre-Fix Baseline

```bash
npm test -- tests/integration/plan-limits-integration.test.js
npm test -- tests/unit/routes/credits-api.test.js
npm test -- tests/integration/stripeWebhooksFlow.test.js
```

**Expected:** All passing (baseline)

### Post-Fix Verification

```bash
# Full test suite
npm test

# Specific suites
npm test -- tests/integration/plan-limits-integration.test.js
npm test -- tests/unit/routes/credits-api.test.js
npm test -- tests/integration/stripeWebhooksFlow.test.js
```

**Expected:** All passing (no regressions)

### Pattern Verification

```bash
# Find all 'free' plan references
grep -rn "DEFAULT_TIER_LIMITS\.free" src/
grep -rn "DEFAULT_TIER_LIMITS\[.*free" src/
grep -rn "'free'" src/ | grep -i "plan\|tier\|limit"
```

**Expected:** Zero references to non-existent 'free' plan

---

## 8. Commit Strategy

**Single commit with all fixes:**

```
fix(review-756): Apply CodeRabbit review - planLimitsService fail-closed fixes

### Critical Issues Resolved
- [C1] Line 424: Changed DEFAULT_TIER_LIMITS.free → starter_trial (src/services/planLimitsService.js:424)
- [C2] Lines 519-549: Added starter_trial entry to autoApprovalMappings (src/services/planLimitsService.js:520)

### Pattern Search
- Verified no other 'free' plan references in codebase
- Ensured fail-closed pattern consistency across all fallbacks

### Testing
- All tests passing: 44/44 (0 regressions)
- plan-limits-integration.test.js: 12/12 ✓
- credits-api.test.js: 15/15 ✓
- stripeWebhooksFlow.test.js: 17/17 ✓

### GDD
- Updated nodes: N/A (no architectural changes)
- GDD health: ≥87 ✓
- GDD drift: <60 ✓

### Documentation
- Added "Lessons Learned" to docs/plan/issue-484.md
- Updated TestEngineer receipt with findings
- Generated test evidence in docs/test-evidence/review-756/
```

---

## 9. Related Patterns

From `docs/patterns/coderabbit-lessons.md`:

**Relevant:**

- **Pattern #7**: PR Merge Policy - NEVER merge without approval
- **Pattern #2**: Testing Patterns - Cover happy + error + edge cases
- **Pattern #5**: Error Handling - Fail-closed security pattern

**New Pattern to Add:**
If this reveals ≥2 instances, add:

- **Pattern #12**: Plan Configuration - Always use 'starter_trial' for fail-closed, never reference non-existent 'free' plan

---

## 10. Risks & Mitigations

| Risk                                | Mitigation                                |
| ----------------------------------- | ----------------------------------------- |
| Fix breaks existing tests           | Run full test suite, verify 44/44 passing |
| Other 'free' references exist       | Pattern search entire codebase            |
| autoApprovalMappings has other gaps | Review all plan tier references           |
| GDD health degrades                 | Run all GDD validation scripts            |

---

**Status:** Ready to proceed
**Next Step:** Load GDD context → Pattern search → Apply fixes
