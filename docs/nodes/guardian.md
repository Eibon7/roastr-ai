# Guardian Node

**Node Type:** Governance Layer
**Status:** active
**Version:** 1.1.0
**Last Updated:** 2025-10-23
**Related PR:** #515, #587 (Issue #487 - Shield Flow Validation with UI evidence), Guardian Completion Validation (user request)

---

## Overview

Guardian Agent is the **Product Governance Layer** for GDD 2.0, providing automated monitoring and protection for sensitive changes in product logic, pricing, authentication policies, and documentation. It acts as a proactive gatekeeper that classifies changes by severity and enforces approval workflows before merge.

**Core Responsibilities:**
- Monitor git changes for violations of protected domains (pricing, quotas, auth, AI models, public APIs)
- Classify changes by severity: CRITICAL (block merge), SENSITIVE (manual review), SAFE (auto-approve)
- Generate audit logs and case files for compliance and traceability
- Enforce approval workflows based on domain ownership
- Integrate with CI/CD pipelines via semantic exit codes (0=safe, 1=review, 2=block)
- Filter test fixtures and false positives using ignore patterns
- **Validate PR completion** - Ensures 100% task completion before merge (7 automated checks)

**Business Impact:**
- Prevents accidental pricing changes that could impact revenue (CRITICAL protection)
- Enforces security reviews for auth policy changes (CRITICAL protection)
- Ensures AI model changes are reviewed by domain experts (SENSITIVE protection)
- Maintains audit trail for compliance (SOC 2, GDPR)

---

## Dependencies

### Direct Dependencies
- **Core Modules**: fs, path, child_process (Node.js core)
- **External Libraries**:
  - `yaml` - Configuration file parsing (product-guard.yaml, guardian-ignore.yaml)
  - `minimatch` - Glob pattern matching for file paths and ignore patterns

### GDD Node Dependencies
- None (leaf node - core infrastructure layer)

### Configuration Files
- **`config/product-guard.yaml`** - Defines 5 protected domains with files, keywords, and protection levels
- **`config/guardian-ignore.yaml`** - Ignore patterns for test fixtures and false positives

---

## Used By

### GDD Nodes
- None yet (new feature in Phase 16)
- **Future integrations (Phase 17+)**:
  - CI/CD workflows (`.github/workflows/guardian-check.yml`)
  - Pre-commit hooks (Husky integration)
  - PR validation bot (auto-comment with scan results)

### Workflows
- Manual execution: `node scripts/guardian-gdd.js --full`
- CI mode: `node scripts/guardian-gdd.js --ci` (exits with semantic codes)
- Report generation: `node scripts/guardian-gdd.js --report`

---

## API / Contracts

### GuardianEngine Class

#### Constructor

```javascript
const guardian = new GuardianEngine();
```

Initializes empty violations store and changes summary.

#### Public Methods

#### `loadConfig() → boolean`
Loads product guard configuration and ignore patterns.

**Returns:**
- `true` - Configuration loaded successfully
- `false` - Configuration load failed (blocks scan)

**Side Effects:**
- Populates `this.config` with product-guard.yaml data
- Populates `this.ignorePatterns` array with guardian-ignore.yaml patterns

---

#### `shouldIgnoreFile(filePath: string) → boolean`
Checks if file matches any ignore patterns.

**Parameters:**
- `filePath` - Relative path from repository root

**Returns:**
- `true` - File should be ignored (test fixture, Windows path, etc.)
- `false` - File should be scanned

#### Used for

- Filtering test fixtures (C:\Windows\System32\SAM, etc.)
- Skipping guardian case files (docs/guardian/cases/**)
- Ignoring telemetry snapshots

---

#### `getGitDiff() → Array<{status, file, oldPath?, renamed?}> | null`
Retrieves git diff for current changes (staged or unstaged).

**Returns:**
- Array of change objects (filtered by ignore patterns)
- Empty array if no changes
- `null` if git command failed (critical error)

**Change Object:**
```javascript
{
  status: 'M' | 'A' | 'D' | 'R100',
  file: 'path/to/file.js',
  oldPath: 'old/path.js',  // Only for renamed files
  renamed: true             // Only for renamed files
}
```

**Fallback Chain:**
1. Try `git diff --cached --name-status` (staged changes)
2. If empty, try `git diff --name-status` (unstaged changes)
3. If error, return `null` (blocks scan)

---

#### `getFileDiff(file: string) → {diff: string, added: number, removed: number}`
Retrieves detailed diff for specific file.

**Parameters:**
- `file` - File path to analyze

**Returns:**
```javascript
{
  diff: 'full diff text',
  added: 10,      // Lines added (excludes +++ headers)
  removed: 5      // Lines removed (excludes --- headers)
}
```

**Error Handling:**
- Logs error to console
- Returns `{diff: '', added: 0, removed: 0}`
- Updates `changesSummary` counters

---

#### `classifyChange(file: string, fileDiff: object) → Classification`
Classifies file change by matching against protected domains.

**Parameters:**
- `file` - File path
- `fileDiff` - Result from `getFileDiff()`

**Returns:**
```javascript
{
  severity: 'CRITICAL' | 'SENSITIVE' | 'SAFE',
  domains: ['pricing', 'quotas'],  // Matched domain names
  file: 'src/services/costControl.js',
  diff: '...',
  added: 10,
  removed: 5
}
```

**Classification Logic:**
1. **File Path Match** - Exact match or glob pattern (using minimatch)
2. **Keyword Match** - Case-insensitive keyword search in diff content
3. **Severity Escalation** - CRITICAL > SENSITIVE > SAFE (highest wins)

**Protected Domains (config/product-guard.yaml):**
- `pricing` - CRITICAL (subscription tiers, billing, Stripe)
- `quotas` - CRITICAL (usage limits, rate limiting)
- `auth_policies` - CRITICAL (RLS, authentication, authorization)
- `ai_models` - SENSITIVE (prompts, model selection)
- `public_contracts` - SENSITIVE (API endpoints, schemas)

---

#### `scan() → number`
Main orchestration method. Runs full Guardian scan workflow.

**Workflow:**
1. Load configuration
2. Get git diff
3. For each changed file:
   - Get file diff
   - Classify change
   - Store in violations
4. Print results
5. Generate audit log
6. Return exit code

**Exit Codes:**
- `0` - SAFE (all changes approved, auto-merge)
- `1` - SENSITIVE (manual review required, Tech Lead approval)
- `2` - CRITICAL (merge blocked, Product Owner approval required)

---

#### `printResults() → void`
Displays scan results in formatted table to console.

**Output:**
```text
╔═══════════════════════════════════════════════════════════════╗
║                  Guardian Scan Results                        ║
╠═══════════════════════════════════════════════════════════════╣
║ Total Files Changed: 3                                        ║
║ Lines Added: 45                                               ║
║ Lines Removed: 12                                             ║
║ Domains Affected: pricing, quotas                             ║
╠═══════════════════════════════════════════════════════════════╣
║ 🔴 CRITICAL: 2 violation(s) - BLOCKED                         ║
║   • src/services/costControl.js (pricing, quotas)            ║
║   • database/schema.sql (pricing, auth_policies)             ║
╚═══════════════════════════════════════════════════════════════╝

❌ CRITICAL VIOLATIONS DETECTED - Merge blocked
   → Required: Product Owner approval
   → See audit log for details
```

---

#### `generateAuditLog() → void`
Creates audit log entry and case file.

**Audit Log:** `docs/guardian/audit-log.md`
- Append-only markdown table
- Columns: Timestamp | Case ID | Actor | Domains | Files | Severity | Action | Notes

**Case File:** `docs/guardian/cases/<case-id>.json`
- JSON format with full scan details
- Case ID format: `YYYY-MM-DD-HH-MM-SS-mmm` (23 chars, includes milliseconds)
- Actor detection: `GITHUB_ACTOR` → `USER` → `USERNAME` → `unknown`

**Case File Schema:**
```json
{
  "case_id": "2025-10-09-14-30-25-123",
  "timestamp": "2025-10-09T14:30:25.123Z",
  "actor": "github-actions",
  "domains": ["pricing", "quotas"],
  "files_changed": ["src/services/costControl.js"],
  "severity": "CRITICAL",
  "action": "BLOCKED",
  "violations": {
    "critical": 1,
    "sensitive": 0,
    "safe": 0
  },
  "details": [...],
  "approval_required": true,
  "approved_by": null,
  "notes": "Requires Product Owner approval"
}
```

**Notification Trigger:**
- CRITICAL or SENSITIVE cases call `sendNotification(caseId)`
- Executes `scripts/notify-guardian.js` (Phase 17)
- Gracefully handles notification failures (non-blocking)

---

#### `sendNotification(caseId: string) → void`
Sends notification for CRITICAL/SENSITIVE cases (Phase 17 integration).

**Parameters:**
- `caseId` - Case identifier from audit log

**Behavior:**
- Spawns `node scripts/notify-guardian.js --case-id=<caseId>`
- Logs success or failure
- Non-blocking (scan continues even if notification fails)

---

#### `generateReport() → void`
Generates markdown report for scan results.

**Output File:** `docs/guardian/guardian-report.md`

**Report Structure:**
- Summary (files, lines, domains)
- Violations by severity (🔴 Critical, 🟡 Sensitive, 🟢 Safe)
- Recommendation (BLOCK | MANUAL REVIEW | APPROVE)

---

## Implementation Notes

### Glob Pattern Matching (Issue: CodeRabbit #3319715250 - M1)

Guardian uses **minimatch** for robust glob pattern matching:

**Supported Patterns:**
- Wildcards: `*.md` (all markdown files)
- Recursive: `**/*.yaml` (all YAML files in subdirectories)
- Exact paths: `src/services/costControl.js`

**Matching Logic:**
```javascript
const hasGlobChars = /[*?[\]{}]/.test(pattern);

if (hasGlobChars) {
  // Use minimatch for glob patterns
  if (minimatch(file, pattern, { matchBase: true, dot: true })) {
    matched = true;
  }
} else {
  // Use exact match for literal paths
  if (file === pattern || file.endsWith('/' + pattern)) {
    matched = true;
  }
}
```

**Case Sensitivity:** Matching is case-sensitive (aligns with Git on Unix/Linux). The `nocase: true` option was removed in CodeRabbit review #3319862956 to prevent cross-platform inconsistencies.

---

### Renamed File Detection (Issue: CodeRabbit #3319715250 - MN1)

Git status for renamed files: `R100\told-file.js\tnew-file.js`

**Parsing Logic:**
```javascript
if (status.startsWith('R')) {
  const oldFile = fileParts[0];
  const newFile = fileParts[1] || oldFile;
  return {
    status,
    file: newFile,       // Use new path for classification
    oldPath: oldFile,
    renamed: true
  };
}
```

**Rationale:** Prevents double-counting renames as deletion + addition.

---

### Line Counting Accuracy (Issue: CodeRabbit #3319715250 - M2)

Diff headers (`+++`, `---`) are excluded from line counts:

```javascript
const added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
const removed = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
```

**Why:** `+++ b/file.js` is metadata, not an actual added line.

---

### Actor Detection (Issue: CodeRabbit #3319715250 - N2)

Multi-source fallback chain for cross-platform compatibility:

```javascript
const actor = process.env.GITHUB_ACTOR ||    // CI/CD (GitHub Actions)
              process.env.USER ||              // Unix/Linux/macOS
              process.env.USERNAME ||          // Windows
              'unknown';
```

---

### Case ID Collision Prevention (Issue: CodeRabbit #3319715250 - N1)

Case IDs include milliseconds (23 characters):

**Format:** `YYYY-MM-DD-HH-MM-SS-mmm`
**Example:** `2025-10-09-14-30-25-123`

```javascript
const caseId = timestamp.replace(/[:.]/g, '-').split('T').join('-').substring(0, 23);
```

**Rationale:** Prevents collisions in rapid successive scans (e.g., CI/CD parallel jobs).

---

### Ignore Patterns (Issue: Windows Test Fixtures)

**Problem:** Security tests create Windows malicious paths (`C:\Windows\System32\config\SAM`) as test vectors, causing false positives.

**Solution:** `config/guardian-ignore.yaml` with 9 ignore patterns:
- Windows system paths: `**/C:\\Windows\\**`, `**/*.SAM`, `**/System32/**`
- Test artifacts: `**/docs/guardian/cases/**`, `**/telemetry/snapshots/**`
- Temporary files: `**/*.tmp`, `**/tmp/**`

**Integration:** Guardian loads ignore patterns at startup and filters files in `getGitDiff()`.

---

### Error Handling Philosophy

**Graceful Degradation:**
- Configuration load failure → exit code 2 (block merge)
- Git command failure → return `null`, exit code 2
- File diff failure → log error, return empty diff, continue scan
- Notification failure → log warning, continue scan (non-blocking)

**Logging:**
- ✅ Success markers (green checkmarks)
- ❌ Critical errors (red X)
- ⚠️  Warnings (yellow triangle)
- ℹ️  Info messages (blue info)

---

## Testing

### Test File
`tests/unit/scripts/guardian-gdd.test.js` (361 lines)

### Test Coverage
**Target:** 80%+ (GDD standard for governance nodes)
**Actual:** TBD (pending `npm test -- --coverage`)

### Test Structure

#### 1. M1: Unstaged Changes Detection (lines 46-100)

- 4 tests covering fallback from staged → unstaged changes
- Validates detection when `git diff --cached` returns empty
- Tests error handling (git not installed)

#### 2. M2: Line Counting (lines 106-182)

- 4 tests excluding `+++` and `---` headers from counts
- Validates mixed additions/removals
- Tests empty diffs

#### 3. C4: Directory Creation (lines 188-294)

- 4 tests ensuring `fs.mkdirSync({ recursive: true })` before writes
- Validates audit log, cases, and report directory creation
- Tests graceful handling of existing directories

#### 4. N2: Actor Detection (lines 362-428)

- 4 tests covering fallback chain: GITHUB_ACTOR → USER → USERNAME → unknown
- Validates CI environment detection

#### 5. N1: Case ID Milliseconds (lines 459-525)

- 3 tests ensuring 23-character format with milliseconds
- Validates collision prevention in rapid scans

#### 6. MN1: Renamed Files Parsing (lines 544-617)

- 4 tests parsing Git status 'R' with old/new paths
- Validates double-counting prevention

#### 7. M1: Glob Pattern Matching (lines 619-678)

- 3 tests for wildcard patterns (`docs/nodes/*.md`)
- Validates exact path matching
- Tests false positive prevention (`my-docs/nodes` ≠ `docs/nodes`)

#### 8. Integration Tests (lines 300-360)

- Complete workflow test combining all fixes
- Validates M1 (unstaged detection) + M2 (line counting) + C4 (directory creation)

### Test Execution
```bash
# Run Guardian tests only
npm test tests/unit/scripts/guardian-gdd.test.js

# Run with coverage
npm test -- --coverage tests/unit/scripts/guardian-gdd.test.js

# Run all tests
npm test
```

### Mocking Strategy
- `child_process.execSync` - Mocked for git commands
- `fs.mkdirSync` - Spied to verify directory creation
- `fs.appendFileSync` - Spied to verify audit log writes
- `Date` - Mocked for case ID collision tests

---

## Configuration

### Product Guard Config (`config/product-guard.yaml`)

**Structure:**
```yaml
version: "1.0"
last_updated: "2025-10-09"

domains:
  pricing:
    owner: "Product Owner"
    protection_level: CRITICAL
    files: [...]
    keywords: [...]
    impact_areas: [...]
```

**5 Protected Domains:**
1. **pricing** (CRITICAL) - Subscription tiers, billing, Stripe
2. **quotas** (CRITICAL) - Usage limits, rate limiting
3. **auth_policies** (CRITICAL) - RLS, authentication, authorization
4. **ai_models** (SENSITIVE) - Prompts, model selection, OpenAI config
5. **public_contracts** (SENSITIVE) - API endpoints, webhooks, schemas

**Classification Rules:**
- `critical_triggers` - Blocks merge immediately
- `sensitive_triggers` - Requires manual review
- `safe_patterns` - Auto-approved

**Approval Workflow:**
- CRITICAL: 3 approvers (Product Owner + Tech Lead + Backend Dev), 48h SLA
- SENSITIVE: 2 approvers (Tech Lead + Domain Owner), 24h SLA
- SAFE: 0 approvers (auto-approve)

**Alert Channels:**
- CRITICAL: GitHub issue + email + Slack #critical-alerts
- SENSITIVE: GitHub issue + Slack #dev-alerts
- SAFE: Log only

---

### Guardian Ignore Config (`config/guardian-ignore.yaml`)

**Structure:**
```yaml
version: "1.0"
description: "Guardian ignore patterns for test fixtures and false positives"

ignore_patterns:
  - "**/C:\\Windows\\**"
  - "**/System32/**"
  - "**/.gdd-backups/**"
  - "**/docs/guardian/cases/**"
  - "**/*.tmp"

blocked_windows_paths:
  - "C:\\Windows\\System32\\config\\SAM"
  - "C:\\Windows\\System32\\drivers\\etc\\hosts"
```

**Purpose:**
- Prevent scanning test fixtures (security test vectors)
- Exclude Guardian's own output (case files, diffs)
- Filter temporary files and build artifacts

---

## CLI Usage

### Basic Commands
```bash
# Full system scan (default)
node scripts/guardian-gdd.js --full

# Quick validation
node scripts/guardian-gdd.js --check

# Generate markdown report
node scripts/guardian-gdd.js --report

# CI mode (semantic exit codes)
node scripts/guardian-gdd.js --ci

# Help
node scripts/guardian-gdd.js --help
```

### CI/CD Integration

✅ **Production Ready** - Guardian automatically runs on all PRs to main/develop branches.

**Workflow:** `.github/workflows/guardian-check.yml`

**Triggers:**
- Pull requests (opened, synchronize, reopened)
- Targets: `main`, `develop` branches

**Behavior:**
```yaml
# Exit codes determine workflow outcome:
# 0 = SAFE      → Auto-merge allowed, no review needed
# 1 = SENSITIVE → Tech Lead approval required
# 2 = CRITICAL  → Merge blocked, Product Owner approval required
```

**On Violation Detection:**
1. Workflow fails (exit code 1 or 2)
2. Uploads audit logs as GitHub artifacts (30 days retention)
3. Posts PR comment with Guardian report
4. Requires manual approval before merge

**Manual Override:**
```bash
# Run Guardian locally before pushing
node scripts/guardian-gdd.js --check

# CI mode (used in GitHub Actions)
node scripts/guardian-gdd.js --ci
```

**Dependencies:**
- `minimatch@^10.0.3` - Pattern matching for protected domains
- `yaml@^2.8.1` - Configuration file parsing

### Pre-commit Hook (Phase 17)
```bash
# .husky/pre-commit
npm run guardian:check
```

---

## Completion Validation (NEW - Phase 19)

Guardian now includes **automated PR completion validation** to ensure NO PR is merged until it's 100% complete. This prevents half-finished features from reaching main.

### Validation Checks (7 automated)

1. **Acceptance Criteria** - Parses issue body, validates all checkboxes marked `[x]`
2. **Test Coverage** - Requires ≥90% average (lines, statements, functions, branches)
3. **Tests Passing** - `npm test` must exit with code 0
4. **Agent Receipts** - Validates all required agents have receipts (from `agents/manifest.yaml`)
5. **Documentation** - GDD nodes valid, test evidence present
6. **CodeRabbit** - 0 unresolved comments
7. **CI/CD** - All checks passing, none pending

### Exit Codes

- `0` - 100% complete, ready to merge
- `1` - Incomplete, continue implementation
- `2` - Critical issues (failing tests/CI), do NOT merge

### CLI Usage

```bash
# Manual validation (run before requesting merge)
npm run validate:completion -- --pr=628

# With custom coverage threshold
npm run validate:completion -- --pr=628 --threshold=95

# Direct script invocation
node scripts/ci/validate-completion.js --pr=628
```

### CI Integration

**Workflow:** `.github/workflows/pre-merge-validation.yml`

**Triggers:**
- Label: `ready-to-merge` or `validate-completion`
- Workflow dispatch (manual trigger)

**Behavior:**
- Runs all 7 validation checks
- Posts PR comment with results
- Blocks merge if validation fails (exit 1 or 2)
- Uploads coverage report as artifact (7 days retention)

### Test File

`tests/unit/scripts/validate-completion.test.js` (269 lines, 18 tests)

**Test Coverage:**
- Script execution and exit codes
- CLI output format and colored text
- Error handling (invalid PR, missing coverage, GitHub CLI failures)
- NPM integration (`validate:completion` script)
- Documentation compliance (CLAUDE.md, completion-validation.md, workflow file)

### Related Documentation

- **Policy:** `docs/policies/completion-validation.md` (comprehensive guide)
- **CLI Script:** `scripts/ci/validate-completion.js` (500 lines)
- **CI Workflow:** `.github/workflows/pre-merge-validation.yml`
- **Agent Manifest:** `agents/manifest.yaml` (Guardian capabilities section)

---

## TODOs

### Phase 17: Guardian Notifications & Workflows
- [ ] Implement `scripts/notify-guardian.js` for email/Slack notifications (#516)
- [x] Create `.github/workflows/guardian-check.yml` for PR validation (#517) ✅ **COMPLETED** (CodeRabbit #3387536267)
- [ ] Add Husky pre-commit hook integration (#518)
- [x] Create PR comment bot with scan results (#519) ✅ **COMPLETED** (included in workflow)

### Phase 18: Guardian Dashboard
- [ ] Build web UI for audit log visualization (#520)
- [ ] Add approval workflow management interface (#521)
- [ ] Create domain ownership directory (#522)

### Future Enhancements
- [ ] Support multiple configuration profiles (dev, staging, prod)
- [ ] Add machine learning for anomaly detection (unusual change patterns)
- [ ] Integrate with Slack for real-time approval requests
- [ ] Create Guardian CLI with interactive mode

---

## Related Documentation

- **Implementation Plan:** `docs/plan/review-3319715250.md` (CodeRabbit fixes)
- **Implementation Plan:** `docs/plan/review-3319862956.md` (Case sensitivity & logging)
- **Product Guard Config:** `config/product-guard.yaml`
- **Guardian Ignore Config:** `config/guardian-ignore.yaml`
- **Audit Log:** `docs/guardian/audit-log.md`
- **Test Suite:** `tests/unit/scripts/guardian-gdd.test.js`
- **Completion Validation Policy:** `docs/policies/completion-validation.md` (Phase 19)
- **Completion Validation Script:** `scripts/ci/validate-completion.js`
- **Completion Validation Tests:** `tests/unit/scripts/validate-completion.test.js`

---

## Agentes Relevantes

- **Documentation Agent** - Maintains Guardian node documentation, ensures spec.md Guardian section remains synchronized
- **Orchestrator Agent** - Coordinates Guardian integration into CI/CD pipelines, manages approval workflows, implements completion validation system (Phase 19)
- **Product Owner** - Reviews and approves CRITICAL violations affecting pricing, quotas, and auth policies
- **Test Engineer** - Created 14 unit tests for Guardian methods (Phase 16), 18 integration tests for completion validation (Phase 19), validated fixes from CodeRabbit reviews

---

**Coverage:** 0%
**Coverage Source:** auto
**Note:** Coverage is 0% for scripts/config files which are not imported in Jest coverage
**Health Score:** TBD (pending first validation run with coverage)
**Drift Risk:** 0 (newly created node)

---

*Last Validated:* 2025-10-23
*Node Created:* 2025-10-09 (GDD 2.0 Phase 16)
*Node Updated:* 2025-10-23 (Phase 19 - Completion Validation)
*Owner:* Product Owner (governance layer)
