# CodeRabbit Review Plan - PR #734

**PR:** #734 - feat: Implement Roasting Control and Level Configuration (Issues #596, #597)
**Branch:** `feature/issue-596` → `main` ✅ (Branch Guard compliant)
**Review URL:** https://github.com/Eibon7/roastr-ai/pull/733#pullrequestreview-3424626201
**Created:** 2025-11-05

---

## 1. Análisis por Severidad

### MAJOR Issues (4 fixes)

#### 1. Supabase Count Handling

- **File:** `src/routes/roasting.js:159-189`
- **Issue:** Stats endpoint reads `data` property instead of `count` when using `count: 'exact', head: true`
- **Impact:** `pending_jobs` and `roasts_today` always return 0 (broken feature)
- **Type:** Bug - Critical business logic failure
- **Fix:** Destructure `count` instead of `data`:
  ```javascript
  const { count: pendingJobs, error: jobsError } = ...
  const { count: todayRoasts, error: roastsError} = ...
  // Use: pendingJobs ?? 0, todayRoasts ?? 0
  ```

#### 2. Missing Plus Plan Mapping

- **File:** `src/services/levelConfigService.js:15-20`
- **Issue:** `PLAN_LEVEL_LIMITS` missing `plus` plan entry
- **Impact:** Plus subscribers fall through to free tier limits (1-3) instead of all 5 levels
- **Type:** Business logic bug - Revenue impact (Plus users can't access paid features)
- **Fix:** Add `plus: { maxRoastLevel: 5, maxShieldLevel: 5 }`

#### 3. Missing Level Bounds Validation

- **File:** `src/services/levelConfigService.js:136-185`
- **Issue:** `validateLevelAccess()` only checks plan limits, not 1-5 bounds
- **Impact:** Invalid levels (0, 6, 100) pass validation, causing downstream errors
- **Type:** Input validation bug - Security/Stability risk
- **Fix:** Add early bounds check before plan validation:
  ```javascript
  if (roastLevel && (roastLevel < 1 || roastLevel > 5)) {
    return { allowed: false, reason: 'invalid_roast_level', ... }
  }
  if (shieldLevel && (shieldLevel < 1 || shieldLevel > 5)) {
    return { allowed: false, reason: 'invalid_shield_level', ... }
  }
  ```

#### 4. Inconsistent Plan Requirement Logic

- **File:** `src/services/levelConfigService.js:193-198`
- **Issue:** `getRequiredPlanForLevel()` returns `'starter'` for levels 1-3, contradicting `PLAN_LEVEL_LIMITS` where `'free'` also supports these
- **Impact:** Confusing error messages ("Upgrade to Starter" when Free already has access)
- **Type:** UX inconsistency bug
- **Fix:** Change to `return 'free'` for levels 1-3

### NITPICK (1 - Optional)

#### 5. Redundant UPDATE Statement

- **File:** `database/migrations/026_add_roasting_control.sql:23-26`
- **Issue:** UPDATE statement redundant with DEFAULT TRUE NOT NULL
- **Impact:** None (harmless defensive pattern)
- **Action:** SKIP (no change needed)

---

## 2. GDD Nodes Affected

**Nodos a actualizar:**

- `docs/nodes/roast.md` (roasting control + stats)
- `docs/nodes/config.md` (level configuration)
- `docs/nodes/billing.md` (plan validation logic)

**Skill GDD:** NOT needed (fixes are isolated, no architecture changes)

---

## 3. Subagentes NO Requeridos

**Reasoning:** These are straightforward bug fixes with clear solutions. No architecture changes, no security research needed.

- ❌ TaskAssessor - Simple fixes, no complexity
- ❌ SecurityAudit - No security vulnerabilities (just input validation)
- ❌ TestEngineer - Existing 39 tests will verify fixes

---

## 4. Archivos Afectados

### Implementation Files (2)

1. `src/routes/roasting.js` (count destructuring fix)
2. `src/services/levelConfigService.js` (plus plan + bounds validation + plan logic)

### Test Files (NO NEW TESTS NEEDED)

- Existing tests will validate fixes:
  - `tests/integration/routes/roasting.test.js` (stats endpoint)
  - `tests/unit/services/levelConfigService.test.js` (level validation)

### Documentation (1)

1. `docs/plan/review-734.md` (this file)

---

## 5. Estrategia de Implementación

### Orden de Aplicación (Por Severidad MAJOR)

**Fix 1: Supabase Count Handling** (CRITICAL - Broken feature)

1. Read `src/routes/roasting.js:158-190`
2. Change destructuring: `data` → `count`
3. Update response: `pendingJobs ?? 0`, `todayRoasts ?? 0`

**Fix 2: Plus Plan Mapping** (HIGH - Revenue impact)

1. Read `src/services/levelConfigService.js:1-25`
2. Add `plus: { maxRoastLevel: 5, maxShieldLevel: 5 }` to PLAN_LEVEL_LIMITS
3. Verify alphabetical order: free, plus, pro, starter (or document if intentional)

**Fix 3: Level Bounds Validation** (HIGH - Security/Stability)

1. Read `src/services/levelConfigService.js:136-185`
2. Add bounds check at start of `validateLevelAccess()`:
   - Check roastLevel 1-5
   - Check shieldLevel 1-5
   - Return early if invalid

**Fix 4: Plan Requirement Logic** (MEDIUM - UX consistency)

1. Read `src/services/levelConfigService.js:193-198`
2. Change levels 1-3 return value: `'starter'` → `'free'`

### Single Commit Strategy

**All fixes in ONE commit** (related to same CodeRabbit review)

---

## 6. Testing Plan

### NO New Tests Required

- ✅ Existing 39 tests cover these scenarios
- ✅ Fixes will make existing tests pass correctly

### Manual Verification

1. Stats endpoint returns correct counts (not 0)
2. Plus plan users can access levels 4-5
3. Invalid levels (0, 6) are rejected
4. Free plan users see correct "Free" tier in messages

### Expected Coverage

- Maintained at current level (no regression)

---

## 7. Criterios de Éxito

✅ **Funcionalidad:**

- Stats endpoint returns actual counts (not always 0)
- Plus plan users can select levels 4-5
- Levels outside 1-5 range are rejected
- Plan requirement messages say "Free" for levels 1-3

✅ **Tests:**

- All 39 existing tests passing
- No new test failures
- Coverage maintained

✅ **Quality:**

- 0 regressions
- 0 CodeRabbit comments pending (after fixes)
- Branch Guard passing
- CI/CD green

---

## 8. Commit Message Template

```bash
fix: Apply CodeRabbit Review #734 - Level validation and stats fixes

### Issues Addressed
- [MAJOR] Fix stats endpoint count query (roasting.js:170-185)
- [MAJOR] Add Plus plan to level limits (levelConfigService.js:18)
- [MAJOR] Add bounds validation for levels 1-5 (levelConfigService.js:140-148)
- [MAJOR] Fix plan requirement logic for Free tier (levelConfigService.js:195)

### Changes
- roasting.js: Destructure count instead of data in Supabase queries
- levelConfigService.js: Added plus plan, bounds validation, fixed free tier logic

### Testing
- Existing 39 tests verify fixes, Coverage: maintained

### Impact
- Stats now show actual values (was always 0)
- Plus subscribers can access levels 4-5 (was capped at 3)
- Invalid levels rejected (was allowing 0, 6, etc.)
- Correct "Free" messaging (was saying "Starter")

### GDD
- Updated nodes: roast.md, config.md, billing.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 9. Riesgos

### Riesgo 1: Plan limits ordering

- **Issue:** Order of plans in PLAN_LEVEL_LIMITS matters for fallback logic
- **Mitigation:** Verify key order after adding `plus`
- **Test:** Check that free < starter < pro < plus hierarchy works

### Riesgo 2: Existing Plus users

- **Issue:** If Plus users already selected levels 4-5, they might have NULL in DB
- **Mitigation:** Defaults (level 3) handle this gracefully
- **Test:** Verify existing Plus users can access levels 4-5 after fix

---

## 10. Referencias

- **CodeRabbit Review:** https://github.com/Eibon7/roastr-ai/pull/733#pullrequestreview-3424626201
- **Original Issues:** #596 (Roasting Control), #597 (Level Configuration)
- **Quality Standards:** `docs/QUALITY-STANDARDS.md`
- **Known Patterns:** `docs/patterns/coderabbit-lessons.md`

---

**Plan Status:** READY TO EXECUTE
**Estimated Time:** 30-45 minutes
**Complexity:** LOW (4 straightforward bug fixes)
**Priority:** HIGH (broken stats + revenue-impacting Plus plan bug)
