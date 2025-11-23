# Plan de Implementación - Issue #917: Tests para Subscription Service

## Estado Actual

**Cobertura Actual:** 0%  
**Cobertura Objetivo:** ≥85%  
**Prioridad:** P0 (CRÍTICO)  
**Riesgo:** 🔥 CRÍTICO - Core business logic

### Archivo a Testear

- `src/services/subscriptionService.js` (581 líneas)
  - 8 funciones exportadas
  - Integración con Stripe, Supabase, servicios de notificación
  - Manejo de webhooks, cambios de plan, límites

### Dependencias Identificadas

1. **Supabase** - `supabaseServiceClient` (user_subscriptions, users, organizations)
2. **PlanService** - `getPlanFeatures`, `getPlanByLookupKey`
3. **PlanValidation** - `isChangeAllowed`, `calculateProration`
4. **EmailService** - `sendPlanChangeNotification`
5. **NotificationService** - `createPlanChangeNotification`, `createPlanChangeBlockedNotification`, `createSubscriptionStatusNotification`
6. **WorkerNotificationService** - `notifyPlanChange`
7. **AuditService** - `logSubscriptionChange`, `logPlanChange`
8. **StripeWrapper** - Stripe API integration

## Pasos de Implementación

### FASE 1: Setup y Mocks (AC7)

1. Crear archivo de test: `tests/unit/services/subscriptionService.test.js`
2. Configurar mocks para todas las dependencias:
   - Supabase client (usar patrón de `supabaseMockFactory`)
   - PlanService
   - PlanValidation
   - EmailService
   - NotificationService
   - WorkerNotificationService
   - AuditService
   - StripeWrapper
3. Configurar helpers para datos de prueba

### FASE 2: AC1 - Gestión de Suscripciones

**Tests a implementar:**
- ✅ `getUserUsage` - Obtener métricas de uso del usuario
- ✅ `updateUserSubscription` - Actualizar suscripción en BD
- ✅ `processSubscriptionUpdate` - Procesar actualización desde webhook
- ✅ Tests de creación de suscripción (implícito en processSubscriptionUpdate)
- ✅ Tests de cancelación de suscripción
- ✅ Tests de reactivación de suscripción
- ✅ Tests de obtención de suscripción por usuario
- ✅ Tests de obtención de suscripción por organización
- ✅ Tests de validación de estado de suscripción

### FASE 3: AC2 - Validación de Planes

**Tests a implementar:**
- ✅ `determinePlanFromSubscription` - Determinar plan desde objeto Stripe
- ✅ Tests de validación de plan válido
- ✅ Tests de validación de plan inválido
- ✅ Tests de validación de límites de plan
- ✅ Tests de validación de características de plan
- ✅ Tests de validación de precios

### FASE 4: AC3 - Cambios de Plan

**Tests a implementar:**
- ✅ `processSubscriptionUpdate` con cambio de plan
- ✅ Tests de upgrade de plan (inmediato y con prorating)
- ✅ Tests de downgrade de plan (inmediato y al final del período)
- ✅ Tests de cambio inmediato de plan
- ✅ Tests de cambio al final del período
- ✅ Tests de prorating en cambios de plan
- ✅ Tests de validación de elegibilidad para cambio

### FASE 5: AC4 - Webhooks

**Tests a implementar:**
- ✅ `processSubscriptionUpdate` con diferentes eventos Stripe
- ✅ Tests de procesamiento de webhook de Stripe (customer.subscription.created, updated, deleted)
- ✅ Tests de procesamiento de webhook de Polar (si aplica)
- ✅ Tests de idempotencia de webhooks
- ✅ Tests de validación de firmas de webhooks (si aplica)
- ✅ Tests de manejo de eventos duplicados

### FASE 6: AC5 - Edge Cases

**Tests a implementar:**
- ✅ Tests de suscripción expirada
- ✅ Tests de suscripción en período de gracia
- ✅ Tests de suscripción cancelada pero activa hasta fin de período
- ✅ Tests de múltiples suscripciones para mismo usuario
- ✅ Tests de suscripción sin método de pago
- ✅ Tests de errores de base de datos
- ✅ Tests de errores de Stripe API

### FASE 7: AC6 - Integración

**Tests a implementar:**
- ✅ Tests de integración con BillingWorker (mock)
- ✅ Tests de integración con planLimitsService (mock)
- ✅ Tests de integración con entitlementsService (mock)
- ✅ Tests de integración con costControl (mock)
- ✅ Tests de flujo completo: webhook → actualización → notificaciones → límites

### FASE 8: AC7 - Calidad de Tests

**Validaciones:**
- ✅ Tests validan comportamiento real (no solo mocks)
- ✅ Tests cubren edge cases y errores
- ✅ Tests son rápidos (<1s cada uno)
- ✅ Tests están bien documentados
- ✅ Tests son aislados y reproducibles

## Agentes a Usar

- **TestEngineer** - Implementación principal de tests
- **Backend Developer** - Revisión de integraciones y mocks
- **Guardian** - Validación de seguridad y edge cases

## Archivos Afectados

- `tests/unit/services/subscriptionService.test.js` (NUEVO)
- `tests/helpers/supabaseMockFactory.js` (usar existente o extender)
- `docs/test-evidence/issue-917/` (evidencias de tests)

## Validación Requerida

1. **Tests pasando:** `npm test -- subscriptionService` (100% passing)
2. **Coverage ≥85%:** `npm run test:coverage -- subscriptionService`
3. **Tests rápidos:** Cada test <1s, suite completa <30s
4. **GDD actualizado:** Nodo `billing` con coverage actualizado
5. **Receipts generados:** `docs/agents/receipts/917-TestEngineer.md`

## Criterios de Éxito

- ✅ Coverage ≥85% para subscriptionService
- ✅ Todos los tests pasan al 100%
- ✅ Tests ejecutan en <30 segundos total
- ✅ Tests validan todos los flujos de suscripción
- ✅ Tests validan idempotencia de webhooks
- ✅ Tests detectan bugs reales de suscripciones

## Referencias

- Plan completo: `docs/plan/test-coverage-improvement-plan.md`
- Análisis de cobertura: `docs/test-coverage-analysis.md`
- Guía de testing: `docs/TESTING-GUIDE.md`
- Documentación de planes: `docs/nodes/plan-features.md`
- Patrones de tests: `docs/patterns/coderabbit-lessons.md`

