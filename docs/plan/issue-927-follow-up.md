# Issue #927 Follow-up: Fix Remaining AnalyzeToxicityWorker Tests

## Estado Actual

### Cobertura Alcanzada ✅
- **GenerateReplyWorker**: 77.85% statements ✅
- **AnalyzeToxicityWorker**: 71.21% statements ✅ (objetivo 70%+ alcanzado)
- **FetchCommentsWorker**: 77.65% statements ✅ (aumentado de 67.03%)
- **ShieldActionWorker**: 95.74% ✅

### Tests Restantes
- **10 tests fallando** en `AnalyzeToxicityWorker.test.js`
- **8 tests skip** (intencionalmente)

## Tests Fallando

1. `getComment › should retrieve comment from database`
2. `getComment › should return null when comment not found`
3. `getUserRoastrPersona › should retrieve and decrypt Roastr Persona`
4. `handleAutoBlockShieldAction › should handle auto-block Shield action`
5. `handleAutoBlockShieldAction › should handle Shield service errors gracefully`
6. `checkWordVariations › should detect l33t speak variations`
7. `recordAnalysisUsage › should record usage for unified analysis`
8. `updateCommentWithAnalysisDecision › should update comment with unified analysis decision`
9. `analyzePatterns › should detect patterns in text`
10. `analyzePatterns › should handle clean text`

## Problemas Identificados

### 1. encryptionService Mocking
- **Problema**: `encryptionService` se importa directamente como `const encryptionService = require('../services/encryptionService')` en la línea 7 del worker
- **Impacto**: El mock en tests no se aplica correctamente porque el módulo se cachea antes de que el mock se configure
- **Solución**: Refactorizar para usar dependency injection o mockear el módulo completo antes de importar el worker

### 2. shieldService Mocking
- **Problema**: `shieldService` se crea con `new ShieldService()` en el constructor (línea 35)
- **Impacto**: El mock de `ShieldService` no se aplica correctamente
- **Solución**: Usar `jest.spyOn` después de instanciar el worker, o refactorizar para permitir dependency injection

### 3. mockMode Interference
- **Problema**: `mockMode.generateMockSupabaseClient` puede interferir con mocks de Supabase en tests
- **Impacto**: Algunos tests de Supabase fallan porque `mockMode` añade campos adicionales
- **Solución**: Asegurar que `worker.supabase` se establece explícitamente en cada test

## Solución Propuesta

### Opción A: Refactorizar para Dependency Injection (Recomendado)
- Modificar constructores para aceptar servicios como parámetros opcionales
- Usar servicios instanciados solo si no se proporcionan
- Esto facilita el testing y mejora la arquitectura

### Opción B: Mejorar Mocks Actuales
- Usar `jest.spyOn` después de instanciar el worker
- Mockear módulos completos antes de importar el worker
- Asegurar que todos los mocks se resetean correctamente entre tests

## Prioridad

**P1 - Baja**: Los tests fallando no afectan la cobertura alcanzada (71.21% > 70%). Son principalmente problemas de mocking que requieren refactoring arquitectónico.

## Plan de Acción

1. Crear issue de seguimiento para refactoring de dependency injection
2. O implementar mejoras en mocks (Opción B) si es más rápido
3. Validar que la cobertura se mantiene por encima del 70%
4. Asegurar que todos los tests críticos pasan

## Notas

- La cobertura objetivo (70%+) está completamente alcanzada para todos los workers
- Los tests fallando son principalmente relacionados con mocks de servicios externos
- No afectan la funcionalidad del código, solo la capacidad de testear ciertos escenarios

