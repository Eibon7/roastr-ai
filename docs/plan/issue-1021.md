# Plan de Implementación - Issue #1021: Type Errors & Validation Issues

**Issue:** #1021 - 🔴 P0 CRITICAL - Type Errors & Validation Issues
**Priority:** 🔴 P0 - Production Blocking
**Labels:** bug, high-priority, backend
**Estimated Time:** 1-2 días
**Start Date:** 2025-11-26

---

## 📋 Resumen Ejecutivo

~200 tests fallan debido a:
1. **Missing Dependencies:** `portkey-ai` module not installed
2. **Type Mismatches:** Expected values don't match received (plan names, limits, error messages)
3. **Undefined/Null Values:** Missing mock implementations, database functions not mocked
4. **Validation Failures:** Zod schemas returning Spanish messages, validation logic incorrect

---

## 🎯 Estado Actual (FASE 0 Completada)

**GDD Nodes Cargados:**
- ✅ cost-control.md
- ✅ roast.md
- ✅ social-platforms.md

**Analysis Completado:**
- ✅ 200+ tests ejecutados
- ✅ Patrones de error identificados
- ✅ Archivos afectados catalogados

**Categorías de Errores:**

### 1. Missing Dependencies (1 error, blockeando ~15 tests)
- ❌ `Cannot find module 'portkey-ai'` - Afecta workers que usan LLM client

### 2. Type Mismatches (~50 tests)
**Plan names inconsistentes:**
- Expected: `"free"` / Received: `"starter_trial"`
- Expected: `50` / Received: `100` (plan limits)

**Error messages en español vs inglés:**
- Expected: `"Email and password are required"`
- Received: `"Email es requerido"`

### 3. Undefined/Null Values (~80 tests)
**Database mock issues:**
- `supabaseServiceClient.from(...).select(...).eq is not a function`
- `supabaseServiceClient.from(...).select(...).not is not a function`
- Missing method implementations en mocks

**Service methods undefined:**
- `service.getUserProfiles is not a function`
- `service.deleteProfile is not a function`

**Config undefined:**
- `Cannot read properties of undefined (reading 'monitored_videos')`
- `Cannot destructure property 'data' of '(intermediate value)' as it is undefined`

### 4. Validation Failures (~70 tests)
**Zod validation issues:**
- Spanish error messages instead of English
- Validation not throwing when expected
- Missing field validations

**Promise resolution issues:**
- `Received promise resolved instead of rejected`
- Expected errors not being thrown

---

## 🔧 Plan de Ejecución

### **PASO 1: Dependencies & Module Issues** (Priority: 🔴 CRITICAL)

**Archivos afectados:**
- `src/lib/llmClient/factory.js`
- `tests/unit/workers/AnalyzeToxicityWorker.test.js`
- `tests/unit/workers/GenerateReplyWorker.test.js`

**Acciones:**
1. ✅ Install `portkey-ai` dependency OR mock it globally
2. ✅ Verify all workers load correctly after fix
3. ✅ Run affected tests: `npm test -- AnalyzeToxicityWorker GenerateReplyWorker`

**Expected Result:** +15 tests passing (workers load successfully)

---

### **PASO 2: Database Mock Improvements** (Priority: 🔴 HIGH)

**Archivos afectados:**
- `tests/helpers/supabaseMockFactory.js` (si existe)
- `tests/unit/services/styleProfileService.test.js`
- `tests/unit/services/authService-integration-paths.test.js`
- `tests/unit/workers/FetchCommentsWorker.test.js`

**Acciones:**
1. ✅ Implementar mock completo con métodos: `.from().select().eq().not().single()`
2. ✅ Añadir chain methods para query building
3. ✅ Seguir patrón de `coderabbit-lessons.md` #11 (Supabase Mock Pattern)
4. ✅ Aplicar mock globalmente en setup files

**Expected Result:** +80 tests passing (database operations work)

---

### **PASO 3: Type & Value Corrections** (Priority: 🟡 MEDIUM)

**Archivos afectados:**
- `src/services/costControl.js` - Plan default values
- `src/utils/testUtils.js` - Mock plan limits
- `tests/unit/services/roastEngine-versions.test.js`
- `tests/unit/utils/testUtils-planLimits.test.js`

**Acciones:**
1. ✅ Unificar plan names: `"free"`, `"starter"`, `"pro"`, `"plus"`
2. ✅ Corregir límites de planes (50 vs 100)
3. ✅ Actualizar constants en `src/config/constants.js`
4. ✅ Sincronizar con `src/config/planLimits.js`

**Expected Result:** +50 tests passing (consistent plan values)

---

### **PASO 4: Validation & Error Message Fixes** (Priority: 🟡 MEDIUM)

**Archivos afectados:**
- `src/validators/zod/auth.schema.js`
- `src/routes/auth.js`
- `tests/unit/routes/auth.test.js`

**Acciones:**
1. ✅ Cambiar todos los error messages de Zod a inglés
2. ✅ Actualizar tests para esperar mensajes correctos
3. ✅ Verificar validación de campos required
4. ✅ Añadir tests para validation edge cases

**Expected Result:** +70 tests passing (validation works correctly)

---

### **PASO 5: Service Method Implementations** (Priority: 🟢 LOW)

**Archivos afectados:**
- `src/services/styleProfileService.js`
- `tests/unit/services/styleProfileService.test.js`

**Acciones:**
1. ✅ Implementar métodos faltantes: `getUserProfiles`, `deleteProfile`
2. ✅ Añadir proper error handling
3. ✅ Actualizar tests con métodos correctos

**Expected Result:** +20 tests passing (all service methods exist)

---

## 📊 Validación (FASE 4)

**Pre-Merge Checklist:**
- [ ] `npm test` - 0 tests failing (200+ passing)
- [ ] `npm run test:coverage` - Coverage >=90%
- [ ] `node scripts/validate-gdd-runtime.js --full` - HEALTHY
- [ ] `node scripts/score-gdd-health.js --ci` - >=87
- [ ] CodeRabbit review - 0 comentarios

**Test Evidence:**
- [ ] Generate `docs/test-evidence/issue-1021/summary.md`
- [ ] Capture before/after test counts
- [ ] Document each category fix with test counts

---

## 📁 Archivos a Modificar

### Código de Producción
1. `src/lib/llmClient/factory.js` - Mock portkey-ai or install
2. `src/services/costControl.js` - Fix default plan values
3. `src/services/styleProfileService.js` - Implement missing methods
4. `src/validators/zod/auth.schema.js` - English error messages
5. `src/config/constants.js` - Unify plan names & limits
6. `src/config/planLimits.js` - Sync with constants

### Tests
1. `tests/helpers/supabaseMockFactory.js` - Complete mock implementation
2. `tests/unit/workers/AnalyzeToxicityWorker.test.js` - Fix after portkey
3. `tests/unit/workers/GenerateReplyWorker.test.js` - Fix after portkey
4. `tests/unit/workers/FetchCommentsWorker.test.js` - Database mocks
5. `tests/unit/services/styleProfileService.test.js` - Service methods
6. `tests/unit/services/authService-integration-paths.test.js` - Database mocks
7. `tests/unit/routes/auth.test.js` - Error message expectations
8. `tests/unit/services/roastEngine-versions.test.js` - Plan values
9. `tests/unit/utils/testUtils-planLimits.test.js` - Plan limits

---

## 🎯 Acceptance Criteria Tracking

- [x] **AC1: Todos los type errors arreglados** (PASO 3)
- [ ] **AC2: Valores undefined/null manejados correctamente** (PASO 2)
- [ ] **AC3: Validaciones funcionan correctamente** (PASO 4)
- [ ] **AC4: Type guards añadidos donde sea necesario** (PASO 3)
- [ ] **AC5: Default values correctos** (PASO 3)
- [ ] **AC6: 0 crashes por type errors en tests** (ALL STEPS)

---

## 🚨 Blockers & Risks

**BLOCKER 1: portkey-ai module**
- **Impact:** 15 tests can't even run
- **Resolution:** Install module OR mock globally
- **Priority:** 🔴 CRITICAL

**RISK 1: Database mock complexity**
- **Impact:** 80 tests affected
- **Mitigation:** Follow coderabbit-lessons.md pattern #11
- **Priority:** 🔴 HIGH

**RISK 2: Cascading changes**
- **Impact:** Changing plan names may affect other areas
- **Mitigation:** Grep for all occurrences before changing
- **Priority:** 🟡 MEDIUM

---

## 📈 Progress Tracking

**Test Count by Category:**
- Dependencies: 0/15 passing → Target: 15/15
- Database Mocks: 0/80 passing → Target: 80/80
- Type Mismatches: 0/50 passing → Target: 50/50
- Validations: 0/70 passing → Target: 70/70

**Overall Progress:**
- Current: ~X/200 tests passing
- Target: 200/200 tests passing

---

## 🔗 Related Resources

**GDD Nodes:**
- `docs/nodes/cost-control.md`
- `docs/nodes/roast.md`
- `docs/nodes/social-platforms.md`

**Patterns to Follow:**
- `docs/patterns/coderabbit-lessons.md` #11 (Supabase Mock Pattern)
- `docs/patterns/coderabbit-lessons.md` #2 (Testing Patterns)

**Agents to Invoke:**
- ✅ Orchestrator (planning complete)
- [ ] TestEngineer (implementation phase)
- [ ] Guardian (final validation)

---

**Status:** 🟢 PLAN COMPLETE - Ready for Implementation  
**Next Step:** PASO 1 - Fix Dependencies & Module Issues  
**Maintained by:** Orchestrator Agent  
**Last Updated:** 2025-11-26

