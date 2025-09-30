# Plan de Implementación - Issue #406: [Integración] Ingestor

## Objetivo
Verificar deduplicación, orden, backoff y acknowledgment del sistema de ingest.

## Estado Actual
- Branch: `feat/issue-406`
- Commits recientes muestran que ya se han implementado tests de integración
- Necesitamos verificar que toda la funcionalidad esté correctamente implementada y testeada

## Criterios de Aceptación
- [ ] Reentradas del mismo comment_id no generan duplicados
- [ ] Manejo correcto de reintentos con backoff exponencial
- [ ] Acknowledgment correcto de mensajes procesados
- [ ] Orden de procesamiento respetado
- [ ] Manejo de errores transitorios vs permanentes

## Plan de Ejecución

### Fase 1: Análisis del Estado Actual
1. Revisar los tests de integración ya implementados en `tests/integration/ingestor-*.test.js`
2. Verificar la implementación del servicio de ingestión
3. Confirmar que el mock mode esté correctamente configurado

### Fase 2: Verificación de Funcionalidad
1. **Deduplicación por platform_comment_id**
   - Verificar que existe test para prevenir duplicados
   - Confirmar que usa índice único en DB
   - Validar comportamiento con diferentes organizaciones

2. **Backoff Exponencial**
   - Verificar implementación de reintentos
   - Confirmar delays: 1s → 2s → 4s → 8s
   - Validar manejo de errores permanentes vs transitorios

3. **Acknowledgment de Mensajes**
   - Confirmar que mensajes exitosos se marcan como completados
   - Verificar que mensajes fallidos se reintenten apropiadamente
   - Validar que no hay pérdida de mensajes

4. **Orden de Procesamiento**
   - Verificar que se respeta FIFO dentro de cada organización
   - Confirmar prioridades si existen

### Fase 3: Tests y Evidencias
1. Ejecutar suite completa de tests de integración
2. Generar reporte de cobertura
3. Documentar casos edge probados

### Fase 4: Documentación
1. Actualizar spec.md con detalles del ingestor
2. Documentar flujo de datos actualizado
3. Agregar sección sobre deduplicación y reintentos

## Agentes a Utilizar
- **Test Engineer**: Para revisar y completar tests faltantes
- No se requieren agentes de UI ya que es backend puro

## Archivos a Modificar
- `tests/integration/ingestor-*.test.js` - Tests de integración
- `src/services/ingestorService.js` - Servicio principal (si existe)
- `src/workers/FetchCommentsWorker.js` - Worker de ingestión
- `spec.md` - Documentación principal
- `docs/test-evidence/issue-406/` - Evidencias de tests

## Validación Final
- [ ] Todos los tests pasan
- [ ] Cobertura > 80% para código del ingestor
- [ ] spec.md actualizado
- [ ] Changelog preparado para PR