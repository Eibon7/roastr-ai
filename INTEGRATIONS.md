# 🔗 Roastr.ai - Plan de Integraciones Futuras

Este documento describe la arquitectura y plan de implementación para integrar Roastr.ai con diferentes plataformas de redes sociales.

## 🏗️ Arquitectura General

### Estructura de Carpetas

```
src/integrations/
├── youtube/
│   ├── youtubeService.js     # Servicio principal de YouTube
│   ├── commentProcessor.js   # Procesador de comentarios
│   └── oauth.js             # Manejo OAuth 2.0
├── bluesky/
│   ├── blueskyService.js    # Servicio principal de Bluesky
│   ├── atProtocol.js        # Cliente AT Protocol
│   └── firehose.js          # Stream de datos en tiempo real
├── instagram/
│   ├── instagramService.js  # Servicio principal de Instagram
│   ├── graphAPI.js          # Cliente Graph API
│   └── webhooks.js          # Manejo de webhooks
└── base/
    ├── BaseIntegration.js   # Clase base para todas las integraciones
    ├── RateLimiter.js       # Control de límites de velocidad unificado
    └── ContentFilter.js     # Filtros de contenido comunes
```

### Patrón de Diseño

Todas las integraciones seguirán el patrón **Strategy Pattern** con una clase base común que define la interfaz estándar:

```javascript
class BaseIntegration {
  // Métodos requeridos por todas las integraciones
  async authenticate()
  async listenForMentions()
  async processComment(comment)
  async generateResponse(comment, tone)
  async postResponse(parentId, response)

  // Métodos opcionales con implementación por defecto
  async validatePermissions()
  async handleRateLimit()
  async logActivity()
}
```

## 📺 YouTube Integration

### Funcionalidades Objetivo

- Monitorear comentarios en videos específicos
- Responder a comentarios que mencionen palabras clave
- Sistema de moderación automática con Perspective API
- Dashboard para gestionar canales monitoreados

### APIs Requeridas

- **YouTube Data API v3**: Para leer comentarios y responder
- **YouTube Analytics API**: Para métricas opcionales
- **OAuth 2.0**: Para autenticación de canal

### Configuración Necesaria

```env
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REFRESH_TOKEN=your_refresh_token
YOUTUBE_CHANNEL_ID=your_channel_id
YOUTUBE_MONITORED_VIDEOS=video_id_1,video_id_2
```

### Implementación Técnica

```javascript
// Ejemplo de estructura del servicio
class YouTubeService extends BaseIntegration {
  async listenForMentions() {
    // Polling cada 5 minutos de comentarios nuevos
    // Filtrar por palabras clave configurables
    // Procesar solo comentarios no respondidos
  }

  async processComment(comment) {
    // Validar que no sea spam
    // Verificar toxicidad con Perspective API
    // Generar roast apropiado
    // Responder al comentario
  }
}
```

### Limitaciones de la API

- **Cuota diaria**: ~10,000 unidades por día
- **Rate limiting**: 100 requests por 100 segundos
- **Comentarios**: Solo canales propios o públicos

## 🦋 Bluesky Integration

### Funcionalidades Objetivo

- Monitoreo en tiempo real del firehose AT Protocol
- Respuestas automáticas a menciones
- Integración con feeds personalizados
- Sistema de moderación distribuida

### Protocolo Utilizado

- **AT Protocol**: Protocolo descentralizado de Bluesky
- **Firehose**: Stream en tiempo real de todos los posts
- **XRPC**: Para llamadas a servicios distribuidos

### Configuración Necesaria

```env
BLUESKY_HANDLE=your_handle.bsky.social
BLUESKY_PASSWORD=your_password
BLUESKY_SERVICE_URL=https://bsky.social
BLUESKY_FIREHOSE_URL=wss://bsky.social/xrpc/com.atproto.sync.subscribeRepos
```

### Implementación Técnica

```javascript
class BlueskyService extends BaseIntegration {
  async listenForMentions() {
    // Conectar al firehose WebSocket
    // Filtrar por menciones a nuestro handle
    // Procesar posts en tiempo real
  }

  async processComment(post) {
    // Verificar que es una mención válida
    // Generar respuesta contextual
    // Crear reply usando AT Protocol
  }
}
```

### Ventajas de Bluesky

- **Sin límites de API estrictos** (por ahora)
- **Datos en tiempo real** via firehose
- **Descentralización** permite mayor control
- **Comunidad técnica** más receptiva a bots

## 📸 Instagram Integration

### Funcionalidades Objetivo

- Monitorear comentarios en posts específicos
- Responder a mentions en stories (si es posible)
- Integración con Instagram Business API
- Análisis de sentiment en comentarios

### APIs Requeridas

- **Instagram Graph API**: Para comentarios y respuestas
- **Instagram Basic Display API**: Para contenido personal
- **Webhooks**: Para notificaciones en tiempo real

### Configuración Necesaria

```env
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_USER_ID=your_user_id
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_webhook_token
```

### Implementación Técnica

```javascript
class InstagramService extends BaseIntegration {
  async listenForMentions() {
    // Configurar webhooks para comentarios
    // Procesar notificaciones en tiempo real
    // Fallback: polling cada 10 minutos
  }

  async processComment(comment) {
    // Validar permisos de respuesta
    // Verificar contexto del post
    // Generar respuesta apropiada para la audiencia
  }
}
```

### Limitaciones de Instagram

- **Restricciones estrictas** para bots automatizados
- **Requiere Instagram Business Account**
- **Rate limits agresivos**: 200 requests/hora
- **Aprobación manual** para ciertas funcionalidades

## 🛠️ Componentes Comunes

### 1. BaseIntegration.js

Clase abstracta que define la interfaz común para todas las integraciones:

```javascript
class BaseIntegration {
  constructor(config) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimits);
    this.contentFilter = new ContentFilter(config.filters);
    this.roastGenerator = new RoastGeneratorReal();
  }

  // Métodos abstractos que cada integración debe implementar
  async authenticate() {
    throw new Error('Must implement authenticate()');
  }
  async listenForMentions() {
    throw new Error('Must implement listenForMentions()');
  }
  async postResponse(parentId, response) {
    throw new Error('Must implement postResponse()');
  }

  // Métodos comunes con implementación base
  async processComment(comment, platform) {
    // Lógica común de procesamiento
    // Filtrado de contenido
    // Generación de roast
    // Logging y métricas
  }
}
```

### 2. RateLimiter.js

Control unificado de límites de velocidad para todas las plataformas:

```javascript
class RateLimiter {
  constructor(limits) {
    this.limits = limits; // Por plataforma
    this.windows = new Map(); // Ventanas deslizantes
  }

  async canMakeRequest(platform, endpoint) {
    // Verificar límites específicos por plataforma y endpoint
    // Implementar sliding window algorithm
    // Retornar tiempo de espera si es necesario
  }

  recordRequest(platform, endpoint) {
    // Registrar request para tracking de límites
  }
}
```

### 3. ContentFilter.js

Filtros de contenido y moderación comunes:

```javascript
class ContentFilter {
  constructor(config) {
    this.perspectiveAPI = new PerspectiveAPI(config.perspectiveKey);
    this.customFilters = config.customFilters || [];
  }

  async shouldProcessComment(comment, platform) {
    // Verificar toxicidad con Perspective API
    // Aplicar filtros personalizados
    // Verificar longitud y formato
    // Detectar spam y contenido duplicado
  }
}
```

## 🚀 Plan de Implementación

### Fase 1: Infraestructura Base (Semana 1-2)

- [ ] Crear estructura de carpetas
- [ ] Implementar BaseIntegration.js
- [ ] Implementar RateLimiter.js y ContentFilter.js
- [ ] Crear tests unitarios para componentes base

### Fase 2: YouTube Integration (Semana 3-4)

- [ ] Implementar YouTubeService.js
- [ ] Configurar OAuth 2.0 flow
- [ ] Implementar polling de comentarios
- [ ] Sistema de respuestas automáticas
- [ ] Dashboard básico de administración

### Fase 3: Bluesky Integration (Semana 5-6)

- [ ] Implementar cliente AT Protocol
- [ ] Conectar al firehose en tiempo real
- [ ] Sistema de filtrado de menciones
- [ ] Integración con feeds personalizados

### Fase 4: Instagram Integration (Semana 7-8)

- [ ] Configurar Instagram Graph API
- [ ] Implementar sistema de webhooks
- [ ] Manejo de comentarios y respuestas
- [ ] Sistema de aprobación manual para respuestas sensibles

### Fase 5: Optimización y Monitoreo (Semana 9-10)

- [ ] Dashboard unificado para todas las plataformas
- [ ] Métricas y analytics detallados
- [ ] Sistema de alertas y monitoreo
- [ ] Optimización de performance y costos

## ⚙️ Configuración y Deployment

### Estructura de Configuración

```javascript
// config/integrations.js
module.exports = {
  enabled: process.env.INTEGRATIONS_ENABLED?.split(',') || ['twitter'],

  youtube: {
    enabled: process.env.YOUTUBE_ENABLED === 'true',
    clientId: process.env.YOUTUBE_CLIENT_ID
    // ... más configuraciones
  },

  bluesky: {
    enabled: process.env.BLUESKY_ENABLED === 'true',
    handle: process.env.BLUESKY_HANDLE
    // ... más configuraciones
  },

  instagram: {
    enabled: process.env.INSTAGRAM_ENABLED === 'true',
    appId: process.env.INSTAGRAM_APP_ID
    // ... más configuraciones
  }
};
```

### Variables de Entorno Adicionales

```env
# Control general de integraciones
INTEGRATIONS_ENABLED=twitter,youtube
MAX_CONCURRENT_INTEGRATIONS=3
INTEGRATION_DEBUG_MODE=false

# Configuración de filtros globales
GLOBAL_MIN_COMMENT_LENGTH=5
GLOBAL_MAX_COMMENT_LENGTH=280
GLOBAL_BANNED_WORDS=spam,bot,fake
GLOBAL_TOXICITY_THRESHOLD=0.7

# Configuración de rate limiting global
GLOBAL_MAX_RESPONSES_PER_HOUR=50
GLOBAL_MIN_DELAY_BETWEEN_RESPONSES=30000
```

## 📊 Métricas y Monitoreo

### KPIs por Integración

- **Comentarios procesados por hora**
- **Respuestas generadas exitosamente**
- **Rate limit violations**
- **Errores de API por tipo**
- **Tiempo promedio de respuesta**
- **Engagement rate** (likes, replies a nuestras respuestas)

### Alertas Automáticas

- API credentials próximos a expirar
- Rate limits alcanzados frecuentemente
- Errores de autenticación
- Comentarios con alta toxicidad sin procesar
- Downtime de servicios externos

## 🔐 Seguridad y Compliance

### Consideraciones de Seguridad

- **Rotación automática** de tokens de acceso
- **Encriptación** de credentials sensibles
- **Logging seguro** sin exponer datos personales
- **Validación estricta** de input de usuarios
- **Rate limiting defensivo** para prevenir abuse

### Compliance y Privacidad

- **GDPR compliance** para usuarios europeos
- **Términos de servicio** claros para cada plataforma
- **Opt-out mechanism** para usuarios que no deseen interacción
- **Data retention policies** definidas
- **Audit logs** para todas las operaciones

---

_Este documento será actualizado según evolucionen los requerimientos y capacidades de cada plataforma._
