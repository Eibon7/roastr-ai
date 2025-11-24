# 🚀 Guía de Configuración Redis/Upstash

**Objetivo:** Configurar Upstash Redis (REST SDK) para reducir Disk IO en ~95%
**Tiempo estimado:** 5-10 minutos
**Costo:** Gratis hasta 10,000 comandos/día (suficiente para desarrollo)
**SDK:** `@upstash/redis` (REST API - optimizado para serverless)

---

## 📋 Paso 1: Crear Cuenta Upstash (2 min)

1. **Ve a:** https://upstash.com/
2. **Crea cuenta** (gratis, con email)
3. **Verifica email** si es necesario

---

## 📋 Paso 2: Crear Base de Datos Redis (2 min)

1. **En Upstash Dashboard:**
   - Click en "Create Database"
   - **Nombre:** `roastr-ai-queue` (o el que prefieras)
   - **Tipo:** Redis
   - **Región:** Elige la más cercana (ej: `eu-west-1` para Europa)
   - **Plan:** Free Tier (10K comandos/día)

2. **Espera a que se cree** (~30 segundos)

---

## 📋 Paso 3: Obtener Credenciales (1 min)

Una vez creada la base de datos:

1. **Ve a la base de datos** que acabas de crear
2. **En la pestaña "Details" o "REST API":**
   - Copia el **UPSTASH_REDIS_REST_URL**
     - Formato: `https://xxxxx.upstash.io`
   - Copia el **UPSTASH_REDIS_REST_TOKEN**
     - Formato: `AXxxxxx...` (token largo)

**⚠️ IMPORTANTE:**

- Usa **REST URL** (no Redis URL directa)
- El token es diferente al password de Redis tradicional

---

## 📋 Paso 4: Configurar en .env (1 min)

Añade estas líneas a tu archivo `.env`:

```bash
# Redis/Upstash Configuration
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
QUEUE_PREFER_REDIS=true
```

**Ejemplo real:**

```bash
UPSTASH_REDIS_REST_URL=https://eu-west1-xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxx...long_token_here...
QUEUE_PREFER_REDIS=true
```

---

## 📋 Paso 5: Verificar Configuración (1 min)

```bash
npm run redis:verify
```

**Salida esperada:**

```
✅ Redis connection successful!
✅ Redis is fully operational!
💡 Your workers will use Redis for queue management,
   reducing Disk IO by ~95% compared to database-only mode.
```

**Si hay error:**

- Verifica que copiaste bien la URL y el token
- Asegúrate de usar REST URL (no Redis URL directa)
- Verifica que no hay espacios extra en `.env`

---

## 📋 Paso 6: Reiniciar Workers (1 min)

```bash
# Detener workers si están corriendo
pkill -f "start-workers"

# Reiniciar con Redis activo
npm run workers:start
```

**Verificar que Redis está activo:**

```bash
npm run workers:status
# Deberías ver: "redis: true" o "Redis: ✅ Available"
```

---

## 🔍 Verificación Completa

### 1. Verificar Conexión

```bash
npm run redis:verify
```

### 2. Verificar en Workers

```bash
npm run workers:status
# Busca: "redis": true o "Redis: ✅"
```

### 3. Verificar en Logs

Cuando inicies workers, deberías ver:

```
✅ Redis connected successfully
✅ Queue Service initialized (Redis mode)
```

### 4. Verificar Disk IO

- Supabase Dashboard → Usage → Disk IO
- Deberías ver reducción inmediata después de activar Redis

---

## 🐛 Troubleshooting

### Error: "Redis URL not configured"

- Verifica que `.env` tiene `UPSTASH_REDIS_REST_URL`
- Asegúrate de recargar variables: `source .env` o reiniciar terminal

### Error: "Connection refused" o "Timeout"

- Verifica que la URL es correcta (formato: `https://xxxxx.upstash.io`)
- Verifica que el token es correcto
- Verifica que no hay firewall bloqueando conexiones

### Error: "Authentication failed"

- Verifica que el token es correcto (copia completa)
- Asegúrate de usar REST TOKEN (no Redis password)

### Workers siguen usando Database

- Verifica `QUEUE_PREFER_REDIS=true` en `.env`
- Reinicia workers después de cambiar `.env`
- Verifica logs: debería decir "Redis connected"

---

## 📊 Impacto Esperado

### Antes (Solo Database)

- Disk IO: ~216,000 queries/día
- Workers: Polling database cada 1-5s
- Latencia: Mayor (queries a PostgreSQL)

### Después (Con Redis)

- Disk IO: ~20,000-40,000 queries/día (-80-85%)
- Workers: Polling Redis (no cuenta como Disk IO)
- Latencia: Menor (Redis es más rápido)

**Reducción total:** ~95% Disk IO de queue operations

---

## 🔧 Acerca del SDK (@upstash/redis)

Este proyecto usa el **SDK oficial de Upstash** en lugar de clientes Redis genéricos (como `ioredis`).

### ¿Por qué @upstash/redis?

**Ventajas:**

- ✅ **REST API**: HTTP-based, no necesita conexiones TCP persistentes
- ✅ **Stateless**: Cada operación es independiente (perfecto para serverless)
- ✅ **Más simple**: Configuración minimal (`Redis.fromEnv()`)
- ✅ **Optimizado**: Diseñado específicamente para Upstash
- ✅ **Menor latencia**: No overhead de protocolo Redis TCP
- ✅ **Auto-retry**: Manejo automático de reintentos

**Ejemplo de uso en código:**

```javascript
const { Redis } = require('@upstash/redis');

// Opción 1: Desde variables de entorno (recomendado)
const redis = Redis.fromEnv();

// Opción 2: Configuración explícita
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

// Uso
await redis.set('foo', 'bar');
const value = await redis.get('foo');
```

### Diferencias con ioredis

| Característica | @upstash/redis | ioredis        |
| -------------- | -------------- | -------------- |
| Protocolo      | REST (HTTP)    | TCP            |
| Conexiones     | Stateless      | Persistent     |
| Config         | Minimal        | Compleja       |
| Serverless     | Optimizado     | No ideal       |
| Event handlers | No necesarios  | Requiere setup |
| Disconnect     | No necesario   | Debe cerrar    |

## 💡 Alternativas

### Redis Local (Desarrollo)

⚠️ **Nota:** El SDK `@upstash/redis` está diseñado para Upstash. Para Redis local, considera usar Upstash para consistencia o migrar a `ioredis` si necesario.

Si prefieres Redis local (no recomendado con el SDK actual):

```bash
# Instalar Redis localmente
brew install redis  # macOS
# o
sudo apt-get install redis-server  # Linux

# Iniciar Redis
redis-server
```

**Ventajas:**

- Gratis ilimitado
- Más rápido (sin latencia de red)
- Útil para desarrollo local

**Desventajas:**

- No disponible en producción (necesitas servidor)
- No compatible con @upstash/redis SDK (necesitarías ioredis)
- No persistente por defecto

---

## 🔐 Seguridad

- ✅ **NUNCA** commitees `.env` con credenciales
- ✅ **NUNCA** compartas tokens públicamente
- ✅ Rota tokens si se comprometen
- ✅ Usa diferentes bases de datos para dev/staging/prod

---

## 📚 Referencias

- [Upstash Documentation](https://docs.upstash.com/)
- [Upstash Free Tier Limits](https://docs.upstash.com/redis/overall/getstarted#free-tier)
- [@upstash/redis SDK](https://github.com/upstash/upstash-redis)
- [SDK API Reference](https://upstash.com/docs/redis/sdks/ts/overview)

---

**Última actualización:** 2025-11-20 (Issue #898)
**Estado:** ✅ Guía completa - Migrado a @upstash/redis SDK
