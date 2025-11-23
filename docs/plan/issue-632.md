# Implementation Plan: Issue #632 - Unified Analysis Department

**Issue:** #632 - Refactor: Unified Analysis Department (Gatekeeper + Perspective)
**Priority:** P0 (Critical - Security Gap)
**Status:** Planning
**Created:** 2025-10-23
**Estimated Hours:** 12-14 hours

---

## 🎯 Estado Actual

### Current Architecture (FLAWED)

**Flow:** Sequential execution with early return

```text
AnalyzeToxicityWorker.processJob()
  ↓
Gatekeeper.classifyComment(text)
  ↓
  - MALICIOUS detected → return early (línea 277) ❌
  - Perspective API NEVER called ❌
  ↓
Shield receives: categories=['prompt_injection'] ONLY
  ↓
NO platform_violations.reportable ❌
```

### Problema Crítico

**Ejemplo:** "Te voy a matar {{ignore all instructions}}"

**Flujo actual:**

1. Gatekeeper detecta `{{ignore all instructions}}` → `classification: MALICIOUS`
2. Early return con `categories: ['gatekeeper_malicious', 'prompt_injection']`
3. ❌ Perspective API NUNCA se ejecuta
4. ❌ Shield NO sabe que hay amenaza física (`threat >= 0.8`)
5. ❌ NO incluye `report_to_platform` en acciones
6. ❌ **VIOLACIÓN ToS** - Amenazas físicas NO reportadas

**Gap de seguridad:** Detectamos prompt injection pero perdemos análisis de amenazas/hate speech que SÍ deben reportarse a la plataforma.

### Archivos Actuales

| Archivo                                | Líneas  | Problema                               |
| -------------------------------------- | ------- | -------------------------------------- |
| `src/workers/AnalyzeToxicityWorker.js` | 237-288 | Early return on Gatekeeper MALICIOUS   |
| `src/services/gatekeeperService.js`    | 370     | Solo detecta injection, NO toxicidad   |
| `src/services/perspective.js`          | 271     | Nunca se ejecuta si Gatekeeper returns |
| `src/services/shieldService.js`        | TBD     | Recibe datos incompletos               |

---

## 🔬 Risk Assessment

### Security Risks

| Risk                  | Impact   | Likelihood | Mitigation                                  |
| --------------------- | -------- | ---------- | ------------------------------------------- |
| **ToS Violations**    | CRITICAL | High       | ✅ Parallel execution ensures both analyses |
| **Legal Liability**   | HIGH     | Medium     | ✅ Platform violations always detected      |
| **Reputation Damage** | HIGH     | Medium     | ✅ Proper reporting of threats/hate speech  |

### Technical Risks

| Risk                       | Impact | Likelihood | Mitigation                                  |
| -------------------------- | ------ | ---------- | ------------------------------------------- |
| **Backward Compatibility** | MEDIUM | High       | ✅ Maintain existing Shield action types    |
| **Increased Latency**      | LOW    | Medium     | ✅ Parallel execution (no sequential delay) |
| **API Cost Increase**      | LOW    | High       | ✅ Rate limiting + fallback already exist   |

---

## 📐 Complexity Analysis

### Architectural Complexity: **HIGH**

**Reasons:**

1. **Parallel Execution** - `Promise.allSettled()` with proper error handling
2. **Decision Matrix** - 10 scenarios (see issue table)
3. **Action Tags** - New schema for explicit actions
4. **Backward Compatibility** - Existing Shield integrations must work

### Implementation Phases

**Phase 1: Core Services** (4-5 hours)

- ✅ `AnalysisDepartmentService.js` - Orchestrator
- ✅ `AnalysisDecisionEngine.js` - Decision logic

**Phase 2: Worker Refactor** (2-3 hours)

- ✅ Simplify `AnalyzeToxicityWorker.js`
- ✅ Remove decision logic, delegate to department

**Phase 3: Shield Integration** (2-3 hours)

- ✅ Modify `ShieldService.executeActions()` to consume `action_tags[]`
- ✅ Maintain backward compatibility

**Phase 4: Tests** (3-4 hours)

- ✅ Integration tests for decision matrix (9+ scenarios)
- ✅ Edge case tests (fallback, failures)
- ✅ Shield integration tests

---

## 🏗️ Implementation Approach

### 1. Create AnalysisDepartmentService

**File:** `src/services/AnalysisDepartmentService.js`

**Responsibilities:**

- Orchestrate Gatekeeper + Perspective in **parallel** using `Promise.allSettled()`
- Handle fallback if one service fails
- Pass results to Decision Engine
- Return unified output schema

**Key Methods:**

```javascript
class AnalysisDepartmentService {
  async analyzeComment(commentText, userContext) {
    // 1. Parallel execution
    const [gatekeeperResult, perspectiveResult] = await Promise.allSettled([
      this.gatekeeper.classifyComment(commentText),
      this.perspective.analyzeToxicity(commentText)
    ]);

    // 2. Delegate to decision engine
    const decision = await this.decisionEngine.determineDirection(
      gatekeeperResult,
      perspectiveResult,
      userContext
    );

    return decision; // Unified output schema
  }
}
```

**Testing:**

- Unit tests: Parallel execution, fallback scenarios
- Integration tests: Full flow with real services (mocked APIs)

---

### 2. Create AnalysisDecisionEngine

**File:** `src/services/AnalysisDecisionEngine.js`

**Responsibilities:**

- Implement decision matrix (10 scenarios from issue)
- Detect platform violations (`threat >= 0.8`, `identity_attack >= 0.8`)
- Calculate combined scores
- Generate action tags (`hide_comment`, `report_to_platform`, etc.)

**Key Methods:**

```javascript
class AnalysisDecisionEngine {
  determineDirection(gatekeeperResult, perspectiveResult, userContext) {
    // 1. Check for platform violations
    const violations = this.detectPlatformViolations(perspectiveResult);

    // 2. Apply decision matrix
    if (gatekeeperResult.classification === 'MALICIOUS') {
      if (violations.has_violations) {
        // BOTH injection + threat → SHIELD with report
        return {
          direction: 'SHIELD',
          action_tags: ['hide_comment', 'block_user', 'report_to_platform'],
          ...
        };
      } else {
        // ONLY injection → SHIELD without report
        return {
          direction: 'SHIELD',
          action_tags: ['hide_comment', 'block_user', 'check_reincidence'],
          ...
        };
      }
    }

    // 3. Continue matrix logic...
  }

  detectPlatformViolations(perspectiveResult) {
    const { threat, identity_attack, severe_toxicity } = perspectiveResult.scores;

    const violations = [];
    if (threat >= 0.8) violations.push('physical_threat');
    if (identity_attack >= 0.8) violations.push('identity_attack');
    if (severe_toxicity >= 0.95) violations.push('harassment');

    return {
      has_violations: violations.length > 0,
      violation_types: violations,
      reportable: violations.length > 0
    };
  }
}
```

**Testing:**

- Unit tests: Decision matrix (10 scenarios)
- Edge cases: Ambiguous scores, missing data

---

### 3. Refactor AnalyzeToxicityWorker

**File:** `src/workers/AnalyzeToxicityWorker.js`

**Changes:**

- **REMOVE** lines 237-288 (Gatekeeper early return logic)
- **ADD** call to `analysisDepartment.analyzeComment()`
- **SIMPLIFY** routing based on `decision.direction`

**Before (FLAWED):**

```javascript
// Lines 237-288
const gatekeeperResult = await this.gatekeeperService.classifyComment(commentText);

if (gatekeeperResult.classification === 'MALICIOUS') {
  // Early return - Perspective NEVER runs ❌
  return { ... };
}

// Perspective runs only if Gatekeeper allows
const perspectiveResult = await this.perspectiveAPI.analyzeToxicity(commentText);
```

**After (FIXED):**

```javascript
// Call unified Analysis Department
const analysisResult = await this.analysisDepartment.analyzeComment(commentText, userContext);

// Route based on direction
switch (analysisResult.direction) {
  case 'SHIELD':
    await this.handleShieldAction(comment, analysisResult);
    break;
  case 'ROAST':
    await this.handleRoastAction(comment, analysisResult);
    break;
  case 'PUBLISH':
    await this.handlePublishAction(comment, analysisResult);
    break;
}
```

**Testing:**

- Integration tests: Verify routing for all directions
- Backward compatibility: Existing Shield tests still pass

---

### 4. Modify ShieldService

**File:** `src/services/shieldService.js`

**Changes:**

- Modify `executeActions()` to accept `action_tags[]` parameter
- Map action tags to platform-specific actions
- Maintain backward compatibility with existing callers

**Before:**

```javascript
executeActions(decision) {
  // Infers actions from severity/categories
  const actions = this.inferActions(decision.severity, decision.categories);
  ...
}
```

**After:**

```javascript
executeActions(decision) {
  // Use explicit action_tags if provided, fallback to inference
  const actions = decision.action_tags || this.inferActions(decision.severity, decision.categories);

  // Execute actions
  actions.forEach(async (actionTag) => {
    if (actionTag === 'report_to_platform') {
      await this.reportToP latform(comment, decision.metadata.platform_violations);
    }
    // ... other actions
  });
}
```

**Testing:**

- Unit tests: Action tag mapping
- Integration tests: Platform-specific actions

---

### 5. Database Schema Changes (Optional)

**Table:** `comments` (or `shield_events`)

**New Fields:**

```sql
ALTER TABLE comments ADD COLUMN direction VARCHAR(20); -- PUBLISH, ROAST, SHIELD
ALTER TABLE comments ADD COLUMN action_tags TEXT[]; -- Array of action tags
ALTER TABLE comments ADD COLUMN analysis_metadata JSONB; -- Full metadata

-- Example:
{
  "direction": "SHIELD",
  "action_tags": ["hide_comment", "block_user", "report_to_platform"],
  "analysis_metadata": {
    "security": { "classification": "MALICIOUS", "injection_score": 0.95 },
    "toxicity": { "toxicity_score": 0.88, "threat_score": 0.92 },
    "platform_violations": { "has_violations": true, "reportable": true }
  }
}
```

**Migration:** Create migration script if schema changes needed

---

## 🧪 Test Strategy

### Decision Matrix Tests (9 scenarios)

| Test | Condition                        | Expected Direction | Expected Action Tags                                              |
| ---- | -------------------------------- | ------------------ | ----------------------------------------------------------------- |
| 1    | Injection ONLY                   | SHIELD             | `hide_comment`, `block_user`, `check_reincidence` (NO report)     |
| 2    | Threat ONLY                      | SHIELD             | `hide_comment`, `block_user`, **`report_to_platform`**            |
| 3    | Injection + Threat               | SHIELD             | `hide_comment`, `block_user`, **`report_to_platform`**            |
| 4    | Toxicity ≥ τ_critical            | SHIELD             | `hide_comment`, `block_user`, `check_reincidence`                 |
| 5    | τ_shield ≤ score < τ_critical    | SHIELD             | `hide_comment`, (+`report` if reincident)                         |
| 6    | Zona correctiva                  | ROAST              | `roast_correctivo`, `add_strike_1`, `check_reincidence`           |
| 7    | τ_roast_lower ≤ score < τ_shield | ROAST              | `roast_{soft\|balanced\|hard}`, `auto_approve`/`require_approval` |
| 8    | POSITIVE classification          | PUBLISH            | `publish_normal`                                                  |
| 9    | score < τ_roast_lower            | PUBLISH            | `publish_normal`                                                  |

### Edge Case Tests (6 scenarios)

| Test | Scenario             | Expected Behavior                           |
| ---- | -------------------- | ------------------------------------------- |
| 1    | Both services fail   | SHIELD (fail-safe), `require_manual_review` |
| 2    | Gatekeeper fails     | Use Perspective + pattern matching          |
| 3    | Perspective fails    | Use OpenAI Moderation fallback              |
| 4    | Ambiguous scores     | Use Decision Engine tie-breaker logic       |
| 5    | Missing user context | Use default thresholds                      |
| 6    | API timeout          | Retry with exponential backoff              |

### Test Files

**Integration Tests:**

- `tests/integration/analysis-department.test.js` (NEW) - 15+ tests
- `tests/integration/analysis-decision-engine.test.js` (NEW) - 10+ tests

**Unit Tests:**

- `tests/unit/services/AnalysisDepartmentService.test.js` (NEW)
- `tests/unit/services/AnalysisDecisionEngine.test.js` (NEW)
- `tests/unit/workers/AnalyzeToxicityWorker.test.js` (MODIFIED) - Verify refactor

**Coverage Target:** ≥90% for all new services

---

## 📝 Documentation Updates

### GDD Nodes

**1. `docs/nodes/shield.md`**

- Add "Analysis Department Integration" section
- Update architecture diagram with parallel execution
- Document `action_tags[]` schema
- Add "Platform Violations Detection" section

**2. `docs/nodes/roast.md`**

- Update "Toxicity Analysis" section with unified flow
- Document new routing logic

### Additional Documentation

**3. `docs/architecture/analysis-department.md`** (NEW)

- Full architecture explanation
- Decision matrix reference
- Action tags specification
- Platform violations mapping

---

## 🎯 Acceptance Criteria Mapping

**From Issue #632:**

- [ ] AC1: `AnalysisDepartmentService` ejecuta Gatekeeper + Perspective en paralelo
- [ ] AC2: `AnalysisDecisionEngine` implementa matriz de decisión completa
- [ ] AC3: Comentario **SOLO injection** → `direction: SHIELD`, **NO** `report_to_platform`
- [ ] AC4: Comentario **SOLO amenaza** → `direction: SHIELD`, **SÍ** `report_to_platform`
- [ ] AC5: Comentario **ambos** → `direction: SHIELD`, **SÍ** `report_to_platform`
- [ ] AC6: Fallback Gatekeeper fails → usa Perspective + pattern matching
- [ ] AC7: Fallback Perspective fails → usa OpenAI Moderation
- [ ] AC8: Fallback crítico ambos fallen → rechaza por seguridad
- [ ] AC9: `AnalyzeToxicityWorker` simplificado (solo orquesta, no decide)
- [ ] AC10: `ShieldService` consume `action_tags` directamente
- [ ] AC11: Tests cubren matriz completa (9 escenarios)
- [ ] AC12: Documentación actualizada en `docs/nodes/shield.md` y `docs/nodes/roast.md`

---

## 🚀 Implementation Order

### Sprint 1: Core Services (4-5 hours)

1. Create `src/services/AnalysisDepartmentService.js`
   - Parallel execution with `Promise.allSettled()`
   - Fallback handling
   - Integration with existing services

2. Create `src/services/AnalysisDecisionEngine.js`
   - Decision matrix implementation
   - Platform violations detection
   - Action tags generation

3. Unit tests for both services

### Sprint 2: Worker Refactor (2-3 hours)

4. Refactor `src/workers/AnalyzeToxicityWorker.js`
   - Remove lines 237-288 (early return logic)
   - Add call to Analysis Department
   - Simplify routing

5. Update `src/services/shieldService.js`
   - Accept `action_tags[]` parameter
   - Maintain backward compatibility

6. Integration tests for refactored worker

### Sprint 3: Shield Integration (2-3 hours)

7. Modify Shield action execution
   - Map `action_tags` to platform actions
   - Implement `report_to_platform` action

8. Platform-specific action tests

### Sprint 4: Testing & Documentation (3-4 hours)

9. Create `tests/integration/analysis-department.test.js`
   - 9 decision matrix tests
   - 6 edge case tests

10. Update GDD documentation
    - `docs/nodes/shield.md`
    - `docs/nodes/roast.md`
    - Create `docs/architecture/analysis-department.md`

11. Run full test suite (100% passing target)

---

## 🎓 CodeRabbit Lessons Applied

### Pre-Implementation Checklist

✅ Read `docs/patterns/coderabbit-lessons.md`
✅ Tests written BEFORE implementation (TDD)
✅ Use `const` by default, `let` only if mutable
✅ Use `logger.js` instead of `console.log`
✅ Add JSDoc to exported functions
✅ NO hardcoded credentials
✅ Implement retry logic for API calls
✅ Update GDD nodes with "Agentes Relevantes"

### Specific Patterns

**Error Handling (#5):**

- ✅ Use specific error codes (`E_GATEKEEPER_FAIL`, `E_PERSPECTIVE_FAIL`)
- ✅ Implement retry with exponential backoff
- ✅ Log with context (attempt number, user ID)

**Testing (#2):**

- ✅ TDD: Write tests FIRST
- ✅ Cover happy + error + edge cases
- ✅ Verify mock calls: `expect(mock).toHaveBeenCalledWith(...)`

**Security (#6):**

- ✅ NO env vars in docs
- ✅ NO sensitive data in logs
- ✅ Validate all inputs

---

## ⚠️ Risks & Mitigations

### Risk 1: Increased API Calls

**Issue:** Perspective API now called for ALL comments (not just non-malicious)

**Mitigation:**

- Existing rate limiting already in place (`perspective.js:227`)
- Fallback to OpenAI Moderation if quota exceeded
- Cost acceptable for security gain

### Risk 2: Latency Increase

**Issue:** Parallel execution may add ~100-200ms

**Mitigation:**

- Parallel execution means no sequential delay
- Both services already have timeouts (10s)
- User won't notice <200ms difference

### Risk 3: Backward Compatibility

**Issue:** Existing Shield integrations expect specific data format

**Mitigation:**

- Maintain `severity` and `categories` fields
- `action_tags` is ADDITIVE (optional parameter)
- Fallback to inference if `action_tags` not provided

---

## 🎯 Definition of Done

- [ ] All 12 AC passing
- [ ] Test coverage ≥90% for new services
- [ ] Full test suite passing (0 failures)
- [ ] GDD nodes updated (shield.md, roast.md)
- [ ] CodeRabbit review: 0 comments
- [ ] CI/CD passing (all checks green)
- [ ] Agent receipts generated (Orchestrator, Test Engineer, Guardian)

---

## 📊 Estimated Effort

| Phase              | Estimated Hours | Confidence |
| ------------------ | --------------- | ---------- |
| Core Services      | 4-5 hours       | 90%        |
| Worker Refactor    | 2-3 hours       | 85%        |
| Shield Integration | 2-3 hours       | 80%        |
| Testing & Docs     | 3-4 hours       | 85%        |
| **TOTAL**          | **12-14 hours** | **85%**    |

---

**Recommendation:** ✅ **CREATE**

**Justification:**

- P0 security gap requires immediate fix
- Architecture is sound (parallel execution, fail-safe)
- Backward compatibility maintained
- Test strategy comprehensive
- Implementation path clear

**Blockers:** None identified

**Dependencies:** None (refactor internal)

---

**Created by:** Orchestrator Agent
**Date:** 2025-10-23
**Next Steps:** Proceed with Sprint 1 (Core Services implementation)

---

## 🔒 Post-Merge Security Enhancement (CodeRabbit Review #634)

**Date:** 2025-10-23
**PR:** #634 - Unified Analysis Department
**Review:** https://github.com/Eibon7/roastr-ai/pull/634#issuecomment-3437346199
**Severity:** P1 Critical (Security)

### Issue Identified

**CodeRabbit Finding:** Gatekeeper fallback returns `classification: 'NEUTRAL'` and `is_prompt_injection: false`, allowing low-toxicity prompt injections to bypass security during Gatekeeper outages.

**Attack Vector:**

1. Transient Gatekeeper outage occurs
2. User submits comment with prompt injection + low toxicity
3. Gatekeeper fails → fallback returns NEUTRAL
4. Perspective succeeds with low toxicity score (e.g., 0.30)
5. Decision matrix routes to ROAST (bypassing security)

### Security Gap Closed

**Root Cause:** Fallback logic assumed safety (NEUTRAL) when security service unavailable. Downstream decision logic ignored the `fallback` flag.

**Fix Applied:**

1. **Conservative Fallback Classification** (`AnalysisDecisionEngine.js:103-121`):
   - Changed from `classification: 'NEUTRAL'` to `'MALICIOUS'`
   - Set `is_prompt_injection: true` (conservative assumption)
   - Added `fallback_reason` for audit trail

2. **Explicit Fallback Detection** (`AnalysisDecisionEngine.js:265-284`):
   - Added RULE 0 to decision matrix (highest priority)
   - Explicit check for `fallback && fallback_reason`
   - Forces SHIELD with action_tags: `['gatekeeper_unavailable', 'require_manual_review']`

### Test Coverage

**New Tests Added** (`tests/integration/analysis-department.test.js`):

- **Edge 2 (updated):** Gatekeeper fails, Perspective detects clean comment → SHIELD (conservative)
- **Edge 7 (new):** Gatekeeper fails + injection-like text → SHIELD
- **Edge 8 (new):** Gatekeeper fails + high toxicity + platform violations → SHIELD

**Test Results:** 20/20 passing (18 original + 2 new)

### Documentation Updates

**GDD Nodes Updated:**

1. **`docs/nodes/shield.md`** - Added "Fallback Security Policy" section
   - Conservative fallback strategy documented
   - Action tags specification (`gatekeeper_unavailable`)
   - Monitoring recommendations

2. **`docs/nodes/roast.md`** - Added "Fallback Mode" in decision matrix
   - RULE 0 documentation (fallback → SHIELD)
   - Security principle: fail-safe over convenience

### Impact Assessment

**Security Improvement:**

- ✅ Closes security gap identified by CodeRabbit
- ✅ Fail-safe principle consistently applied
- ✅ All fallback scenarios now route to SHIELD (manual review required)

**User Impact:**

- ⚠️ False positives increase during Gatekeeper outages (intentional)
- ✅ Manual review ensures no malicious content published
- ✅ Monitoring alerts detect service degradation

**Performance Impact:**

- ✅ No latency increase (decision logic adjustment only)
- ✅ No additional API calls

### Monitoring & Alerting

**Action Tags for Monitoring:**

- `gatekeeper_unavailable` - Track fallback frequency
- `require_manual_review` - Queue depth monitoring

**Recommended Alerts:**

- Alert if `gatekeeper_unavailable` appears in >5% of comments (service issue)
- Alert if manual review queue depth exceeds threshold
- Dashboard for Gatekeeper service SLA and uptime

### Architectural Principle

**Fail-Safe Design:** When security services unavailable, default to blocking rather than allowing. Security over convenience.

**Trade-off Accepted:** Increased false positives during outages (clean comments blocked) is preferable to false negatives (malicious content published).

---

**Fix Status:** ✅ Complete
**Tests:** 20/20 passing
**Documentation:** Updated
**Review:** CodeRabbit issue resolved
