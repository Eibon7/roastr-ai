# Plan: Issue #406 - Ingestor Integration Tests

## Objetivo
Implementar tests de integración completos para el sistema Ingestor que verifiquen deduplicación por comment_id, orden de procesamiento, backoff exponencial y acknowledgment de mensajes.

## Alcance
- Tests de deduplicación para evitar procesamiento duplicado de comentarios
- Verificación de orden de procesamiento FIFO
- Validación de reintentos con backoff exponencial
- Tests de acknowledgment correcto de mensajes
- Manejo diferenciado de errores transitorios vs permanentes

## Archivos a Crear/Modificar

### Tests de Integración
1. `tests/integration/ingestor-deduplication.test.js` - Tests de deduplicación
2. `tests/integration/ingestor-retry-backoff.test.js` - Tests de reintentos y backoff
3. `tests/integration/ingestor-acknowledgment.test.js` - Tests de acknowledgment
4. `tests/integration/ingestor-order-processing.test.js` - Tests de orden
5. `tests/integration/ingestor-error-handling.test.js` - Tests de manejo de errores

### Fixtures y Helpers
1. `tests/fixtures/ingestor-comments.json` - Fixtures de comentarios para testing
2. `tests/helpers/ingestor-test-utils.js` - Utilidades para tests de ingestor

## Componentes del Sistema a Probar

### FetchCommentsWorker
- Deduplicación por comment_id
- Manejo de reintentos
- Acknowledgment de trabajos procesados
- Orden de procesamiento

### QueueService
- Inserción ordenada de trabajos
- Prevención de duplicados
- Manejo de fallos y reintentos
- Acknowledgment de mensajes

### Base de Datos
- Constraints de unicidad en comment_id
- Timestamps de procesamiento
- Estados de trabajo (pending, processing, completed, failed)

## Escenarios de Prueba

### 1. Deduplicación
- Mismo comment_id enviado múltiples veces
- Verificar que solo se procesa una vez
- Validar que no se crean registros duplicados

### 2. Reintentos con Backoff
- Simular fallos transitorios
- Verificar exponential backoff (1s, 2s, 4s, 8s...)
- Límite máximo de reintentos
- Marcado como failed después del límite

### 3. Acknowledgment
- Trabajos completados exitosamente se marcan como ack
- Trabajos fallidos se marcan para retry
- Trabajos permanentemente fallidos se marcan como failed

### 4. Orden de Procesamiento
- Comentarios enviados en orden específico
- Verificar procesamiento FIFO
- Prioridad en caso de reintentos

### 5. Manejo de Errores
- Errores transitorios (red, timeouts) → retry
- Errores permanentes (malformed data) → failed
- Límites de reintento respetados

## Criterios de Éxito
- [ ] Todas las pruebas pasan sin fallos
- [ ] Cobertura del 100% en funciones críticas del ingestor
- [ ] Documentación de casos edge identificados
- [ ] Performance adecuada bajo carga (< 100ms por comentario)
- [ ] No memory leaks en pruebas de larga duración

## Timeline
- Setup inicial y fixtures: 30 min
- Tests de deduplicación: 45 min
- Tests de reintentos y backoff: 60 min
- Tests de acknowledgment: 30 min
- Tests de orden: 30 min
- Tests de manejo de errores: 45 min
- Documentación y validación: 30 min

#### Total estimado: 4.5 horas