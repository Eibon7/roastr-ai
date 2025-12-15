# GDD Node — Workers del Sistema v2

---

version: "2.0"
node_id: workers
status: production
priority: critical
owner: Back-end Dev
last_updated: 2025-12-05
coverage: 60
coverage_source: auto
depends_on:

- infraestructura
  ssot_references:
- worker_logs
- worker_names
- worker_retries
- worker_routing
- worker_routing_table
- worker_tenancy
  subnodes:
- fetch-comments
- analyze-toxicity
- generate-roast
- generate-corrective-reply
- shield-action
- social-posting
- billing-integration-update
- cursor-reconciliation
- strike-cleanup
- worker-manager

---

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)

- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)

Este nodo depende de los siguientes nodos:

- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)

---

### Servicios Externos:

- **Supabase**: DB para todos los workers
- **Redis/Upstash**: Colas v2
- **X API / YouTube API**: FetchComments, SocialPosting, ShieldAction
- **OpenAI**: GenerateRoast, GenerateCorrectiveReply
- **Perspective**: AnalyzeToxicity

### SSOT:

- Cadencias por plan (FetchComments)
- Thresholds y weights (AnalyzeToxicity)
- Tonos y modelos (GenerateRoast)
- Límites plataforma (SocialPosting)

### Nodos Relacionados:

- `04-integraciones.md` (Adaptadores X/YouTube)
- `05-motor-analisis.md` (AnalyzeToxicity)
- `06-motor-roasting.md` (GenerateRoast)
- `07-shield.md` (ShieldAction)
- `03-billing-polar.md` (BillingUpdate)

---

## 7. Edge Cases

### FetchComments:

1. **Análisis remaining = 0**:
   - Worker NO hace llamadas a API
   - No encola trabajos
   - Log: "analysis_exhausted_skip_fetch"

2. **Cursor expirado**:
   - CursorReconciliation lo detecta
   - Reset a punto seguro

3. **429 rate limit (X)**:
   - Backoff exponencial
   - Freeze temporal si persiste

### AnalyzeToxicity:

1. **Perspective falla N veces**:
   - Fallback GPT-4o-mini
   - Log: "perspective_degraded"

2. **Ambos fallan**:
   - "no analizable"
   - Muestra en UI como normal
   - Log severidad alta

### GenerateRoast:

1. **Style Validator bloquea**:
   - Marca roast como bloqueado
   - Crédito ya consumido

2. **Cuenta pausada antes de publicar**:
   - Cancela roast pendiente
   - No publica

### ShieldAction:

1. **SHIELD_ONLY mode** (plataforma):
   - Worker ignora intentos de publicación
   - Log: "shield_only_discard"
   - NO envía a DLQ

2. **API falla al ocultar**:
   - Fallback: bloquear

### SocialPosting:

1. **SHIELD_ONLY mode**:
   - El worker descarta el job inmediatamente.
   - Registra log post_discarded_shield_only con IDs (sin texto).
   - NO DLQ.
   - NO reintentos.

2. **429/503 persistente**:
   - Retry → DLQ sin texto

3. **Ventana edición X (30 min)**:
   - Retrasa autopost
   - Shield actúa antes

### BillingUpdate:

1. **Límite analysis = 0**:
   - Emite evento para FetchComments OFF

2. **Límite roasts = 0**:
   - Emite evento para GenerateRoast OFF

3. **Estado de suscripción = paused**:
   - Todos los workers excepto StrikeCleanup → OFF

### CursorReconciliation:

1. **Cursor corrupto**:
   - Reset parcial a punto seguro
   - Marca cuenta inactive temporalmente

### StrikeCleanup:

1. **Strikes > 90 días**:
   - Purga automática diaria
   - Ofensor no considerado reincidente

---

## 8. Acceptance Criteria

### Generales:

- [ ] 9 workers implementados
- [ ] Colas prefijadas `v2_*`
- [ ] Idempotentes
- [ ] Retries con backoff (5 intentos)
- [ ] DLQ tras fallos
- [ ] Logs estructurados sin texto crudo
- [ ] Tenant-aware (userId + accountId)

### FetchComments:

- [ ] Programado según plan (15/10/5 min)
- [ ] Solo si status=active y analysis_remaining > 0
- [ ] Actualiza cursor (since_id / nextPageToken)
- [ ] Normaliza comentarios
- [ ] Encola AnalyzeToxicity

### AnalyzeToxicity:

- [ ] Llama Perspective API
- [ ] Fallback GPT-4o-mini si falla
- [ ] Aplica Motor de Análisis
- [ ] Encola worker apropiado según decisión
- [ ] Consume 1 crédito análisis

### GenerateRoast:

- [ ] Genera 1 o 2 variantes (según flag)
- [ ] Style Validator valida
- [ ] Auto-approve ON → encola SocialPosting
- [ ] Auto-approve OFF → pending_user_review
- [ ] Consume 1 crédito roast

### GenerateCorrectiveReply:

- [ ] Tono institucional (NO tonos humor)
- [ ] Disclaimer IA obligatorio
- [ ] El disclaimer se aplica siempre, independientemente del auto-approve.
- [ ] Consume 1 crédito roast
- [ ] Asigna Strike 1

### ShieldAction:

- [ ] Ejecuta hide/report/block según severidad
- [ ] Fallbacks cuando API no permite
- [ ] NO guarda texto comentario
- [ ] Actualiza strikes

### SocialPosting:

- [ ] Publica roast/correctiva
- [ ] Añade disclaimer siempre que auto-approve esté ON
- [ ] Smart delay anti-bot
- [ ] X: retrasa 30 min si ventana edición
- [ ] SHIELD_ONLY → descarta silenciosamente

### BillingUpdate:

- [ ] Actualiza analysis_used, roasts_used
- [ ] Detecta límites agotados
- [ ] Emite eventos para pausar workers
- [ ] Resetea en inicio de ciclo

### CursorReconciliation:

- [ ] Detecta cursors antiguos/corruptos
- [ ] Reset parcial a punto seguro
- [ ] NO borra comentarios

### StrikeCleanup:

- [ ] Ejecución diaria
- [ ] Purga strikes > 90 días

### Workers Auxiliares (SSOT 8.5 - ROA-324):

Los siguientes workers soportan funcionalidades internas y no forman parte del flujo core:

| Worker | Responsabilidad | Prioridad |
|--------|-----------------|-----------|
| AccountDeletion | GDPR: Eliminación completa de cuenta y datos | 5 (low) |
| AlertNotification | Observabilidad: Envío de alertas y notificaciones | 5 (low) |
| ExportCleanup | GDPR: Limpieza de archivos de exportación antiguos | 5 (low) |
| GDPRRetention | GDPR: Purga automática de datos > 90 días | 5 (low) |
| ModelAvailability | Infraestructura: Health check de modelos IA | 5 (low) |

**Características:**
- No consumen créditos de análisis/roasts
- Ejecutan con prioridad baja (background)
- Pueden deshabilitarse sin afectar flujo core

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Worker payload validation
- ✅ Retry logic
- ✅ Backoff calculation
- ✅ Smart delay
- ❌ NO testear: Colas reales, APIs externas

### Integration Tests (Supabase Test):

- ✅ FetchComments → AnalyzeToxicity pipeline
- ✅ AnalyzeToxicity → decisión correcta
- ✅ GenerateRoast → roast guardado
- ✅ ShieldAction → shield_log creado
- ✅ SocialPosting → platform_message_id guardado
- ✅ BillingUpdate → contadores actualizados
- ✅ Límite 0 → workers OFF
- ✅ DLQ tras 5 fallos
- ✅ Idempotencia (mismo job 2 veces → mismo resultado)

### E2E Tests (Playwright):

- ✅ Ingestión → análisis → roast → publicación
- ✅ Ingestión → análisis → Shield → ocultar
- ✅ Correctiva publicada con Strike 1
- ✅ Límite agotado → workers OFF
- ✅ DLQ visible en Admin Panel

---

## 10. Implementation Notes

### Worker Base:

```typescript
// apps/backend-v2/src/workers/BaseWorker.ts

export abstract class BaseWorker<T> {
  abstract process(payload: T): Promise<void>;

  async execute(payload: T, attemptCount: number = 1): Promise<void> {
    try {
      await this.process(payload);
      await this.logSuccess(payload);
    } catch (error) {
      if (attemptCount < MAX_RETRIES) {
        await this.retry(payload, attemptCount);
      } else {
        await this.sendToDLQ(payload, error);
      }
    }
  }

  private async retry(payload: T, attempt: number): Promise<void> {
    const delay = calculateBackoff(attempt);
    setTimeout(() => this.execute(payload, attempt + 1), delay);
  }
}
```

### FetchComments Worker:

```typescript
// apps/backend-v2/src/workers/FetchCommentsWorker.ts

export class FetchCommentsWorker extends BaseWorker<FetchPayload> {
  async process(payload: FetchPayload): Promise<void> {
    // 1. Verificar créditos
    const hasAnalysis = await billingService.hasAnalysisAvailable(payload.userId);
    if (!hasAnalysis) {
      logger.info('analysis_exhausted_skip_fetch', { userId: payload.userId });
      return;
    }

    // 2. Fetch incremental
    const adapter = getPlatformAdapter(payload.platform);
    const comments = await adapter.fetchComments(payload.accountId, payload.cursor);

    // 3. Normalizar
    const normalized = comments.map(normalizeComment);

    // 4. Encolar análisis
    for (const comment of normalized) {
      await enqueueAnalyzeToxicity(comment);
    }

    // 5. Actualizar cursor
    await updateCursor(payload.accountId, getNextCursor(comments));
  }
}
```

### AnalyzeToxicity Worker:

```typescript
// apps/backend-v2/src/workers/AnalyzeToxicityWorker.ts

export class AnalyzeToxicityWorker extends BaseWorker<AnalyzePayload> {
  async process(payload: AnalyzePayload): Promise<void> {
    // 1. Análisis con Motor
    const decision = await analysisEngine.analyze(payload);

    // 2. Encolar según decisión
    switch (decision) {
      case 'shield_critico':
      case 'shield_moderado':
        await enqueueShieldAction({ ...payload, severity: decision });
        break;

      case 'correctiva':
        await enqueueGenerateCorrectiveReply(payload);
        break;

      case 'roast':
        await enqueueGenerateRoast(payload);
        break;

      case 'publicar':
        // Solo log
        await logPublicacionNormal(payload);
        break;
    }

    // 3. Actualizar billing
    await enqueueBillingUpdate({ userId: payload.userId, type: 'analysis' });
  }
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 8)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 8)

## 11. Related Nodes

- infraestructura (depends_on)
- billing-integration (required_by)

---

## 12. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `worker_logs` - Configuración de logs por worker
- `worker_names` - Nombres oficiales de workers
- `worker_retries` - Configuración de reintentos
- `worker_routing` - Routing de workers a colas
- `worker_routing_table` - Tabla de routing
- `worker_tenancy` - Configuración multi-tenant

---
