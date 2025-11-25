# Plan: Issue #933 - Coverage Tests para Integration Manager y Base Classes

**Issue:** #933  
**Título:** [Coverage] Fase 5: Tests para Integration Manager y Base Classes (3-14% → 70%+)  
**Prioridad:** 🟡 MEDIA  
**Labels:** enhancement, medium priority, backend

## Estado Actual

### Cobertura Actual
- `src/integrations/integrationManager.js`: **2.8%** → Objetivo: **70%+**
- `src/integrations/base/BaseIntegration.js`: **11.3%** → Objetivo: **70%+**
- `src/integrations/base/MultiTenantIntegration.js`: **13.8%** → Objetivo: **70%+**

### Archivos sin Tests
- ❌ No existen tests para `integrationManager.js`
- ❌ No existen tests para `BaseIntegration.js`
- ❌ No existen tests para `MultiTenantIntegration.js`

### Contexto
- Parte de la estrategia de mejora de cobertura (`docs/coverage-improvement-priorities.md`)
- Base para todas las integraciones
- Impacto esperado: +2-3% cobertura global

## Acceptance Criteria

- [ ] `integrationManager.js` tiene ≥70% cobertura
- [ ] `BaseIntegration.js` tiene ≥70% cobertura
- [ ] `MultiTenantIntegration.js` tiene ≥70% cobertura
- [ ] Todos los tests pasan (0 failures)
- [ ] Tests cubren métodos principales
- [ ] Tests cubren casos de éxito y error
- [ ] Tests validan multi-tenant isolation
- [ ] Tests usan mocks apropiados

## Pasos de Implementación

### Paso 1: Tests para IntegrationManager.js

**Archivo:** `tests/unit/integrations/integrationManager.test.js`

**Métodos a cubrir:**
- `constructor()` - Inicialización con opciones
- `initializeIntegrations()` - Inicialización de todas las integraciones
- `initializeTwitter()`, `initializeYouTube()`, etc. - Inicialización por plataforma
- `startListening()` - Iniciar escucha de menciones
- `runBatch()` - Procesamiento por lotes
- `runIntegrationBatch()` - Procesamiento de integración específica
- `getGlobalMetrics()` - Obtener métricas globales
- `getStatus()` - Obtener estado de integraciones
- `shutdown()` - Cierre graceful
- `restartIntegration()` - Reinicio de integración específica
- `runAllIntegrationsOnce()` - Ejecución única en modo test

**Casos de prueba:**
- ✅ Inicialización exitosa con todas las plataformas
- ✅ Inicialización con testMode activado
- ✅ Manejo de errores en inicialización
- ✅ Procesamiento por lotes exitoso
- ✅ Manejo de errores en procesamiento
- ✅ Métricas correctas
- ✅ Shutdown graceful
- ✅ Reinicio de integración específica

**Mocks necesarios:**
- TwitterRoastBot
- YouTubeService, BlueskyService, etc.
- Logger
- Config de integraciones

### Paso 2: Tests para BaseIntegration.js

**Archivo:** `tests/unit/integrations/base/BaseIntegration.test.js`

**Métodos a cubrir:**
- `constructor()` - Inicialización con config
- `shouldRespondBasedOnFrequency()` - Verificación de frecuencia
- `analyzeCommentSeverity()` - Análisis de severidad
- `processComment()` - Procesamiento de comentario
- `executeAutoAction()` - Ejecución de acción automática
- `generateRoastWithTone()` - Generación de roast con tono
- `createTonePrompt()` - Creación de prompt por tono
- `getMetrics()` - Obtener métricas
- `validateConfig()` - Validación de configuración
- `initialize()` - Inicialización común
- `shutdown()` - Cierre graceful

**Casos de prueba:**
- ✅ Inicialización con config válida
- ✅ Validación de config requerida
- ✅ Frecuencia de respuesta (0.0 a 1.0)
- ✅ Análisis de severidad (critical, high, medium, low)
- ✅ Procesamiento de comentario exitoso
- ✅ Manejo de errores en procesamiento
- ✅ Generación de roast con diferentes tonos
- ✅ Acciones automáticas en modo Shield
- ✅ Métricas correctas

**Mocks necesarios:**
- AdvancedLogger
- ReincidenceDetector
- RoastGeneratorReal
- Logger

### Paso 3: Tests para MultiTenantIntegration.js

**Archivo:** `tests/unit/integrations/base/MultiTenantIntegration.test.js`

**Métodos a cubrir:**
- `constructor()` - Inicialización con platformName y opciones
- `initializeConnections()` - Inicialización de conexiones
- `initialize()` - Inicialización completa
- `processCommentsForOrganization()` - Procesamiento de comentarios por organización
- `storeComment()` - Almacenamiento de comentario
- `queueForAnalysis()` - Encolado para análisis
- `queueResponseGeneration()` - Encolado para generación de respuesta
- `queueResponsePost()` - Encolado para publicación
- `checkRateLimit()` - Verificación de rate limit
- `withRetry()` - Lógica de reintentos
- `normalizeComment()` - Normalización de comentario
- `extractMetrics()` - Extracción de métricas
- `getStatistics()` - Obtener estadísticas
- `healthCheck()` - Verificación de salud
- `shutdown()` - Cierre graceful

**Casos de prueba:**
- ✅ Inicialización con configuración válida
- ✅ Procesamiento de comentarios por organización
- ✅ Validación de multi-tenant isolation
- ✅ Almacenamiento de comentarios
- ✅ Encolado correcto de trabajos
- ✅ Rate limiting funcionando
- ✅ Reintentos con exponential backoff
- ✅ Normalización de comentarios de diferentes plataformas
- ✅ Estadísticas por organización
- ✅ Health check correcto
- ✅ Manejo de errores en todas las operaciones

**Mocks necesarios:**
- Supabase client (usar supabaseMockFactory)
- QueueService
- CostControlService
- Logger

## Agentes a Usar

- **TestEngineer** - Generación de tests siguiendo test-generation-skill
- **Guardian** - Validación de multi-tenant isolation y seguridad

## Archivos Afectados

### Nuevos Archivos
- `tests/unit/integrations/integrationManager.test.js`
- `tests/unit/integrations/base/BaseIntegration.test.js`
- `tests/unit/integrations/base/MultiTenantIntegration.test.js`

### Archivos Modificados
- Ninguno (solo creación de tests)

## Validación Requerida

### Tests
```bash
# Ejecutar tests específicos
npm test -- integrationManager.test.js
npm test -- BaseIntegration.test.js
npm test -- MultiTenantIntegration.test.js

# Verificar cobertura
npm test -- --coverage --collectCoverageFrom="src/integrations/integrationManager.js" --collectCoverageFrom="src/integrations/base/BaseIntegration.js" --collectCoverageFrom="src/integrations/base/MultiTenantIntegration.js"
```

### Cobertura Esperada
- `integrationManager.js`: ≥70%
- `BaseIntegration.js`: ≥70%
- `MultiTenantIntegration.js`: ≥70%
- 0 tests fallando

### GDD Validación
```bash
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # Debe >=87
```

## Referencias

- `docs/coverage-improvement-priorities.md` - Estrategia completa
- `docs/nodes/social-platforms.md` - Documentación de integraciones
- `docs/nodes/multi-tenant.md` - Multi-tenant architecture
- `docs/TESTING-GUIDE.md` - Guía de testing
- `docs/patterns/coderabbit-lessons.md` - Patrones de testing
- `tests/helpers/supabaseMockFactory.js` - Factory para mocks de Supabase

## Notas

- Usar `supabaseMockFactory` para mocks de Supabase (patrón establecido)
- Seguir patrones de `tests/integration/roast.test.js` como referencia
- Validar multi-tenant isolation en todos los tests
- Usar mocks apropiados, nunca datos reales
- Cubrir casos de éxito y error
- Validar que los tests pasan antes de commit


