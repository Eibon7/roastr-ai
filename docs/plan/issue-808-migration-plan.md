# Plan de Migración: Issue #808 - Tests de Billing Stripe → Polar

**Issue:** #808  
**Fecha:** 2025-11-17  
**Estado:** En preparación

---

## 📋 Resumen

Migrar todos los tests de billing que actualmente usan Stripe para que funcionen con Polar como proveedor de pagos, manteniendo la cobertura del 100%.

**Archivo principal:** `tests/unit/routes/billing-coverage-issue502.test.js` (73 tests)

---

## ✅ Pre-requisitos Completados

- ✅ **PR #888:** Código actualizado para usar `PRODUCT_ID` (Polar) en lugar de `PRICE_ID` (Stripe)
- ✅ **Compatibilidad backward:** Funciones legacy mantenidas durante migración
- ✅ **Variables de entorno:** `.env` ya tiene `POLAR_*_PRODUCT_ID` configuradas
- ✅ **Documentación:** `docs/plan/issue-808-migration-summary.md` creada

---

## 🎯 Objetivo

Migrar 73 tests de `billing-coverage-issue502.test.js` de Stripe a Polar manteniendo:
- ✅ 100% cobertura
- ✅ Misma funcionalidad
- ✅ Mocks de Polar en lugar de Stripe
- ✅ Variables de entorno actualizadas

---

## 📝 Archivos a Migrar

### Principal:
1. **`tests/unit/routes/billing-coverage-issue502.test.js`** ⭐
   - 73 tests con Stripe
   - Mocks de `stripeWrapper` y `billingInterface`
   - Variables de entorno `STRIPE_*`

### Secundarios (evaluar después):
2. `tests/unit/routes/billing.test.js`
3. `tests/unit/routes/billing-webhooks.test.js`
4. `tests/unit/routes/billing-transactions-issue95.test.js`
5. `tests/unit/routes/billing-edge-cases.test.js`
6. `tests/integration/stripeWebhooksFlow.test.js`
7. `tests/unit/services/stripeWrapper.test.js` (evaluar si se mantiene)

---

## 🔄 Cambios Necesarios

### 1. Variables de Entorno

**De:**
```javascript
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_LOOKUP_STARTER
STRIPE_PRICE_LOOKUP_PRO
STRIPE_PRICE_LOOKUP_PLUS
STRIPE_SUCCESS_URL
STRIPE_CANCEL_URL
STRIPE_PORTAL_RETURN_URL
```

**A:**
```javascript
POLAR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET
POLAR_STARTER_PRODUCT_ID
POLAR_PRO_PRODUCT_ID
POLAR_PLUS_PRODUCT_ID
POLAR_SUCCESS_URL
POLAR_ALLOWED_PRODUCT_IDS
```

### 2. Mocks

**De:**
```javascript
mockStripe = {
  customers: { create, retrieve },
  prices: { list },
  checkout: { sessions: { create } },
  billingPortal: { sessions: { create } },
  subscriptions: { retrieve },
  webhooks: { constructEvent }
}
```

**A:**
```javascript
mockPolar = {
  checkouts: { create, get },
  orders: { list },
  subscriptions: { get, update, cancel },
  // Webhook validation diferente (HMAC)
}
```

### 3. Estructura de Respuestas

**Stripe:**
- `checkout.session.id` → `cs_test_123`
- `checkout.session.url` → `https://checkout.stripe.com/...`
- `price.id` → `price_xxx`

**Polar:**
- `checkout.id` → `checkout_xxx`
- `checkout.url` → `https://polar.sh/checkout/...`
- `product.id` → `product_xxx` (no price_id)

### 4. Webhooks

**Stripe:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Polar:**
- `checkout.created`
- `order.created`
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`

---

## 📋 Checklist de Migración

### Fase 1: Setup y Preparación
- [ ] Crear rama: `feature/issue-808-polar-tests-migration`
- [ ] Leer `docs/plan/issue-808-migration-summary.md`
- [ ] Verificar que PR #888 está mergeada o incluir cambios
- [ ] Crear mocks de Polar SDK
- [ ] Actualizar variables de entorno en tests

### Fase 2: Migración de Mocks
- [ ] Reemplazar `mockStripe` con `mockPolar`
- [ ] Actualizar estructura de mocks (checkouts, orders, subscriptions)
- [ ] Crear helper para webhook signature validation (HMAC)
- [ ] Actualizar respuestas mock para formato Polar

### Fase 3: Migración de Tests
- [ ] Actualizar `beforeAll` con variables Polar
- [ ] Migrar tests de checkout session creation
- [ ] Migrar tests de portal session creation
- [ ] Migrar tests de webhook processing
- [ ] Migrar tests de subscription management
- [ ] Actualizar validaciones de lookup keys → product IDs

### Fase 4: Validación
- [ ] Ejecutar todos los tests: `npm test -- billing-coverage-issue502`
- [ ] Verificar cobertura sigue siendo 100%
- [ ] Verificar que todos los tests pasan
- [ ] Actualizar documentación

---

## 🛠️ Implementación Sugerida

### Estructura de Mocks Polar

```javascript
const mockPolarClient = {
  checkouts: {
    create: jest.fn().mockResolvedValue({
      id: 'checkout_123',
      url: 'https://polar.sh/checkout/123',
      customerEmail: 'test@example.com',
      productPriceId: process.env.POLAR_STARTER_PRODUCT_ID,
      status: 'open',
      amount: 500,
      currency: 'eur'
    }),
    get: jest.fn().mockResolvedValue({
      id: 'checkout_123',
      status: 'complete',
      customerEmail: 'test@example.com',
      productPriceId: process.env.POLAR_STARTER_PRODUCT_ID
    })
  },
  orders: {
    list: jest.fn().mockResolvedValue({
      data: [],
      hasMore: false
    })
  },
  subscriptions: {
    get: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn()
  }
};

// Mock Polar SDK
jest.mock('@polar-sh/sdk', () => ({
  Polar: jest.fn(() => mockPolarClient)
}));
```

### Helper para Webhook Validation

```javascript
function createPolarWebhookEvent(type, data) {
  const payload = JSON.stringify({ type, data });
  const signature = crypto
    .createHmac('sha256', process.env.POLAR_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return {
    payload,
    signature: `sha256=${signature}`,
    type,
    data
  };
}
```

---

## 🧪 Testing Strategy

1. **Migrar test por test** (no todos a la vez)
2. **Mantener misma estructura** de tests
3. **Validar cada test** después de migrar
4. **Comparar cobertura** antes/después

---

## 📚 Referencias

- **Issue #808:** Migrar tests de billing de Stripe a Polar
- **PR #888:** Refactor PRICE_ID → PRODUCT_ID
- **Docs:** `docs/plan/issue-808-migration-summary.md`
- **Polar SDK:** https://docs.polar.sh/api-reference
- **Código actual:** `src/routes/checkout.js`, `src/routes/polarWebhook.js`

---

## ⚠️ Notas Importantes

1. **Backward Compatibility:** Mantener soporte para `price_id` durante migración
2. **Webhooks:** Polar usa HMAC SHA-256, diferente a Stripe
3. **Product IDs:** Polar usa `product_id`, no `price_id`
4. **Checkout:** Polar espera array de `products` (no `price_id` individual)

---

## 🎯 Próximos Pasos

1. ✅ Crear plan (este documento)
2. ⏭️ Crear rama y empezar migración
3. ⏭️ Migrar mocks primero
4. ⏭️ Migrar tests uno por uno
5. ⏭️ Validar y crear PR

