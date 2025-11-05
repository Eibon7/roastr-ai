# Test Polar - Página de Prueba

Página HTML estática para probar la integración de Polar sin necesidad de usar React.

## 🚀 Acceso Rápido

```
http://localhost:3000/test-polar.html
```

---

## 📋 Setup (2 pasos)

### 1. Obtén tus Price IDs de Polar

1. Ve a https://polar.sh/dashboard/products
2. Crea tus productos (Starter, Pro, Plus)
3. Copia los **Price IDs** (empiezan con `price_`)

### 2. Edita el archivo HTML

Abre `public/test-polar.html` y reemplaza los Price IDs en línea ~143:

```javascript
const POLAR_PRICE_IDS = {
  starter: 'price_tu_starter_id_aqui',  // ← Cambia esto
  pro: 'price_tu_pro_id_aqui',          // ← Cambia esto
  plus: 'price_tu_plus_id_aqui',        // ← Cambia esto
};
```

---

## 🧪 Cómo Probar

### Paso 1: Inicia el backend

```bash
npm start
```

Verifica que esté corriendo:
```bash
curl http://localhost:3000/health
# Debería devolver: {"status":"ok",...}
```

### Paso 2: Abre la página de test

Abre en tu navegador:
```
http://localhost:3000/test-polar.html
```

### Paso 3: Completa el flujo

1. **Ingresa un email de test** (ej: `test@roastr.ai`)
2. **Haz clic en un botón** (ej: "Suscribirme al Pro")
3. **Revisa la consola del navegador** (F12 → Console)
   - Verás logs detallados del proceso
4. **Serás redirigido a Polar** para completar el pago
5. **Usa tarjeta de test**: `4242 4242 4242 4242` (cualquier fecha futura, cualquier CVC)
6. **Completa el pago**
7. **Serás redirigido** a: `http://localhost:3000/success?checkout_id=...`

---

## 🔍 Logs de Consola

Cuando hagas clic en un botón, verás en la consola:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 [Polar Test] Iniciando checkout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Datos del checkout:
  Plan: pro
  Email: test@roastr.ai
  Price ID: price_xxxxx
📡 Enviando request a /api/checkout...
📥 Response status: 200
📦 Response data: {...}
✅ Checkout creado exitosamente!
🔗 Checkout URL: https://polar.sh/checkout/...
🆔 Checkout ID: checkout_xxxxx

🌐 Redirigiendo a Polar en 1 segundo...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎨 Características de la Página

✅ **Diseño moderno** con gradientes y animaciones
✅ **Responsive** - funciona en móvil y desktop
✅ **Loading states** - spinner mientras se crea el checkout
✅ **Validación de email** - verifica que sea válido
✅ **Logs detallados** - toda la información en consola
✅ **Error handling** - mensajes claros si algo falla
✅ **Badge "Popular"** en el plan Pro

---

## 🐛 Troubleshooting

### Error: "No se recibió URL de checkout"

**Causa:** El backend no está devolviendo `checkout.url`

**Solución:**
```bash
# Verifica que el backend tenga POLAR_ACCESS_TOKEN
cat .env | grep POLAR_ACCESS_TOKEN

# Verifica el endpoint directamente
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com","price_id":"price_xxxxx"}'
```

### Error: "Failed to fetch"

**Causa:** Backend no está corriendo

**Solución:**
```bash
# Inicia el backend
npm start

# Verifica que esté en puerto 3000
curl http://localhost:3000/health
```

### Error: "Configuration error"

**Causa:** Falta `POLAR_ACCESS_TOKEN` en `.env`

**Solución:**
```bash
# Agrega a .env
echo "POLAR_ACCESS_TOKEN=polar_oat_tu_token_aqui" >> .env

# Reinicia el backend
npm start
```

### No pasa nada al hacer clic

**Causa:** Price IDs no reemplazados o inválidos

**Solución:**

1. Abre `public/test-polar.html`
2. Busca `const POLAR_PRICE_IDS`
3. Reemplaza `price_starter_xxxxx` con tus Price IDs reales
4. Recarga la página (Ctrl+R o Cmd+R)

---

## 📝 Modificar la Página

### Cambiar los precios

Edita las líneas de precio en el HTML:

```html
<div class="price">5€</div>   <!-- Cambia el número aquí -->
<div class="period">por mes</div>
```

### Cambiar las descripciones

Edita los textos dentro de `<p>`:

```html
<p>Tu descripción personalizada del plan</p>
```

### Cambiar colores/tema

Edita las variables CSS al inicio:

```css
:root {
  --accent: #8b5cf6;        /* Color principal (púrpura) */
  --accent-hover: #9a6eff;  /* Color hover */
  --bg: #0d0d10;            /* Fondo oscuro */
  --text: #f9f9fb;          /* Texto claro */
}
```

---

## 🔄 Flujo Completo

```
Usuario visita /test-polar.html
          ↓
Ingresa email + hace clic en plan
          ↓
JavaScript llama a POST /api/checkout
  {
    customer_email: "test@roastr.ai",
    price_id: "price_xxxxx",
    metadata: { plan: "pro" }
  }
          ↓
Backend crea checkout en Polar
          ↓
Backend devuelve checkout.url
          ↓
Página redirige a Polar checkout
          ↓
Usuario completa pago con tarjeta test
          ↓
Polar redirige a /success?checkout_id=...
          ↓
Página de éxito se muestra ✅
```

---

## 📊 Comparación con React

| Aspecto | HTML Estático | React (CheckoutButton) |
|---------|---------------|------------------------|
| **Setup** | Solo cambiar Price IDs | Requiere componente + Auth |
| **Rapidez** | ⚡ Instantáneo | Requiere build |
| **Flexibilidad** | Limitada | Alta |
| **Para testing** | ✅ Perfecto | Overkill |
| **Para producción** | ❌ No recomendado | ✅ Recomendado |

**Conclusión:** Usa esta página HTML para **testing rápido**. Para producción, usa los componentes React (`CheckoutButton.jsx`).

---

## 🚀 Siguiente Paso

Una vez que el flujo funcione aquí:

1. ✅ Confirma que el checkout se crea correctamente
2. ✅ Confirma que el pago funciona en Polar
3. ✅ Confirma que el webhook recibe `order.created`
4. ➡️ **Integra en tu app React** usando `CheckoutButton.jsx`

Ver: [POLAR-FRONTEND-INTEGRATION.md](./POLAR-FRONTEND-INTEGRATION.md)

---

## 📁 Ubicación del Archivo

```
/roastr-ai/
└── public/
    └── test-polar.html  ← Aquí está el archivo
```

Accesible en: `http://localhost:3000/test-polar.html`

---

## ✅ Checklist

Antes de probar, verifica:

- [ ] Backend corriendo (`npm start`)
- [ ] `POLAR_ACCESS_TOKEN` en `.env`
- [ ] Price IDs reemplazados en `test-polar.html`
- [ ] Email de test ingresado en la página
- [ ] Consola del navegador abierta (F12)

**¡Listo para probar!** 🎉
