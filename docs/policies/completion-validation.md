# Completion Validation Policy

**Status:** ✅ Active
**Effective Date:** 2025-10-23
**Owner:** Guardian Agent
**Enforcement:** Automated (CI/CD) + Manual

---

## Overview

The Completion Validation system ensures **NO PR is merged until it is 100% complete**. This policy prevents half-finished features, missing tests, incomplete documentation, and technical debt from reaching the `main` branch.

**Philosophy:** "Hacer las cosas bien y escalables" - Do things right and scalable. This is a monetizable product, not a school project.

---

## Validation Criteria

A PR is considered 100% complete when ALL of the following criteria are met:

### 1. Acceptance Criteria (100%)

- **Requirement:** All acceptance criteria from the issue body must be marked as complete
- **How it's checked:** Script parses issue body, validates checkboxes
- **Failure condition:** Any AC marked `[ ]` instead of `[x]`
- **Fix:** Complete remaining AC or update issue to remove out-of-scope items

**Example:**
```markdown
## Acceptance Criteria
- [x] User can delete account
- [x] 30-day grace period implemented
- [ ] Email notification sent (MISSING)
```
**Status:** ❌ Incomplete (1/3 AC pending)

### 2. Test Coverage (≥90%)

- **Requirement:** Average coverage across lines, statements, functions, branches ≥90%
- **How it's checked:** Reads `coverage/coverage-summary.json`
- **Failure condition:** Any metric below threshold
- **Fix:** Add tests for uncovered code paths

**Example:**
```
Lines:      92.5% ✅
Statements: 91.2% ✅
Functions:  88.0% ❌ (below 90%)
Branches:   93.1% ✅

Average: 91.2% ✅
```
**Status:** ✅ Passed (average ≥90%)

### 3. Tests Passing (0 failures)

- **Requirement:** `npm test` exits with code 0
- **How it's checked:** Runs full test suite
- **Failure condition:** Any test failing
- **Fix:** Fix failing tests BEFORE marking PR ready

**Example:**
```
79 passing
1 failing

❌ Status: CRITICAL - Do not merge
```

### 4. Agent Receipts (All required)

- **Requirement:** Every required agent must have a receipt (normal or SKIPPED)
- **How it's checked:** Runs `scripts/ci/require-agent-receipts.js`
- **Failure condition:** Missing receipt for any triggered agent
- **Fix:** Generate receipts using templates in `docs/agents/receipts/`

**Example:**
```
Required agents:
✅ TestEngineer: docs/agents/receipts/628-TestEngineer.md
❌ Guardian: NO RECEIPT FOUND
⚠️  UIDesigner: docs/agents/receipts/628-UIDesigner-SKIPPED.md

Status: ❌ Incomplete (1 missing)
```

### 5. Documentation Updated

- **Requirement:** GDD nodes validated, test evidence present
- **How it's checked:** Runs `node scripts/resolve-graph.js --validate`
- **Failure condition:** GDD validation errors
- **Fix:** Update affected nodes, run auto-repair if needed

**Example:**
```
✅ GDD nodes valid
✅ Test evidence SUMMARY.md present
```

### 6. CodeRabbit Comments (0 pending)

- **Requirement:** Zero unresolved CodeRabbit comments
- **How it's checked:** Fetches PR comments via `gh pr view`
- **Failure condition:** Any unresolved comment count >0
- **Fix:** Resolve ALL CodeRabbit suggestions before validation

**Example:**
```
❌ 3 CodeRabbit comments unresolved
```
**Required action:** Fix all 3 before proceeding

### 7. CI/CD Status (All passing)

- **Requirement:** All CI checks green, no pending jobs
- **How it's checked:** Runs `gh pr checks`
- **Failure condition:** Any check failing or pending
- **Fix:** Wait for pending checks, fix failures

**Example:**
```
✅ Tests / Unit Tests (18s)
✅ Tests / Integration Tests (42s)
✅ Lint / ESLint (8s)
✅ GDD / Health Score (12s)
❌ CodeRabbit / Review (failed)

Status: ❌ 1 failing check
```

---

## Usage

### Manual Validation

Run before marking PR as "ready to merge":

```bash
npm run validate:completion -- --pr=628
```

**Output formats:**

**100% Complete (exit 0):**
```
============================================================
📊 COMPLETION VALIDATION REPORT
============================================================

PR: #628
Date: 2025-10-23

🎯 Completion: 100.0%

📋 Checklist:
   ✅ Acceptance Criteria: 3/3
   ✅ Test Coverage: 92.5% (≥90%)
   ✅ Tests Passing: All
   ✅ Agent Receipts: 0 missing
   ✅ Documentation: 2/2 checks
   ✅ CodeRabbit: 0 comments pending
   ✅ CI/CD: 0 failing, 0 pending

============================================================
✅ PR IS 100% COMPLETE AND READY TO MERGE
   User may proceed with merge
```

**Incomplete (exit 1):**
```
============================================================
📊 COMPLETION VALIDATION REPORT
============================================================

PR: #628
Date: 2025-10-23

🎯 Completion: 85.7%

📋 Checklist:
   ✅ Acceptance Criteria: 3/3
   ❌ Test Coverage: 87.2% (<90%)
   ✅ Tests Passing: All
   ✅ Agent Receipts: 0 missing
   ❌ Documentation: 1/2 checks
   ✅ CodeRabbit: 0 comments pending
   ✅ CI/CD: 0 failing, 0 pending

============================================================
⚠️  PR IS INCOMPLETE - CONTINUE IMPLEMENTATION
   2 check(s) remaining

📝 Next Steps:
   • Increase test coverage to ≥90%
   • Update documentation (GDD nodes, test evidence)
```

**Critical Issues (exit 2):**
```
============================================================
📊 COMPLETION VALIDATION REPORT
============================================================

PR: #628
Date: 2025-10-23

🎯 Completion: 71.4%

📋 Checklist:
   ✅ Acceptance Criteria: 3/3
   ✅ Test Coverage: 92.5% (≥90%)
   ❌ Tests Passing: 2 failing
   ✅ Agent Receipts: 0 missing
   ✅ Documentation: 2/2 checks
   ✅ CodeRabbit: 0 comments pending
   ❌ CI/CD: 1 failing, 0 pending

============================================================
🚨 CRITICAL ISSUES DETECTED - DO NOT MERGE
   Fix failing tests and CI checks before proceeding
```

### CI/CD Integration

Automatic validation triggers:

1. **Label-based:** When `ready-to-merge` or `validate-completion` label added
2. **Manual:** Workflow dispatch with PR number input

**Workflow:** `.github/workflows/pre-merge-validation.yml`

**Enforcement:**
- Required check: `completion-required`
- PR cannot merge if validation fails
- Comments posted to PR with results

---

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | 100% complete | ✅ Ready to merge |
| `1` | Incomplete | ⚠️ Continue implementation |
| `2` | Critical blockers | 🚨 Fix immediately, do NOT merge |

---

## Violations & Consequences

### ❌ Merging Incomplete PR (< 100%)

**Violation:** Merging PR with validation exit code 1 or 2

**Consequences:**
- PR immediately rejected by code reviewer
- Must complete ALL pending items
- Re-work delays entire feature delivery
- Damages team trust and quality culture

**Prevention:** ALWAYS run `npm run validate:completion` before requesting merge

### ❌ Bypassing Validation

**Violation:** Attempting to merge without running validation

**Consequences:**
- Violation of "hacer las cosas bien y escalables" principle
- Creates technical debt for team
- May introduce bugs or incomplete features to production
- Requires immediate remediation via hotfix

**Prevention:** CI workflow enforces validation automatically

### ❌ Ignoring Critical Exit Code (2)

**Violation:** Proceeding with merge despite failing tests or CI

**Consequences:**
- Unacceptable technical debt
- May break production
- Requires emergency rollback
- Severe damage to product quality

**Prevention:** CI blocks merge if critical issues detected

---

## Workflow Integration

### Standard PR Lifecycle

1. **Development Phase**
   - Implement features
   - Write tests
   - Update documentation

2. **Pre-Review Phase**
   - Run `npm run validate:completion -- --pr=XXX`
   - Fix all pending items until exit code = 0
   - Only then add `ready-to-merge` label

3. **Review Phase**
   - Code reviewer verifies completion report
   - Reviews implementation quality
   - Checks for "hacer las cosas bien" adherence

4. **Merge Phase**
   - User (not bot) merges PR
   - Guardian ensures 100% completion
   - No half-finished features reach main

### Guardian Agent Invocation

**Triggers:**
- Label: `ready-to-merge`
- Diff: Sensitive files (billing, auth, etc.)
- Manual: `npm run validate:completion`

**Capabilities:**
- Governance: Validates sensitive changes
- Completion: Ensures 100% task completion

**Scripts:**
- Governance: `scripts/guardian-gdd.js`
- Completion: `scripts/ci/validate-completion.js`

---

## Configuration

### Environment Variables

- `GITHUB_TOKEN`: Required for PR/issue data fetching
- `COVERAGE_THRESHOLD`: Minimum coverage % (default: 90)
- `PR_NUMBER`: PR to validate (auto-detected from branch if missing)

### Custom Thresholds

Override coverage requirement:

```bash
npm run validate:completion -- --pr=628 --threshold=95
```

Or set globally:

```bash
export COVERAGE_THRESHOLD=95
npm run validate:completion -- --pr=628
```

---

## Troubleshooting

### Issue: "No coverage report found"

**Cause:** `coverage/coverage-summary.json` missing

**Fix:**
```bash
npm test -- --coverage
npm run validate:completion -- --pr=628
```

### Issue: "Could not fetch PR data"

**Cause:** GitHub CLI not authenticated or PR not found

**Fix:**
```bash
gh auth login
gh pr view 628 --json title  # Verify access
npm run validate:completion -- --pr=628
```

### Issue: "Agent receipt validation failed"

**Cause:** Missing receipts for required agents

**Fix:**
1. Check `docs/agents/receipts/` for missing files
2. Generate receipts using `docs/agents/receipts/_TEMPLATE.md`
3. For skipped agents, use `_TEMPLATE-SKIPPED.md`
4. Re-run validation

### Issue: "GDD validation errors"

**Cause:** Outdated or invalid GDD nodes

**Fix:**
```bash
node scripts/resolve-graph.js --validate
node scripts/auto-repair-gdd.js --auto-fix
npm run validate:completion -- --pr=628
```

---

## Related Documentation

- `CLAUDE.md` - Completion Validation policy section
- `agents/manifest.yaml` - Guardian agent definition
- `docs/agents/receipts/_TEMPLATE.md` - Agent receipt template
- `docs/QUALITY-STANDARDS.md` - Overall quality requirements
- `.github/workflows/pre-merge-validation.yml` - CI workflow

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-23 | Initial implementation |

---

**Maintained by:** Guardian Agent
**Review frequency:** Quarterly
**Last reviewed:** 2025-10-23
