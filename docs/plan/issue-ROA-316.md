# ROA-316: GDD v2 Follow-up Polish After ROA-258 Merge - CodeRabbit Nits

**Issue:** ROA-316  
**Fecha:** 2025-12-07  
**Estado:** ✅ Completado  
**Tipo:** Documentation polish, CodeRabbit nits

---

## 🎯 Objetivo

Aplicar mejoras de calidad y corregir nits de CodeRabbit identificados en `system-map-v2.yaml` después del merge de ROA-258.

---

## 📋 Nits Identificados

### 1. Inconsistencias en Formato de Fechas

**Problema:**
- Algunos `last_updated` usan formato ISO con comillas: `'2025-12-05T18:31:11.772Z'`
- Otros usan formato ISO sin comillas: `2025-12-05T00:00:00.000Z`
- Inconsistencia en formato de timestamps

**Archivos afectados:**
- `docs/system-map-v2.yaml` (múltiples nodos)

**Fix:**
- Estandarizar todos los `last_updated` a formato ISO con comillas: `'YYYY-MM-DDTHH:mm:ss.sssZ'`

### 2. TODOs en Descriptions

**Problema:**
- Varios nodos tienen `description: 'TODO: ...'` en lugar de descripciones reales
- Nodos afectados:
  - `auth`: `'TODO: Authentication and authorization system'`
  - `settings-loader-and-feature-flags`: `'TODO: Settings loader and feature flags management system'`
  - `gdpr-and-legal`: `'TODO: GDPR compliance and legal requirements system'`
  - `testing-v2`: `'TODO: Comprehensive testing system (unit, integration, E2E)'`

**Fix:**
- Reemplazar TODOs con descripciones reales basadas en la documentación existente o SSOT

### 3. Inconsistencias en Estructura de Nodos

**Problema:**
- Algunos nodos tienen campo `notes:` mientras otros no
- Inconsistencia en campos opcionales

**Fix:**
- Estandarizar estructura: si hay notas, usar formato consistente
- Si no hay notas relevantes, no incluir el campo

### 4. Nodos con Coverage 0

**Problema:**
- Varios nodos tienen `coverage: 0`:
  - `auth`: 0
  - `settings-loader-and-feature-flags`: 0
  - `gdpr-and-legal`: 0
  - `testing-v2`: 0

**Fix:**
- Verificar si estos nodos realmente tienen 0% coverage o si es un problema de mapeo
- Si es correcto, mantener 0 pero añadir nota explicativa
- Si es incorrecto, corregir el valor

### 5. Formato Inconsistente en Metadata

**Problema:**
- `pr: null` debería ser `pr: null` o eliminarse si no aplica
- Algunos campos opcionales están presentes mientras otros no

**Fix:**
- Estandarizar campos opcionales: usar `null` explícitamente o omitir si no aplica

### 6. Inconsistencias en Workers Notes

**Problema:**
- Algunos workers tienen `note:` con información de mapeo
- Formato inconsistente en las notas

**Fix:**
- Estandarizar formato de notas en workers
- Asegurar que todas las notas sean claras y consistentes

---

## 🔧 Plan de Implementación

### Fase 1: Corrección de Formato de Fechas

1. Identificar todos los `last_updated` con formato inconsistente
2. Estandarizar a formato ISO con comillas: `'YYYY-MM-DDTHH:mm:ss.sssZ'`
3. Validar que todas las fechas sean válidas

### Fase 2: Reemplazo de TODOs

1. Para cada nodo con TODO en description:
   - Buscar documentación existente en `docs/nodes-v2/`
   - Buscar referencias en SSOT-V2.md
   - Crear descripción real basada en información disponible
   - Si no hay información, usar descripción genérica pero sin TODO

### Fase 3: Estandarización de Estructura

1. Revisar todos los nodos para consistencia en campos opcionales
2. Estandarizar uso de `notes:` (solo si hay notas relevantes)
3. Asegurar que todos los nodos tengan la misma estructura base

### Fase 4: Corrección de Coverage

1. Verificar coverage real de nodos con 0%
2. Si es correcto, añadir nota explicativa
3. Si es incorrecto, corregir valor

### Fase 5: Validación

1. Ejecutar validadores:
   - `node scripts/validate-v2-doc-paths.js --ci`
   - `node scripts/validate-ssot-health.js --ci`
   - `node scripts/check-system-map-drift.js --ci`
   - `node scripts/validate-strong-concepts.js --ci`
2. Verificar que YAML es válido
3. Verificar que no se rompió ninguna referencia

---

## 📝 Archivos a Modificar

- `docs/system-map-v2.yaml` (principal)

---

## ✅ Criterios de Aceptación

- [x] Todas las fechas en formato ISO consistente con comillas
- [x] No hay TODOs en descriptions de nodos
- [x] Estructura de nodos consistente
- [x] Coverage verificado y corregido si es necesario
- [x] Metadata consistente
- [x] Todas las validaciones pasan
- [x] YAML válido y bien formado
- [x] No se rompió ninguna referencia

---

## 🔍 Validación Post-Implementación

```bash
# Validar YAML
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('docs/system-map-v2.yaml', 'utf8')); console.log('✅ YAML válido');"

# Validar paths
node scripts/validate-v2-doc-paths.js --ci

# Validar SSOT
node scripts/validate-ssot-health.js --ci

# Validar drift
node scripts/check-system-map-drift.js --ci

# Validar strong concepts
node scripts/validate-strong-concepts.js --ci
```

---

## 📚 Referencias

- ROA-258: System Map v2 creation
- `docs/system-map-v2.yaml`: Archivo principal a corregir
- `docs/SSOT-V2.md`: Referencia para descripciones
- `docs/nodes-v2/`: Documentación de nodos para descripciones

