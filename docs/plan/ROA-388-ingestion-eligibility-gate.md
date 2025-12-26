# Plan de Implementación — IG1: Ingestion Eligibility Gate (V2)

**Issue:** ROA-388  
**Fecha:** 2025-12-26  
**Estado:** En Progreso  
**Owner:** Back-end Dev  
**Agentes:** TestEngineer, Guardian

---

## 🎯 Objetivo

Implementar un **gate de elegibilidad previo a ingestion** que determine de forma **explícita, determinista y auditable** si un usuario está autorizado a ingerir comentarios en ese momento.

Este gate actúa **antes** de cualquier fetch y evalúa policies independientes para decidir si se permite o bloquea la ingestion.

---

## 📐 Arquitectura

### Componentes Principales

```
IngestionEligibilityGate (orquestador)
├── CreditPolicy
├── TrialPolicy
├── SubscriptionPolicy
├── UserStatusPolicy
├── FeatureFlagPolicy
└── RateLimitPolicy
```

### Flujo de Decisión

```
Usuario solicita ingestion
      ↓
IngestionEligibilityGate.evaluate()
      ↓
Evalúa policies en orden
      ↓
Primera policy con allowed: false → BLOCK
      ↓
Todas allowed: true → ALLOW
```

---

## 📤 Contratos

### PolicyResult (contrato común)

```typescript
type PolicyResult = {
  allowed: boolean;
  reason?: string;  // snake_case, slug estable
  retry_after_seconds?: number;
  metadata?: Record<string, unknown>;
};
```

### IngestionEligibilityResult (output del gate)

```typescript
type IngestionEligibilityResult = {
  allowed: boolean;
  blocked_by?: {
    policy: string;
    reason: string;
    retry_after_seconds?: number;
  };
};
```

---

## 🧩 Policies a Implementar (v1)

### 1. CreditPolicy
- **Evalúa:** `analysis_remaining > 0`
- **Bloquea si:** Créditos agotados
- **Reason:** `credit_exhausted`
- **Retry:** No (hasta próximo ciclo)
- **Fuente:** billing-integration (costControl.js)

### 2. TrialPolicy
- **Evalúa:** Trial activo o no aplicable
- **Bloquea si:** Trial expirado
- **Reason:** `trial_expired`
- **Retry:** No
- **Fuente:** billing-integration (billingService.js)

### 3. SubscriptionPolicy
- **Evalúa:** Estado de suscripción
- **Bloquea si:** `state = 'paused' | 'canceled_pending'` (pasado current_period_end)
- **Reason:** `subscription_inactive`
- **Retry:** No (hasta reactivación)
- **Fuente:** billing-integration (billingService.js)

### 4. UserStatusPolicy
- **Evalúa:** Estado del usuario
- **Bloquea si:** Usuario suspendido o dado de baja
- **Reason:** `user_suspended` | `user_deleted`
- **Retry:** No
- **Fuente:** auth (Supabase profiles)

### 5. FeatureFlagPolicy
- **Evalúa:** Feature flag de ingestion
- **Bloquea si:** `ingestion_enabled = false`
- **Reason:** `feature_disabled`
- **Retry:** Sí (hasta que flag se active)
- **Fuente:** ssot-integration (featureFlagService.js)

### 6. RateLimitPolicy
- **Evalúa:** Rate limit global
- **Bloquea si:** Límite excedido
- **Reason:** `rate_limit_exceeded`
- **Retry:** Sí (retry_after_seconds)
- **Fuente:** infraestructura (Redis/Upstash)

---

## 📂 Archivos a Crear/Modificar

### Nuevos Archivos

1. **`src/services/ingestion/IngestionEligibilityGate.js`**
   - Orquestador de policies
   - Evaluación secuencial
   - Logging y eventos

2. **`src/services/ingestion/policies/CreditPolicy.js`**
   - Evalúa créditos disponibles

3. **`src/services/ingestion/policies/TrialPolicy.js`**
   - Evalúa estado de trial

4. **`src/services/ingestion/policies/SubscriptionPolicy.js`**
   - Evalúa estado de suscripción

5. **`src/services/ingestion/policies/UserStatusPolicy.js`**
   - Evalúa estado del usuario

6. **`src/services/ingestion/policies/FeatureFlagPolicy.js`**
   - Evalúa feature flags

7. **`src/services/ingestion/policies/RateLimitPolicy.js`**
   - Evalúa rate limits

8. **`tests/unit/services/ingestion/IngestionEligibilityGate.test.js`**
   - Tests unitarios del gate

9. **`tests/unit/services/ingestion/policies/*.test.js`**
   - Tests unitarios de cada policy

10. **`tests/integration/services/ingestion/eligibilityFlow.test.js`**
    - Tests de integración del flujo completo

### Archivos a Modificar

1. **`src/workers/FetchCommentsWorker.js`**
   - Añadir llamada a IG1 antes de fetch
   - Manejar bloqueo (emit evento, no enqueue)

2. **`src/config/flags.js`**
   - Añadir `ingestion_enabled` flag

3. **`docs/SSOT-V2.md`**
   - Añadir definición de feature flag `ingestion_enabled`
   - Añadir rate limits de ingestion

4. **`docs/nodes-v2/05-motor-analisis.md`**
   - Añadir sección de IG1

5. **`docs/system-map-v2.yaml`**
   - Añadir referencia a IG1 en `analysis-engine`

---

## 🔁 Orden de Evaluación de Policies

El orden de evaluación es determinista y está optimizado para fallar rápido:

1. **UserStatusPolicy** (más crítico, falla inmediata)
2. **SubscriptionPolicy** (estado de cuenta)
3. **TrialPolicy** (estado de trial)
4. **CreditPolicy** (límites de uso)
5. **FeatureFlagPolicy** (configuración global)
6. **RateLimitPolicy** (límites de infraestructura)

La primera policy que devuelva `allowed: false` detiene la evaluación.

---

## 📊 Observabilidad

### Evento: `ingestion_blocked`

```typescript
{
  event: 'ingestion_blocked',
  timestamp: Date.now(),
  user_id: string,
  account_id: string,
  platform: 'x' | 'youtube',
  flow: 'timeline' | 'mentions' | 'replies',
  policy: string,
  reason: string,
  retryable: boolean,
  user_plan: 'starter' | 'pro' | 'plus',
  is_trial: boolean,
  feature_flag_state: Record<string, boolean>,
  metadata: {
    remaining_credits?: number,
    subscription_state?: string,
    retry_after?: number
  }
}
```

### Logs Estructurados

```typescript
{
  level: 'info' | 'warn',
  message: 'Ingestion blocked',
  request_id: string,
  user_id: string,
  policy: string,
  reason: string,
  retryable: boolean,
  retry_after_seconds?: number,
  metadata: Record<string, unknown>
}
```

---

## 🧪 Tests Requeridos

### Unit Tests (Vitest)

#### IngestionEligibilityGate
- ✅ Permite ingestion cuando todas las policies permiten
- ✅ Bloquea ingestion por cada reason posible
- ✅ retry_after_seconds correcto cuando aplica
- ✅ No lanza side effects (no fetch, no persist, no enqueue)
- ✅ Devuelve primera policy que bloquea (no evalúa todas)
- ✅ Metadata incluida en resultado

#### CreditPolicy
- ✅ Permite cuando `analysis_remaining > 0`
- ✅ Bloquea cuando `analysis_remaining = 0`
- ✅ Reason correcto: `credit_exhausted`
- ✅ No retryable

#### TrialPolicy
- ✅ Permite cuando trial activo
- ✅ Permite cuando no hay trial (plan sin trial)
- ✅ Bloquea cuando trial expirado
- ✅ Reason correcto: `trial_expired`
- ✅ No retryable

#### SubscriptionPolicy
- ✅ Permite cuando `state = 'active'`
- ✅ Permite cuando `state = 'trialing'`
- ✅ Permite cuando `state = 'canceled_pending'` (dentro del período)
- ✅ Bloquea cuando `state = 'paused'`
- ✅ Bloquea cuando `state = 'canceled_pending'` (fuera del período)
- ✅ Reason correcto: `subscription_inactive`
- ✅ No retryable

#### UserStatusPolicy
- ✅ Permite cuando usuario activo
- ✅ Bloquea cuando usuario suspendido
- ✅ Bloquea cuando usuario eliminado
- ✅ Reason correcto: `user_suspended` | `user_deleted`
- ✅ No retryable

#### FeatureFlagPolicy
- ✅ Permite cuando `ingestion_enabled = true`
- ✅ Bloquea cuando `ingestion_enabled = false`
- ✅ Reason correcto: `feature_disabled`
- ✅ Retryable (sin retry_after específico)

#### RateLimitPolicy
- ✅ Permite cuando dentro del límite
- ✅ Bloquea cuando límite excedido
- ✅ Reason correcto: `rate_limit_exceeded`
- ✅ Retryable con retry_after_seconds correcto

### Integration Tests (Supabase Test)

- ✅ Flujo completo: Usuario válido → ALLOW
- ✅ Flujo completo: Créditos agotados → BLOCK
- ✅ Flujo completo: Trial expirado → BLOCK
- ✅ Flujo completo: Suscripción pausada → BLOCK
- ✅ Flujo completo: Usuario suspendido → BLOCK
- ✅ Flujo completo: Feature flag desactivado → BLOCK
- ✅ Flujo completo: Rate limit excedido → BLOCK
- ✅ Evento `ingestion_blocked` emitido correctamente
- ✅ No side effects en base de datos

### E2E Tests (Playwright)

- ✅ Usuario con créditos agotados ve banner "Has agotado los análisis"
- ✅ Usuario con trial expirado ve prompt de activación
- ✅ Usuario suspendido no puede acceder a dashboard

---

## 🔗 Dependencias con Otros Nodos

### Consume de:
- **billing-integration** (créditos, suscripción, trial)
- **auth** (estado del usuario)
- **ssot-integration** (feature flags)
- **infraestructura** (rate limits)
- **observabilidad** (logging, eventos)

### Requerido por:
- **analysis-engine** (pre-condición para ingestion)
- **integraciones-redes-sociales** (FetchCommentsWorker)

---

## 🚫 Fuera de Scope

IG1 **NO cubre**:
- ❌ Relevancia de comentarios (es responsabilidad de Analysis)
- ❌ Clasificación/análisis (es responsabilidad de Analysis)
- ❌ Acciones de shield o roast (es responsabilidad de Shield/Roast)
- ❌ UX de mensajes al usuario (es responsabilidad de Frontend)
- ❌ Autorecuperación de créditos (es responsabilidad de Billing)
- ❌ Deduplicación de comentarios (es responsabilidad de Ingestion)

---

## ✅ Checklist de Implementación

### Fase 1: Contratos y Base
- [ ] Definir tipos TypeScript para contratos
- [ ] Crear estructura de directorios
- [ ] Implementar IngestionEligibilityGate (orquestador vacío)
- [ ] Tests básicos del gate

### Fase 2: Policies Individuales
- [ ] Implementar CreditPolicy + tests
- [ ] Implementar TrialPolicy + tests
- [ ] Implementar SubscriptionPolicy + tests
- [ ] Implementar UserStatusPolicy + tests
- [ ] Implementar FeatureFlagPolicy + tests
- [ ] Implementar RateLimitPolicy + tests

### Fase 3: Integración
- [ ] Integrar policies en IngestionEligibilityGate
- [ ] Tests de integración
- [ ] Añadir llamada a IG1 en FetchCommentsWorker

### Fase 4: Observabilidad
- [ ] Implementar evento `ingestion_blocked`
- [ ] Implementar logs estructurados
- [ ] Tests de observabilidad

### Fase 5: Documentación y Validación
- [ ] Actualizar docs/SSOT-V2.md
- [ ] Actualizar docs/nodes-v2/05-motor-analisis.md
- [ ] Actualizar docs/system-map-v2.yaml
- [ ] Tests E2E
- [ ] Validación final

---

## 📝 Notas de Implementación

### Decisiones de Diseño

1. **Orden de Evaluación**
   - Determinista y optimizado para fallar rápido
   - Las policies más críticas primero (UserStatus, Subscription)
   - Las policies menos costosas al inicio

2. **No Side Effects**
   - IG1 solo lee, nunca escribe
   - No modifica estado del usuario
   - No persiste decisiones (solo emite eventos)

3. **Retry Logic**
   - Algunas policies son retryables (FeatureFlag, RateLimit)
   - Otras no (Credit, Trial, Subscription, UserStatus)
   - El caller decide si reintentar basado en `retry_after_seconds`

4. **Metadata**
   - Cada policy puede incluir metadata adicional
   - Metadata NO se usa para control de flujo
   - Solo para debug/analytics

5. **Fail-Safe**
   - Si una policy falla al evaluar → bloquea por defecto
   - No se asume "allow" por error
   - Logging detallado de errores

---

## 🔐 Seguridad y GDPR

- ❌ NO almacenar texto de comentarios en logs
- ❌ NO exponer PII en eventos de analytics
- ✅ Usar `user_id` hasheado si es necesario
- ✅ Logs cumplen con GDPR (ver nodo gdpr-legal)

---

## 🎯 Acceptance Criteria Final

- [ ] Gate de elegibilidad definido y operativo
- [ ] Policies evaluadas vía contrato común
- [ ] Output determinista y auditable
- [ ] Evento `ingestion_blocked` emitido cuando se bloquea
- [ ] Logs estructurados sin PII
- [ ] Tests básicos pasando (>= 90% coverage)
- [ ] Sin acoplamiento interno con Ingestion
- [ ] Documentación GDD actualizada
- [ ] SSOT actualizado con feature flags

---

**Última actualización:** 2025-12-26  
**Estado:** Listo para implementación
