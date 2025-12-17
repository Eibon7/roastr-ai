# Plan: ROA-326 - Deprecación/Regularización del Worker Legacy Style-Profile

**Issue**: ROA-326  
**Fecha**: 2025-12-02  
**Estado**: Completado ✅  
**Tipo**: Deprecación/Limpieza

---

## Objetivo

Confirmar y documentar que el worker `style_profile` (StyleProfileWorker) está deprecado y eliminado. El servicio StyleProfileService funciona actualmente de forma síncrona sin necesidad de worker.

---

## Estado Actual

### ✅ Servicio Activo
- **`src/services/styleProfileService.js`** - Funcional, procesamiento síncrono
- **`src/services/styleProfileGenerator.js`** - Funcional
- **`src/routes/style-profile.js`** - Rutas API funcionales
- **Feature flag**: `ENABLE_STYLE_PROFILE` activo

### ❌ Worker Eliminado
- **`src/workers/StyleProfileWorker.js`** - NO EXISTE (eliminado como legacy)
- **Referencias en WorkerManager.js** - NO existen
- **Jobs en cola** - No se procesan jobs de style_profile (worker no existe)

### 📝 Referencias Legacy
- Documentación histórica menciona el worker
- Tests históricos mencionan StyleProfileWorker
- `docs/CI-V2/LEGACY-TO-V2-MAPPING.md` confirma eliminación

---

## Análisis

### ¿Por qué fue eliminado?
Según `docs/CI-V2/LEGACY-TO-V2-MAPPING.md`:
> "worker style_profile eliminado (legacy sin soporte en SSOT/Spec/system-map)"

El worker no tiene soporte en el sistema v2 (SSOT/Spec/system-map) y fue eliminado durante la migración.

### ¿Funciona sin worker?
**Sí.** El servicio funciona de forma síncrona:
1. Las rutas API (`/api/style-profile/generate`) llaman directamente a `StyleProfileGenerator`
2. El procesamiento se hace en la misma request HTTP
3. No se necesita procesamiento asíncrono en background

---

## Tareas Completadas

### 1. Documentar Deprecación ✅
- [x] Confirmar que el worker no existe
- [x] Documentar que StyleProfileService funciona síncronamente
- [x] Verificar documentación legacy (ya documentado en LEGACY-TO-V2-MAPPING.md)

### 2. Limpiar Referencias Legacy ✅
- [x] Verificar que no hay código intentando usar StyleProfileWorker (ninguna referencia activa)
- [x] Revisar documentación histórica (archivos legacy/archive - OK, son históricos)
- [x] Confirmar que no hay tests obsoletos (tests de StyleProfileWorker no existen)

### 3. Actualizar Documentación GDD ✅
- [x] Verificar nodos GDD relevantes (no hay menciones incorrectas)
- [x] LEGACY-TO-V2-MAPPING.md ya documenta la eliminación correctamente

### 4. Validación ✅
- [x] Ejecutar validaciones v2 (todas pasaron)
  - [x] validate-v2-doc-paths.js: ✅ Todos los paths declarados existen
  - [x] validate-ssot-health.js: ✅ Health Score: 100/100
  - [x] check-system-map-drift.js: ✅ Sin drift, sin workers legacy detectados
  - [x] validate-strong-concepts.js: ✅ All Strong Concepts properly owned
- [x] Verificar que el servicio funciona correctamente (StyleProfileService activo)
- [x] Confirmar que no hay errores relacionados (sin referencias activas)

---

## Archivos Afectados

### Documentación
- `docs/CI-V2/LEGACY-TO-V2-MAPPING.md` - Ya documenta la eliminación ✅
- `docs/nodes-v2/06-motor-roasting.md` - Menciona `user_style_profiles` (tabla, no worker) ✅
- `docs/plan/issue-ROA-326.md` - Este documento ✅

### Código
- Ningún archivo de código intenta usar el worker ✅
- El servicio funciona correctamente sin worker ✅

---

## Decisiones

1. **No recrear el worker** - El servicio funciona bien síncronamente
2. **No migrar a v2** - El worker no es necesario según arquitectura actual
3. **Mantener servicio síncrono** - Procesamiento directo desde API es suficiente

---

## Resultado Esperado

- ✅ Documentación clara de que el worker está deprecado (LEGACY-TO-V2-MAPPING.md)
- ✅ Confirmación de que el servicio funciona sin worker (StyleProfileService síncrono)
- ✅ Sin referencias activas al worker en código (verificado)
- ✅ Validaciones v2 pasando (todas ejecutadas exitosamente)

## Conclusión

**Estado**: El worker `style_profile` (StyleProfileWorker) está **correctamente deprecado y eliminado**.

**Arquitectura actual**:
- El servicio `StyleProfileService` funciona **síncronamente** desde las rutas API
- No se requiere procesamiento asíncrono en background
- El servicio está activo y funcional sin el worker

**Acciones tomadas**:
1. ✅ Verificado que no existe código intentando usar el worker
2. ✅ Confirmado que la documentación legacy está correcta
3. ✅ Documentado en este plan el estado actual
4. ✅ Ejecutadas todas las validaciones v2 con éxito

**No se requieren acciones adicionales** - El sistema está funcionando correctamente sin el worker.

---

**Última actualización**: 2025-12-02
