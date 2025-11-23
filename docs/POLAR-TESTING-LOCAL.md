# Testing Polar en tu Máquina Local

Guía completa para probar el flujo de checkout de Polar en tu entorno local.

---

## 🔄 Cómo Funciona el Flujo

```
Tu navegador
     ↓
http://localhost:3000/test-polar.html
     ↓
Usuario hace clic en "Suscribirme"
     ↓
POST /api/checkout (tu backend)
     ↓
Polar crea checkout
     ↓
Redirect a: https://polar.sh/checkout/xxxxx
     ↓
Usuario completa pago en Polar
     ↓
Polar redirige de vuelta a:
http://localhost:3000/success.html?checkout_id={ID}
     ↓
✅ Tu página de éxito se muestra
```

**Importante:**

- ✅ **Usas TU propia página de success** (no la de Polar)
- ✅ Polar solo maneja el pago, luego te devuelve el control
- ✅ La página `/success.html` es la que creamos con tu diseño

---

## 🚀 Cómo Probarlo en Tu Máquina

### Paso 1: Inicia el backend

```bash
# En la raíz del proyecto
npm start
```

**Verás algo como:**

```
🔥 Roastr.ai API escuchando en http://localhost:3000
```

### Paso 2: Abre la página de test en tu navegador

```
http://localhost:3000/test-polar.html
```

### Paso 3: Completa el flujo

1. **Ingresa un email** (ej: `tu-email@ejemplo.com`)
2. **Haz clic** en cualquier plan (Starter, Pro o Plus)
3. **Observa:**
   - Se crea el checkout (loading state)
   - Serás redirigido a Polar (https://polar.sh/checkout/...)
4. **En Polar:**
   - Completa el formulario
   - Usa tarjeta de test: `4242 4242 4242 4242`
   - Fecha: Cualquier fecha futura
   - CVC: Cualquier 3 dígitos
5. **Después del pago:**
   - Polar te redirige automáticamente a: `http://localhost:3000/success.html?checkout_id=xxxxx`
   - ✅ Verás tu página de éxito con el diseño que me pasaste

---

## 🎨 Páginas Disponibles

### 1. Página de Planes (Test)

**URL:** `http://localhost:3000/test-polar.html`

**Características:**

- Diseño con tus estilos (oscuro, gradientes)
- 3 planes: Starter, Pro, Plus
- Ya configurado con tus Price IDs
- Loading states
- Logs en consola

**Para probar:**

```bash
# 1. Inicia backend
npm start

# 2. Abre en navegador
open http://localhost:3000/test-polar.html
# o en Linux
xdg-open http://localhost:3000/test-polar.html
```

---

### 2. Página de Éxito

**URL:** `http://localhost:3000/success.html?checkout_id=test_123`

**Características:**

- Diseño con tus estilos (animación check)
- Muestra el Checkout ID
- Botones: "Ir al panel" y "Ver suscripción"
- Info box con confirmación
- Logs en consola

**Para probar directamente:**

```bash
# Abre en navegador (sin hacer checkout real)
open http://localhost:3000/success.html?checkout_id=test_ejemplo_123
```

---

## 🧪 Testing con Scripts

### Opción A: Script de Test Automático

```bash
# Probar plan Pro
./scripts/test-polar-checkout.sh pro

# Probar plan Starter
./scripts/test-polar-checkout.sh starter

# Probar plan Plus
./scripts/test-polar-checkout.sh plus
```

**El script:**

- ✅ Verifica que el backend esté corriendo
- ✅ Crea un checkout con Polar
- ✅ Te muestra la URL de checkout
- ✅ Te pregunta si quieres abrirla en el navegador

**Salida esperada:**

```
✅ Checkout creado exitosamente!

🔗 Checkout URL:
  https://polar.sh/checkout/polar_c_xxxxx

🆔 Checkout ID:
  xxxxx-xxxxx-xxxxx

¿Quieres abrir la URL en el navegador? (y/n)
```

---

### Opción B: cURL Manual

```bash
# Crear checkout para plan Pro
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@ejemplo.com",
    "price_id": "c1787586-00b7-4790-ba43-1f1e6a60b095"
  }'
```

**Respuesta esperada:**

```json
{
  "success": true,
  "checkout": {
    "id": "xxxxx",
    "url": "https://polar.sh/checkout/polar_c_xxxxx",
    "customer_email": "test@ejemplo.com",
    "price_id": "ddeeb24f-7cab-4c35-b5f4-4767be436dfa",
    "status": "open"
  }
}
```

Luego abre el `checkout.url` en tu navegador.

---

## 🐛 Troubleshooting

### "No puedo acceder a localhost:3000"

**Causa:** El backend no está corriendo.

**Solución:**

```bash
# Verifica si hay proceso corriendo
curl http://localhost:3000/health

# Si no responde, inicia el backend
npm start

# Espera 5 segundos y prueba de nuevo
curl http://localhost:3000/health
# Debería devolver: {"status":"ok",...}
```

---

### "La página test-polar.html no carga"

**Causa:** Ruta incorrecta o backend no iniciado.

**Solución:**

```bash
# 1. Verifica que el archivo existe
ls -la public/test-polar.html

# 2. Verifica que el backend está corriendo
curl http://localhost:3000/health

# 3. Prueba con la URL completa
open http://localhost:3000/test-polar.html
```

---

### "Después del pago no vuelvo a mi página"

**Causa:** `POLAR_SUCCESS_URL` incorrecta en `.env`

**Solución:**

1. Verifica el `.env`:

```bash
cat .env | grep POLAR_SUCCESS_URL
# Debe mostrar: POLAR_SUCCESS_URL=http://localhost:3000/success.html?checkout_id={CHECKOUT_ID}
```

2. Si está mal, corrígelo:

```bash
# Abre .env y cambia la línea a:
POLAR_SUCCESS_URL=http://localhost:3000/success.html?checkout_id={CHECKOUT_ID}
```

3. Reinicia el backend:

```bash
# Detén el proceso (Ctrl+C)
# Reinicia
npm start
```

---

### "El checkout falla al crearse"

**Posibles causas:**

**1. Falta `POLAR_ACCESS_TOKEN`**

```bash
# Verifica
cat .env | grep POLAR_ACCESS_TOKEN

# Si no está, agrega:
echo "POLAR_ACCESS_TOKEN=tu_token_aqui" >> .env

# Reinicia backend
npm start
```

**2. Price IDs incorrectos**

Verifica que los IDs en `test-polar.html` sean correctos:

```bash
grep "POLAR_PRICE_IDS" public/test-polar.html
```

Deben ser:

- Starter: `e242580e-41df-4997-aebe-604492249f39`
- Pro: `c1787586-00b7-4790-ba43-1f1e6a60b095`
- Plus: `176df9af-337f-4607-9524-48978eae8bea`

---

## 📊 Verificación Completa

Ejecuta estos comandos para verificar que todo está bien:

```bash
# 1. Backend corriendo
curl -s http://localhost:3000/health | jq '.'

# 2. Página de test existe
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/test-polar.html
# Debe devolver: 200

# 3. Página de success existe
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/success.html
# Debe devolver: 200

# 4. Endpoint de checkout funciona
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@ejemplo.com","price_id":"c1787586-00b7-4790-ba43-1f1e6a60b095"}' | jq '.'
# Debe devolver: {"success":true, "checkout":{...}}
```

Si todos devuelven resultados correctos, ¡todo está funcionando! ✅

---

## 🎯 Flujo de Testing Recomendado

### Testing Rápido (2 minutos)

```bash
# 1. Inicia backend
npm start

# 2. En otro terminal, ejecuta script
./scripts/test-polar-checkout.sh pro

# 3. Responde 'y' para abrir en navegador
# 4. Completa el pago con: 4242 4242 4242 4242
# 5. Verifica que vuelves a /success.html
```

---

### Testing Completo (5 minutos)

```bash
# 1. Inicia backend
npm start

# 2. Abre página de test
open http://localhost:3000/test-polar.html

# 3. Prueba los 3 planes:
#    - Starter (€5/mes)
#    - Pro (€12/mes)
#    - Plus (€24/mes)

# 4. Para cada uno:
#    - Haz clic en el botón
#    - Verifica redirect a Polar
#    - Completa pago
#    - Verifica redirect a success.html
#    - Verifica que el checkout_id aparece en la URL

# 5. Verifica logs de webhook (opcional)
node scripts/simulate-polar-webhook.js order.created
# Revisa logs del backend
```

---

## 🔗 URLs de Referencia

| Página             | URL                                                 | Descripción                            |
| ------------------ | --------------------------------------------------- | -------------------------------------- |
| **Backend Health** | http://localhost:3000/health                        | Verifica que el backend está corriendo |
| **Test Polar**     | http://localhost:3000/test-polar.html               | Página para probar checkout            |
| **Success**        | http://localhost:3000/success.html?checkout_id=test | Página de éxito post-pago              |
| **Dashboard**      | http://localhost:3000/dashboard                     | Tu dashboard principal                 |

---

## 📝 Notas Importantes

1. **Localhost vs Producción:**
   - En local: `http://localhost:3000/success.html`
   - En producción: `https://app.roastr.ai/success.html`
   - Cambia `POLAR_SUCCESS_URL` en `.env` según el entorno

2. **Tarjetas de Test:**
   - Éxito: `4242 4242 4242 4242`
   - Fallo: `4000 0000 0000 0002`
   - Requiere 3D Secure: `4000 0027 6000 3184`

3. **Webhooks:**
   - En local: Usa ngrok o simula con `scripts/simulate-polar-webhook.js`
   - En producción: Configura en Polar dashboard

4. **Price IDs:**
   - Los que te pasé YA están configurados
   - No necesitas cambiar nada
   - Polar los convierte automáticamente al Price ID correcto

---

## ✅ Checklist Final

Antes de considerar el testing completo:

- [ ] Backend inicia sin errores
- [ ] `/health` devuelve status ok
- [ ] `/test-polar.html` carga correctamente
- [ ] Click en botón crea checkout
- [ ] Redirect a Polar funciona
- [ ] Pago se completa en Polar
- [ ] Redirect a `/success.html` funciona
- [ ] Checkout ID aparece en URL
- [ ] Página de success muestra diseño correcto
- [ ] Botones "Ir al panel" funcionan
- [ ] Script de test funciona

---

**¡Listo para probar en tu máquina!** 🚀

Si tienes algún problema, revisa la sección de Troubleshooting arriba.
