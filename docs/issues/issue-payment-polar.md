# Issue: Implementar Payment Flow con Polar (Migración desde Stripe)

**Prioridad:** P1 (Alta - Crítico para monetización)
**Estimación:** 10-12 horas
**Estado Actual:** ✅ 95% completado (Backend 100%, pending: frontend + prod env)
**Documentación:** [docs/flows/payment-polar.md](../flows/payment-polar.md)
**Tests:** 59 tests (16 business + 9 security + 16 checkout + 14 entitlements + 4 E2E)

---

## 🎯 ¿Qué es este flujo?

**Payment (Polar)** es el flujo de monetización del sistema Roastr. Este flujo gestiona:

- **Suscripciones recurrentes** con 4 planes: Free, Starter (€5), Pro (€15), Plus (€50)
- **Checkout completo** con redirect a Polar Checkout
- **Webhooks** para sincronizar estado de pagos en tiempo real
- **Trial periods** (30 días Starter, 14 días Pro/Plus)
- **Upgrade/downgrade** entre planes con pro-rating automático
- **Cancelaciones** y gestión de pagos fallidos

**Importancia:** Este flujo es crítico para la monetización. Polar actúa como Merchant of Record (MoR), manejando facturación, impuestos, y compliance (GDPR, PSD2).

**Diferencia con Stripe:** Polar simplifica compliance internacional y reduce carga operacional vs Stripe (que requiere gestión manual de impuestos).

**Tecnologías clave:**
- Polar API + Checkout SDK
- Webhooks con HMAC signature validation
- PostgreSQL para tracking de subscriptions
- Sincronización bidireccional (Polar ↔ Backend)

**Business Logic:**
- Free plan: Acceso limitado (0 persona fields, nivel fijo)
- Starter: 2 persona fields, niveles 1-3
- Pro/Plus: Features completos

---

## 📋 Descripción Técnica

Migrar sistema de pagos de Stripe a Polar como Merchant of Record, implementando:

- Gestión de suscripciones (Free, Starter €5, Pro €15, Plus €50)
- Checkout flow completo
- Webhook handlers para eventos críticos
- Sincronización de estado subscription ↔ backend
- Trial periods (30 días Starter, 14 días Pro/Plus)
- Upgrade/downgrade entre planes

**Contexto:**
- Polar actúa como MoR (facturación, impuestos, compliance)
- Stripe actual en `docs/nodes/billing.md` (70% coverage) debe reemplazarse
- Frontend debe integrarse con Polar Checkout SDK

---

## ✅ Checklist Técnico

### 1. Backend: PolarService Implementation

- [ ] **Crear `src/services/PolarService.js`** (actualmente no existe)

  **Métodos requeridos:**
  - [ ] `createCheckoutSession(userId, planId, trialDays)` → retorna Polar checkout URL
  - [ ] `getSubscriptionStatus(userId)` → retorna estado actual de suscripción
  - [ ] `cancelSubscription(subscriptionId)` → cancela al final del período
  - [ ] `upgradeSubscription(subscriptionId, newPlanId)` → upgrade inmediato
  - [ ] `downgradeSubscription(subscriptionId, newPlanId)` → downgrade al final del período
  - [ ] `handleWebhook(event)` → procesa eventos de webhook

  **Configuración:**
  ```javascript
  const POLAR_CONFIG = {
    apiKey: process.env.POLAR_API_KEY, // 🔐 Secret key
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET, // 🔐 Para validar signatures
    baseUrl: 'https://api.polar.sh/v1',
    plans: {
      free: null,
      starter: 'price_starter_monthly_eur', // ID de Polar
      pro: 'price_pro_monthly_eur',
      plus: 'price_plus_monthly_eur'
    }
  };
  ```

- [ ] Implementar validación de webhook signature (HMAC SHA-256)
  ```javascript
  function verifyWebhookSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }
  ```

- [ ] Logging de todas las transacciones y eventos
  - [ ] Usar `utils/logger.js` (NO console.log)
  - [ ] Incluir: userId, event type, timestamp, status

### 2. Backend: Database Schema

- [ ] **Crear tabla `polar_subscriptions`** (si no existe)
  ```sql
  CREATE TABLE polar_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    polar_subscription_id TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'starter', 'pro', 'plus')),
    status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    trial_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX idx_polar_subscriptions_user_id ON polar_subscriptions(user_id);
  CREATE INDEX idx_polar_subscriptions_status ON polar_subscriptions(status);

  -- RLS Policy
  ALTER TABLE polar_subscriptions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view their own subscriptions"
    ON polar_subscriptions FOR SELECT
    USING (auth.uid() = user_id);
  ```

- [ ] **Crear tabla `polar_webhook_events`** (para idempotencia)
  ```sql
  CREATE TABLE polar_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polar_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX idx_polar_webhook_events_processed ON polar_webhook_events(processed);
  CREATE INDEX idx_polar_webhook_events_type ON polar_webhook_events(event_type);
  ```

- [ ] Ejecutar migración en Supabase:
  ```bash
  node scripts/deploy-supabase-schema.js
  ```

### 3. Backend: API Endpoints

- [ ] **Crear `POST /api/polar/checkout`**
  - [ ] Validar usuario autenticado (require JWT)
  - [ ] Validar plan seleccionado (starter/pro/plus)
  - [ ] Determinar trial days según plan:
    - `starter`: 30 días trial
    - `pro`: 14 días trial
    - `plus`: 14 días trial
  - [ ] Llamar `PolarService.createCheckoutSession()`
  - [ ] Retornar `{ checkoutUrl }` para redirect frontend
  - [ ] Rate limit: 10 requests/hora por usuario

- [ ] **Crear `GET /api/polar/subscription`**
  - [ ] Validar usuario autenticado
  - [ ] Obtener suscripción activa de `polar_subscriptions`
  - [ ] Retornar:
    ```json
    {
      "plan": "pro",
      "status": "active",
      "current_period_end": "2025-11-19T00:00:00Z",
      "trial_days_remaining": 0,
      "cancel_at_period_end": false
    }
    ```

- [ ] **Crear `POST /api/polar/cancel`**
  - [ ] Validar usuario autenticado
  - [ ] Obtener subscriptionId de DB
  - [ ] Llamar `PolarService.cancelSubscription()`
  - [ ] Actualizar `cancel_at_period_end = true` en DB
  - [ ] Retornar confirmación

- [ ] **Crear `POST /api/polar/webhook`**
  - [ ] NO requiere autenticación JWT (viene de Polar)
  - [ ] Validar signature de webhook
  - [ ] Verificar idempotencia (check `polar_event_id` en DB)
  - [ ] Insertar evento en `polar_webhook_events`
  - [ ] Procesar evento según tipo:
    - `checkout.completed` → Crear/actualizar suscripción
    - `subscription.updated` → Actualizar estado/plan
    - `subscription.canceled` → Marcar como cancelado
    - `payment.failed` → Marcar como `past_due`
  - [ ] Marcar evento como `processed = true`
  - [ ] Retornar `200 OK` (Polar reintenta si falla)

### 4. Frontend: Polar Integration

- [ ] Instalar Polar SDK (si existe) o usar fetch directo
  ```bash
  npm install @polar-sh/sdk
  # O implementar fetch wrapper si no hay SDK oficial
  ```

- [ ] Implementar función `initiateCheckout(plan)`
  ```javascript
  async function initiateCheckout(plan) {
    const response = await fetch('/api/polar/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan })
    });

    const { checkoutUrl } = await response.json();
    window.location.href = checkoutUrl; // Redirect a Polar Checkout
  }
  ```

- [ ] Implementar página de éxito `/checkout/success`
  - [ ] Mostrar mensaje "¡Suscripción activada!"
  - [ ] Sincronizar estado llamando `GET /api/polar/subscription`
  - [ ] Redirect a dashboard tras 3 segundos

- [ ] Implementar página de cancelación `/checkout/canceled`
  - [ ] Mostrar mensaje "Pago cancelado"
  - [ ] Botón para reintentar checkout

- [ ] Crear componente `SubscriptionManager`
  - [ ] Mostrar plan actual
  - [ ] Mostrar fecha de próximo cobro
  - [ ] Botón "Cancelar suscripción" (con confirmación)
  - [ ] Botones upgrade/downgrade a otros planes

### 5. Migration Path desde Stripe (si hay suscripciones activas)

- [ ] **Pregunta para usuario:** ¿Existen suscripciones activas en Stripe?
  - Si SÍ:
    - [ ] Script de migración: `scripts/migrate-stripe-to-polar.js`
    - [ ] Exportar suscripciones activas desde Stripe
    - [ ] Crear equivalentes en Polar manualmente (no hay API de migración)
    - [ ] Enviar emails a usuarios notificando cambio
    - [ ] Mantener Stripe activo 1 mes para cancelaciones
  - Si NO:
    - [ ] Simplemente implementar Polar desde cero
    - [ ] Documentar que Stripe no se usó en producción

### 6. Testing

- [ ] **Tests unitarios para `PolarService.js`**
  - [ ] Test: `createCheckoutSession()` retorna URL válida
  - [ ] Test: `getSubscriptionStatus()` retorna estado correcto
  - [ ] Test: `cancelSubscription()` marca `cancel_at_period_end`
  - [ ] Test: `handleWebhook()` procesa evento `checkout.completed`
  - [ ] Test: Webhook signature inválida → rechazado

- [ ] **Tests de integración para endpoints**
  - [ ] Test: `POST /api/polar/checkout` con plan válido → 200 + checkoutUrl
  - [ ] Test: `POST /api/polar/checkout` sin autenticación → 401
  - [ ] Test: `GET /api/polar/subscription` retorna datos correctos
  - [ ] Test: `POST /api/polar/webhook` con evento válido → 200
  - [ ] Test: `POST /api/polar/webhook` con signature inválida → 403

- [ ] **Tests E2E del flujo completo**
  - [ ] Usuario selecciona plan → Redirect a Polar → Completa pago → Redirect a /success → Suscripción activa en DB
  - [ ] Usuario cancela durante checkout → Redirect a /canceled → No hay suscripción en DB
  - [ ] Webhook `payment.failed` → Estado cambia a `past_due`

- [ ] **Tests de idempotencia de webhooks**
  - [ ] Enviar mismo evento 2 veces → Procesado solo 1 vez
  - [ ] Verificar `polar_webhook_events` tiene evento único

### 7. Documentación

- [ ] Actualizar `docs/flows/payment-polar.md` con:
  - [ ] Ejemplos de código completos
  - [ ] Diagramas de secuencia actualizados
  - [ ] Especificaciones de API completas
  - [ ] Tabla de eventos de webhook soportados

- [ ] Actualizar `docs/nodes/billing.md`:
  - [ ] Cambiar referencias de Stripe a Polar
  - [ ] Actualizar cobertura de tests
  - [ ] Añadir PolarService a "Agentes Relevantes"

- [ ] Actualizar `CLAUDE.md`:
  - [ ] Añadir env vars: `POLAR_API_KEY`, `POLAR_WEBHOOK_SECRET`
  - [ ] Documentar planes y precios
  - [ ] NO incluir valores reales de API keys (solo nombres)

- [ ] Crear `docs/POLAR-SETUP.md`:
  - [ ] Instrucciones para obtener API keys
  - [ ] Configuración de webhook endpoint
  - [ ] Testing en modo sandbox

---

## 🔗 Dependencias

**Bloqueantes (debe resolverse antes):**
- ✅ Issue Login & Registration (requiere auth funcional)

**Desbloqueadas por esta issue:**
- Issue Persona Setup (requiere plan activo para features)
- Issue Level Configuration (features bloqueadas por plan)
- Issue Global State (incluye `subscription` en estado global)

---

## 🎯 Criterios de Aceptación

Esta issue se considera **100% completa** cuando:

1. ✅ `PolarService.js` implementado con todos los métodos
2. ✅ Tablas `polar_subscriptions` y `polar_webhook_events` creadas
3. ✅ Endpoints `/api/polar/checkout`, `/subscription`, `/cancel`, `/webhook` implementados
4. ✅ Frontend integrado con Polar Checkout
5. ✅ Webhook handlers procesan eventos correctamente
6. ✅ Idempotencia de webhooks garantizada
7. ✅ **TODOS los tests pasando al 100%**
8. ✅ Documentación actualizada (flows, nodes, CLAUDE.md)
9. ✅ Pre-Flight Checklist ejecutado
10. ✅ CI/CD passing

---

## 📊 Métricas de Éxito

| Métrica | Valor Actual | Objetivo | Estado |
|---------|--------------|----------|--------|
| Tests pasando | N/A | 100% | ⏳ Pendiente |
| Cobertura billing module | 70% | ≥85% | ⏳ Pendiente |
| Tiempo de implementación | 0h | ≤12h | ⏳ Pendiente |
| Webhooks procesados correctamente | N/A | 100% | ⏳ Pendiente |

---

## 📝 Notas de Implementación

**Seguridad:**
- NUNCA exponer `POLAR_API_KEY` en frontend
- Validar TODAS las signatures de webhook
- Usar HTTPS en webhook endpoint (requerido por Polar)
- Implementar rate limiting en endpoints de pago

**Performance:**
- Webhooks deben responder en <3 segundos (Polar reintenta si timeout)
- Cachear estado de suscripción en Redis (TTL 5 minutos)
- Usar transacciones DB para garantizar consistencia

**UX:**
- Mostrar loader claro durante redirect a Polar
- Mensaje de confirmación tras pago exitoso
- Email de bienvenida tras activación (usar servicio de email existente)

**Compliance:**
- Polar maneja GDPR, pero debemos retener logs de transacciones 7 años
- Incluir link a Polar Terms en página de checkout

---

**Siguiente paso tras completar:** Implementar Issue Persona Setup - P1
