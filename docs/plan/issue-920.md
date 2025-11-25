# Plan de Implementación - Issue #920: Integrar Portkey AI Gateway como capa unificada LLM

**Issue:** #920  
**Título:** Integrar Portkey AI Gateway como capa unificada LLM  
**Estado:** En Planificación  
**Fecha:** 2025-01-27

## Contexto

Actualmente solo usamos OpenAI directo para el motor de roasts y embeddings. Queremos soportar múltiples modelos (Claude, Grok, Mistral, OpenAI) y modos (normal, empático, NSFW, barato, rápido). Portkey ofrece gateway tipo OpenAI compatible con routing, fallbacks y telemetría sin reescribir nuestros servicios.

## Objetivos

1. Unificar todas las llamadas LLM/embeddings detrás de un wrapper `LLMClient` que usa Portkey.
2. Definir modos de AI basados en tonos actuales:
   - `flanders` → GPT-5.1 (tono amable, intensidad 2/5)
   - `balanceado` → GPT-5.1 (tono equilibrado, intensidad 3/5)
   - `canalla` → GPT-5.1 (tono directo, intensidad 4/5)
   - `nsfw` → Grok (preparado para cuando tengamos API key, fallback a OpenAI)
3. Propagar metadata (`mode`, `provider`, `fallbackUsed`) hasta los jobs y Shield para trazabilidad y cost-control.
4. Mantener compatibilidad con el sistema de tonos/personas y minimizar cambios en el backend/frontend.

## Alcance Técnico

### Componentes a Crear

- **`src/lib/llmClient/`** - Nueva carpeta con:
  - `factory.js` - Singleton por modo/plan y cache de instancias
  - `routes.js` - Tabla declarativa modo → provider/model/parámetros
    - Modos actuales: `flanders`, `balanceado`, `canalla` (todos GPT-5.1)
    - Modo futuro: `nsfw` (Grok, con fallback a OpenAI si no configurado)
  - `fallbacks.js` - Cadenas tipo `['grok', 'openai']` para NSFW
  - `transformers.js` - Normalizar respuestas Portkey → formato OpenAI actual
  - `index.js` - Export principal

### Servicios a Actualizar

1. **`roastGeneratorEnhanced.js`** - Reemplazar `new OpenAI()` con `LLMClient.getInstance()`
2. **`roastEngine.js`** - Inyectar `LLMClient` en lugar de OpenAI directo
3. **`PersonaService.js`** - Usar `LLMClient` para embeddings
4. **`embeddingsService.js`** - Reemplazar OpenAI con `LLMClient`
5. **`rqcService.js`** - Usar `LLMClient` para reviews
6. **`GenerateReplyWorker.js`** - Usar `LLMClient` y propagar `mode` en payload
7. **`AnalyzeToxicityWorker.js`** - Usar `LLMClient` si aplica
8. **`sponsorService.js`** - Usar `LLMClient` para tag extraction
9. **`gatekeeperService.js`** - Usar `LLMClient` si aplica
10. **`modelAvailabilityService.js`** - Usar `LLMClient` para detección

### Variables de Entorno

```bash
# Portkey Configuration
PORTKEY_API_KEY=your_portkey_api_key
PORTKEY_PROJECT_ID=your_project_id
PORTKEY_BASE_URL=https://api.portkey.ai/v1  # Default
PORTKEY_DEFAULT_ROUTE=default
PORTKEY_TIMEOUT_MS=30000
PORTKEY_MAX_RETRIES=3
```

### Endpoints Nuevos

- `GET /api/ai-modes` - Listar modos disponibles con metadata

### Base de Datos

- Actualizar `roasts_metadata` para incluir:
  - `mode` VARCHAR(50) - Modo usado (flanders, balanceado, canalla, nsfw)
  - `provider` VARCHAR(50) - Provider usado (openai, grok)
  - `fallback_used` BOOLEAN - Si se usó fallback (ej: NSFW sin Grok → OpenAI)
  - `portkey_metadata` JSONB - Metadata adicional de Portkey

## Fases Propuestas

### Fase 1 (MVP Portkey): Wrapper + Reemplazo Transparente

**Objetivo:** Crear wrapper `LLMClient` y reemplazar OpenAI directo sin cambios funcionales.

**Tareas:**

1. ✅ Instalar SDK Portkey: `npm install portkey-ai`
2. ✅ Crear `src/lib/llmClient/factory.js`:
   - Singleton pattern por modo/plan
   - Cache de instancias
   - Fallback a OpenAI directo si Portkey no configurado
3. ✅ Crear `src/lib/llmClient/routes.js`:
   - Tabla de modos con rutas Portkey
   - Modo `default` → OpenAI GPT-4o
4. ✅ Crear `src/lib/llmClient/transformers.js`:
   - Normalizar respuestas Portkey → formato OpenAI
   - Manejo de errores y telemetría
5. ✅ Actualizar `roastGeneratorEnhanced.js`:
   - Reemplazar `new OpenAI()` con `LLMClient.getInstance('default')`
   - Mantener misma interfaz
6. ✅ Tests unitarios para `LLMClient`
7. ✅ Validar que roasts funcionan igual que antes

**Criterios de Aceptación:**

- ✅ Todas las llamadas pasan por `LLMClient`
- ✅ OpenAI directo solo como fallback controlado
- ✅ Tests pasando sin regresiones
- ✅ Compatibilidad 100% con código existente

### Fase 2 (Routing Multi-Model): Tabla de Modos + Endpoint

**Objetivo:** Definir modos configurables y endpoint para listarlos.

**Tareas:**

1. ✅ Expandir `routes.js` con modos reales:
   - `flanders` → OpenAI GPT-5.1 (tono amable, temperatura 0.7)
   - `balanceado` → OpenAI GPT-5.1 (tono equilibrado, temperatura 0.8)
   - `canalla` → OpenAI GPT-5.1 (tono directo, temperatura 0.9)
   - `nsfw` → Grok (preparado, fallback a OpenAI GPT-5.1 si no configurado)
2. ✅ Crear `src/lib/llmClient/fallbacks.js`:
   - Cadenas de fallback por modo
   - NSFW: `['grok', 'openai']` (fallback si Grok no configurado)
3. ⏳ Crear endpoint `GET /api/ai-modes`:
   - Listar modos disponibles (flanders, balanceado, canalla, nsfw)
   - Metadata (provider, model, cost estimate)
4. ⏳ Actualizar `PersonaService` para guardar preferencia de modo
5. ⏳ Tests de routing y fallbacks

**Criterios de Aceptación:**

- ✅ 4 modos definidos con rutas (flanders, balanceado, canalla, nsfw)
- ⏳ Endpoint `/api/ai-modes` funcional
- ✅ Fallbacks funcionan correctamente (NSFW → OpenAI si Grok no configurado)
- ⏳ Tests pasando

### Fase 3 (Fallbacks + Observabilidad): Métricas y Logging

**Objetivo:** Añadir telemetría y métricas por provider/mode.

**Tareas:**

1. ✅ Propagar `mode` en payloads de jobs
2. ✅ Guardar `provider`, `fallbackUsed` en `roasts_metadata`
3. ✅ Logging estructurado:
   - Provider usado
   - Fallback usado (si aplica)
   - Latencia por provider
   - Costo estimado
4. ✅ Integrar con cost-control:
   - Tracking de costos por provider
   - Reporte en dashboard
5. ✅ Alertas:
   - Fallback rate > 20%
   - Provider timeout > 5%
6. ✅ Tests de telemetría

**Criterios de Aceptación:**

- ✅ Metadata propagada hasta `roasts_metadata`
- ✅ Logging estructurado funcionando
- ✅ Cost-control integrado
- ✅ Alertas configuradas

### Fase 4 (AI Modes Avanzados): Reglas de Negocio + UI

**Objetivo:** Implementar reglas de negocio y UI final.

**Tareas:**

1. ✅ Reglas de negocio:
   - NSFW → Grok automático
   - Empático → Claude automático
   - Cheap → GPT-4o-mini automático
   - Fast → GPT-3.5-turbo automático
2. ✅ UI para selección de modo:
   - Dropdown en settings
   - Preview de modo seleccionado
3. ✅ Validación con Shield/personas:
   - Verificar que modos respetan red lines
   - Testing con diferentes personas
4. ✅ Documentación:
   - README actualizado
   - Nodos GDD actualizados
   - Pricing/logs documentados
5. ✅ Tests E2E completos

**Criterios de Aceptación:**

- ✅ Reglas de negocio implementadas
- ✅ UI funcional para selección
- ✅ Validación con Shield/personas
- ✅ Documentación completa

## Archivos Afectados

### Nuevos Archivos

- `src/lib/llmClient/factory.js`
- `src/lib/llmClient/routes.js`
- `src/lib/llmClient/fallbacks.js`
- `src/lib/llmClient/transformers.js`
- `src/lib/llmClient/index.js`
- `src/routes/ai-modes.js`
- `tests/unit/lib/llmClient/factory.test.js`
- `tests/unit/lib/llmClient/routes.test.js`
- `tests/unit/lib/llmClient/fallbacks.test.js`
- `tests/integration/llmClient.test.js`

### Archivos Modificados

- `src/services/roastGeneratorEnhanced.js`
- `src/services/roastEngine.js`
- `src/services/PersonaService.js`
- `src/services/embeddingsService.js`
- `src/services/rqcService.js`
- `src/workers/GenerateReplyWorker.js`
- `src/workers/AnalyzeToxicityWorker.js`
- `src/services/sponsorService.js`
- `src/services/gatekeeperService.js`
- `src/services/modelAvailabilityService.js`
- `src/routes/index.js` (añadir ai-modes route)
- `database/migrations/` (añadir campos a roasts_metadata)
- `package.json` (añadir portkey-ai)
- `.env.example` (añadir vars Portkey)
- `docs/nodes/roast.md` (actualizar con Portkey)
- `docs/nodes/cost-control.md` (actualizar con multi-provider)
- `README.md` (documentar Portkey)

## Riesgos y Mitigaciones

### Riesgo 1: Ajuste de Costos/Tokens

**Riesgo:** Portkey no reduce tokens, pero hay que vigilar precios por modelo y recargo por log una vez pasemos 10k/mes.

**Mitigación:**

- Tracking detallado de costos por provider
- Alertas cuando costo > threshold
- Dashboard de costos en admin panel

### Riesgo 2: Compatibilidad con Workers/Colas

**Riesgo:** Garantizar `mode ?? 'default'` y versión de payload.

**Mitigación:**

- Validación de payload en workers
- Default `mode: 'default'` si no especificado
- Tests de compatibilidad hacia atrás

### Riesgo 3: Dependencia de PersonaService/Embeddings

**Riesgo:** Si algún modelo no está en Portkey, documentar fallback temporal a OpenAI directo.

**Mitigación:**

- Fallback automático a OpenAI si Portkey falla
- Documentación clara de fallbacks
- Tests de fallback scenarios

## Validación

### Tests Requeridos

1. **Unit Tests:**
   - `LLMClient.factory.test.js` - Singleton, cache, fallback
   - `LLMClient.routes.test.js` - Routing por modo
   - `LLMClient.fallbacks.test.js` - Cadenas de fallback
   - `LLMClient.transformers.test.js` - Normalización de respuestas

2. **Integration Tests:**
   - `llmClient.test.js` - Flujo completo con Portkey
   - `roast-generation-portkey.test.js` - Roasts con Portkey
   - `embeddings-portkey.test.js` - Embeddings con Portkey

3. **E2E Tests:**
   - Flujo completo: Comment → Analyze → Generate → Publish con Portkey
   - Verificar metadata en `roasts_metadata`

### Cobertura Objetivo

- **LLMClient:** ≥90%
- **Servicios actualizados:** Mantener cobertura actual (≥85%)
- **Tests E2E:** Flujo completo validado

## Agentes Relevantes

- **Backend Developer** - Implementación de LLMClient y actualización de servicios
- **Test Engineer** - Tests unitarios, integración y E2E
- **Guardian** - Validación de seguridad y cost-control
- **Orchestrator** - Coordinación de fases
- **Documentation Agent** - Actualización de docs y nodos GDD

## Dependencias GDD

- `roast` - Sistema de generación de roasts
- `persona` - Sistema de personalización
- `cost-control` - Tracking de costos
- `queue-system` - Jobs con metadata
- `shield` - Integración con análisis

## Próximos Pasos

1. ✅ Crear plan (este documento)
2. ⏳ Fase 1: Implementar LLMClient wrapper básico
3. ⏳ Fase 2: Añadir modos y endpoint
4. ⏳ Fase 3: Telemetría y cost-control
5. ⏳ Fase 4: Reglas de negocio y UI

---

**Última actualización:** 2025-01-27  
**Estado:** Plan creado, listo para Fase 1
