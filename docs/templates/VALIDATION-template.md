# Flow Validation: [Feature Name]

**Issue:** #XXX
**Date:** YYYY-MM-DD
**Validator:** [Name/Agent]
**Environment:** Development | Staging | Production
**Overall Result:** ✅ PASS | ❌ FAIL | ⚠️ PARTIAL

---

## Summary

Brief description of what was validated and why.

**Key Metrics:**

- **Total Test Cases:** X/X passed
- **Execution Time:** X.Xs (requirement: <Ys)
- **Critical Failures:** X
- **Warnings:** X

---

## Test Cases Executed

### Decision Matrix / Core Functionality

| Test ID | Scenario               | Expected Result | Actual Result | Status  | Notes             |
| ------- | ---------------------- | --------------- | ------------- | ------- | ----------------- |
| DM-01   | [Scenario description] | [Expected]      | [Actual]      | ✅ PASS | [Notes if any]    |
| DM-02   | ...                    | ...             | ...           | ❌ FAIL | [Failure reason]  |
| DM-03   | ...                    | ...             | ...           | ⚠️ WARN | [Warning details] |

**Total:** X/X passed (XX%)

### Edge Cases

| Test ID | Scenario   | Expected Result | Actual Result | Status  | Notes   |
| ------- | ---------- | --------------- | ------------- | ------- | ------- |
| EDGE-01 | [Scenario] | [Expected]      | [Actual]      | ✅ PASS | [Notes] |
| EDGE-02 | ...        | ...             | ...           | ✅ PASS | [Notes] |

**Total:** X/X passed (XX%)

---

## Performance Metrics

| Metric                   | Requirement | Actual    | Status  | Notes                    |
| ------------------------ | ----------- | --------- | ------- | ------------------------ |
| **Total Execution Time** | <3s         | 2.8s      | ✅ PASS | Within limits            |
| **API Call Latency**     | <5s timeout | 1.2s avg  | ✅ PASS | Network latency excluded |
| **Queue Processing**     | <1s         | 0.5s      | ✅ PASS | Priority queue working   |
| **Database Write**       | <500ms      | 250ms avg | ✅ PASS | Good performance         |

**Performance Summary:**

- All metrics within acceptable limits
- No performance bottlenecks detected
- Average execution time: X.Xs

---

## Evidence

### Execution Logs

- **File:** `docs/test-evidence/[feature]/logs-YYYY-MM-DD-HH-MM-SS.json`
- **Size:** X KB
- **Test Cases:** X
- **Errors:** X
- **Warnings:** X

### Database Dumps

- **Shield Events:** `db-dump-shield-events-YYYY-MM-DD-HH-MM-SS.json` (X rows)
- **Offender Profiles:** `db-dump-offender-profiles-YYYY-MM-DD-HH-MM-SS.json` (X rows)

### Performance Metrics

- **File:** `metrics-YYYY-MM-DD-HH-MM-SS.json`
- **Execution Time:** X.Xs
- **API Calls:** X requests
- **Database Queries:** X queries

### Screenshots (Optional)

- **Dashboard:** `screenshots/dashboard-full.png`
- **Decision Panel:** `screenshots/decision-panel.png`
- **Timeline:** `screenshots/timeline.png`

---

## Findings

### ✅ Passed Validations

1. **[Validation Name]**
   - Description: [What was validated]
   - Result: [What happened]
   - Evidence: [Reference to logs/dumps]

2. **[Another Validation]**
   - ...

### ❌ Failed Validations

1. **[Failure Name]**
   - **Expected:** [What should happen]
   - **Actual:** [What happened]
   - **Root Cause:** [Why it failed]
   - **Impact:** [Severity and consequences]
   - **Remediation:** [How to fix]
   - **Evidence:** [Reference to logs]

### ⚠️ Warnings

1. **[Warning Name]**
   - **Issue:** [What's the concern]
   - **Impact:** [Potential consequences]
   - **Recommendation:** [Suggested action]

---

## Compliance Checklist

### Functional Requirements

- [ ] Requirement 1: [Description] - ✅ PASS / ❌ FAIL
- [ ] Requirement 2: [Description] - ✅ PASS / ❌ FAIL
- [ ] Requirement 3: [Description] - ✅ PASS / ❌ FAIL

### Technical Requirements

- [ ] Technical Req 1: [Description] - ✅ PASS / ❌ FAIL
- [ ] Technical Req 2: [Description] - ✅ PASS / ❌ FAIL

### Performance Requirements

- [ ] Performance Req 1: [Description] - ✅ PASS / ❌ FAIL
- [ ] Performance Req 2: [Description] - ✅ PASS / ❌ FAIL

### Evidence Requirements

- [ ] Evidence Req 1: [Description] - ✅ PASS / ❌ FAIL
- [ ] Evidence Req 2: [Description] - ✅ PASS / ❌ FAIL

---

## Recommendations

### Immediate Actions Required

1. **[Action Name]** (Priority: Critical/High/Medium/Low)
   - **Issue:** [What needs to be fixed]
   - **Impact:** [Why it matters]
   - **Suggested Fix:** [How to resolve]
   - **Estimated Effort:** [Time estimate]

2. **[Another Action]**
   - ...

### Future Improvements

1. **[Improvement Name]**
   - **Description:** [What could be better]
   - **Benefit:** [Why it's valuable]
   - **Effort:** [Estimated complexity]

2. **[Another Improvement]**
   - ...

### Follow-Up Actions

- [ ] Create issue for [problem found]
- [ ] Update documentation for [issue]
- [ ] Schedule review meeting with [team]
- [ ] Deploy fix for [critical issue]
- [ ] Re-run validation after fixes

---

## Conclusion

**Overall Assessment:** [PASS / FAIL / PARTIAL]

**Summary:**
[Brief summary of validation results - 2-3 sentences explaining whether the feature is ready, what needs to be fixed, and confidence level]

**Approval Status:**

- [ ] ✅ **APPROVED** - Feature is ready for production
- [ ] ⚠️ **APPROVED WITH CONDITIONS** - Feature can proceed with noted fixes
- [ ] ❌ **BLOCKED** - Critical issues must be resolved before proceeding

**Next Steps:**

1. [Immediate next action]
2. [Secondary action]
3. [Follow-up action]

---

## Appendix

### Test Environment

- **Node Version:** vX.X.X
- **Database:** PostgreSQL X.X (Supabase)
- **APIs:**
  - Perspective API: Configured
  - OpenAI API: Configured
  - Platform APIs: [List which ones]

### Configuration

```json
{
  "testMode": true,
  "mockExternalAPIs": false,
  "useRealDatabase": true,
  "performanceTracking": true
}
```

### Known Limitations

1. [Limitation 1 - why it exists and impact]
2. [Limitation 2 - ...]

### Related Documentation

- **Issue:** #XXX
- **Implementation Plan:** `docs/plan/issue-XXX.md`
- **Assessment:** `docs/assessment/issue-XXX.md`
- **GDD Nodes:** `docs/nodes/[relevant-nodes].md`

---

**Validation Date:** YYYY-MM-DD
**Validator:** [Name/Agent]
**Review Date:** YYYY-MM-DD
**Approved By:** [Name] (if applicable)
**Version:** 1.0
