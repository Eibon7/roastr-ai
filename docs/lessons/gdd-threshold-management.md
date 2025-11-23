# GDD Health Score Threshold Management

**Document Type:** Best Practices / Lessons Learned
**Last Updated:** 2025-10-26
**Status:** Active
**Context:** GDD 2.0 Health Scoring System

---

## Purpose

This document provides guidance on when and how to adjust GDD health score thresholds. It establishes principles to prevent "threshold gaming" (artificially lowering thresholds to pass CI without addressing underlying quality issues).

---

## Core Principles

### ❌ What NOT to Do

**NEVER adjust thresholds as a shortcut to pass CI:**

- ❌ Lowering thresholds because current score is below target
- ❌ Adjusting numbers first, investigating later
- ❌ Using thresholds to hide test failures or coverage drops
- ❌ Making changes without documentation

### ✅ What TO Do

**ALWAYS investigate and fix root causes FIRST:**

- ✅ Run health score diagnostic: `node scripts/score-gdd-health.js --ci`
- ✅ Identify which nodes/components are failing
- ✅ Fix tests, update documentation, improve coverage
- ✅ ONLY adjust thresholds after confirming fixes aren't feasible

---

## Decision Workflow

### Step 1: Diagnose the Issue

```bash
# Run full diagnostic
node scripts/score-gdd-health.js --ci

# Identify failing nodes
node scripts/validate-gdd-runtime.js --full

# Check drift
node scripts/predict-gdd-drift.js --full
```

### Step 2: Investigate Root Causes

**Common failure patterns:**

- **Low Coverage:** Write missing tests BEFORE adjusting threshold
- **Documentation Gaps:** Update docs BEFORE adjusting threshold
- **Test Failures:** Fix tests BEFORE adjusting threshold
- **Outdated Nodes:** Update GDD nodes to reflect current architecture

### Step 3: Attempt Remediation

**Priority order:**

1. **Fix tests** (highest priority)
2. **Improve coverage** (run auto-repair: `node scripts/auto-repair-gdd.js --auto-fix`)
3. **Update documentation** (ensure accuracy)
4. **Validate cross-references** (run: `node scripts/validate-gdd-cross.js --full`)

### Step 4: Evaluate Threshold Adjustment (If Remediation Fails)

**Valid reasons to adjust threshold:**

- Architecture change requires temporary lower score during migration
- New stringent validation added (temporary adjustment while codebase adapts)
- Seasonal variance in certain metrics (documented pattern)

**Invalid reasons:**

- "CI is blocking my PR" (fix the underlying issue instead)
- "I don't have time to fix tests" (technical debt accumulation)
- "Coverage is hard to improve" (indicates need for better testing strategy)

### Step 5: Document the Change

**If adjustment is justified, use this format in `.gddrc.json`:**

```json
{
  "healthThreshold": 85, // Lowered from 87
  "notes": [
    "Temporary reduction due to Shield Phase 2 migration (2025-10-24)",
    "Expected return to 87+ by 2025-10-31 after migration complete"
  ],
  "temporary_until": "2025-10-31"
}
```

**Required elements:**

- `notes`: Explain WHY threshold was lowered
- `temporary_until`: Set deadline for returning to normal
- Issue/PR reference: Link to tracking issue

---

## Examples

### ❌ Bad Example: Gaming the System

```json
// .gddrc.json
{
  "healthThreshold": 75 // <-- NO EXPLANATION!
}
```

**Git commit message:**

```
fix(ci): Lower GDD threshold to pass CI
```

**Problem:** No investigation, no documentation, no plan to improve.

---

### ✅ Good Example: Documented Temporary Adjustment

```json
// .gddrc.json
{
  "healthThreshold": 85,
  "notes": [
    "Temporary adjustment during Shield Phase 2 refactor (#653)",
    "4 unit tests need mocking infrastructure upgrades (PR #654)",
    "Coverage will restore to 87+ when migration completes"
  ],
  "temporary_until": "2025-10-31"
}
```

**Git commit message:**

```
chore(gdd): Temporary threshold adjustment for Shield migration - Issue #653

Context:
- Shield Phase 2 requires breaking changes to test infrastructure
- 4 unit tests need comprehensive handler mocks (tracked in #654)
- Threshold lowered 87→85 temporarily to unblock PR

Plan:
- Complete handler mocks by 2025-10-30
- Restore threshold to 87 by 2025-10-31
- Add monitoring alert if not restored by deadline

Related: #653, #654
```

**Follow-up tracking:** Issue #654 created to restore threshold.

---

## Monitoring & Enforcement

### CI Validation

**Script:** `scripts/ci/validate-gdd-health.js`

**Checks:**

- Health score ≥ configured threshold
- If threshold < 87: Verify `temporary_until` date exists
- If `temporary_until` date passed: **FAIL CI** (must restore or re-justify)

### Weekly Review

**Process:**

1. Check thresholds in `.gddrc.json`
2. Identify any `temporary_until` dates approaching
3. Verify related issues are on track
4. Escalate if threshold not being restored

### Audit Trail

**All threshold changes must:**

- Be tracked in git history
- Reference an issue or PR
- Include `temporary_until` if not permanent
- Pass code review with justification

---

## Red Flags

**Immediate escalation required if:**

- Threshold lowered >5 points (87→82 or lower)
- No `temporary_until` date provided
- Multiple consecutive threshold reductions
- Threshold reduction without linked issue/PR
- `temporary_until` date repeatedly extended

---

## Historical Context

**Previous threshold adjustments:**

| Date       | Old | New | Reason                          | Restored             |
| ---------- | --- | --- | ------------------------------- | -------------------- |
| 2025-10-24 | 87  | 85  | Shield Phase 2 migration (#653) | 2025-10-31 (planned) |

_(Add entries chronologically as threshold changes occur)_

---

## Related Documentation

- **GDD Activation Guide:** `docs/GDD-ACTIVATION-GUIDE.md`
- **Health Scoring:** GDD Phase 15 (`docs/GDD-PHASE-15.md`)
- **Auto-Repair Script:** `scripts/auto-repair-gdd.js`
- **Quality Standards:** `docs/QUALITY-STANDARDS.md`

---

## Questions?

**Before adjusting a threshold, ask yourself:**

1. Have I run full diagnostics?
2. Have I attempted to fix the underlying issues?
3. Can I justify this change to the team?
4. Have I set a deadline to restore the threshold?
5. Have I documented the reason clearly?

**If you answered "NO" to any question, do NOT adjust the threshold yet.**

---

**Philosophy:** Thresholds exist to maintain quality standards. Lowering them without fixing underlying issues is technical debt accumulation. Always fix the problem, not the measurement.

**Enforcement:** CI will fail if thresholds are gamed (lowered without justification).

**Accountability:** Product Owner approval required for permanent threshold reductions.
