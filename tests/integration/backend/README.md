# Backend Integration Tests

Tests de integración para validar la comunicación entre el Social Networks Panel y el backend real.

## 📋 Objetivo

Validar que el panel funciona correctamente contra un backend real, cubriendo:

- **Autenticación** y carga inicial de cuentas
- **Gestión de Roasts** (GET, approve, reject)  
- **Shield Protection** (intercepted comments, filtros)
- **Account Settings** (GET, PUT operations)
- **Multi-cuenta** y operaciones concurrentes

## 🚀 Comandos de Ejecución

### Contra Backend Real (Staging)
```bash
# Tests completos contra backend staging
npm run test:integration-backend

# Solo un test específico
npm run test:integration-backend -- --testNamePattern="should load accounts"

# Con coverage
npm run test:integration-backend:coverage
```

### Contra Fixtures (Offline)
```bash
# Tests usando datos pre-guardados (más rápido)
npm run test:integration-backend:fixtures

# Actualizar fixtures desde staging
npm run fixtures:update:all
```

## 🔧 Configuración

### Variables de Entorno

Crear `.env.test.real`:
```env
# Backend Real Mode
REACT_APP_ENABLE_MOCK_MODE=false
USE_FIXTURES=false

# Staging API
REACT_APP_API_URL=http://localhost:3001
REACT_APP_STAGING_API_URL=https://staging-api.roastr.ai

# Autenticación de Test
TEST_USER_EMAIL=test-integration@roastr.ai
TEST_USER_PASSWORD=test-password-123
TEST_USER_AUTH_TOKEN=staging-jwt-token-here

# Configuración opcional
TEST_ACCOUNT_ID=acc_staging_default
INTEGRATION_TEST_TIMEOUT=30000
INTEGRATION_TEST_RETRIES=3
AUTO_UPDATE_FIXTURES=false
```

### Modos de Ejecución

| Modo | Mock Mode | Use Fixtures | Descripción |
|------|-----------|--------------|-------------|
| **Real Backend** | `false` | `false` | Contra staging real |
| **Fixtures** | `false` | `true` | Datos pre-guardados |
| **Mock** | `true` | `*` | Tests unitarios normales |

## 📁 Estructura

```
tests/integration/backend/
├── fixtures/           # Datos pre-guardados de staging
│   ├── accounts.json   # Respuestas de cuentas
│   ├── roasts.json     # Datos de roasts
│   ├── shield.json     # Items interceptados
│   └── settings.json   # Configuraciones
├── social/             # Tests por funcionalidad  
│   ├── auth-and-loading.test.js    # Autenticación y carga
│   ├── roasts.test.js              # Gestión de roasts
│   ├── shield.test.js              # Shield protection
│   └── settings.test.js            # Account settings
├── utils/
│   └── backendTestUtils.js         # Utilidades de test
└── setup/              # Configuración Jest
    ├── integrationSetup.js
    ├── globalSetup.js
    └── globalTeardown.js
```

## 🧪 Test Suites

### 1. Authentication and Loading
- ✅ Autenticación de usuario de test
- ✅ Carga inicial de cuentas desde `/api/social/accounts`
- ✅ Manejo de respuestas vacías (sin cuentas)
- ✅ Múltiples cuentas por red social
- ✅ Estadísticas agregadas correctas
- ✅ Redes disponibles para conexión

### 2. Roasts Management
- ✅ `GET /api/social/accounts/:id/roasts` → render en modal
- ✅ Conditional UI (botones approve/reject solo si `autoApprove=false`)
- ✅ `POST /api/social/accounts/:id/roasts/:roastId/approve`
- ✅ `POST /api/social/accounts/:id/roasts/:roastId/reject`
- ✅ Estados de loading y manejo de errores
- ✅ Operaciones concurrentes

### 3. Shield Protection
- ✅ `GET /api/social/accounts/:id/shield/intercepted`
- ✅ Filtrado por categoría (Insultos graves, Spam, etc.)
- ✅ Filtrado por acción tomada
- ✅ Estadísticas de Shield (total intercepted, effectiveness)
- ✅ Expandir detalles de items interceptados
- ✅ `PUT /api/social/accounts/:id/shield/settings`

### 4. Account Settings
- ✅ `GET /api/social/accounts/:id/settings` → valores iniciales
- ✅ `PUT /api/social/accounts/:id/settings` → cambios reflejados
- ✅ Toggle autoApprove, account status, default tone
- ✅ Shield settings (enabled, level)
- ✅ Validaciones y warnings del backend
- ✅ Multi-cuenta independiente

## 🔍 Fixtures System

### Generar/Actualizar Fixtures
```bash
# Actualizar todos los fixtures desde staging
npm run fixtures:update:all

# Actualizar fixture específico  
npm run fixtures:update accounts.json

# Con auto-update durante tests
AUTO_UPDATE_FIXTURES=true npm run test:integration-backend
```

### Estructura de Fixtures
```json
{
  "success": true,
  "data": { /* ... response data ... */ },
  "timestamp": "2024-02-01T15:30:00Z",
  "_metadata": {
    "updatedAt": "2024-02-01T15:30:00Z",
    "source": "staging-backend", 
    "version": "1.0.0"
  }
}
```

## 📊 Reporting

### Outputs Generados

- `tests/integration/backend/reports/integration-test-results.xml` - JUnit XML
- `tests/integration/backend/reports/integration-summary.json` - Resumen de ejecución
- `coverage/` - Coverage HTML reports (con `--coverage`)

### Métricas de Coverage

- **Global**: 75% lines, functions, statements; 70% branches
- **Específico por componente**: AccountModal, useSocialAccounts, social.ts

## 🐛 Troubleshooting

### Backend No Accesible
```
❌ Backend health check failed: connect ECONNREFUSED
💡 Falling back to fixture mode
```
**Solución**: Verificar que staging esté corriendo o usar modo fixtures.

### Token Expirado
```
❌ Authentication failed: HTTP 401: Unauthorized
```
**Solución**: Renovar `TEST_USER_AUTH_TOKEN` con token válido.

### Tests Lentos
```
Test timeout (30000ms)
```
**Solución**: Usar fixtures o aumentar `INTEGRATION_TEST_TIMEOUT`.

### Fixtures Desactualizados
```
❌ Failed to load fixture accounts.json: Invalid schema
```
**Solución**: `npm run fixtures:update:all` para regenerar.

## 🎯 Best Practices

1. **Usar fixtures por defecto** para desarrollo rápido
2. **Correr contra staging** antes de deploy
3. **Mantener fixtures actualizados** semanalmente
4. **Tests específicos** contra backend real para debugging
5. **Cleanup automático** de recursos de test

## 🔜 Roadmap

- [ ] **Performance tests** para endpoints lentos
- [ ] **Error simulation** (network failures, 500s)
- [ ] **Concurrency tests** para operaciones simultáneas
- [ ] **Cross-browser validation** en diferentes entornos
- [ ] **Load testing** para múltiples usuarios concurrentes