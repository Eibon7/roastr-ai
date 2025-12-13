# GDD Node — Testing v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

Este nodo depende de los siguientes nodos:

- Ninguna dependencia directa

---

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

### Agentes Relevantes:

- Guardian
- TestEngineer

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

## 11. Related Nodes

- TBD — No documented relationships in SSOT/Spec

---

## 12. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `testing_config` - Configuración de tests (coverage thresholds, timeout)
- `test_coverage_thresholds` - Umbrales mínimos de cobertura por categoría

**Nota:** Los tests NO deben modificar el SSOT real. Debe usarse una copia del SSOT dedicada para testing.

---
