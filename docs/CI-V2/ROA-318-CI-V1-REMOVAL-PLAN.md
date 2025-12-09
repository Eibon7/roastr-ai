# ROA-318 — Plan de Eliminación Completa de GDD v1 en CI

**Fecha:** 2025-12-09  
**PR:** #1120  
**Rama:** feature/roa-318-cleanup-legacy-v2  
**Objetivo:** Eliminar completamente GDD v1 de CI y arreglar todos los fallos

---

## 📋 FASE 0: Análisis y Preparación

### Estado Actual

**Workflows con v1:**
1. `gdd-validate.yml` - Ejecuta `score-gdd-health.js` cuando no es v2-only
2. `gdd-telemetry.yml` - Ejecuta `score-gdd-health.js`, `validate-gdd-runtime.js`, `predict-gdd-drift.js`
3. `gdd-repair.yml` - Ejecuta `score-gdd-health.js`, `validate-gdd-runtime.js`
4. `gdd-auto-monitor.yml` - Ejecuta `score-gdd-health.js`, `validate-gdd-runtime.js`

**Issues detectados:**
- `detect-legacy-ids.js` falla por código src/ (43 IDs legacy)
- Orden de steps incorrecto en `system-map-v2-consistency.yml`

---

## 📋 FASE 1: Eliminar GDD v1 de Workflows

### 1.1 gdd-validate.yml

**Cambios requeridos:**
- Eliminar: `node scripts/score-gdd-health.js --ci` (línea 272)
- Eliminar: `node scripts/validate-gdd-runtime.js --ci` (línea 126)
- Eliminar: `node scripts/predict-gdd-drift.js --ci` (línea 284)
- Reemplazar por:
  - `node scripts/compute-health-v2-official.js --update-ssot` (solo si es necesario actualizar SSOT)
  - `node scripts/calculate-gdd-health-v2.js --json` (para leer health desde SSOT)

**Estrategia:**
- Si PR es v2-only → usar solo scripts v2
- Si PR es mixto → usar scripts v2 para validación v2, mantener v1 solo si es necesario para v1

### 1.2 gdd-telemetry.yml

**Cambios requeridos:**
- Eliminar: `node scripts/score-gdd-health.js --ci || true` (línea 42)
- Eliminar: `node scripts/validate-gdd-runtime.js --ci || true` (línea 41)
- Eliminar: `node scripts/predict-gdd-drift.js --ci || true` (línea 43)
- Reemplazar por:
  - `node scripts/compute-health-v2-official.js --update-ssot` (actualizar SSOT)
  - `node scripts/calculate-gdd-health-v2.js --json` (leer health)

**Nota:** Telemetría debe usar v2 exclusivamente

### 1.3 gdd-repair.yml

**Cambios requeridos:**
- Eliminar: `node scripts/score-gdd-health.js --ci` (línea 115)
- Eliminar: `node scripts/validate-gdd-runtime.js --ci` (línea 114)
- Reemplazar por:
  - `node scripts/compute-health-v2-official.js --update-ssot` (después de reparación)
  - `node scripts/calculate-gdd-health-v2.js --json` (validar health)

### 1.4 gdd-auto-monitor.yml

**Cambios requeridos:**
- Eliminar: `node scripts/score-gdd-health.js --summary` (línea 104)
- Eliminar: `node scripts/validate-gdd-runtime.js --ci` (línea 95)
- Reemplazar por:
  - `node scripts/compute-health-v2-official.js --update-ssot`
  - `node scripts/calculate-gdd-health-v2.js --json`
- Actualizar referencias en mensajes/comentarios

---

## 📋 FASE 2: Arreglar detect-legacy-ids.js

### 2.1 Modificar Script

**Archivo:** `scripts/detect-legacy-ids.js`

**Cambios requeridos:**
- Añadir lógica para distinguir entre:
  - Legacy IDs en `docs/system-map-v2.yaml` → FAIL
  - Legacy IDs en `docs/nodes-v2/**/*.md` → FAIL
  - Legacy IDs en `docs/SSOT-V2.md` → FAIL
  - Legacy IDs en `src/**` → WARN (exit 0 en modo --ci)

**Implementación:**
```javascript
// En modo --ci:
if (isCIMode) {
  const docsErrors = errors.filter(e => 
    e.file.includes('docs/system-map-v2.yaml') ||
    e.file.includes('docs/nodes-v2/') ||
    e.file.includes('docs/SSOT-V2.md')
  );
  const srcErrors = errors.filter(e => e.file.includes('src/'));
  
  if (docsErrors.length > 0) {
    // FAIL si hay errores en docs
    process.exit(1);
  }
  if (srcErrors.length > 0) {
    // WARN si hay errores en src/
    console.warn(`⚠️ Found ${srcErrors.length} legacy IDs in src/ (outside scope)`);
    process.exit(0);
  }
}
```

### 2.2 Actualizar Workflow

**Archivo:** `.github/workflows/system-map-v2-consistency.yml`

**Cambios requeridos:**
- Mantener `continue-on-error: false` (el script ahora maneja src/ correctamente)
- O cambiar a `continue-on-error: true` si el script no se modifica

---

## 📋 FASE 3: Reordenar Steps en system-map-v2-consistency.yml

### 3.1 Orden Actual

1. Validate Node IDs
2. Validate Workers SSOT
3. Validate Drift
4. Validate Symmetry
5. Validate Strong Concepts
6. Detect Legacy IDs
7. Detect Guardian References
8. Check System Map Drift
9. Validate v2 Doc Paths
10. Calculate GDD Health v2

### 3.2 Orden Correcto

1. Validate Node IDs
2. Validate Workers SSOT
3. Validate Drift
4. Validate Symmetry
5. Validate Strong Concepts
6. **Check System Map Drift** ← MOVER AQUÍ
7. Validate v2 Doc Paths
8. Detect Legacy IDs
9. Detect Guardian References
10. **Calculate GDD Health v2** (separar en compute + calculate)

**Cambios específicos:**
- Mover step "Check System Map Drift" después de "Validate Strong Concepts"
- Separar "Calculate GDD Health v2" en dos steps:
  - `compute-health-v2-official.js` (cálculo)
  - `calculate-gdd-health-v2.js --json` (lectura desde SSOT)

---

## 📋 FASE 4: Verificación Final

### 4.1 Scripts de Validación

Ejecutar en orden:
1. `node scripts/validate-v2-doc-paths.js --ci`
2. `node scripts/validate-ssot-health.js --ci`
3. `node scripts/validate-strong-concepts.js --ci`
4. `node scripts/check-system-map-drift.js --ci`
5. `node scripts/compute-health-v2-official.js`
6. `node scripts/calculate-gdd-health-v2.js --json`

### 4.2 Verificaciones Adicionales

- System map tiene 0 ciclos
- Health score = 100/100 (desde SSOT)
- No hay referencias a scripts v1 en workflows
- No hay drift
- No hay legacy IDs en docs/system-map (src/ permitido)

---

## 📋 FASE 5: Generar Resumen

### 5.1 Contenido del Resumen

- Qué se cambió
- Qué scripts v1 se eliminaron
- Qué workflows se actualizaron
- Verificaciones que pasaron
- Confirmación de que CI v2 es el único CI para GDD

---

## 🎯 Orden de Ejecución

1. **FASE 1:** Eliminar v1 de workflows (4 archivos)
2. **FASE 2:** Arreglar detect-legacy-ids.js
3. **FASE 3:** Reordenar steps en system-map-v2-consistency.yml
4. **FASE 4:** Verificación final
5. **FASE 5:** Generar resumen
6. **FASE 6:** Commit (sin push)

---

## ⚠️ Reglas Críticas

- NO tocar: system-map-v2.yaml, SSOT-V2.md (excepto sección 15), nodes-v2/*, compute-health-v2-official.js (salvo necesario), calculate-gdd-health-v2.js
- NO hacer push
- Solo modificar workflows y scripts de validación
- Mantener health score 100/100 desde SSOT

---

**Plan generado:** 2025-12-09  
**Estado:** READY FOR EXECUTION

