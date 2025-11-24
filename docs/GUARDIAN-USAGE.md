# Guardian GDD - Usage Guide

**Version:** 1.0
**Last Updated:** 2025-11-07
**Issue:** #716

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [CI/CD Integration](#cicd-integration)
6. [Case Management](#case-management)
7. [Reporting](#reporting)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [API Reference](#api-reference)

---

## Overview

**Guardian GDD** is a product governance layer that monitors sensitive changes in the codebase and ensures compliance with business policies. It classifies changes by severity (CRITICAL, SENSITIVE, SAFE) and enforces review workflows before changes reach production.

### Key Features

- **Automated Change Detection**: Scans git diffs (staged + unstaged) for policy violations
- **Severity Classification**: CRITICAL > SENSITIVE > SAFE hierarchy
- **Case Deduplication**: SHA-256 hashing prevents duplicate alerts
- **Audit Logging**: Complete traceability for compliance
- **CI/CD Integration**: Blocks deployments with exit codes (0/1/2)
- **Multi-Domain Protection**: Pricing, AI models, auth, quotas, RLS policies

### When to Use Guardian

✅ **Use Guardian for:**

- Pricing changes (subscription tiers, billing logic)
- AI model updates (gpt-4 → gpt-4-turbo, temperature changes)
- Authentication/authorization changes (RLS policies, JWT logic)
- Quota/rate limit modifications
- Database schema changes affecting billing

❌ **Don't Use Guardian for:**

- Documentation updates (unless pricing/legal docs)
- UI/UX changes (unless payment forms)
- Test files
- Dependency updates (unless AI libraries)

---

## Installation

Guardian is already installed as part of the Roastr monorepo. No additional setup required.

### Prerequisites

- Node.js ≥ 18.x
- Git repository
- YAML config file (`config/product-guard.yaml`)

### Verify Installation

```bash
node scripts/guardian-gdd.js --help
```

Expected output:

```text
Guardian GDD - Product Governance Layer

Usage: node scripts/guardian-gdd.js [options]

Options:
  --full         Full scan with report generation
  --check        Check mode (no case generation)
  --report       Generate report only
  --ci           CI mode (strict exit codes)
  --help, -h     Show this help message

Exit Codes:
  0 = SAFE       All changes are safe
  1 = SENSITIVE  Sensitive changes detected (require review)
  2 = CRITICAL   Critical changes detected (block and review)
```

---

## Configuration

Guardian uses two YAML configuration files:

### 1. Product Guard Config (`config/product-guard.yaml`)

Defines protected domains with severity levels.

```yaml
version: '1.0'
description: 'Roastr Product Governance Configuration'

domains:
  pricing:
    files:
      - 'docs/nodes/plan-features.md'
      - 'src/billing/**'
      - 'database/migrations/*subscription*'
    protection_level: CRITICAL
    keywords:
      - 'tier'
      - 'subscription'
      - 'price'
      - 'billing'
      - 'payment'
    reviewers:
      - '@product-owner'
      - '@finance-lead'
    action: BLOCK_AND_REVIEW

  ai_models:
    files:
      - 'src/services/roastGeneratorEnhanced.js'
      - 'src/services/roastPromptTemplate.js'
      - 'src/config/ai-models.js'
    protection_level: SENSITIVE
    keywords:
      - 'gpt-4'
      - 'model'
      - 'temperature'
      - 'max_tokens'
      - 'top_p'
    reviewers:
      - '@ai-lead'
      - '@cto'
    action: REQUIRE_REVIEW

  auth_policies:
    files:
      - 'database/policies/**'
      - 'src/middleware/auth.js'
      - 'src/services/authService.js'
    protection_level: CRITICAL
    keywords:
      - 'RLS'
      - 'policy'
      - 'authentication'
      - 'authorization'
      - 'JWT'
      - 'session'
    reviewers:
      - '@security-lead'
      - '@backend-lead'
    action: BLOCK_AND_REVIEW

  quotas:
    files:
      - 'docs/nodes/plan-features.md'
      - 'src/services/costControl.js'
      - 'src/middleware/rateLimiter.js'
    protection_level: SENSITIVE
    keywords:
      - 'quota'
      - 'limit'
      - 'rate'
      - 'threshold'
    reviewers:
      - '@product-owner'
    action: REQUIRE_REVIEW
```

### 2. Ignore Patterns (`config/guardian-ignore.yaml`)

Files to exclude from Guardian scans.

```yaml
version: '1.0'
description: 'Guardian Ignore Patterns'

ignore_patterns:
  # Tests
  - '**/*.test.js'
  - '**/*.spec.js'
  - 'tests/**'

  # Documentation (non-pricing)
  - 'docs/guides/**'
  - 'docs/tutorials/**'
  - '**/README.md'

  # Build artifacts
  - 'node_modules/**'
  - 'dist/**'
  - '.next/**'

  # Git
  - '.git/**'
  - '.github/workflows/**'

  # Temporary files
  - '**/*.tmp'
  - '**/.DS_Store'
```

### Configuration Best Practices

1. **Granular File Patterns**: Use specific paths instead of wildcards
   - ✅ Good: `src/billing/subscriptionManager.js`
   - ❌ Bad: `src/**/*.js`

2. **Keyword Precision**: Include variations and synonyms
   - Example: `["tier", "plan", "subscription", "billing"]`

3. **Reviewer Assignment**: Tag by role, not individuals
   - ✅ Good: `@product-owner`, `@security-lead`
   - ❌ Bad: `@john-doe`

4. **Action Clarity**: Use `BLOCK_AND_REVIEW` for CRITICAL, `REQUIRE_REVIEW` for SENSITIVE

---

## Usage

### Basic Usage

#### 1. Full Scan (Development)

Scans all changes, generates cases, and creates reports.

```bash
node scripts/guardian-gdd.js --full
```

**Output:**

```text
🛡️  Guardian GDD - Full Scan

Scanning changes...
├─ docs/nodes/plan-features.md (staged)
├─ src/billing/subscriptionManager.js (unstaged)
└─ src/services/roastGeneratorEnhanced.js (staged)

Classifying changes...
├─ 🚨 CRITICAL: docs/nodes/plan-features.md (pricing)
├─ 🚨 CRITICAL: src/billing/subscriptionManager.js (pricing)
└─ ⚠️  SENSITIVE: src/services/roastGeneratorEnhanced.js (ai_models)

Generating cases...
├─ Case a1b2c3d4e5f6g7h8 created (CRITICAL)
└─ Case i9j0k1l2m3n4o5p6 created (SENSITIVE)

Report generated: docs/guardian/reports/scan-2025-11-07.md
Audit log: docs/guardian/audit/2025-11-07.log

Exit code: 2 (CRITICAL changes detected)
```

#### 2. Check Mode (Pre-Commit)

Validates changes without generating cases (dry-run).

```bash
node scripts/guardian-gdd.js --check
```

**Use case:** Pre-commit hooks, quick validation

**Output:**

```text
🛡️  Guardian GDD - Check Mode

Scanning changes...
└─ docs/nodes/plan-features.md (staged)

Classification: 🚨 CRITICAL (pricing)

⚠️  CRITICAL changes detected. Run --full to generate case.

Exit code: 2
```

#### 3. Report Only

Generates a report from existing cases without scanning.

```bash
node scripts/guardian-gdd.js --report
```

**Use case:** Weekly summaries, compliance audits

#### 4. CI Mode

Strict mode for CI/CD pipelines with enforced exit codes.

```bash
node scripts/guardian-gdd.js --ci
```

**Behavior:**

- Exit 0: All changes SAFE → Deploy
- Exit 1: SENSITIVE detected → Require review → Deploy after approval
- Exit 2: CRITICAL detected → Block deployment → Require review + manual approval

---

## CI/CD Integration

### GitHub Actions

Add Guardian to your PR workflow:

```yaml
# .github/workflows/guardian-check.yml
name: Guardian GDD Check

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  guardian:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # Full history for diff

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run Guardian Check
        id: guardian
        run: |
          node scripts/guardian-gdd.js --ci
        continue-on-error: true

      - name: Handle CRITICAL
        if: steps.guardian.outcome == 'failure' && steps.guardian.outputs.exit_code == '2'
        run: |
          echo "🚨 CRITICAL changes detected"
          echo "Blocking deployment until review"
          exit 1

      - name: Handle SENSITIVE
        if: steps.guardian.outcome == 'failure' && steps.guardian.outputs.exit_code == '1'
        run: |
          echo "⚠️  SENSITIVE changes detected"
          echo "Requires review before merge"
          # Create review request
          gh pr review ${{ github.event.pull_request.number }} --request-changes \
            --body "Guardian detected SENSITIVE changes. Review required."

      - name: Upload Guardian Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: guardian-report
          path: docs/guardian/reports/*.md
```

### Pre-Commit Hook

Add Guardian to your pre-commit workflow:

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run Guardian check
node scripts/guardian-gdd.js --check

EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "🚨 CRITICAL changes detected. Run 'node scripts/guardian-gdd.js --full' to generate case."
  exit 1
elif [ $EXIT_CODE -eq 1 ]; then
  echo "⚠️  SENSITIVE changes detected. Review required."
  exit 1
fi

exit 0
```

### Pre-Push Hook

Enforce Guardian on push:

```bash
# .husky/pre-push
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run full Guardian scan
node scripts/guardian-gdd.js --full

EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "🚨 CRITICAL changes detected. Push blocked."
  echo "Review required before push."
  exit 1
fi

exit 0
```

---

## Case Management

### Case Structure

Each case is stored as JSON in `docs/guardian/cases/`:

```json
{
  "case_key": "a1b2c3d4e5f6g7h8",
  "severity": "CRITICAL",
  "domains": ["pricing"],
  "files": ["docs/nodes/plan-features.md"],
  "diff": "+| Pro | $49/month | 1000 roasts/month |",
  "action": "BLOCK_AND_REVIEW",
  "reviewers": ["@product-owner", "@finance-lead"],
  "created_at": "2025-11-07T14:32:00Z",
  "last_detected_at": "2025-11-07T14:32:00Z",
  "status": "PENDING",
  "notes": ""
}
```

### Case Deduplication

Guardian uses SHA-256 hashing to deduplicate cases:

```javascript
const caseKey = crypto
  .createHash('sha256')
  .update(JSON.stringify({ files, severity, action, domains }))
  .digest('hex')
  .substring(0, 16);
```

**Behavior:**

- Same files + severity + domains → Same case key
- Case file updated with `last_detected_at`
- No duplicate alerts

### Case Lifecycle

1. **PENDING**: Case created, awaiting review
2. **UNDER_REVIEW**: Reviewer assigned, reviewing changes
3. **APPROVED**: Changes approved, safe to deploy
4. **REJECTED**: Changes rejected, requires fix
5. **CLOSED**: Case resolved

### Managing Cases

#### List All Cases

```bash
ls -lh docs/guardian/cases/
```

#### View Case Details

```bash
cat docs/guardian/cases/a1b2c3d4e5f6g7h8.json | jq
```

#### Close Case

```bash
# Manually update status
jq '.status = "CLOSED"' docs/guardian/cases/a1b2c3d4e5f6g7h8.json > tmp.json
mv tmp.json docs/guardian/cases/a1b2c3d4e5f6g7h8.json
```

#### Bulk Close Cases

```bash
# Close all APPROVED cases older than 30 days
find docs/guardian/cases -name "*.json" -mtime +30 -exec \
  jq 'if .status == "APPROVED" then .status = "CLOSED" else . end' {} \;
```

---

## Reporting

### Report Structure

Reports are generated in Markdown format at `docs/guardian/reports/`:

````markdown
# Guardian GDD Report

**Date:** 2025-11-07
**Scan Type:** Full
**Exit Code:** 2 (CRITICAL)

---

## Summary

- **Total Changes:** 3
- **CRITICAL:** 2
- **SENSITIVE:** 1
- **SAFE:** 0

---

## Cases

### 🚨 Case a1b2c3d4e5f6g7h8 (CRITICAL)

**Severity:** CRITICAL
**Domains:** pricing
**Files:**

- `docs/nodes/plan-features.md`
- `src/billing/subscriptionManager.js`

**Diff:**

```diff
+| Pro | $49/month | 1000 roasts/month |
-| Pro | $29/month | 1000 roasts/month |
```
````

**Action:** BLOCK_AND_REVIEW
**Reviewers:** @product-owner, @finance-lead

**Recommendation:** Block deployment until pricing change is reviewed and approved by Product Owner and Finance Lead.

---

### ⚠️ Case i9j0k1l2m3n4o5p6 (SENSITIVE)

**Severity:** SENSITIVE
**Domains:** ai_models
**Files:**

- `src/services/roastGeneratorEnhanced.js`

**Diff:**

```diff
+model: 'gpt-4-turbo'
-model: 'gpt-4'
```

**Action:** REQUIRE_REVIEW
**Reviewers:** @ai-lead, @cto

**Recommendation:** Review AI model change for cost and quality impact.

---

## Actions Required

1. **CRITICAL (2)**: Block deployment, manual review required
2. **SENSITIVE (1)**: Review before merge

**Next Steps:**

1. Notify reviewers: @product-owner, @finance-lead, @ai-lead, @cto
2. Schedule review meeting if needed
3. Update case status after review
4. Re-run Guardian after fixes

```

### Audit Logs

Audit logs are stored at `docs/guardian/audit/`:

```

[2025-11-07T14:32:00Z] CRITICAL | Case a1b2c3d4e5f6g7h8 | pricing | docs/nodes/plan-features.md
[2025-11-07T14:32:00Z] SENSITIVE | Case i9j0k1l2m3n4o5p6 | ai_models | src/services/roastGeneratorEnhanced.js

```

---

## Troubleshooting

### Common Issues

#### 1. "Config file not found"

**Error:**
```

Error: ENOENT: no such file or directory, open 'config/product-guard.yaml'

````

**Solution:**
```bash
# Verify config exists
ls -l config/product-guard.yaml

# If missing, copy from template
cp config/product-guard.template.yaml config/product-guard.yaml
````

#### 2. "Not a git repository"

**Error:**

```
fatal: not a git repository (or any of the parent directories): .git
```

**Solution:**

```bash
# Initialize git if needed
git init

# Or run Guardian from repo root
cd /path/to/roastr-ai
node scripts/guardian-gdd.js --check
```

#### 3. False Positives

**Problem:** Guardian flags safe changes as CRITICAL/SENSITIVE

**Solution:**

1. Add to ignore patterns in `config/guardian-ignore.yaml`
2. Refine keywords in `config/product-guard.yaml`
3. Use more specific file patterns

**Example:**

```yaml
# Before (too broad)
pricing:
  files: ["src/**"]
  keywords: ["price"]

# After (specific)
pricing:
  files: ["src/billing/subscriptionManager.js"]
  keywords: ["subscriptionPrice", "tier_price"]
```

#### 4. No Changes Detected

**Problem:** Guardian shows "No changes detected" despite staged files

**Solution:**

```bash
# Verify git status
git status

# Verify staged files
git diff --cached --name-only

# Check ignore patterns
cat config/guardian-ignore.yaml
```

#### 5. Exit Code Always 0

**Problem:** Guardian always exits 0 even with CRITICAL changes

**Solution:**

```bash
# Check configuration
node scripts/guardian-gdd.js --full --verbose

# Verify domain config
cat config/product-guard.yaml

# Test with known CRITICAL file
git add docs/nodes/plan-features.md
node scripts/guardian-gdd.js --check
```

---

## Best Practices

### 1. Configuration Management

- **Version Control**: Commit `product-guard.yaml` and `guardian-ignore.yaml`
- **Regular Reviews**: Review config quarterly, update patterns as codebase evolves
- **Team Input**: Involve Product, Engineering, and Finance in config decisions

### 2. Workflow Integration

- **Pre-Commit**: Use `--check` for fast validation
- **Pre-Push**: Use `--full` to generate cases before push
- **CI/CD**: Use `--ci` for strict enforcement in pipelines
- **Weekly Reports**: Generate `--report` for team visibility

### 3. Case Management

- **Timely Reviews**: Review cases within 24 hours
- **Clear Notes**: Add context to case files for future reference
- **Status Updates**: Keep case status current (PENDING → UNDER_REVIEW → APPROVED)
- **Archive Old Cases**: Close cases older than 90 days

### 4. Team Communication

- **Slack Notifications**: Integrate Guardian with Slack for real-time alerts
- **Review Meetings**: Schedule weekly Guardian review sessions
- **Escalation Path**: Define escalation for urgent CRITICAL changes
- **Documentation**: Keep this guide updated with new patterns

### 5. Performance Optimization

- **Ignore Patterns**: Exclude large files/directories (node_modules, dist)
- **Targeted Scans**: Scan only modified files, not entire codebase
- **Caching**: Cache case keys to speed up deduplication
- **Parallel Processing**: Process multiple files in parallel (future enhancement)

---

## API Reference

### Guardian Class

```javascript
const GuardianGDD = require('./scripts/guardian-gdd');

const guardian = new GuardianGDD({
  configPath: 'config/product-guard.yaml',
  ignorePath: 'config/guardian-ignore.yaml',
  casesDir: 'docs/guardian/cases',
  reportPath: 'docs/guardian/reports/scan.md',
  auditPath: 'docs/guardian/audit/scan.log'
});
```

### Methods

#### `loadConfig()`

Loads configuration from YAML files.

```javascript
guardian.loadConfig();
// Returns: { domains: {...}, ignore_patterns: [...] }
```

#### `getGitDiff()`

Fetches git diffs for staged and unstaged changes.

```javascript
const diffs = guardian.getGitDiff();
// Returns: { 'file.js': { diff: '...', added: 5, removed: 2 } }
```

#### `shouldIgnoreFile(filePath)`

Checks if file matches ignore patterns.

```javascript
const shouldIgnore = guardian.shouldIgnoreFile('node_modules/package.json');
// Returns: true
```

#### `classifyChange(file, fileDiff)`

Classifies change by severity.

```javascript
const classification = guardian.classifyChange('docs/nodes/plan-features.md', {
  diff: '+tier: pro',
  added: 1,
  removed: 0
});
// Returns: { severity: 'CRITICAL', domains: ['pricing'], ... }
```

#### `generateCaseKey(files, severity, action, domains)`

Generates deterministic case key using SHA-256.

```javascript
const caseKey = guardian.generateCaseKey(
  ['docs/nodes/plan-features.md'],
  'CRITICAL',
  'BLOCK_AND_REVIEW',
  ['pricing']
);
// Returns: 'a1b2c3d4e5f6g7h8'
```

#### `caseExists(caseKey)`

Checks if case already exists.

```javascript
const exists = guardian.caseExists('a1b2c3d4e5f6g7h8');
// Returns: true
```

#### `scan()`

Runs full Guardian scan.

```javascript
const result = guardian.scan();
// Returns: { exitCode: 2, cases: [...], report: '...' }
```

#### `generateReport(cases)`

Generates markdown report.

```javascript
const report = guardian.generateReport([...cases]);
// Returns: '# Guardian GDD Report\n...'
```

#### `generateAuditLog(cases)`

Generates audit log.

```javascript
guardian.generateAuditLog([...cases]);
// Writes to: docs/guardian/audit/scan.log
```

---

## Exit Codes

| Code  | Severity  | Meaning                    | CI Action           |
| ----- | --------- | -------------------------- | ------------------- |
| **0** | SAFE      | All changes safe           | ✅ Deploy           |
| **1** | SENSITIVE | Sensitive changes detected | ⚠️ Require review   |
| **2** | CRITICAL  | Critical changes detected  | 🚨 Block deployment |

---

## Support

**Issues:** [GitHub Issues](https://github.com/Eibon7/roastr-ai/issues)
**Documentation:** `docs/nodes/guardian.md`
**Contact:** @guardian-lead

---

**Last Updated:** 2025-11-07 | **Issue #716** | **Version 1.0**
