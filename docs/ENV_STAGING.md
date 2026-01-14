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
# Supabase (Base de datos)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Redis (Cola de trabajos)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# OpenAI (Generación de roasts)
OPENAI_API_KEY=sk-...

# Stripe (Pagos)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://staging.roastr.ai/billing/success
STRIPE_CANCEL_URL=https://staging.roastr.ai/billing/cancel
STRIPE_PORTAL_RETURN_URL=https://staging.roastr.ai/billing

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
- ✅ Usar valores de TEST de servicios (ej: `sk_test_...` para Stripe)
- ✅ Rotar credenciales si se exponen accidentalmente
- ✅ Mantener template actualizado sin valores reales

## 🔄 Diferencias con Producción

| Aspecto | Staging | Producción |
|---------|---------|------------|
| NODE_ENV | `staging` | `production` |
| Base de datos | Supabase staging project | Supabase prod project |
| Stripe | Test keys (`sk_test_...`) | Live keys (`sk_live_...`) |
| Email | Staging domain | Production domain |
| URLs | `staging.roastr.ai` | `app.roastr.ai` |
| Debug logs | Puede estar `true` | Siempre `false` |
| Integraciones sociales | Generalmente `false` (mock) | `true` (real APIs) |

## 📊 Validación

### Script de validación (futuro)

```bash
# Validar que todas las variables críticas están presentes
npm run validate:env:staging

# Verificar que no hay valores de producción en staging
npm run verify:env:staging
```

## 🐛 Troubleshooting

### Error: "SUPABASE_URL is required"

**Solución**: Verifica que `.env.staging` tiene valores para:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

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
- [Documentación de Stripe Testing](https://stripe.com/docs/testing)
- [Documentación de Resend](https://resend.com/docs)

## 🔗 Ver también

- `docs/ENVIRONMENT_VARIABLES.md` - Documentación completa de variables
- `docs/DEPLOYMENT.md` - Guía de despliegue
- `docs/TESTING.md` - Testing en diferentes entornos
- `.env.example` - Template para desarrollo local

