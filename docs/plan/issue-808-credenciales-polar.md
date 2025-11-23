# Credenciales Polar para Issue #808

**Issue:** #808 - Migrar tests de billing de Stripe a Polar  
**Fecha:** 2025-11-17

---

## 📋 RESUMEN EJECUTIVO

Para completar la migración de tests de billing de Stripe a Polar, **NO necesitas credenciales reales de producción**. Los tests pueden usar **mocks** o **valores de test/sandbox**.

---

## 🔑 CREDENCIALES POLAR (Para Tests)

### Opción A: Mocks (Recomendado para Tests)

**No necesitas credenciales reales** - Los tests pueden usar mocks del SDK de Polar:

```javascript
// En tests, puedes mockear el cliente Polar
const mockPolarClient = {
  checkouts: {
    create: jest.fn(),
    get: jest.fn()
  },
  orders: {
    list: jest.fn()
  },
  subscriptions: {
    // ... métodos mockeados
  }
};
```

**Ventajas:**

- ✅ No requiere credenciales
- ✅ Tests rápidos y determinísticos
- ✅ No consume recursos de Polar
- ✅ No depende de conectividad externa

---

### Opción B: Sandbox/Test Mode (Si quieres tests más realistas)

Si prefieres usar el modo sandbox de Polar para tests más realistas, necesitarías:

#### Variables de Entorno Requeridas:

**⚠️ IMPORTANTE:** El código usa `POLAR_*_PRICE_ID` pero el `.env` tiene `POLAR_*_PRODUCT_ID`. Necesitas actualizar el `.env` o el código para que coincidan.

**Variables que el código espera:**

```bash
# Token de acceso a Polar API (sandbox/test)
POLAR_ACCESS_TOKEN=polar_test_xxxxxxxxxxxxx

# Price IDs de Polar (configurados en dashboard de Polar)
# ⚠️ El código usa PRICE_ID, pero .env tiene PRODUCT_ID
POLAR_STARTER_PRICE_ID=price_xxxxxxxxxxxxx
POLAR_PRO_PRICE_ID=price_xxxxxxxxxxxxx
POLAR_PLUS_PRICE_ID=price_xxxxxxxxxxxxx

# URLs de checkout
POLAR_SUCCESS_URL=http://localhost:3000/success?checkout_id={CHECKOUT_ID}

# Webhook secret (opcional pero recomendado)
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Lista de product IDs permitidos (seguridad) - usado en checkout.js
# Issue #887: Cambiado de POLAR_ALLOWED_PRICE_IDS a POLAR_ALLOWED_PRODUCT_IDS
POLAR_ALLOWED_PRODUCT_IDS=prod_xxx,prod_yyy,prod_zzz
# Legacy (fallback): POLAR_ALLOWED_PRICE_IDS=price_xxx,price_yyy,price_zzz
```

**Variables que están en tu `.env` actual (Issue #887 - Actualizado):**

```bash
POLAR_ACCESS_TOKEN=*** (ya configurado)
POLAR_WEBHOOK_SECRET=*** (ya configurado)
POLAR_SUCCESS_URL=*** (ya configurado)
POLAR_STARTER_PRODUCT_ID=*** (✅ Correcto - Issue #887)
POLAR_PRO_PRODUCT_ID=*** (✅ Correcto - Issue #887)
POLAR_PLUS_PRODUCT_ID=*** (✅ Correcto - Issue #887)
POLAR_ALLOWED_PRODUCT_IDS=*** (✅ Nuevo - Issue #887, opcional)
```

**Nota:** Issue #887 migró de `POLAR_*_PRICE_ID` a `POLAR_*_PRODUCT_ID`. Ver `docs/plan/issue-887-migration-guide.md` para detalles.

#### Cómo Obtenerlas:

1. **POLAR_ACCESS_TOKEN:**
   - Ir a: https://polar.sh/dashboard/settings/account
   - Sección "API Tokens"
   - Crear nuevo token con permisos de lectura/escritura
   - Usar token de **test/sandbox** (no producción)

2. **POLAR\_\*\_PRICE_ID:**
   - Ir a: https://polar.sh/dashboard/products
   - Crear productos/precios para cada plan (Starter, Pro, Plus)
   - Copiar los **Price IDs** (no Product IDs) generados
   - ⚠️ **ACCIÓN NECESARIA:** Actualizar `.env` para usar `POLAR_*_PRICE_ID` en lugar de `POLAR_*_PRODUCT_ID`
   - Configurarlos en `.env` como `POLAR_STARTER_PRICE_ID`, `POLAR_PRO_PRICE_ID`, `POLAR_PLUS_PRICE_ID`

3. **POLAR_WEBHOOK_SECRET:**
   - Ir a: https://polar.sh/dashboard/settings/webhooks
   - Configurar webhook endpoint
   - Copiar el secret generado

4. **POLAR_SUCCESS_URL / POLAR_CANCEL_URL:**
   - URLs locales para desarrollo: `http://localhost:3000/success`
   - URLs de staging para tests E2E: `https://staging.roastr.ai/success`

---

## 🎯 RECOMENDACIÓN PARA ISSUE #808

### Estrategia Híbrida (Recomendada):

**1. Tests Unitarios → Mocks** ✅

- Usar mocks del SDK de Polar
- No requiere credenciales
- Tests rápidos y aislados

**2. Tests de Integración → Sandbox (Opcional)**

- Si quieres validar integración real
- Usar credenciales de sandbox/test
- Marcar como tests opcionales (skip si no hay credenciales)

**3. Tests E2E → Sandbox (Opcional)**

- Solo si necesitas validar flujo completo
- Requiere credenciales de sandbox
- Puede ser marcado como "opcional" o "slow"

---

## 📝 IMPLEMENTACIÓN SUGERIDA

### Estructura de Tests:

```javascript
// tests/unit/routes/billing-polar.test.js

describe('Billing Polar Integration', () => {
  let mockPolarClient;

  beforeEach(() => {
    // Mock Polar client
    mockPolarClient = {
      checkouts: {
        create: jest.fn(),
        get: jest.fn()
      }
      // ... otros métodos
    };

    // Inyectar mock en BillingInterface
    process.env.POLAR_ACCESS_TOKEN = 'mock_token';
  });

  describe('Checkout Session Creation', () => {
    test('should create checkout session with Polar', async () => {
      // Test con mock
      mockPolarClient.checkouts.create.mockResolvedValue({
        id: 'checkout_123',
        url: 'https://polar.sh/checkout/123'
      });

      // ... assertions
    });
  });

  // Tests de integración (opcionales, requieren credenciales)
  describe.skip('Integration Tests (Requires Polar Sandbox)', () => {
    test('should create real checkout session', async () => {
      if (!process.env.POLAR_ACCESS_TOKEN || process.env.POLAR_ACCESS_TOKEN === 'mock_token') {
        return; // Skip si no hay credenciales reales
      }

      // Test con Polar sandbox real
      // ...
    });
  });
});
```

---

## ✅ CHECKLIST DE MIGRACIÓN

### Sin Credenciales (Solo Mocks):

- [x] Crear mocks del SDK Polar
- [ ] Migrar tests de Stripe a Polar (usando mocks)
- [ ] Actualizar `BillingInterface` para usar Polar SDK
- [ ] Actualizar variables de entorno (STRIPE*\* → POLAR*\*)
- [ ] Actualizar mocks de webhook events
- [ ] Validar que todos los tests pasan
- [ ] Verificar cobertura 100%

### Con Credenciales Sandbox (Opcional):

- [ ] Obtener `POLAR_ACCESS_TOKEN` de sandbox
- [ ] Crear productos/precios en Polar dashboard
- [ ] Configurar `POLAR_*_PRICE_ID` en `.env`
- [ ] Configurar `POLAR_WEBHOOK_SECRET`
- [ ] Añadir tests de integración opcionales
- [ ] Documentar cómo obtener credenciales

---

## 🚀 CONCLUSIÓN

**✅ BUENAS NOTICIAS:** Ya tienes credenciales de Polar configuradas en tu `.env`:

- ✅ `POLAR_ACCESS_TOKEN` - Configurado
- ✅ `POLAR_WEBHOOK_SECRET` - Configurado
- ✅ `POLAR_SUCCESS_URL` - Configurado
- ✅ `POLAR_STARTER_PRODUCT_ID`, `POLAR_PRO_PRODUCT_ID`, `POLAR_PLUS_PRODUCT_ID` - Configurados

**✅ ACTUALIZADO:** El código ha sido actualizado para usar `PRODUCT_ID` (Issue #808):

- ✅ Código actualizado: `POLAR_STARTER_PRODUCT_ID`, `POLAR_PRO_PRODUCT_ID`, `POLAR_PLUS_PRODUCT_ID`
- ✅ `.env` ya tiene: `POLAR_STARTER_PRODUCT_ID`, `POLAR_PRO_PRODUCT_ID`, `POLAR_PLUS_PRODUCT_ID`
- ✅ **Consistencia lograda:** Código y `.env` ahora coinciden

**Para completar la issue #808:**

- ✅ Ya tienes credenciales, puedes usar sandbox real
- ✅ O usar mocks para tests unitarios (más rápido)
- ✅ O ambos: mocks para unitarios + sandbox para integración

**Mi recomendación:**

1. Primero arreglar la inconsistencia de nombres (`.env` → `PRICE_ID`)
2. Luego completar migración con mocks (tests unitarios)
3. Opcionalmente añadir tests de integración con sandbox real

---

## 📚 REFERENCIAS

- **Polar SDK Docs:** https://docs.polar.sh/api-reference
- **Polar Dashboard:** https://polar.sh/dashboard
- **Código actual:** `src/routes/checkout.js`, `src/routes/polarWebhook.js`
- **BillingInterface:** `src/services/billingInterface.js` (tiene TODOs de Polar)
