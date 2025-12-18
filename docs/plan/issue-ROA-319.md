# Plan de Migración: ROA-319 - Migración Completa de IDs Legacy del Código Fuente src/ al Esquema v2

**Issue:** ROA-319  
**Fecha:** 2025-12-05  
**Estado:** En progreso  
**Prioridad:** P1

---

## Estado Actual

### Resultado de Detección

**✅ Migración Completa Verificada**

El script `scripts/detect-legacy-ids.js` no encontró IDs legacy en el código fuente `src/`:

```
✅ No legacy IDs detected!
```

### Validaciones Ejecutadas

1. **Detección de IDs Legacy**: `node scripts/detect-legacy-ids.js src/`
   - ✅ No se encontraron IDs legacy en `src/`
   - ✅ No se encontraron IDs legacy en `docs/system-map-v2.yaml`
   - ✅ No se encontraron IDs legacy en `docs/nodes-v2/`

2. **Validación de Paths v2**: `node scripts/validate-v2-doc-paths.js --ci`
   - ✅ Todos los paths declarados existen (15/15)

3. **Validación SSOT Health**: `node scripts/validate-ssot-health.js --ci`
   - ✅ Sección 15 del SSOT es válida
   - ✅ Health Score: 100/100

4. **Validación System-Map Drift**: `node scripts/check-system-map-drift.js --ci`
   - ✅ No se detectaron nodos legacy v1
   - ✅ No se detectaron workers legacy
   - ⚠️ Warnings: 11 archivos orphaned (no crítico para esta issue)

5. **Validación Strong Concepts**: `node scripts/validate-strong-concepts.js --ci`
   - ✅ Todos los Strong Concepts están correctamente asignados

### Conclusión

**La migración de IDs legacy del código fuente `src/` al esquema v2 ya está completa.**

No se requieren cambios adicionales en el código fuente. Todos los IDs legacy han sido migrados previamente a sus equivalentes v2 según `system-map-v2.yaml`.

### IDs Legacy Prohibidos (según system-map-consistency-drift-guard.mdc)
- ❌ `roast` → ✅ `roasting-engine`
- ❌ `shield` → ✅ `shield-engine`
- ❌ `social-platforms` → ✅ `integraciones-redes-sociales`
- ❌ `frontend-dashboard` → ✅ `frontend-admin`
- ❌ `plan-features` → ✅ `billing-integration`
- ❌ `persona` → ✅ `analysis-engine` (persona es parte de analysis-engine en v2)

### Alcance
- Buscar IDs legacy como strings literales en comentarios, documentación y configuraciones
- Reemplazar por IDs v2 válidos según `system-map-v2.yaml`
- Validar que no se rompan referencias
- Actualizar documentación inline si es necesario

---

## Pasos de Implementación

### FASE 1: Detección de IDs Legacy
1. Buscar strings literales de IDs legacy en `src/`:
   - Comentarios de documentación
   - Referencias a nodos GDD
   - Configuraciones
   - Logs o mensajes de error (si aplica)

2. Filtrar falsos positivos:
   - Nombres de variables/funciones (ej: `roastGenerator`)
   - Strings de API/endpoints (ej: `"roast"` en validación de creditType)
   - Comentarios descriptivos que no son IDs

### FASE 2: Mapeo a IDs v2
Verificar mapeo correcto según `system-map-v2.yaml`:
- `roast` → `roasting-engine` ✅
- `shield` → `shield-engine` ✅
- `social-platforms` → `integraciones-redes-sociales` ✅
- `frontend-dashboard` → `frontend-admin` ✅
- `plan-features` → `billing-integration` ✅
- `persona` → `analysis-engine` ✅

### FASE 3: Reemplazo
1. Reemplazar IDs legacy por IDs v2 en:
   - Comentarios de documentación
   - Referencias a nodos GDD
   - Configuraciones (si aplica)

2. Mantener contexto:
   - No cambiar nombres de variables/funciones
   - No cambiar strings de API/endpoints
   - Solo actualizar referencias a IDs de nodos

### FASE 4: Validación
1. Ejecutar scripts de validación:
   ```bash
   node scripts/validate-v2-doc-paths.js --ci
   node scripts/validate-ssot-health.js --ci
   node scripts/check-system-map-drift.js --ci
   node scripts/validate-strong-concepts.js --ci
   ```

2. Verificar que no hay referencias rotas
3. Ejecutar tests para asegurar que no se rompió funcionalidad

---

## Archivos a Revisar

Basado en grep inicial, revisar especialmente:
- `src/services/perspective.js` - Referencias a nodos en comentarios
- `src/services/PersonaService.js` - Referencias a nodos en comentarios
- `src/services/sponsorService.js` - Referencias a nodos en comentarios
- `src/utils/encryption.js` - Referencias a nodos en comentarios
- `src/validators/zod/persona.schema.js` - Referencias a nodos en comentarios

---

## Agentes Relevantes

- **Back-end Dev**: Implementación de cambios en código fuente
- **Guardian**: Validación de cambios y compliance con reglas v2

---

## Validación Requerida

- ✅ Tests pasando
- ✅ Scripts de validación v2 pasando
- ✅ No referencias rotas
- ✅ Documentación actualizada

---

## Notas

- **IMPORTANTE**: No cambiar nombres de variables, funciones o strings de API
- Solo actualizar referencias a IDs de nodos GDD en comentarios/documentación
- Mantener compatibilidad con código existente

