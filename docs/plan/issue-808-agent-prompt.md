# Prompt Completo: Issue #808 - Migrar Tests de Billing Stripe → Polar

**Para usar con un agente sin contexto previo**

---

## 🎯 TAREA PRINCIPAL

Migrar todos los tests de billing que actualmente usan Stripe para que funcionen con Polar como proveedor de pagos, manteniendo la cobertura del 100%.

**Issue:** #808  
**Archivo principal:** `tests/unit/routes/billing-coverage-issue502.test.js` (73 tests)

---

## 📋 CONTEXTO

### Situación Actual

- El proyecto está migrando de Stripe a Polar como proveedor de pagos
- El código de producción ya está actualizado para usar Polar (PR #888 mergeada)
- Los tests aún usan mocks de Stripe y variables de entorno `STRIPE_*`
- Necesitamos migrar los tests para que usen Polar manteniendo la misma cobertura

### Estado del Código

**✅ Ya completado (no tocar):**

- `src/utils/polarHelpers.js` - Usa `POLAR_*_PRODUCT_ID`
- `src/routes/checkout.js` - Endpoint de checkout con Polar
- `src/routes/polarWebhook.js` - Webhooks de Polar
- `src/services/entitlementsService.js` - Integración con Polar

**🔴 Pendiente (tu trabajo):**

- `tests/unit/routes/billing-coverage-issue502.test.js` - Migrar 73 tests

---

## 🎯 OBJETIVO ESPECÍFICO

Migrar el archivo `tests/unit/routes/billing-coverage-issue502.test.js` para que:

1. Use mocks de Polar SDK en lugar de Stripe
2. Use variables de entorno `POLAR_*` en lugar de `STRIPE_*`
3. Mantenga 100% de cobertura (todos los tests deben pasar)
4. Use la estructura de datos de Polar (product_id, no price_id)

---

## 📚 REFERENCIAS CRÍTICAS

### Archivos a Leer Primero

1. **`tests/unit/routes/billing-coverage-issue502.test.js`** - Archivo a migrar
2. **`src/routes/checkout.js`** - Ver cómo funciona checkout con Polar
3. **`src/routes/polarWebhook.js`** - Ver cómo funcionan webhooks de Polar
4. **`src/utils/polarHelpers.js`** - Ver funciones helper de Polar
5. **`docs/plan/issue-808-migration-plan.md`** - Plan detallado de migración

### Documentación Polar

- SDK: `@polar-sh/sdk` (ya instalado en package.json)
- API Docs: https://docs.polar.sh/api-reference
- Webhook events: `checkout.created`, `order.created`, `subscription.created`, `subscription.updated`, `subscription.canceled`

---

## 🔄 CAMBIOS NECESARIOS

### 1. Variables de Entorno

**Reemplazar:**

```javascript
STRIPE_SECRET_KEY → POLAR_ACCESS_TOKEN
STRIPE_WEBHOOK_SECRET → POLAR_WEBHOOK_SECRET
STRIPE_PRICE_LOOKUP_STARTER → POLAR_STARTER_PRODUCT_ID
STRIPE_PRICE_LOOKUP_PRO → POLAR_PRO_PRODUCT_ID
STRIPE_PRICE_LOOKUP_PLUS → POLAR_PLUS_PRODUCT_ID
STRIPE_SUCCESS_URL → POLAR_SUCCESS_URL
STRIPE_CANCEL_URL → (no existe en Polar, usar POLAR_SUCCESS_URL)
STRIPE_PORTAL_RETURN_URL → (Polar no tiene portal, usar POLAR_SUCCESS_URL)
```

### 2. Mocks de SDK

**De Stripe:**

```javascript
const mockStripe = {
  customers: { create, retrieve },
  prices: { list },
  checkout: { sessions: { create } },
  billingPortal: { sessions: { create } },
  subscriptions: { retrieve },
  webhooks: { constructEvent }
};
jest.mock('stripe', () => jest.fn(() => mockStripe));
```

**A Polar:**

```javascript
const mockPolarClient = {
  checkouts: {
    create: jest.fn(),
    get: jest.fn()
  },
  orders: {
    list: jest.fn()
  },
  subscriptions: {
    get: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn()
  }
};
jest.mock('@polar-sh/sdk', () => ({
  Polar: jest.fn(() => mockPolarClient)
}));
```

### 3. Estructura de Respuestas

**Stripe checkout session:**

```javascript
{
  id: 'cs_test_123',
  url: 'https://checkout.stripe.com/...',
  customer: 'cus_test_123',
  amount_total: 1500,
  currency: 'eur'
}
```

**Polar checkout:**

```javascript
{
  id: 'checkout_123',
  url: 'https://polar.sh/checkout/123',
  customerEmail: 'test@example.com',
  productPriceId: 'product_xxx', // o productId
  amount: 1500,
  currency: 'eur',
  status: 'open' // 'open' | 'complete' | 'expired'
}
```

### 4. Webhooks

**Stripe:**

- Eventos: `checkout.session.completed`, `customer.subscription.updated`
- Validación: `stripe.webhooks.constructEvent(payload, signature, secret)`

**Polar:**

- Eventos: `checkout.created`, `order.created`, `subscription.created`, `subscription.updated`, `subscription.canceled`
- Validación: HMAC SHA-256 manual (ver `src/routes/polarWebhook.js`)

**Helper para crear eventos Polar:**

```javascript
const crypto = require('crypto');

function createPolarWebhookEvent(type, data) {
  const payload = JSON.stringify({ type, data });
  const secret = process.env.POLAR_WEBHOOK_SECRET || 'test_secret';
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return {
    payload: Buffer.from(payload),
    headers: {
      'polar-signature': `sha256=${signature}`
    },
    type,
    data
  };
}
```

### 5. Billing Portal

**⚠️ IMPORTANTE:** Polar NO tiene "billing portal" como Stripe. Los tests que usen `billingPortal.sessions.create` deben:

- O eliminarse si no aplican a Polar
- O adaptarse para usar checkout de Polar con metadata especial
- O marcarse como `test.skip` con nota explicativa

---

## 📝 CHECKLIST DE MIGRACIÓN

### Fase 1: Preparación

- [ ] Leer `tests/unit/routes/billing-coverage-issue502.test.js` completo
- [ ] Leer `src/routes/checkout.js` para entender API de Polar
- [ ] Leer `src/routes/polarWebhook.js` para entender webhooks
- [ ] Crear rama: `feature/issue-808-polar-tests-migration`

### Fase 2: Setup de Mocks

- [ ] Reemplazar `jest.mock('stripe')` con `jest.mock('@polar-sh/sdk')`
- [ ] Crear `mockPolarClient` con estructura correcta
- [ ] Actualizar `beforeAll` con variables `POLAR_*`
- [ ] Crear helper `createPolarWebhookEvent()` si se necesitan webhooks

### Fase 3: Migración de Tests

- [ ] Migrar tests de checkout session creation
- [ ] Migrar tests de webhook processing
- [ ] Migrar tests de subscription management
- [ ] Adaptar/eliminar tests de billing portal (Polar no tiene)
- [ ] Actualizar todas las referencias a `price_id` → `product_id`

### Fase 4: Validación

- [ ] Ejecutar: `npm test -- billing-coverage-issue502`
- [ ] Verificar que todos los tests pasan
- [ ] Verificar cobertura: `npm run test:coverage -- billing-coverage-issue502`
- [ ] Asegurar que cobertura sigue siendo 100%

---

## 🛠️ EJEMPLO DE MIGRACIÓN

### Test Antes (Stripe):

```javascript
test('should create checkout session with plan parameter', async () => {
  const mockCustomer = { id: 'cus_test', email: 'test@example.com' };
  const mockPrice = { id: 'price_test', product: { name: 'Pro Plan' } };
  const mockSession = {
    id: 'sess_test',
    url: 'https://checkout.stripe.com/test'
  };

  mockBillingController.stripeWrapper.customers.create.mockResolvedValue(mockCustomer);
  mockBillingController.stripeWrapper.prices.list.mockResolvedValue({ data: [mockPrice] });
  mockBillingController.stripeWrapper.checkout.sessions.create.mockResolvedValue(mockSession);

  const response = await request(app)
    .post('/api/billing/create-checkout-session')
    .send({ plan: 'pro' })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.id).toBe('sess_test');
});
```

### Test Después (Polar):

```javascript
test('should create checkout session with plan parameter', async () => {
  const mockCheckout = {
    id: 'checkout_123',
    url: 'https://polar.sh/checkout/123',
    customerEmail: 'test@example.com',
    productPriceId: process.env.POLAR_PRO_PRODUCT_ID,
    status: 'open',
    amount: 1500,
    currency: 'eur'
  };

  // Polar no necesita crear customer primero, ni listar prices
  // Directamente crea checkout con product_id
  mockPolarClient.checkouts.create.mockResolvedValue(mockCheckout);

  const response = await request(app)
    .post('/api/billing/create-checkout-session')
    .send({ plan: 'pro' })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.id).toBe('checkout_123');

  // Verificar que se llamó con product_id correcto
  expect(mockPolarClient.checkouts.create).toHaveBeenCalledWith(
    expect.objectContaining({
      products: [process.env.POLAR_PRO_PRODUCT_ID],
      customerEmail: expect.any(String)
    })
  );
});
```

---

## ⚠️ PUNTOS CRÍTICOS

### 1. Billing Portal

Polar NO tiene billing portal. Tests que usen `billingPortal` deben:

- Marcarse como `test.skip` con nota: `// Polar doesn't have billing portal`
- O adaptarse para usar checkout de Polar

### 2. Product ID vs Price ID

- Polar usa `product_id` (no `price_id`)
- Usar `POLAR_*_PRODUCT_ID` de variables de entorno
- Helper: `getProductIdFromPlan(plan)` en `polarHelpers.js`

### 3. Webhook Events

- Polar usa eventos diferentes: `order.created`, `subscription.updated`, etc.
- Validación es HMAC SHA-256 (no `constructEvent` como Stripe)
- Ver `src/routes/polarWebhook.js` para estructura exacta

### 4. Mock BillingController

El archivo usa `mockBillingController.stripeWrapper` - esto debe cambiar a:

- `mockBillingController.billingInterface` (si existe)
- O mockear directamente `mockPolarClient`

---

## 🧪 VALIDACIÓN FINAL

Antes de considerar completado:

1. **Todos los tests pasan:**

   ```bash
   npm test -- billing-coverage-issue502
   ```

2. **Cobertura 100%:**

   ```bash
   npm run test:coverage -- billing-coverage-issue502
   ```

3. **Sin referencias a Stripe:**

   ```bash
   grep -i "stripe" tests/unit/routes/billing-coverage-issue502.test.js
   # Debe retornar solo comentarios o nada
   ```

4. **Variables Polar configuradas:**
   ```bash
   grep "POLAR_" tests/unit/routes/billing-coverage-issue502.test.js
   # Debe mostrar todas las variables POLAR_* usadas
   ```

---

## 📚 ARCHIVOS DE REFERENCIA

### Código de Producción (no modificar, solo leer):

- `src/routes/checkout.js` - Checkout con Polar
- `src/routes/polarWebhook.js` - Webhooks de Polar
- `src/utils/polarHelpers.js` - Helpers de Polar
- `src/services/entitlementsService.js` - Integración Polar

### Documentación:

- `docs/plan/issue-808-migration-plan.md` - Plan detallado
- `docs/plan/issue-808-migration-summary.md` - Resumen de cambios
- `docs/plan/issue-808-credenciales-polar.md` - Info de credenciales

### Tests Existentes (referencia):

- `tests/unit/routes/billing.test.js` - Otros tests de billing (pueden tener ejemplos)
- `tests/unit/services/entitlementsService-polar.test.js` - Tests de Polar (si existe)

---

## 🎯 RESULTADO ESPERADO

Al finalizar, el archivo `tests/unit/routes/billing-coverage-issue502.test.js` debe:

- ✅ Usar mocks de Polar SDK (`@polar-sh/sdk`)
- ✅ Usar variables de entorno `POLAR_*`
- ✅ Todos los tests pasando (73 tests)
- ✅ Cobertura 100% mantenida
- ✅ Sin referencias a Stripe (excepto comentarios)
- ✅ Estructura de datos de Polar (product_id, no price_id)

---

## 🚀 COMANDOS ÚTILES

```bash
# Ejecutar tests específicos
npm test -- billing-coverage-issue502

# Ver cobertura
npm run test:coverage -- billing-coverage-issue502

# Buscar referencias a Stripe
grep -r "stripe" tests/unit/routes/billing-coverage-issue502.test.js

# Buscar referencias a Polar
grep -r "polar\|Polar\|POLAR" tests/unit/routes/billing-coverage-issue502.test.js

# Ver estructura de mocks
grep -A 10 "mockPolar\|mockStripe" tests/unit/routes/billing-coverage-issue502.test.js
```

---

## 📝 NOTAS FINALES

1. **No modificar código de producción** - Solo migrar tests
2. **Mantener misma estructura de tests** - Solo cambiar mocks y variables
3. **Si un test no aplica a Polar** - Marcarlo como `test.skip` con explicación
4. **Validar cada test** después de migrarlo
5. **Documentar cambios** en comentarios si es necesario

---

## ✅ CRITERIOS DE ÉXITO

- [ ] Todos los tests pasan (73/73)
- [ ] Cobertura 100% mantenida
- [ ] Sin errores de linter
- [ ] Sin referencias a Stripe en código (solo comentarios)
- [ ] Variables Polar correctamente configuradas
- [ ] Mocks de Polar funcionando correctamente

---

**¡Buena suerte con la migración! 🚀**
