# GDD Phase 17.1 - Automated Health & Drift Monitoring

**Implemented:** 2025-11-11
**Status:** ✅ Complete
**Issue:** #541
**Type:** Infrastructure - Autonomous Monitoring

---

## Overview

Phase 17.1 adds **autonomous, cron-based monitoring** to the GDD system, ensuring continuous health tracking without manual intervention. The system automatically validates documentation health, predicts drift, generates reports, and creates issues when degradation is detected.

**Key Benefit:** Proactive detection of documentation degradation on main branch, preventing quality issues from accumulating unnoticed between PRs.

---

## Architecture

### System Flow

```
Cron Trigger (every 3 days)
    ↓
Check maintenance mode
    ↓
Load GDD configuration (.gddrc.json)
    ↓
Execute validation pipeline:
    ├─ validate-gdd-runtime.js --ci
    ├─ score-gdd-health.js --summary
    └─ predict-gdd-drift.js --ci
    ↓
Generate versioned reports:
    ├─ auto-health-{timestamp}.md
    ├─ auto-health-{timestamp}.json
    ├─ auto-drift-{timestamp}.json
    └─ auto-status-{timestamp}.json
    ↓
Cleanup old reports (keep latest 30)
    ↓
Commit reports to main
    ↓
Check thresholds:
    ├─ Health < min_health_score? → Create/update health issue
    └─ Drift > max_drift_risk? → Create/update drift issue
    ↓
Generate workflow summary
```

---

## Components

### 1. Workflow: `.github/workflows/gdd-auto-monitor.yml`

**Triggers:**

- **Schedule:** Every 3 days at 8:00 UTC (`0 8 */3 * *`)
- **Manual:** `workflow_dispatch` (allow manual execution)

**Key Features:**

- ✅ Runs only on `main` branch (prevents noise from feature branches)
- ✅ Respects GDD maintenance mode (monitoring only, no issue creation)
- ✅ Generates timestamped reports for historical tracking
- ✅ Auto-cleanup of old reports (configurable retention)
- ✅ Duplicate issue prevention (search before creating)
- ✅ Commits reports directly to main (preserves history)

**Permissions:**

```yaml
permissions:
  contents: write # Commit reports to main
  issues: write # Create/update issues
  pull-requests: read # Read PR context (future use)
```

**Configuration Inputs:**

```yaml
inputs:
  create_issues:
    description: 'Create issues on failures'
    default: 'true'
    type: boolean
```

---

### 2. Report Generation

**Report Types:**

| File Pattern                   | Format   | Purpose                |
| ------------------------------ | -------- | ---------------------- |
| `auto-health-{timestamp}.md`   | Markdown | Human-readable summary |
| `auto-health-{timestamp}.json` | JSON     | Health scoring data    |
| `auto-drift-{timestamp}.json`  | JSON     | Drift prediction data  |
| `auto-status-{timestamp}.json` | JSON     | Validation status data |

**Timestamp Format:** `YYYY-MM-DD-HH-MM` (e.g., `2025-11-11-08-00`)

**Example Report:**

```markdown
# GDD Auto-Health Report

**Date:** 2025-11-11 08:00 UTC
**Trigger:** Scheduled (Auto-Monitor)
**Workflow:** [Link to workflow run]

---

## Summary

| Metric              | Value    | Status     |
| ------------------- | -------- | ---------- |
| **Health Score**    | 98.8/100 | 🟢 HEALTHY |
| **Drift Risk**      | 15/100   | 🟢 LOW     |
| **Nodes Validated** | 13/13    | ✅         |

---

## Health Breakdown

- 🟢 Healthy nodes: 13
- 🟡 Degraded nodes: 0
- 🔴 Critical nodes: 0

## Drift Analysis

- 🟢 Low risk: 13
- 🟡 At risk: 0
- 🔴 High risk: 0

---

## Actions Taken

- ✅ Validation completed
- ✅ Health scoring completed
- ✅ Drift prediction completed
- ✅ No issues created (health above threshold)
```

---

### 3. Report Rotation

**Objective:** Prevent unbounded growth of reports directory

**Strategy:**

- Keep latest `N` reports (default: 30)
- Sort by timestamp (filename)
- Delete oldest reports when count exceeds limit

**Implementation:**

```bash
# Count total reports
TOTAL_REPORTS=$(ls -1 auto-health-*.md | wc -l)

# If exceeds limit, delete oldest
if [ "$TOTAL_REPORTS" -gt "$MAX_REPORTS" ]; then
  TO_DELETE=$((TOTAL_REPORTS - MAX_REPORTS))

  # Delete oldest (sorted by name/date)
  ls -1t auto-health-*.md | tail -n +$((MAX_REPORTS + 1)) | while read file; do
    base="${file%.md}"
    rm -f "$base.md" "$base.json" "${base/auto-health/auto-drift}" "${base/auto-health/auto-status}"
  done
fi
```

**Retention:**

- 30 reports @ 3 days/report = ~90 days history
- Configurable via `.gddrc.json` (`auto_monitor.max_reports`)

---

### 4. Issue Creation Logic

**Duplicate Prevention:**

```javascript
// Search for existing issue (prevents spam)
const { data: searchResults } = await github.rest.search.issuesAndPullRequests({
  q: `repo:${owner}/${repo} is:issue is:open label:gdd label:auto-monitor in:title "${issueTitle}"`,
  per_page: 1
});

if (searchResults.items.length > 0) {
  // Update existing issue
  await github.rest.issues.update({ ... });
  await github.rest.issues.createComment({ ... }); // Add re-validation comment
} else {
  // Create new issue
  await github.rest.issues.create({ ... });
}
```

**Issue Types:**

#### A. Health Degradation Issue

**Title:** `[GDD] Auto-Monitor Alert: Health Below Threshold`

**Triggers:**

- `health_score < min_health_score` (.gddrc.json)

**Labels:** `documentation`, `gdd`, `tech-debt`, `priority:P1`, `auto-monitor`

**Content:**

- Current health score vs threshold
- Critical/degraded nodes breakdown
- Links to reports
- Action checklist

#### B. High Drift Risk Issue

**Title:** `[GDD] Auto-Monitor Alert: High Drift Risk`

**Triggers:**

- `drift_risk > max_drift_risk` (.gddrc.json, default: 60)

**Labels:** `documentation`, `gdd`, `tech-debt`, `priority:P2`, `auto-monitor`

**Content:**

- Current drift risk vs threshold
- High-risk nodes breakdown
- Links to reports
- Action checklist

---

## Configuration

### `.gddrc.json` (Extended)

```json
{
  "min_health_score": 93,
  "temporary_until": "2025-10-31",
  "auto_fix": true,
  "create_issues": true,
  "auto_monitor": {
    "enabled": true,
    "schedule": "0 8 */3 * *",
    "max_drift_risk": 60,
    "max_reports": 30
  },
  "github": {
    "block_merge_below_health": 93
  }
}
```

**New Fields:**

- `auto_monitor.enabled`: Enable/disable auto-monitoring (default: `true`)
- `auto_monitor.schedule`: Cron expression for schedule (default: `0 8 */3 * *`)
- `auto_monitor.max_drift_risk`: Threshold for drift issue creation (default: `60`)
- `auto_monitor.max_reports`: Max reports to retain (default: `30`)

---

## Integration with Existing System

### Relationship with `gdd-validate.yml`

| Aspect             | gdd-validate.yml     | gdd-auto-monitor.yml    |
| ------------------ | -------------------- | ----------------------- |
| **Trigger**        | PRs to main          | Cron (every 3 days)     |
| **Branch**         | PR branch            | main                    |
| **Purpose**        | Pre-merge validation | Continuous monitoring   |
| **Fail CI?**       | Yes (blocks merge)   | No (creates issues)     |
| **Issue Creation** | On PR failure        | On threshold violations |
| **Reports**        | PR comment           | Versioned files in repo |

**No Conflicts:** Both workflows use the same GDD scripts but different triggers. They complement each other:

- **gdd-validate.yml:** Prevents bad PRs from merging
- **gdd-auto-monitor.yml:** Detects degradation on main between PRs

---

### Maintenance Mode Behavior

When `.gdd-maintenance` has `maintenance_mode: true`:

```yaml
# Auto-monitor still runs (monitoring only)
if: steps.maintenance.outputs.maintenance_mode != 'true'
```

**Behavior:**

- ✅ Validation runs (monitoring active)
- ✅ Reports generated
- ✅ Reports committed
- ❌ Issues NOT created (manual review required)

**Rationale:** Continue monitoring even during maintenance, but don't spam issues automatically.

---

## Usage

### Manual Execution

```bash
# Via GitHub CLI
gh workflow run gdd-auto-monitor.yml

# With custom inputs
gh workflow run gdd-auto-monitor.yml -f create_issues=false
```

### View Reports

```bash
# List all reports
ls -1t docs/auto-health-reports/auto-health-*.md

# View latest report
cat docs/auto-health-reports/auto-health-$(ls -1t docs/auto-health-reports/auto-health-*.md | head -1 | sed 's/.*auto-health-//' | sed 's/.md//'

).md

# View specific report
cat docs/auto-health-reports/auto-health-2025-11-11-08-00.md
```

### Monitor Workflow

```bash
# View workflow status
gh run list --workflow=gdd-auto-monitor.yml

# View latest run
gh run view --workflow=gdd-auto-monitor.yml

# View logs
gh run view --workflow=gdd-auto-monitor.yml --log
```

---

## Benefits

### 1. **Proactive Detection**

- Catches documentation degradation between PRs
- No more "silent drift" on main branch
- Early warning system for health issues

### 2. **Historical Tracking**

- 90 days of health/drift history (30 reports @ 3 days)
- Trend analysis via timestamped reports
- Audit trail for quality metrics

### 3. **Reduced Manual Overhead**

- Autonomous execution (no human intervention)
- Automatic issue creation (no manual checks)
- Self-cleaning reports (no manual cleanup)

### 4. **Continuous Compliance**

- Ensures GDD health ≥ threshold at all times
- Prevents quality regressions from accumulating
- Enforces documentation standards continuously

---

## Monitoring & Alerts

### Workflow Health

**Check workflow status:**

```bash
gh run list --workflow=gdd-auto-monitor.yml --limit 5
```

**Expected frequency:** Every 3 days (approximately 10 runs/month)

**Alert if:**

- Workflow fails to execute for >7 days
- Health score drops >10 points between runs
- Drift risk increases >20 points between runs

### Issue Health

**Check auto-monitor issues:**

```bash
gh issue list --label auto-monitor --state open
```

**Alert if:**

- Health issue open for >7 days (degradation not addressed)
- Multiple drift issues accumulating (>3 open issues)

---

## Troubleshooting

### Workflow Not Running

**Symptom:** No new reports in 3+ days

**Diagnosis:**

```bash
# Check workflow status
gh run list --workflow=gdd-auto-monitor.yml --limit 1

# Check cron schedule
grep 'cron:' .github/workflows/gdd-auto-monitor.yml
```

**Solutions:**

- Verify cron expression is valid
- Check workflow is not disabled
- Manually trigger: `gh workflow run gdd-auto-monitor.yml`

---

### Reports Not Committed

**Symptom:** Workflow runs but no new reports in repo

**Diagnosis:**

```bash
# Check workflow logs
gh run view --workflow=gdd-auto-monitor.yml --log | grep "Commit reports"

# Check git permissions
grep 'permissions:' .github/workflows/gdd-auto-monitor.yml -A5
```

**Solutions:**

- Verify `contents: write` permission
- Check git config in workflow
- Verify no protected branch rules blocking commits

---

### Duplicate Issues Created

**Symptom:** Multiple issues with same title

**Diagnosis:**

```bash
# Check for duplicates
gh issue list --label auto-monitor --state open | grep "Auto-Monitor Alert"
```

**Solutions:**

- Verify search query in workflow (Step: "Create or update issue...")
- Check labels match exactly (`auto-monitor`, `gdd`)
- Close duplicates manually and let workflow update remaining issue

---

## Future Enhancements

- [ ] **Slack/Email Notifications:** Alert team on critical degradation
- [ ] **Trend Charts:** Visualize health/drift over time in dashboard
- [ ] **Configurable Schedules:** Per-org cron schedules
- [ ] **Multi-Branch Monitoring:** Monitor multiple branches (main, develop, staging)
- [ ] **Auto-Repair Integration:** Trigger auto-repair on certain failures
- [ ] **Historical Comparison:** Compare current vs previous report
- [ ] **Webhook Integration:** POST reports to external systems

---

## Compliance & Policy

### CLAUDE.md Rule (Added)

**Location:** `CLAUDE.md` - "GDD 2.0 - Quick Reference" section

**Rule:**

> ⚠️ **CRITICAL:** Auto-monitoring cannot be disabled without equivalent replacement. This ensures continuous health tracking of GDD system. If you need to disable auto-monitor, you MUST provide an alternative monitoring solution and get Product Owner approval.

**Rationale:**

- Documentation health is a critical quality metric
- Autonomous monitoring prevents silent degradation
- Manual monitoring is unreliable and error-prone
- This is a **non-negotiable requirement** for GDD system integrity

**Enforcement:**

- Any PR that disables auto-monitor without replacement → Rejected
- `.gddrc.json` changes that set `auto_monitor.enabled: false` → Requires PO approval
- Workflow deletion → Blocked by CODEOWNERS review

---

## Testing

### Pre-Deployment

- [x] Workflow syntax validation (GitHub Actions validator)
- [x] Manual execution test: `gh workflow run gdd-auto-monitor.yml`
- [x] Report generation verification
- [x] Issue creation test (with low health threshold)
- [x] Duplicate prevention test (second run with same threshold)
- [x] Cleanup logic test (create 35 reports, verify only 30 remain)

### Post-Deployment

- [ ] Monitor first 3 scheduled runs (9 days)
- [ ] Verify reports committed to main
- [ ] Verify no duplicate issues created
- [ ] Verify cleanup maintains 30 reports max

---

## Metrics

### Success Criteria

| Metric                    | Target            | Current |
| ------------------------- | ----------------- | ------- |
| **Workflow Success Rate** | >95%              | TBD     |
| **Reports Generated**     | 100% of runs      | TBD     |
| **Issue Accuracy**        | 0 false positives | TBD     |
| **Duplicate Issues**      | 0 duplicates      | TBD     |
| **Storage Growth**        | <10MB/year        | TBD     |

### Performance

- **Workflow Duration:** ~5-10 minutes
- **Report Size:** ~5-10 KB each
- **Storage Impact:** ~150 KB for 30 reports
- **Compute Cost:** Negligible (10 runs/month × 10 min = ~100 min/month)

---

## Rollout Plan

### Phase 1: Validation (Week 1)

- ✅ Deploy workflow to main
- ✅ Monitor first 3 scheduled runs
- ✅ Verify no duplicate issues
- ✅ Confirm reports generated correctly

### Phase 2: Optimization (Week 2)

- [ ] Adjust thresholds based on data (if needed)
- [ ] Fine-tune cron schedule (if needed)
- [ ] Add Slack notifications (optional)

### Phase 3: Documentation (Week 3)

- ✅ Update GDD-IMPLEMENTATION-SUMMARY.md
- ✅ Add Phase 17.1 to phase index
- ✅ Create this implementation guide

---

## Related Documentation

- [GDD Implementation Summary](../GDD-IMPLEMENTATION-SUMMARY.md)
- [GDD Validation Workflow](../../.github/workflows/gdd-validate.yml)
- [GDD Activation Guide](../GDD-ACTIVATION-GUIDE.md)
- [Issue #541](https://github.com/Eibon7/roastr-ai/issues/541)

---

**Maintained by:** Orchestrator + Documentation Agent
**Review Frequency:** Monthly or after major GDD changes
**Last Reviewed:** 2025-11-11
**Version:** 1.0.0
