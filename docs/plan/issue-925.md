# Plan de Implementación - Issue #925: Tests para Routes Básicas (0% → 60%+)

## Estado Actual

**Cobertura Actual:** 60%+ en 4 archivos  
**Estado:** ✅ COMPLETADO  
**Prioridad:** 🟡 MEDIA  
**Impacto Estimado:** +1-2% cobertura global

### Archivos Cubiertos

1. **`src/routes/comments.js`**
   - ✅ POST /ingest - Ingestion de comentarios
   - ✅ POST /:id/generate - Generación de respuesta
   - ✅ POST /:id/generate-advanced - Generación avanzada

2. **`src/routes/guardian.js`**
   - ✅ GET /cases - Listar casos
   - ✅ POST /cases/:caseId/approve - Aprobar caso
   - ✅ POST /cases/:caseId/deny - Denegar caso

3. **`src/routes/integrations.js`**
   - ✅ GET / - Obtener integraciones del usuario
   - ✅ GET /platforms - Obtener plataformas disponibles
   - ✅ POST /:platform - Crear/actualizar integración
   - ✅ PUT /:platform - Actualizar integración
   - ✅ DELETE /:platform - Eliminar integración
   - ✅ GET /metrics - Obtener métricas
   - ✅ POST /:platform/enable - Habilitar integración
   - ✅ POST /:platform/disable - Deshabilitar integración

4. **`src/routes/modelAvailability.js`**
   - ✅ GET /status - Estado de disponibilidad
   - ✅ POST /check - Forzar verificación
   - ✅ GET /model/:modelId - Info de modelo específico
   - ✅ GET /stats - Estadísticas de uso
   - ✅ GET /plans - Asignaciones por plan
   - ✅ POST /worker/start - Iniciar worker
   - ✅ POST /worker/stop - Detener worker

## Dependencias Identificadas

### comments.js
- `authenticateToken` (middleware/auth)
- `logger` (utils/logger)
- `sanitizeForLogging` (utils/parameterSanitizer)
- Variables de entorno: `ENABLE_MOCK_MODE`, `NODE_ENV`

### guardian.js
- `guardianController` (controllers/guardianController)
- `isAdminMiddleware` (middleware/isAdmin)

### integrations.js
- `userIntegrationsService` (services/userIntegrationsService)
- `authenticateToken` (middleware/auth)
- `logger` (utils/logger)

### modelAvailability.js
- `getModelAvailabilityService` (services/modelAvailabilityService)
- `getModelAvailabilityWorker` (workers/ModelAvailabilityWorker)
- `authenticateToken` (middleware/auth)
- `requireAdmin` (middleware interno)

## Pasos de Implementación

### FASE 1: Setup y Mocks Comunes

1. ✅ Crear archivo de test para cada route:
   - `tests/unit/routes/comments.test.js`
   - `tests/unit/routes/guardian.test.js`
   - `tests/unit/routes/integrations.test.js`
   - `tests/unit/routes/modelAvailability.test.js`

2. ✅ Configurar mocks comunes:
   - `authenticateToken` middleware
   - `isAdminMiddleware` para guardian
   - `logger` utility
   - Variables de entorno (`ENABLE_MOCK_MODE`, `NODE_ENV`)

### FASE 2: Tests para comments.js (≥60% cobertura)

**Tests implementados (15/15):**
- POST /ingest:
  - ✅ Debe validar campos requeridos (platform, external_comment_id, comment_text)
  - ✅ Debe retornar 400 si faltan campos
  - ✅ Debe retornar 201 en mock mode con respuesta mock
  - ✅ Debe retornar 501 en production mode
  - ✅ Debe manejar errores internos (500)
  
- POST /:id/generate:
  - ✅ Debe generar respuesta mock en mock mode
  - ✅ Debe retornar 501 en production mode
  - ✅ Debe respetar generate_count
  - ✅ Debe manejar errores internos (500)
  
- POST /:id/generate-advanced:
  - ✅ Debe generar respuesta avanzada en mock mode
  - ✅ Debe retornar 501 en production mode
  - ✅ Debe respetar parámetros avanzados (style, creativity, multiple_variants)
  - ✅ Debe manejar errores internos (500)

### FASE 3: Tests para guardian.js (≥60% cobertura)

**Tests implementados (14/14):**
- GET /cases:
  - ✅ Debe listar casos exitosamente
  - ✅ Debe filtrar por severity válido
  - ✅ Debe filtrar por action válido
  - ✅ Debe validar severity inválido (400)
  - ✅ Debe validar action inválido (400)
  - ✅ Debe validar limit (1-1000)
  - ✅ Debe requerir admin authentication (403)
  
- POST /cases/:caseId/approve:
  - ✅ Debe aprobar caso exitosamente
  - ✅ Debe validar approver requerido (400)
  - ✅ Debe retornar 404 si caso no existe
  - ✅ Debe requerir admin authentication (403) // Probado en bloque general
  
- POST /cases/:caseId/deny:
  - ✅ Debe denegar caso exitosamente
  - ✅ Debe validar denier requerido (400)
  - ✅ Debe validar reason requerido (400)
  - ✅ Debe retornar 404 si caso no existe
  - ✅ Debe requerir admin authentication (403) // Probado en bloque general

### FASE 4: Tests para integrations.js (≥60% cobertura)

**Tests implementados (17/17):**
- GET /:
  - ✅ Debe obtener integraciones exitosamente
  - ✅ Debe retornar 400 si error en servicio
  
- GET /platforms:
  - ✅ Debe obtener plataformas disponibles
  - ✅ Debe retornar 400 si error en servicio
  
- POST /:platform:
  - ✅ Debe crear/actualizar integración exitosamente
  - ✅ Debe retornar 400 si error en servicio
  
- PUT /:platform:
  - ✅ Debe actualizar integración exitosamente
  - ✅ Debe retornar 400 si error en servicio
  
- DELETE /:platform:
  - ✅ Debe eliminar integración exitosamente
  - ✅ Debe retornar 400 si error en servicio
  
- GET /metrics:
  - ✅ Debe obtener métricas exitosamente
  - ✅ Debe retornar 400 si error en servicio
  
- POST /:platform/enable:
  - ✅ Debe habilitar integración exitosamente
  - ✅ Debe retornar 400 si error en servicio
  
- POST /:platform/disable:
  - ✅ Debe deshabilitar integración exitosamente
  - ✅ Debe retornar 400 si error en servicio

### FASE 5: Tests para modelAvailability.js (≥60% cobertura)

**Tests implementados (23/23):**
- GET /status:
  - ✅ Debe obtener estado exitosamente
  - ✅ Debe retornar 500 si error en servicio
  - ✅ Debe requerir admin authentication (403)
  
- POST /check:
  - ✅ Debe ejecutar verificación manual exitosamente
  - ✅ Debe retornar 500 si error en servicio
  - ✅ Debe requerir admin authentication (403)
  
- GET /model/:modelId:
  - ✅ Debe obtener info de modelo específico
  - ✅ Debe retornar 500 si error en servicio
  - ✅ Debe requerir admin authentication (403)
  
- GET /stats:
  - ✅ Debe obtener estadísticas exitosamente
  - ✅ Debe retornar 500 si error en servicio
  - ✅ Debe requerir admin authentication (403)
  
- GET /plans:
  - ✅ Debe obtener asignaciones por plan
  - ✅ Debe retornar 500 si error en servicio
  - ✅ Debe requerir admin authentication (403)
  
- POST /worker/start:
  - ✅ Debe iniciar worker exitosamente
  - ✅ Debe retornar 500 si error en servicio
  - ✅ Debe requerir admin authentication (403)
  
- POST /worker/stop:
  - ✅ Debe detener worker exitosamente
  - ✅ Debe retornar 500 si error en servicio
  - ✅ Debe requerir admin authentication (403)

## Agentes a Usar

- **TestEngineer** - Implementación principal de tests
- **Backend Developer** - Revisión de mocks y servicios
- **Guardian** - Validación de seguridad y edge cases

## Archivos Afectados

- `tests/unit/routes/comments.test.js` (NUEVO)
- `tests/unit/routes/guardian.test.js` (NUEVO)
- `tests/unit/routes/integrations.test.js` (NUEVO)
- `tests/unit/routes/modelAvailability.test.js` (NUEVO)
- `docs/test-evidence/issue-925/` (evidencias de tests)

## Validación Requerida

1. **Tests pasando:** `npm test -- routes/comments routes/guardian routes/integrations routes/modelAvailability` (100% passing)
2. **Coverage ≥60%:** `npm run test:coverage` (verificar cada archivo)
3. **Tests rápidos:** Cada test <1s, suite completa <60s
4. **GDD actualizado:** Nodos relevantes con coverage actualizado
5. **Receipts generados:** `docs/agents/receipts/925-TestEngineer.md`

## Criterios de Éxito

- ✅ Coverage ≥60% para cada archivo (comments, guardian, integrations, modelAvailability)
- ✅ Todos los tests pasan al 100%
- ✅ Tests ejecutan en <60 segundos total
- ✅ Tests validan todos los endpoints principales
- ✅ Tests validan casos de error y edge cases
- ✅ Tests usan mocks apropiados (sin llamadas reales)

## Referencias

- Plan de cobertura: `docs/coverage-improvement-priorities.md`
- Guía de testing: `docs/TESTING-GUIDE.md`
- Patrones de tests: `docs/patterns/coderabbit-lessons.md`
- Tests existentes: `tests/unit/routes/user.test.js`, `tests/unit/routes/roast.test.js`
