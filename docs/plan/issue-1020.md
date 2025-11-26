# Issue #1020: P0 - Core Services Assertion Failures (CRITICAL)

**Priority:** 🔴 CRITICAL - Production Blocking  
**Type:** Bug, Functional  
**Branch:** `feature/issue-1020`  
**Worktree:** `/Users/emiliopostigo/roastr-ai/roastr-ai-worktrees/issue-1020`  
**Status:** In Progress  
**Created:** 2025-11-26  
**Last Updated:** 2025-11-26

---

## 📋 Estado Actual

### Tests Totales

- **Total tests:** 7,776
- **Passing:** 6,518 (83.8%)
- **Failing:** 1,204 (15.5%)
- **Skipped:** 54 (0.7%)

**⚠️ ADVERTENCIA:** La issue describe ~200 tests fallando, pero el análisis muestra 1,204 tests failing. Vamos a priorizar los servicios CRÍTICOS mencionados en la issue.

### GDD Nodes Activados

Según auto-activación GDD:

- `shield`
- `cost-control`
- `queue-system`
- `roast`
- `multi-tenant`
- `social-platforms`
- `persona`

---

## 🎯 Objetivo

Arreglar assertion failures en servicios core críticos para producción:

1. **Billing & Cost Control** (~30 tests)
2. **Authentication & Security** (~40 tests)
3. **Shield Service** (~35 tests)
4. **Queue & Workers** (~25 tests)
5. **Roast Generation** (~30 tests)

**Total estimado:** ~160 tests críticos

---

## 📊 Análisis Inicial

### Tests Críticos Identificados

**Billing & Cost Control:**

- `tests/unit/routes/billing.test.js`
- `tests/unit/services/costControl.test.js`
- `tests/unit/routes/checkout.security.test.js`
- `tests/unit/utils/testUtils-planLimits.test.js`

**Authentication & Security:**

- `tests/unit/services/authService-edge-cases.test.js`
- `tests/unit/routes/auth-edge-cases.test.js`
- `tests/unit/middleware/auth.js`
- `tests/unit/routes/account-deletion.test.js`
- `tests/unit/services/authPasswordRecovery.test.js`

**Shield Service:**

- `tests/integration/shield-database-round3.test.js`
- `tests/unit/adapters/ShieldAdapter.contract.test.js`
- `tests/integration/sponsor-service-integration.test.js`
- `tests/integration/shield-database-round3.test.js`
- `tests/unit/services/shieldService-edge-cases.test.js`

**Queue & Workers:**

- `tests/integration/ingestor-*.test.js`
- `tests/unit/services/queueService.test.js`
- `tests/integration/ingestor-retry-backoff.test.js`
- `tests/integration/ingestor-error-handling.test.js`
- `tests/integration/ingestor-order-processing.test.js`

**Roast Generation:**

- `tests/integration/generation-issue-409.test.js`
- `tests/unit/routes/roast-*.test.js`
- `tests/integration/roastr-persona-flow.test.js`
- `tests/unit/routes/roast-enhanced-validation.test.js`
- `tests/unit/routes/roast-validation-issue364.test.js`

---

## 🔧 Plan de Implementación

### FASE 1: Billing & Cost Control (Día 1)

**Objetivo:** Arreglar plan limits inconsistentes y validación de price_id

**Tasks:**

1. **Unificar PLAN_LIMITS en un solo lugar**
   - File: `src/config/planLimits.js`
   - Eliminar duplicaciones en test utils
   - Asegurar que todos los servicios usan la misma fuente
2. **Arreglar validación de price_id**
   - File: `src/routes/checkout.js`
   - Añadir validación estricta de VALID_PRICE_IDS
   - Implementar error handling apropiado

3. **Arreglar testUtils-planLimits inconsistencias**
   - File: `tests/unit/utils/testUtils-planLimits.test.js`
   - Asegurar que mock data matches production PLAN_LIMITS
   - Actualizar fixtures

**Validation:**

```bash
npm test -- tests/unit/routes/billing.test.js
npm test -- tests/unit/services/costControl.test.js
npm test -- tests/unit/routes/checkout.security.test.js
npm test -- tests/unit/utils/testUtils-planLimits.test.js
```

**Expected Output:**

- ✅ All billing tests passing
- ✅ Plan limits consistent across codebase
- ✅ price_id validation working

---

### FASE 2: Authentication & Security (Día 2)

**Objetivo:** Arreglar edge cases y account deletion

**Tasks:**

1. **Arreglar authService edge cases**
   - File: `src/services/authService.js`
   - Revisar edge cases en tests
   - Implementar manejo correcto de cada caso
   - Añadir validaciones faltantes

2. **Arreglar account deletion**
   - File: `src/routes/account-deletion.js`
   - Verificar password validation
   - Asegurar deletion persistence
   - Añadir cleanup de datos relacionados

3. **Arreglar password recovery**
   - File: `src/services/authPasswordRecovery.js`
   - Validar token expiration
   - Implementar retry logic
   - Añadir rate limiting

**Validation:**

```bash
npm test -- tests/unit/services/authService-edge-cases.test.js
npm test -- tests/unit/routes/auth-edge-cases.test.js
npm test -- tests/unit/routes/account-deletion.test.js
npm test -- tests/unit/services/authPasswordRecovery.test.js
```

**Expected Output:**

- ✅ Auth edge cases handled
- ✅ Account deletion working
- ✅ Password recovery functional

---

### FASE 3: Shield Service (Día 3)

**Objetivo:** Arreglar database constraints y adapters

**Tasks:**

1. **Arreglar database constraints**
   - File: `database/migrations/*_shield_*.sql`
   - Verificar migrations aplicadas
   - Asegurar constraints se cumplen
   - Arreglar datos que violan constraints

2. **Arreglar ShieldAdapter contracts**
   - File: `src/adapters/ShieldAdapter.js`
   - Verificar todos los adapters cumplen contrato
   - Arreglar métodos que no cumplen
   - Añadir validación de contrato

3. **Arreglar sponsor service integration**
   - File: `src/services/sponsorService.js`
   - Verificar RLS enforcement
   - Arreglar integration con Shield
   - Añadir tests de integración

**Validation:**

```bash
npm test -- tests/integration/shield-database-round3.test.js
npm test -- tests/unit/adapters/ShieldAdapter.contract.test.js
npm test -- tests/integration/sponsor-service-integration.test.js
npm test -- tests/unit/services/shieldService-edge-cases.test.js
```

**Expected Output:**

- ✅ Database constraints met
- ✅ Adapters comply with contract
- ✅ Sponsor service integrated

---

### FASE 4: Queue & Workers (Día 4)

**Objetivo:** Arreglar job processing y retry logic

**Tasks:**

1. **Arreglar job processing order**
   - File: `src/services/queueService.js`
   - Verificar jobs se procesan en orden correcto
   - Implementar priority queues si falta
   - Añadir ordenamiento por timestamp

2. **Arreglar retry logic**
   - File: `src/workers/BaseWorker.js`
   - Implementar exponential backoff
   - Verificar max retries
   - Añadir dead letter queue

3. **Arreglar error handling**
   - Files: `src/workers/*Worker.js`
   - Asegurar errors se manejan correctamente
   - Añadir logging apropiado
   - Implementar fallback strategies

**Validation:**

```bash
npm test -- tests/integration/ingestor-*.test.js
npm test -- tests/unit/services/queueService.test.js
npm test -- tests/integration/ingestor-retry-backoff.test.js
npm test -- tests/integration/ingestor-error-handling.test.js
npm test -- tests/integration/ingestor-order-processing.test.js
```

**Expected Output:**

- ✅ Jobs processed in order
- ✅ Retry logic working
- ✅ Error handling implemented

---

### FASE 5: Roast Generation (Día 5)

**Objetivo:** Arreglar variant generation y validation

**Tasks:**

1. **Arreglar variant generation**
   - File: `src/services/roastGeneratorEnhanced.js`
   - Verificar generación correcta de variants
   - Arreglar persistencia en DB
   - Asegurar metadata correcta

2. **Arreglar validation**
   - Files: `src/routes/roast-*.js`
   - Implementar todas las validaciones requeridas
   - Asegurar error messages claros
   - Verificar validaciones se aplican

3. **Arreglar persona integration**
   - File: `src/services/roastEngine.js`
   - Verificar persona settings se usan
   - Arreglar tone mapping
   - Asegurar style consistency

**Validation:**

```bash
npm test -- tests/integration/generation-issue-409.test.js
npm test -- tests/unit/routes/roast-*.test.js
npm test -- tests/integration/roastr-persona-flow.test.js
npm test -- tests/unit/routes/roast-enhanced-validation.test.js
npm test -- tests/unit/routes/roast-validation-issue364.test.js
```

**Expected Output:**

- ✅ Variant generation working
- ✅ Validation implemented
- ✅ Persona integration functional

---

## 📝 Archivos a Modificar

### Core Services

**Billing & Cost Control:**

- `src/config/planLimits.js` - Unificar PLAN_LIMITS
- `src/routes/checkout.js` - Validación price_id
- `src/services/costControl.js` - Cost calculation fixes
- `tests/unit/utils/testUtils-planLimits.test.js` - Test fixtures

**Authentication:**

- `src/services/authService.js` - Edge cases
- `src/routes/account-deletion.js` - Deletion flow
- `src/services/authPasswordRecovery.js` - Recovery logic
- `src/middleware/auth.js` - Auth middleware

**Shield:**

- `database/migrations/*_shield_*.sql` - Constraints
- `src/adapters/ShieldAdapter.js` - Contract compliance
- `src/services/sponsorService.js` - Integration
- `src/services/shieldService.js` - Edge cases

**Queue:**

- `src/services/queueService.js` - Processing order
- `src/workers/BaseWorker.js` - Retry logic
- `src/workers/*Worker.js` - Error handling

**Roast:**

- `src/services/roastGeneratorEnhanced.js` - Variant generation
- `src/routes/roast-*.js` - Validation
- `src/services/roastEngine.js` - Persona integration

---

## ✅ Acceptance Criteria (Por Fase)

### FASE 1: Billing & Cost Control

- [ ] Plan limits consistentes en todas las funciones
- [ ] Validación de price_id funciona correctamente
- [ ] Cost control calcula correctamente
- [ ] Tests de seguridad de checkout pasan

### FASE 2: Authentication & Security

- [ ] Todos los edge cases de auth funcionan
- [ ] Account deletion funciona correctamente
- [ ] Password recovery funciona
- [ ] Middleware de auth funciona correctamente

### FASE 3: Shield Service

- [ ] Database constraints se cumplen
- [ ] Adapters cumplen contratos
- [ ] RLS funciona correctamente
- [ ] Sponsor service funciona

### FASE 4: Queue & Workers

- [ ] Jobs se procesan correctamente
- [ ] Retry logic funciona
- [ ] Order processing es correcto
- [ ] Error handling funciona

### FASE 5: Roast Generation

- [ ] Variant generation funciona
- [ ] Validación de inputs funciona
- [ ] Persona integration funciona
- [ ] Todos los endpoints funcionan

---

## 🚨 Riesgos Identificados

**Billing & Cost Control:**

- 💰 Facturación incorrecta → pérdida de ingresos
- 💰 Plan limits inconsistentes → usuarios no pueden usar features

**Authentication:**

- 🔐 Auth bypass → seguridad comprometida
- 🔐 Account deletion no funciona → GDPR violations

**Shield:**

- 🛡️ RLS no funciona → data leakage
- 🛡️ Moderación no funciona → contenido tóxico pasa

**Queue:**

- ⚙️ Jobs no se procesan → sistema no funciona
- ⚙️ Retry logic falla → jobs perdidos

**Roast:**

- 🎯 Generación falla → core product no funciona
- 🎯 Validation falla → bad UX

---

## 📊 Métricas de Éxito

**Overall:**

- ✅ 100% de tests críticos pasando (~160 tests)
- ✅ 0 assertion failures en servicios core
- ✅ Funcionalidad validada manualmente
- ✅ Performance aceptable (<3s per operation)

**Por Fase:**

- FASE 1: 30 tests passing → Billing functional
- FASE 2: 40 tests passing → Auth secure
- FASE 3: 35 tests passing → Shield working
- FASE 4: 25 tests passing → Queue reliable
- FASE 5: 30 tests passing → Roast generating

---

## 🔄 Workflow de Trabajo

### Por Cada Fase:

1. **Identificar tests fallando**

   ```bash
   npm test -- <test-pattern> 2>&1 | grep "FAIL\|●"
   ```

2. **Analizar root cause**
   - Leer assertion errors
   - Identificar qué funcionalidad está fallando
   - Revisar código relevante

3. **Implementar fix**
   - Arreglar código de producción
   - Actualizar tests si es necesario
   - Añadir defensive checks

4. **Validar fix**

   ```bash
   npm test -- <test-file>
   ```

5. **Commit con mensaje descriptivo**

   ```bash
   git add .
   git commit -m "fix(billing): unify plan limits across codebase (Issue #1020 FASE 1)"
   ```

6. **Continuar con siguiente test**

---

## 📝 Notas de Implementación

### Patrones a Seguir

**De coderabbit-lessons.md:**

1. **ESLint & Code Style**
   - Usar `const` por defecto
   - Semicolons siempre
   - `logger` en vez de `console.log`

2. **Testing Patterns**
   - Tests ANTES de implementación (TDD)
   - Happy path + error cases + edge cases
   - Verificar mock calls

3. **Error Handling**
   - Códigos de error específicos
   - Retry logic para transient errors
   - Log errors con contexto

4. **Security**
   - NO hardcoded credentials
   - NO sensitive data en logs
   - Validar env vars al startup

---

## 🎯 Agentes a Invocar

**FASE 1-5 (Implementation):**

- `TestEngineer` - Para cada fase, generar/arreglar tests
- `BackendDev` - Para arreglar servicios core

**FASE 6 (Validation):**

- `Guardian` - Validar que no hay security issues
- `TestEngineer` - Validar coverage >=90%

---

## ⚠️ Blockers

**Antes de continuar:**

- ✅ GDD nodes cargados
- ✅ Coderabbit-lessons.md leído
- ✅ Plan creado

**Antes de merge:**

- ⏸️ Tests 100% passing
- ⏸️ Coverage >=90%
- ⏸️ CodeRabbit = 0 comentarios
- ⏸️ CI/CD passing
- ⏸️ Manual validation complete

---

## 📚 Referencias

- **Issue Original:** #1020
- **GDD Nodes:** shield, cost-control, queue-system, roast, multi-tenant
- **Coderabbit Lessons:** `docs/patterns/coderabbit-lessons.md`
- **Quality Standards:** `docs/QUALITY-STANDARDS.md`
- **Testing Guide:** `docs/TESTING-GUIDE.md`

---

**Status:** 🟡 In Progress  
**Next Step:** FASE 1 - Billing & Cost Control  
**Estimated Completion:** 5 days (1 fase per day)
