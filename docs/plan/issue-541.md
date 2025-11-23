# Plan: Issue #541 - Phase 17.1 – Add Cron-based Auto-Health and Drift Monitoring

**Issue:** #541
**Branch:** `feat/issue-541-gdd-auto-monitor`
**Priority:** P1
**Type:** Feature - GDD Enhancement
**Created:** 2025-11-11
**Estimated Effort:** 3-4 hours

---

## Estado Actual

El sistema GDD actualmente se ejecuta:

- ✅ Manualmente via scripts CLI
- ✅ En PRs via `.github/workflows/gdd-validate.yml`
- ❌ **NO automáticamente en el repositorio base** (main branch)

**Problema:**
Sin monitoreo periódico automático, la degradación de documentación solo se detecta cuando hay PRs activos, dejando ventanas de tiempo donde la calidad del sistema puede degradarse sin detección.

**Solución:**
Implementar un workflow cron que ejecute validaciones periódicas en main, genere reportes automáticos, y cree issues cuando la salud del sistema cae bajo umbrales.

---

## Objetivos (Acceptance Criteria)

1. **AC1:** Workflow se ejecuta automáticamente en horario previsto (cada 3 días)
2. **AC2:** Reportes generados y versionados correctamente en `docs/auto-health-reports/`
3. **AC3:** Issues creadas cuando hay degradación o riesgo (con prevención de duplicados)
4. **AC4:** No rompe CI ni PRs existentes
5. **AC5:** Documentación actualizada con Phase 17.1
6. **AC6:** Regla en CLAUDE.md: "Auto-monitoring no puede ser deshabilitado sin reemplazo equivalente"

---

## Pasos de Implementación

### PASO 1: Crear Workflow `.github/workflows/gdd-auto-monitor.yml`

**Objetivos:**

- Ejecutar cada 3 días via cron
- Permitir ejecución manual (workflow_dispatch)
- Ejecutar los 3 scripts core de GDD:
  - `validate-gdd-runtime.js --ci`
  - `score-gdd-health.js --summary`
  - `predict-gdd-drift.js --create-issues`

**Referencia:** `.github/workflows/gdd-validate.yml` (usar como template)

**Configuración cron:**

```yaml
on:
  schedule:
    - cron: '0 8 */3 * *' # Cada 3 días a las 8:00 UTC
  workflow_dispatch: # Manual trigger
```

**Outputs esperados:**

- `gdd-health.json`
- `gdd-drift.json`
- `gdd-status.json`
- Reportes MD (system-validation.md, system-health.md, drift-report.md)

---

### PASO 2: Implementar Generación de Reportes Versionados

**Objetivos:**

- Guardar reportes en `docs/auto-health-reports/auto-health-<fecha>.*`
- Formato: `auto-health-2025-11-11-08-00.md` + `.json`
- Incluir timestamp, health score, drift risk, nodes affected

**Estructura del reporte:**

```markdown
# GDD Auto-Health Report

**Date:** 2025-11-11 08:00 UTC
**Trigger:** Scheduled (cron)

## Summary

- **Health Score:** 98.8/100 🟢
- **Drift Risk:** 15/100 🟢
- **Nodes Validated:** 13/13
- **Status:** HEALTHY

## Details

[Links to detailed reports]

## Actions Taken

- ✅ Validation passed
- ✅ No issues created
```

---

### PASO 3: Implementar Sistema de Creación de Issues

**Objetivos:**

- Crear issue si `health_score < min_health_score` (.gddrc.json)
- Crear issue si `drift_risk > 60`
- **Prevenir duplicados:** Buscar issues existentes con mismo título antes de crear

**Implementación:**

```yaml
- name: Create issue on health degradation
  if: steps.health.outputs.score < steps.config.outputs.min_health
  uses: actions/github-script@v8
  with:
    script: |
      // Check for existing issue
      const { data: issues } = await github.rest.search.issuesAndPullRequests({
        q: `repo:${context.repo.owner}/${context.repo.repo} is:issue is:open label:gdd in:title "[GDD] Auto-Monitor Alert"`,
        per_page: 1
      });

      if (issues.items.length > 0) {
        // Update existing
      } else {
        // Create new
      }
```

**Issue labels:** `documentation`, `gdd`, `tech-debt`, `priority:P1`, `auto-monitor`

---

### PASO 4: Implementar Rotación de Reportes

**Objetivos:**

- Mantener solo últimos 30 reportes (90 días aprox.)
- Limpiar reportes antiguos automáticamente

**Script:** `scripts/cleanup-old-reports.js` (nuevo)

**Implementación:**

```javascript
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../docs/auto-health-reports');
const MAX_REPORTS = 30;

// Read all reports, sort by date, keep latest 30
// Delete older reports
```

**Integración en workflow:**

```yaml
- name: Cleanup old reports
  run: node scripts/cleanup-old-reports.js
```

---

### PASO 5: Actualizar Documentación

**Archivos a actualizar:**

1. **`docs/GDD-IMPLEMENTATION-SUMMARY.md`:**
   - Añadir Phase 17.1 a la tabla de fases
   - Actualizar estadísticas (phases completed)

2. **`CLAUDE.md`:**
   - Añadir regla en sección "GDD 2.0 - Quick Reference"
   - Texto: "⚠️ **CRITICAL:** Auto-monitoring cannot be disabled without equivalent replacement. This ensures continuous health tracking of GDD system."

3. **Crear `docs/implementation/GDD-PHASE-17.1.md`:**
   - Documentación detallada de Phase 17.1
   - Architecture, implementation, configuration

---

### PASO 6: Validación y Testing

**Checklist:**

- [ ] Workflow syntax válida (GitHub Actions validator)
- [ ] Test manual execution: `gh workflow run gdd-auto-monitor.yml`
- [ ] Verificar reportes generados en `docs/auto-health-reports/`
- [ ] Verificar issues creadas correctamente (con duplicates prevention)
- [ ] Verificar rotación funciona (cleanup script)
- [ ] GDD health check: `node scripts/score-gdd-health.js --ci` ≥ 87
- [ ] No rompe workflows existentes (gdd-validate.yml sigue funcionando)

---

## Archivos Afectados

### Nuevos

- `.github/workflows/gdd-auto-monitor.yml` (workflow principal)
- `scripts/cleanup-old-reports.js` (rotación de reportes)
- `docs/auto-health-reports/` (directorio de reportes)
- `docs/implementation/GDD-PHASE-17.1.md` (documentación de fase)

### Modificados

- `docs/GDD-IMPLEMENTATION-SUMMARY.md` (añadir Phase 17.1)
- `CLAUDE.md` (añadir regla de auto-monitoring)
- `docs/.gddindex.json` (auto-actualizado por scripts)

---

## Agentes Involucrados

- **Orchestrator** (Lead) - Coordinar implementación
- **Test Engineer** - Validar workflows y scripts
- **Documentation Agent** - Actualizar docs
- **Guardian** - Review seguridad y políticas

---

## Riesgos y Mitigaciones

| Riesgo                              | Probabilidad | Impacto | Mitigación                                |
| ----------------------------------- | ------------ | ------- | ----------------------------------------- |
| Issues duplicadas en cada ejecución | Alta         | Medio   | Implementar búsqueda antes de crear       |
| Reportes llenan disco               | Baja         | Bajo    | Sistema de rotación (30 reportes max)     |
| Workflow falla y no notifica        | Media        | Alto    | Email alerts + Slack integration (future) |
| Conflictos con gdd-validate.yml     | Baja         | Medio   | Usar mismos scripts, distinto trigger     |
| Cron ejecuta en PR branches         | Baja         | Bajo    | Configurar `branches: [main]`             |

---

## Configuraciones

### Cron Schedule

```
'0 8 */3 * *'  # Cada 3 días a las 8:00 UTC
```

### Thresholds (de .gddrc.json)

```json
{
  "min_health_score": 93,
  "max_drift_risk": 60,
  "auto_monitor": {
    "enabled": true,
    "schedule": "0 8 */3 * *",
    "max_reports": 30
  }
}
```

---

## Validación Final

**Pre-merge checklist:**

- [ ] Workflow ejecuta sin errores
- [ ] Reportes generados correctamente
- [ ] Issues creadas solo cuando necesario (no duplicados)
- [ ] Rotación limpia reportes antiguos
- [ ] Documentación actualizada
- [ ] GDD health ≥ 87
- [ ] Tests passing (si aplica)
- [ ] CodeRabbit: 0 comentarios

---

## Timeline Estimado

| Paso               | Tiempo Estimado | Status          |
| ------------------ | --------------- | --------------- |
| PASO 1: Workflow   | 60 min          | Pending         |
| PASO 2: Reportes   | 30 min          | Pending         |
| PASO 3: Issues     | 45 min          | Pending         |
| PASO 4: Rotación   | 30 min          | Pending         |
| PASO 5: Docs       | 45 min          | Pending         |
| PASO 6: Validación | 30 min          | Pending         |
| **TOTAL**          | **3-4 hours**   | **0% complete** |

---

**Plan Created:** 2025-11-11
**Status:** ✅ Ready for Implementation
**Next Step:** PASO 1 - Crear workflow gdd-auto-monitor.yml
