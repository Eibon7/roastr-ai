# Production-Ready Issues - Roastr.ai MVP

Issues generados tras análisis exhaustivo del codebase para preparar MVP production-ready.

---

## 🔴 PRIORIDAD CRÍTICA (P0) - Bloqueadores MVP

### Issue #1: Implementar campo `post_mode` (manual/auto) en integration_configs

**Prioridad:** P0 - Bloqueador MVP
**Área:** Backend - Integration Config
**Estimación:** 3 horas

**Contexto:**
Actualmente el sistema usa un JSONB genérico `config.auto_post` que es difícil de queryar y no tiene default claro. Esto causa comportamiento inconsistente en el flujo de aprobación manual vs automático.

**Archivos afectados:**
- `database/schema.sql` - Línea 179-194
- `src/workers/GenerateReplyWorker.js` - Línea 501-504
- `src/routes/integrations.js`

**Acceptance Criteria:**
- [ ] Añadir columna `post_mode VARCHAR(20) DEFAULT 'manual' CHECK (post_mode IN ('manual', 'auto'))` a `integration_configs`
- [ ] Migración de datos existentes: mover `config.auto_post` a nueva columna
- [ ] Actualizar `GenerateReplyWorker.processJob()` para usar `integrationConfig.post_mode` en lugar de `config.auto_post`
- [ ] Endpoint `PUT /api/integrations/:platform/posting-mode` para cambiar entre manual/auto
- [ ] Tests de integración verificando flujo manual vs auto
- [ ] Documentar en API docs

**Flujo esperado:**
```javascript
// Manual mode
if (integrationConfig.post_mode === 'manual') {
  // Keep response as 'pending', wait for user approval
  status = 'pending'
} else {
  // Auto mode: queue posting immediately
  await queuePostingJob(...)
}
```

**Rollback plan:**
Si hay problemas, mantener lectura de `config.auto_post` como fallback por 1 release.

---

### Issue #2: Implementar niveles de Shield configurables (shield_sensitivity)

**Prioridad:** P0 - Feature crítica
**Área:** Backend - Shield Configuration
**Estimación:** 5 horas

**Contexto:**
Shield actualmente usa thresholds hardcoded (0.8 para high, 0.95 para critical). Los usuarios Pro/Plus necesitan ajustar sensibilidad según su tolerancia personal.

**Archivos afectados:**
- `database/schema.sql` - Línea 192
- `src/workers/AnalyzeToxicityWorker.js` - Línea 42-48
- `src/routes/shield.js`

**Acceptance Criteria:**
- [ ] Añadir columna `shield_sensitivity INTEGER DEFAULT 3 CHECK (shield_sensitivity BETWEEN 1 AND 5)` a `integration_configs`
- [ ] Añadir columna `shield_auto_execute BOOLEAN DEFAULT false` para control de ejecución automática
- [ ] Crear función `calculateDynamicThresholds(baseSensitivity, userSensitivity)` en `AnalyzeToxicityWorker`
- [ ] Endpoint `PUT /api/integrations/:platform/shield-settings`
- [ ] Actualizar UI de configuración de Shield
- [ ] Tests con diferentes niveles de sensibilidad (1=tolerante, 5=estricto)

**Implementación sugerida:**
```javascript
// AnalyzeToxicityWorker.js
calculateDynamicThresholds(userSensitivity) {
  const baseThresholds = { low: 0.3, medium: 0.6, high: 0.8, critical: 0.95 };
  const factor = userSensitivity / 3; // 3 = default

  return {
    low: baseThresholds.low * factor,
    medium: baseThresholds.medium * factor,
    high: baseThresholds.high * factor,
    critical: baseThresholds.critical
  };
}
```

**Validación:**
- Sensitivity 1 (bajo): high = 0.27, critical = 0.95
- Sensitivity 3 (default): high = 0.8, critical = 0.95
- Sensitivity 5 (alto): high = 1.33 → clamp to 1.0

---

### Issue #3: Separar `enabled` de `shield_enabled` para granularidad

**Prioridad:** P0 - UX crítico
**Área:** Backend - Integration Config
**Estimación:** 2 horas

**Contexto:**
Actualmente si un usuario desactiva `enabled: false`, se apaga TODO (fetch comments, shield, roasting). No hay forma de desactivar solo roasting manteniendo Shield activo.

**Archivos afectados:**
- `src/workers/FetchCommentsWorker.js`
- `src/workers/AnalyzeToxicityWorker.js`
- `src/workers/GenerateReplyWorker.js`

**Acceptance Criteria:**
- [ ] Documentar comportamiento de cada flag:
  - `enabled: false` → NO fetch comments (integración completamente OFF)
  - `shield_enabled: true, response_frequency: 0` → Shield ON, Roasting OFF
  - `enabled: true, shield_enabled: false` → Roasting ON, Shield OFF
- [ ] Actualizar workers para respetar flags correctamente
- [ ] Endpoint `PUT /api/integrations/:platform/features` para configurar granularmente
- [ ] Tests verificando 4 combinaciones de flags
- [ ] Documentación de usuario explicando opciones

**Matriz de comportamiento:**
| enabled | shield_enabled | response_frequency | Resultado |
|---------|----------------|-------------------|-----------|
| false | - | - | Todo OFF |
| true | true | 0.0 | Solo Shield |
| true | false | >0 | Solo Roasting |
| true | true | >0 | Shield + Roasting |

---

### Issue #4: Soportar múltiples cuentas del mismo tipo (multi-account)

**Prioridad:** P0 - Bloqueador planes Pro/Plus
**Área:** Database Schema + Backend
**Estimación:** 8 horas

**Contexto:**
El constraint `UNIQUE(organization_id, platform)` impide tener 2+ cuentas de Twitter. Planes Pro/Plus necesitan hasta 2 cuentas por red.

**Archivos afectados:**
- `database/schema.sql` - Línea 196
- `src/routes/integrations.js`
- `src/services/userIntegrationsService.js`

**Acceptance Criteria:**
- [ ] **Database migration:**
  - Drop `UNIQUE(organization_id, platform)` constraint
  - Add `account_identifier VARCHAR(255)` column
  - Add `display_name VARCHAR(255)` column
  - Add `is_primary BOOLEAN DEFAULT false` column
  - Create new `UNIQUE(organization_id, platform, account_identifier)` constraint
- [ ] **Plan limits enforcement:**
  - Starter: 1 cuenta por platform
  - Pro/Plus: 2 cuentas por platform
  - Custom: ilimitado
- [ ] **API changes:**
  - `POST /api/integrations/:platform` → body incluye `{ account_identifier, display_name }`
  - `GET /api/integrations/:platform` → devuelve array de cuentas
  - `DELETE /api/integrations/:platform/:account_identifier` → eliminar cuenta específica
- [ ] **Validación de límites:**
  - Función `canAddAccount(organizationId, platform, userPlan)` en `planLimitsService`
  - Error 403 si excede límite del plan
- [ ] **UI changes:**
  - Selector de cuenta en dashboard
  - Botón "Añadir cuenta" si no excede límite
- [ ] Tests de límites por plan
- [ ] Migración de datos existentes (marcar como `is_primary: true`, generar `account_identifier` desde config)

**Migration script ejemplo:**
```sql
-- Step 1: Add columns
ALTER TABLE integration_configs
ADD COLUMN account_identifier VARCHAR(255),
ADD COLUMN display_name VARCHAR(255),
ADD COLUMN is_primary BOOLEAN DEFAULT false;

-- Step 2: Populate existing data
UPDATE integration_configs
SET account_identifier = COALESCE(config->>'username', config->>'account_id', id::text),
    display_name = COALESCE(config->>'username', platform || ' Account'),
    is_primary = true
WHERE account_identifier IS NULL;

-- Step 3: Drop old constraint
ALTER TABLE integration_configs
DROP CONSTRAINT integration_configs_organization_id_platform_key;

-- Step 4: Add new constraint
CREATE UNIQUE INDEX integration_configs_org_platform_account_idx
ON integration_configs(organization_id, platform, account_identifier);
```

---

## 🟠 PRIORIDAD ALTA (P1) - Necesario para calidad MVP

### Issue #5: Eliminar 868 console.log y migrar a logger estructurado

**Prioridad:** P1 - Calidad de código
**Área:** Logging + Debugging
**Estimación:** 6 horas

**Contexto:**
Hay 868 llamadas a `console.log/console.error` en 49 archivos. Esto impide logging estructurado, filtrado por componente, y análisis en producción.

**Archivos más afectados:**
- `src/integrations/twitter/twitterService.js` - 44 console.logs
- `src/services/*.js` - ~200 console.logs
- `src/workers/*.js` - ~150 console.logs

**Acceptance Criteria:**
- [ ] Eliminar TODOS los `console.log`, `console.error`, `console.warn`, `console.info`
- [ ] Reemplazar con `logger.info()`, `logger.error()`, `logger.warn()`, `logger.debug()`
- [ ] Formato estructurado:
  ```javascript
  // ANTES
  console.log('User signed up:', userId, email);

  // DESPUÉS
  logger.info('user_signed_up', { userId, email, timestamp: Date.now() });
  ```
- [ ] Script de validación en CI: `scripts/validate-no-console.sh`
- [ ] Pre-commit hook rechazando console.logs en archivos de producción
- [ ] Documentación en CONTRIBUTING.md sobre logging guidelines

**Script de detección:**
```bash
#!/bin/bash
# scripts/validate-no-console.sh
CONSOLE_LOGS=$(grep -r "console\." src/ --exclude-dir=node_modules | grep -v "// TODO" | wc -l)
if [ "$CONSOLE_LOGS" -gt 0 ]; then
  echo "❌ Found $CONSOLE_LOGS console.log statements in src/"
  grep -r "console\." src/ --exclude-dir=node_modules | grep -v "// TODO"
  exit 1
fi
echo "✅ No console.log statements found"
```

---

### Issue #6: Implementar revocación de OAuth tokens al eliminar integración

**Prioridad:** P1 - Seguridad
**Área:** Integrations + OAuth
**Estimación:** 4 horas

**Contexto:**
Al hacer `DELETE /api/integrations/:platform`, se elimina el registro de DB pero NO se revocan los OAuth tokens en la plataforma externa. Esto deja tokens activos que podrían ser explotados.

**Archivos afectados:**
- `src/services/userIntegrationsService.js` - método `deleteIntegration()`
- `src/integrations/*/index.js` - cada platform service

**Acceptance Criteria:**
- [ ] Añadir método `revokeToken(accessToken)` a cada platform service
- [ ] Actualizar `deleteIntegration()` para llamar `platformService.revokeToken()` ANTES de DELETE
- [ ] Manejo de errores: log warning si revocación falla pero continuar con DELETE
- [ ] Tests verificando revocación llamada
- [ ] Documentación de seguridad

**Implementación sugerida:**
```javascript
// userIntegrationsService.js
async deleteIntegration(accessToken, platform) {
  // 1. Get config con tokens
  const config = await this.getIntegrationConfig(org_id, platform);

  // 2. Revoke OAuth tokens BEFORE deleting
  if (config?.config?.access_token) {
    try {
      const platformService = this.getPlatformService(platform);
      await platformService.revokeToken(config.config.access_token);
      logger.info('oauth_token_revoked', { platform, org_id });
    } catch (error) {
      logger.warn('oauth_revocation_failed', {
        platform,
        error: error.message,
        // Continue with deletion anyway
      });
    }
  }

  // 3. Delete from DB
  await this.supabase
    .from('integration_configs')
    .delete()
    .eq('organization_id', org_id)
    .eq('platform', platform);
}
```

**Platform-specific implementations:**
```javascript
// Twitter
async revokeToken(accessToken) {
  await this.client.post('oauth2/revoke', { token: accessToken });
}

// YouTube
async revokeToken(accessToken) {
  await axios.post('https://oauth2.googleapis.com/revoke', { token: accessToken });
}
```

---

### Issue #7: Implementar endpoints de cancelación de suscripción

**Prioridad:** P1 - Billing crítico
**Área:** Billing + Stripe
**Estimación:** 5 horas

**Contexto:**
Actualmente solo se puede cancelar suscripción desde Stripe Customer Portal (UI externa). No hay endpoint nativo para cancelar ni captura de feedback de cancelación.

**Archivos afectados:**
- `src/routes/billing.js`
- `database/schema.sql` - nueva tabla `subscription_cancellations`

**Acceptance Criteria:**
- [ ] **Tabla de feedback de cancelación:**
  ```sql
  CREATE TABLE subscription_cancellations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    previous_plan VARCHAR(50),
    reason VARCHAR(50), -- too_expensive, not_using, missing_features, other
    feedback TEXT,
    effective VARCHAR(20), -- immediate, end_of_period
    canceled_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_ends_at TIMESTAMPTZ
  );
  ```
- [ ] **Endpoint de cancelación:**
  - `POST /api/billing/cancel-subscription`
  - Body: `{ reason, feedback, effective: 'end_of_period' | 'immediate' }`
  - Validación: solo si hay subscription activa
  - Llamada a Stripe API para cancelar
  - Almacenar feedback para analytics
  - Email de confirmación al usuario
- [ ] **Endpoint de reactivación:**
  - `POST /api/billing/reactivate-subscription`
  - Solo si subscription está en estado `canceling` (cancel_at_period_end)
  - Revertir cancelación en Stripe
- [ ] Tests de flujo completo
- [ ] Analytics dashboard para razones de cancelación

**Implementación sugerida:**
```javascript
router.post('/cancel-subscription', authenticateToken, requireBilling, async (req, res) => {
  const { reason, feedback, effective = 'end_of_period' } = req.body;
  const userId = req.user.id;

  // Validar reason
  const validReasons = ['too_expensive', 'not_using', 'missing_features', 'poor_support', 'other'];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({ error: 'Invalid cancellation reason' });
  }

  // Get subscription
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!sub?.stripe_subscription_id) {
    return res.status(404).json({ error: 'No active subscription found' });
  }

  // Get organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .single();

  let subscriptionEndsAt;

  // Cancel in Stripe
  if (effective === 'immediate') {
    const canceled = await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    subscriptionEndsAt = new Date(canceled.canceled_at * 1000);
  } else {
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true
    });
    subscriptionEndsAt = new Date(updated.current_period_end * 1000);
  }

  // Log cancellation
  await supabase.from('subscription_cancellations').insert({
    user_id: userId,
    organization_id: org.id,
    previous_plan: sub.plan,
    reason,
    feedback: feedback || null,
    effective,
    subscription_ends_at: subscriptionEndsAt.toISOString()
  });

  // Update user_subscriptions
  await supabase
    .from('user_subscriptions')
    .update({
      status: effective === 'immediate' ? 'canceled' : 'canceling',
      canceled_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  // Send confirmation email
  await emailService.sendCancellationConfirmation(req.user.email, {
    plan: sub.plan,
    endsAt: subscriptionEndsAt,
    effective
  });

  res.json({
    success: true,
    data: {
      effective,
      endsAt: subscriptionEndsAt.toISOString(),
      canReactivate: effective === 'end_of_period'
    }
  });
});
```

---

## 🟡 PRIORIDAD MEDIA (P2) - Mejoras de calidad

### Issue #8: Consolidar servicios duplicados (Shield, Plan, Roast, Notifications)

**Prioridad:** P2 - Deuda técnica
**Área:** Refactoring + Architecture
**Estimación:** 20 horas (hacer después de MVP)

**Contexto:**
Hay 81 archivos de servicios con ~37K LOC, muchos duplicados:
- Shield: 5 archivos (4,725 LOC) → debería ser 1 (800 LOC)
- Plan/Tier: 4 archivos (3,040 LOC) → debería ser 1 (300 LOC)
- Notifications: 3 archivos (718 LOC) → debería ser 1 (300 LOC)

**Archivos afectados:**
- `src/services/shield*.js` (5 archivos)
- `src/services/tier*.js`, `src/services/plan*.js` (4 archivos)
- `src/services/alert*.js`, `src/services/notification*.js` (3 archivos)

**Acceptance Criteria:**
- [ ] **Shield consolidation:**
  - Crear `ShieldService.js` unificado
  - Mover lógica de decision, action, persistence, settings a secciones del mismo archivo
  - Deprecar archivos viejos gradualmente (mantener exports temporales)
- [ ] **Plan consolidation:**
  - Crear `PlanService.js` unificado
  - Eliminar `tierValidationMonitoringService.js` (13 LOC vacías)
  - Eliminar `planValidation.js` (6 LOC vacías)
- [ ] **Notification consolidation:**
  - Crear `NotificationService.js` unificado
  - Soportar múltiples canales (email, in-app, webhook)
- [ ] Tests de regresión verificando funcionalidad idéntica
- [ ] Documentación de arquitectura actualizada

**NO hacer antes de MVP** - Es refactor grande que puede introducir bugs.

---

### Issue #9: Implementar Style Profile Extraction con Feature Flag

**Prioridad:** P2 - Feature Pro/Plus
**Área:** Style Analysis + Feature Flags
**Estimación:** 12 horas

**Contexto:**
Style profile extraction está implementado a medias (solo skeleton). Necesita completarse bajo feature flag para Pro/Plus users.

**Archivos afectados:**
- `src/services/styleProfileService.js` - Líneas 129-133, 169-177
- `src/workers/GenerateReplyWorker.js` - integración con prompt
- `database/schema.sql` - nueva tabla

**Feature Flag:**
```javascript
// .env
ENABLE_STYLE_PROFILE_EXTRACTION=false

// src/config/flags.js
flags.isEnabled('ENABLE_STYLE_PROFILE_EXTRACTION')
```

**Acceptance Criteria:**
- [ ] **Database table:**
  ```sql
  CREATE TABLE style_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50),
    encrypted_profile TEXT,
    profile_hash VARCHAR(64),
    comment_count INTEGER,
    last_analyzed_comment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
  );
  ```
- [ ] **Implementar `fetchRecentComments()`:**
  - Integrar con platform APIs (Twitter, YouTube, etc.)
  - Filtrar comentarios del usuario (no de otros)
  - Excluir respuestas generadas por Roastr (`is_roastr_generated: true`)
  - Límite: últimos 100 comentarios o 90 días
- [ ] **Implementar `analyzeTone()` con OpenAI:**
  ```javascript
  async analyzeTone(comments) {
    const prompt = `Analiza el tono de estos comentarios y devuelve JSON:
    - positive: 0-1
    - neutral: 0-1
    - aggressive: 0-1
    - ironic: 0-1
    - sarcastic: 0-1`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt + JSON.stringify(comments) }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }
  ```
- [ ] **Integrar con `GenerateReplyWorker`:**
  ```javascript
  // Fetch style profile if enabled
  if (flags.isEnabled('ENABLE_STYLE_PROFILE_EXTRACTION')) {
    const styleProfile = await styleProfileService.getStyleProfile(userId, platform);
    if (styleProfile) {
      userConfig.style_profile = styleProfile;
      // Prompt will include: "Imita el estilo del usuario: {avgLength} chars, tono {tone}, ..."
    }
  }
  ```
- [ ] **Endpoint de trigger manual:**
  - `POST /api/user/style-profile/extract?platform=twitter`
  - Solo Pro/Plus users
  - Async job (puede tardar 1-2 minutos)
  - Respuesta: `{ success: true, jobId: 'uuid', eta: '2 minutes' }`
- [ ] **Auto-refresh logic:**
  - Trigger automático cada 90 días
  - Trigger si user tiene 500+ nuevos comentarios desde última extracción
- [ ] Tests con feature flag ON/OFF
- [ ] Documentación de usuario explicando feature

**Rollout plan:**
1. Semana 1-2: Implementar con flag OFF
2. Semana 3: Testing interno con 5-10 usuarios Pro
3. Semana 4: Habilitar para 50% Pro/Plus users (A/B test)
4. Semana 5+: 100% rollout si métricas positivas

---

### Issue #10: Migrar de poll-based a event-driven queue system

**Prioridad:** P2 - Performance optimization
**Área:** Workers + Queue System
**Estimación:** 16 horas (hacer después de MVP)

**Contexto:**
Workers actuales usan polling cada 1-2 segundos, generando ~10K queries/10s en idle. Event-driven system reduciría a 0 queries en idle.

**Archivos afectados:**
- `src/workers/BaseWorker.js` - Línea 150-180 (método `processJobs()`)
- `src/services/queueService.js`

**Acceptance Criteria:**
- [ ] Implementar event-driven queue usando Redis BLPOP:
  ```javascript
  // ANTES (poll-based)
  async processJobs() {
    while (this.isRunning) {
      const job = await this.queueService.getNextJob();
      if (!job) await sleep(1000); // ← 10 workers × 1s = 10 queries/s
    }
  }

  // DESPUÉS (event-driven)
  async processJobs() {
    while (this.isRunning) {
      // BLPOP blocks until job available (0 queries while idle)
      const job = await this.queueService.blockingPop(this.workerType, timeout=5);
      if (job) await this.processJob(job);
    }
  }
  ```
- [ ] Actualizar `QueueService` para soportar `blockingPop()`:
  - Redis: `BLPOP roastr:jobs:{type} 5`
  - Supabase fallback: polling con intervalo más largo (10s)
- [ ] Mantener compatibilidad con poll-based como fallback
- [ ] Benchmarks mostrando reducción de queries
- [ ] Tests de latencia (event-driven debe ser <100ms vs poll ~500ms)

**Performance esperada:**
- Queries en idle: 10K/10s → 0/10s (100% reducción)
- Latencia promedio: 500ms → 50ms (10x mejora)
- CPU usage: -30%

**NO hacer antes de MVP** - Optimización que puede esperar.

---

## 🔵 PRIORIDAD BAJA (P3) - Nice to have

### Issue #11: Añadir filtros avanzados a listado de roasts y Shield events

**Prioridad:** P3 - UX enhancement
**Área:** API + Frontend
**Estimación:** 6 horas

**Contexto:**
Usuarios con cientos de roasts necesitan búsqueda/filtrado avanzado. Actualmente solo hay paginación básica.

**Endpoints afectados:**
- `GET /api/approval/pending`
- `GET /api/shield/events`
- `GET /api/user/accounts/:id/roasts`

**Acceptance Criteria:**
- [ ] **Búsqueda por texto:**
  - Query param: `?search=keyword`
  - Full-text search en `response_text` y `original_text`
  - PostgreSQL: `to_tsvector('spanish', response_text) @@ plainto_tsquery('spanish', search)`
- [ ] **Filtro por fecha:**
  - Query params: `?from=2025-10-01&to=2025-10-31`
  - Validación de formato ISO 8601
  - Max range: 365 días
- [ ] **Ordenamiento:**
  - Query params: `?sort=toxicity_score&order=desc`
  - Campos ordenables: `created_at`, `toxicity_score`, `post_status`
- [ ] **Filtros compuestos:**
  - `?platform=twitter&status=pending&sort=toxicity_score&order=desc`
- [ ] Performance: índices en columnas ordenables
- [ ] Tests de queries complejas
- [ ] Documentación de API

**Ejemplo:**
```
GET /api/approval/pending?platform=twitter&search=idiot&from=2025-10-01&sort=toxicity_score&order=desc&limit=20
```

**NO prioritario para MVP** - Users pueden usar paginación básica inicialmente.

---

### Issue #12: Implementar GDPR cleanup al eliminar integración

**Prioridad:** P3 - GDPR compliance
**Área:** Data Privacy + GDPR
**Estimación:** 4 horas

**Contexto:**
Al eliminar integración, datos históricos (comments, responses, shield_actions) se mantienen. GDPR requiere opción de borrado completo.

**Archivos afectados:**
- `src/services/userIntegrationsService.js` - método `deleteIntegration()`

**Acceptance Criteria:**
- [ ] Query param `?deleteHistory=true` en endpoint de eliminación:
  ```
  DELETE /api/integrations/:platform?deleteHistory=true
  ```
- [ ] Si `deleteHistory=true`:
  - Eliminar todos los `comments` de ese platform
  - Eliminar todos los `responses` asociados
  - Eliminar todos los `shield_actions` de ese platform
  - Eliminar datos de analytics asociados
- [ ] Confirmación en UI:
  ```
  "¿Eliminar cuenta de Twitter?
  □ También eliminar histórico de comentarios y roasts (irreversible)"
  ```
- [ ] Audit log de eliminación completa
- [ ] Tests verificando cascade delete
- [ ] Documentación GDPR

**Implementación:**
```javascript
async deleteIntegration(accessToken, platform, { deleteHistory = false } = {}) {
  // ... existing revocation logic ...

  if (deleteHistory) {
    // GDPR compliance: delete all historical data
    const { data: comments } = await this.supabase
      .from('comments')
      .select('id')
      .eq('organization_id', org_id)
      .eq('platform', platform);

    const commentIds = comments.map(c => c.id);

    // Cascade delete responses
    await this.supabase
      .from('responses')
      .delete()
      .in('comment_id', commentIds);

    // Delete shield actions
    await this.supabase
      .from('shield_actions')
      .delete()
      .eq('organization_id', org_id)
      .eq('platform', platform);

    // Delete comments
    await this.supabase
      .from('comments')
      .delete()
      .in('id', commentIds);

    logger.info('gdpr_historical_data_deleted', {
      org_id,
      platform,
      commentsDeleted: commentIds.length
    });
  }

  // Delete integration config
  await this.supabase.from('integration_configs').delete()...
}
```

**NO crítico para MVP** - GDPR permite mantener datos por tiempo razonable.

---

## 📋 Checklist de Issues

**P0 - BLOQUEADORES MVP (hacer AHORA):**
- [ ] #1: Campo `post_mode` (manual/auto)
- [ ] #2: Niveles de Shield configurables
- [ ] #3: Separar `enabled` de `shield_enabled`
- [ ] #4: Múltiples cuentas del mismo tipo

**P1 - CALIDAD MVP (hacer ANTES de launch):**
- [ ] #5: Eliminar console.logs
- [ ] #6: Revocación OAuth tokens
- [ ] #7: Endpoints de cancelación de suscripción

**P2 - MEJORAS POST-MVP (hacer DESPUÉS de launch):**
- [ ] #8: Consolidar servicios duplicados
- [ ] #9: Style Profile Extraction con feature flag
- [ ] #10: Event-driven queue system

**P3 - NICE TO HAVE (backlog):**
- [ ] #11: Filtros avanzados
- [ ] #12: GDPR cleanup opcional

---

## 🚀 Plan de Ejecución Sugerido

### Sprint 1 (1 semana) - MVP Blockers
- Día 1-2: Issue #1 + #3 (post_mode + enabled flags)
- Día 3-4: Issue #4 (multi-account schema + migration)
- Día 5: Issue #2 (shield_sensitivity)

### Sprint 2 (1 semana) - MVP Quality
- Día 1-2: Issue #5 (eliminar console.logs)
- Día 3: Issue #6 (OAuth revocation)
- Día 4-5: Issue #7 (cancelación suscripción)

### Sprint 3+ (post-launch) - Mejoras
- Issue #9: Style profile (12h)
- Issue #8: Refactor servicios (20h)
- Issue #10: Event-driven queues (16h)

---

## 📊 Métricas de Éxito

**Post-Sprint 1:**
- ✅ Users pueden configurar manual/auto posting
- ✅ Pro/Plus pueden tener 2 cuentas por platform
- ✅ Shield tiene niveles 1-5 configurables
- ✅ 0 tests rotos

**Post-Sprint 2:**
- ✅ 0 console.logs en src/
- ✅ OAuth tokens se revocan al eliminar integración
- ✅ Users pueden cancelar subscription desde UI nativa
- ✅ CI pasa al 100%

**Post-Sprint 3:**
- ✅ Style profile extraction funcional (feature flagged)
- ✅ Service count: 81 → <60 archivos
- ✅ Queue queries en idle: 10K/10s → 0/10s

---

**Generado:** 2025-10-25
**Basado en:** Análisis exhaustivo del codebase Roastr.ai
**Versión:** 1.0
