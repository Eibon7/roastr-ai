# Shield Flow Validation Evidence

This directory contains evidence artifacts for Shield automated moderation flow validation (Issue #487).

## Evidence Files

### Naming Convention

All evidence files use timestamp format: `YYYY-MM-DD-HH-MM-SS`

### File Types

| File Pattern | Description | Example |
|--------------|-------------|---------|
| `logs-<timestamp>.json` | Execution logs with test case results | `logs-2025-10-20-14-30-25.json` |
| `db-dump-shield-events-<timestamp>.json` | Database dump of `shield_events` table | `db-dump-shield-events-2025-10-20-14-30-25.json` |
| `db-dump-offender-profiles-<timestamp>.json` | Database dump of `offender_profiles` table | `db-dump-offender-profiles-2025-10-20-14-30-25.json` |
| `metrics-<timestamp>.json` | Performance metrics (execution time, API latency, queue processing) | `metrics-2025-10-20-14-30-25.json` |
| `VALIDATION.md` | Comprehensive validation report (main deliverable) | `VALIDATION.md` |
| `screenshots/*.png` | Dashboard screenshots (optional Phase 4) | `screenshots/dashboard-full.png` |

## VALIDATION.md Structure

The validation report includes:

- **Summary:** Date, validator, environment, overall result (PASS/FAIL)
- **Test Cases Executed:** 15 test cases (9 decision matrix + 6 edge cases)
- **Performance Metrics:** Execution time (<3s), API latency (<5s), queue processing (<1s)
- **Evidence Links:** References to logs, DB dumps, screenshots
- **Recommendations:** Next steps, concerns, follow-up actions

## Test Cases Coverage

### Decision Matrix (9 combinations)

| Test ID | Toxicity | User Risk | Expected Action | Platform |
|---------|----------|-----------|----------------|----------|
| DM-01 | 0.98 | Low | Block + Report | Twitter |
| DM-02 | 0.98 | High | Block + Report | YouTube |
| DM-03 | 0.96 | Low | Mute/Timeout | Discord |
| DM-04 | 0.96 | Medium | Mute/Timeout | Instagram |
| DM-05 | 0.96 | High | Block | Reddit |
| DM-06 | 0.91 | Low | Monitor + Roast | Facebook |
| DM-07 | 0.91 | Medium | Monitor + Roast | Twitch |
| DM-08 | 0.91 | High | Mute | TikTok |
| DM-09 | 0.85 | Any | No Action | Bluesky |

### Edge Cases (6 scenarios)

| Test ID | Scenario | Expected Outcome |
|---------|----------|------------------|
| EDGE-01 | Platform API timeout (>5s) | Action marked failed, retry queued |
| EDGE-02 | Duplicate action (same comment ID) | Second action skipped (idempotency) |
| EDGE-03 | Queue priority | Shield actions processed before roast generation |
| EDGE-04 | Database write failure | Transaction rolled back, error logged |
| EDGE-05 | Offender history at threshold | Risk level escalated correctly |
| EDGE-06 | Multiple platforms (same user) | Actions executed independently |

## Performance Requirements

| Metric | Requirement | Measurement Method |
|--------|-------------|-------------------|
| **Total Execution Time** | <3s | `Date.now()` diff (start → end) |
| **Platform API Call** | <5s timeout | Axios timeout config + actual duration |
| **Queue Processing** | <1s | Worker pickup time - job creation time |
| **Database Write** | <500ms | Query execution time from logs |

## GDPR Compliance

- `original_text` field is only stored for Shield-moderated comments
- Text is anonymized after 80 days (GDPR requirement)
- All evidence respects data retention policies
- Sensitive data (user IDs, email addresses) are hashed in logs

## Validation Workflow

1. **Run validation script:**
   ```bash
   node scripts/validate-flow-shield.js --full
   ```

2. **Review evidence files:**
   - Check logs for test case results
   - Verify DB dumps show correct actions
   - Review metrics for performance compliance

3. **Complete VALIDATION.md:**
   - Add actual results from test run
   - Document any failures or concerns
   - Provide recommendations for next steps

4. **Commit evidence:**
   ```bash
   git add docs/test-evidence/flow-shield/
   git commit -m "docs: Add Shield flow validation evidence - Issue #487"
   ```

## Related Documentation

- **Issue:** #487
- **Implementation Plan:** `docs/plan/issue-487.md`
- **Assessment:** `docs/assessment/issue-487.md`
- **GDD Nodes:** `docs/nodes/shield.md`, `docs/nodes/guardian.md`

---

**Created:** 2025-10-20
**Purpose:** Shield Automated Moderation Flow Validation (Issue #487)
**Status:** In progress
