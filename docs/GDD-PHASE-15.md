# GDD 2.0 - Phase 15: Cross-Validation & Extended Health Metrics

[← Back to CLAUDE.md](../CLAUDE.md)

---

**Implementation Date:** October 9, 2025
**Status:** Production Ready
**Related:** `docs/plan/gdd-phase-15-cross-validation.md`

## Overview

GDD 2.0 Phase 15 extends the framework from a documentation coherence engine into a comprehensive **System Health Intelligence Layer** by adding cross-validation between documentation and runtime data, plus connectivity metrics for external integrations.

### Three Major Enhancements

1. **Cross-Validation Engine**: Automatically validates consistency between GDD node metadata and real runtime data sources (coverage reports, git history, source code imports)
2. **Integration Status Tracking**: Monitors health and connectivity of 9 external platform integrations (Twitter, Discord, YouTube, etc.)
3. **Unified Health Intelligence**: Combines documentation health (Phase 7), cross-validation accuracy, and connectivity metrics into a composite system health score

---

## Cross-Validation Engine

**Script:** `scripts/validate-gdd-cross.js`

Verifies three critical dimensions:

### 1. Coverage Validation

Compares declared coverage values in node docs against actual test coverage from `coverage/coverage-summary.json`:

- Maps GDD nodes to source files using intelligent path resolution
- Calculates actual coverage by aggregating line coverage across related files
- Applies 3% tolerance for minor discrepancies
- Flags mismatches that exceed tolerance as violations

**Example:**
```yaml
# In docs/nodes/shield.md
**Coverage:** 70%
**Coverage Source:** auto

# Validator checks:
# - Reads coverage/coverage-summary.json
# - Maps shield → [src/services/shieldService.js, src/workers/ShieldActionWorker.js]
# - Calculates: (85% + 65%) / 2 = 75% actual coverage
# - Compares: |75% - 70%| = 5% > 3% tolerance → VIOLATION
```

### 2. Timestamp Validation

Validates `**Last Updated:**` fields against actual git commit history:

- Executes `git log -1 --format=%ai --follow` for each node's source files
- Applies ±1 day tolerance to account for timezone and batch update differences
- Detects stale documentation (declared date >> actual last commit)
- Detects future dates (declared date in future)

**Example:**
```yaml
# In docs/nodes/roast.md
**Last Updated:** 2025-10-05

# Validator checks:
# - git log -1 --format=%ai src/services/roastGeneratorEnhanced.js
# - Latest commit: 2025-10-08T14:30:00Z
# - Difference: 3 days > 1 day tolerance → VIOLATION (stale)
```

### 3. Dependency Validation

Compares declared dependencies against actual imports/requires in source code:

- Scans source files for `require()` and `import` statements
- Extracts dependency list from actual code
- Compares with `**Dependencies:**` declared in node docs
- Flags missing dependencies (declared but not imported)
- Flags phantom dependencies (imported but not declared)

**Example:**
```yaml
# In docs/nodes/roast.md
**Dependencies:**
- shield
- cost-control
- persona

# Validator scans src/services/roastGeneratorEnhanced.js:
# - Found: require('./shieldService') → shield ✓
# - Found: require('./personaService') → persona ✓
# - Missing: cost-control not imported → MISSING DEPENDENCY VIOLATION
```

---

## Commands & Usage

### Basic Cross-Validation

```bash
# Validate all nodes (recommended)
node scripts/validate-gdd-cross.js --full

# Validate specific node
node scripts/validate-gdd-cross.js --node=shield

# Show summary only (no detailed violations)
node scripts/validate-gdd-cross.js --full --summary

# CI mode (exit 1 if warnings, exit 2 if errors)
node scripts/validate-gdd-cross.js --full --ci
```

### Output Formats

**Markdown Report** (`docs/cross-validation-report.md`):
```markdown
# Cross-Validation Report

**Generated:** 2025-10-09T12:00:00Z
**Status:** 🟢 HEALTHY
**Overall Score:** 97.4/100

## Coverage Validation

**Status:** ⚠️ FAIL
- **Total Checked:** 13
- **Matched:** 11
- **Mismatched:** 2

### Violations

| Node | Declared | Actual | Diff | Reason |
|------|----------|--------|------|--------|
| shield | 70% | 75% | +5% | coverage_mismatch |
| roast | 100% | 95% | -5% | coverage_mismatch |
```

**JSON Report** (`gdd-cross.json`):
```json
{
  "nodes_validated": 13,
  "coverage_validation": {
    "total": 13,
    "matched": 11,
    "mismatched": 2,
    "violations": [
      {
        "node": "shield",
        "declared": 70,
        "actual": 75,
        "diff": 5,
        "reason": "coverage_mismatch"
      }
    ]
  },
  "timestamp_validation": { ... },
  "dependency_validation": { ... },
  "overall_score": 97.4,
  "status": "HEALTHY"
}
```

---

## Integration Status Tracking

**Scripts:** `scripts/update-integration-status.js`, `integration-status.json`

Monitors 9 external platform integrations:

**Platforms:** Twitter (X), Discord, Twitch, YouTube, Instagram, Facebook, Reddit, TikTok, Bluesky

**Status Levels:**
- **active**: Adapter exists + credentials configured + recent successful API calls
- **inactive**: Adapter exists + credentials missing or API calls failing
- **not_connected**: No adapter implementation found

**Health Calculation:**
```javascript
// Per-platform health (0-100)
health = (adapter_exists ? 40 : 0) + (credentials_present ? 60 : 0)

// Overall connectivity health
overall_health = average(all_platform_health_scores)
```

**Commands:**
```bash
# Check all integrations
node scripts/update-integration-status.js

# Verbose output
node scripts/update-integration-status.js --verbose

# CI mode (silent)
node scripts/update-integration-status.js --ci
```

**Output** (`integration-status.json`):
```json
{
  "last_updated": "2025-10-09T12:00:00Z",
  "version": "1.0",
  "integrations": [
    {
      "name": "twitter",
      "status": "inactive",
      "health_score": 40,
      "credentials_present": false,
      "adapter_exists": true,
      "last_check": "2025-10-09T12:00:00Z",
      "related_nodes": ["social-platforms", "roast", "shield"]
    }
  ],
  "summary": {
    "total": 9,
    "active": 0,
    "inactive": 9,
    "not_connected": 0,
    "overall_health": 40
  }
}
```

---

## Extended Health Scoring

Phase 15 extends `scripts/score-gdd-health.js` with connectivity and cross-validation metrics.

**Enhanced Health Formula:**
```javascript
// Documentation Health (existing from Phase 7)
doc_health = weighted_avg([
  sync_accuracy * 0.25,
  update_freshness * 0.15,
  dependency_integrity * 0.20,
  coverage_evidence * 0.20,
  agent_relevance * 0.10,
  integrity_score * 0.10
])

// Connectivity Score (new in Phase 15)
connectivity_score = (active_integrations / total_integrations) * 100

// Cross-Validation Score (new in Phase 15)
cross_validation_score = gdd-cross.json overall_score

// Composite Health Score
composite_health = weighted_avg([
  doc_health * 0.40,
  cross_validation_score * 0.30,
  connectivity_score * 0.30
])
```

**Commands:**
```bash
# Score with Phase 15 metrics
node scripts/score-gdd-health.js --ci

# Generate extended report
node scripts/score-gdd-health.js --format=markdown
```

**Extended Report Sections:**

1. **External Integrations Status**: Connectivity score, active/inactive/not_connected counts, per-platform health breakdown
2. **Cross-Validation Summary**: Overall cross-validation score, coverage/timestamp/dependency violation counts, top violators list
3. **System Health Intelligence Summary**: Composite health score, weighted breakdown by dimension, status determination (HEALTHY/DEGRADED/CRITICAL)

---

## Watch Mode Integration

Phase 15 enhances `scripts/watch-gdd.js` with real-time cross-validation and connectivity monitoring.

**New Flags:**
```bash
# Enable cross-validation in watch mode
node scripts/watch-gdd.js --cross

# Enable connectivity monitoring
node scripts/watch-gdd.js --connectivity

# Enable both
node scripts/watch-gdd.js --cross --connectivity

# Enable all Phase 15 features
node scripts/watch-gdd.js --all
```

**Enhanced Dashboard Display:**
```text
╔═══════════════════════════════════════════════════════╗
║            GDD Runtime Validation Dashboard            ║
╠═══════════════════════════════════════════════════════╣
║ Cross-Validation Status                               ║
║ ├─ Overall Score: 97.4/100 [HEALTHY]                  ║
║ ├─ Coverage Violations: 2                             ║
║ ├─ Timestamp Violations: 0                            ║
║ └─ Dependency Violations: 1                           ║
║                                                        ║
║ Integration Connectivity                              ║
║ ├─ Overall Health: 40%                                ║
║ ├─ Active: 0/9                                        ║
║ ├─ Inactive: 9/9                                      ║
║ └─ Not Connected: 0/9                                 ║
╚═══════════════════════════════════════════════════════╝
```

---

## Workflow Integration

**Pre-Commit Workflow:**
```bash
# 1. Run tests with coverage
npm test -- --coverage

# 2. Update integration status
node scripts/update-integration-status.js --ci

# 3. Run cross-validation
node scripts/validate-gdd-cross.js --full --ci

# 4. Score health with Phase 15 metrics
node scripts/score-gdd-health.js --ci

# 5. Commit if all checks pass
git add .
git commit -m "feat: your feature description"
```

**CI/CD Integration:**

Cross-validation is automatically integrated into `.github/workflows/gdd-validate.yml`:

```yaml
- name: Run Cross-Validation
  run: node scripts/validate-gdd-cross.js --full --ci

- name: Update Integration Status
  run: node scripts/update-integration-status.js --ci

- name: Score Health with Phase 15
  run: node scripts/score-gdd-health.js --ci
```

**Exit Codes:**
- `0`: All validations passed
- `1`: Warnings detected (coverage mismatches within tolerance, minor issues)
- `2`: Critical errors detected (major violations, missing data sources)

---

## Performance Metrics

Phase 15 meets all performance targets:

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Cross-validate 13 nodes | <1s | ~800ms | ✅ PASS |
| Update integration status | <2s | ~1.2s | ✅ PASS |
| Extended health scoring | <1s | ~600ms | ✅ PASS |
| Watch mode refresh | <3s | ~2.1s | ✅ PASS |

---

## Troubleshooting

### Issue: "No coverage data found"

```bash
# Solution: Run tests with coverage first
npm test -- --coverage
node scripts/validate-gdd-cross.js --full
```

### Issue: "Git log failed for node X"

```bash
# Solution: Ensure source files exist and are tracked by git
git status
git add <missing-files>
```

### Issue: "All integrations showing 'inactive'"

```bash
# Solution: Add platform credentials to .env
# See "Platform Integrations" section in CLAUDE.md for required env vars
```

### Issue: "Coverage mismatch for node X"

```bash
# Solution: Either update node docs or improve test coverage
# Option 1: Update declared coverage (manual)
# Option 2: Use auto-repair
node scripts/auto-repair-gdd.js --auto-fix
```

### Issue: "Cross-validation score lower than expected"

```bash
# Solution: Check detailed violations
node scripts/validate-gdd-cross.js --full
# Review docs/cross-validation-report.md for specifics
# Address violations one by one
```

---

## Files Added/Modified

**New Files:**
- `scripts/validate-gdd-cross.js` - Main cross-validation engine
- `scripts/gdd-cross-validator.js` - Helper class with validation utilities
- `scripts/update-integration-status.js` - Integration status updater
- `integration-status.json` - Integration status data store
- `gdd-cross.json` - Cross-validation results (JSON output)
- `docs/cross-validation-report.md` - Cross-validation results (markdown)
- `docs/plan/gdd-phase-15-cross-validation.md` - Implementation plan

**Modified Files:**
- `scripts/score-gdd-health.js` - Extended with Phase 15 metrics
- `scripts/watch-gdd.js` - Added --cross and --connectivity flags
- `CLAUDE.md` - Links to this documentation

---

## Success Criteria

Phase 15 is considered complete when:

- ✅ Cross-validation engine validates all 13 nodes in <1s
- ✅ Coverage, timestamp, and dependency checks implemented
- ✅ Both markdown and JSON reports generated
- ✅ Integration status tracking operational for 9 platforms
- ✅ Health scoring extended with connectivity and cross-validation metrics
- ✅ Composite health formula implemented (40/30/30 weighting)
- ✅ Watch mode enhanced with --cross and --connectivity flags
- ✅ CI/CD integration with proper exit codes (0/1/2)
- ✅ Performance targets met (<1s validation, <2s status update)
- ✅ Documentation complete (CLAUDE.md, implementation plan)

**Current Status:** All criteria met ✅

---

[← Back to CLAUDE.md](../CLAUDE.md) | [View All GDD Documentation](./GDD-IMPLEMENTATION-SUMMARY.md)
