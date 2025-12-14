# Plan: ROA-331 - CI Enforce Node/System-Map Consistency After Node Modifications (GDD v2)

**Issue:** ROA-331  
**Título:** CI enforce node/system-map consistency after node modifications GDD v2  
**Fecha:** 2025-12-05  
**Estado:** En implementación

---

## Estado Actual

ROA-330 creó el script `validate-post-modification-v2.js` que ejecuta todas las validaciones necesarias después de modificar nodos v2 o system-map-v2.yaml:

1. `validate-v2-doc-paths.js` - Valida paths de documentación
2. `validate-ssot-health.js` - Valida sección 15 del SSOT
3. `check-system-map-drift.js` - Valida drift del system-map
4. `validate-strong-concepts.js` - Valida Strong Concepts

**Problema:** Este script no se ejecuta automáticamente en CI cuando se modifican nodos-v2 o system-map-v2.yaml. Las validaciones existen en el workflow pero están dispersas y no usan el script consolidado.

---

## Objetivo

Integrar `validate-post-modification-v2.js` en el workflow de CI para que se ejecute automáticamente cuando se detecten modificaciones en:
- `docs/nodes-v2/**`
- `docs/system-map-v2.yaml`

El script debe:
1. Ejecutarse automáticamente en CI cuando se modifican estos archivos
2. Fallar con exit code 1 si alguna validación falla
3. Reemplazar o complementar las validaciones individuales existentes

---

## Pasos de Implementación

### 1. Modificar `.github/workflows/gdd-validate.yml`

**Cambios necesarios:**

1. **Detectar modificaciones en nodos-v2 o system-map-v2.yaml:**
   - Ya existe detección de archivos v2
   - Añadir detección específica para nodos-v2 y system-map-v2.yaml

2. **Ejecutar `validate-post-modification-v2.js` cuando se detecten modificaciones:**
   - Ejecutar después de las validaciones individuales o reemplazarlas
   - Usar modo `--ci` para exit code correcto
   - Asegurar que se ejecute en el orden correcto

3. **Mantener compatibilidad:**
   - Si el script consolidado falla, el workflow debe fallar
   - Mantener las validaciones individuales como fallback si es necesario

**Estructura propuesta:**

```yaml
- name: Run Post-Modification Validation (v2)
  if: steps.check_v2_only.outputs.v2_only == 'true' && steps.changes.outputs.has_node_modifications == 'true'
  id: post_modification
  run: |
    echo "🔍 Running post-modification consistency validation..."
    node scripts/validate-post-modification-v2.js --ci
    echo "✅ Post-modification validation completed"
```

### 2. Detectar modificaciones específicas

Añadir step para detectar si se modificaron nodos-v2 o system-map-v2.yaml:

```yaml
- name: Detect node/system-map modifications
  if: steps.check_v2_only.outputs.v2_only == 'true'
  id: node_changes
  run: |
    if grep -qE '^(docs/nodes-v2/|docs/system-map-v2\.yaml)' changed-files.txt; then
      echo "has_node_modifications=true" >> $GITHUB_OUTPUT
      echo "✅ Node or system-map modifications detected"
    else
      echo "has_node_modifications=false" >> $GITHUB_OUTPUT
      echo "ℹ️  No node or system-map modifications"
    fi
```

### 3. Integrar en el flujo de validación

El script debe ejecutarse:
- **Después** de las validaciones individuales (si se mantienen)
- **O reemplazar** las validaciones individuales para nodos-v2/system-map-v2.yaml
- **Antes** del cálculo de health score

---

## Agentes a Usar

- **Backend Developer**: Modificar workflow de CI
- **Test Engineer**: Validar que el workflow funciona correctamente

---

## Archivos Afectados

**Modificados:**
- `.github/workflows/gdd-validate.yml` - Añadir ejecución de validate-post-modification-v2.js

**Sin cambios:**
- `scripts/validate-post-modification-v2.js` - Ya existe (ROA-330)

---

## Validación Requerida

1. ✅ Workflow ejecuta validate-post-modification-v2.js cuando se modifican nodos-v2 o system-map-v2.yaml
2. ✅ Workflow falla (exit 1) si el script falla
3. ✅ Workflow pasa (exit 0) si todas las validaciones pasan
4. ✅ Compatible con validaciones existentes
5. ✅ Funciona en PRs y workflow_dispatch

---

## Criterios de Éxito

- Script se ejecuta automáticamente en CI cuando se modifican nodos-v2 o system-map-v2.yaml
- Workflow falla correctamente si alguna validación falla
- Workflow pasa correctamente si todas las validaciones pasan
- No rompe validaciones existentes
- Documentación actualizada si es necesario

---

## Notas

- El script `validate-post-modification-v2.js` ya existe (ROA-330)
- Este issue solo requiere integrarlo en CI
- Debe ejecutarse solo cuando se modifican nodos-v2 o system-map-v2.yaml, no en todos los PRs v2
- Puede complementar o reemplazar validaciones individuales según sea necesario
