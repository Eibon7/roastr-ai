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

**Funcionalidad:** El bot monitorea menciones a tu cuenta en Twitter/X y responde automáticamente con roasts generados por IA.

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
# Ejecutar una vez
npm run twitter

# El bot procesará menciones recientes y responderá con roasts
```

### Características del bot:

- **Detección de toxicidad:** Actualmente usa un stub que siempre permite roasts (preparado para Perspective API)
- **Prevención de duplicados:** No responde dos veces al mismo tweet
- **Rate limiting:** Añade delays entre respuestas para evitar límites de API
- **Manejo de errores:** Continúa procesando aunque falle un tweet individual
- **Logging detallado:** Muestra todo el proceso paso a paso

### Archivos generados:

- `data/processed_tweets.json`: Lista de tweets ya procesados (evita duplicados)

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
npm run twitter
```

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
    "twitter": "npm run twitter"
  }
}
```