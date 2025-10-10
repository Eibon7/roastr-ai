# GDD 2.0 - Phase 13: Telemetry & Analytics Layer

[← Back to CLAUDE.md](../CLAUDE.md)

---

**For full details, see:** `docs/GDD-IMPLEMENTATION-SUMMARY.md#phase-13`

## Overview

GDD 2.0 now includes historical telemetry and analytics to track system evolution over time.

---

## Telemetry Collection

**Script:** `scripts/collect-gdd-telemetry.js`

Automatically collects metrics from GDD subsystems every 24 hours:
- Health scores (overall + per-node)
- Drift risk trends
- Auto-repair success rates
- Validation results
- Coverage metrics

**Run manually:**
```bash
node scripts/collect-gdd-telemetry.js          # Full output
node scripts/collect-gdd-telemetry.js --ci     # CI mode (silent)
node scripts/collect-gdd-telemetry.js --verbose # Detailed output
```

---

## Key Metrics Tracked

| Metric | Target | Description |
|--------|--------|-------------|
| Health Score | ≥95 | Overall system health |
| Drift Risk | <25 | Average drift risk across nodes |
| Stability Index | ≥90 | Combined health + drift + repair |
| Auto-Fix Success | ≥90% | Successful auto-repairs |
| Momentum | >0 | Trend over time (improving/declining) |

---

## Outputs

**1. JSON Snapshot:** `telemetry/snapshots/gdd-metrics-history.json`
- Historical data (90 days retention)
- All metrics + timestamps
- Momentum calculations

**2. Markdown Reports:** `telemetry/reports/gdd-telemetry-YYYY-MM-DD.md`
- Daily summary reports
- Trend analysis
- Alert notifications

**3. Watch Integration:**
```bash
node scripts/watch-gdd.js  # Now includes telemetry section
```

Displays:
- 📈 Latest momentum (improving/declining/stable)
- 🔢 Stability index
- 📊 Total snapshots

---

## CI/CD Integration

**Workflow:** `.github/workflows/gdd-telemetry.yml`

**Schedule:** Daily at 00:00 UTC

**Actions:**
1. Run validation, health scoring, drift prediction
2. Collect telemetry snapshot
3. Auto-commit data to repo
4. Upload artifacts (30 days retention)
5. Create issues if status == CRITICAL

**Manual trigger:** Available via GitHub Actions UI

---

## Configuration

**File:** `telemetry-config.json`

```json
{
  "interval_hours": 24,
  "min_health_for_report": 95,
  "include_auto_fixes": true,
  "generate_markdown_report": true,
  "retention_days": 90,
  "alert_thresholds": {
    "health_below": 90,
    "drift_above": 40,
    "auto_fix_success_below": 80
  }
}
```

---

[← Back to CLAUDE.md](../CLAUDE.md) | [View All GDD Documentation](./GDD-IMPLEMENTATION-SUMMARY.md)
