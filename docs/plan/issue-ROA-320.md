# Plan de Implementación - ROA-320: Fase 3 de Limpieza Documental

**Issue:** ROA-320  
**Título:** Fase 3 de limpieza documental: reclasificación y eliminación de legacy  
**Fecha:** 2025-12-11  
**Estado:** 🟡 En Planificación

---

## 📋 Contexto

### Fases Anteriores

- **ROA-318 (Fase 2):** Limpieza de system-map-v2.yaml y nodes-v2
  - ✅ Migración de IDs legacy en system-map
  - ✅ Resolución de nodos huérfanos
  - ✅ Endurecimiento de validadores
  - ✅ Health Score v2 = 100/100

- **ROA-323:** Migración de IDs legacy en código src/
  - ✅ Mapeo legacy → v2 generado
  - ⚠️ 43 referencias legacy en código (documentadas)

### Objetivo de Fase 3

**Reclasificar y eliminar documentos legacy** que ya no son relevantes o están duplicados, manteniendo solo documentación activa y útil.

---

## 📊 Estado Actual

### Inventario de Documentos

- **Total archivos .md en docs/:** 1,326
- **Archivos review-*.md en docs/plan/:** 147
- **Directorios review-* en docs/test-evidence/:** 83
- **Archivos en docs/legacy/:** 4 (ya clasificados)

### Categorías de Documentos Legacy

1. **CodeRabbit Review Documentation** (meta-documentación)
   - `docs/plan/review-*.md` (147 archivos)
   - `docs/test-evidence/review-*/` (83 directorios)
   - **Criterio:** Documentan reviews de CodeRabbit, no features

2. **Documentos de Planificación Obsoletos**
   - Planes de issues cerradas hace >6 meses
   - Planes de reviews ya resueltas
   - **Criterio:** Issue cerrada + PR merged + >6 meses

3. **Test Evidence Legacy**
   - Evidencias de tests de issues cerradas
   - Evidencias de reviews ya resueltas
   - **Criterio:** Issue cerrada + PR merged + >3 meses

4. **Documentos Duplicados**
   - Múltiples versiones del mismo documento
   - Documentos con contenido obsoleto
   - **Criterio:** Contenido duplicado o reemplazado por v2

---

## 🎯 Objetivos

### Objetivos Principales

1. ✅ **Reclasificar documentos legacy** según categorías
2. ✅ **Eliminar documentos obsoletos** (>6 meses, issues cerradas)
3. ✅ **Consolidar documentación duplicada**
4. ✅ **Mantener documentación activa** (issues abiertas, features activas)
5. ✅ **Validar con scripts v2** (no romper validaciones)

### Criterios de Eliminación

**ELIMINAR si:**
- Documento de CodeRabbit review (meta-documentación)
- Issue cerrada + PR merged + >6 meses
- Contenido duplicado o reemplazado por v2
- Test evidence de issue cerrada + >3 meses
- Documento sin referencias en código/docs activos

**MANTENER si:**
- Documento de feature activa
- Issue abierta o cerrada recientemente (<3 meses)
- Referenciado en código/docs activos
- Parte de SSOT o system-map-v2.yaml

---

## 📁 Estructura de Reclasificación

### Categorías de Destino

1. **`docs/legacy/reviews/`** (nuevo)
   - CodeRabbit review documentation
   - Planes de reviews resueltas
   - Test evidence de reviews

2. **`docs/legacy/plans/`** (nuevo)
   - Planes de issues cerradas >6 meses
   - Planes obsoletos o reemplazados

3. **`docs/legacy/test-evidence/`** (nuevo)
   - Test evidence de issues cerradas >3 meses
   - Test evidence de reviews resueltas

4. **`docs/archive/`** (existente, expandir)
   - Documentos históricos importantes
   - Documentos de referencia

5. **ELIMINAR directamente**
   - Documentos duplicados
   - Documentos sin valor histórico
   - Meta-documentación obsoleta

---

## 🔧 Plan de Implementación

### Fase 1: Análisis y Catalogación

**Objetivo:** Identificar todos los documentos legacy y clasificarlos.

**Acciones:**

1. **Inventariar documentos:**
   ```bash
   # CodeRabbit reviews
   find docs/plan -name "review-*.md" > docs/legacy-inventory-reviews.txt
   find docs/test-evidence -type d -name "review-*" > docs/legacy-inventory-review-dirs.txt
   
   # Plans de issues cerradas
   find docs/plan -name "issue-*.md" > docs/legacy-inventory-plans.txt
   
   # Test evidence de issues
   find docs/test-evidence -type d -name "issue-*" > docs/legacy-inventory-issue-dirs.txt
   ```

2. **Clasificar por criterios:**
   - CodeRabbit review → `docs/legacy/reviews/`
   - Issue cerrada >6 meses → `docs/legacy/plans/` o eliminar
   - Test evidence >3 meses → `docs/legacy/test-evidence/` o eliminar
   - Duplicado → Eliminar

3. **Generar reporte de clasificación:**
   - `docs/CI-V2/ROA-320-CLASSIFICATION-REPORT.md`

**Output:** Lista clasificada de documentos a mover/eliminar.

---

### Fase 2: Reclasificación

**Objetivo:** Mover documentos a categorías apropiadas.

**Acciones:**

1. **Crear estructura de directorios:**
   ```bash
   mkdir -p docs/legacy/reviews
   mkdir -p docs/legacy/plans
   mkdir -p docs/legacy/test-evidence
   ```

2. **Mover CodeRabbit reviews:**
   ```bash
   # Mover planes de reviews
   mv docs/plan/review-*.md docs/legacy/reviews/
   
   # Mover test evidence de reviews
   mv docs/test-evidence/review-* docs/legacy/test-evidence/
   ```

3. **Mover planes obsoletos:**
   ```bash
   # Filtrar por fecha/issue cerrada
   # Mover a docs/legacy/plans/
   ```

4. **Mover test evidence obsoletos:**
   ```bash
   # Filtrar por fecha/issue cerrada
   # Mover a docs/legacy/test-evidence/
   ```

**Output:** Documentos movidos a categorías apropiadas.

---

### Fase 3: Eliminación

**Objetivo:** Eliminar documentos obsoletos sin valor histórico.

**Acciones:**

1. **Identificar duplicados:**
   - Comparar contenido de documentos similares
   - Mantener versión más reciente o v2

2. **Eliminar documentos sin valor:**
   - Meta-documentación obsoleta
   - Documentos reemplazados por v2
   - Test evidence sin valor histórico

3. **Generar reporte de eliminación:**
   - `docs/CI-V2/ROA-320-DELETION-REPORT.md`

**Output:** Lista de documentos eliminados.

---

### Fase 4: Validación

**Objetivo:** Verificar que las validaciones v2 siguen funcionando.

**Acciones:**

1. **Ejecutar validadores v2:**
   ```bash
   node scripts/validate-v2-doc-paths.js --ci
   node scripts/validate-ssot-health.js --ci
   node scripts/check-system-map-drift.js --ci
   node scripts/validate-strong-concepts.js --ci
   ```

2. **Verificar que no se rompió nada:**
   - System-map-v2.yaml sigue válido
   - Nodes-v2 siguen referenciados
   - SSOT alignment = 100%

3. **Generar reporte de validación:**
   - `docs/CI-V2/ROA-320-VALIDATION-REPORT.md`

**Output:** Validación exitosa, health score mantenido.

---

### Fase 5: Reporte Final

**Objetivo:** Documentar cambios realizados.

**Acciones:**

1. **Generar reporte final:**
   - `docs/CI-V2/ROA-320-FINAL-REPORT.md`
   - Incluir:
     - Documentos reclasificados (cantidad, categorías)
     - Documentos eliminados (cantidad, razones)
     - Métricas antes/después
     - Validación exitosa

2. **Actualizar documentación:**
   - README de docs/legacy/ con estructura nueva
   - Actualizar .gitignore si es necesario

**Output:** Reporte final completo.

---

## 📊 Métricas Esperadas

### Antes

- **Total archivos .md:** 1,326
- **CodeRabbit reviews:** 147 planes + 83 directorios test-evidence
- **Planes obsoletos:** ~50-100 (estimado)
- **Test evidence obsoletos:** ~50-100 (estimado)

### Después (Objetivo)

- **Total archivos .md:** ~800-900 (reducción ~30-40%)
- **CodeRabbit reviews:** Movidos a `docs/legacy/reviews/`
- **Planes obsoletos:** Movidos a `docs/legacy/plans/` o eliminados
- **Test evidence obsoletos:** Movidos a `docs/legacy/test-evidence/` o eliminados
- **Documentos activos:** Solo documentación relevante

---

## ✅ Criterios de Éxito

1. ✅ **Validaciones v2 pasan:**
   - `validate-v2-doc-paths.js` → exit 0
   - `validate-ssot-health.js` → exit 0
   - `check-system-map-drift.js` → exit 0
   - `validate-strong-concepts.js` → exit 0

2. ✅ **Health Score mantenido:**
   - Health Score v2 ≥ 95 (preferiblemente 100)

3. ✅ **Reducción de documentos:**
   - Reducción ≥ 30% de documentos legacy

4. ✅ **Estructura clara:**
   - Documentos legacy organizados en categorías
   - Documentos activos fácilmente identificables

5. ✅ **Reporte completo:**
   - Reporte final con métricas y validación

---

## 🚨 Riesgos y Mitigaciones

### Riesgo 1: Eliminar documento importante

**Mitigación:**
- Revisar cada documento antes de eliminar
- Mover a `docs/legacy/` en lugar de eliminar si hay duda
- Mantener backup en git history

### Riesgo 2: Romper validaciones v2

**Mitigación:**
- Ejecutar validaciones después de cada fase
- No eliminar documentos referenciados en system-map-v2.yaml
- Verificar referencias antes de mover/eliminar

### Riesgo 3: Perder contexto histórico

**Mitigación:**
- Mover a `docs/legacy/` en lugar de eliminar
- Mantener estructura organizada
- Documentar razones de reclasificación

---

## 📝 Archivos a Modificar/Crear

### Crear

- `docs/plan/issue-ROA-320.md` (este archivo)
- `docs/legacy/reviews/` (directorio)
- `docs/legacy/plans/` (directorio)
- `docs/legacy/test-evidence/` (directorio)
- `docs/CI-V2/ROA-320-CLASSIFICATION-REPORT.md`
- `docs/CI-V2/ROA-320-DELETION-REPORT.md`
- `docs/CI-V2/ROA-320-VALIDATION-REPORT.md`
- `docs/CI-V2/ROA-320-FINAL-REPORT.md`
- `docs/legacy/README.md` (actualizar)

### Mover

- `docs/plan/review-*.md` → `docs/legacy/reviews/`
- `docs/test-evidence/review-*/` → `docs/legacy/test-evidence/`
- `docs/plan/issue-*.md` (obsoletos) → `docs/legacy/plans/`
- `docs/test-evidence/issue-*/` (obsoletos) → `docs/legacy/test-evidence/`

### Eliminar

- Documentos duplicados
- Meta-documentación obsoleta sin valor

---

## 🔗 Referencias

- **ROA-318:** `docs/CI-V2/LEGACY-CLEANUP-FINAL-REPORT.md`
- **ROA-323:** `docs/CI-V2/ROA-323-FINAL-MIGRATION-REPORT.md`
- **System-map v2:** `docs/system-map-v2.yaml`
- **SSOT v2:** `docs/SSOT-V2.md`

---

**Última actualización:** 2025-12-11  
**Estado:** 🟡 Planificación completa, listo para implementación

