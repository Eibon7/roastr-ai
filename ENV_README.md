# 🔧 Sistema de Variables de Entorno

Documentación completa del sistema robusto de carga y validación de variables de entorno para Roastr.ai.

## 📋 Resumen

Este sistema detecta automáticamente el entorno (`development` vs `production`) y carga las variables correspondientes:

- **Desarrollo**: `.env.local` (automático cuando `NODE_ENV=development`)
- **Producción**: `.env.production` (automático cuando `NODE_ENV=production`)  
- **Cloud (Vercel/Netlify)**: Variables del sistema (automático cuando `VERCEL=1`)

## 🗂️ Archivos de Configuración

### `.env.local` - Desarrollo Local

```env
# 🔧 DESARROLLO LOCAL
# Se carga automáticamente cuando NODE_ENV=development

NODE_ENV=development
PORT=3000
DEBUG=true

# Variables MÍNIMAS OBLIGATORIAS en desarrollo:
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-proj-tu-openai-key-aqui
STRIPE_SECRET_KEY=sk_test_51... # ⚠️ DEBE ser clave TEST
STRIPE_WEBHOOK_SECRET=whsec_... # Del comando: stripe listen
STRIPE_SUCCESS_URL=http://localhost:3000/billing-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:3000/billing-cancel.html
STRIPE_PORTAL_RETURN_URL=http://localhost:3000/billing.html
```

### `.env.production` - Producción (Servidor Propio)

```env
# 🚀 PRODUCCIÓN SERVIDOR PROPIO
# Se carga automáticamente cuando NODE_ENV=production

NODE_ENV=production
PORT=3000
DEBUG=false

# Variables OBLIGATORIAS en producción:
SUPABASE_URL=https://tu-proyecto-prod.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # ⚠️ Solo en producción
OPENAI_API_KEY=sk-proj-tu-openai-key-produccion
STRIPE_SECRET_KEY=sk_live_51... # ⚠️ DEBE ser clave LIVE
STRIPE_WEBHOOK_SECRET=whsec_... # Del Stripe Dashboard
STRIPE_SUCCESS_URL=https://tu-dominio.com/billing-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://tu-dominio.com/billing-cancel.html
STRIPE_PORTAL_RETURN_URL=https://tu-dominio.com/billing.html
ROASTR_API_KEY=tu-api-key-segura-produccion
PERSPECTIVE_API_KEY=tu-perspective-api-key-produccion

# APIs sociales (OBLIGATORIAS en producción):
TWITTER_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
YOUTUBE_API_KEY=tu-youtube-api-key-produccion
```

### Cloud (Vercel/Netlify) - Panel de Control

```
# 🌐 CLOUD DEPLOYMENT
# NO usar archivos .env - configurar en el panel

Variable                      | Valor
------------------------------|----------------------------------
NODE_ENV                     | production
VERCEL                       | 1 (automático)
SUPABASE_URL                 | https://tu-proyecto-prod.supabase.co
SUPABASE_SERVICE_KEY         | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
STRIPE_SECRET_KEY            | sk_live_51...
STRIPE_WEBHOOK_SECRET        | whsec_...
APP_BASE_URL                 | https://tu-dominio.com
# ... resto de variables
```

## ✅ Validación por Entorno

### Variables Críticas - Desarrollo

**MÍNIMAS OBLIGATORIAS** para arrancar en local:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SUPABASE_URL` | URL del proyecto Supabase | `https://abc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave anónima de Supabase | `eyJhbGciOiJIUzI1NiI...` |
| `OPENAI_API_KEY` | API key de OpenAI | `sk-proj-abc123...` |
| `STRIPE_SECRET_KEY` | Clave **TEST** de Stripe | `sk_test_51...` |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook local | `whsec_abc123...` |
| `STRIPE_SUCCESS_URL` | URL de éxito local | `http://localhost:3000/billing-success.html?session_id={CHECKOUT_SESSION_ID}` |
| `STRIPE_CANCEL_URL` | URL de cancelación local | `http://localhost:3000/billing-cancel.html` |
| `STRIPE_PORTAL_RETURN_URL` | URL de retorno portal | `http://localhost:3000/billing.html` |

### Variables Críticas - Producción  

**TODAS LAS DE DESARROLLO** más estas adicionales:

| Variable | Descripción | Nota |
|----------|-------------|------|
| `SUPABASE_SERVICE_KEY` | Clave de servicio para admin | ⚠️ Solo en producción |
| `ROASTR_API_KEY` | API key propia del servicio | Para autenticación |
| `PERSPECTIVE_API_KEY` | Google Perspective API | Para moderación |
| `TWITTER_BEARER_TOKEN` | Token de Twitter API | Obligatorio en prod |
| `YOUTUBE_API_KEY` | API key de YouTube | Obligatorio en prod |
| URLs con dominio real | Todas las URLs de Stripe | `https://` real |

## 🚀 Configuración Inicial

### 1. Desarrollo Local

```bash
# 1. Copiar archivo de ejemplo
cp .env.local.example .env.local

# 2. Rellenar con tus credenciales reales
nano .env.local

# 3. Configurar Stripe CLI para webhooks
stripe login
stripe listen --forward-to localhost:3000/webhooks/stripe
# Copiar el webhook secret que aparece en consola

# 4. Iniciar aplicación
npm run dev

# 5. Verificar configuración
curl http://localhost:3000/api/diagnostics/env
```

### 2. Producción (Servidor Propio)

```bash
# 1. Copiar archivo de ejemplo
cp .env.production.example .env.production

# 2. Configurar con credenciales LIVE
nano .env.production

# 3. Configurar webhook en Stripe Dashboard
# URL: https://tu-dominio.com/webhooks/stripe
# Eventos: todos los de billing

# 4. Desplegar
NODE_ENV=production npm start
```

### 3. Cloud (Vercel)

```bash
# 1. En el dashboard de Vercel, ir a Settings > Environment Variables
# 2. Añadir todas las variables una por una
# 3. VERCEL=1 se detecta automáticamente
# 4. NO subir archivos .env al repositorio
```

## 🔍 Mensajes de Error

### Errores Críticos (App no arranca)

```
❌ ERRORES CRÍTICOS DE CONFIGURACIÓN:
   ❌ Falta SUPABASE_URL en .env.local
   ❌ Falta OPENAI_API_KEY en .env.local
   ❌ Debe usar clave LIVE de Stripe en producción

🚫 La aplicación no puede arrancar con estos errores.
```

### Advertencias (App arranca pero con funcionalidad limitada)

```
⚠️  ADVERTENCIAS DE CONFIGURACIÓN:
   ⚠️  TWITTER_BEARER_TOKEN no configurado en producción
   ⚠️  Usando clave LIVE de Stripe en desarrollo
```

### Éxito

```
✅ Configuración validada correctamente para: development
```

## 🧪 Testing del Sistema

### Tests Unitarios

```bash
# Ejecutar tests del sistema de entorno
npm test tests/unit/config/env.test.js

# Test que simulan diferentes escenarios:
# - ✅ Carga correcta en development
# - ✅ Carga correcta en production  
# - ❌ Falla si falta variable crítica
# - ✅ Detecta Vercel automáticamente
# - ✅ Valida formato de claves Stripe
```

### Simulación Manual

```bash
# Test 1: Desarrollo sin variables (debe fallar)
NODE_ENV=development node -e "require('./src/config/env')"

# Test 2: Desarrollo con variables correctas
cp .env.local.example .env.local
# Rellenar .env.local
NODE_ENV=development node -e "require('./src/config/env')"

# Test 3: Producción sin variables (debe abortar)
NODE_ENV=production node -e "require('./src/config/env')"
```

## 🔧 Cómo Añadir Nuevas Variables

### 1. Definir en ENV_CONFIG

```javascript
// src/config/env.js
const ENV_CONFIG = {
    // ... existing sections
    
    newService: {
        NEW_API_KEY: process.env.NEW_API_KEY || '',
        NEW_SECRET: process.env.NEW_SECRET || ''
    }
};
```

### 2. Añadir Validación

```javascript
// En validateEnvironment()
if (IS_PRODUCTION) {
    const prodRequired = [
        // ... existing
        { key: 'NEW_API_KEY', value: ENV_CONFIG.newService.NEW_API_KEY }
    ];
}
```

### 3. Actualizar Templates

```bash
# En .env.local.example
NEW_API_KEY=tu-new-api-key-aqui

# En .env.production.example  
NEW_API_KEY=tu-new-api-key-produccion
```

### 4. Documentar

```markdown
# En este archivo
| `NEW_API_KEY` | Descripción del servicio | `abc123...` |
```

## 🚨 Resolución de Problemas

### Problema: "Falta SUPABASE_URL en .env.local"

**Solución:**
1. Verificar que existe el archivo `.env.local`
2. Verificar que `SUPABASE_URL=` no está vacío
3. Verificar que no hay espacios extra: `SUPABASE_URL=https://...`

### Problema: "Usando clave LIVE de Stripe en desarrollo"

**Solución:**
1. En `.env.local` usar clave que empiece por `sk_test_`
2. Nunca usar claves `sk_live_` en desarrollo

### Problema: App arranca pero billing no funciona

**Verificar:**
1. `STRIPE_SECRET_KEY` configurado
2. `STRIPE_WEBHOOK_SECRET` del comando `stripe listen`
3. URLs de Stripe válidas

### Problema: Tests fallan por variables de entorno

**Causa:** Los tests cargan el sistema de entorno  
**Solución:** Los tests automáticamente skipean validación cuando detectan Jest

## 📚 Arquitectura del Sistema

```
src/config/env.js
├── loadEnvironmentFiles()     # Carga .env.local/.env.production
├── ENV_CONFIG                 # Configuración centralizada
├── validateEnvironment()      # Validación por entorno
├── getDiagnostics()          # Debug info (solo development)
└── Auto-initialization       # Se ejecuta al importar
```

### Flujo de Carga

1. **Detectar entorno**: `NODE_ENV` y `VERCEL`
2. **Cargar archivo**: `.env.local` | `.env.production` | ninguno
3. **Construir config**: Mapear `process.env` a `ENV_CONFIG`
4. **Validar**: Verificar variables críticas por entorno
5. **Abortar si error crítico**: `process.exit(1)` en producción

### Integración con App

```javascript
// Uso en el código
const { database, stripe, ai } = require('./config/env');

console.log(database.SUPABASE_URL);    // ✅ Centralizado
console.log(process.env.SUPABASE_URL); // ❌ Evitar uso directo
```

---

## 🔒 Seguridad

- **❌ NUNCA** commitear archivos `.env*` al repositorio
- **✅ SOLO** commitear archivos `.env*.example`
- **⚠️ VERIFICAR** que `.gitignore` excluye `.env.local` y `.env.production`
- **🔍 REVISAR** que no hay claves hardcodeadas en el código

---

📦 **Sistema de Variables de Entorno Roastr.ai v2.0**  
Validación robusta • Detección automática • Documentación completa