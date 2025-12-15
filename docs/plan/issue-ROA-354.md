# Plan de Implementación - ROA-354: Limpieza de Issues GitHub

**Issue:** ROA-354  
**Fecha:** 2025-12-09  
**Estado:** En progreso  
**Tipo:** type:docs, type:ci, type:analysis

---

## Estado Actual

### Issues GDD Abiertas (4 total)

1. **#1121** - [GDD] Validation Failed - PR #1120
   - Estado PR: ✅ MERGED (2025-12-09)
   - Acción: Cerrar con comentario explicativo

2. **#1117** - [GDD] Validation Failed - PR #1116
   - Estado PR: ✅ MERGED (2025-12-09)
   - Acción: Cerrar con comentario explicativo

3. **#1105** - [GDD] Validation Failed - PR #1104
   - Estado PR: ✅ MERGED (2025-12-07)
   - Acción: Cerrar con comentario explicativo

4. **#1102** - [GDD] Auto-Monitor Alert: Health Below Threshold
   - Estado: Necesita verificación
   - Health Score: 86.9/100 (threshold: 87)
   - Acción: Verificar estado actual y decidir si cerrar o mantener

### Problema Identificado

- Issues de validación GDD quedan abiertas después de que sus PRs son mergeadas
- No hay workflow automático de limpieza activo
- Documentación menciona `.github/workflows/gdd-issue-cleanup.yml` pero no existe

---

## Pasos de Implementación

### Paso 1: Cerrar Issues Obsoletas

**Issues a cerrar:** #1121, #1117, #1105

**Comentario estándar:**
```markdown
✅ **Issue cerrada automáticamente**

El PR relacionado (#XXXX) fue mergeado el YYYY-MM-DD. 
La validación GDD ya no aplica a este PR.

Esta issue fue cerrada como parte de la limpieza de issues obsoletas (ROA-354).

---
*Cerrado automáticamente el 2025-12-09*
```

**Comando:**
```bash
gh issue close <ISSUE_NUMBER> --comment "<COMENTARIO>"
```

### Paso 2: Verificar Issue #1102

**Acciones:**
1. Verificar health score actual: `node scripts/score-gdd-health.js --ci`
2. Si health >= 87: Cerrar con comentario
3. Si health < 87: Mantener abierta (es válida)

### Paso 3: Crear Workflow de Limpieza Automática

**Archivo:** `.github/workflows/gdd-issue-cleanup.yml`

**Características:**
- Ejecuta diariamente a las 2 AM UTC
- Cierra issues GDD de validación si:
  - PR relacionado está merged/closed
  - Issue tiene más de 7 días (no 30, más agresivo)
- Añade comentario explicativo antes de cerrar
- Genera job summary con métricas

**Lógica:**
```yaml
For each open GDD issue:
  IF issue title matches "[GDD] Validation Failed - PR #XXX":
    Get PR #XXX status
    IF PR is MERGED or CLOSED:
      Close issue with comment
  ELSE IF issue is auto-monitor alert:
    Check current health score
    IF health >= threshold:
      Close issue with comment
```

### Paso 4: Mejorar Workflows Existentes

**Archivos a revisar:**
- `.github/workflows/gdd-validate.yml` - Verificar deduplicación
- `.github/workflows/gdd-repair.yml` - Verificar rollback handling

**Mejoras:**
- Añadir auto-cierre cuando PR se mergea
- Mejorar detección de issues duplicadas

---

## Agentes Relevantes

- **GitHubMonitor** - Para gestión de issues y PRs
- **DocumentationAgent** - Para documentación del workflow

---

## Archivos Afectados

### Nuevos
- `.github/workflows/gdd-issue-cleanup.yml`

### Modificados
- `.github/workflows/gdd-validate.yml` (posible mejora)
- `.github/workflows/gdd-repair.yml` (posible mejora)

### Documentación
- `docs/analysis/gdd-issue-cleanup-implementation.md` (actualizar)

---

## Validación Requerida

### Pre-commit
- [ ] Issues obsoletas cerradas correctamente
- [ ] Workflow de limpieza creado y validado
- [ ] Issue #1102 evaluada y acción tomada

### Post-implementación
- [ ] Workflow ejecuta correctamente (verificar en Actions)
- [ ] No se cierran issues activas incorrectamente
- [ ] Comentarios añadidos son claros y útiles

### Comandos de Validación
```bash
# Verificar issues GDD abiertas
gh issue list --label "gdd" --state open

# Verificar workflow existe
test -f .github/workflows/gdd-issue-cleanup.yml && echo "✅ Workflow existe"

# Verificar health score actual
node scripts/score-gdd-health.js --ci
```

---

## Métricas Esperadas

### Antes
- Issues GDD abiertas: 4
- Issues obsoletas: 3 (75%)
- Workflow de limpieza: No existe

### Después
- Issues GDD abiertas: 0-1 (depende de #1102)
- Issues obsoletas: 0
- Workflow de limpieza: Activo (diario)

---

## Riesgos y Mitigaciones

### Riesgo 1: Cerrar Issue Activa
**Mitigación:** Verificar estado de PR antes de cerrar

### Riesgo 2: Workflow Cierra Issues Prematuramente
**Mitigación:** Usar threshold de 7 días mínimo, verificar PR status

### Riesgo 3: Workflow No Ejecuta
**Mitigación:** Verificar en Actions después de merge, añadir logging

---

## Referencias

- Documentación previa: `docs/analysis/gdd-issue-cleanup-implementation.md`
- Workflows GDD: `.github/workflows/gdd-*.yml`
- Scripts de validación: `scripts/score-gdd-health.js`

