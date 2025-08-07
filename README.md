# Roastr.ai

Roastr.ai es un MVP (Producto Mínimo Viable) que genera "roasts" o respuestas sarcásticas e ingeniosas a comentarios usando inteligencia artificial. El proyecto está desplegado en Vercel como una función serverless usando Express y OpenAI GPT-4o mini.

## Introducción

Roastr.ai es una herramienta que analiza comentarios y genera respuestas humorísticas y sarcásticas de forma automática. Es ideal para moderación de contenido con un toque de humor, permitiendo responder a comentarios tóxicos o inapropiados con ingenio en lugar de censura directa.

**Características principales:**
- Generación de roasts usando OpenAI GPT-4o mini
- Detección automática de idioma (español/inglés)
- API REST desplegada en Vercel
- Frontend web minimalista
- CLI para uso local

## Arquitectura

El proyecto usa una arquitectura simple basada en Node.js + Express:

- **Backend**: `src/index.js` - Servidor Express con endpoints de API
- **Frontend**: `public/index.html` - Interfaz web básica con HTML/CSS/JS vanilla
- **Despliegue**: Vercel serverless functions usando `vercel.json`
- **CLI**: `src/cli.js` - Herramienta de línea de comandos para testing local

La aplicación se ejecuta como una función serverless en Vercel, lo que permite escalabilidad automática y costos reducidos.

## Endpoints

### `GET /`
Sirve el frontend web desde `public/index.html`.

### `POST /roast`
Genera un roast usando la API de OpenAI.

**Parámetros:**
```json
{
  "message": "Tu comentario aquí"
}
```

**Respuesta:**
```json
{
  "roast": "Tu roast generado por IA"
}
```

### `POST /csv-roast`
Genera un roast simulado usando un sistema de plantillas (actualmente mock, futura integración con CSV).

**Parámetros:**
```json
{
  "message": "Tu comentario aquí"
}
```

**Respuesta:**
```json
{
  "roast": "🎯 Roast desde CSV simulado para: \"Tu comentario aquí\""
}
```

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
OPENAI_API_KEY=tu_clave_openai_aqui
ROASTR_API_KEY=tu_api_key_roastr_aqui
DEBUG=true # Opcional, activa logs detallados

# Variables para integración con Twitter/X
TWITTER_BEARER_TOKEN=tu_bearer_token_aqui
TWITTER_APP_KEY=tu_app_key_aqui
TWITTER_APP_SECRET=tu_app_secret_aqui
TWITTER_ACCESS_TOKEN=tu_access_token_aqui
TWITTER_ACCESS_SECRET=tu_access_secret_aqui
ROAST_API_URL=https://tu-url-vercel.vercel.app # Opcional, URL de la API
```

### Descripción de variables:

**API de Roast:**
- `OPENAI_API_KEY`: Clave de API de OpenAI para generar los roasts
- `ROASTR_API_KEY`: Clave de autenticación personalizada para el endpoint /roast
- `DEBUG`: Activa logs detallados en consola (opcional)

**Integración con Twitter/X:**
- `TWITTER_BEARER_TOKEN`: Token Bearer de Twitter para leer menciones (OAuth 2.0)
- `TWITTER_APP_KEY`: Consumer Key de la aplicación de Twitter
- `TWITTER_APP_SECRET`: Consumer Secret de la aplicación de Twitter
- `TWITTER_ACCESS_TOKEN`: Access Token para publicar tweets
- `TWITTER_ACCESS_SECRET`: Access Token Secret para publicar tweets
- `ROAST_API_URL`: URL base de la API de roast (opcional, por defecto usa producción)

## Configuración de Vercel

El archivo `vercel.json` configura el despliegue en Vercel:

```json
{
  "version": 2,
  "builds": [
    { "src": "src/index.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "src/index.js" }
  ]
}
```

**Puntos importantes:**
- Todas las rutas se redirigen a `src/index.js`
- Para que funcionen `/roast` y `/csv-roast`, el `vercel.json` debe apuntar a `"dest": "src/index.js"`
- Las variables de entorno deben configurarse también en el Vercel Dashboard

## Despliegue

### Pasos para desplegar:

```bash
# Instalar dependencias
npm install

# Autenticarse en Vercel
vercel login

# Vincular proyecto
vercel link

# Desplegar a producción
vercel --prod
```

**Notas importantes:**
- Después del despliegue, Vercel genera una URL nueva
- Siempre prueba en la URL más reciente generada por `vercel --prod`
- Configura las variables de entorno en el Vercel Dashboard después del primer despliegue

## Uso de la API

### Endpoint POST /roast

```bash
curl -X POST "https://TU_URL_VERCEL.vercel.app/roast" \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_ROASTR_API_KEY" \
  -d '{"message": "Your code is terrible"}'
```

### Endpoint POST /csv-roast

```bash
curl -X POST "https://TU_URL_VERCEL.vercel.app/csv-roast" \
  -H "Content-Type: application/json" \
  -d '{"message": "Your code is terrible"}'
```

### Ejemplo de respuesta exitosa:

```json
{
  "roast": "Vaya, qué original. Seguro que tardaste horas en pensar esa obra maestra."
}
```

### Ejemplo de respuesta de error:

```json
{
  "error": "Debes enviar un campo \"message\" válido."
}
```

## Modo Debug

Activa el modo debug estableciendo `DEBUG=true` en tu archivo `.env`:

```env
DEBUG=true
```

**Beneficios del modo debug:**
- Logs detallados en la consola
- Información de parámetros de entrada
- Claves de API truncadas para seguridad
- Detalles de errores de la API de OpenAI

## CSV Roast (Pendiente)

**Estado actual:** El endpoint `/csv-roast` devuelve un mock simulado.

**Funcionalidad futura:** 
- Leerá roasts predefinidos desde un archivo CSV
- Permitirá respuestas más rápidas sin usar tokens de OpenAI
- Sistema de plantillas personalizable

## CLI Local

Para testing local, usa el CLI:

```bash
# Roast simple
npm run roast "Tu comentario aquí"

# Ejemplo
npm run roast "Este código es horrible"
```

El CLI se conecta automáticamente a la URL de producción configurada.

## Bot de Twitter/X

**Funcionalidad:** El bot monitorea menciones a tu cuenta en Twitter/X y responde automáticamente con roasts generados por IA usando el plan Essential (gratuito) de Twitter API.

⚠️ **IMPORTANTE:** El bot está optimizado para funcionar con el plan Essential de Twitter API, que **NO** soporta streaming en tiempo real. Usa polling por lotes para detectar menciones.

### Configuración de Twitter/X:

1. **Crear aplicación en Twitter Developer Portal:**
   - Ve a [developer.twitter.com](https://developer.twitter.com)
   - Crea un nuevo proyecto y aplicación
   - Obtén las credenciales necesarias

2. **Configurar permisos:**
   - La aplicación necesita permisos de "Read and Write"
   - Activa "OAuth 1.0a" para publicar tweets
   - Obtén Bearer Token para "OAuth 2.0" (leer menciones)

3. **Añadir credenciales al .env:**
   ```env
   TWITTER_BEARER_TOKEN=tu_bearer_token
   TWITTER_APP_KEY=tu_consumer_key
   TWITTER_APP_SECRET=tu_consumer_secret
   TWITTER_ACCESS_TOKEN=tu_access_token
   TWITTER_ACCESS_SECRET=tu_access_token_secret
   ```

### Ejecutar el bot:

```bash
# Modo batch (una sola ejecución, recomendado para testing)
npm run twitter:batch

# Modo por defecto (polling continuo cada 5 minutos)
npm run twitter

# Nota: streaming mode está desactivado para compatibilidad con Essential API
```

### Características del bot:

- **Modo batch:** Una sola ejecución para procesar menciones recientes (ideal para cron jobs)
- **Modo polling:** Ejecución continua con intervalos configurables (por defecto: 5 minutos)
- **Compatible con Essential API:** Optimizado para el plan gratuito de Twitter API
- **Detección de toxicidad:** Actualmente usa un stub que siempre permite roasts (preparado para Perspective API)
- **Prevención de duplicados:** Rastrea menciones procesadas en `data/processed_mentions.json`
- **Prevención de auto-respuestas:** No responde a sus propios tweets
- **Rate limiting configurable:** Controla tweets por hora y delays entre tweets
- **Manejo de errores robusto:** Exponential backoff y reintentos automáticos
- **Logging avanzado:** Logs estructurados con timestamps y contexto detallado

### Configuración avanzada del bot:

Añade estas variables a tu archivo `.env` para personalizar el comportamiento:

```env
# Bot configuration (opcional)
RUN_MODE=loop                   # Modo de ejecución: 'loop' (continuo) o 'single' (una vez)
MAX_TWEETS_PER_HOUR=10          # Máximo tweets por hora (default: 10)
MIN_DELAY_BETWEEN_TWEETS=5000   # Delay mínimo entre tweets en ms (default: 5000)
MAX_DELAY_BETWEEN_TWEETS=30000  # Delay máximo entre tweets en ms (default: 30000)
BATCH_INTERVAL_MINUTES=5        # Intervalo de polling en minutos (default: 5, solo para loop)
DEBUG=true                      # Activa logs detallados (default: false)
```

### Modos de ejecución:

**🔄 Loop Mode (por defecto):**
```bash
npm run twitter:batch           # Ejecuta continuamente
RUN_MODE=loop npm run twitter   # Explícitamente en modo loop
```

**⚡ Single Mode (ideal para cron jobs):**
```bash
RUN_MODE=single npm run twitter:batch    # Una sola ejecución y termina
```

### Ejemplos de cron jobs:

```bash
# Cada 5 minutos
*/5 * * * * cd /path/to/roastr-ai && RUN_MODE=single npm run twitter:batch

# Cada 15 minutos con debug
*/15 * * * * cd /path/to/roastr-ai && RUN_MODE=single DEBUG=true npm run twitter:batch

# Cada hora
0 * * * * cd /path/to/roastr-ai && RUN_MODE=single npm run twitter:batch
```

### Logs del bot:

**Logs normales:**
- ✅ Operaciones exitosas
- ⚠️ Advertencias y rate limits
- ❌ Errores y fallos
- ℹ️ Información general

**Logs de debug (DEBUG=true):**
- `[TWITTER-DEBUG]` - Información técnica detallada
- `[BATCH]` - Eventos específicos del modo batch
- `[POLLING]` - Eventos del ciclo de polling continuo
- JSON estructurado con contexto completo
- Timestamps ISO precisos
- Datos de performance y métricas

### Archivos generados:

- `data/processed_mentions.json`: Lista de menciones ya procesadas (evita duplicados)
- `data/processed_tweets.json`: Lista de tweets ya procesados (sistema legacy)

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Modo desarrollo con auto-reload
npm run dev

# Iniciar servidor API
npm run start:api

# Usar CLI local
npm run roast "mensaje de prueba"

# Ejecutar bot de Twitter
npm run twitter:batch   # Una sola ejecución (recomendado para testing)
npm run twitter         # Modo polling continuo (recomendado para producción)
```

## ⏱️ Sistema de Integración Unificado con Cron Jobs

Roastr.ai ahora soporta múltiples plataformas (Twitter, YouTube, Bluesky, Instagram) a través de un sistema de cron unificado que reemplaza el anterior sistema específico de Twitter.

### 🚀 Configuración Rápida (Sistema Nuevo)

1. **Configurar variables de entorno:**
   ```bash
   # Copiar y configurar variables de entorno
   cp .env.example .env
   # Editar .env con tus claves de API
   ```

2. **Probar el sistema unificado:**
   ```bash
   # Probar con debug activado
   npm run integrations:test
   
   # Ejecutar batch una vez
   npm run integrations:batch
   ```

3. **Configurar cron unificado:**
   ```bash
   # Dar permisos al script
   chmod +x cron_integrations.sh
   
   # Configurar crontab
   crontab -e
   ```
   
   **💡 Líneas recomendadas para crontab:**
   ```bash
   # Cada 5 minutos (activo)
   */5 * * * * /Users/emiliopostigo/roastr-ai/cron_integrations.sh
   
   # Cada 10 minutos (equilibrado)
   */10 * * * * /Users/emiliopostigo/roastr-ai/cron_integrations.sh
   
   # Cada 15 minutos (conservador)
   */15 * * * * /Users/emiliopostigo/roastr-ai/cron_integrations.sh
   ```

### 📈 Configuración de Integraciones

**Habilitar/deshabilitar integraciones:**
```bash
# En tu archivo .env

# Solo Twitter (compatible con sistema legacy)
INTEGRATIONS_ENABLED=twitter
TWITTER_ENABLED=true

# Twitter + YouTube (sistema multiplatforma)
INTEGRATIONS_ENABLED=twitter,youtube
TWITTER_ENABLED=true
YOUTUBE_ENABLED=true

# Todas las plataformas disponibles
INTEGRATIONS_ENABLED=twitter,youtube,bluesky,instagram

# Solo YouTube (desactivar Twitter)
INTEGRATIONS_ENABLED=youtube
TWITTER_ENABLED=false
YOUTUBE_ENABLED=true

# Desactivar todas las integraciones
INTEGRATIONS_ENABLED=
# o vacío para ninguna integración activa
```

**Variables requeridas por plataforma:**
- **Twitter**: `TWITTER_BEARER_TOKEN`, `TWITTER_ACCESS_TOKEN`, `TWITTER_APP_KEY`, `TWITTER_APP_SECRET`, `TWITTER_ACCESS_SECRET`
- **YouTube**: `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`, `YOUTUBE_MONITORED_VIDEOS`
- **Bluesky**: `BLUESKY_HANDLE`, `BLUESKY_PASSWORD`
- **Instagram**: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_APP_ID`

### 📊 Monitoreo y Logs (Sistema Nuevo)

**Ver logs del sistema unificado:**
```bash
tail -f /Users/emiliopostigo/roastr-ai/logs/cron_integrations.log
```

**Ver métricas en tiempo real:**
```bash
# Los logs incluyen métricas por plataforma
tail -f /Users/emiliopostigo/roastr-ai/logs/cron_integrations.log | grep "SUMMARY"
```

**Ver últimos logs:**
```bash
tail -n 100 /Users/emiliopostigo/roastr-ai/logs/cron_integrations.log
```

### 🔄 Migración desde Sistema Twitter-Only

**Si tienes el cron anterior configurado:**

1. **Desactivar cron anterior:**
   ```bash
   crontab -e
   # Comentar líneas del cron_twitter.sh:
   # */5 * * * * /Users/emiliopostigo/roastr-ai/cron_twitter.sh
   ```

2. **Activar sistema unificado:**
   ```bash
   # Configurar integraciones habilitadas
   echo "INTEGRATIONS_ENABLED=twitter,youtube" >> .env
   
   # Configurar nuevo cron
   crontab -e
   # Añadir nueva línea:
   */5 * * * * /Users/emiliopostigo/roastr-ai/cron_integrations.sh
   ```

3. **Verificar migración:**
   ```bash
   # Probar manualmente
   ./cron_integrations.sh
   
   # Verificar logs
   tail -n 50 /Users/emiliopostigo/roastr-ai/logs/cron_integrations.log
   ```

### ✅ **Compatibilidad Twitter Garantizada**

El bot de Twitter mantiene **100% de compatibilidad** con el sistema anterior:

**Ejecución Manual (sigue funcionando):**
```bash
npm run twitter:batch        # Modo batch tradicional
npm run twitter             # Modo polling continuo
RUN_MODE=single npm run twitter:batch  # Una ejecución para cron
```

**Ejecución Unificada (nueva funcionalidad):**
```bash
npm run integrations:batch  # Ejecuta todas las integraciones activas
npm run integrations:test   # Prueba todas las integraciones
npm run integrations:cron   # Script de cron unificado
```

**Verificación de Twitter en sistema unificado:**
```bash
# Probar solo Twitter
INTEGRATIONS_ENABLED=twitter npm run integrations:test

# Ver estado de Twitter
curl http://localhost:3000/api/integrations/metrics
```

⚠️ **Nota importante**: Si ya tienes Twitter funcionando con el sistema anterior, no necesitas cambiar nada. Ambos sistemas coexisten perfectamente.

### 🔧 Gestión del Sistema Unificado

**Ver estado de todas las integraciones:**
```bash
npm run integrations:test
```

**Comandos disponibles:**
```bash
npm run integrations:batch    # Ejecutar batch una vez
npm run integrations:cron     # Ejecutar script de cron manualmente
npm run integrations:test     # Ejecutar con debug activado
```

**Ver cron jobs activos:**
```bash
crontab -l
```

### 🛠️ Troubleshooting Sistema Unificado

**El sistema unificado no funciona:**
1. **Verificar configuración:**
   ```bash
   # Probar configuración
   DEBUG=true npm run integrations:batch
   ```

2. **Verificar permisos:**
   ```bash
   ls -la cron_integrations.sh  # Debe mostrar -rwxr-xr-x
   ```

3. **Verificar integraciones habilitadas:**
   ```bash
   grep "INTEGRATIONS_ENABLED" .env
   ```

**Problemas específicos por plataforma:**
- **YouTube**: Verificar `YOUTUBE_API_KEY` y quotas de API
- **Twitter**: Verificar tokens OAuth no hayan expirado
- **Bluesky**: Verificar credenciales de usuario
- **Instagram**: Verificar tokens de aplicación

### 📱 Intervalos Recomendados por Plataforma

| Plataforma | Intervalo Mínimo | Intervalo Recomendado | Rate Limits |
|------------|------------------|----------------------|-------------|
| Twitter | 5 minutos | 10 minutos | 100 req/15min |
| YouTube | 10 minutos | 15 minutos | 10,000 units/day |
| Bluesky | 1 minuto | 5 minutos | Sin límites oficiales |
| Instagram | 30 minutos | 60 minutos | 600 req/hour |

**💡 Recomendación Sistema Multi-Plataforma:** Usar intervalos de 10-15 minutos para balance óptimo entre respuesta y límites de API.

### 📋 Comparación: Sistema Anterior vs Nuevo

| Característica | Sistema Anterior | Sistema Nuevo |
|----------------|------------------|---------------|
| Plataformas | Solo Twitter | Twitter, YouTube, Bluesky, Instagram |
| Scripts | `cron_twitter.sh` | `cron_integrations.sh` |
| Configuración | Variables Twitter | Sistema unificado `.env` |
| Logs | `logs/cron_twitter.log` | `logs/cron_integrations.log` |
| Comandos | `npm run twitter:batch` | `npm run integrations:batch` |
| Métricas | Por ejecución | Por plataforma + global |

### 🔄 Proceso de Migración Completo

1. **Backup configuración anterior:**
   ```bash
   cp .env .env.backup
   crontab -l > crontab.backup
   ```

2. **Configurar sistema nuevo:**
   ```bash
   # Actualizar .env con nuevas variables
   cp .env.example .env.new
   # Migrar valores de .env.backup a .env.new
   mv .env.new .env
   ```

3. **Actualizar crontab:**
   ```bash
   crontab -e
   # Comentar líneas antiguas, añadir línea nueva del sistema unificado
   ```

4. **Verificar funcionamiento:**
   ```bash
   ./cron_integrations.sh
   tail -f /Users/emiliopostigo/roastr-ai/logs/cron_integrations.log
   ```

## 🎯 Roastr Normal vs 🛡️ Roastr Shield

Roastr.ai ahora opera en dos modos distintos:

### 🎯 **Roastr Normal**
- **Propósito**: Humor y entretenimiento
- **Respuestas**: Roasts ingenioso y sarcásticos
- **Configuración**: Tono personalizable por plataforma
- **Logs**: Contenido normal, sin restricciones de visualización

### 🛡️ **Roastr Shield** 
- **Propósito**: Moderación defensiva y protección
- **Funcionalidades avanzadas**:
  - Detección de usuarios reincidentes
  - Acciones automáticas (silenciar, bloquear, reportar)
  - Análisis de severidad de comentarios
  - Tracking de patrones de comportamiento tóxico
- **Logs**: Contenido sensible con advertencias
- **Acceso**: Panel de configuración con advertencias de contenido

### 📊 **Panel de Configuración**

Accede al panel web de configuración en: `http://localhost:3000/integrations.html`

**Funcionalidades del Panel**:
- Configuración individual por plataforma
- Sliders de frecuencia de respuesta
- Preview de roasts con diferentes tonos
- Vista de logs separados (Normal/Shield/Integración)
- Métricas en tiempo real
- Estadísticas de reincidencia

### 🔧 **Configuración Personalizada por Integración**

Cada plataforma puede configurarse independientemente:

```bash
# Configuración de Twitter
TWITTER_TONE=sarcastic           # sarcastic, ironic, absurd
TWITTER_HUMOR_TYPE=witty         # witty, clever, playful
TWITTER_RESPONSE_FREQUENCY=1.0   # 1.0 = siempre, 0.33 = 1 de cada 3

# Configuración de YouTube  
YOUTUBE_TONE=ironic
YOUTUBE_RESPONSE_FREQUENCY=0.5   # 50% de probabilidad de responder

# Shield Mode (solo si ROASTR_MODE=shield)
TWITTER_SHIELD_MUTE=true         # Silenciar usuarios reincidentes
YOUTUBE_SHIELD_REMOVE=true       # Eliminar comentarios ofensivos
```

## Resumen Técnico para IA

```json
{
  "name": "Roastr.ai",
  "version": "3.0.0",
  "modes": ["normal", "shield"],
  "stack": ["Node.js", "Express", "Vercel", "Multiple Social APIs"],
  "platforms": ["Twitter/X", "YouTube", "Bluesky", "Instagram"],
  "architecture": {
    "frontend": "public/index.html + public/integrations.html",
    "backend": "src/index.js",
    "integrations": "src/integrations/",
    "batch_runner": "src/batchRunner.js",
    "unified_cron": "cron_integrations.sh",
    "advanced_logging": "src/utils/advancedLogger.js",
    "reincidence_detection": "src/services/reincidenceDetector.js"
  },
  "endpoints": ["/", "/roast", "/csv-roast", "/api/integrations/*", "/api/shield/*", "/api/logs/*"],
  "integration_system": {
    "manager": "src/integrations/integrationManager.js",
    "base_class": "src/integrations/base/BaseIntegration.js",
    "services": {
      "youtube": "src/integrations/youtube/youtubeService.js",
      "twitter": "src/services/twitter.js",
      "bluesky": "src/integrations/bluesky/blueskyService.js",
      "instagram": "src/integrations/instagram/instagramService.js"
    }
  },
  "key_env_vars": {
    "core": ["OPENAI_API_KEY", "ROASTR_API_KEY"],
    "modes": ["ROASTR_MODE", "ROASTR_SHIELD_ENABLED"],
    "integration_control": ["INTEGRATIONS_ENABLED", "MAX_CONCURRENT_INTEGRATIONS"],
    "personalization": ["PLATFORM_TONE", "PLATFORM_HUMOR_TYPE", "PLATFORM_RESPONSE_FREQUENCY"],
    "shield_config": ["SHIELD_AUTO_ACTIONS", "PLATFORM_SHIELD_*"],
    "platforms": {
      "youtube": ["YOUTUBE_API_KEY", "YOUTUBE_CHANNEL_ID", "YOUTUBE_MONITORED_VIDEOS"],
      "twitter": ["TWITTER_BEARER_TOKEN", "TWITTER_ACCESS_TOKEN"],
      "bluesky": ["BLUESKY_HANDLE", "BLUESKY_PASSWORD"],
      "instagram": ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_APP_ID"]
    }
  },
  "deployment": "vercel --prod",
  "commands": {
    "api": "npm start",
    "cli": "npm run roast",
    "integrations_batch": "npm run integrations:batch",
    "integrations_test": "npm run integrations:test",
    "integrations_cron": "npm run integrations:cron",
    "legacy_twitter": "npm run twitter:batch"
  },
  "logging_system": {
    "types": ["normal", "integration", "shield", "security"],
    "locations": {
      "normal": "logs/[platform]_normal.log",
      "integration": "logs/integrations/[platform]_integration.log", 
      "shield": "logs/shield/[platform]_shield.log",
      "security": "logs/security/security.log"
    },
    "rotation": "automatic",
    "sensitive_content_warnings": true
  },
  "shield_features": {
    "reincidence_detection": true,
    "auto_actions": ["mute", "block", "report", "remove"],
    "severity_analysis": ["low", "medium", "high", "critical"],
    "user_tracking": "file_based_json",
    "action_logging": true
  },
  "personalization": {
    "tones": ["sarcastic", "ironic", "absurd"],
    "humor_types": ["witty", "clever", "playful"],
    "response_frequency": "0.0_to_1.0_configurable",
    "per_platform_config": true,
    "preview_generation": true
  },
  "cron_migration": {
    "old_script": "cron_twitter.sh",
    "new_script": "cron_integrations.sh",
    "old_logs": "logs/cron_twitter.log",
    "new_logs": "logs/cron_integrations.log"
  },
  "features": {
    "multi_platform": true,
    "dual_mode_operation": true,
    "batch_processing": true,
    "rate_limiting": true,
    "unified_monitoring": true,
    "graceful_shutdown": true,
    "concurrent_processing": true,
    "web_configuration_panel": true,
    "advanced_logging": true,
    "reincidence_tracking": true,
    "automatic_moderation": true,
    "tone_personalization": true,
    "frequency_control": true
  }
}
```