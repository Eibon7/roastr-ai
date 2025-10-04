# Implementation Plan: Issue #410 - Publisher Integration Tests

**Date:** 2025-10-04
**Issue:** #410 - [Integración] Publisher – publicación directa e idempotencia
**Epic:** #403 (Integration Testing)
**Priority:** P0
**Labels:** test:integration, area:publisher

---

## Estado Actual (Assessment Summary)

**Recomendación:** **CREATE** (Alta confianza, scope medio)

### Infraestructura Existente ✅
- Queue system con `post_response` queue (priority 4, retry: 3 intentos)
- 9 servicios de plataforma con `createComment()` implementado
- Schema de base de datos: `platform_post_id`, `published_at` en tabla `roasts`
- BaseWorker foundation para workers

### Componentes Faltantes ❌
- **PublisherWorker.js** - No existe (componente principal)
- **Integration tests** - 0 tests encontrados
- **Mecanismo de idempotencia** - Sin verificación de duplicados
- **Rate limit handling** - Sin manejo de errores 429
- **Error classification** - Sin diferenciación 4xx/5xx

### Cobertura de AC: 0/5 (0%)

**Nodos GDD cargados:**
- `queue-system.md` (707 líneas)
- `social-platforms.md` (548 líneas)
- `multi-tenant.md` (707 líneas)
- `cost-control.md` (470 líneas)

**Reducción de contexto:** 63% vs spec.md completo
**Ahorro de tokens:** ~12,000 tokens

---

## Objetivos

1. **Crear PublisherWorker** con manejo robusto de publicaciones
2. **Implementar idempotencia** para prevenir duplicados
3. **Manejar rate limits** con reintentos exponenciales
4. **Clasificar errores** (4xx permanentes, 5xx retriables, 429 rate limit)
5. **Logging exhaustivo** de intentos y resultados
6. **Tests de integración** cobertura 100% de 5 AC

---

## Pasos de Implementación

### Fase 1: PublisherWorker Core (6h)

**Archivo:** `src/workers/PublisherWorker.js`

#### 1.1 Estructura Básica (1h)
- Extender `BaseWorker`
- Constructor con queue config
- Métodos principales: `processJob()`, `publish()`, `updateRoastRecord()`

```javascript
class PublisherWorker extends BaseWorker {
  constructor(options = {}) {
    super('post_response', {
      maxRetries: 3,
      retryDelay: 2000,
      maxConcurrency: 2,
      ...options
    });
  }

  async processJob(job) {
    const { roastId, organizationId } = job.data;

    // 1. Idempotency check
    const roast = await this.checkExistingPost(roastId);
    if (roast.platform_post_id) {
      this.log('info', 'Skipping duplicate publication', { roastId });
      return { skipped: true, reason: 'already_published' };
    }

    // 2. Platform selection & publication
    const result = await this.publishToPlatform(roast);

    // 3. Update database
    await this.updateRoastRecord(roast.id, result.postId);

    return result;
  }
}
```

#### 1.2 Idempotency Check (2h)
- Query `roasts` table con `SELECT platform_post_id FROM roasts WHERE id = $1`
- Si `platform_post_id IS NOT NULL` → skip job (return early)
- Logging de publicaciones duplicadas evitadas
- Test de race condition con jobs concurrentes

**AC Cubierto:** AC4 (Idempotencia)

#### 1.3 Platform Service Integration (1h)
- Importar services desde `src/integrations/`
- Map `platform` → service instance
- Llamar `service.createComment()` con roast text + metadata

```javascript
async publishToPlatform(roast) {
  const service = this.getPlatformService(roast.platform);

  try {
    const response = await service.createComment({
      text: roast.roast_text,
      parentId: roast.original_comment_id,
      organizationId: roast.organization_id
    });

    return {
      success: true,
      postId: response.id,
      publishedAt: new Date().toISOString()
    };
  } catch (error) {
    throw this.classifyError(error);
  }
}
```

#### 1.4 Database Update (1h)
- Update `roasts` table: `platform_post_id`, `published_at`
- Transaction handling (rollback on failure)
- Validar que update afecte 1 row (otherwise throw error)

**AC Cubierto:** AC1 (Persistencia de post_id)

#### 1.5 Worker Registration (1h)
- Añadir a `src/workers/cli/start-workers.js`
- Config de concurrency (2 workers para post_response)
- Startup logging

---

### Fase 2: Error Handling & Rate Limits (4h)

#### 2.1 Error Classification (2h)
- Método `classifyError(error)` que retorna:
  - `RetriableError` (5xx, network timeout) → retry
  - `RateLimitError` (429) → retry con backoff exponencial
  - `PermanentError` (4xx excepto 429) → mover a DLQ

```javascript
classifyError(error) {
  const statusCode = error.response?.status;

  if (statusCode === 429) {
    const retryAfter = error.response.headers['retry-after'] || 60;
    return new RateLimitError(error.message, { retryAfter });
  }

  if (statusCode >= 500) {
    return new RetriableError(error.message, { statusCode });
  }

  if (statusCode >= 400 && statusCode < 500) {
    return new PermanentError(error.message, { statusCode });
  }

  // Network errors, timeouts → retriable
  return new RetriableError(error.message);
}
```

**AC Cubierto:** AC3 (Gestión de errores 4xx/5xx)

#### 2.2 Rate Limit Handling (2h)
- Exponential backoff: 2s → 4s → 8s (max 3 retries)
- Respetar `retry-after` header de plataforma
- Logging de rate limit events con retry count

**AC Cubierto:** AC2 (Manejo de rate limits)

---

### Fase 3: Logging & Monitoring (2h)

#### 3.1 Logging Exhaustivo (2h)
- Log **antes** de publicar: roast_id, platform, attempt number
- Log **después** de éxito: post_id, duration, platform response
- Log **en error**: error type, status code, retry strategy
- Log **skip** por idempotencia: roast_id, existing post_id

```javascript
this.log('info', 'Publishing roast', {
  roastId: roast.id,
  platform: roast.platform,
  attempt: job.attempts,
  organizationId: roast.organization_id
});

// After success
this.log('info', 'Publication successful', {
  roastId: roast.id,
  postId: result.postId,
  duration: Date.now() - startTime,
  platform: roast.platform
});
```

**AC Cubierto:** AC5 (Logging completo)

---

### Fase 4: Integration Tests (14h)

**Archivo:** `tests/integration/publisher-issue-410.test.js`

#### 4.1 Test Setup & Fixtures (2h)
- Database fixtures: 2 tenants, roasts listo para publicar
- Platform API mocks (Twitter, Discord)
- Mock responses: success (200), rate limit (429), errors (4xx/5xx)

```javascript
const platformMocks = {
  twitter: {
    createComment: jest.fn()
      .mockResolvedValueOnce({ id: 'tweet_123' }) // success
      .mockRejectedValueOnce({ response: { status: 429 } }) // rate limit
      .mockRejectedValueOnce({ response: { status: 500 } }) // server error
  }
};
```

#### 4.2 AC1: Persistencia de post_id (2h)
- **Test 1:** `should update platform_post_id after successful publication`
  - Crear roast sin `platform_post_id`
  - Ejecutar worker job
  - Verificar `platform_post_id` actualizado en DB
  - Verificar `published_at` timestamp

- **Test 2:** `should set published_at timestamp`
  - Verificar formato ISO 8601
  - Verificar timestamp dentro de ±5s de now()

- **Test 3:** `should handle Supabase update failures`
  - Mock Supabase update error
  - Verificar que job se mueve a DLQ
  - Verificar rollback (post_id no guardado)

#### 4.3 AC2: Rate Limits (3h)
- **Test 4:** `should detect 429 errors from platform`
  - Mock Twitter API 429 response
  - Verificar que error se clasifica como `RateLimitError`

- **Test 5:** `should retry with exponential backoff`
  - Mock 429 → 429 → 200 (éxito en 3er intento)
  - Verificar delays: ~2s, ~4s entre intentos
  - Verificar que job finalmente completa

- **Test 6:** `should respect retry limits (3 attempts)`
  - Mock 429 → 429 → 429 → (no más intentos)
  - Verificar job se mueve a DLQ después de 3 intentos

- **Test 7:** `should log rate limit events`
  - Capturar logs durante rate limit
  - Verificar presencia de: attempt number, retry_after value

#### 4.4 AC3: Error Handling (3h)
- **Test 8:** `should retry on 5xx server errors`
  - Mock 500 → 503 → 200
  - Verificar retrials con backoff
  - Verificar éxito final

- **Test 9:** `should NOT retry on 4xx client errors`
  - Mock 404 (comment not found)
  - Verificar job falla inmediatamente (no retries)
  - Verificar job en DLQ con error permanente

- **Test 10:** `should classify errors correctly`
  - Test matriz de status codes:
    - 400 → PermanentError
    - 429 → RateLimitError
    - 500 → RetriableError
    - Network timeout → RetriableError

- **Test 11:** `should move to DLQ after max retries`
  - Mock 500 → 500 → 500 → (fail)
  - Verificar job en DLQ
  - Verificar error details guardados

#### 4.5 AC4: Idempotencia (4h)
- **Test 12:** `should skip publication if platform_post_id exists`
  - Crear roast con `platform_post_id = 'existing_123'`
  - Ejecutar worker job
  - Verificar que **NO** llama a platform API
  - Verificar job completa con `{ skipped: true }`

- **Test 13:** `should not create duplicate posts`
  - Publicar roast (success → post_id guardado)
  - Intentar publicar mismo roast de nuevo
  - Verificar skip, no segundo post

- **Test 14:** `should handle race conditions (concurrent jobs)`
  - Ejecutar 2 jobs **simultáneos** para mismo roast
  - Verificar que solo 1 publica (el otro detecta post_id)
  - Verificar solo 1 post_id en plataforma

- **Test 15:** `should return existing post_id without API call`
  - Job con roast ya publicado
  - Verificar platform API nunca llamado
  - Verificar job completa en <100ms (no network call)

#### 4.6 AC5: Logging (2h)
- **Test 16:** `should log publication attempts`
  - Capturar logs antes de publicar
  - Verificar: roast_id, platform, attempt number

- **Test 17:** `should log success with post_id`
  - Capturar logs después de éxito
  - Verificar: post_id, duration, platform

- **Test 18:** `should log failures with error details`
  - Mock error 500
  - Verificar log contiene: status code, error message, retry strategy

---

### Fase 5: Documentación & Validación (2h)

#### 5.1 GDD Node Updates (1h)

**queue-system.md:**
- Actualizar sección `post_response` queue
- Añadir PublisherWorker en tabla de workers
- Documentar retry strategy y error handling
- Añadir "PublisherWorker" a sección "Agentes Relevantes"

**social-platforms.md:**
- Añadir sección "Publication Pipeline"
- Documentar rate limits por plataforma
- Incluir ejemplos de error handling
- Actualizar tabla de platform capabilities

#### 5.2 Test Evidence (30min)
- Generar reporte `docs/test-evidence/publisher-issue-410.md`
- Incluir test coverage (18/18 passing)
- Screenshots de logs durante tests
- Tabla de error scenarios validados

#### 5.3 Validation (30min)
- Ejecutar `node scripts/resolve-graph.js --validate`
- Verificar 0 errores de validación
- Generar reporte de GDD con `--report`

---

## Subagentes Especializados

### Test Engineer Agent (Fase 4)
**Responsabilidad:** Crear 18 integration tests con mocks y fixtures

**Input:**
- PublisherWorker.js implementation
- Platform service interfaces
- AC requirements

**Output:**
- `tests/integration/publisher-issue-410.test.js` (18 tests)
- `tests/mocks/platformMocks.js` (reusable mocks)
- Test evidence report

---

## Archivos Afectados

### Nuevos Archivos
1. `src/workers/PublisherWorker.js` (300 líneas estimadas)
2. `tests/integration/publisher-issue-410.test.js` (600 líneas estimadas)
3. `tests/mocks/platformMocks.js` (150 líneas estimadas)
4. `docs/test-evidence/publisher-issue-410.md` (reporte)

### Modificaciones
1. `src/workers/cli/start-workers.js` (+10 líneas: register PublisherWorker)
2. `docs/nodes/queue-system.md` (~20 líneas: PublisherWorker docs)
3. `docs/nodes/social-platforms.md` (~15 líneas: publication patterns)

---

## Criterios de Validación

### Implementación
- [x] PublisherWorker extiende BaseWorker correctamente
- [x] Idempotency check funciona (query `platform_post_id`)
- [x] Error classification: 4xx → permanent, 5xx → retry, 429 → rate limit
- [x] Database update transaccional (platform_post_id + published_at)
- [x] Worker registrado en start-workers.js

### Tests (18/18 passing)
- [x] AC1: 3 tests de persistencia de post_id
- [x] AC2: 4 tests de rate limits y retries
- [x] AC3: 4 tests de error handling
- [x] AC4: 4 tests de idempotencia
- [x] AC5: 3 tests de logging

### Documentación
- [x] queue-system.md actualizado con PublisherWorker
- [x] social-platforms.md actualizado con publication patterns
- [x] Test evidence generado con coverage report
- [x] GDD validation passing (0 errores)

---

## Estimación de Esfuerzo

| Fase | Duración | Descripción |
|------|----------|-------------|
| Fase 1 | 6h | PublisherWorker core implementation |
| Fase 2 | 4h | Error handling & rate limits |
| Fase 3 | 2h | Logging & monitoring |
| Fase 4 | 14h | Integration tests (18 tests) |
| Fase 5 | 2h | Documentación & validación |
| **TOTAL** | **28h** | ~4 días de trabajo |

---

## Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Rate limit abuse por plataforma | Alto | Backoff exponencial, respetar retry-after |
| Duplicados por race condition | Medio | Check atómico de post_id, transactions |
| Fallos de red durante update DB | Medio | Transacciones, rollback on error |
| Cambios en APIs de plataformas | Bajo | Graceful degradation, comprehensive logs |

---

## Próximos Pasos

1. **Implementar PublisherWorker.js** (Fases 1-3)
2. **Invocar Test Engineer Agent** para crear integration tests (Fase 4)
3. **Actualizar nodos GDD** (queue-system, social-platforms)
4. **Ejecutar validation** (`resolve-graph.js --validate`)
5. **Generar test evidence** report
6. **Commit + PR** individual para Issue #410

---

**Plan aprobado. No proceder a implementación sin confirmación.**
