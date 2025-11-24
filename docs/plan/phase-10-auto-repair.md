# GDD 2.0 - Phase 10: Auto-Repair Assistant

**Date:** 2025-10-06
**Owner:** Orchestrator + Documentation Agent
**Status:** Planning → Implementation
**Target:** Health Score ≥97/100 with auto-repair capabilities

---

## 🎯 Objective

Implement an auto-repair system that detects and automatically fixes GDD documentation inconsistencies, maintaining total coherence without manual intervention.

**Close the maintenance loop:** drift detection → health scoring → **auto-repair** → validation

---

## 📊 Current State

- ✅ Runtime Validator
- ✅ Watcher with dashboard
- ✅ Health Scorer (5-factor system)
- ✅ Predictive Drift Detector
- ✅ Coverage & Update Enrichment
- 🟢 **Current Health Score:** 95.5/100

**Gap:** Manual intervention still required when health degrades

---

## 🎯 Phase 10 Goals

1. **Auto-detect issues** across all GDD nodes
2. **Auto-fix common problems** (metadata, edges, references)
3. **Backup before repairs** for safe rollback
4. **Generate audit trail** (changelog + reports)
5. **Integrate with watcher** and CI/CD
6. **Achieve ≥97/100** health score

---

## 🏗️ Architecture

### Components to Build

```
scripts/
├── auto-repair-gdd.js          # Main auto-repair engine
├── rollback-gdd-repair.js      # Rollback system
└── watch-gdd.js                # Update with --auto-repair flag

docs/
├── auto-repair-report.md       # Latest repair report
├── auto-repair-changelog.md    # Historical changelog
└── auto-repair-history.log     # Machine-readable log

/tmp/gdd-auto-repair-backups/
└── <timestamp>/                # Timestamped backups
    ├── docs/nodes/*.md
    ├── spec.md
    ├── system-map.yaml
    └── gdd-status.json
```

---

## 🔍 Issue Detection Rules

### Auto-Fixable Issues (🟢)

| Issue                          | Detection                                       | Auto-Fix                         |
| ------------------------------ | ----------------------------------------------- | -------------------------------- |
| **Missing last_updated**       | No `**Last Updated:**` field                    | Add current date                 |
| **Outdated timestamp**         | > 30 days old                                   | Update to current date           |
| **Missing coverage**           | No `**Coverage:**` field                        | Inject from gdd-health.json      |
| **Missing agents**             | No `## Agentes Relevantes`                      | Add default agents per node type |
| **Broken bidirectional edges** | A depends on B, but B doesn't list A in used_by | Add missing edge                 |
| **Orphan nodes**               | Node in docs/nodes/ but not in system-map.yaml  | Add to system-map.yaml           |
| **Missing spec references**    | Node active but not in spec.md                  | Add GDD reference block          |
| **Missing metadata**           | No status, priority, or owner                   | Add defaults                     |

### Human Review Required (🟡)

| Issue                     | Detection                              | Action              |
| ------------------------- | -------------------------------------- | ------------------- |
| **Spec content drift**    | Code exists but spec outdated          | Create GitHub issue |
| **Deprecated nodes**      | Status=deprecated but still referenced | Flag for review     |
| **Circular dependencies** | Detected by validator                  | Flag for manual fix |
| **Coverage dropped >20%** | Coverage decreased significantly       | Alert + flag        |

### Critical Issues (🔴)

| Issue                 | Detection                                       | Action              |
| --------------------- | ----------------------------------------------- | ------------------- |
| **Missing node file** | Referenced in system-map but file doesn't exist | Fail + create issue |
| **Corrupted YAML**    | system-map.yaml parse error                     | Fail + alert        |
| **Health score <85**  | Below critical threshold                        | Fail CI/CD          |

---

## 🔧 Auto-Fix Rules Engine

### Rule Priority (Execution Order)

1. **Backups** (always first)
2. **Metadata fixes** (timestamps, coverage, agents)
3. **Structure fixes** (orphans, edges, references)
4. **Validation** (verify fixes didn't break anything)
5. **Report generation**

### Fix Implementation Strategy

```javascript
class AutoRepairEngine {
  async repair() {
    // 1. Create backup
    await this.createBackup();

    // 2. Detect all issues
    const issues = await this.detectIssues();

    // 3. Classify issues
    const { autoFixable, humanReview, critical } = this.classifyIssues(issues);

    // 4. Apply auto-fixes
    const fixes = await this.applyFixes(autoFixable);

    // 5. Validate results
    const validation = await this.validateFixes();

    // 6. Rollback if health worsened
    if (validation.healthScore < this.previousHealth) {
      await this.rollback();
      return { success: false, reason: 'health_degraded' };
    }

    // 7. Generate reports
    await this.generateReport(fixes, humanReview, critical);
    await this.updateChangelog(fixes);

    return { success: true, fixes, issues: humanReview.concat(critical) };
  }
}
```

---

## 📦 Backup System

### Backup Strategy

**Location:** `/tmp/gdd-auto-repair-backups/<ISO-timestamp>/`

**Files backed up:**

- `docs/nodes/*.md` (all 13 nodes)
- `spec.md`
- `docs/system-map.yaml`
- `gdd-status.json`
- `gdd-health.json`

**Retention:** Keep last 10 backups, delete older

**Metadata:** `backup-manifest.json`

```json
{
  "timestamp": "2025-10-06T14:42:00.000Z",
  "trigger": "watch-gdd --auto-repair",
  "health_before": 95.5,
  "files": [
    "docs/nodes/analytics.md",
    "docs/nodes/billing.md",
    ...
  ]
}
```

---

## 🔄 Rollback System

### Rollback Capabilities

```bash
# Rollback last repair
node scripts/rollback-gdd-repair.js --last

# Rollback specific timestamp
node scripts/rollback-gdd-repair.js --timestamp 2025-10-06T14:42:00.000Z

# List available backups
node scripts/rollback-gdd-repair.js --list

# Verify backup integrity
node scripts/rollback-gdd-repair.js --verify <timestamp>
```

### Rollback Safety Checks

1. Verify backup exists and is complete
2. Check no uncommitted git changes
3. Restore files in reverse dependency order
4. Re-run health scoring after rollback
5. Log rollback to changelog

---

## 📋 Report Generation

### auto-repair-report.md (Latest)

```markdown
# Auto-Repair Report

**Generated:** 2025-10-06T14:42:00.000Z
**Triggered by:** watch-gdd --auto-repair
**Health Score:** 95.5 → 97.2 (+1.7)

## ✅ Fixes Applied (29)

### Metadata Updates (13 nodes)

- Updated `last_updated` timestamps to 2025-10-06

### Structure Repairs (3)

- Restored bidirectional edge: billing ↔ stripe
- Added orphan node to system-map: trainer
- Added spec.md reference for analytics

### Coverage Injection (4 nodes)

- trainer: 45% → 72%
- analytics: 60% → 65%

## ⚠️ Pending Human Review (2)

1. **trainer.md** - Responsibilities section outdated vs code
2. **shield.md** - Missing owner metadata

## 🔴 Critical Issues (0)

None

## 📊 Results

- 🟢 Health Score: 97.2/100
- ⚙️ Auto-fixes: 29 applied
- 📋 Issues created: 2
- 💾 Backup: `/tmp/gdd-auto-repair-backups/2025-10-06T14:42:00.000Z/`
```

### auto-repair-changelog.md (Historical)

```markdown
# Auto-Repair Changelog

## 2025-10-06T14:42:00.000Z

**Repair ID:** 2025-10-06T14:42Z
**Triggered by:** watch-gdd --auto-repair
**Nodes affected:** billing, trainer, shield (3 nodes)

**Fixes applied:**

- Updated last_updated timestamps (3 nodes)
- Restored bidirectional edge between billing ↔ stripe
- Injected coverage values (trainer: 72%)

**Outcome:**

- Health score: 95.5 → 97.2
- Issues created: 2 (human review)
- Backup: `/tmp/gdd-auto-repair-backups/2025-10-06T14:42:00.000Z/`

---

## 2025-10-05T10:15:00.000Z

...
```

---

## 🔗 Integration Points

### 1. Watcher Integration

**Update `scripts/watch-gdd.js`:**

```bash
# New flag
node scripts/watch-gdd.js --auto-repair

# Dashboard additions
🔧 Auto-Repair Status
   Last repair: 2025-10-06 14:42
   Fixes applied: 29
   Pending review: 2
   Health: 95.5 → 97.2
```

**Auto-repair trigger:**

- Health score < 90 → auto-repair
- Drift risk > 40 → auto-repair
- Orphan nodes detected → auto-repair

### 2. CI/CD Integration

**Update `.github/workflows/gdd-validation.yml`:**

```yaml
- name: Auto-Repair GDD
  run: node scripts/auto-repair-gdd.js --ci

- name: Verify Health Score
  run: node scripts/compute-gdd-health.js --ci --min-score 85
```

**Failure conditions:**

- Health score < 85 after repair
- Critical issues > 0
- Repair rollback occurred

### 3. CLAUDE.md Integration

**Add to orchestrator rules:**

- Log all auto-fixes to CLAUDE.md
- Reference auto-repair-report.md in PRs
- Auto-commit trivial fixes with [auto-repair] prefix

---

## 🧪 Testing Strategy

### Test Scenarios

1. **Missing Metadata Test**
   - Remove timestamps from 3 nodes
   - Run auto-repair
   - Verify timestamps restored

2. **Broken Edges Test**
   - Remove bidirectional edge from system-map
   - Run auto-repair
   - Verify edge restored

3. **Orphan Node Test**
   - Create new node file without system-map entry
   - Run auto-repair
   - Verify added to system-map

4. **Rollback Test**
   - Apply intentionally bad fix
   - Health score drops
   - Verify auto-rollback occurs

5. **CI/CD Integration Test**
   - Commit degraded state
   - CI runs auto-repair
   - Verify PR created with fixes

---

## 📈 Success Criteria

### Phase 10 Core

- ✅ `auto-repair-gdd.js` executes in < 0.5s (13 nodes)
- ✅ `rollback-gdd-repair.js` functional with --last, --timestamp
- ✅ Auto-backup before every repair
- ✅ `watch-gdd.js --auto-repair` working
- ✅ Reports auto-generated (report.md + changelog.md)
- ✅ Health score ≥ 97 after repair
- ✅ 0 critical issues unresolved
- ✅ CI/CD passing with auto-fixes

### Phase 10.1 Extensions (Optional)

- ⏸️ CLAUDE.md historical tracking
- ⏸️ Machine-readable `gdd-auto-fixes.json`
- ⏸️ Auto-commit trivial fixes
- ⏸️ Slack/Discord notifications

---

## 📂 Files to Create

1. **scripts/auto-repair-gdd.js** (~500 lines)
   - Issue detection engine
   - Auto-fix rules
   - Backup creation
   - Report generation

2. **scripts/rollback-gdd-repair.js** (~200 lines)
   - Rollback logic
   - Backup verification
   - Health re-scoring

3. **scripts/lib/auto-repair-engine.js** (~300 lines)
   - Core repair logic
   - Rule definitions
   - Fix validators

4. **docs/auto-repair-report.md** (auto-generated)
   - Latest repair results

5. **docs/auto-repair-changelog.md** (auto-generated)
   - Historical log

6. **docs/auto-repair-history.log** (auto-generated)
   - Machine-readable JSON log

---

## 🔄 Implementation Order

1. ✅ **Planning** (this document)
2. ⏳ **Core auto-repair engine** (detect + fix)
3. ⏳ **Backup system**
4. ⏳ **Rollback system**
5. ⏳ **Report generation**
6. ⏳ **Watcher integration**
7. ⏳ **CI/CD integration**
8. ⏳ **Testing with degraded scenarios**
9. ⏳ **Documentation update**
10. ⏳ **Commit Phase 10**

---

## 🎯 Expected Outcome

**Before Phase 10:**

- Health Score: 95.5/100
- Manual intervention required for degradation
- No automatic recovery

**After Phase 10:**

- Health Score: ≥97/100
- Automatic detection and repair
- Full rollback capability
- Complete audit trail
- Self-healing documentation system

**Maintenance Time Reduction:** ~80% (from manual fixes to automatic)

---

**Status:** 📋 PLANNING COMPLETE → Ready for Implementation
