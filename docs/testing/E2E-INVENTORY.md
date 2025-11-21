# E2E Test Suite Inventory
## Issue #896 - Fase 5: Documentar E2E Requirements

**Fecha:** 2025-11-21  
**Propósito:** Inventario completo de tests E2E con sus requirements de infraestructura

---

## Resumen

| Categoría | Cantidad | Estado | Requirements |
|-----------|----------|--------|--------------|
| **Playwright E2E** | 2 | 2 skipped | Playwright + servidor |
| **Database Integration** | 1 | 1 skipped | Supabase real |
| **Multi-tenant Workflow** | 1 | 1 conditional skip | Redis/Queue + mocks |
| **API Health Smoke** | 2 | Active | Servidor corriendo |
| **Visual Tests** | 1 | Active con @playwright/test | Servidor + Playwright |
| **TOTAL** | **7** | **4 skipped, 3 active** | Variable |

---

## Tests E2E Detallados

### 1. Shield Stability Integration Tests

**Archivo:** `tests/integration/shield-stability.test.js`

**Requirements:**
- ✅ Playwright installed (`npx playwright install`)
- ✅ Servidor corriendo en `http://localhost:3000`
- ✅ Playwright matchers configurados en Jest (actualmente NO disponible)
- ⚠️ **BLOCKER:** Jest no soporta Playwright matchers (`.toBeVisible()`, `.toHaveText()`, etc.)

**Estado actual:** `describe.skip` (18 tests)

**Suites afectadas:**
- Network Stability and Loading States (3 tests)
- Selector Resilience and Fallbacks (3 tests)
- Visual Stability Enhancements (3 tests)
- Edge Cases and Error Recovery (4 tests)
- Performance and Memory Stability (3 tests)
- Cross-browser Compatibility Stability (2 tests)

**Razón del skip:**
```javascript
/**
 * NOTE: These tests are currently skipped because they use Playwright matchers
 * (toBeVisible, toHaveText, etc.) that are not available in Jest.
 *
 * TO FIX: Either:
 * 1. Install @playwright/test and configure Playwright matchers for Jest
 * 2. Rewrite assertions to use Jest's expect with Playwright's is* methods
 * 3. Migrate these tests to @playwright/test framework
 *
 * See Issue #482 for tracking.
 */
```

**Alternativas:**
1. Migrar a `@playwright/test` framework
2. Usar Playwright MCP para validación visual
3. Reescribir assertions con Jest + métodos `is*` de Playwright

**Referencias:** Issue #482

---

### 2. Shield UI Visual Tests

**Archivo:** `tests/visual/shieldUI.test.js`

**Requirements:**
- ✅ `@playwright/test` installed (diferente de `playwright` package)
- ✅ Playwright browsers: `npx playwright install chromium firefox webkit`
- ✅ Servidor corriendo (default: `http://localhost:3000`, override con `TEST_URL`)
- ✅ Mock data API endpoint working

**Estado actual:** ✅ **ACTIVE** (631 lines, comprehensive tests)

**Test categories:**
- Multi-viewport testing (desktop 1920x1080, tablet 768x1024, mobile 375x667)
- Shield panel rendering and empty states
- Filtering and sorting functionality
- User actions (revert, block) with confirmations
- Real-time updates simulation
- Accessibility compliance (a11y)
- Performance metrics
- Network resilience
- Loading states

**Execution:**
```bash
# Requires Playwright Test runner
npx playwright test tests/visual/shieldUI.test.js

# With custom URL
TEST_URL=http://localhost:4000 npx playwright test tests/visual/shieldUI.test.js
```

**Nota:** Este test usa `@playwright/test`, NO Jest. Es un framework separado.

---

### 3. Multi-Tenant Workflow Integration Tests

**Archivo:** `tests/integration/multiTenantWorkflow.test.js`

**Requirements:**
- ⚠️ Redis/Queue service (puede usar mocks)
- ⚠️ External services mocked (Twitter, Perspective, OpenAI)
- ⚠️ Conditional: Se skipea con `SKIP_E2E=true`

**Estado actual:** ✅ **CONDITIONAL** (se ejecuta si `SKIP_E2E !== 'true'`)

**Skip logic implementado:**
```javascript
// Skip E2E tests in CI environment
if (process.env.SKIP_E2E === 'true') {
  test.skip('Skipping E2E integration tests in CI environment', () => {});
  return;
}
```

**Test categories:**
- Queue integration (enqueue, process, complete)
- Worker orchestration (FetchComments → AnalyzeToxicity → GenerateReply)
- Cost control validation
- Shield service integration
- Multi-tenant isolation

**Execution:**
```bash
# Run locally (default, E2E enabled)
npm test tests/integration/multiTenantWorkflow.test.js

# Skip in CI
SKIP_E2E=true npm test tests/integration/multiTenantWorkflow.test.js
```

**Nota:** Usa mocks, pero requiere Queue service inicializado.

---

### 4. Trial Management Integration Tests

**Archivo:** `tests/integration/trial-management.test.js`

**Requirements:**
- ❌ **BLOCKER:** Supabase real instance (NOT mocks)
- ❌ Stateful database for trial lifecycle testing

**Estado actual:** `describe.skip` (needs real DB)

**Skip reason:**
```javascript
// TODO: These integration tests require a real Supabase instance or stateful mocks
// Unit tests (entitlementsService-trial.test.js) already cover all functionality
// Consider refactoring to use mockSupabaseFactory.js for stateful mocking
```

**Test categories:**
- Trial start
- Trial status checking
- Trial expiration
- Trial to subscription upgrade

**Alternative coverage:** Unit tests en `tests/unit/services/entitlementsService-trial.test.js` cubren la funcionalidad.

**Future work:** Refactor para usar `mockSupabaseFactory.js` para mocks stateful.

---

### 5. Smoke Tests - API Health

**Archivo:** `tests/smoke/api-health.test.js`

**Requirements:**
- ✅ Servidor corriendo en `http://localhost:3000` (default)
- ✅ Endpoints `/health` y `/api/health` disponibles

**Estado actual:** ✅ **ACTIVE**

**Test categories:**
- Basic server availability
- Health endpoint response
- API endpoint response times
- Error handling

**Execution:**
```bash
# Requires server running
npm start &  # Start server
npm test tests/smoke/api-health.test.js
```

**Nota:** Tests simples, ejecutan rápido, útiles para verificación básica.

---

### 6. Smoke Tests - Simple Health

**Archivo:** `tests/smoke/simple-health.test.js`

**Requirements:**
- ✅ Servidor corriendo (similar a api-health)
- ✅ Minimal dependencies

**Estado actual:** ✅ **ACTIVE**

**Execution:** Mismo que api-health.test.js

---

### 7. Tier Validation Security Integration Tests

**Archivo:** `tests/integration/tierValidationSecurity.test.js`

**Requirements:**
- ⚠️ Conditional: Se skipea en mock mode
- ⚠️ Requiere database real para validación de tier security

**Estado actual:** ✅ **CONDITIONAL**

**Skip logic implementado:**
```javascript
// Skip these tests in mock mode as they require real database integration
const describeFunction = shouldSkipIntegrationTests ? describe.skip : describe;
```

**Execution:**
```bash
# Run with real DB
npm test tests/integration/tierValidationSecurity.test.js

# Skip in mock mode
MOCK_MODE=true npm test tests/integration/tierValidationSecurity.test.js
```

---

## Patrones Identificados

### Pattern 1: Playwright Framework Mismatch

**Problema:** `playwright` package vs `@playwright/test` framework

**Tests afectados:**
- `shield-stability.test.js` (usa `playwright` con Jest → matchers no disponibles)
- `shieldUI.test.js` (usa `@playwright/test` → funciona correctamente)

**Solución:**
1. Migrar tests a `@playwright/test` framework, O
2. Reescribir assertions sin matchers de Playwright

---

### Pattern 2: Conditional Skip with Environment Variables

**Tests afectados:**
- `multiTenantWorkflow.test.js` (`SKIP_E2E=true`)
- `tierValidationSecurity.test.js` (`MOCK_MODE=true`)

**Solución:** Ya implementado, documentar en E2E-REQUIREMENTS.md

---

### Pattern 3: Real Database Dependency

**Tests afectados:**
- `trial-management.test.js` (requiere Supabase real)

**Solución:** 
1. Skip permanente + coverage alternativa (unit tests), O
2. Refactor para usar mocks stateful con `mockSupabaseFactory.js`

---

### Pattern 4: Server Dependency

**Tests afectados:**
- `api-health.test.js`
- `simple-health.test.js`
- `shieldUI.test.js`
- `shield-stability.test.js` (cuando se desskipee)

**Solución:** Documentar cómo iniciar servidor + health check antes de ejecutar.

---

## Recomendaciones

### Alta Prioridad

1. **Documentar servidor requirement** → `E2E-REQUIREMENTS.md`
   - Cómo iniciar: `npm start` o `npm run start:api`
   - Health check: `curl http://localhost:3000/health`
   - Variables de entorno necesarias

2. **Crear helper de skip automático** → `tests/helpers/e2ePrerequisites.js`
   - Check si servidor disponible
   - Check si Playwright instalado
   - Skip automático si no hay infra

3. **Documentar Playwright frameworks** → Explicar diferencia entre:
   - `playwright` package (bajo nivel, requiere matchers externos)
   - `@playwright/test` (framework completo con matchers incluidos)

### Media Prioridad

4. **CI/CD configuration** → Workflow para ejecutar E2E solo cuando necesario
   - Job separado para E2E
   - Trigger con label `test:e2e`
   - Iniciar servidor en background

5. **Playwright MCP como alternativa** → Documentar uso
   - Para validación visual sin servidor local
   - Comandos MCP disponibles
   - Cuándo usar MCP vs tests locales

### Baja Prioridad

6. **Migrar shield-stability.test.js** → De `playwright` + Jest a `@playwright/test`
   - Issue #482 tracking
   - No urgente (alternativa: Playwright MCP)

7. **Refactor trial-management mocks** → Usar `mockSupabaseFactory.js`
   - Habilitar tests sin DB real
   - Mocks stateful para lifecycle testing

---

## Estadísticas

**Tests E2E por estado:**
- ✅ Active: 3 (43%)
- ⚠️ Conditional: 2 (29%)
- ❌ Skipped: 2 (29%)

**Blockers principales:**
1. Playwright matchers en Jest (Issue #482) - 1 suite
2. Real database dependency - 1 suite

**Tests listos para ejecutar:** 5 de 7 (71%) con infraestructura apropiada

---

## Referencias

- Issue #896: Documentar E2E Requirements
- Issue #480: EPIC Test Stabilization
- Issue #482: Playwright matchers en Jest
- Issue #884: Verificación de tests
- `docs/TESTING-GUIDE.md`: Guía principal de testing
- `tests/helpers/mockSupabaseFactory.js`: Factory para mocks Supabase

---

**Última actualización:** 2025-11-21  
**Mantenido por:** TestEngineer  
**Próxima revisión:** Cuando se añadan nuevos tests E2E

