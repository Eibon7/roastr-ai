# Plan: Fix Tier Validation Service Tests (Issue #642)

**Parent Epic:** #480  
**Priority:** P1 (Business logic validation)  
**Estimated Effort:** 3-4 hours  
**Flow Type:** Complementary Flow (business logic validation)

## Estado Actual

**Tests Failing:** 2 de 16 tests en `tierValidationService-coderabbit-round6.test.js`

### Problemas Identificados

1. **Test: "should fail closed on database connection errors"** (línea 191-206)
   - **Problema**: Test espera que `validateAction` rechace (throw) cuando hay error de conexión
   - **Realidad**: El servicio implementa fail-closed correctamente retornando `{ allowed: false, failedClosed: true }`
   - **Causa**: Test mal escrito - no refleja el comportamiento real del servicio

2. **Test: "should handle mixed success/failure in concurrent operations"** (línea 292-324)
   - **Problema**: Test espera que una promesa sea rechazada cuando hay error de DB
   - **Realidad**: El servicio maneja errores internamente y siempre resuelve (fail-closed)
   - **Causa**: Test espera comportamiento diferente al implementado

### Análisis del Servicio

El servicio `tierValidationService.js` implementa **fail-closed security** correctamente:
- En lugar de lanzar errores, retorna objetos con `allowed: false` y `failedClosed: true`
- Esto es más seguro porque permite manejo controlado de errores
- Los errores se capturan en el bloque `catch` y se retorna resultado seguro

## Pasos de Implementación

### Paso 1: Arreglar Test "should fail closed on database connection errors"
- **Archivo**: `tests/unit/services/tierValidationService-coderabbit-round6.test.js`
- **Cambio**: Cambiar expectativa de `.rejects.toThrow()` a verificar resultado con `allowed: false` y `failedClosed: true`
- **Líneas**: 191-206

### Paso 2: Arreglar Test "should handle mixed success/failure in concurrent operations"
- **Archivo**: `tests/unit/services/tierValidationService-coderabbit-round6.test.js`
- **Cambio**: Verificar que todas las promesas se resuelven pero con diferentes valores de `allowed`
- **Líneas**: 292-324

### Paso 3: Verificar Mocks de Supabase
- **Problema**: Los mocks pueden no estar configurados correctamente para el flujo completo
- **Solución**: Revisar y ajustar mocks según patrón Supabase Mock (#11 en coderabbit-lessons.md)

### Paso 4: Ejecutar Tests y Validar
- Ejecutar: `npm test -- tests/unit/services/tierValidationService-coderabbit-round6.test.js`
- Verificar: 16/16 tests pasando
- Validar: Comportamiento fail-closed correcto

## Agentes Relevantes

- **Test Engineer**: Corrección de tests según comportamiento real del servicio
- **Backend Developer**: Validar que el comportamiento fail-closed es correcto

## Archivos Afectados

- `tests/unit/services/tierValidationService-coderabbit-round6.test.js` (modificar tests)
- `src/services/tierValidationService.js` (revisar, posiblemente sin cambios)

## Validación Requerida

- ✅ Todos los tests pasando (16/16) - COMPLETADO
- ✅ Comportamiento fail-closed verificado - COMPLETADO
- ✅ Mocks de Supabase correctamente configurados - COMPLETADO
- ✅ No regresiones en otros tests - COMPLETADO

## Estado: COMPLETADO ✅

**Fecha de Completación:** 2025-01-XX

### Cambios Realizados

1. **Mock de planLimitsService añadido**: Se añadió mock para `planLimitsService` que faltaba en los tests
2. **Configuración de tierConfig mejorada**: Se añadieron configuraciones faltantes (SECURITY_CONFIG completo, WARNING_THRESHOLDS, CACHE_CONFIG, SUPPORTED_PLATFORMS, VALIDATION_HELPERS)
3. **Test "should fail closed on database connection errors" corregido**: 
   - Cambiado de esperar `.rejects.toThrow()` a verificar resultado con `allowed: false` y `failedClosed: true`
   - Acepta ambos códigos de razón (`validation_error_fail_closed` o `validation_database_error`)
4. **Test "should handle mixed success/failure in concurrent operations" corregido**:
   - Mock mejorado para manejar diferentes tablas de Supabase
   - Mock de `planLimitsService` configurado para fallar en el segundo call
   - Verificación ajustada para reflejar que todas las promesas se resuelven (fail-closed behavior)

### Resultados

- **Tests pasando**: 16/16 (100%)
- **Linting**: Sin errores
- **Comportamiento**: Fail-closed security correctamente implementado y verificado

## Referencias

- **Coderabbit Lessons**: Patrón #11 (Supabase Mock Pattern)
- **GDD Node**: `docs/nodes/cost-control.md`
- **Issue**: #642

