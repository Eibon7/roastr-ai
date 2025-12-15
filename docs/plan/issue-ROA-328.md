# Plan: ROA-328 - CI GitHub Actions Consolidation (Vitest First - Post v2 Migration)

**Issue:** ROA-328  
**Tipo:** Consolidación CI/CD  
**Prioridad:** P1  
**Estado:** En Planificación

---

## Estado Actual

### Workflows Existentes

1. **`.github/workflows/ci.yml`** (Principal)
   - Build check (frontend)
   - Security audit
   - Lint and test (Jest para backend legacy)
   - Smoke tests (deshabilitado)
   - Notify Slack (deshabilitado)

2. **`.github/workflows/tests.yml`** (Redundante)
   - Typecheck (deshabilitado)
   - Unit Tests (deshabilitado - esperando v2)
   - Integration Tests (deshabilitado - esperando v2)
   - E2E Tests (deshabilitado - esperando v2)
   - Coverage validation

3. **`.github/workflows/integration-tests.yml`** (Redundante)
   - Backend integration tests (deshabilitado - esperando v2)
   - Fixtures mode / Real backend mode
   - Coverage reports

4. **`.github/workflows/e2e-tests.yml`** (Redundante)
   - E2E tests con Playwright (deshabilitado - esperando v2)

### Estado de Testing

- **Frontend:** ✅ Vitest v4.0.14 (moderno)
- **Backend v2 (`apps/backend-v2`):** ✅ Vitest v1.1.0 (antiguo, necesita actualización)
- **Backend legacy (`src/`):** ❌ Jest (necesita migración a Vitest)

### Problemas Identificados

1. **Duplicación:** Múltiples workflows con funcionalidad solapada
2. **Deshabilitación masiva:** Muchos tests deshabilitados esperando v2
3. **Jest legacy:** Backend legacy todavía usa Jest
4. **Falta consolidación:** No hay un workflow único y claro
5. **Vitest inconsistente:** Backend v2 usa Vitest v1.1.0 (antiguo)

---

## Objetivos

1. ✅ Consolidar workflows CI en un único workflow principal
2. ✅ Migrar backend legacy de Jest a Vitest
3. ✅ Actualizar Vitest en backend v2 a versión moderna (v4.x)
4. ✅ Priorizar Vitest sobre Jest en todos los workflows
5. ✅ Simplificar estructura de CI
6. ✅ Habilitar tests que estaban deshabilitados (cuando sea posible)

---

## Pasos de Implementación

### FASE 1: Análisis y Preparación ✅

- [x] Crear worktree `feature/ROA-328-auto`
- [x] Analizar workflows existentes
- [x] Identificar dependencias Jest
- [x] Documentar estado actual

### FASE 2: Actualizar Vitest en Backend v2

- [ ] Actualizar `apps/backend-v2/package.json`:
  - Vitest: `^1.1.0` → `^4.0.14` (mismo que frontend)
  - Añadir `@vitest/coverage-v8` si falta
- [ ] Actualizar `apps/backend-v2/vitest.config.ts`:
  - Asegurar compatibilidad con v4
  - Configurar coverage thresholds
- [ ] Verificar tests existentes funcionan con Vitest v4

### FASE 3: Migrar Backend Legacy a Vitest

- [ ] Crear `vitest.config.ts` en raíz para backend legacy
- [ ] Migrar scripts en `package.json`:
  - `test` → usar Vitest
  - `test:coverage` → usar Vitest coverage
  - Mantener scripts Jest como `test:jest` (temporal, deprecar)
- [ ] Actualizar imports en tests:
  - `jest` → `vitest`
  - `describe`, `it`, `expect` → desde `vitest`
- [ ] Migrar configuraciones Jest a Vitest:
  - `jest.config.js` → `vitest.config.ts`
  - Mapear `moduleNameMapper` → `resolve.alias`
  - Mapear `setupFilesAfterEnv` → `setupFiles`
- [ ] Instalar dependencias:
  - `vitest@^4.0.14`
  - `@vitest/coverage-v8@^4.0.14`

### FASE 4: Consolidar Workflows CI

- [ ] Consolidar en `.github/workflows/ci.yml`:
  - **Job 1: Build & Lint**
    - Build frontend
    - Lint backend + frontend
  - **Job 2: Tests (Vitest First)**
    - Backend v2 tests (Vitest)
    - Backend legacy tests (Vitest - migrado)
    - Frontend tests (Vitest)
    - Integration tests (Vitest - cuando estén listos)
  - **Job 3: E2E Tests**
    - Playwright E2E (cuando estén listos)
  - **Job 4: Coverage Validation**
    - Validar thresholds
    - Upload coverage reports
- [ ] Deprecar workflows redundantes:
  - `tests.yml` → Eliminar o marcar como deprecated
  - `integration-tests.yml` → Eliminar o marcar como deprecated
  - `e2e-tests.yml` → Integrar en `ci.yml` o mantener separado si es necesario

### FASE 5: Actualizar Scripts y Documentación

- [ ] Actualizar `package.json` scripts:
  - `test` → Vitest (backend + frontend)
  - `test:unit` → Vitest unit tests
  - `test:integration` → Vitest integration tests
  - `test:coverage` → Vitest coverage
- [ ] Actualizar documentación:
  - `docs/nodes-v2/13-testing.md` (actualizar estado)
  - `docs/nodes-v2/14-infraestructura.md` (actualizar CI workflow)
- [ ] Actualizar README si es necesario

### FASE 6: Validación y Testing

- [ ] Ejecutar tests localmente:
  - Backend v2 tests (Vitest v4)
  - Backend legacy tests (Vitest v4 - migrado)
  - Frontend tests (Vitest v4)
- [ ] Verificar coverage:
  - Backend v2 coverage
  - Backend legacy coverage
  - Frontend coverage
- [ ] Validar workflows CI:
  - `node scripts/validate-v2-doc-paths.js --ci`
  - `node scripts/validate-ssot-health.js --ci`
  - `node scripts/check-system-map-drift.js --ci`
  - `node scripts/validate-strong-concepts.js --ci`

### FASE 7: Cleanup

- [ ] Eliminar configuraciones Jest obsoletas:
  - `jest.config.js` → Deprecar (mantener temporalmente)
  - `jest.ci.config.cjs` → Deprecar
  - `jest.skipExternal.config.js` → Deprecar
  - `jest.testing-mvp.config.js` → Deprecar
  - `jest.spec14.config.js` → Deprecar
- [ ] Eliminar dependencias Jest (cuando todo migrado):
  - `jest` → Remover
  - `babel-jest` → Remover
  - `jest-environment-jsdom` → Remover
  - `jest-html-reporters` → Remover
  - `jest-junit` → Remover (o mantener si se necesita para CI)

---

## Archivos Afectados

### Nuevos Archivos

- `vitest.config.ts` (raíz) - Configuración Vitest para backend legacy

### Archivos Modificados

- `.github/workflows/ci.yml` - Consolidación de workflows
- `package.json` - Scripts y dependencias
- `apps/backend-v2/package.json` - Actualizar Vitest
- `apps/backend-v2/vitest.config.ts` - Actualizar para v4
- `docs/nodes-v2/13-testing.md` - Actualizar estado
- `docs/nodes-v2/14-infraestructura.md` - Actualizar CI workflow

### Archivos a Deprecar (Futuro)

- `.github/workflows/tests.yml` - Consolidar en ci.yml
- `.github/workflows/integration-tests.yml` - Consolidar en ci.yml
- `.github/workflows/e2e-tests.yml` - Integrar en ci.yml o mantener separado
- `jest.config.js` - Deprecar cuando todo migrado
- `jest.*.config.js` - Deprecar cuando todo migrado

---

## Agentes Relevantes

- **TestEngineer** - Migración de tests, validación de coverage
- **Back-end Dev** - Migración backend legacy a Vitest
- **Guardian** - Validación de cambios en CI/CD, seguridad

---

## Validación Requerida

1. ✅ Tests pasando (backend v2, backend legacy, frontend)
2. ✅ Coverage ≥ thresholds configurados
3. ✅ Workflows CI ejecutándose correctamente
4. ✅ Validaciones v2 pasando
5. ✅ No regresiones en tests existentes

---

## Notas

- **Prioridad Vitest:** Todos los nuevos tests deben usar Vitest
- **Jest Legacy:** Mantener temporalmente para compatibilidad, deprecar gradualmente
- **Workflows:** Consolidar en `ci.yml` principal, mantener otros solo si es necesario
- **Coverage:** Asegurar que coverage reports funcionan con Vitest

---

**Última actualización:** 2025-12-05  
**Estado:** En Planificación

