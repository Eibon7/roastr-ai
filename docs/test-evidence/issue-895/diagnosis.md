# Diagnosis - Issue #895: Fix Assertion Issues

## Summary

**Date:** 2025-11-21
**Tests analyzed:** 360 test suites
**Failures found:** 4 (in 1 suite)
**Suite:** `tests/unit/services/authService.test.js`

## Findings

### Suite: authService.test.js (4 failures)

#### Failure 1: `should update user plan successfully`

**Error:**
```
TypeError: supabaseServiceClient.from(...).select is not a function
  at AuthService.select [as updateUserPlan] (src/services/authService.js:714:18)
```

**Root Cause:** 
- Mock de Supabase no incluye método `.select()` en cadena `from()`
- Test lines 775-803 solo mockea `.update()` pero código real primero hace `.select()`

**Fix Required:**
- Añadir mock completo de cadena: `from().select().eq().single()`

---

#### Failure 2: `should map basic plan to free plan`

**Error:**
```
Expected: "free"
Received: "starter_trial"
  at Object.toHaveBeenCalledWith (tests/unit/services/authService.test.js:1002:47)
```

**Root Cause:**
- Test expectativa usa `'free'` pero implementación usa `'starter_trial'`
- `authService.js:722` hace: `const oldPlan = currentUser.plan || 'starter_trial'`
- `planService.js` cambió de `free/basic` → `starter_trial` como default

**Fix Required:**
- Actualizar assertion de `'free'` → `'starter_trial'`

---

#### Failure 3: `should return fallback limits on database error`

**Error:**
```
Expected: 100000
Received: 500000
  at Object.toBe (tests/unit/services/authService.test.js:1010:40)
```

**Root Cause:**
- Test expectativa: `monthly_tokens: 100000` (plan Pro antiguo)
- Implementación real: `monthly_tokens: 500000` (plan Pro actualizado)
- `planService.js:161` define Pro con `monthlyTokensLimit: 500000`

**Fix Required:**
- Actualizar assertion de `100000` → `500000`

---

#### Failure 4: `should return fallback limits for unknown plans`

**Error:**
```
Expected: 100
Received: 5
  at Object.toBe (tests/unit/services/authService.test.js:1018:46)
```

**Root Cause:**
- Test expectativa: `monthly_messages: 100` (basic/free plan antiguo)
- Implementación real: `monthly_messages: 5` (starter_trial plan actual)
- `authService.js:1355` define fallback con `monthly_messages: 5`

**Fix Required:**
- Actualizar assertion de `100` → `5`
- Actualizar `monthly_tokens: 10000` → `100000` (también desactualizado)

---

## Comparison Table

| Test | Expectativa (Test) | Realidad (Código) | Acción |
|------|-------------------|-------------------|--------|
| updateUserPlan | Solo mock `.update()` | Usa `.select()` primero | Añadir mock `.select()` |
| map basic plan | `'free'` | `'starter_trial'` | Cambiar assertion |
| fallback limits (Pro) | `monthly_tokens: 100000` | `monthly_tokens: 500000` | Cambiar assertion |
| fallback limits (unknown) | `monthly_messages: 100` | `monthly_messages: 5` | Cambiar assertion |
| fallback limits (unknown) | `monthly_tokens: 10000` | `monthly_tokens: 100000` | Cambiar assertion |

## Root Cause Analysis

### Plan Migration: `free/basic` → `starter_trial`

**Evidence:**
```javascript
// planService.js:31
starter_trial: {
  id: 'starter_trial',
  name: 'Starter Trial',
  limits: {
    monthlyResponsesLimit: 5,
    monthlyTokensLimit: 100000,
    // ...
  }
}
```

**Impact:** All tests expecting `'free'` or `'basic'` plan must use `'starter_trial'`

### Plan Limits Update: Pro plan tokens increased

**Evidence:**
```javascript
// planService.js:161 (Pro plan)
monthlyTokensLimit: 500000  // Was 100000

// planService.js:70 (Starter Trial)
monthlyTokensLimit: 100000
```

**Impact:** Tests checking Pro plan limits must update from 100k → 500k tokens

### Fallback Limits Changed

**Evidence:**
```javascript
// authService.js:1355 (fallback for unknown plans)
monthly_messages: 5,        // Was 100
monthly_tokens: 100000,     // Was 10000
```

**Impact:** Tests checking fallback behavior must use new values

## Verification Commands

```bash
# Run failing test to see errors
npm test -- tests/unit/services/authService.test.js

# Run after fix to verify
npm test -- tests/unit/services/authService.test.js --verbose

# Check coverage
npm test -- tests/unit/services/authService.test.js --coverage
```

## Additional Findings

### billing-coverage-issue502.test.js: ALREADY PASSING ✅

**Surprise:** All 60 tests passing, 3 skipped (Polar portal tests)
- No assertion issues found
- Mocks are correct
- Implementation matches expectations

**Conclusion:** This suite was already fixed in a previous commit.

## Summary Statistics

- **Total test suites:** 360
- **Failing suites:** 1 (authService.test.js)
- **Passing tests in failing suite:** 44
- **Failing tests in failing suite:** 4
- **Total failures:** 4
- **Estimated fix time:** 30 minutes

## Next Steps

1. Fix mock de Supabase en test line ~790 (añadir `.select()`)
2. Actualizar 4 assertions con valores correctos
3. Verificar 48/48 tests passing
4. Buscar otros tests con assertion issues (estimado ~16-26 suites más)

---

**Created:** 2025-11-21
**Last Updated:** 2025-11-21

