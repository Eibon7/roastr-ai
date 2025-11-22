# Issue #916: Tests para Billing Worker

**Prioridad:** P0 (CRÍTICO)  
**Cobertura Actual:** 0%  
**Cobertura Objetivo:** ≥85%  
**Riesgo:** 🔥 CRÍTICO - Dinero en juego

## Estado Actual

- **Archivo:** `src/workers/BillingWorker.js`
- **Tests existentes:** 0 (ningún test para BillingWorker)
- **Cobertura:** 0%
- **Riesgo:** CRÍTICO - El BillingWorker maneja pagos y suscripciones. Bugs aquí pueden causar pérdida de ingresos, problemas de facturación, y problemas legales.

## Objetivo

Implementar tests exhaustivos y producción-ready para el BillingWorker que validen:
- Procesamiento de suscripciones
- Cálculo de costos
- Webhooks de Stripe/Polar
- Límites de plan
- Errores de pago
- Idempotencia

## Acceptance Criteria

### AC1: Procesamiento de Suscripciones (Coverage ≥85%)
- ✅ Tests de creación de suscripción
- ✅ Tests de actualización de suscripción
- ✅ Tests de cancelación de suscripción
- ✅ Tests de renovación automática
- ✅ Tests de cambio de plan
- ✅ Tests de upgrade/downgrade
- ✅ Tests de suscripciones expiradas

### AC2: Cálculo de Costos
- ✅ Tests de cálculo de costos por plan
- ✅ Tests de cálculo de overages
- ✅ Tests de cálculo de descuentos
- ✅ Tests de cálculo de impuestos
- ✅ Tests de cálculo de períodos de facturación

### AC3: Webhooks (Stripe/Polar)
- ✅ Tests de webhook válido de Stripe
- ✅ Tests de webhook válido de Polar
- ✅ Tests de webhook inválido (firma incorrecta)
- ✅ Tests de webhook duplicado (idempotencia)
- ✅ Tests de todos los tipos de eventos:
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed

### AC4: Límites de Plan
- ✅ Tests de validación de límites
- ✅ Tests de enforcement de límites
- ✅ Tests de notificación cuando se alcanza límite
- ✅ Tests de bloqueo cuando se excede límite

### AC5: Errores de Pago
- ✅ Tests de tarjeta rechazada
- ✅ Tests de fondos insuficientes
- ✅ Tests de tarjeta expirada
- ✅ Tests de reintentos de pago
- ✅ Tests de notificación al usuario
- ✅ Tests de suspensión de servicio

### AC6: Idempotencia
- ✅ Tests de procesamiento idempotente de webhooks
- ✅ Tests de prevención de doble facturación
- ✅ Tests de manejo de eventos duplicados

### AC7: Calidad de Tests
- ✅ Tests validan comportamiento real (no solo mocks)
- ✅ Tests cubren edge cases y errores
- ✅ Tests son rápidos (<1s cada uno)
- ✅ Tests están bien documentados
- ✅ Tests son aislados y reproducibles

## Arquitectura del BillingWorker

### Métodos Principales

1. **processJob(job)** - Router principal que delega según job_type
2. **processPaymentFailed(job)** - Maneja fallos de pago con dunning
3. **processSubscriptionCancelled(job)** - Maneja cancelaciones
4. **processSubscriptionUpdated(job)** - Maneja actualizaciones de plan
5. **processPaymentSucceeded(job)** - Maneja pagos exitosos
6. **processPaymentActionRequired(job)** - Maneja 3D Secure
7. **processBillingRetry(job)** - Maneja reintentos con backoff exponencial
8. **handleFinalPaymentFailure(userId, customerId, planConfig)** - Suspensión final

### Dependencias

- `BaseWorker` - Clase base con funcionalidad común
- `emailService` - Envío de emails de notificación
- `notificationService` - Notificaciones in-app
- `auditLogService` - Logging de auditoría
- `StripeWrapper` - Wrapper de Stripe API
- `planService` - Configuración de planes (SINGLE SOURCE OF TRUTH)
- `queueService` - Sistema de colas para reintentos

### Tipos de Jobs

- `payment_failed` - Pago fallido
- `subscription_cancelled` - Suscripción cancelada
- `subscription_updated` - Suscripción actualizada
- `payment_succeeded` - Pago exitoso
- `invoice_payment_action_required` - Acción requerida (3D Secure)
- `billing_retry` - Reintento de billing

## Plan de Implementación

### Fase 1: Setup y Mocks (Día 1)
1. Crear estructura de tests siguiendo patrón Supabase Mock Factory
2. Mockear todas las dependencias:
   - emailService
   - notificationService
   - auditLogService
   - StripeWrapper
   - planService
   - queueService
   - BaseWorker (métodos necesarios)
3. Crear helpers para datos de prueba (factories)

### Fase 2: Tests de Procesamiento de Suscripciones (Día 1-2)
1. Tests de `processPaymentFailed`:
   - Pago fallido primera vez (notificación + retry)
   - Pago fallido múltiples veces (suspensión final)
   - Usuario no encontrado (error)
   - Email falla (no debe bloquear)
   - Notificación falla (no debe bloquear)
2. Tests de `processSubscriptionCancelled`:
   - Cancelación normal (reset a starter_trial)
   - Usuario con organización (actualizar org también)
   - Email de cancelación enviado
   - Notificación creada
   - Audit log creado
3. Tests de `processSubscriptionUpdated`:
   - Upgrade de plan (starter → pro)
   - Downgrade de plan (pro → starter)
   - Cambio sin cambio de plan (solo status)
   - Email de upgrade enviado
   - Audit log creado

### Fase 3: Tests de Webhooks (Día 2)
1. Tests de webhooks Stripe:
   - checkout.session.completed
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
2. Tests de idempotencia:
   - Webhook duplicado (mismo event_id)
   - Prevención de doble procesamiento
   - Verificación de firmas

### Fase 4: Tests de Límites y Costos (Día 2-3)
1. Tests de límites de plan:
   - Validación de límites por plan
   - Enforcement cuando se alcanza límite
   - Bloqueo cuando se excede límite
   - Notificaciones de límite
2. Tests de cálculo de costos:
   - Costos por plan
   - Overages
   - Descuentos
   - Períodos de facturación

### Fase 5: Tests de Errores y Edge Cases (Día 3)
1. Tests de errores de pago:
   - Tarjeta rechazada
   - Fondos insuficientes
   - Tarjeta expirada
   - Reintentos con backoff exponencial
   - Suspensión después de múltiples fallos
2. Tests de edge cases:
   - Usuario sin suscripción
   - Customer ID inválido
   - Datos faltantes
   - Servicios externos no disponibles

### Fase 6: Validación y Coverage (Día 3)
1. Ejecutar tests y verificar coverage ≥85%
2. Optimizar tests lentos (<1s cada uno)
3. Documentar tests complejos
4. Validar que todos los tests pasan

## Archivos a Crear

- `tests/unit/workers/BillingWorker.test.js` - Tests principales
- `tests/helpers/billingTestFactories.js` - Factories para datos de prueba
- `tests/unit/workers/__mocks__/BillingWorkerMocks.js` - Mocks centralizados

## Patrones a Seguir

### Supabase Mock Pattern (CRÍTICO)
```javascript
// Crear mock ANTES de jest.mock()
const mockSupabase = createSupabaseMock({
  user_subscriptions: { plan: 'pro', status: 'active' },
  organizations: { id: 'org-123', owner_id: 'user-123' }
});

jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));
```

### Service Mocks
```javascript
jest.mock('../../src/services/emailService', () => ({
  sendPaymentFailedNotification: jest.fn(),
  sendSubscriptionCanceledNotification: jest.fn(),
  sendUpgradeSuccessNotification: jest.fn()
}));
```

### Test Structure
```javascript
describe('BillingWorker', () => {
  describe('processPaymentFailed', () => {
    it('should process first payment failure with notification and retry', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Métricas de Éxito

- ✅ Coverage ≥85% para BillingWorker
- ✅ Todos los tests pasan al 100%
- ✅ Tests ejecutan en <30 segundos total
- ✅ Tests validan todos los tipos de webhooks
- ✅ Tests validan idempotencia
- ✅ Tests detectan bugs reales de billing

## Referencias

- Plan completo: `docs/plan/test-coverage-improvement-plan.md`
- Análisis de cobertura: `docs/test-coverage-analysis.md`
- Guía de testing: `docs/TESTING-GUIDE.md`
- CodeRabbit Lessons: `docs/patterns/coderabbit-lessons.md`
- Supabase Mock Pattern: `tests/helpers/supabaseMockFactory.js`

## Agentes Relevantes

- **Test Engineer** - Implementación de tests
- **Backend Developer** - Revisión de lógica de billing
- **Guardian** - Validación de seguridad y compliance

