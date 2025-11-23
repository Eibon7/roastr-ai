# Roastr.ai Twitter Bot

Un bot de Twitter que monitorea menciones automáticamente y responde con roasts generados por IA usando la API de Roastr.ai.

## 🚀 Características

- **Monitoreo en tiempo real** de menciones a tu cuenta de Twitter
- **Respuestas automáticas** con roasts generados por IA
- **Filtros anti-spam** y prevención de bucles infinitos
- **Modo debug** para desarrollo y testing
- **Modo dry-run** para pruebas sin enviar tweets reales
- **Arquitectura escalable** preparada para múltiples cuentas
- **Manejo robusto de errores** y reconexión automática

## 📋 Requisitos

- Node.js >= 16.0.0
- npm >= 8.0.0
- Cuenta de Twitter Developer con API v2 access
- API key de Roastr.ai

## 🛠️ Instalación

1. **Clonar e instalar dependencias:**

```bash
cd roastr-bot
npm install
```

2. **Configurar variables de entorno:**

```bash
cp .env.example .env
# Editar .env con tus credenciales reales
```

3. **Verificar configuración:**

```bash
npm run validate-env
```

## ⚙️ Configuración

### Variables de Entorno Requeridas

```env
# API de Roastr.ai
OPENAI_API_KEY=tu_openai_api_key
ROASTR_API_KEY=tu_roastr_api_key
ROAST_API_URL=https://tu-api-url.vercel.app

# Credenciales de Twitter API
TWITTER_BEARER_TOKEN=tu_bearer_token
TWITTER_APP_KEY=tu_app_key
TWITTER_APP_SECRET=tu_app_secret
TWITTER_ACCESS_TOKEN=tu_access_token
TWITTER_ACCESS_SECRET=tu_access_secret

# Configuración del bot
DEBUG=true
MENTION_POLL_INTERVAL_MS=30000
DRY_RUN=false
```

### Obtener Credenciales de Twitter

1. Ve a [Twitter Developer Portal](https://developer.twitter.com/)
2. Crea un nuevo proyecto y aplicación
3. Configura permisos de "Read and Write"
4. Genera las siguientes credenciales:
   - **Bearer Token** (OAuth 2.0)
   - **API Key & Secret** (Consumer Keys)
   - **Access Token & Secret** (Authentication Tokens)

## 🚀 Uso

### Modo Producción

```bash
npm start
```

### Modo Desarrollo (con debug)

```bash
npm run dev
```

### Modo Dry-Run (sin enviar tweets)

```bash
npm run dry-run
```

### Solo Debug

```bash
npm run debug
```

## 📁 Estructura del Proyecto

```
roastr-bot/
├── index.js                 # Punto de entrada principal
├── services/
│   ├── twitterService.js    # Conexión con Twitter API
│   └── roastService.js      # Llamadas a API de roasts
├── utils/
│   ├── logger.js            # Sistema de logging
│   └── filters.js           # Filtros de menciones
├── package.json
├── .env                     # Variables de entorno
└── README.md
```

## 🔧 Arquitectura

### Servicios

- **TwitterService**: Maneja conexiones con Twitter API, obtención de menciones y envío de respuestas
- **RoastService**: Gestiona llamadas a la API de Roastr.ai con retry logic y manejo de errores
- **Logger**: Sistema de logging configurable con soporte para modo debug
- **Filters**: Filtros para prevenir spam, duplicados y auto-respuestas

### Flujo de Funcionamiento

1. **Polling** → El bot consulta menciones cada 30 segundos (configurable)
2. **Filtrado** → Se filtran menciones ya procesadas, propias y spam
3. **Procesamiento** → Se extrae texto limpio de la mención
4. **Generación** → Se llama a la API de Roastr.ai para generar el roast
5. **Respuesta** → Se publica el tweet de respuesta
6. **Tracking** → Se marca la mención como procesada

## 🔍 Modo Debug

Cuando `DEBUG=true`:

```bash
[DEBUG] 2024-01-15T10:30:00.000Z: 📨 Nueva mención recibida: {...}
[DEBUG] 2024-01-15T10:30:01.000Z: 📡 POST https://api.roastr.ai/roast
[DEBUG] 2024-01-15T10:30:02.000Z: 🔥 Roast generado: "Tu comentario..."
[DEBUG] 2024-01-15T10:30:03.000Z: 💬 Respondido al tweet 123 con tweet 456
```

## 🧪 Modo Dry-Run

Cuando `DRY_RUN=true`:

- Se procesan menciones normalmente
- Se generan roasts reales
- **NO se envían tweets** (solo se loguean)
- Perfecto para testing y desarrollo

## 📊 Monitoreo

El bot muestra estadísticas cada 5 minutos:

```bash
[DEBUG] 📊 Bot Stats: {
  uptime: "45m 23s",
  processedMentions: 12,
  memoryUsage: "67MB"
}
```

## 🛡️ Características de Seguridad

### Filtros Anti-Spam

- No responde a sus propios tweets
- Evita procesar la misma mención dos veces
- Filtra contenido con muy poco texto
- Detecta y bloquea patrones de spam comunes

### Manejo de Rate Limits

- Respeta límites de la API de Twitter
- Implementa delays entre respuestas
- Retry automático con backoff exponencial
- Logging detallado de errores de rate limiting

### Gestión de Errores

- Reconexión automática en caso de fallos de red
- Continuación del servicio aunque falle una mención individual
- Logging completo de errores para debugging
- Graceful shutdown con Ctrl+C

## 🔮 Funcionalidades Futuras

### Multi-Cuenta (Preparado)

```javascript
// Futuro: soporte para múltiples clientes
const bot = new RoastrBot();
await bot.initializeForAccount('client-123', clientCredentials);
```

### Integración con CSV

```javascript
// Futuro: roasts desde CSV para respuestas más rápidas
const roast = await roastService.generateRoastFromCSV(text);
```

### Estilos de Roast

```javascript
// Futuro: diferentes personalidades de roast
const roast = await roastService.generateStyledRoast(text, {
  style: 'sarcastic',
  severity: 'mild'
});
```

## 🐛 Troubleshooting

### Error: "Invalid Twitter credentials"

- Verifica que todas las credenciales estén en el .env
- Asegúrate de que la app tenga permisos "Read and Write"
- Confirma que los tokens no hayan expirado

### Error: "API connection failed"

- Verifica que ROAST_API_URL sea correcto
- Confirma que ROASTR_API_KEY sea válido
- Revisa que la API esté online

### Rate Limit Exceeded

- El bot maneja esto automáticamente
- Reduce MENTION_POLL_INTERVAL_MS si es necesario
- Revisa logs para entender patrones de uso

### Bot no responde a menciones

- Activa DEBUG=true para ver el flujo completo
- Verifica que las menciones no estén siendo filtradas
- Confirma que el bot tenga permisos para ver menciones

## 📝 Logs y Debugging

### Niveles de Log

- **INFO**: Eventos importantes del bot
- **DEBUG**: Información detallada (solo si DEBUG=true)
- **ERROR**: Errores que requieren atención
- **WARN**: Advertencias que no detienen el bot

### Ejemplo de Session Log

```bash
[INFO] 🤖 Roastr.ai Twitter Bot inicializándose...
[INFO] 🚀 Inicializando servicios...
[INFO] 👤 Bot authenticated as @Roastr_ai (ID: 1196905150205562880)
[INFO] ✅ Todos los servicios inicializados correctamente
[INFO] 🚀 Iniciando Roastr.ai Twitter Bot...
[INFO] ✅ Bot iniciado - Monitoreando menciones cada 30000ms
[INFO] 📬 Procesando 2 menciones nuevas
[INFO] ✅ Mención 1234567890 procesada exitosamente
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

- 📧 Email: support@roastr.ai
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/roastr-ai-twitter-bot/issues)
- 📖 Docs: [Documentación completa](https://docs.roastr.ai)

---

**Desarrollado con ❤️ por el equipo de Roastr.ai**
