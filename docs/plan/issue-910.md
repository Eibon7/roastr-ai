# Plan: Issue #910 - Conectar Dashboard Frontend con Backend Real

**Fecha:** 2025-11-21
**Issue:** #910
**Branch:** `feature/issue-910`
**Prioridad:** High
**Owner:** Backend Developer + Frontend Developer

---

## 📊 Estado Actual

El dashboard frontend está configurado como sistema **mock-first** según `FRONTEND_DASHBOARD.md`:
- Usa datos simulados de `mockMode.js`
- Páginas `Connect.jsx`, `StyleProfile.jsx`, `Dashboard.jsx` con datos estáticos
- Widgets (`IntegrationsCard`, `UsageCostCard`, `PlanStatusCard`) sin conexión real
- Roast preview desconectado del backend

**El spec.md marca Issue #366 como completamente implementado**, pero el frontend no refleja datos reales del backend.

---

## 🎯 Objetivos / Acceptance Criteria

- [ ] **AC1:** Reemplazar llamadas mock por fetch reales a:
  - `/api/integrations`
  - `/api/usage`
  - `/api/plan/current`
  - `/api/roast/preview`
- [ ] **AC2:** Páginas `Connect.jsx`, `StyleProfile.jsx`, `Dashboard.jsx` y widgets muestran estados reales (loading, error, datos)
- [ ] **AC3:** Documentar env vars/feature flags a activar:
  - `REACT_APP_API_URL`
  - `ENABLE_SHOP`
  - `ENABLE_SHIELD_UI`
- [ ] **AC4:** Endpoints con autenticación requieren token Supabase/Session correctamente configurado
- [ ] **AC5:** Tests unitarios y Playwright visual validan nuevos flujos con datos reales
- [ ] **AC6:** Actualizar `FRONTEND_DASHBOARD.md` y `docs/nodes/social-platforms.md` reflejando cambios

---

## 📦 Nodos GDD Afectados

- **shield** - Dashboard necesita mostrar configuración Shield real
- **cost-control** - Integración con `/api/usage` para límites y consumo
- **roast** - Preview de roasts desde backend real
- **social-platforms** - Estado de integraciones activas (Twitter, YouTube)
- **persona** - Configuración de StyleProfile con datos reales
- **queue-system** - Estado de workers y jobs procesados (opcional, futuro)

---

## 🏗️ Pasos Propuestos

### FASE 1: Configuración Inicial

**Objetivo:** Habilitar comunicación frontend-backend

**Archivos:**
- `frontend/.env` (crear/actualizar)
- `frontend/lib/api/apiClient.js` (crear servicio HTTP)
- `backend/src/server.js` (verificar CORS)

**Tareas:**
1. **Configurar `REACT_APP_API_URL`:**
   ```bash
   # frontend/.env
   REACT_APP_API_URL=http://localhost:3000
   ```

2. **Crear servicio API cliente:**
   ```javascript
   // frontend/lib/api/apiClient.js
   import { createClient } from '@supabase/supabase-js';
   
   const supabase = createClient(
     process.env.REACT_APP_SUPABASE_URL,
     process.env.REACT_APP_SUPABASE_ANON_KEY
   );
   
   export async function fetchWithAuth(endpoint, options = {}) {
     const { data: session } = await supabase.auth.getSession();
     
     const headers = {
       'Content-Type': 'application/json',
       ...(session?.access_token && {
         'Authorization': `Bearer ${session.access_token}`
       }),
       ...options.headers
     };
     
     const response = await fetch(
       `${process.env.REACT_APP_API_URL}${endpoint}`,
       { ...options, headers }
     );
     
     if (!response.ok) {
       throw new Error(`API error: ${response.statusText}`);
     }
     
     return response.json();
   }
   ```

3. **Verificar CORS en backend:**
   ```javascript
   // src/server.js (verificar configuración existente)
   app.use(cors({
     origin: [
       'http://localhost:3001', // Frontend dev
       'http://localhost:5173', // Vite frontend
       process.env.FRONTEND_URL
     ],
     credentials: true
   }));
   ```

---

### FASE 2: Servicios de API

**Objetivo:** Crear servicios dedicados para cada endpoint

**Archivos a crear:**
- `frontend/lib/api/integrations.js`
- `frontend/lib/api/usage.js`
- `frontend/lib/api/plans.js`
- `frontend/lib/api/roast.js`

**1. Integrations Service**
```javascript
// frontend/lib/api/integrations.js
import { fetchWithAuth } from './apiClient';

export async function getIntegrations() {
  return fetchWithAuth('/api/integrations');
}

export async function connectPlatform(platform, credentials) {
  return fetchWithAuth('/api/integrations/connect', {
    method: 'POST',
    body: JSON.stringify({ platform, credentials })
  });
}

export async function disconnectPlatform(integrationId) {
  return fetchWithAuth(`/api/integrations/${integrationId}`, {
    method: 'DELETE'
  });
}
```

**2. Usage Service**
```javascript
// frontend/lib/api/usage.js
import { fetchWithAuth } from './apiClient';

export async function getCurrentUsage() {
  return fetchWithAuth('/api/usage');
}

export async function getUsageHistory(startDate, endDate) {
  const params = new URLSearchParams({ startDate, endDate });
  return fetchWithAuth(`/api/usage/history?${params}`);
}
```

**3. Plans Service**
```javascript
// frontend/lib/api/plans.js
import { fetchWithAuth } from './apiClient';

export async function getCurrentPlan() {
  return fetchWithAuth('/api/plan/current');
}

export async function upgradePlan(planId) {
  return fetchWithAuth('/api/plan/upgrade', {
    method: 'POST',
    body: JSON.stringify({ planId })
  });
}
```

**4. Roast Service**
```javascript
// frontend/lib/api/roast.js
import { fetchWithAuth } from './apiClient';

export async function previewRoast(commentText, toxicityScore, style) {
  return fetchWithAuth('/api/roast/preview', {
    method: 'POST',
    body: JSON.stringify({ commentText, toxicityScore, style })
  });
}
```

---

### FASE 3: Actualizar Componentes

**Objetivo:** Reemplazar mocks con llamadas reales

**Archivos a modificar:**
- `frontend/src/pages/Connect.jsx`
- `frontend/src/pages/StyleProfile.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/components/widgets/IntegrationsCard.jsx`
- `frontend/src/components/widgets/UsageCostCard.jsx`
- `frontend/src/components/widgets/PlanStatusCard.jsx`
- `frontend/src/components/widgets/StyleProfileCard.jsx`

**Patrón de actualización:**

**Antes (mock):**
```javascript
import { mockIntegrations } from '../lib/mockMode';

function Connect() {
  const integrations = mockIntegrations;
  // ...
}
```

**Después (real):**
```javascript
import { useEffect, useState } from 'react';
import { getIntegrations } from '../lib/api/integrations';

function Connect() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadIntegrations() {
      try {
        setLoading(true);
        const data = await getIntegrations();
        setIntegrations(data.integrations);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadIntegrations();
  }, []);

  if (loading) return <SkeletonLoader />;
  if (error) return <ErrorMessage error={error} retry={loadIntegrations} />;

  return (
    // ... renderizado con integrations
  );
}
```

---

### FASE 4: Manejo de Estados

**Objetivo:** Implementar loading, error, empty states

**Componentes a crear:**
- `frontend/src/components/states/SkeletonLoader.jsx`
- `frontend/src/components/states/ErrorMessage.jsx`
- `frontend/src/components/states/EmptyState.jsx`

**1. Skeleton Loader**
```javascript
// frontend/src/components/states/SkeletonLoader.jsx
export function SkeletonLoader({ type = 'card', count = 1 }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-200 rounded-lg h-32 dark:bg-gray-700" />
      ))}
    </div>
  );
}
```

**2. Error Message**
```javascript
// frontend/src/components/states/ErrorMessage.jsx
export function ErrorMessage({ error, retry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 className="text-red-800 font-semibold">Error</h3>
      <p className="text-red-600 text-sm mt-1">{error}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
```

**3. Empty State**
```javascript
// frontend/src/components/states/EmptyState.jsx
export function EmptyState({ title, description, action }) {
  return (
    <div className="text-center py-12">
      <h3 className="text-gray-600 font-semibold text-lg">{title}</h3>
      <p className="text-gray-500 text-sm mt-2">{description}</p>
      {action && (
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
          {action}
        </button>
      )}
    </div>
  );
}
```

---

### FASE 5: Validación de Credenciales

**Objetivo:** Asegurar autenticación correcta

**Script de verificación:**
```bash
# scripts/verify-dashboard-auth.js
const { createClient } = require('@supabase/supabase-js');

async function verifyAuth() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Test auth token
  const { data: session, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('❌ Auth error:', error.message);
    return false;
  }

  if (!session) {
    console.warn('⚠️  No session found');
    return false;
  }

  // Test authenticated endpoint
  const response = await fetch('http://localhost:3000/api/integrations', {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });

  if (response.ok) {
    console.log('✅ Auth verified, API responding');
    return true;
  } else {
    console.error(`❌ API error: ${response.status} ${response.statusText}`);
    return false;
  }
}

verifyAuth().then(success => process.exit(success ? 0 : 1));
```

---

### FASE 6: Testing

**Objetivo:** Validar nuevos flujos con tests

**Test files a crear:**

**1. Unit Tests (frontend)**
```javascript
// frontend/tests/unit/api/integrations.test.js
import { describe, it, expect, vi } from 'vitest';
import { getIntegrations, connectPlatform } from '../../../lib/api/integrations';

describe('Integrations API', () => {
  it('fetches integrations successfully', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        integrations: [
          { id: '1', platform: 'twitter', enabled: true }
        ]
      })
    }));

    const result = await getIntegrations();
    expect(result.integrations).toHaveLength(1);
    expect(result.integrations[0].platform).toBe('twitter');
  });

  it('handles network errors gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    await expect(getIntegrations()).rejects.toThrow('Network error');
  });
});
```

**2. Integration Tests (E2E)**
```javascript
// frontend/tests/e2e/dashboard-connect.spec.js
const { test, expect } = require('@playwright/test');

test('Connect page loads integrations from backend', async ({ page }) => {
  await page.goto('http://localhost:3001/connect');

  // Wait for loading to finish
  await page.waitForSelector('[data-testid="integrations-list"]', { timeout: 5000 });

  // Check Twitter integration appears
  const twitterCard = await page.locator('[data-testid="integration-twitter"]');
  await expect(twitterCard).toBeVisible();
  await expect(twitterCard).toContainText('Twitter');

  // Check status badge
  const statusBadge = twitterCard.locator('[data-testid="status-badge"]');
  await expect(statusBadge).toHaveText('Conectado'); // or 'Desconectado'
});

test('Shows error state when API fails', async ({ page, context }) => {
  // Block API requests to simulate failure
  await context.route('**/api/integrations', route => route.abort());

  await page.goto('http://localhost:3001/connect');

  // Check error message appears
  const errorMessage = await page.locator('[data-testid="error-message"]');
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContainText('Error');
});
```

**3. Visual Validation (Playwright)**
```javascript
// frontend/tests/visual/dashboard-states.spec.js
const { test } = require('@playwright/test');

test('Dashboard loading state', async ({ page }) => {
  await page.goto('http://localhost:3001/dashboard');
  
  // Capture loading skeleton
  await page.screenshot({
    path: 'docs/test-evidence/issue-910/dashboard-loading.png',
    fullPage: true
  });
});

test('Dashboard with data', async ({ page }) => {
  await page.goto('http://localhost:3001/dashboard');
  await page.waitForSelector('[data-testid="usage-card"]', { timeout: 5000 });
  
  // Capture loaded state
  await page.screenshot({
    path: 'docs/test-evidence/issue-910/dashboard-loaded.png',
    fullPage: true
  });
});

test('Dashboard error state', async ({ page, context }) => {
  await context.route('**/api/usage', route => route.abort());
  await page.goto('http://localhost:3001/dashboard');
  
  // Capture error state
  await page.screenshot({
    path: 'docs/test-evidence/issue-910/dashboard-error.png',
    fullPage: true
  });
});
```

---

### FASE 7: Documentación

**Objetivo:** Actualizar docs reflejando cambios

**Archivos a actualizar:**

**1. FRONTEND_DASHBOARD.md**
```markdown
# Frontend Dashboard - Backend Integration

**Status:** ✅ Connected to Backend (Issue #910)

## Environment Variables Required

\```bash
# Backend API
REACT_APP_API_URL=http://localhost:3000

# Supabase Auth
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Feature Flags
REACT_APP_ENABLE_SHOP=true
REACT_APP_ENABLE_SHIELD_UI=true
\```

## API Endpoints Used

- **GET /api/integrations** - List connected platforms
- **POST /api/integrations/connect** - Connect new platform
- **DELETE /api/integrations/:id** - Disconnect platform
- **GET /api/usage** - Current usage and limits
- **GET /api/plan/current** - User's current plan
- **POST /api/roast/preview** - Preview roast generation

## Authentication Flow

1. User logs in via Supabase Auth
2. Frontend stores session token
3. All API calls include `Authorization: Bearer <token>` header
4. Backend validates token via `authenticateToken` middleware
5. Returns data scoped to user's organization

## Error Handling

- **Network errors:** Retry with exponential backoff
- **401 Unauthorized:** Redirect to login
- **403 Forbidden:** Show upgrade prompt
- **404 Not Found:** Show empty state
- **500 Server Error:** Show error message with retry button

## Testing

\```bash
# Run unit tests
npm test -- api

# Run E2E tests
npm run test:e2e -- dashboard

# Visual validation
npm run test:visual
\```
```

**2. docs/nodes/social-platforms.md**
```markdown
## Dashboard Integration (Issue #910)

The frontend dashboard now connects to real platform integration data via:

- **GET /api/integrations** - Returns list of configured integrations with status
- **POST /api/integrations/connect** - Allows users to connect Twitter, YouTube, etc.
- **DELETE /api/integrations/:id** - Disconnect platform

Each integration shows:
- Platform name and icon
- Connection status (Conectado / Desconectado)
- Last sync timestamp
- Credentials status (valid / expired / missing)
- Actions: Connect, Disconnect, Reconfigure
```

**3. integration-status.json**
```json
{
  "lastUpdated": "2025-11-21T12:00:00Z",
  "dashboardIntegration": {
    "status": "connected",
    "issue": "910",
    "endpoints": {
      "/api/integrations": "✅ Connected",
      "/api/usage": "✅ Connected",
      "/api/plan/current": "✅ Connected",
      "/api/roast/preview": "✅ Connected"
    },
    "authentication": "Supabase JWT",
    "tested": true
  }
}
```

---

## 🎬 Agentes Asignados

### Backend Developer
- Verificar endpoints existentes: `/api/integrations`, `/api/usage`, `/api/plan/current`, `/api/roast/preview`
- Asegurar autenticación via middleware `authenticateToken`
- Verificar CORS configurado para frontend

### Frontend Developer
- Crear servicios API (integrations.js, usage.js, plans.js, roast.js)
- Actualizar páginas: Connect.jsx, StyleProfile.jsx, Dashboard.jsx
- Implementar estados: loading, error, empty
- Actualizar widgets para usar datos reales

### Test Engineer
- Tests unitarios para servicios API
- Tests E2E con Playwright
- Validación visual (screenshots de estados)
- Evidencias en `docs/test-evidence/issue-910/`

### Guardian
- Verificar que NO se exponen secretos en frontend
- Validar autenticación en todos los endpoints
- Verificar políticas RLS en Supabase

---

## ✅ Criterios de Éxito

**Pre-Merge Checklist:**
- [ ] Todos los mocks reemplazados por fetch reales
- [ ] Estados loading/error/empty implementados en todas las páginas
- [ ] Authentication funcionando con Supabase JWT
- [ ] Tests unitarios pasando (API services)
- [ ] Tests E2E pasando (Playwright)
- [ ] Evidencias visuales capturadas (3 estados × 3 viewports)
- [ ] `FRONTEND_DASHBOARD.md` actualizado
- [ ] `docs/nodes/social-platforms.md` actualizado
- [ ] `integration-status.json` actualizado
- [ ] GDD health ≥87
- [ ] Coverage ≥90%
- [ ] CodeRabbit = 0 comentarios

---

## 🚨 Riesgos y Mitigaciones

**Riesgo 1:** Endpoints backend no existen o tienen firma diferente
- **Mitigación:** Verificar endpoints con `curl` o Postman antes de integrar
- **Script:** `scripts/verify-dashboard-endpoints.sh`

**Riesgo 2:** CORS bloquea requests desde frontend
- **Mitigación:** Verificar configuración CORS en `src/server.js`
- **Test:** `npm run test:cors`

**Riesgo 3:** Autenticación falla por token expirado
- **Mitigación:** Implementar refresh token automático en `apiClient.js`
- **Fallback:** Redirigir a login si refresh falla

**Riesgo 4:** Performance degradado por llamadas síncronas
- **Mitigación:** Usar Promise.all() para parallelizar requests independientes
- **Optimización:** Implementar cache en frontend (5 min TTL)

---

## 📝 Notas de Implementación

- **Prioridad de endpoints:** `/api/integrations` > `/api/usage` > `/api/plan/current` > `/api/roast/preview`
- **Feature flags:** Verificar que `ENABLE_SHOP` y `ENABLE_SHIELD_UI` están habilitados
- **Tests:** Ejecutar en entorno staging primero antes de production
- **Rollback:** Mantener código mock comentado hasta verificar estabilidad

---

**Status:** ✅ PLAN COMPLETE - Ready to proceed with implementation
**Next Step:** FASE 1 - Configuración Inicial (crear `frontend/.env`, `apiClient.js`)

