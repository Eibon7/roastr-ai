# System Map v2 Consistency Workflow - Specification

**Workflow:** `.github/workflows/system-map-v2-consistency.yml`  
**Versión:** 1.0.0  
**Fecha:** 2025-12-02  
**Estado:** ✅ Creado

---

## 📋 Descripción

Workflow de CI que valida la consistencia del System Map v2, asegurando que:

- Todos los nodos en `nodes-v2/` existen en `system-map-v2.yaml`
- Todos los nodos en `system-map-v2.yaml` tienen sus archivos en `nodes-v2/`
- Las relaciones `depends_on` y `required_by` son simétricas
- No existen nodos legacy v1
- No existen workers legacy
- No hay archivos huérfanos fuera del system-map
- El health score es ≥95

---

## 🎯 Triggers

### Pull Requests

- **Branches:** `main`
- **Paths:**
  - `docs/system-map-v2.yaml`
  - `docs/nodes-v2/**`
  - `docs/SSOT-V2.md`
  - `src/**`
  - `scripts/validate-*.js`
  - `scripts/detect-*.js`

### Push

- **Branches:** `feature/**`
- **Paths:** Mismos que PRs

### Manual (workflow_dispatch)

- **Inputs:**
  - `full_validation` (boolean, default: true): Ejecutar validación completa incluyendo health score

---

## 🔧 Validaciones Ejecutadas

### 1. Validate Node IDs

- **Script:** `scripts/validate-node-ids.js --ci`
- **Propósito:** Valida que todos los IDs de nodos referenciados en `nodes-v2/` y código están definidos en `system-map-v2.yaml`
- **Falla si:** Detecta IDs legacy o referencias inválidas
- **Tiempo estimado:** 5-10 segundos

### 2. Validate Workers SSOT

- **Script:** `scripts/validate-workers-ssot.js --ci`
- **Propósito:** Valida que todos los workers referenciados son oficiales del SSOT-V2.md
- **Falla si:** Detecta workers no oficiales o legacy
- **Tiempo estimado:** 5-10 segundos

### 3. Validate Drift

- **Script:** `scripts/validate-drift.js --ci`
- **Propósito:** Detecta drift entre SSOT-V2.md, nodes-v2, y system-map-v2.yaml
- **Falla si:** Detecta valores desalineados según jerarquía SSOT
- **Tiempo estimado:** 10-15 segundos

### 4. Validate Symmetry

- **Script:** `scripts/validate-symmetry.js --ci`
- **Propósito:** Valida que `depends_on` y `required_by` son simétricos
- **Falla si:** Detecta relaciones asimétricas
- **Tiempo estimado:** 5-10 segundos

### 5. Validate Strong Concepts

- **Script:** `scripts/validate-strong-concepts.js --ci`
- **Propósito:** Valida que Strong Concepts no están duplicados y tienen dueño único
- **Falla si:** Detecta duplicados de Strong Concepts
- **Tiempo estimado:** 5-10 segundos

### 6. Detect Legacy IDs

- **Script:** `scripts/detect-legacy-ids.js --ci`
- **Propósito:** Detecta IDs legacy v1 que deben migrarse a v2
- **Falla si:** Detecta IDs legacy
- **Tiempo estimado:** 5-10 segundos

### 7. Detect Guardian References

- **Script:** `scripts/detect-guardian-references.js --ci`
- **Propósito:** Detecta referencias al nodo "guardian" deprecated
- **Falla si:** Detecta referencias a guardian
- **Tiempo estimado:** 5-10 segundos

### 8. Check System Map Drift

- **Script:** `scripts/check-system-map-drift.js --ci`
- **Propósito:** Verifica consistencia entre system-map-v2.yaml y nodes-v2/
- **Falla si:** Detecta nodos faltantes, archivos huérfanos, o relaciones incorrectas
- **Tiempo estimado:** 10-15 segundos

### 9. Calculate GDD Health v2

- **Script:** `scripts/score-gdd-health.js --ci --json`
- **Propósito:** Calcula health score del sistema GDD
- **Falla si:** Health score < 95
- **Tiempo estimado:** 15-20 segundos
- **Nota:** Solo se ejecuta si `full_validation=true` o `workflow_dispatch`

---

## ⏱️ Tiempo Total Estimado

- **Sin health score:** ~50-60 segundos
- **Con health score:** ~65-80 segundos

**Límite configurado:** 5 minutos (300 segundos)

---

## ✅ Criterios de Éxito

El workflow pasa si:

1. ✅ Todas las validaciones (1-8) pasan sin errores
2. ✅ Health score ≥ 95 (si se ejecuta)
3. ✅ No hay referencias a guardian
4. ✅ No hay IDs legacy
5. ✅ No hay drift entre SSOT, nodes, y system-map
6. ✅ Symmetry está correcta
7. ✅ Strong Concepts no están duplicados

---

## ❌ Criterios de Falla

El workflow falla si:

1. ❌ Cualquier validación (1-8) falla
2. ❌ Health score < 95 (si se ejecuta)
3. ❌ Se detectan referencias a guardian
4. ❌ Se detectan IDs legacy
5. ❌ Se detecta drift crítico
6. ❌ Symmetry está rota
7. ❌ Strong Concepts están duplicados

---

## 📊 Outputs

### GitHub Step Summary

Genera un resumen en formato markdown con el estado de cada validación.

### PR Comment

Si es un PR, crea/actualiza un comentario con los resultados de validación.

### Artifacts

Sube `gdd-health-v2.json` como artifact (si se ejecuta health score).

---

## 🔄 Integración con Otros Workflows

Este workflow es **independiente** y puede ejecutarse:

- Antes de otros workflows de validación
- Como parte del pipeline principal
- Manualmente para validación ad-hoc

**Recomendación:** Ejecutar antes de `gdd-validate.yml` (cuando se actualice a v2).

---

## 📝 Notas de Implementación

### Health Score Script

Actualmente usa `score-gdd-health.js` que puede no tener soporte completo para v2. Si falla:

- Se genera un JSON con score 0 y status "unknown"
- El workflow continúa pero marca warning
- Se requiere actualizar el script para soporte v2 completo

### System Map Drift Check

El script `check-system-map-drift.js` es nuevo y verifica:

- Consistencia entre system-map-v2.yaml y nodes-v2/
- Archivos huérfanos
- Relaciones simétricas
- Nodos legacy

---

## 🚀 Próximos Pasos

1. ✅ Workflow creado
2. ⏳ Verificar que todos los scripts funcionan correctamente
3. ⏳ Actualizar `score-gdd-health.js` para soporte v2 completo
4. ⏳ Integrar en pipeline principal
5. ⏳ Documentar en README del proyecto

---

**Última actualización:** 2025-12-02
