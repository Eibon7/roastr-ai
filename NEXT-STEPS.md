# Issue #442 - Next Steps to Complete

**Current Status:** ❌ NOT READY FOR MERGE  
**Completion:** 93% (41/44 tests passing)  
**Blockers:** 3 critical issues

---

## 🎯 Objective

Get PR #1028 from **93% complete** to **100% complete** and ready for merge.

---

## 🔴 Critical Path (Must Complete)

### 1. Fix 3 Failing Tests

**Priority:** CRITICAL  
**Time Estimate:** 1-2 hours  
**Blocks:** Merge (AC2 violation)

#### Test 1: Priority-Based Ordering

**File:** `tests/integration/ingestor-order-processing.test.js:169`  
**Test:** "should respect priority-based ordering"  
**Issue:** Payload structure mismatch

**Debug Command:**

```bash
cd /Users/emiliopostigo/roastr-ai-worktrees/issue-442

# Run with detailed output
npm test -- tests/integration/ingestor-order-processing.test.js \
  --testNamePattern="should respect priority-based ordering" \
  --verbose --no-coverage 2>&1 | tee debug-priority.log
```

**Expected Failure:**

- `processedOrder` doesn't match expected `['high_priority_1', 'normal_priority_1', 'low_priority_1']`
- Likely due to `comment.platform_comment_id` being undefined

**Fix Location:** Lines 232-255 in test file  
**Strategy:** Enhance payload normalization logic

#### Test 2: Concurrent Priority Levels

**File:** `tests/integration/ingestor-order-processing.test.js:531`  
**Test:** "should preserve order across different priority levels with concurrency"  
**Issue:** Similar payload structure issue with concurrent processing

**Debug Command:**

```bash
npm test -- tests/integration/ingestor-order-processing.test.js \
  --testNamePattern="should preserve order across different priority levels with concurrency" \
  --verbose --no-coverage 2>&1 | tee debug-concurrent.log
```

**Fix Location:** Same area as Test 1  
**Strategy:** Apply same payload normalization fix

#### Test 3: Acknowledgment Timing

**File:** `tests/integration/ingestor-acknowledgment.test.js`  
**Test:** TBD (identify exact failing test)  
**Issue:** Timing-sensitive assertions failing

**Debug Command:**

```bash
npm test -- tests/integration/ingestor-acknowledgment.test.js \
  --verbose --no-coverage 2>&1 | tee debug-acknowledgment.log
```

**Potential Fixes:**

1. Increase timing buffers
2. Fix `completeJob()` in mock queue service
3. Add `await` for async operations

---

### 2. Clean Branch Scope

**Priority:** HIGH  
**Time Estimate:** 5 minutes  
**Blocks:** Merge (scope violation)

**Remove commit 1cb956bb (auto-format fix):**

```bash
cd /Users/emiliopostigo/roastr-ai-worktrees/issue-442

# Backup current state
git branch backup-issue-442-pre-rebase

# Interactive rebase
git rebase -i HEAD~2

# In editor:
# - Change "pick 1cb956bb ..." to "drop 1cb956bb ..."
# - Save and close

# Verify clean history
git log --oneline feature/issue-442 ^main
# Should show ONLY:
# 28c19fa3 fix(tests): add maybeSingle() support...

# Force push (safe with lease)
git push --force-with-lease origin feature/issue-442
```

**Verification:**

```bash
# Should show only 1 commit
git log --oneline feature/issue-442 ^main | wc -l
# Expected: 1
```

---

### 3. Trigger CI Validation

**Priority:** HIGH  
**Time Estimate:** 10 minutes (wait time)  
**Blocks:** Merge (no CI evidence)

**Trigger workflow:**

```bash
cd /Users/emiliopostigo/roastr-ai-worktrees/issue-442

# Trigger CI manually
gh workflow run test.yml --ref feature/issue-442

# Wait for completion
gh run watch

# Verify status
gh run list --branch feature/issue-442 --limit 1
```

**Expected Output:**

```
✓ Lint and Test  feature/issue-442  push  28c19fa3  success  2m 30s ago
```

---

## 🟡 Secondary Tasks (Nice to Have)

### 4. Update PR Description

**Priority:** MEDIUM  
**Time Estimate:** 10 minutes

**Corrections:**

1. Test counts:
   - "Order processing: 6/8" → "Order processing: 8/8 (100%)"
   - "Acknowledgment: ~5/10" → "Acknowledgment: 8/8 (100%)"

2. Overall status:
   - "41+ tests passing (93%+)" → "44 tests passing (100%)"

3. Remove out-of-scope mention:
   - Delete commit 1cb956bb reference

4. Update AC2:
   - Confirm "✅ AC2: All tests pass (0 failures)"

**Command:**

```bash
gh pr edit 1028 --body "$(cat updated-pr-body.md)"
```

---

### 5. Final GDD Validation

**Priority:** CRITICAL  
**Time Estimate:** 15 minutes

**Run validation suite:**

```bash
cd /Users/emiliopostigo/roastr-ai-worktrees/issue-442

# Test suite (must be 100%)
npm test -- tests/integration/ingestor --no-coverage
# Expected: 44 passing, 0 failing

# Coverage check
npm run test:coverage
# Expected: >= 90%

# GDD runtime validation
node scripts/validate-gdd-runtime.js --full
# Expected: 🟢 HEALTHY

# GDD health score
node scripts/score-gdd-health.js --ci
# Expected: >= 87

# GDD drift prediction
node scripts/predict-gdd-drift.js --full
# Expected: < 60 risk

# CodeRabbit review
npm run coderabbit:review
# Expected: 0 comments
```

---

## ✅ Merge Readiness Checklist

**Before requesting merge approval, verify ALL items:**

- [ ] **Tests:** 44/44 passing (100% pass rate)
- [ ] **CI:** "Lint and Test" workflow passing
- [ ] **Scope:** Only issue-442 commits in branch
- [ ] **Coverage:** >= 90%
- [ ] **GDD Health:** >= 87
- [ ] **GDD Drift:** < 60 risk
- [ ] **CodeRabbit:** 0 comments pending
- [ ] **PR Description:** Accurate test counts
- [ ] **Documentation:** SUMMARY.md reflects 100% completion

**Current Status:** 1/9 ✅ (CodeRabbit passing only)

---

## 📊 Progress Tracker

| Task                  | Status  | ETA   | Blocker |
| --------------------- | ------- | ----- | ------- |
| Fix failing tests     | ⏸️ TODO | 1-2h  | YES     |
| Clean branch scope    | ⏸️ TODO | 5min  | YES     |
| Trigger CI            | ⏸️ TODO | 10min | YES     |
| Update PR description | ⏸️ TODO | 10min | NO      |
| Final GDD validation  | ⏸️ TODO | 15min | YES     |

**Overall Progress:** 93% → Target: 100%  
**Time to Complete:** 2-3 hours

---

## 🚀 Recommended Workflow

**Work in this order for fastest completion:**

1. **Fix tests** (1-2h) - Longest task, start immediately
2. **Clean scope** (5min) - Quick win after tests pass
3. **Trigger CI** (10min) - Start and let run in background
4. **Update PR** (10min) - While CI runs
5. **Final validation** (15min) - After CI completes

**Total:** 2-3 hours to merge-ready state

---

## 📞 Need Help?

If any blocker cannot be resolved:

1. **Tests won't pass:** Document architectural reason + defer to follow-up issue
2. **CI fails:** Check logs, fix issues, re-trigger
3. **GDD validation fails:** Run auto-repair: `node scripts/auto-repair-gdd.js --auto-fix`

**Escalation Path:**

- Technical blockers → @test-engineer
- Process blockers → @github-guardian
- Scope questions → Product Owner

---

**Last Updated:** 2025-11-26  
**Next Review:** After completing Task 1 (fix tests)
