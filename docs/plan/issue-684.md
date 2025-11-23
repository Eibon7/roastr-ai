# Implementation Plan: Issue #684

**Title:** Shield Escalation Tests - Phase 5: Remaining 40% (Tests 1,2,3,11,12,14)
**Parent Issue:** #482
**Parent PR:** #682/#686 (fix/issue-653)
**Branch:** fix/issue-684
**Date:** 2025-10-29
**Status:** 9/15 tests passing (60%) → Target: 15/15 (100%)

---

## 1. Current State Assessment

### ✅ Passing Tests (9/15)

- Test 4: Time-based escalation decay
- Test 5: Cooling-off period violations
- Test 6: Time window escalation
- Test 7: Cross-platform aggregation
- Test 8: Platform-specific policies
- Test 9: Organization-specific configs
- Test 10: Special user types
- Test 13: Concurrent escalation
- Test 15: Performance thresholds

### ❌ Failing Tests (6/15)

- **Test 1**: Basic escalation path (Step 2 fails)
- **Test 2**: Severity-based immediate escalation
- **Test 3**: Violation frequency tracking
- **Test 11**: Emergency escalation procedures
- **Test 12**: Legal compliance requirements
- **Test 14**: Missing/corrupted behavior data

---

## 2. Root Cause Analysis

### **Pattern 1: Action Matrix Mismatches (Tests 1, 2, 11, 12)**

**File:** `src/services/shieldService.js:50-71`

**Current Matrix:**

```javascript
this.actionMatrix = {
  low: {
    first: 'warn', // ✅ OK
    repeat: 'mute_temp', // ❌ Should be 'warn'
    persistent: 'mute_permanent'
  },
  medium: {
    first: 'mute_temp', // ✅ OK
    repeat: 'mute_permanent',
    persistent: 'block'
  },
  high: {
    first: 'mute_permanent',
    repeat: 'block',
    persistent: 'report' // ✅ OK
  },
  critical: {
    first: 'block', // ❌ Should be 'report'
    repeat: 'report',
    persistent: 'escalate'
  }
};
```

**Required Matrix (with 'dangerous' level):**

```javascript
this.actionMatrix = {
  low: {
    first: 'warn',
    repeat: 'warn', // ✅ FIX: was 'mute_temp'
    persistent: 'mute_temp',
    dangerous: 'mute_permanent' // ✅ ADD
  },
  medium: {
    first: 'mute_temp',
    repeat: 'mute_permanent',
    persistent: 'block',
    dangerous: 'report' // ✅ ADD
  },
  high: {
    first: 'mute_permanent',
    repeat: 'block',
    persistent: 'report',
    dangerous: 'escalate' // ✅ ADD
  },
  critical: {
    first: 'report', // ✅ FIX: was 'block'
    repeat: 'report',
    persistent: 'escalate',
    dangerous: 'escalate' // ✅ ADD
  }
};
```

**Changes Required:**

1. Fix `low.repeat`: 'mute_temp' → 'warn'
2. Fix `critical.first`: 'block' → 'report'
3. Add `dangerous` level to all severity tiers

---

### **Pattern 2: Offense Level Thresholds (Test 1)**

**File:** `src/services/shieldService.js:316-322`

**Current Logic:**

```javascript
let offenseLevel = 'first';
if (violationCount >= this.options.reincidenceThreshold) {
  // Default: 3
  offenseLevel = 'persistent';
} else if (violationCount > 0) {
  offenseLevel = 'repeat';
}
```

**Test 1 Expectations:**
| Step | Violations | Severity | Expected Level | Expected Action |
|------|------------|----------|----------------|-----------------|
| 1 | 0 | low | first | warn |
| 2 | 1 | low | repeat | warn |
| 3 | 2 | medium | persistent | mute_temp |
| 4 | 3 | medium | persistent | mute_permanent |
| 5 | 4 | high | persistent | block |
| 6 | 5 | critical | **dangerous** | report |

**Required Logic:**

```javascript
let offenseLevel;
if (violationCount === 0) {
  offenseLevel = 'first';
} else if (violationCount === 1) {
  offenseLevel = 'repeat';
} else if (violationCount >= 2 && violationCount < 5) {
  offenseLevel = 'persistent';
} else {
  // violationCount >= 5
  offenseLevel = 'dangerous';
}
```

**Thresholds:**

- 0 violations → `first`
- 1 violation → `repeat`
- 2-4 violations → `persistent`
- 5+ violations → `dangerous`

---

### **Pattern 3: Missing Emergency/Legal Compliance Flags (Tests 11, 12)**

**File:** `src/services/shieldService.js:300-400` (determineShieldActions)

**Currently Missing:**

- No handling of `analysisResult.immediate_threat`
- No handling of `analysisResult.emergency_keywords`
- No handling of `analysisResult.legal_compliance_trigger`
- No handling of `analysisResult.jurisdiction`

**Required Implementation (add after line 361):**

```javascript
// Emergency escalation (Test 11)
if (analysisResult.immediate_threat || analysisResult.emergency_keywords?.length > 0) {
  return {
    primary: 'report',
    offenseLevel,
    severity: severity_level,
    escalate: true,
    emergency: true,
    notify_authorities: true,
    autoExecute: true,
    reason: 'emergency_escalation'
  };
}

// Legal compliance (Test 12)
if (analysisResult.legal_compliance_trigger) {
  return {
    primary: 'report',
    offenseLevel,
    severity: severity_level,
    escalate: true,
    legal_compliance: true,
    jurisdiction: analysisResult.jurisdiction || 'UNKNOWN',
    autoExecute: true,
    reason: 'legal_compliance'
  };
}
```

**Test Expectations:**

- **Test 11**: Expects `emergency: true`, `notify_authorities: true`
- **Test 12**: Expects `legal_compliance: true`, `jurisdiction: 'EU'`

---

### **Pattern 4: Corrupted Data Handling (Test 14)**

**File:** `src/services/shieldService.js:300-362` (determineShieldActions)

**Test Scenario:**

```javascript
// Mock corrupted behavior data
data: {
  total_violations: null,
  actions_taken: 'invalid_json_string',  // Should be array
  last_seen_at: 'invalid_date'
}
```

**Expected Behavior:**

- Treat as first-time user: `offenseLevel: 'first'`
- Fall back to safest action: `action: 'warn'` (low severity default)
- No crashes, graceful degradation

**Required Implementation (add at line 301-302):**

```javascript
async determineShieldActions(analysisResult, userBehavior, comment) {
  let { severity_level } = analysisResult;

  // Validate userBehavior data (Test 14: corrupted data handling)
  let violationCount = 0;
  let isDataCorrupted = false;

  if (typeof userBehavior.total_violations !== 'number' || userBehavior.total_violations === null) {
    isDataCorrupted = true;
    violationCount = 0;
  } else {
    violationCount = userBehavior.total_violations;
  }

  // Ensure actions_taken is an array
  if (!Array.isArray(userBehavior.actions_taken)) {
    isDataCorrupted = true;
    userBehavior.actions_taken = [];
  }

  // For corrupted data, fall back to safest defaults
  if (isDataCorrupted) {
    severity_level = 'low';  // Override to low severity
    this.log('warn', 'Corrupted user behavior data detected, using safe defaults', {
      userId: comment.platform_user_id,
      platform: comment.platform,
      originalViolations: userBehavior.total_violations,
      fallbackSeverity: 'low'
    });
  }

  // ... rest of method
}
```

---

### **Pattern 5: Violation Counting (Test 3) - NO FIX NEEDED**

**Test 3 Analysis:**
Test expects `userBehavior.total_violations: 3` when mock provides 3 prior violations.

**Investigation:**

- Mock data correctly provides: `total_violations: 3`
- Test uses `createUserBehaviorData({ violationCount: 3 })`
- Mock factory sets: `total_violations: violationCount`
- `getUserBehavior` returns mock data as-is

**Conclusion:**
Test 3 should PASS once action matrix is fixed. The violation count is correct; the test failure is due to **wrong action type** caused by incorrect offense level thresholds.

Test 3 expects (line 280):

```javascript
expect(['mute_permanent', 'block']).toContain(result.actions.primary);
```

With 3 violations, medium severity:

- Current: violations=3 → persistent, medium → block ✅
- After fix: violations=3 → persistent, medium → block ✅

So Test 3 should pass automatically once offense level logic is fixed.

---

## 3. Implementation Steps

### **Phase 1: Fix Action Matrix**

**File:** `src/services/shieldService.js:50-71`

**Changes:**

1. Add `dangerous` level to all 4 severity tiers
2. Fix `low.repeat`: 'mute_temp' → 'warn'
3. Fix `critical.first`: 'block' → 'report'

**Validation:**

```bash
grep -A 5 "actionMatrix = {" src/services/shieldService.js
```

---

### **Phase 2: Fix Offense Level Thresholds**

**File:** `src/services/shieldService.js:316-322`

**Replace:**

```javascript
// Determine offense level
let offenseLevel = 'first';
if (violationCount >= this.options.reincidenceThreshold) {
  offenseLevel = 'persistent';
} else if (violationCount > 0) {
  offenseLevel = 'repeat';
}
```

**With:**

```javascript
// Determine offense level based on violation count
let offenseLevel;
if (violationCount === 0) {
  offenseLevel = 'first';
} else if (violationCount === 1) {
  offenseLevel = 'repeat';
} else if (violationCount >= 2 && violationCount < 5) {
  offenseLevel = 'persistent';
} else {
  // violationCount >= 5
  offenseLevel = 'dangerous';
}
```

**Affected Code Blocks:**

- Lines 316-322: Initial offense level determination
- Lines 325-346: Time window modifiers (keep as-is, they adjust offense level)
- Lines 349-358: Cooling-off period escalation (keep as-is)

---

### **Phase 3: Add Emergency/Legal Compliance Handling**

**File:** `src/services/shieldService.js:300-400`

**Insert after line 361** (before `let actionType = this.actionMatrix...`):

```javascript
// Emergency escalation procedures (Test 11)
if (analysisResult.immediate_threat || analysisResult.emergency_keywords?.length > 0) {
  this.log('critical', 'Emergency escalation triggered', {
    userId: comment.platform_user_id,
    platform: comment.platform,
    immediate_threat: analysisResult.immediate_threat,
    emergency_keywords: analysisResult.emergency_keywords
  });

  return {
    primary: 'report',
    offenseLevel,
    severity: severity_level,
    escalate: true,
    emergency: true,
    notify_authorities: true,
    autoExecute: true,
    reason: 'emergency_escalation'
  };
}

// Legal compliance requirements (Test 12)
if (analysisResult.legal_compliance_trigger) {
  this.log('warn', 'Legal compliance escalation triggered', {
    userId: comment.platform_user_id,
    platform: comment.platform,
    jurisdiction: analysisResult.jurisdiction,
    requires_reporting: analysisResult.requires_reporting
  });

  return {
    primary: 'report',
    offenseLevel,
    severity: severity_level,
    escalate: true,
    legal_compliance: true,
    jurisdiction: analysisResult.jurisdiction || 'UNKNOWN',
    autoExecute: true,
    reason: 'legal_compliance'
  };
}
```

---

### **Phase 4: Add Corrupted Data Handling**

**File:** `src/services/shieldService.js:300-362`

**Replace lines 300-302:**

```javascript
async determineShieldActions(analysisResult, userBehavior, comment) {
  const { severity_level } = analysisResult;
  const violationCount = userBehavior.total_violations || 0;
```

**With:**

```javascript
async determineShieldActions(analysisResult, userBehavior, comment) {
  let { severity_level } = analysisResult;

  // Validate userBehavior data (Test 14: corrupted data handling)
  let violationCount = 0;
  let isDataCorrupted = false;

  if (typeof userBehavior.total_violations !== 'number' ||
      userBehavior.total_violations === null ||
      isNaN(userBehavior.total_violations)) {
    isDataCorrupted = true;
    violationCount = 0;
  } else {
    violationCount = userBehavior.total_violations;
  }

  // Ensure actions_taken is an array
  if (!Array.isArray(userBehavior.actions_taken)) {
    isDataCorrupted = true;
    userBehavior.actions_taken = [];
  }

  // Validate last_seen_at is a valid date
  if (userBehavior.last_seen_at) {
    const lastSeenDate = new Date(userBehavior.last_seen_at);
    if (isNaN(lastSeenDate.getTime())) {
      isDataCorrupted = true;
      userBehavior.last_seen_at = null;
    }
  }

  // For corrupted data, fall back to safest defaults
  if (isDataCorrupted) {
    severity_level = 'low';  // Override to low severity for safety
    this.log('warn', 'Corrupted user behavior data detected, using safe defaults', {
      userId: comment.platform_user_id,
      platform: comment.platform,
      originalViolations: userBehavior.total_violations,
      fallbackSeverity: 'low',
      fallbackViolations: 0
    });
  }
```

---

## 4. Files Affected

**Production Code:**

- [ ] `src/services/shieldService.js`
  - Lines 50-71: Action matrix (add dangerous, fix low.repeat, fix critical.first)
  - Lines 300-362: determineShieldActions (add validation, emergency, legal)
  - Lines 316-322: Offense level thresholds (fix logic)

**Tests:**

- [x] `tests/integration/shield-escalation-logic.test.js` (no changes, will verify)

**Documentation:**

- [ ] `docs/plan/issue-684.md` (this file)
- [ ] `docs/SUMMARY-684.md` (create after implementation)

---

## 5. Testing Strategy

### **Test Execution Order:**

```bash
# Run specific failing tests first
npm test -- tests/integration/shield-escalation-logic.test.js -t "should follow escalation path"
npm test -- tests/integration/shield-escalation-logic.test.js -t "should handle severity-based immediate escalation"
npm test -- tests/integration/shield-escalation-logic.test.js -t "should apply escalation based on violation frequency"
npm test -- tests/integration/shield-escalation-logic.test.js -t "should trigger emergency escalation"
npm test -- tests/integration/shield-escalation-logic.test.js -t "should bypass normal escalation for legal"
npm test -- tests/integration/shield-escalation-logic.test.js -t "should handle escalation with missing or corrupted"

# Then run full suite
npm test -- tests/integration/shield-escalation-logic.test.js
```

### **Expected Results:**

- **Before:** 9/15 tests passing (60%)
- **After:** 15/15 tests passing (100%)

### **Verification Pattern:**

```bash
grep -n "actionMatrix" src/services/shieldService.js | head -20
grep -n "offenseLevel =" src/services/shieldService.js
grep -n "immediate_threat\|legal_compliance" src/services/shieldService.js
```

---

## 6. Risk Assessment

### **Low Risk Changes:**

- ✅ Action matrix values (isolated config)
- ✅ Offense level thresholds (clear logic, well-tested)

### **Medium Risk Changes:**

- ⚠️ Adding 'dangerous' level (affects all severity tiers)
  - **Mitigation:** All passing tests (9/15) don't use dangerous level
  - **Validation:** Verify no existing code references 'dangerous'

### **Low Risk Additions:**

- ✅ Emergency/legal compliance (new feature flags, optional)
- ✅ Corrupted data handling (defensive programming, no behavior change for valid data)

### **Regression Prevention:**

```bash
# Ensure passing tests remain passing
npm test -- tests/integration/shield-escalation-logic.test.js -t "Time-Based Escalation Logic"
npm test -- tests/integration/shield-escalation-logic.test.js -t "Cross-Platform Escalation Tracking"
npm test -- tests/integration/shield-escalation-logic.test.js -t "Configuration-Based Escalation Rules"
npm test -- tests/integration/shield-escalation-logic.test.js -t "Escalation Performance and Edge Cases"
```

---

## 7. Success Criteria

- [ ] All 15 tests passing (100%)
- [ ] Test 1: All 6 steps pass with correct action + offense level
- [ ] Test 2: Critical first-time → 'report' (not 'block')
- [ ] Test 3: Violation count correctly tracked (3 violations → persistent)
- [ ] Test 11: Emergency flags set correctly
- [ ] Test 12: Legal compliance flags set correctly
- [ ] Test 14: Graceful handling of corrupted data
- [ ] No regressions in 9 previously passing tests
- [ ] Code quality: No console.logs, proper logging via this.log()
- [ ] Documentation: SUMMARY-684.md created with evidence

---

## 8. Evidence Requirements

**Generate after implementation:**

1. Test output showing 15/15 passing
2. Before/after comparison of action matrix
3. Log excerpts showing emergency/legal compliance triggers
4. Validation of corrupted data handling

**Format:**

```bash
npm test -- tests/integration/shield-escalation-logic.test.js > docs/test-evidence/issue-684-results.txt
```

**SUMMARY.md Contents:**

- Changes made (file:line references)
- Test results (before/after)
- Risk assessment outcome
- Lessons learned for coderabbit-lessons.md

---

## 9. Implementation Protocol

**Workflow:**

1. ✅ FASE 0: Context loaded
2. ✅ FASE 1: Assessment complete
3. 🔄 FASE 2: Plan created (this document)
4. ⏳ FASE 3: Implement changes
5. ⏳ FASE 4: Run tests (must be 100%)
6. ⏳ FASE 5: Generate evidence + SUMMARY-684.md
7. ⏳ FASE 6: Create PR + agent receipts

**Rules:**

- ❌ NO asking for permission between phases
- ✅ Continue automatically to FASE 3 after plan
- ✅ Mark todos as in_progress → completed in real-time
- ✅ If tests fail, fix immediately (don't move to next phase)

---

## 10. References

- **Parent Issue:** #482 (Shield Escalation Tests - Production Quality)
- **Parent PR:** #682/#686 (Shield Phase 3 Implementation)
- **Related PRs:** #686 (ready to merge with 9/15 passing)
- **Test File:** tests/integration/shield-escalation-logic.test.js
- **Service File:** src/services/shieldService.js
- **GDD Node:** docs/nodes/shield.md
- **Patterns:** docs/patterns/coderabbit-lessons.md

---

**Estimated Time:** 45-60 minutes
**Priority:** P1 (blocking merge of #686)
**Complexity:** Medium (clear requirements, well-defined changes)
