# Configuración de Variables de Entorno para STAGING

## 📋 Resumen

Este documento describe la estructura de variables de entorno para el entorno de **staging** de Roastr.AI.

## 🎯 Archivos

- **`env.staging.template`**: Template con todas las variables necesarias (valores vacíos)
- **`.env.staging`**: Archivo real con valores de staging (NO commitear, está en `.gitignore`)
- **`scripts/create-env-staging.sh`**: Script para generar `.env.staging` desde el template

## 🚀 Uso Rápido

### 1. Crear archivo .env.staging

```bash
./scripts/create-env-staging.sh
```

### 2. Editar con valores reales

Edita `.env.staging` y rellena los valores necesarios para staging:

```bash
nano .env.staging
# o
code .env.staging
```

### 3. Verificar que NO está en git

```bash
git status
# .env.staging NO debe aparecer en la lista
```

## 📝 Categorías de Variables

### 🔴 CRÍTICAS (Obligatorias para funcionar)

Estas variables **DEBEN** estar configuradas para que staging funcione:

```bash
# Supabase (Base de datos y auth)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_REDIRECT_URL=https://staging.roastr.ai/auth/callback

# Redis (Cola de trabajos)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# OpenAI (Generación de roasts)
OPENAI_API_KEY=sk-...

# Polar (Pagos y suscripciones)
POLAR_ACCESS_TOKEN=polar_test_...
POLAR_WEBHOOK_SECRET=whsec_...
POLAR_SUCCESS_URL=https://staging.roastr.ai/billing/success
POLAR_CANCEL_URL=https://staging.roastr.ai/billing/cancel

# Product IDs de Polar
POLAR_STARTER_PRODUCT_ID=your-starter-product-id
POLAR_PRO_PRODUCT_ID=your-pro-product-id
POLAR_PLUS_PRODUCT_ID=your-plus-product-id

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@staging.roastr.ai

# URLs de la aplicación
APP_URL=https://staging.roastr.ai
FRONTEND_URL=https://staging.roastr.ai
PUBLIC_BASE_URL=https://staging.roastr.ai

# Encriptación
PERSONA_ENCRYPTION_KEY=your-32-byte-hex-key
```

### 🟡 OPCIONALES (Mejoran funcionalidad)

Estas variables son opcionales pero habilitan features adicionales:

```bash
# Integraciones de plataformas sociales
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
ENABLE_REAL_TWITTER=true

YOUTUBE_API_KEY=...
ENABLE_REAL_YOUTUBE=true

# Análisis de toxicidad avanzado
PERSPECTIVE_API_KEY=...

# Analytics
VITE_AMPLITUDE_API_KEY=...

# Gateway LLM (alternativa a OpenAI directo)
PORTKEY_API_KEY=...
PORTKEY_PROJECT_ID=...
```

### 🟢 FEATURE FLAGS (Controlan comportamiento)

Estas variables controlan qué features están activas:

```bash
# Core
ENABLE_BILLING=true
ENABLE_SHIELD=true
ENABLE_SUPABASE=true

# Auth
ENABLE_MAGIC_LINK=true
ENABLE_RATE_LIMIT=true
ENABLE_CSRF_PROTECTION=true

# UI Features (generalmente false en staging)
ENABLE_SHOP=false
ENABLE_CUSTOM_PROMPT=false
ENABLE_SHIELD_UI=false
```

## 🔒 Seguridad

### ❌ NUNCA hacer esto:

- ❌ Commitear `.env.staging` a git
- ❌ Usar valores de producción en staging
- ❌ Compartir valores reales en issues/PRs
- ❌ Incluir credenciales en logs

### ✅ SIEMPRE hacer esto:

- ✅ Verificar que `.env.staging` está en `.gitignore`
- ✅ Usar valores de TEST de servicios externos cuando aplique
- ✅ Rotar credenciales si se exponen accidentalmente
- ✅ Mantener template actualizado sin valores reales

## 🔄 Diferencias con Producción

| Aspecto | Staging | Producción |
|---------|---------|------------|
| NODE_ENV | `staging` | `production` |
| Base de datos | Supabase staging project | Supabase prod project |
| Polar | Test access token | Live access token |
| Email | Staging domain | Production domain |
| URLs | `staging.roastr.ai` | `app.roastr.ai` |
| Debug logs | Puede estar `true` | Siempre `false` |
| Integraciones sociales | Generalmente `false` (mock) | `true` (real APIs) |

## 📊 Validación

### Scripts Actuales

```bash
# Verificar que .env existe (crea desde .env.example si falta)
npm run verify:env

# Verificar configuración de variables
npm run verify:env:config
```

### Scripts de Staging (TODO)

**⚠️ Pendiente de implementación:**

Los siguientes scripts específicos para staging están planificados pero aún no implementados:

```bash
# TODO(ROA-529): Implementar validación específica de staging
# npm run validate:env:staging

# TODO(ROA-529): Implementar verificación de valores de producción
# npm run verify:env:staging
```

**Tracking**: Implementación pendiente en ROA-529

Scripts que se implementarán:
- Validar variables críticas de Polar, Resend, Supabase
- Detectar valores de producción accidentalmente en staging
- Verificar estructura correcta del `.env.staging`

## 🐛 Troubleshooting

### Error: "SUPABASE_URL is required"

**Solución**: Verifica que `.env.staging` tiene valores para:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_REDIRECT_URL`

### Error: "Redis connection failed"

**Solución**: Verifica Upstash Redis:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Error: "OpenAI API key missing"

**Solución**: Verifica `OPENAI_API_KEY` en `.env.staging`

### Warning: "Feature flags not loaded"

**Causa**: Variables de feature flags mal configuradas
**Solución**: Revisa que los valores sean `true`/`false`, no `1`/`0`

## 📚 Referencias

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Upstash Redis](https://docs.upstash.com/redis)
- [Documentación de OpenAI](https://platform.openai.com/docs)
- [Documentación de Polar](https://docs.polar.sh)
- [Documentación de Resend](https://resend.com/docs)

## 🔗 Ver también

- `.env.example` - Template para desarrollo local
- `docs/TESTING-GUIDE.md` - Guía completa de testing
- `docs/POLAR-TESTING-LOCAL.md` - Testing de Polar en local
- `docs/REDIS-SETUP-GUIDE.md` - Configuración de Redis/Upstash
- `docs/SUPABASE-JWT-SETUP.md` - Configuración de Supabase

