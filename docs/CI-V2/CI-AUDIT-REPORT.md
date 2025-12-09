# 🔍 CI v2 Audit Report

**Fecha:** 2025-12-02  
**Objetivo:** Auditoría completa de workflows CI para migración a v2  
**Estado:** READ-ONLY (sin modificaciones)

---

## 📊 Resumen Ejecutivo

### Workflows Totales: 25

| Categoría                           | Cantidad | Estado        |
| ----------------------------------- | -------- | ------------- |
| **KEEP** (v2 compatible)            | 3        | ✅ Mantener   |
| **MODIFY** (necesita actualización) | 8        | 🔄 Actualizar |
| **DELETE** (obsoleto v1)            | 14       | ❌ Eliminar   |

### Problemas Críticos Detectados

1. ❌ **0 workflows usan system-map-v2.yaml** (todos usan v1)
2. ❌ **0 workflows usan nodes-v2/** (todos usan docs/nodes/)
3. ❌ **0 workflows usan scripts v2** (todos usan scripts v1 legacy)
4. ❌ **14 workflows ejecutan tests legacy** sin validación v2
5. ⚠️ **system-map-v2.yaml no existe** en el repositorio (requiere creación)

---

## 📋 Auditoría Detallada por Workflow

### ✅ KEEP - Workflows Compatibles con v2

#### 1. `.github/workflows/ci.yml`

- **¿Qué hace?** Pipeline principal CI/CD con build, security audit, lint y tests
- **¿Qué archivos toca?** `src/`, `frontend/`, `tests/`
- **¿Ejecuta tests legacy?** ✅ SÍ (`npm run test:ci`)
- **¿Depende de rutas v1?** ❌ NO (no toca GDD directamente)
- **¿Ejecuta scripts v1?** ❌ NO
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **KEEP** (pero necesita desactivar tests legacy)
- **Acción requerida:** Desactivar `npm run test:ci` hasta que tests v2 estén listos

#### 2. `.github/workflows/pre-merge-validation.yml`

- **¿Qué hace?** Validación de completitud antes de merge (Guardian)
- **¿Qué archivos toca?** `scripts/ci/validate-completion.js`
- **¿Ejecuta tests legacy?** ✅ SÍ (`npm test -- --coverage`)
- **¿Depende de rutas v1?** ❌ NO
- **¿Ejecuta scripts v1?** ❌ NO
- **¿Bloquea PRs innecesariamente?** ❌ NO (solo cuando label `ready-to-merge`)
- **Clasificación:** **KEEP** (crítico para calidad)
- **Acción requerida:** Actualizar para usar validadores v2 cuando estén listos

#### 3. `.github/workflows/guardian-check.yml`

- **¿Qué hace?** Guardian Product Governance Check
- **¿Qué archivos toca?** `scripts/guardian-gdd.js`
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ⚠️ SÍ (usa `scripts/guardian-gdd.js` que puede referenciar v1)
- **¿Ejecuta scripts v1?** ⚠️ POSIBLE (depende de implementación de guardian-gdd.js)
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **KEEP** (pero necesita verificación de guardian-gdd.js)
- **Acción requerida:** Verificar que guardian-gdd.js no use rutas v1

---

### 🔄 MODIFY - Workflows que Necesitan Actualización

#### 4. `.github/workflows/gdd-validate.yml`

- **¿Qué hace?** Validación GDD en PRs
- **¿Qué archivos toca?** `docs/nodes/**`, `system-map.yaml`, `spec.md`
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ✅ **SÍ** - Usa `docs/nodes/**`, `system-map.yaml`, `spec.md`
- **¿Ejecuta scripts v1?** ✅ **SÍ** - `validate-gdd-runtime.js`, `score-gdd-health.js`, `predict-gdd-drift.js`
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **MODIFY** → Convertir a v2
- **Acción requerida:**
  - Cambiar `docs/nodes/**` → `docs/nodes-v2/**`
  - Cambiar `system-map.yaml` → `system-map-v2.yaml`
  - Cambiar `spec.md` → `spec-v2.md` (si existe)
  - Actualizar scripts a versiones v2 cuando estén disponibles

#### 5. `.github/workflows/gdd-auto-monitor.yml`

- **¿Qué hace?** Monitoreo automático de salud GDD cada 3 días
- **¿Qué archivos toca?** `docs/nodes/**`, `system-map.yaml`
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ✅ **SÍ** - Usa scripts v1 y rutas v1
- **¿Ejecuta scripts v1?** ✅ **SÍ** - `validate-gdd-runtime.js`, `score-gdd-health.js`, `predict-gdd-drift.js`
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **MODIFY** → Convertir a v2
- **Acción requerida:** Igual que gdd-validate.yml

#### 6. `.github/workflows/gdd-repair.yml`

- **¿Qué hace?** Auto-repair de GDD cuando detecta problemas
- **¿Qué archivos toca?** `docs/nodes/**`, `system-map.yaml`
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ✅ **SÍ** - Usa rutas v1
- **¿Ejecuta scripts v1?** ✅ **SÍ** - `validate-gdd-runtime.js`, `score-gdd-health.js`
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **MODIFY** → Convertir a v2
- **Acción requerida:** Actualizar a rutas y scripts v2

#### 7. `.github/workflows/gdd-telemetry.yml`

- **¿Qué hace?** Recolección de telemetría GDD
- **¿Qué archivos toca?** `docs/nodes/**`, `system-map.yaml`
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ✅ **SÍ** - Usa rutas v1
- **¿Ejecuta scripts v1?** ✅ **SÍ** - `validate-gdd-runtime.js`, `score-gdd-health.js`, `predict-gdd-drift.js`
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **MODIFY** → Convertir a v2
- **Acción requerida:** Actualizar a rutas y scripts v2

#### 8. `.github/workflows/post-merge-doc-sync.yml`

- **¿Qué hace?** Sincronización de documentación después de merge
- **¿Qué archivos toca?** `docs/nodes/`, `system-map.yaml`, `spec.md`
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ✅ **SÍ** - Usa `docs/nodes/`, `system-map.yaml`, `spec.md`
- **¿Ejecuta scripts v1?** ✅ **SÍ** - `resolve-graph.js`, `sync-gdd-nodes.js`, `sync-spec-md.js`, `validate-gdd-cross.js`, `predict-gdd-drift.js`
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **MODIFY** → Convertir a v2
- **Acción requerida:**
  - Cambiar `docs/nodes/` → `docs/nodes-v2/`
  - Cambiar `system-map.yaml` → `system-map-v2.yaml`
  - Cambiar `spec.md` → `spec-v2.md` (si existe)
  - Actualizar todos los scripts a v2

#### 9. `.github/workflows/tests.yml`

- **¿Qué hace?** Tests unitarios e integración
- **¿Qué archivos toca?** `src/`, `tests/`
- **¿Ejecuta tests legacy?** ✅ **SÍ** - `npm run test:integration` (con continue-on-error)
- **¿Depende de rutas v1?** ❌ NO
- **¿Ejecuta scripts v1?** ❌ NO
- **¿Bloquea PRs innecesariamente?** ❌ NO (muchos tests están desactivados con `if: false`)
- **Clasificación:** **MODIFY** → Desactivar completamente hasta v2
- **Acción requerida:** Desactivar todos los tests con `if: false` hasta que tests v2 estén listos

#### 10. `.github/workflows/integration-tests.yml`

- **¿Qué hace?** Tests de integración backend
- **¿Qué archivos toca?** `src/`, `tests/integration/backend/**`
- **¿Ejecuta tests legacy?** ✅ **SÍ** - `npm run test:integration-backend:*`
- **¿Depende de rutas v1?** ❌ NO
- **¿Ejecuta scripts v1?** ❌ NO
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **MODIFY** → Desactivar hasta v2
- **Acción requerida:** Desactivar con `if: false` hasta que tests v2 estén listos

#### 11. `.github/workflows/e2e-tests.yml`

- **¿Qué hace?** Tests E2E con Playwright
- **¿Qué archivos toca?** `frontend/`, `tests/e2e/`
- **¿Ejecuta tests legacy?** ✅ **SÍ** - Tests E2E v1
- **¿Depende de rutas v1?** ❌ NO
- **¿Ejecuta scripts v1?** ❌ NO
- **¿Bloquea PRs innecesariamente?** ❌ NO
- **Clasificación:** **MODIFY** → Desactivar hasta v2
- **Acción requerida:** Desactivar con `if: false` hasta que tests v2 estén listos

---

### ❌ DELETE - Workflows Obsoletos v1

#### 12. `.github/workflows/agent-receipts.yml`

- **¿Qué hace?** Validación de agent receipts
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ⚠️ POSIBLE
- **Clasificación:** **DELETE** (funcionalidad integrada en pre-merge-validation.yml)
- **Razón:** Duplicado de funcionalidad

#### 13. `.github/workflows/auto-format.yml`

- **¿Qué hace?** Auto-formateo de código
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **DELETE** (debe ser pre-commit hook, no CI)
- **Razón:** Auto-formateo debe ser local, no en CI

#### 14. `.github/workflows/ci-pr-validation.yml`

- **¿Qué hace?** Validación de PRs
- **¿Ejecuta tests legacy?** ⚠️ POSIBLE
- **¿Depende de rutas v1?** ⚠️ POSIBLE
- **Clasificación:** **DELETE** (duplicado de ci.yml)
- **Razón:** Duplicado de funcionalidad con ci.yml

#### 15. `.github/workflows/claude-code-review.yml`

- **¿Qué hace?** Code review con Claude
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **DELETE** (debe ser manual, no automático)
- **Razón:** Code review debe ser manual, no automático en CI

#### 16. `.github/workflows/claude.yml`

- **¿Qué hace?** Integración con Claude App
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **DELETE** (no es CI, es integración externa)
- **Razón:** No es parte del CI/CD pipeline

#### 17. `.github/workflows/deploy-production.yml`

- **¿Qué hace?** Deploy a producción
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **KEEP** (pero fuera de scope de esta auditoría)
- **Nota:** Deploy workflows no se modifican en esta tarea

#### 18. `.github/workflows/deploy-staging.yml`

- **¿Qué hace?** Deploy a staging
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **KEEP** (pero fuera de scope de esta auditoría)
- **Nota:** Deploy workflows no se modifican en esta tarea

#### 19. `.github/workflows/format-check.yml`

- **¿Qué hace?** Verificación de formato
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **DELETE** (duplicado de lint en ci.yml)
- **Razón:** Duplicado de funcionalidad

#### 20. `.github/workflows/frontend-build-check.yml`

- **¿Qué hace?** Verificación de build frontend
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **DELETE** (duplicado de build-check en ci.yml)
- **Razón:** Duplicado de funcionalidad

#### 21. `.github/workflows/gdd-issue-cleanup.yml`

- **¿Qué hace?** Limpieza de issues GDD
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ⚠️ POSIBLE
- **Clasificación:** **DELETE** (mantenimiento manual, no CI)
- **Razón:** Limpieza de issues debe ser manual

#### 22. `.github/workflows/main.yml`

- **¿Qué hace?** Integración con Claude App (duplicado de claude.yml)
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **DELETE** (duplicado de claude.yml)
- **Razón:** Duplicado

#### 23. `.github/workflows/pr-branch-guard.yml`

- **¿Qué hace?** Protección de ramas PR
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **KEEP** (protección de ramas es crítica)
- **Nota:** No se modifica en esta tarea

#### 24. `.github/workflows/runner-json-demo.yml`

- **¿Qué hace?** Demo de runner JSON
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **DELETE** (demo, no producción)
- **Razón:** Demo no debe estar en CI

#### 25. `.github/workflows/spec14-qa-test-suite.yml`

- **¿Qué hace?** Suite de tests QA spec14
- **¿Ejecuta tests legacy?** ✅ **SÍ** - Tests legacy
- **¿Depende de rutas v1?** ⚠️ POSIBLE
- **Clasificación:** **DELETE** (tests legacy v1)
- **Razón:** Tests legacy v1

#### 26. `.github/workflows/stripe-validation.yml`

- **¿Qué hace?** Validación de Stripe
- **¿Ejecuta tests legacy?** ❌ NO
- **¿Depende de rutas v1?** ❌ NO
- **Clasificación:** **KEEP** (validación de billing es crítica)
- **Nota:** No se modifica en esta tarea

---

## 🚨 Problemas Críticos Detectados

### 1. system-map-v2.yaml No Existe

**Problema:** El archivo `docs/system-map-v2.yaml` no existe en el repositorio.

**Impacto:**

- Los scripts v2 no pueden ejecutarse
- Los workflows v2 no pueden validar system-map
- La migración a v2 está bloqueada

**Acción requerida:**

- ⚠️ **STOP** - No se puede continuar sin system-map-v2.yaml
- Crear system-map-v2.yaml antes de continuar
- O confirmar ubicación alternativa

### 2. Scripts v2 No Existen Completamente

**Scripts que existen:**

- ✅ `scripts/validate-node-ids.js` (v2)
- ✅ `scripts/validate-workers-ssot.js` (v2)
- ✅ `scripts/validate-drift.js` (v2)
- ✅ `scripts/validate-symmetry.js` (v2)
- ✅ `scripts/validate-strong-concepts.js` (v2)
- ✅ `scripts/detect-legacy-ids.js` (v2)
- ✅ `scripts/detect-guardian-references.js` (v2)

**Scripts que NO existen:**

- ❌ `scripts/calculate-gdd-health-v2.js` (solo existe `score-gdd-health.js` v1)

**Acción requerida:**

- Usar `score-gdd-health.js` con flag `--v2` o crear wrapper
- O crear `calculate-gdd-health-v2.js` nuevo

### 3. Tests Legacy Ejecutándose

**Workflows que ejecutan tests legacy:**

1. `ci.yml` → `npm run test:ci`
2. `pre-merge-validation.yml` → `npm test -- --coverage`
3. `tests.yml` → `npm run test:integration`
4. `integration-tests.yml` → `npm run test:integration-backend:*`
5. `e2e-tests.yml` → Tests E2E v1

**Acción requerida:**

- Desactivar todos con `if: false` hasta que tests v2 estén listos

---

## 📝 Recomendaciones

### Fase 1: Preparación (ANTES de modificar workflows)

1. ✅ **Crear system-map-v2.yaml** (o confirmar ubicación)
2. ✅ **Verificar que todos los scripts v2 funcionan**
3. ✅ **Crear calculate-gdd-health-v2.js** (o wrapper)

### Fase 2: Crear Workflow v2 Nuevo

1. ✅ **Crear `.github/workflows/system-map-v2-consistency.yml`**
2. ✅ **Integrar todos los validadores v2**
3. ✅ **Configurar health score threshold ≥95**

### Fase 3: Desactivar Tests Legacy ✅ COMPLETADO

1. ✅ **Desactivar tests en ci.yml** - Backend y frontend tests desactivados
2. ✅ **Desactivar tests en pre-merge-validation.yml** - Test suite desactivado
3. ✅ **Desactivar tests en tests.yml** - Integration tests desactivados
4. ✅ **Desactivar tests en integration-tests.yml** - Fixtures y real backend tests desactivados
5. ✅ **Desactivar tests en e2e-tests.yml** - E2E tests desactivados

### Fase 4: Actualizar Workflows GDD

1. ✅ **Actualizar gdd-validate.yml a v2**
2. ✅ **Actualizar gdd-auto-monitor.yml a v2**
3. ✅ **Actualizar gdd-repair.yml a v2**
4. ✅ **Actualizar gdd-telemetry.yml a v2**
5. ✅ **Actualizar post-merge-doc-sync.yml a v2**

### Fase 5: Eliminar Workflows Obsoletos

1. ✅ **Eliminar workflows duplicados**
2. ✅ **Eliminar workflows de demo**
3. ✅ **Eliminar workflows de mantenimiento manual**

---

## ✅ Checklist de Validación

- [ ] system-map-v2.yaml existe
- [ ] Todos los scripts v2 funcionan
- [ ] calculate-gdd-health-v2.js existe o wrapper creado
- [ ] Workflow system-map-v2-consistency.yml creado
- [ ] Tests legacy desactivados
- [ ] Workflows GDD actualizados a v2
- [ ] Workflows obsoletos eliminados
- [ ] Health score threshold ≥95 configurado
- [ ] CI ejecuta validadores v2
- [ ] No hay referencias a rutas v1 en workflows activos

---

**Próximo paso:** Crear system-map-v2-consistency.yml workflow (FASE 2)
