# 💳 Roastr.ai Billing & Stripe Integration

Guía completa para configurar y usar el sistema de facturación con Stripe Checkout, Customer Portal y webhooks.

## 📋 Tabla de Contenidos

- [Planes Disponibles](#planes-disponibles)
- [Configuración Stripe](#configuración-stripe)
- [Variables de Entorno](#variables-de-entorno)
- [Configuración Local](#configuración-local)
- [Testing](#testing)
- [API Endpoints](#api-endpoints)
- [Plan Gating](#plan-gating)
- [Webhooks](#webhooks)
- [Troubleshooting](#troubleshooting)

## 🎯 Planes Disponibles

| Plan | Precio | Roasts/Mes | Plataformas | Features Adicionales |
|------|--------|------------|-------------|---------------------|
| **Free** | €0 | 100 | 1 | Soporte básico |
| **Pro** | €20/mes | 1,000 | 5 | Analíticas avanzadas, soporte prioritario |
| **Creator+** | €50/mes | ∞ ilimitado | ∞ todas | API access, tonos custom, soporte 24/7 |

## ⚙️ Configuración Stripe

### 1. Crear Cuenta Stripe (Test Mode)

1. Ve a [dashboard.stripe.com](https://dashboard.stripe.com)
2. Crea una cuenta o inicia sesión
3. Asegúrate de estar en **Test Mode** (toggle en la esquina superior izquierda)

### 2. Configurar Products y Prices

#### Crear Productos:

**Pro Plan:**
```bash
# Crear producto Pro
curl https://api.stripe.com/v1/products \
  -u sk_test_YOUR_SECRET_KEY: \
  -d name="Roastr.ai Pro" \
  -d description="Plan Pro con 1,000 roasts mensuales"
```

**Creator+ Plan:**
```bash
# Crear producto Creator+
curl https://api.stripe.com/v1/products \
  -u sk_test_YOUR_SECRET_KEY: \
  -d name="Roastr.ai Creator+" \
  -d description="Plan Creator+ con roasts ilimitados"
```

#### Crear Prices con Lookup Keys:

**Pro Monthly Price:**
```bash
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_SECRET_KEY: \
  -d product=prod_YOUR_PRO_PRODUCT_ID \
  -d unit_amount=2000 \
  -d currency=eur \
  -d recurring[interval]=month \
  -d lookup_key=pro_monthly
```

**Creator+ Monthly Price:**
```bash
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_SECRET_KEY: \
  -d product=prod_YOUR_CREATOR_PRODUCT_ID \
  -d unit_amount=5000 \
  -d currency=eur \
  -d recurring[interval]=month \
  -d lookup_key=creator_plus_monthly
```

### 3. Configurar Webhooks

1. Ve a **Developers > Webhooks** en tu dashboard de Stripe
2. Clic en **Add endpoint**
3. URL del endpoint: `https://tu-dominio.com/webhooks/stripe`
   - Para local: `https://your-ngrok-url.ngrok.io/webhooks/stripe`
4. Selecciona estos eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copia el **Webhook Signing Secret** (empieza con `whsec_`)

### 4. Customer Portal Configuration

1. Ve a **Settings > Billing > Customer portal**
2. Activa **Allow customers to...**:
   - ✅ Update payment methods
   - ✅ View billing history
   - ✅ Download invoices
   - ✅ Cancel subscriptions
   - ✅ Update subscriptions
3. Configure **Business information** y **Privacy policy URL**

## 🔧 Variables de Entorno

Añade estas variables a tu archivo `.env`:

```bash
# =============================================================================
# Stripe Billing Configuration (Test Mode)
# =============================================================================

# Stripe API Keys (Test Mode - starts with sk_test_)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price Lookup Keys (configure these in Stripe Dashboard)
STRIPE_PRICE_LOOKUP_PRO=pro_monthly
STRIPE_PRICE_LOOKUP_CREATOR=creator_plus_monthly

# Stripe Checkout URLs
STRIPE_SUCCESS_URL=http://localhost:3000/billing-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:3000/billing-cancelled.html
STRIPE_PORTAL_RETURN_URL=http://localhost:3000/billing.html

# Frontend URL for OAuth redirects
FRONTEND_URL=http://localhost:3000
```

### URLs para Producción

```bash
STRIPE_SUCCESS_URL=https://roastr.ai/billing-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://roastr.ai/billing-cancelled.html
STRIPE_PORTAL_RETURN_URL=https://roastr.ai/billing.html
```

## 🚀 Configuración Local

### 1. Instalar Dependencias

```bash
npm install stripe
```

### 2. Ejecutar Migración de Base de Datos

```bash
# Ejecutar en Supabase SQL Editor
cat database/migrations/003_user_subscriptions.sql
```

### 3. Configurar ngrok para Webhooks (Desarrollo)

```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto local
ngrok http 3000

# Usar la URL HTTPS generada para el webhook endpoint
```

### 4. Iniciar Servidor

```bash
npm start
```

## 🧪 Testing

### Tests Unitarios

```bash
# Ejecutar todos los tests de billing
npm test -- tests/unit/routes/billing.test.js
npm test -- tests/unit/middleware/requirePlan.test.js
npm test -- tests/unit/frontend/billing.test.js

# Coverage completo
npm run test:coverage
```

### Test de Flujo Completo

1. **Ir a billing page:**
   ```
   http://localhost:3000/billing.html
   ```

2. **Seleccionar plan Pro o Creator+**

3. **Usar tarjetas de prueba:**
   ```
   Éxito: 4242 4242 4242 4242
   Error:  4000 0000 0000 0002
   3D Secure: 4000 0000 0000 3220
   ```

4. **Verificar webhook processing:**
   ```bash
   # Revisar logs del servidor
   DEBUG=true npm start
   ```

5. **Probar Customer Portal:**
   - Completar checkout
   - Clic en "Gestionar Suscripción" 
   - Cambiar plan, cancelar, etc.

## 📡 API Endpoints

### Billing Management

#### `GET /api/billing/plans`
Obtiene lista de planes disponibles.

```javascript
// Response
{
  "success": true,
  "data": {
    "plans": {
      "free": { "name": "Free", "price": 0, "features": [...] },
      "pro": { "name": "Pro", "price": 2000, "lookupKey": "pro_monthly" },
      "creator_plus": { "name": "Creator+", "price": 5000, "lookupKey": "creator_plus_monthly" }
    }
  }
}
```

#### `POST /api/billing/create-checkout-session`
Crea sesión de Stripe Checkout.

```javascript
// Request
{
  "lookupKey": "pro_monthly"
}

// Response
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/pay/cs_...",
    "sessionId": "cs_..."
  }
}
```

#### `POST /api/billing/create-portal-session`
Abre Stripe Customer Portal.

```javascript
// Response
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/session/bps_..."
  }
}
```

#### `GET /api/billing/subscription`
Obtiene suscripción actual del usuario.

```javascript
// Response
{
  "success": true,
  "data": {
    "subscription": {
      "user_id": "uuid",
      "plan": "pro",
      "status": "active",
      "stripe_customer_id": "cus_...",
      "current_period_end": "2024-02-01T00:00:00.000Z"
    },
    "planConfig": {
      "name": "Pro",
      "price": 2000,
      "features": [...]
    }
  }
}
```

### Webhook Endpoint

#### `POST /webhooks/stripe`
Procesa eventos de Stripe.

**Eventos soportados:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## 🛡️ Plan Gating

### Usar Middleware requirePlan

```javascript
const { requirePlan } = require('./src/middleware/requirePlan');

// Requiere plan Pro o superior
app.use('/api/advanced-roasts', requirePlan('pro'));

// Requiere plan específico
app.use('/api/api-access', requirePlan(['creator_plus']));

// Requiere feature específico
app.use('/api/analytics', requirePlan('pro', { feature: 'analytics' }));
```

### Verificar Límites de Uso

```javascript
const { checkRoastLimit } = require('./src/middleware/requirePlan');

// Verificar antes de generar roast
const usage = await checkRoastLimit(userId, 1);

if (!usage.allowed) {
    return res.status(403).json({
        error: `Límite excedido: ${usage.current}/${usage.limit}`,
        upgradeUrl: '/billing.html'
    });
}
```

### Plan Limits Configuration

```javascript
const PLAN_LIMITS = {
    free: {
        maxPlatforms: 1,
        maxRoastsPerMonth: 100,
        features: ['basic_roasts']
    },
    pro: {
        maxPlatforms: 5, 
        maxRoastsPerMonth: 1000,
        features: ['basic_roasts', 'advanced_tones', 'analytics']
    },
    creator_plus: {
        maxPlatforms: -1, // unlimited
        maxRoastsPerMonth: -1, // unlimited
        features: ['basic_roasts', 'advanced_tones', 'analytics', 'api_access']
    }
};
```

## 🎣 Webhooks

### Eventos y Acciones

| Evento Stripe | Acción en DB | Descripción |
|---------------|--------------|-------------|
| `checkout.session.completed` | Crear/actualizar suscripción | Usuario completa pago inicial |
| `customer.subscription.updated` | Actualizar plan/status | Cambio de plan, renovación |
| `customer.subscription.deleted` | Reset a plan Free | Cancelación definitiva |
| `invoice.payment_succeeded` | Status → active | Pago exitoso |
| `invoice.payment_failed` | Status → past_due | Fallo en renovación |

### Debugging Webhooks

```bash
# Ver logs detallados
DEBUG=true npm start

# Test webhook localmente con Stripe CLI
stripe listen --forward-to localhost:3000/webhooks/stripe
stripe trigger checkout.session.completed
```

### Webhook Security

- ✅ Verificación de firma con `STRIPE_WEBHOOK_SECRET`
- ✅ Idempotencia para eventos duplicados
- ✅ Validación de metadata requerida
- ✅ Manejo de errores sin exponer info sensible

## 🔍 Troubleshooting

### Problemas Comunes

#### 1. "Invalid lookup key"
```bash
# Verificar que el lookup key existe en Stripe
stripe prices list --lookup-keys pro_monthly
```

#### 2. "Webhook signature verification failed"
```bash
# Verificar STRIPE_WEBHOOK_SECRET
echo $STRIPE_WEBHOOK_SECRET
# Debe empezar con 'whsec_'
```

#### 3. "No active subscription found"
```bash
# Verificar en base de datos
SELECT * FROM user_subscriptions WHERE user_id = 'user-uuid';
```

#### 4. "Customer not found in Stripe"
```bash
# Revisar logs para customer ID
# Recrear customer si es necesario
```

### Database Issues

#### Reset suscripción a Free
```sql
UPDATE user_subscriptions 
SET plan = 'free', 
    status = 'active',
    stripe_subscription_id = NULL 
WHERE user_id = 'user-uuid';
```

#### Ver todas las suscripciones
```sql
SELECT u.email, s.plan, s.status, s.current_period_end
FROM user_subscriptions s
JOIN users u ON u.id = s.user_id
ORDER BY s.updated_at DESC;
```

### Logs Importantes

```bash
# Errores de Stripe API
grep "Stripe.*Error" logs/app.log

# Webhooks procesados
grep "Stripe webhook" logs/app.log

# Problemas de plan gating
grep "Plan.*required" logs/app.log
```

## 🚀 Deploy en Producción

### 1. Variables de Entorno Producción

```bash
# Usar claves LIVE (sk_live_)
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret

# URLs de producción
STRIPE_SUCCESS_URL=https://roastr.ai/billing-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://roastr.ai/billing-cancelled.html
STRIPE_PORTAL_RETURN_URL=https://roastr.ai/billing.html
```

### 2. Configurar Webhook Live

1. Cambiar a **Live mode** en Stripe Dashboard
2. Crear nuevo webhook endpoint con URL de producción
3. Seleccionar mismos eventos que en test mode
4. Copiar nuevo webhook secret para producción

### 3. Testing en Live Mode

- ⚠️ Usar tarjetas reales (cobros reales)
- ✅ Probar con cantidades pequeñas primero
- ✅ Verificar webhooks funcionan correctamente
- ✅ Confirmar Customer Portal configurado

## 📞 Soporte

- **Stripe Docs:** [stripe.com/docs](https://stripe.com/docs)
- **Webhook Testing:** [stripe.com/docs/webhooks/test](https://stripe.com/docs/webhooks/test)
- **Dashboard:** [dashboard.stripe.com](https://dashboard.stripe.com)

## 🔒 Seguridad

- ✅ Nunca commitear claves privadas al repositorio
- ✅ Usar variables de entorno para todas las claves
- ✅ Verificar firmas de webhooks siempre
- ✅ Logs sin información sensible
- ✅ HTTPS requerido para webhooks en producción