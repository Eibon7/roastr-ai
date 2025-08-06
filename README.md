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

## ⏱️ Automatización con Cron Jobs

Para ejecutar el bot automáticamente cada X minutos usando cron jobs de macOS:

### 🚀 Configuración Rápida

1. **Verificar script disponible:**
   ```bash
   npm run twitter:batch:single  # Debe ejecutar en modo single y terminar
   ```

2. **Dar permisos al script de cron:**
   ```bash
   chmod +x cron_twitter.sh
   ```

3. **Configurar crontab:**
   ```bash
   crontab -e
   ```
   
   **💡 Tip:** Puedes copiar desde `crontab.example` una de estas líneas según el intervalo deseado:
   ```bash
   # Cada 5 minutos
   */5 * * * * /Users/emiliopostigo/roastr-ai/cron_twitter.sh
   
   # Cada 10 minutos
   */10 * * * * /Users/emiliopostigo/roastr-ai/cron_twitter.sh
   
   # Cada 15 minutos
   */15 * * * * /Users/emiliopostigo/roastr-ai/cron_twitter.sh
   
   # Cada 30 minutos
   */30 * * * * /Users/emiliopostigo/roastr-ai/cron_twitter.sh
   
   # Cada hora
   0 * * * * /Users/emiliopostigo/roastr-ai/cron_twitter.sh
   ```

### 📊 Monitoreo y Logs

**Ver logs en tiempo real:**
```bash
tail -f /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log
```

**Ver últimos logs:**
```bash
tail -n 50 /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log
```

**Limpiar logs antiguos:**
```bash
> /Users/emiliopostigo/roastr-ai/logs/cron_twitter.log
```

### 🔧 Gestión del Cron Job

**Ver cron jobs activos:**
```bash
crontab -l
```

**Pausar el bot (comentar línea en crontab):**
```bash
crontab -e
# Añadir # al inicio de la línea para desactivarla
# */5 * * * * /Users/emiliopostigo/roastr-ai/cron_twitter.sh
```

**Desactivar completamente:**
```bash
crontab -r  # ⚠️ Esto elimina TODOS los cron jobs
```

### 🛠️ Troubleshooting

**El cron job no funciona:**
1. Verificar permisos: `ls -la cron_twitter.sh` (debe mostrar `-rwxr-xr-x`)
2. Probar manualmente: `./cron_twitter.sh`
3. Verificar ruta de npm: `which npm` (debe ser `/usr/local/bin/npm`)
4. Revisar logs del sistema: `tail -f /var/log/cron`

**Logs vacíos o sin actualizar:**
1. Verificar que el script tiene permisos de escritura en `logs/`
2. Ejecutar manualmente: `npm run twitter:batch:single`
3. Revisar variables de entorno en el servidor

**Rate limiting de Twitter:**
1. Aumentar intervalo en crontab (ej: de */5 a */15 minutos)
2. Verificar límites en el dashboard de Twitter Developer
3. Ajustar `MAX_TWEETS_PER_HOUR` en `.env`

### 📱 Ejemplos de Intervalos Recomendados

| Intervalo | Línea Crontab | Uso Recomendado |
|-----------|---------------|-----------------|
| 5 minutos | `*/5 * * * *` | Respuesta rápida, para cuentas activas |
| 15 minutos | `*/15 * * * *` | Balance entre respuesta y límites API |
| 30 minutos | `*/30 * * * *` | Conservador, ideal para empezar |
| 1 hora | `0 * * * *` | Muy conservador, cuentas con pocas menciones |

**💡 Recomendación:** Empezar con 15 minutos y ajustar según la actividad de menciones y límites de API.

## Resumen Técnico para IA

```json
{
  "name": "Roastr.ai",
  "stack": ["Node.js", "Express", "Vercel", "Twitter API"],
  "endpoints": ["/", "/roast", "/csv-roast"],
  "env_vars": ["OPENAI_API_KEY", "ROASTR_API_KEY", "DEBUG", "TWITTER_BEARER_TOKEN", "TWITTER_APP_KEY", "TWITTER_APP_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET"],
  "deployment": "vercel --prod",
  "frontend": "public/index.html",
  "backend": "src/index.js",
  "twitter_bot": "src/services/twitter.js",
  "commands": {
    "api": "npm start",
    "cli": "npm run roast",
    "twitter_stream": "npm run twitter:stream",
    "twitter_batch": "npm run twitter:batch",
    "twitter": "npm run twitter"
  }
}
```