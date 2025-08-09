# Tests Documentation - Mock Mode Compatible

Esta documentación explica la estructura de tests del proyecto Roastr.ai, optimizada para funcionar en **Mock Mode** sin dependencias externas.

## 🎯 Filosofía de Testing

Los tests están diseñados con el principio **mock-first**, lo que significa:

- ✅ **100% funcionales sin APIs externas**
- ✅ **Compatibles con ENABLE_RQC=false**
- ✅ **Datos consistentes con backend real**
- ✅ **Ejecutables en CI/CD sin configuración**

## 📁 Estructura de Tests

### Backend Tests
```
tests/unit/
├── routes/
│   └── __tests__/
│       └── dashboard.test.js     # API endpoints tests
├── config/
│   └── __tests__/
│       └── flags.test.js         # Feature flags tests  
└── services/                     # Service layer tests
```

### Frontend Tests
```
frontend/src/
├── components/widgets/__tests__/
│   ├── PlanStatusCard.test.jsx
│   ├── IntegrationsCard.test.jsx
│   ├── HealthFlagsCard.test.jsx
│   └── LogsTableCard.test.jsx
└── pages/__tests__/
    ├── Dashboard.test.jsx
    └── Compose.test.jsx
```

## 🔧 Configuración de Tests

### Backend (Jest + Supertest)

```javascript
// Configuración automática para mock mode
beforeEach(() => {
  // Mock mode se activa automáticamente sin API keys
  process.env.MOCK_MODE = 'true';
  process.env.ENABLE_RQC = 'false'; // Default en mock mode
});
```

### Frontend (React Testing Library + Jest)

```javascript
// setupTests.js
import '@testing-library/jest-dom';

// Mock fetch globalmente
global.fetch = jest.fn();

beforeEach(() => {
  fetch.mockClear();
});
```

## 📊 Estructura de Datos Esperada vs Real

### Diferencias Documentadas

#### 1. `/api/health` Response

**✅ Estructura Real:**
```json
{
  "services": {
    "api": "ok",
    "billing": "degraded",
    "ai": "degraded", 
    "db": "degraded"
  },
  "flags": {
    "rqc": false,
    "shield": false,
    "mockMode": true,
    "verboseLogs": false
  },
  "timestamp": "2025-01-09T15:30:00Z",
  "status": "operational"
}
```

#### 2. `/api/user` Response  

**✅ Estructura Real:**
```json
{
  "id": "u_mock_user",
  "name": "Roastr User",
  "email": "user@roastr.ai",        // No "demo@roastr.ai"
  "plan": "pro", 
  "rqcEnabled": true,               // No "features.rqc"
  "avatar": "https://api.dicebear.com/...",
  "joinedAt": "2024-01-15T10:00:00Z",
  "lastActive": "2025-01-09T15:30:00Z"
}
```

**❌ NO incluye:** `usage`, `integrations`, `features` (están en endpoints separados)

#### 3. `/api/integrations` Response

**✅ En Mock Mode:**
```json
[
  {
    "name": "twitter",
    "displayName": "Twitter/X", 
    "status": "disconnected",       // Todas disconnected en mock
    "icon": "𝕏",
    "lastSync": null
  }
  // ... más plataformas, todas disconnected
]
```

#### 4. `/api/roast/preview` Payload

**✅ Payload Correcto:**
```json
{
  "text": "mensaje a roastear",          // No "message"
  "platform": "twitter",           // Requerido
  "intensity": 3                   // Requerido (1-5)
}
```

**✅ Response Esperada:**
```json
{
  "roast": "Your comment just called - it wants its logic back 📞",
  "intensity": 3,
  "platform": "twitter", 
  "confidence": 0.87,
  "processingTime": 750,
  "tokens": 65,
  "isMock": true                   // Siempre true en mock mode
}
```

## 🧪 Ejemplos de Tests Actualizados

### Backend API Test

```javascript
// ✅ Correcto - Adaptado a estructura real
test('returns system health status', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect(200);

  // mock-mode adjustment: Test actual structure
  expect(response.body.services).toHaveProperty('api');
  expect(response.body.services).toHaveProperty('billing'); 
  expect(response.body.services).toHaveProperty('ai');
  expect(response.body.services).toHaveProperty('db');
  
  expect(response.body.flags).toHaveProperty('mockMode');
  expect(response.body.flags.mockMode).toBe(true);
});
```

### Feature Flags Test

```javascript
// ✅ Correcto - Usando método isEnabled
test('loads ENABLE_RQC flag from environment', () => {
  process.env.ENABLE_RQC = 'true';
  const { flags } = require('../../../src/config/flags');
  
  // mock-mode adjustment: Use isEnabled method
  expect(flags.isEnabled('ENABLE_RQC')).toBe(true);
});
```

### Frontend Widget Test

```javascript
// ✅ Correcto - Mock fetch response
test('renders user data after API call', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      email: 'user@roastr.ai',      // Estructura real
      plan: 'pro',
      rqcEnabled: true,             // No features.rqc
      id: 'u_mock_user'
    })
  });

  render(<PlanStatusCard />);
  
  await waitFor(() => {
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });
});
```

## 🚀 Comandos de Testing

### Ejecutar Tests

```bash
# Backend tests
npm test                              # Todos los tests
npm test tests/unit/routes/           # Solo routes
npm test tests/unit/config/           # Solo config

# Frontend tests  
cd frontend && npm test               # Todos los frontend tests
npm test -- --watchAll=false         # Sin watch mode
npm test -- --coverage               # Con coverage

# Tests específicos
npm test dashboard.test.js            # Solo dashboard
npm test flags.test.js               # Solo feature flags
```

### Verificar Mock Mode

```bash
# Verificar que funciona sin API keys
unset OPENAI_API_KEY SUPABASE_URL STRIPE_SECRET_KEY
npm test

# Debería pasar 100% en mock mode
```

## ✅ Test Coverage Objetivo

### Backend Tests
- **Routes**: 100% endpoints cubiertos
- **Feature Flags**: 100% flags y métodos cubiertos  
- **Error Handling**: 100% casos de error cubiertos
- **Mock Responses**: 100% estructura real validada

### Frontend Tests  
- **Components**: 100% widgets cubiertos
- **Pages**: 100% rutas principales cubiertas
- **User Interactions**: 90% interacciones cubiertas
- **API Integration**: 100% calls mockeadas

## 🔍 Debugging Tests

### Logs Útiles

```javascript
// Ver response real durante tests
console.log('API Response:', JSON.stringify(response.body, null, 2));

// Ver flags activos
const { flags } = require('../../../src/config/flags');
console.log('Active flags:', flags.getAllFlags());

// Ver servicios detectados
console.log('Services:', flags.getServiceStatus());
```

### Tests Fallando

**Error común: "Cannot find module"**
```bash
# Verificar paths relativos
require('../../../../src/config/flags')  # Desde tests/unit/config/__tests__/
require('../../../src/config/flags')     # Path correcto
```

**Error: "Expected property not found"**
```javascript
// ❌ Estructura antigua esperada
expect(response.body).toHaveProperty('database');

// ✅ Estructura real actual  
expect(response.body.services).toHaveProperty('db');
```

## 📈 Monitoreo de Tests

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test              # Backend tests
      - run: cd frontend && npm install
      - run: cd frontend && npm test  # Frontend tests
    env:
      MOCK_MODE: true             # Forzar mock mode en CI
      ENABLE_RQC: false          # Default para tests
```

### Métricas de Éxito

- ✅ **100% tests pasando** en mock mode sin APIs externas
- ✅ **<5 segundos** tiempo total de ejecución  
- ✅ **0 warnings** relacionados con estructura de datos
- ✅ **Cobertura >90%** en componentes críticos

## 🎯 Mejores Prácticas

### 1. Tests Mock-First
```javascript
// ✅ Bueno - Funciona sin APIs
test('generates roast in mock mode', async () => {
  const response = await request(app)
    .post('/api/roast/preview')  
    .send({ text: 'test', platform: 'twitter', intensity: 3 })
    .expect(200);
    
  expect(response.body.isMock).toBe(true);
});
```

### 2. Estructura de Datos Real
```javascript  
// ✅ Bueno - Usa estructura actual del backend
expect(response.body.services).toHaveProperty('db');

// ❌ Malo - Usa estructura antigua
expect(response.body.services).toHaveProperty('database'); 
```

### 3. Feature Flags Correctos
```javascript
// ✅ Bueno - Usa API actual
const { flags } = require('../config/flags');
expect(flags.isEnabled('ENABLE_RQC')).toBe(false);

// ❌ Malo - Acceso directo inexistente
expect(flags.ENABLE_RQC).toBe(false);
```

### 4. Comentarios de Adaptación
```javascript
test('test description', async () => {
  // mock-mode adjustment: Explicación del cambio
  expect(response.body.email).toBe('user@roastr.ai'); // No demo@
});
```

## 📝 Troubleshooting

### Tests Lentos
- ✅ Usar `fetch.mockResolvedValueOnce()` en lugar de real HTTP
- ✅ Evitar `setTimeout` innecesarios en tests
- ✅ Usar `jest.useFakeTimers()` para tiempo mock

### Mock Inconsistencies  
- ✅ Verificar que mocks coinciden con backend real
- ✅ Mantener estructura de response actualizada
- ✅ Documentar diferencias en comentarios

### Flaky Tests
- ✅ Usar `waitFor()` para elementos asincrónicos  
- ✅ Limpiar mocks con `beforeEach()`
- ✅ Evitar dependencias de tiempo real

---

## 🔄 Mantenimiento

Este documento se actualiza cuando:
- 📝 Se modifica estructura de API responses
- 🔧 Se agregan nuevos feature flags  
- 🧪 Se crean nuevos tipos de tests
- 🐛 Se encuentran inconsistencias mock vs real

**Última actualización:** Enero 2025 - Adaptación completa a Mock Mode