# Plan Issue #931: Tests para Routes de Billing

## Estado Actual

- **Issue:** [Coverage] Fase 4.1: Tests para Routes de Billing (0-20% → 70%+)
- **Priority:** 🔴 ALTA (monetización crítica)
- **Labels:** enhancement, high priority, backend
- **Cobertura actual:**
  - `billingController.js`: 0% (sin tests)
  - `billingFactory.js`: 0% (sin tests)
  - `billing.js`: 19.6% (tests parciales en billing-coverage-issue502.test.js)

## Acceptance Criteria (10 ACs)

- [ ] `billingController.js` tiene ≥70% cobertura
- [ ] `billingFactory.js` tiene ≥70% cobertura
- [ ] `billing.js` tiene ≥70% cobertura
- [ ] Todos los tests pasan (0 failures)
- [ ] Tests cubren endpoints principales (checkout, subscription, etc.)
- [ ] Tests cubren casos de éxito y error
- [ ] Tests validan respuestas HTTP correctas
- [ ] Tests validan lógica de billing (pricing, limits, etc.)
- [ ] Tests usan mocks apropiados (sin llamadas reales a Stripe/Polar)
- [ ] Tests validan seguridad (no exponer datos sensibles)

## Archivos a Cubrir

| Archivo                           | Líneas | Cobertura Actual | Objetivo |
| --------------------------------- | ------ | ---------------- | -------- |
| `src/routes/billingController.js` | 727    | 0%               | ≥70%     |
| `src/routes/billingFactory.js`    | 131    | 0%               | ≥70%     |
| `src/routes/billing.js`           | 709    | 19.6%            | ≥70%     |

## Agentes Relevantes

- **Test Engineer** (implementación de tests)
- **Guardian** (billing es área sensible)

## Plan de Implementación

### FASE 1: Tests para billingController.js

**Archivo:** `tests/unit/routes/billingController.test.js`

**Métodos a cubrir:**

1. `queueBillingJob()` - Job queuing con fallback sync
2. `handleCheckoutCompleted()` - Procesamiento checkout exitoso
3. `handleSubscriptionUpdated()` - Actualización de suscripción
4. `handleSubscriptionDeleted()` - Cancelación de suscripción
5. `handlePaymentSucceeded()` - Pago exitoso
6. `handlePaymentFailed()` - Pago fallido
7. `applyPlanLimits()` - Aplicar límites de plan

**Casos de test:**

- ✅ Happy path para cada método
- ❌ Error handling (transacciones fallidas, DB errors)
- 🔄 Edge cases (null user, missing metadata)
- 📧 Email/notification failures (non-blocking)

### FASE 2: Tests para billingFactory.js

**Archivo:** `tests/unit/routes/billingFactory.test.js`

**Métodos a cubrir:**

1. `createController()` - Factory con DI
2. `getPlanConfig()` - Configuración de planes

**Casos de test:**

- ✅ Crear controller con dependencias default
- ✅ Crear controller con dependencias override
- ✅ Verificar PLAN_CONFIG estructura
- 🔒 Billing disabled → controller sin billingInterface

### FASE 3: Mejorar tests billing.js

**Archivo:** `tests/unit/routes/billing-coverage-issue502.test.js` (ampliar)

**Gaps a cubrir:**

- GET /plans error handling
- Checkout con lookupKey edge cases
- Portal session con return_url missing
- Webhook con event malformados

## Mocks Pattern (Siguiendo coderabbit-lessons.md #11)

```javascript
// Crear mocks ANTES de jest.mock() - CRÍTICO
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: {...}, error: null }))
      }))
    })),
    insert: jest.fn(),
    update: jest.fn()
  })),
  rpc: jest.fn()
};

// Luego usar en jest.mock()
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));
```

## Validación

```bash
# Tests específicos
npm test -- tests/unit/routes/billingController.test.js
npm test -- tests/unit/routes/billingFactory.test.js
npm test -- tests/unit/routes/billing-coverage-issue502.test.js

# Cobertura de archivos específicos
npm test -- --coverage --collectCoverageFrom='src/routes/billing*.js'

# Verificar GDD
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci
```

## Timeline Estimado

- FASE 1: billingController.js tests - 2 horas
- FASE 2: billingFactory.js tests - 30 min
- FASE 3: billing.js gaps - 1 hora
- Validación y ajustes - 30 min

**Total:** ~4 horas

## Referencias

- GDD Node: `docs/nodes/cost-control.md`
- Tests helper: `tests/helpers/supabaseMockFactory.js`
- Existing tests: `tests/unit/routes/billing-coverage-issue502.test.js`

---

**Creado:** 2025-11-24
**Autor:** Orchestrator + TaskAssessor
