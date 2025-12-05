# GDD Node — Testing v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Estrategia de testing basada en realismo sobre mocks, priorizando comportamiento real del sistema. Unit tests solo para lógica determinista, integration tests con Supabase Test (BD real), E2E con Playwright, y workers testeados job-by-job. Regla: solo testear lo que puede romper el sistema.

---

## 2. Responsibilities

### Funcionales:

- Unit tests para lógica compleja y determinista
- Integration tests con Supabase Test (BD real, rollback automático)
- E2E tests con Playwright (UI + backend + workers)
- Workers testeados job-by-job (sin cron real)
- Cobertura mínima por categoría
- CI con validación SSOT

**Tests NO deben modificar el SSOT real**:

- Debe usarse una copia del SSOT dedicada para testing.
- Cambios al SSOT en tests van siempre envueltos en rollback.

### No Funcionales:

- Realismo: evitar mock hell
- Señal: solo testear comportamientos críticos
- Mantenibilidad: tests que resisten refactors
- Performance: tests rápidos, paralelos

---

## 3. Inputs

- Código de producción (services, workers, routes, components, hooks)
- SSOT (para tests de configuración)
- Test data (fixtures, factories)
- Supabase Test instance

---

## 4. Outputs

- Suite de tests completa (unit, integration, E2E)
- Coverage reports por categoría
- CI passing (lint, typecheck, tests)
- Test evidence en `docs/test-evidence/`

---

## 5. Rules

### Filosofía:

1. **Unit tests solo para lógica compleja y determinista**:
   - Fórmula de análisis (toxicidad + persona + reincidencia)
   - Prompt builders (A/B/C)
   - Style Validator (rule-based)
   - Normalizadores
   - Capa de dominio pura

2. **Integration tests con Supabase Test**:
   - Todo lo que implique decisiones sobre datos reales
   - ❌ NO mocks de Supabase (salvo excepciones justificadas)

3. **E2E realistas con Playwright**:
   - Flujos completos: login → conectar → ingestión → análisis → roast → shield
   - UI + backend + workers juntos
   - **En E2E, los workers NO corren por cron real**. El test activa los jobs manualmente mediante helpers.

4. **Workers: job-by-job execution**:
   - Sin cron real
   - Cada job contra BD aislada

5. **Regla de oro**: **No testear ruido. Solo lo que puede romper el sistema.**

### Qué SÍ Se Testea:

**Backend Unit**:

- ✅ Fórmula análisis (score_final)
- ✅ Árbol decisión Shield
- ✅ Árbol decisión Roasting
- ✅ Prompt builders A/B/C
- ✅ Normalizadores (X, YouTube)
- ✅ Style Validator
- ✅ Dominio puro (reducers, calculators, mappers)

**Backend Integration**:

- ✅ Conexión/desconexión cuentas
- ✅ Persistencia strikes y reincidencia
- ✅ Shield actuando sobre comentarios reales
- ✅ Persistencia roasts y correctivas
- ✅ Auto-approve ON/OFF
- ✅ Límite análisis → detiene ingestión
- ✅ Límite roasts → detiene generación
- ✅ SSOT (planes, tonos, thresholds)
- ✅ DLQ (fallos persistentes)
- ✅ **Disclaimers IA**:
  - En auto-approve ON + región UE → E2E debe verificar presencia del disclaimer
  - En aprobación manual → E2E debe verificar ausencia del disclaimer

**Frontend E2E**:

- ✅ Login con magic link (mock backend)
- ✅ Conexión redes (X/YouTube simulados)
- ✅ Dashboard widgets
- ✅ Detalle cuenta
- ✅ Settings usuario
- ✅ Billing (mock Polar)

### Qué NO Se Testea:

❌ **NUNCA testear**:

- **NO se deben mockear llamadas a Supabase**. SÍ deben testearse sobre Supabase Test (instancia real + rollback automático).
- Llamadas a APIs externas (mock ligero)
- Workers haciendo IO (test job-by-job)
- Hooks UI que solo formatean datos
- Estilos CSS o cambios visuales
- Comportamientos ya verificados en E2E
- Componentes UI simples sin lógica
- Clicks triviales de botones
- ❌ NO se testean prompts generados por modelos (solo se testean los prompt builders A/B/C)

### Cobertura Mínima:

| Categoría             | Cobertura           |
| --------------------- | ------------------- |
| Lógica de dominio     | ≥ 90%               |
| Prompt builders       | 100%                |
| Style Validator       | 100%                |
| Workers (unit)        | ≥ 80%               |
| Workers (integration) | 100% flujo feliz    |
| Workers (errores)     | 1 caso/worker       |
| DLQ behavior          | 100%                |
| Smart Delay           | ≥ 90%               |
| Disclaimers IA        | 100%                |
| API / Routes          | ≥ 80%               |
| Frontend hooks        | ≥ 70%               |
| UI E2E                | Escenarios críticos |

**Regla fundamental**: **Lo que rompe el producto debe estar 100% cubierto.**

### Tests Obligatorios por Módulo:

**services/**:

- `shieldService.test.ts` (unit + integration)
- `roastService.test.ts`
- `accountService.test.ts`
- `billingService.test.ts` (mock Polar)
- `settingsService.test.ts` (SSOT)
- `styleValidator.test.ts` ← obligatorio
- `analysisEngine.test.ts` ← obligatorio

**workers/**:

- `fetchCommentsWorker.test.ts`
- `analyzeToxicityWorker.test.ts`
- `generateRoastWorker.test.ts`
- `shieldActionWorker.test.ts`
- `billingUpdateWorker.test.ts`
- `socialPostingWorker.test.ts`
- `smartDelay.test.ts` ← obligatorio
- `deadLetterQueue.test.ts` ← obligatorio

**routes/**:

- `auth.test.ts`
- `accounts.test.ts`
- `settings.test.ts`

**hooks/**:

- `useSettings.test.ts`
- `useAccounts.test.ts`
- `useAnalysisUsage.test.ts`
- `useFeatureFlags.test.ts`

**E2E (flujos críticos)**:

- Login/signup
- Conectar cuentas
- Dashboard
- Detalle cuenta
- Settings
- Billing

---

## 6. Dependencies

### Herramientas:

- **Vitest**: Testing framework principal (NO Jest)
- **Supabase Test**: BD real con rollback
- **Playwright**: E2E tests
- **Testing Library**: React component testing (mínimo)

**Tokens OAuth reales PROHIBIDOS**:

Todos los E2E deben usar:

- cuentas simuladas
- OAuth simulado
- valores dummy seguros

### Configuración:

- `vitest.config.ts` (backend)
- `vitest.config.ts` (frontend)
- `playwright.config.ts`

### Nodos Relacionados:

- Todos los nodos (cada uno define su Test Matrix)

---

## 7. Edge Cases

1. **Test intenta usar BD real en unit**:
   - Rechazado por CI
   - Debe usar integration test

2. **Mock profundo de Supabase**:
   - Rechazado por CI
   - Debe usar Supabase Test

3. **Test sin rollback**:
   - BD contamina
   - CI bloqueado

4. **Coverage < mínimo**:
   - CI falla
   - Requiere más tests

5. **Test modifica SSOT**:
   - Usa SSOT test dedicado
   - Rollback automático

6. **E2E falla en CI**:
   - Bloquea deploy staging
   - Requiere fix

7. **Worker test sin aislar tenant**:
   - Mezcla datos
   - CI detecta + rechaza

8. **analysis_remaining = 0**:
   - Integration test debe verificar que FetchComments no llama a API externa
   - Integration test debe verificar que AnalyzeToxicity NO se ejecuta
   - E2E debe mostrar el banner "Análisis agotados"

---

## 8. Acceptance Criteria

### Estructura:

- [ ] `apps/backend-v2/tests/unit/`
- [ ] `apps/backend-v2/tests/integration/`
- [ ] `apps/backend-v2/tests/e2e/`
- [ ] `apps/frontend-v2/tests/unit/`
- [ ] `apps/frontend-v2/tests/e2e/`

### Herramientas:

- [ ] Vitest configurado (backend + frontend)
- [ ] Supabase Test configurado
- [ ] Playwright configurado
- [ ] ❌ NO Jest en v2

### Cobertura:

- [ ] Dominio ≥ 90%
- [ ] Prompt builders 100%
- [ ] Style Validator 100%
- [ ] Workers unit ≥ 80%
- [ ] Workers integration 100% (flujo feliz)
- [ ] Workers errores: 1 caso/worker (DLQ, retry)
- [ ] DLQ 100%
- [ ] Disclaimers IA 100%
- [ ] Smart Delay ≥ 90%
- [ ] API/Routes ≥ 80%
- [ ] Hooks ≥ 70%

### CI:

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing (críticos)
- [ ] Coverage reports generados
- [ ] Validación SSOT OK
- [ ] No valores hardcoded
- [ ] No tests sin rollback

### Tests Específicos:

- [ ] Motor análisis: 10 tests (persona, reincidencia, overrides)
- [ ] Shield: 8 tests (moderado, crítico, líneas rojas)
- [ ] Roasting: 6 tests (tonos, disclaimers, validator)
- [ ] Workers: 1 test/worker (happy path + error)
- [ ] E2E: 6-10 flujos críticos

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Toda lógica determinista
- ✅ Reducers, calculators, validators
- ❌ NO I/O, APIs, DB

### Integration Tests (Supabase Test):

- ✅ Flujos con BD real
- ✅ Workers job-by-job
- ✅ SSOT loading
- ❌ NO mocks Supabase

### E2E Tests (Playwright):

- ✅ Flujos completos UI
- ✅ Backend + workers funcionando
- ✅ Múltiples viewports (mobile, tablet, desktop)

---

## 10. Implementation Notes

### Vitest Config (Backend):

```typescript
// apps/backend-v2/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
```

### Supabase Test Setup:

```typescript
// apps/backend-v2/tests/helpers/supabaseTest.ts
import { createClient } from '@supabase/supabase-js';

export async function setupTestDB() {
  const supabase = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_KEY!);

  // Iniciar transacción
  await supabase.rpc('begin_test_transaction');

  return supabase;
}

export async function teardownTestDB(supabase: any) {
  // Rollback automático
  await supabase.rpc('rollback_test_transaction');
}
```

### Playwright Config:

```typescript
// apps/frontend-v2/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 12'] } }
  ]
});
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 13)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 11)
- Testing Guide: `docs/TESTING-GUIDE.md`
