# ✅ Polar - Configuración Completa

**Todos los Price IDs de Roastr ya están configurados y listos para usar.**

---

## 🎯 Price IDs Configurados

| Plan | Price ID | Precio |
|------|----------|--------|
| **Starter** | `e242580e-41df-4997-aebe-604492249f39` | €5/mes |
| **Pro** | `c1787586-00b7-4790-ba43-1f1e6a60b095` | €12/mes |
| **Plus** | `176df9af-337f-4607-9524-48978eae8bea` | €24/mes |

---

## 📁 Archivos Ya Configurados

### ✅ Página de Test HTML
**Archivo**: `public/test-polar.html`

Los Price IDs ya están configurados en línea 360:
```javascript
const POLAR_PRICE_IDS = {
  starter: 'e242580e-41df-4997-aebe-604492249f39',
  pro: 'c1787586-00b7-4790-ba43-1f1e6a60b095',
  plus: '176df9af-337f-4607-9524-48978eae8bea',
};
```

**URL de acceso**: http://localhost:3000/test-polar.html

---

### ✅ Componente React
**Archivo**: `frontend/src/components/PolarPricingExample.jsx`

Los Price IDs ya están configurados en línea 19:
```javascript
const POLAR_PRICE_IDS = {
  starter: process.env.REACT_APP_POLAR_STARTER_PRICE_ID || 'e242580e-41df-4997-aebe-604492249f39',
  pro: process.env.REACT_APP_POLAR_PRO_PRICE_ID || 'c1787586-00b7-4790-ba43-1f1e6a60b095',
  plus: process.env.REACT_APP_POLAR_PLUS_PRICE_ID || '176df9af-337f-4607-9524-48978eae8bea',
};
```

**Uso**:
```jsx
import PolarPricingExample from './components/PolarPricingExample';

<Route path="/pricing" element={<PolarPricingExample />} />
```

---

### ✅ Variables de Entorno (Opcional)
**Archivo**: `frontend/.env.example`

Si prefieres usar variables de entorno en lugar de hardcodear:
```bash
REACT_APP_POLAR_STARTER_PRICE_ID=e242580e-41df-4997-aebe-604492249f39
REACT_APP_POLAR_PRO_PRICE_ID=c1787586-00b7-4790-ba43-1f1e6a60b095
REACT_APP_POLAR_PLUS_PRICE_ID=176df9af-337f-4607-9524-48978eae8bea
```

**Nota**: No es necesario configurar estas variables. Los componentes ya tienen los IDs como defaults.

---

## 🚀 Probar AHORA (3 opciones)

### Opción 1: Script de Test (Más Rápido)

```bash
# Inicia el backend
npm start

# En otra terminal, ejecuta el script de test
./scripts/test-polar-checkout.sh pro

# O prueba otros planes
./scripts/test-polar-checkout.sh starter
./scripts/test-polar-checkout.sh plus
```

**El script:**
- ✅ Verifica que el servidor esté corriendo
- ✅ Crea un checkout con el plan seleccionado
- ✅ Muestra la respuesta formateada
- ✅ Te da la URL de checkout
- ✅ Opcionalmente abre el navegador

---

### Opción 2: Página HTML de Test

```bash
# 1. Inicia el backend
npm start

# 2. Abre en tu navegador
http://localhost:3000/test-polar.html
```

**Luego:**
1. Ingresa un email (ej: `test@roastr.ai`)
2. Haz clic en cualquier plan
3. Abre la consola del navegador (F12)
4. Serás redirigido a Polar
5. Usa tarjeta test: `4242 4242 4242 4242`
6. Completa el pago
7. Volverás a `/success?checkout_id=...`

---

### Opción 3: cURL Directo

```bash
# Starter Plan
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@roastr.ai",
    "price_id": "e242580e-41df-4997-aebe-604492249f39"
  }'

# Pro Plan
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@roastr.ai",
    "price_id": "c1787586-00b7-4790-ba43-1f1e6a60b095"
  }'

# Plus Plan
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@roastr.ai",
    "price_id": "176df9af-337f-4607-9524-48978eae8bea"
  }'
```

---

## ✅ Verificación Previa

Antes de probar, asegúrate de que:

```bash
# 1. Backend está corriendo
curl http://localhost:3000/health
# Debe devolver: {"status":"ok",...}

# 2. POLAR_ACCESS_TOKEN está configurado
cat .env | grep POLAR_ACCESS_TOKEN
# Debe mostrar: POLAR_ACCESS_TOKEN=polar_oat_...

# 3. Los archivos están actualizados
grep "e242580e-41df-4997-aebe-604492249f39" public/test-polar.html
# Debe encontrar el Price ID
```

---

## 🔄 Flujo de Checkout Completo

```
Usuario hace clic en plan
          ↓
JavaScript llama a /api/checkout con:
  {
    customer_email: "test@roastr.ai",
    price_id: "e242580e-41df-4997-aebe-604492249f39"  ← Starter
  }
          ↓
Backend crea checkout en Polar
          ↓
Backend devuelve:
  {
    success: true,
    checkout: {
      id: "checkout_xxxxx",
      url: "https://polar.sh/checkout/xxxxx",
      ...
    }
  }
          ↓
Redirect a Polar checkout page
          ↓
Usuario completa pago
          ↓
Polar envía webhook a /api/polar/webhook
  event.type: "order.created"
          ↓
Redirect a /success?checkout_id=checkout_xxxxx
          ↓
✅ Pago completado
```

---

## 🧪 Ejemplos de Uso

### CheckoutButton Component

```jsx
import CheckoutButton from './components/CheckoutButton';

// Plan Starter
<CheckoutButton
  priceId="e242580e-41df-4997-aebe-604492249f39"
  planName="Starter"
  customerEmail={user.email}
/>

// Plan Pro
<CheckoutButton
  priceId="c1787586-00b7-4790-ba43-1f1e6a60b095"
  planName="Pro"
  customerEmail={user.email}
/>

// Plan Plus
<CheckoutButton
  priceId="176df9af-337f-4607-9524-48978eae8bea"
  planName="Plus"
  customerEmail={user.email}
/>
```

---

## 📊 Verificar Price IDs en Polar

Para confirmar que estos IDs son correctos:

1. Ve a: https://polar.sh/dashboard/products
2. Haz clic en cada producto
3. Verifica que los IDs coincidan con los configurados arriba

**Nota importante**: Estos deben ser **Price IDs**, no Product IDs. En Polar:
- **Product ID**: Identifica el producto (ej: "Plan Pro")
- **Price ID**: Identifica el precio específico del producto (ej: "€12/mes")

Si tienes múltiples precios por producto (mensual, anual, etc.), asegúrate de usar el Price ID correcto.

---

## 🔍 Troubleshooting

### Error: "Configuration error"

**Causa**: Falta `POLAR_ACCESS_TOKEN` en `.env`

**Solución**:
```bash
# Verifica
cat .env | grep POLAR_ACCESS_TOKEN

# Si falta, agrega
echo "POLAR_ACCESS_TOKEN=polar_oat_tu_token_aqui" >> .env

# Reinicia backend
npm start
```

---

### Error: "Invalid price_id"

**Causa**: El Price ID no existe en Polar o es incorrecto

**Solución**:
1. Ve a https://polar.sh/dashboard/products
2. Haz clic en el producto
3. Copia el **Price ID** (no el Product ID)
4. Actualiza los archivos con el ID correcto

---

### Checkout se crea pero falla al pagar

**Causa**: Posibles problemas con la configuración del producto en Polar

**Solución**:
1. Verifica que el producto esté activo en Polar
2. Verifica que el precio esté configurado correctamente
3. Usa tarjeta de test válida: `4242 4242 4242 4242`

---

## 📝 Próximos Pasos

1. ✅ **Probar cada plan** con el script o la página HTML
2. ✅ **Verificar webhooks** con `node scripts/simulate-polar-webhook.js order.created`
3. ✅ **Implementar lógica de webhook** en `src/routes/polarWebhook.js`
   - Actualizar suscripción del usuario en DB
   - Activar features premium
   - Enviar email de confirmación
4. ✅ **Integrar en tu app React** usando `CheckoutButton.jsx`
5. ✅ **Configurar webhook en producción** cuando despliegues

---

## 🎉 Resumen

**Price IDs configurados en:**
- ✅ `public/test-polar.html`
- ✅ `frontend/src/components/PolarPricingExample.jsx`
- ✅ `frontend/.env.example` (como referencia)
- ✅ `scripts/test-polar-checkout.sh`

**Todo listo para:**
- ✅ Crear checkouts con Polar
- ✅ Recibir pagos
- ✅ Procesar webhooks
- ✅ Integrar en React

**Solo falta:**
- Implementar lógica de webhook para activar suscripciones
- Integrar en tu UI de producción

---

## 📚 Documentación Completa

- **Quick Start**: `docs/POLAR-QUICK-START.md`
- **Frontend**: `docs/POLAR-FRONTEND-INTEGRATION.md`
- **Backend**: `docs/POLAR-INTEGRATION.md`
- **Webhooks**: `docs/POLAR-WEBHOOK-TESTING.md`
- **Test Page**: `docs/TEST-POLAR-PAGE.md`

---

**¡La integración de Polar está 100% configurada con tus Price IDs!** 🚀
