# Social Networks Panel Documentation

Panel de gestión de redes sociales para Roastr.AI con soporte multi-cuenta y configuración por red.

## Características Principales

### ✅ Multi-Account Support

- Soporte para múltiples cuentas por red social (ej: 3 cuentas de Twitter, 2 de Instagram)
- Vista unificada con cards por cuenta conectada
- Estadísticas agregadas en tiempo real

### ✅ Account Management Modal

- **Tab de Roasts**: Últimos roasts generados con aprobación/rechazo manual
- **Tab de Shield**: Estadísticas de protección y comentarios interceptados
- **Tab de Settings**: Configuración de cuenta, tono por defecto, y Shield

### ✅ Optimistic UI + Rollback

- Actualización inmediata de UI para mejor UX
- Rollback automático si la API falla
- Estados de loading en botones de acción

### ✅ Ready for Backend Integration

- SDK API mock completamente preparado para intercambiar por calls reales
- Firmas de API documentadas y consistentes
- Manejo de errores y paginación incluido

## Arquitectura

### Componentes Principales

```
src/pages/AccountsPage.js          # Página principal con sidebar y grid de cuentas
src/components/AccountModal.js     # Modal de gestión con 3 tabs
src/components/AccountCard.js      # Card individual por cuenta
src/components/NetworkConnectModal.js  # Modal para conectar nueva red
src/components/ShieldInterceptedList.js # Lista de comentarios interceptados
```

### Hook Central

```javascript
// src/hooks/useSocialAccounts.js
const {
  // Data
  accounts,
  availableNetworks,

  // Getters
  getAccountById,
  roastsByAccount,
  interceptedByAccount,

  // Stats
  totalAccounts,
  activeAccounts,
  totalMonthlyRoasts,

  // Mutators (async con optimistic UI)
  onApproveRoast,
  onRejectRoast,
  onToggleAutoApprove,
  onToggleAccount,
  onChangeShieldLevel,
  onToggleShield,
  onChangeTone,
  onConnectNetwork,
  onDisconnectAccount
} = useSocialAccounts();
```

### API SDK

```javascript
// src/api/social.ts - Mock implementation ready for backend
import socialAPI from '../api/social';

// Roasts
await socialAPI.getRoasts(accountId, { limit: 10, cursor: 'page2' });
await socialAPI.approveRoast(accountId, roastId);
await socialAPI.rejectRoast(accountId, roastId);

// Shield
await socialAPI.getShieldIntercepted(accountId, { limit: 10 });
await socialAPI.updateShieldSettings(accountId, { enabled: true, threshold: 95 });

// Settings
await socialAPI.updateAccountSettings(accountId, {
  active: true,
  autoApprove: false,
  defaultTone: 'Comico'
});

// Connection
await socialAPI.connectNetwork('twitter'); // Returns OAuth URL
await socialAPI.disconnectAccount(accountId);
```

## Flujos de UI

### 1. Página Principal (/accounts)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Sidebar]           │ Header + Stats Cards                      │
│  • Settings (active)│ ┌─────┐ ┌─────┐ ┌─────┐                   │
│  • Shop             │ │  3  │ │  2  │ │4.3k │                   │
│  • Usuario          │ │Ctas │ │Actv │ │Roasts│                   │
│                     │ └─────┘ └─────┘ └─────┘                   │
│                     │                                           │
│                     │ Mis redes conectadas                      │
│                     │ ┌────────┐ ┌────────┐ ┌────────┐         │
│                     │ │ @usr_1 │ │ @usr_2 │ │@insta_1│         │
│                     │ │   𝕏    │ │   𝕏    │ │   📷   │         │
│                     │ │ 4.0k   │ │  300   │ │   26   │         │
│                     │ │ Activa │ │ Activa │ │Inactv. │         │
│                     │ └────────┘ └────────┘ └────────┘         │
│                     │                                           │
│                     │ Conectar otra cuenta                      │
│                     │ 𝕏 📷 📘 📺 🎵 💼                         │
│                     │ 2  1  0  0  0  0                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Account Modal (3 Tabs)

#### Tab 1: Últimos Roasts

- Lista de roasts recientes con comentario original y respuesta generada
- **Conditional Logic**: Botones Aprobar/Rechazar solo si `autoApprove = false` y `status = 'pending'`
- Loading states en botones durante API calls
- Estados: pending, approved, rejected

#### Tab 2: Shield

- Stats de protección (interceptados, nivel actual, reportados)
- Lista expandible de comentarios interceptados por Shield
- Categorías: "Insultos graves", "Spam", "Toxicidad"
- Acciones: "Ocultar comentario", "Reportar", "Bloquear usuario"

#### Tab 3: Settings

- **Auto-approval toggle**: Roasts se publican sin revisión
- **Shield toggle + level**: Protección automática con umbral configurable
- **Default tone**: Comico, Sarcástico, Seco, Afilado
- **Account status**: Activa/Pausada
- **Danger Zone**: Desconectar cuenta con confirmación

## Mock Data Structure

### Account Object

```javascript
{
  id: 'acc_tw_1',
  network: 'twitter',
  handle: '@handle_1',
  status: 'active', // 'active' | 'inactive'
  monthlyRoasts: 4000,
  settings: {
    autoApprove: true,
    shieldEnabled: true,
    shieldLevel: 95, // 90-98 threshold
    defaultTone: 'Comico'
  }
}
```

### Roast Object

```javascript
{
  id: 'r1',
  original: 'Tu código es una basura',
  roast: 'Mi código será basura, pero al menos compila. ¿El tuyo qué excusa tiene?',
  createdAt: '2025-08-01T12:15:00Z',
  status: 'pending' // 'pending' | 'approved' | 'rejected'
}
```

### Intercepted Object

```javascript
{
  id: 's1',
  category: 'Insultos graves',
  action: 'Ocultar comentario',
  preview: '***censurado***',
  originalHidden: 'Contenido censurado por Shield',
  createdAt: '2025-08-03T11:40:00Z'
}
```

## Testing

### Coverage Actual

- **AccountModal.test.js**: 20 tests, 92.68% líneas, 90.9% funciones
- **useSocialAccounts.test.js**: 21 tests, 73.33% líneas, 94.87% funciones
- **social.test.js**: 15+ tests para API SDK mock

### Comandos Test

```bash
# Frontend tests (mock mode enabled)
cd frontend
npm run test:ci

# Coverage report
npm run test:ci -- --coverage
```

## Backend Integration Guide

### 1. Replace API Mock Implementation

Cambiar implementación interna en `src/api/social.ts`:

```typescript
// Actual implementation
export const approveRoast = async (accountId: string, roastId: string) => {
  const response = await fetch(
    buildApiUrl(`/social/accounts/${accountId}/roasts/${roastId}/approve`),
    {
      method: 'POST',
      headers: getAuthHeaders()
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to approve roast: ${response.statusText}`);
  }

  return response.json();
};
```

### 2. API Endpoints Needed

```
POST   /api/social/accounts/{accountId}/roasts/{roastId}/approve
POST   /api/social/accounts/{accountId}/roasts/{roastId}/reject
GET    /api/social/accounts/{accountId}/roasts?limit=10&cursor=xyz
GET    /api/social/accounts/{accountId}/shield/intercepted?limit=10&cursor=xyz
PUT    /api/social/accounts/{accountId}/shield/settings
PUT    /api/social/accounts/{accountId}/settings
POST   /api/social/networks/{network}/connect
DELETE /api/social/accounts/{accountId}
```

### 3. Expected Response Format

```javascript
// Paginated responses
{
  data: [/* items */],
  pagination: {
    hasMore: boolean,
    nextCursor?: string
  }
}

// Action responses
{
  success: boolean
}
```

## UX Features

### ✅ Optimistic UI

- Immediate visual feedback
- Automatic rollback on error
- Loading indicators durante calls

### 🔄 Planned Features

- **Toast notifications** para success/error messages
- **Cursor pagination** en roasts e intercepted lists
- **Empty states** mejorados
- **Accessibility** improvements (focus management, ARIA labels)

## Deployment

### Mock Mode (Current)

```bash
# Frontend build with mocks
REACT_APP_ENABLE_MOCK_MODE=true npm run build
```

### Production Mode (Future)

```bash
# Frontend build with real API
REACT_APP_ENABLE_MOCK_MODE=false \
REACT_APP_API_URL=https://api.roastr.ai \
npm run build
```

El panel está completamente funcional en mock mode y listo para integración backend sin cambios en los componentes UI.
