# Implementation Plan: Issue #716 - Guardian Script Testing

**Issue:** Guardian Script Testing - Add comprehensive tests for GDD Guardian
**PR Branch:** `feature/issue-716-guardian-tests`
**Estimated Effort:** 3-4 days
**Priority:** 🟡 MEDIA

---

## FASE 0: Assessment & Research

### Current State Analysis

**✅ Existing Assets:**
- Script: `scripts/guardian-gdd.js` (654 lines)
- Documentation: `docs/nodes/guardian.md` (8,794 lines)
- Existing tests:
  - `tests/unit/scripts/guardian-gdd.test.js` (362 lines) - Covers M1, M2, C4 fixes
  - `tests/integration/guardian-api.test.js` (311 lines) - REST API tests
  - `tests/security/guardian-path-traversal.test.js` - Security tests
  - `tests/unit/services/guardianCaseService.test.js` - Service layer tests
- Configuration:
  - `config/product-guard.yaml` - 5 protected domains
  - `config/guardian-ignore.yaml` - Ignore patterns
- Test fixtures: Limited (needs expansion)

**❌ Gaps Identified:**
1. Current unit test coverage: ~40% (target: ≥80%)
2. Missing CLI flag tests (--full, --ci, --auto-fix, --report, --help)
3. Missing edge case coverage:
   - Renamed files handling
   - Multiple domain violations
   - Deduplication logic (generateCaseKey, caseExists)
   - Configuration loading failures
   - Notification system (sendNotification)
4. Missing integration workflow tests:
   - Full scan → audit log → case creation → notification
   - CI mode exit codes (0, 1, 2)
   - Report generation workflow
5. Missing fixture data for realistic scenarios
6. No GUARDIAN-USAGE.md documentation

**📊 Test Coverage Gap:**
```
Current: ~40% coverage (estimated)
Target:  ≥80% coverage
Gap:     ~40% additional coverage needed

Uncovered Functions:
- loadConfig() - Partial coverage
- shouldIgnoreFile() - No coverage
- classifyChange() - Partial coverage (missing glob patterns, keyword matching)
- scan() - Partial coverage (missing exit code paths)
- generateAuditLog() - Partial coverage (missing deduplication)
- sendNotification() - No coverage
- generateReport() - Minimal coverage
```

### Dependencies Analysis

**GDD Nodes:**
- `docs/nodes/guardian.md` - Guardian rules and validation logic

**Related Scripts:**
- `scripts/notify-guardian.js` - Email notification (Phase 17)
- `scripts/ci/require-agent-receipts.js` - CI integration pattern

**Test Patterns to Follow:**
- `tests/unit/scripts/validate-completion.test.js` - Script execution testing
- `tests/unit/scripts/require-agent-receipts.test.js` - CLI flag testing
- `tests/integration/guardian-api.test.js` - Integration testing pattern

**CodeRabbit Lessons:**
- Read `docs/patterns/coderabbit-lessons.md`
- Apply TDD: Write tests BEFORE implementation
- Cover happy path + error cases + edge cases
- Use JSDoc for all new functions
- Minimum 3 test cases per function

---

## FASE 1: Planning & Design

### Test Structure Design

```
tests/
├── unit/
│   └── scripts/
│       └── guardian-gdd.test.js (EXPAND)
│           ├── Configuration Loading
│           │   ├── loadConfig() - Success/Failure
│           │   ├── shouldIgnoreFile() - Pattern matching
│           │   └── Config validation errors
│           ├── Git Operations
│           │   ├── getGitDiff() - Staged/Unstaged/Empty/Error
│           │   ├── getFileDiff() - Normal/Empty/Error
│           │   └── Renamed files handling
│           ├── Classification Logic
│           │   ├── classifyChange() - File path matching
│           │   ├── Glob pattern matching
│           │   ├── Keyword matching
│           │   └── Severity escalation (CRITICAL > SENSITIVE > SAFE)
│           ├── Deduplication
│           │   ├── generateCaseKey() - Hash generation
│           │   └── caseExists() - Detection logic
│           ├── Audit & Reporting
│           │   ├── generateAuditLog() - Creation/Append
│           │   ├── generateReport() - Markdown generation
│           │   └── sendNotification() - Mock integration
│           └── Orchestration
│               ├── scan() - Full workflow
│               └── Exit codes (0, 1, 2)
│
├── integration/
│   └── guardian-workflow.test.js (NEW)
│       ├── End-to-end scan workflow
│       ├── Multiple violations workflow
│       ├── Deduplication workflow
│       └── CI integration workflow
│
├── cli/
│   └── guardian-cli.test.js (NEW)
│       ├── --full flag
│       ├── --check flag
│       ├── --report flag
│       ├── --ci flag (exit codes)
│       ├── --help flag
│       └── Flag combinations
│
└── fixtures/
    └── guardian/
        ├── product-guard-test.yaml (ENHANCE)
        ├── guardian-ignore-test.yaml (NEW)
        ├── mock-diffs/ (NEW)
        │   ├── pricing-change.diff
        │   ├── auth-policy.diff
        │   ├── ai-model.diff
        │   ├── quota-change.diff
        │   └── safe-doc-change.diff
        ├── mock-cases/ (NEW)
        │   ├── critical-case.json
        │   ├── sensitive-case.json
        │   └── safe-case.json
        └── expected-outputs/ (NEW)
            ├── critical-report.md
            ├── sensitive-report.md
            └── safe-report.md
```

### Test Cases Breakdown

#### 1. Unit Tests: Configuration (Target: 100% coverage)

**Function: `loadConfig()`**
- ✅ Test 1: Load valid configuration successfully
- ✅ Test 2: Handle missing config file (ENOENT)
- ✅ Test 3: Handle malformed YAML (parse error)
- ✅ Test 4: Load ignore patterns when guardian-ignore.yaml exists
- ✅ Test 5: Handle missing ignore patterns gracefully

**Function: `shouldIgnoreFile(filePath)`**
- ✅ Test 1: Ignore Windows system paths (C:\Windows\**)
- ✅ Test 2: Ignore test fixtures (docs/guardian/cases/**)
- ✅ Test 3: Ignore temporary files (**/*.tmp)
- ✅ Test 4: Allow normal files (src/**/*.js)
- ✅ Test 5: Match glob patterns with matchBase option
- ✅ Test 6: Match dotfiles (.**/.gdd-backups/**)

#### 2. Unit Tests: Git Operations (Target: 100% coverage)

**Function: `getGitDiff()`**
- ✅ Test 1: Detect staged changes (M1 fix - existing)
- ✅ Test 2: Detect unstaged changes (M1 fix - existing)
- ✅ Test 3: Return empty array when no changes (existing)
- ✅ Test 4: Return null on git error (existing - NEEDS FIX)
- ✅ Test 5: Handle renamed files (status R100, oldPath, newFile)
- ✅ Test 6: Filter ignored files (Windows paths, test fixtures)
- ✅ Test 7: Update changesSummary.total_files correctly

**Function: `getFileDiff(file)`**
- ✅ Test 1: Count added lines excluding +++ (M2 fix - existing)
- ✅ Test 2: Count removed lines excluding --- (M2 fix - existing)
- ✅ Test 3: Handle empty diffs (existing)
- ✅ Test 4: Fallback from staged to unstaged
- ✅ Test 5: Update changesSummary counters
- ✅ Test 6: Handle git command errors gracefully

#### 3. Unit Tests: Classification Logic (Target: 100% coverage)

**Function: `classifyChange(file, fileDiff)`**
- ✅ Test 1: Match exact file path (src/services/costControl.js → pricing)
- ✅ Test 2: Match glob pattern (src/routes/*.js → public_contracts)
- ✅ Test 3: Match keyword in diff ("subscription" → pricing)
- ✅ Test 4: Escalate to highest severity (CRITICAL > SENSITIVE)
- ✅ Test 5: Match multiple domains (costControl.js → pricing + quotas)
- ✅ Test 6: Return SAFE for unmatched files
- ✅ Test 7: Case-insensitive keyword matching
- ✅ Test 8: Update changesSummary.domains_affected

**Edge Cases:**
- ✅ Test 9: Glob with no glob chars (exact match fallback)
- ✅ Test 10: Null diff (keywords skipped)
- ✅ Test 11: Empty domains object (returns SAFE)

#### 4. Unit Tests: Deduplication (Target: 100% coverage)

**Function: `generateCaseKey(files, severity, action, domains)`**
- ✅ Test 1: Generate deterministic hash for same inputs
- ✅ Test 2: Different hash for different files
- ✅ Test 3: Different hash for different severity
- ✅ Test 4: Different hash for different action
- ✅ Test 5: Different hash for different domains
- ✅ Test 6: Sort files before hashing (order-independent)
- ✅ Test 7: Sort domains before hashing (order-independent)

**Function: `caseExists(caseKey)`**
- ✅ Test 1: Return true for existing case (with caseId, file)
- ✅ Test 2: Return false for non-existent case
- ✅ Test 3: Return false when cases directory missing
- ✅ Test 4: Skip malformed case files (invalid JSON)
- ✅ Test 5: Handle empty cases directory

#### 5. Unit Tests: Audit & Reporting (Target: 100% coverage)

**Function: `generateAuditLog()`**
- ✅ Test 1: Create audit log if missing (C4 fix - existing)
- ✅ Test 2: Append to existing audit log
- ✅ Test 3: Create case file in docs/guardian/cases/
- ✅ Test 4: Skip duplicate case (deduplication)
- ✅ Test 5: Call sendNotification for CRITICAL/SENSITIVE
- ✅ Test 6: Skip notification for SAFE
- ✅ Test 7: Use GITHUB_ACTOR or USER or USERNAME or 'unknown'
- ✅ Test 8: Handle no violations (early return)

**Function: `generateReport()`**
- ✅ Test 1: Create report directory if missing (C4 fix - existing)
- ✅ Test 2: Generate markdown with correct structure
- ✅ Test 3: Include critical violations section
- ✅ Test 4: Include sensitive violations section
- ✅ Test 5: Include safe violations section
- ✅ Test 6: Correct recommendation based on severity

**Function: `sendNotification(caseId)` (NEW)**
- ✅ Test 1: Execute notify-guardian.js with case ID
- ✅ Test 2: Handle notification failure gracefully (continue)
- ✅ Test 3: Pass environment variables to child process
- ✅ Test 4: Log success/failure messages

#### 6. Unit Tests: Orchestration (Target: 100% coverage)

**Function: `scan()`**
- ✅ Test 1: Return 0 for no changes (existing - needs verification)
- ✅ Test 2: Return 0 for all SAFE changes
- ✅ Test 3: Return 1 for SENSITIVE changes
- ✅ Test 4: Return 2 for CRITICAL changes
- ✅ Test 5: Return 2 for config load failure
- ✅ Test 6: Return 2 for git diff error (null)
- ✅ Test 7: Call printResults and generateAuditLog
- ✅ Test 8: Full workflow integration (existing - needs expansion)

**Function: `main()` (CLI)**
- ✅ Test 1: --help shows help text and exits 0
- ✅ Test 2: --full runs full scan
- ✅ Test 3: --report generates report file
- ✅ Test 4: --ci exits with scan exit code
- ✅ Test 5: Default mode exits 0 (non-CI)

#### 7. Integration Tests: Workflows (NEW)

**Test Suite: guardian-workflow.test.js**
- ✅ Test 1: End-to-end CRITICAL workflow
  - Mock pricing change → Scan → Audit log → Case file → Notification
  - Verify exit code 2, audit entry, case file exists
- ✅ Test 2: End-to-end SENSITIVE workflow
  - Mock AI model change → Scan → Audit log → Case file
  - Verify exit code 1
- ✅ Test 3: End-to-end SAFE workflow
  - Mock doc change → Scan → Audit log → No notification
  - Verify exit code 0
- ✅ Test 4: Multiple violations workflow
  - Mock pricing + auth changes → Scan → Both CRITICAL
  - Verify case includes both domains
- ✅ Test 5: Deduplication workflow
  - Run scan twice with same changes → Verify single case created
- ✅ Test 6: Ignored files workflow
  - Mock Windows path + normal file → Verify only normal file scanned

#### 8. CLI Flag Tests (NEW)

**Test Suite: guardian-cli.test.js**
- ✅ Test 1: --full flag executes full scan
- ✅ Test 2: --check flag executes quick validation
- ✅ Test 3: --report flag generates report file
- ✅ Test 4: --ci flag exits with correct code (0, 1, 2)
- ✅ Test 5: --help flag shows help and exits 0
- ✅ Test 6: --full --report combination works
- ✅ Test 7: --ci --report combination works
- ✅ Test 8: Invalid flag shows error

#### 9. Edge Case Tests

**Edge Cases:**
- ✅ Test 1: Empty git repository (no commits)
- ✅ Test 2: Detached HEAD state
- ✅ Test 3: Git not installed (command not found)
- ✅ Test 4: Permissions error writing audit log
- ✅ Test 5: Permissions error writing case file
- ✅ Test 6: Malformed product-guard.yaml
- ✅ Test 7: Missing domain owner in config
- ✅ Test 8: File renamed + modified (R100 with diff)
- ✅ Test 9: Very large diff (>10,000 lines)
- ✅ Test 10: Binary file changes (git diff returns binary)

---

## FASE 2: Implementation

### Step 1: Expand Unit Tests (Day 1-2)

**File: `tests/unit/scripts/guardian-gdd.test.js`**

1. Add Configuration tests (6 new tests)
2. Expand Git Operations tests (3 new tests)
3. Add Classification Logic tests (11 new tests)
4. Add Deduplication tests (12 new tests)
5. Expand Audit & Reporting tests (7 new tests)
6. Expand Orchestration tests (3 new tests)

**Expected Coverage Increase:**
- Before: ~40%
- After: ~75%

### Step 2: Create Integration Tests (Day 2)

**File: `tests/integration/guardian-workflow.test.js`**

1. Implement end-to-end workflows (6 tests)
2. Use realistic fixtures from `tests/fixtures/guardian/mock-diffs/`
3. Verify audit log entries, case files, exit codes
4. Test deduplication with multiple runs

**Expected Coverage Increase:**
- Before: ~75%
- After: ~85%

### Step 3: Create CLI Flag Tests (Day 2-3)

**File: `tests/cli/guardian-cli.test.js`**

1. Test each CLI flag individually (8 tests)
2. Test flag combinations (3 tests)
3. Verify script execution with `execSync`
4. Verify exit codes in --ci mode

**Expected Coverage Increase:**
- Before: ~85%
- After: ~90%

### Step 4: Create Test Fixtures (Day 3)

**Files to Create:**

1. `tests/fixtures/guardian/guardian-ignore-test.yaml`
   - Test-specific ignore patterns

2. `tests/fixtures/guardian/mock-diffs/` (5 files)
   - `pricing-change.diff` - CRITICAL violation
   - `auth-policy.diff` - CRITICAL violation
   - `ai-model.diff` - SENSITIVE violation
   - `quota-change.diff` - SENSITIVE violation
   - `safe-doc-change.diff` - SAFE change

3. `tests/fixtures/guardian/mock-cases/` (3 files)
   - `critical-case.json` - Example CRITICAL case
   - `sensitive-case.json` - Example SENSITIVE case
   - `safe-case.json` - Example SAFE case

4. `tests/fixtures/guardian/expected-outputs/` (3 files)
   - `critical-report.md` - Expected CRITICAL report
   - `sensitive-report.md` - Expected SENSITIVE report
   - `safe-report.md` - Expected SAFE report

### Step 5: Create Documentation (Day 3-4)

**File: `docs/GUARDIAN-USAGE.md`**

**Structure:**
```markdown
# Guardian Agent - User Guide

## Overview
- What is Guardian?
- Why use Guardian?
- When does Guardian run?

## Installation
- Dependencies
- Configuration files

## Usage

### CLI Commands
- node scripts/guardian-gdd.js --full
- node scripts/guardian-gdd.js --check
- node scripts/guardian-gdd.js --report
- node scripts/guardian-gdd.js --ci
- node scripts/guardian-gdd.js --help

### Exit Codes
- 0: SAFE (all checks passed)
- 1: SENSITIVE (manual review required)
- 2: CRITICAL (merge blocked)

### Configuration

#### product-guard.yaml
- Domain definitions
- Protection levels
- Keywords and file patterns

#### guardian-ignore.yaml
- Ignore patterns
- Test fixtures
- False positives

## Workflows

### Local Development
1. Make changes
2. Run Guardian: node scripts/guardian-gdd.js --full
3. Review violations
4. Fix or request approval

### CI/CD Integration
1. Add to .github/workflows/guardian-check.yml
2. Guardian runs on every PR
3. Blocks merge if CRITICAL
4. Requires manual review if SENSITIVE

### Approval Process
- CRITICAL: Product Owner + 2 reviewers
- SENSITIVE: Tech Lead + 1 reviewer
- SAFE: Auto-approved

## Case Management

### Viewing Cases
- GET /api/guardian/cases
- GET /api/guardian/cases?severity=CRITICAL
- GET /api/guardian/cases?action=REVIEW

### Approving Cases
- POST /api/guardian/cases/:caseId/approve
- Body: { approver: "Name" }

### Denying Cases
- POST /api/guardian/cases/:caseId/deny
- Body: { denier: "Name", reason: "Explanation" }

## Audit Log
- Location: docs/guardian/audit-log.md
- Format: Markdown table
- Fields: Timestamp, Case ID, Actor, Domains, Files, Severity, Action, Notes

## Troubleshooting

### Common Issues
1. Git not installed
2. Configuration file missing
3. Permissions errors
4. False positives

### Debugging
- Check git status
- Verify configuration syntax
- Review ignore patterns
- Check audit log

## Examples

### Example 1: Pricing Change (CRITICAL)
- File: src/services/costControl.js
- Severity: CRITICAL
- Action: BLOCKED
- Approver: Product Owner

### Example 2: AI Model Change (SENSITIVE)
- File: src/services/roastPromptTemplate.js
- Severity: SENSITIVE
- Action: REVIEW
- Approver: Tech Lead

### Example 3: Documentation Update (SAFE)
- File: docs/README.md
- Severity: SAFE
- Action: APPROVED
- Approver: Auto-approved

## API Reference

### GuardianEngine Class
- Constructor
- loadConfig()
- shouldIgnoreFile()
- getGitDiff()
- getFileDiff()
- classifyChange()
- scan()
- generateAuditLog()
- generateReport()
- sendNotification()

## Related Documentation
- docs/nodes/guardian.md
- config/product-guard.yaml
- config/guardian-ignore.yaml
```

---

## FASE 3: Validation

### Coverage Verification

**Command:**
```bash
npm test -- tests/unit/scripts/guardian-gdd.test.js --coverage
```

**Expected Output:**
```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------|---------|----------|---------|---------|-------------------
guardian-gdd.js         |   85.50 |    80.00 |   90.00 |   85.50 | 532-535
------------------------|---------|----------|---------|---------|-------------------
```

**Acceptance Criteria:**
- ✅ Statement coverage ≥80%
- ✅ Branch coverage ≥80%
- ✅ Function coverage ≥80%
- ✅ Line coverage ≥80%

### Test Execution

**All Tests:**
```bash
npm test -- tests/unit/scripts/guardian-gdd.test.js
npm test -- tests/integration/guardian-workflow.test.js
npm test -- tests/cli/guardian-cli.test.js
```

**Expected:**
- ✅ All tests passing (0 failures)
- ✅ No console errors or warnings
- ✅ Tests run in <30 seconds

### CI Integration

**Command:**
```bash
node scripts/guardian-gdd.js --ci
```

**Expected:**
- ✅ Exits with correct code (0, 1, or 2)
- ✅ Generates audit log
- ✅ Creates case files
- ✅ Sends notifications (if applicable)

### Documentation Review

**Checklist:**
- ✅ GUARDIAN-USAGE.md is complete
- ✅ Examples are clear and accurate
- ✅ API reference matches implementation
- ✅ Troubleshooting section is helpful
- ✅ No typos or formatting issues

---

## FASE 4: Deliverables

### Files Created

**Tests:**
1. `tests/unit/scripts/guardian-gdd.test.js` (EXPANDED - +300 lines)
2. `tests/integration/guardian-workflow.test.js` (NEW - ~200 lines)
3. `tests/cli/guardian-cli.test.js` (NEW - ~150 lines)

**Fixtures:**
4. `tests/fixtures/guardian/guardian-ignore-test.yaml` (NEW)
5. `tests/fixtures/guardian/mock-diffs/*.diff` (NEW - 5 files)
6. `tests/fixtures/guardian/mock-cases/*.json` (NEW - 3 files)
7. `tests/fixtures/guardian/expected-outputs/*.md` (NEW - 3 files)

**Documentation:**
8. `docs/GUARDIAN-USAGE.md` (NEW - ~500 lines)

**Total:** 8 new/modified files

### Metrics

**Test Coverage:**
- Before: ~40%
- After: ≥80%
- Increase: +40%

**Test Count:**
- Before: ~15 tests
- After: ~70 tests
- Increase: +55 tests

**Documentation:**
- Before: 0 user guides
- After: 1 comprehensive guide

---

## Agents Relevantes

Based on task requirements and CLAUDE.md guidelines:

- **TestEngineer** (PRIMARY)
  - Triggers: New tests, coverage verification, test design
  - Receipt: `docs/agents/receipts/716-TestEngineer.md`
  - Tasks: Design test structure, implement tests, verify ≥80% coverage

- **Guardian** (SECONDARY)
  - Triggers: Changes to guardian-gdd.js (if refactoring needed), documentation updates
  - Receipt: `docs/agents/receipts/716-Guardian.md` or SKIPPED
  - Tasks: Validate guardian logic correctness, approve documentation

- **Explore** (OPTIONAL)
  - Triggers: If codebase research needed beyond what's provided
  - Receipt: `docs/agents/receipts/716-Explore-SKIPPED.md`
  - Tasks: Research existing test patterns (LIKELY SKIPPED - sufficient context)

---

## Risk Assessment

**LOW RISK:**
- ✅ No production code changes (tests only)
- ✅ Well-defined acceptance criteria
- ✅ Clear test patterns to follow
- ✅ Existing tests provide foundation

**MEDIUM RISK:**
- ⚠️ Achieving 80% coverage may require additional fixtures
- ⚠️ Integration tests may require mocking notify-guardian.js
- ⚠️ CLI tests may have platform-specific behavior

**Mitigations:**
- Create comprehensive fixtures early (Day 1)
- Mock external dependencies (notify-guardian.js)
- Test on macOS (current platform) + CI (Linux)

---

## Success Criteria

**All Acceptance Criteria Met:**
- ✅ Unit tests for Guardian core (≥80% coverage)
- ✅ Integration tests with fixtures
- ✅ CLI flag testing (--full, --ci, --auto-fix, --report, --help)
- ✅ Edge cases covered
- ✅ `docs/GUARDIAN-USAGE.md` created
- ✅ CI integration verified

**Additional Quality Gates:**
- ✅ 0 CodeRabbit comments
- ✅ All tests passing
- ✅ No conflicts with main
- ✅ Documentation reviewed and approved
- ✅ GDD nodes updated (if applicable)

---

## Next Steps

1. **Immediate:** Start FASE 2 implementation
2. **Day 1:** Expand unit tests, create fixtures
3. **Day 2:** Integration tests, CLI tests
4. **Day 3:** Documentation, final validation
5. **Day 4:** PR creation, CodeRabbit review, merge

---

**End of Plan**
