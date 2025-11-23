# GDD Phase 15: Cross-Validation & Extended Health Metrics

**Created:** 2025-10-09
**Issue:** N/A (Feature specification from user)
**Priority:** P1 - High
**Complexity:** High

---

## Estado Actual (Assessment)

### Existing System

- ✅ 13 GDD nodes in `docs/nodes/`
- ✅ Health scoring system with 6 factors (Phase 15.1):
  - Sync Accuracy (25%)
  - Update Freshness (15%)
  - Dependency Integrity (20%)
  - Coverage Evidence (20%)
  - Agent Relevance (10%)
  - Integrity Score (10% - Phase 15.1)
- ✅ Runtime validation (`validate-gdd-runtime.js`)
- ✅ Health scoring (`score-gdd-health.js`)
- ✅ Drift prediction (`predict-gdd-drift.js`)
- ✅ Auto-repair (`auto-repair-gdd.js`)
- ✅ Watch mode (`watch-gdd.js`)
- ✅ Coverage tracking via `coverage/coverage-summary.json`

### Gaps Identified

- ❌ No cross-validation between documentation and runtime data
- ❌ No integration status tracking for external platforms
- ❌ No connectivity health metrics
- ❌ No unified system health view combining all dimensions

### Tests Status

- Existing GDD validation tests: PASSING
- Need to create tests for new cross-validation features

---

## Objetivo

Extend the GDD framework from a documentation coherence engine into a comprehensive "System Health Intelligence Layer" by adding:

1. **Cross-Validation Engine** - Verify consistency between docs and runtime data
2. **Extended Health Metrics** - Track external integration connectivity
3. **Unified Health Reporting** - Combine all health dimensions in one view
4. **CLI Enhancements** - Add cross-validation and connectivity flags to existing tools

---

## Plan de Implementación

### Phase 1: Cross-Validation Engine

**File:** `scripts/validate-gdd-cross.js`

**Functionality:**

- Compare `coverage` values in `docs/nodes/*.md` vs `coverage/coverage-summary.json`
- Validate `last_updated` timestamps against git commit history
- Detect mismatches between declared dependencies and actual imports in `src/`
- Generate dual reports:
  - `docs/cross-validation-report.md` (human-readable)
  - `gdd-cross.json` (machine-readable)

**Validation Checks:**

1. **Coverage Authenticity**
   - Extract coverage % from node docs
   - Load actual coverage from `coverage-summary.json`
   - Calculate diff (tolerance: 3%)
   - Report violations

2. **Timestamp Accuracy**
   - Extract `last_updated` from node docs
   - Query git log for actual last modification
   - Compare dates
   - Report stale/future dates

3. **Dependency Integrity**
   - Extract declared dependencies from node docs
   - Scan `src/` for actual imports/requires
   - Detect missing or phantom dependencies
   - Report mismatches

**CLI Modes:**

- `--full` - Complete cross-check (all nodes)
- `--node=<name>` - Specific node validation
- `--summary` - Aggregated results only
- `--ci` - CI mode (exit 1 on errors)

**Output Format:**

```javascript
{
  status: 'HEALTHY' | 'WARNING' | 'FAIL',
  coverage_validation: {
    total: 13,
    matched: 11,
    mismatched: 2,
    violations: [...]
  },
  timestamp_validation: {
    total: 13,
    valid: 10,
    stale: 2,
    future: 1,
    violations: [...]
  },
  dependency_validation: {
    total: 13,
    valid: 12,
    missing_deps: 1,
    phantom_deps: 0,
    violations: [...]
  },
  overall_score: 92.3
}
```

### Phase 2: Integration Status Tracking

**File:** `integration-status.json`

**Structure:**

```json
{
  "last_updated": "2025-10-09T12:00:00Z",
  "integrations": [
    {
      "name": "twitter",
      "status": "active",
      "last_checked": "2025-10-09",
      "related_nodes": ["social-platforms", "roast"],
      "health_score": 95
    },
    {
      "name": "discord",
      "status": "active",
      "last_checked": "2025-10-09",
      "related_nodes": ["social-platforms", "shield"],
      "health_score": 88
    },
    {
      "name": "instagram",
      "status": "inactive",
      "last_checked": "2025-10-08",
      "related_nodes": ["social-platforms"],
      "health_score": 45
    }
  ]
}
```

**Platforms to Track:**

- Twitter/X
- Discord
- Twitch
- YouTube
- Instagram
- Facebook
- Reddit
- TikTok
- Bluesky

**Helper Script:** `scripts/update-integration-status.js`

- Check platform adapters exist
- Validate credentials (env vars)
- Update status based on availability
- Calculate health score per integration

### Phase 3: Extended Health Metrics

**Modify:** `scripts/score-gdd-health.js`

**New Scoring Factors:**

1. **Connectivity Score (weighting TBD)**
   - Load `integration-status.json`
   - Calculate % of active integrations
   - Penalize inactive critical platforms
   - Bonus for healthy integrations

2. **Drift Correlation**
   - Cross-reference drift data with inactive integrations
   - Identify if drifted nodes correlate with platform failures
   - Adjust health score based on correlation

**Updated Health Schema:**

```javascript
{
  generated_at: "2025-10-09T12:00:00Z",
  status: "HEALTHY",
  overall_score: 94.2,

  // Existing metrics
  total_nodes: 13,
  healthy_count: 11,
  degraded_count: 2,
  critical_count: 0,

  // NEW: Cross-validation metrics
  cross_validation_score: 92.3,
  cross_validation_status: "WARNING",
  coverage_mismatches: 2,
  timestamp_violations: 3,
  dependency_violations: 1,

  // NEW: Connectivity metrics
  connectivity_score: 88.0,
  connectivity_status: "HEALTHY",
  active_integrations: 7,
  inactive_integrations: 2,
  not_connected_integrations: 0,

  // NEW: Composite health
  composite_health_score: 91.5,

  integrations: [...]
}
```

### Phase 4: Unified Health Reports

**Update:** `docs/system-health.md`

#### New Section: External Integrations Status

```markdown
## External Integrations Status

**Last Updated:** 2025-10-09 12:00:00 UTC
**Connectivity Score:** 88/100
**Status:** 🟢 HEALTHY

| Integration | Status      | Last Checked | Health Score | Related Nodes            |
| ----------- | ----------- | ------------ | ------------ | ------------------------ |
| Twitter     | 🟢 active   | 2025-10-09   | 95           | social-platforms, roast  |
| Discord     | 🟢 active   | 2025-10-09   | 88           | social-platforms, shield |
| Instagram   | 🔴 inactive | 2025-10-08   | 45           | social-platforms         |

...
```

#### New Section: Cross-Validation Summary

```markdown
## Cross-Validation Summary

**Status:** 🟡 WARNING
**Overall Score:** 92.3/100

### Coverage Validation

- ✅ Matched: 11/13 nodes
- ⚠️ Mismatched: 2/13 nodes
- Violations: shield.md (+5%), roast.md (-3%)

### Timestamp Validation

- ✅ Valid: 10/13 nodes
- ⚠️ Stale: 2/13 nodes (>30 days)
- ❌ Future: 1/13 nodes
```

#### New Section: Composite Health Score

```markdown
## System Health Intelligence Summary

| Dimension                 | Score    | Status         | Weight   |
| ------------------------- | -------- | -------------- | -------- |
| Documentation Health      | 94.2     | 🟢 HEALTHY     | 40%      |
| Cross-Validation Accuracy | 92.3     | 🟡 WARNING     | 30%      |
| Connectivity Health       | 88.0     | 🟢 HEALTHY     | 30%      |
| **Composite Score**       | **91.5** | **🟢 HEALTHY** | **100%** |
```

### Phase 5: CLI Updates

**Modify:** `scripts/watch-gdd.js`, `scripts/validate-gdd-runtime.js`

**New Flags:**

- `--cross` - Include cross-validation in watch/validate
- `--connectivity` - Include connectivity checks
- `--all` - Run all checks (validation + health + drift + cross + connectivity)

**Updated Dashboard Output:**

```text
╔════════════════════════════════════════╗
║  GDD STATUS: HEALTHY                  ║
╠════════════════════════════════════════╣
║ ✅ Nodes:        13                    ║
║ ✅ Orphans:       0                    ║
║ ✅ Outdated:      2                    ║
║ ✅ Cycles:        0                    ║
║ ✅ Missing Refs:  0                    ║
║ ✅ Drift Issues:  0                    ║
╠════════════════════════════════════════╣
║ 📊 CROSS-VALIDATION STATUS            ║
║ ⚠️  Coverage:     2 mismatches         ║
║ ✅ Timestamps:    0 violations         ║
║ ✅ Dependencies:  0 violations         ║
║ Score: 92.3/100                       ║
╠════════════════════════════════════════╣
║ 🌐 CONNECTIVITY STATUS                ║
║ ✅ Active:        7                    ║
║ 🔴 Inactive:      2                    ║
║ ⚠️  Not Connected: 0                    ║
║ Score: 88.0/100                       ║
╠════════════════════════════════════════╣
║ 🏆 COMPOSITE HEALTH: 91.5/100         ║
╚════════════════════════════════════════╝
```

### Phase 6: Documentation Updates

**Files to Update:**

1. `CLAUDE.md` - Add Phase 15 section (~200+ lines)
2. `docs/system-health.md` - Add new sections
3. `docs/system-validation.md` - Add cross-validation docs
4. `docs/GDD-IMPLEMENTATION-SUMMARY.md` - Add Phase 15 entry

---

## Archivos Afectados

### New Files

- `scripts/validate-gdd-cross.js` (500+ lines)
- `scripts/update-integration-status.js` (200+ lines)
- `scripts/gdd-cross-validator.js` (helper class, 400+ lines)
- `integration-status.json` (initial data)
- `docs/cross-validation-report.md` (generated)
- `gdd-cross.json` (generated)

### Modified Files

- `scripts/score-gdd-health.js` (+150 lines)
- `scripts/watch-gdd.js` (+100 lines)
- `scripts/validate-gdd-runtime.js` (+50 lines)
- `docs/system-health.md` (+200 lines)
- `docs/system-validation.md` (+150 lines)
- `CLAUDE.md` (+250 lines)
- `docs/GDD-IMPLEMENTATION-SUMMARY.md` (+100 lines)

### Test Files (to create)

- `tests/unit/scripts/validate-gdd-cross.test.js`
- `tests/unit/scripts/update-integration-status.test.js`
- `tests/integration/gdd-cross-validation.test.js`

---

## Criterios de Validación

### Acceptance Criteria

1. ✅ Cross-validation script works for all 13 nodes
2. ✅ Detects real mismatches between docs and runtime data
3. ✅ Generates both Markdown and JSON reports
4. ✅ Connectivity metrics integrated and correctly scored
5. ✅ Unified health summary complete and consistent
6. ✅ No dependency breaks, no runtime errors
7. ✅ CI/CD compatible with correct exit codes
8. ✅ No manual review required

### Performance Targets

- Cross-validation completes in <1s for 13 nodes
- Integration status check completes in <2s
- Health scoring with all metrics in <3s total
- Watch mode latency <5s (full validation cycle)

### Quality Standards

- No emojis in code (only in reports if needed)
- Dark-themed, minimal UI aesthetic (Snake Eater style)
- Consistent color-coded terminal output
- All outputs machine-parseable (JSON + Markdown)
- Comprehensive error handling
- Clear exit codes (0 = success, 1 = warnings, 2 = errors)

---

## Subagents Necesarios

### Primary Agents

- **Orchestrator** (this agent) - Overall coordination
- **Backend Developer** - Cross-validation logic, integration checks
- **Test Engineer** - Unit and integration tests
- **Documentation Agent** - Update CLAUDE.md, system docs

### Support Agents

- **GDD Specialist** (inline) - Ensure GDD coherence
- **CLI/UX Agent** (inline) - Terminal output formatting

---

## Riesgos y Mitigación

### Risk 1: Git history parsing complexity

**Mitigation:** Use `git log --format="%ai" --follow` for accurate timestamps

### Risk 2: Coverage file structure changes

**Mitigation:** Parse both `coverage-summary.json` and `lcov.info` as fallbacks

### Risk 3: Integration status false positives

**Mitigation:** Check both file existence AND env var presence

### Risk 4: Performance degradation with large codebases

**Mitigation:** Cache git queries, lazy-load coverage data, parallel validation

### Risk 5: Breaking existing GDD workflows

**Mitigation:** Make all new features opt-in (flags), maintain backward compatibility

---

## Timeline Estimate

- **Phase 1** (Cross-Validation Engine): 2-3 hours
- **Phase 2** (Integration Status): 1 hour
- **Phase 3** (Extended Health Metrics): 1 hour
- **Phase 4** (Unified Reports): 1 hour
- **Phase 5** (CLI Updates): 1 hour
- **Phase 6** (Documentation): 1-2 hours
- **Testing & Validation**: 1-2 hours

**Total Estimate:** 8-11 hours (1-2 sessions)

---

## Success Metrics

- All 13 GDD nodes pass cross-validation with 95+ score
- Integration status accurately reflects system state
- Composite health score provides actionable insights
- Zero false positives in cross-validation
- CI/CD integration works without manual intervention
- Documentation comprehensive and accurate

---

## Next Steps

1. ✅ Plan created (this document)
2. ⏭️ Build cross-validation engine
3. ⏭️ Create integration status tracking
4. ⏭️ Extend health scoring
5. ⏭️ Update CLI tools
6. ⏭️ Generate reports
7. ⏭️ Update documentation
8. ⏭️ Run full validation and tests

---

**Plan Status:** ✅ Complete
**Ready to Execute:** YES
**Blocking Issues:** None
