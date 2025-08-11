# Mock Mode - Sistema de Desarrollo Sin Dependencias

## 🎯 Descripción General

El **Mock Mode** es una funcionalidad clave de Roastr.ai que permite el desarrollo y testing completo del sistema sin requerir APIs externas, bases de datos o servicios de terceros. Este modo se activa automáticamente cuando faltan claves de API críticas.

## 🔧 Activación del Mock Mode

### Activación Automática

El sistema detecta automáticamente cuándo activar el mock mode:

```javascript
// src/config/flags.js
shouldUseMockMode() {
  const criticalKeys = [
    'OPENAI_API_KEY',
    'PERSPECTIVE_API_KEY', 
    'SUPABASE_URL'
  ];
  
  return criticalKeys.some(key => !process.env[key]);
}

// Mock mode se activa cuando:
MOCK_MODE = process.env.MOCK_MODE === 'true' || this.shouldUseMockMode()
```

### Activación Manual

```bash
# Forzar mock mode
MOCK_MODE=true npm start

# Deshabilitar mock mode (si tienes las APIs)
MOCK_MODE=false npm start
```

### Indicadores Visuales

**En el TopBar del frontend:**
- 🟡 **"Mock Mode"** badge cuando está activo
- 🟢 **"Live"** badge cuando usa APIs reales

## 📊 Datos Mock Generados

### 1. Información de Usuario (`/api/user`)

```json
{
  "id": "u_mock_user",
  "name": "Roastr User", 
  "email": "user@roastr.ai",
  "plan": "pro",
  "rqcEnabled": true,
  "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=RoastrUser",
  "joinedAt": "2024-01-15T10:00:00Z",
  "lastActive": "2025-01-09T15:30:00Z"
}
```

### 2. Estado del Sistema (`/api/health`)

```json
{
  "services": {
    "api": "ok",
    "billing": "degraded", 
    "ai": "degraded",
    "db": "degraded"
  },
  "flags": {
    "rqc": true,
    "shield": false,
    "mockMode": true,
    "verboseLogs": false
  },
  "timestamp": "2025-01-09T15:30:00Z",
  "status": "operational"
}
```

### 3. Integraciones de Plataformas (`/api/integrations`)

```json
[
  {
    "name": "twitter",
    "displayName": "Twitter/X",
    "status": "disconnected",
    "icon": "𝕏",
    "lastSync": null
  },
  {
    "name": "youtube", 
    "displayName": "YouTube",
    "status": "disconnected",
    "icon": "▶️",
    "lastSync": null
  }
  // ... más plataformas
]
```

### 4. Logs del Sistema (`/api/logs`)

Genera logs realistas con diferentes niveles:

```json
[
  {
    "id": "log_1705678200000_0",
    "level": "info",
    "message": "Roast generated successfully for user",
    "timestamp": "2025-01-09T15:30:00Z",
    "service": "api",
    "metadata": {
      "userId": "user_123",
      "platform": "twitter"
    }
  },
  {
    "id": "log_1705678140000_1", 
    "level": "warn",
    "message": "Mock mode active - some features limited",
    "timestamp": "2025-01-09T15:29:00Z",
    "service": "worker"
  }
]
```

### 5. Estadísticas de Uso (`/api/usage`)

```json
{
  "tokens": 35000,
  "aiCalls": 250,
  "rqcCalls": 75,
  "costCents": 320,
  "period": {
    "start": "2024-12-10T00:00:00Z",
    "end": "2025-01-09T15:30:00Z"
  },
  "breakdown": {
    "roastGeneration": 280,
    "toxicityAnalysis": 150, 
    "rqcReviews": 75,
    "platformSync": 45
  },
  "limits": {
    "tokensLimit": 100000,
    "aiCallsLimit": 1000,
    "rqcCallsLimit": 500
  }
}
```

### 6. Preview de Roasts (`/api/roast/preview`)

**Request:**
```json
{
  "text": "Tu comentario para roastear",
  "platform": "twitter",
  "intensity": 3
}
```

**Response:**
```json
{
  "roast": "Your comment just called - it wants its logic back 📞",
  "intensity": 3,
  "platform": "twitter",
  "confidence": 0.87,
  "processingTime": 750,
  "tokens": 65,
  "isMock": true
}
```

**Roasts por intensidad:**
- **Intensity 1**: Comentarios suaves y amigables
- **Intensity 2**: Crítica constructiva con humor
- **Intensity 3**: Roasts creativos y divertidos
- **Intensity 4**: Comentarios más directos
- **Intensity 5**: Roasts épicos y memorables

## 🔄 Comportamiento de Features

### Feature Flags en Mock Mode

| Feature | Mock Mode | Comportamiento |
|---------|-----------|----------------|
| **ENABLE_RQC** | `false` | RQC deshabilitado por defecto |
| **ENABLE_SHIELD** | `false` | Shield protection no disponible |
| **ENABLE_REAL_OPENAI** | `false` | Usa roasts pre-generados |
| **ENABLE_REAL_TWITTER** | `false` | APIs de Twitter simuladas |
| **ENABLE_BILLING** | `false` | Portal de billing mock |
| **VERBOSE_LOGS** | `false` | Logging normal |

### Servicios Simulados

**✅ OpenAI API:**
- Roast generation → Respuestas pre-escritas por intensidad
- Toxicity detection → Simulación basada en palabras clave

**✅ Perspective API:**
- Toxicity scores → Valores aleatorios realistas (0.1 - 0.9)
- Attribute detection → Mock data

**✅ Database (Supabase):**
- User data → JSON estático
- Logs → Generación dinámica en memoria
- Metrics → Valores calculados dinámicamente

**✅ Payment (Stripe):**
- Billing portal → URL mock (#mock-portal)
- Webhooks → Eventos simulados

**✅ Social Media APIs:**
- Todas las plataformas → Status "disconnected"
- Sync operations → Simulación exitosa

## 🧪 Testing en Mock Mode

### Ventajas para Testing

1. **Determinismo**: Los mocks son predecibles
2. **Velocidad**: No hay latencia de red
3. **Reliability**: No depende de servicios externos
4. **Coverage**: Puedes testear edge cases fácilmente

### Configuración de Tests

```javascript
// tests/setup.js
beforeAll(() => {
  process.env.MOCK_MODE = 'true';
  process.env.OPENAI_API_KEY = ''; // Force mock mode
});

beforeEach(() => {
  global.fetch = jest.fn();
});
```

### Casos de Test

```javascript
describe('Mock Mode Behavior', () => {
  test('should return mock roast when OpenAI unavailable', async () => {
    const response = await request(app)
      .post('/api/roast/preview')
      .send({ text: 'test message', intensity: 3 })
      .expect(200);

    expect(response.body.isMock).toBe(true);
    expect(response.body.roast).toBeDefined();
    expect(response.body.intensity).toBe(3);
  });

  test('should show degraded services in health check', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.services.ai).toBe('degraded');
    expect(response.body.flags.mockMode).toBe(true);
  });
});
```

## 🚀 Transición a Modo Producción

### 1. Configurar Variables de Entorno

```bash
# .env
OPENAI_API_KEY=sk-your-real-key
PERSPECTIVE_API_KEY=your-perspective-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Opcional: Forzar modo real
MOCK_MODE=false
```

### 2. Verificar Transición

**Indicators que el sistema salió de mock mode:**
- ✅ TopBar muestra badge "Live" en lugar de "Mock Mode"
- ✅ `/api/health` muestra servicios con status "ok"
- ✅ Roasts generados tienen `isMock: false`
- ✅ Datos reales de bases de datos

### 3. Testing en Modo Producción

```javascript
describe('Production Mode', () => {
  beforeAll(() => {
    process.env.MOCK_MODE = 'false';
    process.env.OPENAI_API_KEY = 'real-key';
  });

  test('should call real OpenAI API', async () => {
    // Test con API real
  });
});
```

## 📈 Métricas y Monitoring

### Logs de Mock Mode

```javascript
// Cuando está activo
console.log('🟡 Mock Mode Active - Using simulated data');

// Cuando se desactiva  
console.log('🟢 Production Mode - Using real APIs');
```

### Health Check Monitoring

```bash
# Check si mock mode está activo
curl localhost:3000/api/health | jq '.flags.mockMode'
# true = mock mode activo
# false = usando APIs reales
```

## 🎯 Casos de Uso

### Para Desarrolladores

```bash
# Desarrollo local sin APIs
git clone repo
npm install
npm start  # Mock mode se activa automáticamente
```

### Para Testing

```bash
# Tests rápidos sin external dependencies
npm test  # Todos los tests usan mocks
```

### Para Demos

```bash
# Demo con datos realistas sin configuración
MOCK_MODE=true npm start
# Sistema completo funcionando en 30 segundos
```

### Para CI/CD

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
  env:
    MOCK_MODE: true  # Fuerza mock mode en CI
```

## ⚠️ Limitaciones del Mock Mode

### Funcionalidades No Disponibles

1. **Real-time data**: Los datos no se actualizan desde fuentes reales
2. **External integrations**: Las conexiones a plataformas son simuladas
3. **Real AI generation**: Los roasts son pre-escritos, no generados
4. **Real billing**: Los pagos y subscripciones son simulados
5. **Real authentication**: Login/registro limitado

### Datos Mock vs Real

| Aspecto | Mock | Real |
|---------|------|------|
| **Response time** | 200-1000ms | Variable |
| **Data accuracy** | Simulated | Live |
| **Rate limits** | None | API specific |
| **Costs** | $0 | API usage costs |
| **Reliability** | 100% | Depends on APIs |

## 🔍 Debugging Mock Mode

### Verificar Estado Actual

```javascript
// En browser console
fetch('/api/health')
  .then(r => r.json())
  .then(d => console.log('Mock Mode:', d.flags.mockMode));
```

### Environment Variables

```bash
# Ver todas las variables relacionadas
env | grep -E "(MOCK|OPENAI|PERSPECTIVE|SUPABASE)"
```

### Logs de Desarrollo

```javascript
// src/config/flags.js añade logs
console.log('🔧 Mock Mode Detection:', {
  MOCK_MODE: process.env.MOCK_MODE,
  shouldUseMock: this.shouldUseMockMode(),
  finalValue: this.MOCK_MODE
});
```

---

## 💡 Mejores Prácticas

1. **Develop in Mock Mode first**: Construye features sin depender de APIs externas
2. **Test with both modes**: Asegúrate que funciona en mock y producción
3. **Clear indicators**: Siempre muestra visual feedback del modo activo
4. **Graceful degradation**: Si APIs fallan, vuelve a mock mode automáticamente
5. **Realistic mock data**: Los mocks deben ser representativos de datos reales

El Mock Mode permite desarrollo rápido, testing confiable y demos instantáneas sin configuración compleja.