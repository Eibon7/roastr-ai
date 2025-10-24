# Plan: Fix Pre-existing Shield Test Failures - Issue #633

**Created:** 2025-10-23
**Issue:** #633
**Type:** Bug Fix + Test Debugging
**Priority:** HIGH (Blocking PRs)

---

## Estado Actual

**Problema detectado:**
- 10 tests en `tests/unit/services/shieldDecisionEngine.test.js` failing en todas las branches (incluyendo main)
- Todos retornan `shield_action_critical` para CUALQUIER nivel de toxicidad
- Esperado: Respuestas graduadas basadas en rangos de toxicidad

**Pre-existing:** Confirmado en main branch (no introducido por PR #630)

**Bloqueador:** PR #630 y futuras PRs que toquen test suite

**Solución temporal:** Tests skipped en PR #630 para desbloquear merge

---

## Assessment - Tests Failing

### 1. High Threshold (95-98% toxicity)
**Test:** "should return moderate Shield action for high toxicity (95-98%)"
- ❌ Expected: `shield_action_moderate`
- ❌ Received: `shield_action_critical`

### 2. Roastable Content (90-95% toxicity) - 2 tests
**Tests:** Toxicity levels in "roastable" zone
- ❌ Expected: `roastable_comment`
- ❌ Received: `shield_action_critical`

### 3. Corrective Zone (85-90% toxicity) - 3 tests
**Tests:** Toxicity in "corrective" zone
- ❌ Expected: `corrective_zone`
- ❌ Received: `shield_action_critical`

### 4. Publish Normal (<85% toxicity) - 2 tests
**Tests:** Low toxicity should pass through
- ❌ Expected: `publish_normal`
- ❌ Received: `shield_action_critical`

### 5. Error Handling + Auto-Approve - 2 tests
**Tests:** Edge cases and special conditions
- ❌ Failing with `shield_action_critical` overrides

---

## Root Cause Hypotheses

**Observación:** Decisión siempre retorna acción más restrictiva, ignorando thresholds.

**Posibles causas:**

### 1. adjustThresholds() incorrectamente modificando thresholds
```javascript
// src/services/ShieldDecisionEngine.js
adjustThresholds(baseThresholds, orgSettings) {
  // Hypothesis: ¿Está bajando todos los thresholds a 0?
  // ¿Está invirtiendo comparaciones?
}
```

### 2. checkRedLineViolations() triggering false positives
```javascript
checkRedLineViolations(comment, settings) {
  // Hypothesis: ¿Detecta TODAS las comments como redline violations?
  // ¿Regex patterns demasiado amplios?
}
```

### 3. loadShieldSettings() returning invalid settings
```javascript
loadShieldSettings() {
  // Hypothesis: ¿Retorna settings con critical=0?
  // ¿Missing mock data en tests?
}
```

### 4. Threshold comparison logic issue (>= vs >)
```javascript
// Line 284
if (adjustedScore >= adjustedThresholds.critical) {
  return 'shield_action_critical';
}
// Hypothesis: ¿Debería ser > en lugar de >=?
```

---

## Plan de Implementación

### FASE 1: Reproducción Local

**Objetivo:** Confirmar fallo y capturar output detallado

**Comandos:**
```bash
# Run failing tests with verbose output
npm test -- tests/unit/services/shieldDecisionEngine.test.js --verbose

# Run single failing test for debugging
npm test -- tests/unit/services/shieldDecisionEngine.test.js -t "should return moderate Shield action"
```

**Esperado:** Reproducir 10 tests failing con mismo patrón

---

### FASE 2: Debugging con Logs

**Objetivo:** Trazar decision path completo

**Modificaciones temporales:**
```javascript
// src/services/ShieldDecisionEngine.js - Line ~280

applyDecisionLogic(comment, toxicityScore, orgId) {
  console.log('=== DEBUG: Decision Logic Entry ===');
  console.log('Toxicity Score:', toxicityScore);

  const settings = this.loadShieldSettings(orgId);
  console.log('Shield Settings:', JSON.stringify(settings, null, 2));

  const adjustedThresholds = this.adjustThresholds(settings.thresholds);
  console.log('Adjusted Thresholds:', JSON.stringify(adjustedThresholds, null, 2));

  const redlineViolation = this.checkRedLineViolations(comment, settings);
  console.log('Redline Violation:', redlineViolation);

  const adjustedScore = toxicityScore * (redlineViolation ? 1.2 : 1.0);
  console.log('Adjusted Score:', adjustedScore);

  // Trace decision path
  if (adjustedScore >= adjustedThresholds.critical) {
    console.log('>>> DECISION: shield_action_critical');
    return 'shield_action_critical';
  }
  // ... rest of comparisons with logs
}
```

**Ejecución:**
```bash
npm test -- tests/unit/services/shieldDecisionEngine.test.js -t "should return moderate Shield action" 2>&1 | tee debug-output.log
```

**Analizar:** Qué valores causan que SIEMPRE caiga en el primer `if`

---

### FASE 3: Identificar Root Cause

**Basado en logs, investigar:**

#### Scenario A: adjustThresholds() issue
```javascript
// Verificar qué retorna adjustThresholds()
const baseThresholds = { critical: 98, high: 95, moderate: 90, corrective: 85 };
const adjusted = adjustThresholds(baseThresholds);
console.log(adjusted); // ¿Todos en 0? ¿Invertidos?
```

#### Scenario B: checkRedLineViolations() false positives
```javascript
// Verificar si todo es redline
const testComments = [
  "Normal comment",
  "Slightly toxic",
  "Very offensive !!!"
];
testComments.forEach(c => {
  console.log(c, '->', checkRedLineViolations(c, settings));
});
```

#### Scenario C: loadShieldSettings() mock issue
```javascript
// Verificar mock en tests
// tests/unit/services/shieldDecisionEngine.test.js
const mockSettings = loadShieldSettings('org-123');
console.log(mockSettings); // ¿Estructura correcta?
```

---

### FASE 4: Fix Implementation

**Una vez identificada root cause, aplicar fix:**

**Opción A - adjustThresholds() fix:**
```javascript
adjustThresholds(baseThresholds, orgSettings = {}) {
  // Fix: Ensure proper threshold adjustment logic
  return {
    critical: baseThresholds.critical * (orgSettings.criticalMultiplier || 1.0),
    high: baseThresholds.high * (orgSettings.highMultiplier || 1.0),
    // ... rest
  };
}
```

**Opción B - checkRedLineViolations() fix:**
```javascript
checkRedLineViolations(comment, settings) {
  // Fix: Make redline patterns more specific
  const redlinePatterns = settings.redlinePatterns || [];
  return redlinePatterns.some(pattern => new RegExp(pattern, 'i').test(comment));
}
```

**Opción C - Test mock fix:**
```javascript
// tests/unit/services/shieldDecisionEngine.test.js
beforeEach(() => {
  mockLoadShieldSettings.mockReturnValue({
    thresholds: {
      critical: 98, // Fix: Ensure realistic values
      high: 95,
      moderate: 90,
      corrective: 85
    },
    redlinePatterns: ['kill', 'threat'], // Fix: Specific patterns only
    autoApprove: false
  });
});
```

---

### FASE 5: Re-enable Tests & Validate

**Objetivo:** Confirmar fix resuelve todos los tests

**Pasos:**
1. Remover todos los `describe.skip()` de shieldDecisionEngine.test.js
2. Ejecutar test suite completo:
   ```bash
   npm test -- tests/unit/services/shieldDecisionEngine.test.js
   ```
3. Verificar: **65/65 tests passing** (0 skipped)

---

### FASE 6: Full Test Suite Validation

**Objetivo:** Confirmar no regressions en otros tests

**Comandos:**
```bash
# Run all tests
npm test

# Run completion validation
node scripts/validate-gdd-runtime.js --full
node scripts/compute-gdd-health.js --threshold=87
```

**Esperado:**
- ✅ All tests passing (no new failures)
- ✅ GDD health ≥87
- ✅ No coverage drop

---

## Archivos Afectados

**Source files:**
- `src/services/ShieldDecisionEngine.js` (lines 238-382) - Likely fix here

**Test files:**
- `tests/unit/services/shieldDecisionEngine.test.js` (lines 184-936) - Re-enable skipped tests

**Documentation:**
- `docs/test-evidence/issue-633/` - Create evidence directory
- `docs/test-evidence/issue-633/SUMMARY.md` - Implementation summary
- `docs/test-evidence/issue-633/debug-output.log` - Debug trace
- `docs/test-evidence/issue-633/before-after.md` - Test results comparison

---

## Success Criteria

- [ ] Root cause identified and documented
- [ ] Fix implemented in ShieldDecisionEngine
- [ ] All 65 Shield tests passing (0 skipped)
- [ ] Full test suite passing (no regressions)
- [ ] GDD health ≥87
- [ ] Debug logs removed (clean code)
- [ ] Evidence generated (debug output, before/after comparison)
- [ ] PR created with comprehensive commit message

---

## Risk Assessment

**Low Risk:**
- Fix is isolated to Shield decision logic
- Full test coverage validates behavior
- No production impact (tests only)

**Mitigations:**
- Debug with logs before making changes
- Validate all 65 tests pass before PR
- Run full test suite to catch regressions

---

## Timeline

- **FASE 1-2 (Debug):** 30 mins
- **FASE 3 (Root Cause):** 15 mins
- **FASE 4 (Fix):** 20 mins
- **FASE 5-6 (Validation):** 20 mins
- **Total:** ~1.5 hours

---

**Next Steps:** Execute FASE 1 - Run failing tests locally with verbose output
