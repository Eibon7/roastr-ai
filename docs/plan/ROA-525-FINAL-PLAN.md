# ROA-525: Global Tests and Validation - Plan de Acción Definitivo

**Fecha:** 2026-01-08
**Estado:** ✅ Análisis Completado - Requiere Acción Sistémica
**Prioridad:** P0 - CRÍTICO

---

## 🚨 HALLAZGOS CRÍTICOS

### Métricas Actuales (Alarmantes)

- **Archivos de test:** 480 totales
  - ✅ Pasando: **2 archivos (0.4%)** 🚨
  - ❌ Fallando: **387 archivos (80.6%)**
  - ⏭️ Skipped: 1

- **Tests individuales:** 3028 totales
  - ✅ Pasando: **1 test (0.0%)** 🚨
  - ❌ Fallando: **500 tests (16.5%)**
  - ⏭️ Skipped: 7

### Diagnóstico

**🔍 CONCLUSIÓN:** El problema NO son tests individuales fallando, sino un **colapso sistémico de infraestructura de tests**.

**Evidencia:**
- Solo 0.4% de archivos pasan → Infraestructura rota
- Patrones repetidos en múltiples categorías
- Issues #1070, #1071, #1072, #1073 documentan ~900 tests afectados

---

## 🎯 Estrategia de Resolución

### Enfoque: Cascada de Infraestructura

**NO arreglar 387 tests individualmente, sino resolver 3-4 problemas sistémicos que desbloquean cientos de tests a la vez.**

---

## 📋 PLAN DE ACCIÓN DETALLADO

### FASE 1: Infraestructura Base (P0 - Bloqueante)

#### 1.1 Database/Supabase Test Setup

**Problema:** ~200-250 tests requieren DB real pero no hay setup configurado.

**Evidencia:**
- Tests de integración fallan con "SUPABASE_URL undefined"
- RLS tests no pueden ejecutarse sin DB
- Workers tests requieren cola en DB

**Acción:**
1. Implementar test database según Issue #719
2. Configurar Supabase test instance
3. Setup migraciones para DB test
4. Documentar en `docs/TESTING-GUIDE.md`

**Issues relacionadas:**
- #719: Implement real test database for roast integration tests
- #1071: Fix Integration Tests - Need Infrastructure (~180 tests)

**Impacto estimado:** Desbloquea ~200-250 tests

**Validación:**
```bash
# Después del fix, estos deberían pasar:
npm test tests/integration/
npm test tests/rls/
```

**Commit:** `feat(ROA-525): Setup test database infrastructure`

---

#### 1.2 Jest → Vitest Migration

**Problema:** ~50-100 tests usan `jest.mock()` que no existe en Vitest.

**Evidencia:**
```
ReferenceError: jest is not defined
 ❯ tests/unit/integrations/integrationManager.test.js:13:1
     12| // Mock logger - use factory function
     13| jest.mock('../../../src/utils/logger', () => ({
       | ^
```

**Acción:**
1. Buscar todos los archivos con `jest.mock()`:
   ```bash
   grep -r "jest.mock\|jest.fn\|jest.spyOn" tests/
   ```
2. Migrar syntax:
   - `jest.mock()` → `vi.mock()`
   - `jest.fn()` → `vi.fn()`
   - `jest.spyOn()` → `vi.spyOn()`
3. Añadir `import { vi } from 'vitest'` en cada archivo

**Issues relacionadas:**
- #1070: Fix Workers System Tests (~320 tests)
- #1073: Fix Platform Integration Tests (~200 tests)

**Impacto estimado:** Desbloquea ~50-100 tests

**Validación:**
```bash
npm test tests/unit/middleware/
npm test tests/unit/integrations/
```

**Commit:** `refactor(ROA-525): Migrate Jest syntax to Vitest`

---

#### 1.3 JSX Parser Configuration

**Problema:** ~20-30 tests usan JSX en archivos `.js` sin parser configurado.

**Evidencia:**
```
Error: Failed to parse source for import analysis because the content
contains invalid JS syntax. If you are using JSX, make sure to name
the file with the .jsx or .tsx extension.
```

**Acción:**
1. Identificar archivos `.js` con JSX:
   ```bash
   grep -r "render(<" tests/unit/frontend/ --include="*.js"
   ```
2. Renombrar `.js` → `.jsx`
3. O configurar Vite para parsear JSX en `.js`

**Impacto estimado:** Desbloquea ~20-30 tests frontend

**Validación:**
```bash
npm test tests/unit/frontend/
```

**Commit:** `fix(ROA-525): Fix JSX parsing in frontend test files`

---

### FASE 2: Tests Específicos (P1)

#### 2.1 RLS Tests (6 archivos)

**Dependencia:** FASE 1.1 completada

**Archivos:**
- `tests/rls/admin.test.js`
- `tests/rls/multi-tenant-direct.test.js`
- `tests/rls/roast.test.js`
- `tests/rls/shield-complete.test.js`
- `tests/rls/shield.test.js`
- `tests/rls/usage.test.js`

**Acción:**
1. Verificar políticas RLS en Supabase test DB
2. Asegurar que test users tienen permisos correctos
3. Validar multi-tenancy aislation

**Validación:**
```bash
npm test tests/rls/
```

**Commit:** `fix(ROA-525): Fix RLS tests with proper DB policies`

---

#### 2.2 Playwright/E2E Tests (7 archivos)

**Archivos:**
- `tests/e2e/auth-complete-flow.test.js`
- `tests/e2e/auto-approval-flow.test.js`
- `tests/e2e/brand-safety-defensive-roast.e2e.test.js`
- `tests/e2e/brand-safety-shield-flow.e2e.test.js`
- `tests/e2e/manual-flow.test.js`
- `tests/e2e/spec14-integral-test-suite.test.js`
- `tests/e2e/demo-flow.test.js`

**Acción:**
1. Verificar `playwright.config.js`
2. Asegurar browser context se crea correctamente
3. Validar timeouts apropiados

**Validación:**
```bash
npm test tests/e2e/
```

**Commit:** `fix(ROA-525): Fix E2E tests Playwright configuration`

---

### FASE 3: Workers & Platform Integration (P1)

**Dependencias:** FASE 1.1 y 1.2 completadas

**Issues relacionadas:**
- #1070: Fix Workers System Tests (~320 tests)
- #1073: Fix Platform Integration Tests (~200 tests)

**Acción:**
1. Aplicar fixes de FASE 1
2. Revisar workers tests específicos
3. Validar integración con plataformas (X, YouTube, etc.)

**Validación:**
```bash
npm test tests/integration/workers/
npm test tests/integration/platforms/
```

**Commit:** `fix(ROA-525): Stabilize workers and platform integration tests`

---

### FASE 4: Deprecated Code Cleanup (P2)

**Issue relacionada:**
- #1072: Delete Deprecated Roast Tests & Verify New System (~200 tests)

**Acción:**
1. Identificar tests deprecated sin valor
2. Eliminar tras confirmación con Product Owner
3. Documentar en changelog

**Commit:** `chore(ROA-525): Remove deprecated tests`

---

## 📊 Impacto Estimado por Fase

| Fase | Tests Desbloqueados | Tiempo Estimado |
|------|---------------------|-----------------|
| 1.1 Database Setup | ~200-250 | 2-3 días |
| 1.2 Jest Migration | ~50-100 | 1 día |
| 1.3 JSX Fix | ~20-30 | 0.5 días |
| 2.1 RLS | 6 archivos | 0.5 días |
| 2.2 E2E | 7 archivos | 1 día |
| 3 Workers/Platform | ~100-150 | 2 días |
| 4 Cleanup | ~200 | 1 día |
| **TOTAL** | **~580-750 tests** | **8-10 días** |

---

## 📝 Validación Final

Una vez completadas todas las fases:

```bash
# 1. Ejecutar todos los tests
npm test

# 2. Verificar cobertura
npm run test:coverage

# 3. Validar GDD
node scripts/validate-gdd-runtime.js --full

# 4. Score de health
node scripts/score-gdd-health.js --ci

# 5. Re-ejecutar validación
node scripts/validate-global-tests.js
```

**Criterios de éxito:**
- ✅ ≥95% archivos de test pasando
- ✅ ≥95% tests individuales pasando
- ✅ Coverage >= 90%
- ✅ GDD health >= 87
- ✅ 0 comentarios CodeRabbit

---

## 🔗 Referencias

- **Reporte de Validación:** `docs/test-evidence/ROA-525/validation-report.md`
- **Script de Validación:** `scripts/validate-global-tests.js`
- **Script de Análisis:** `scripts/analyze-test-failures.js`
- **Issues Relacionadas:**
  - #719: Real test database
  - #1070: Workers tests (~320)
  - #1071: Integration tests (~180)
  - #1072: Deprecated tests (~200)
  - #1073: Platform tests (~200)

---

## 🚨 Siguiente Paso Inmediato

**PRIORIDAD ABSOLUTA:** FASE 1.1 - Database Setup

Sin DB test configurada, ~200-250 tests NO PUEDEN ejecutarse, bloqueando el resto del trabajo.

**Acción requerida:**
1. Crear issue #719 si no existe
2. Asignar a Backend Dev
3. Establecer deadline: 3 días máximo

---

**Mantenido por:** Test Engineer
**Última actualización:** 2026-01-08
**Próxima revisión:** Después de completar FASE 1


