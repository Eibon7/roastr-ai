# Plan: EPIC 1052 - User App Settings

**Epic:** #1052 User App — Settings  
**Fecha:** 2025-01-27  
**Estado:** En progreso  
**Worktree:** `epic-1052-settings`

---

## Objetivo

Implementar página de configuración del usuario con navegación por tabs y rutas anidadas para Cuenta, Ajustes y Billing.

---

## Issues Relacionadas

1. **#1053** - Implementar navegación por tabs en Settings
2. **#1054** - Implementar tab de Cuenta (/app/settings/account)
3. **#1055** - Implementar tab de Ajustes (/app/settings/preferences)
4. **#1056** - Implementar tab de Billing (/app/settings/billing)

---

## Estado Actual

- ✅ Existe `frontend/src/pages/Settings.jsx` con tabs implementados
- ✅ Rutas actuales: `/app/settings` (componente único con tabs internos)
- ❌ No hay rutas anidadas: `/app/settings/account`, `/app/settings/preferences`, `/app/settings/billing`
- ❌ Tabs no sincronizados con URL (no hay navegación por URL)

---

## Arquitectura Propuesta

### Estructura de Rutas (React Router)

```
/app/settings
  ├─ /app/settings (redirect a /app/settings/account)
  ├─ /app/settings/account → AccountSettingsPage
  ├─ /app/settings/preferences → PreferencesSettingsPage
  └─ /app/settings/billing → BillingSettingsPage
```

### Componentes a Crear

1. **SettingsLayout.jsx** - Layout con tabs compartido
2. **AccountSettingsPage.jsx** - Tab de Cuenta
3. **PreferencesSettingsPage.jsx** - Tab de Ajustes
4. **BillingSettingsPage.jsx** - Tab de Billing

### Componentes de Formulario

1. **AccountSettingsForm.jsx** - Formulario de cuenta
2. **PersonaSettingsForm.jsx** - Formulario de persona (Issue #1055)
3. **SponsorSettingsForm.jsx** - Formulario de sponsor (Issue #1055)
4. **BillingPanel.jsx** - Panel de billing (Issue #1056)

---

## FASE 1: Issue #1053 - Navegación por Tabs

### Objetivo

Crear estructura de rutas anidadas con tabs sincronizados con URL.

### Tareas

- [ ] Crear `SettingsLayout.jsx` con componente Tabs
- [ ] Configurar rutas anidadas en `App.js`
- [ ] Sincronizar tabs con URL usando `useLocation` y `useNavigate`
- [ ] Redirigir `/app/settings` a `/app/settings/account`
- [ ] Tests de navegación

### Archivos a Modificar

- `frontend/src/App.js` - Añadir rutas anidadas
- `frontend/src/components/settings/SettingsLayout.jsx` - Nuevo componente
- `frontend/src/pages/settings/AccountSettingsPage.jsx` - Nuevo (placeholder)

### Dependencias

- #1036 (layout app creado) ✅

---

## FASE 2: Issue #1054 - Tab de Cuenta

### Objetivo

Implementar tab "Cuenta" con email, cambiar contraseña, GDPR y logout.

### Acceptance Criteria

- [ ] Tab "Cuenta" visible en `/app/settings/account`
- [ ] Mostrar email del usuario (no editable)
- [ ] Botón "Cambiar contraseña" → llama a `/api/auth/reset-password`
- [ ] Botón "Descargar mis datos" → endpoint `/api/gdpr/export`
- [ ] Botón "Logout" funcional → `/api/auth/logout`
- [ ] Feedback visual (toast) tras acciones

### Tareas

- [ ] Crear `AccountSettingsPage.jsx`
- [ ] Crear `AccountSettingsForm.jsx`
- [ ] Conectar a endpoints:
  - `POST /api/auth/reset-password` - Reset password
  - `GET /api/gdpr/export` - Export data
  - `POST /api/auth/logout` - Logout
- [ ] Implementar toast de confirmación
- [ ] Tests unitarios e integración

### Archivos a Crear

- `frontend/src/pages/settings/AccountSettingsPage.jsx`
- `frontend/src/components/settings/AccountSettingsForm.jsx`

### Archivos a Modificar

- `frontend/src/components/settings/SettingsLayout.jsx` - Añadir tab "account"

---

## FASE 3: Issue #1055 - Tab de Ajustes

### Objetivo

Implementar tab "Ajustes" con campos de Roastr persona, copy de transparencia, prompt personalizado y configuración de Sponsor.

### Acceptance Criteria

- [ ] Tab "Ajustes" visible en `/app/settings/preferences`
- [ ] Campos de Roastr persona: bio, tono, preferencias
- [ ] Copy explicando transparencia (roasts firmados como IA)
- [ ] Prompt de estilo personalizado visible solo si: Plan Pro/Plus + feature flag ON
- [ ] Configuración de Sponsor visible solo si: Plan Plus
- [ ] Persistencia vía API
- [ ] Feedback visual (toast)

### Tareas

- [ ] Crear `PreferencesSettingsPage.jsx`
- [ ] Crear `PersonaSettingsForm.jsx`
  - Campos: `lo_que_me_define`, `lo_que_no_tolero`, `lo_que_me_da_igual`
  - Plan gating: Starter+ (2 campos), Pro+ (3 campos)
- [ ] Crear `SponsorSettingsForm.jsx`
  - Visible solo si: Plan Plus
  - Configuración de sponsor
- [ ] Añadir copy de transparencia
- [ ] Implementar lógica de visibilidad por plan + feature flag
- [ ] Conectar a endpoints:
  - `GET /api/persona` - Obtener persona
  - `POST /api/persona` - Actualizar persona
  - `GET /api/sponsor` - Obtener sponsor
  - `POST /api/sponsor` - Actualizar sponsor
- [ ] Tests unitarios e integración

### Archivos a Crear

- `frontend/src/pages/settings/PreferencesSettingsPage.jsx`
- `frontend/src/components/settings/PersonaSettingsForm.jsx`
- `frontend/src/components/settings/SponsorSettingsForm.jsx`

### Archivos a Modificar

- `frontend/src/components/settings/SettingsLayout.jsx` - Añadir tab "preferences"

### Dependencias

- Nodo GDD: `persona` (Issue #595, #615)
- Feature flags: `ENABLE_CUSTOM_PROMPT`

---

## FASE 4: Issue #1056 - Tab de Billing

### Objetivo

Implementar tab "Billing" con método de pago, info del plan, fecha de cobro, upgrade y cancelación.

### Acceptance Criteria

- [ ] Tab "Billing" visible en `/app/settings/billing`
- [ ] Mostrar método de pago actual (últimos 4 dígitos)
- [ ] Info del plan: nombre, fecha del próximo cobro
- [ ] Si plan cancelado: "Roastr.AI estará activo hasta [fecha]"
- [ ] Botón "Upgrade plan" → navegación a `/app/plans`
- [ ] Botón "Cancelar suscripción" → confirmación y llamada a API
- [ ] Datos obtenidos de endpoint `/api/billing`

### Tareas

- [ ] Crear `BillingSettingsPage.jsx`
- [ ] Crear `BillingPanel.jsx`
- [ ] Conectar a endpoint `/api/billing`
- [ ] Implementar confirmación de cancelación con dialog
- [ ] Manejo de errores
- [ ] Tests unitarios e integración

### Archivos a Crear

- `frontend/src/pages/settings/BillingSettingsPage.jsx`
- `frontend/src/components/settings/BillingPanel.jsx`

### Archivos a Modificar

- `frontend/src/components/settings/SettingsLayout.jsx` - Añadir tab "billing"

### Dependencias

- Nodo GDD: `cost-control`
- Endpoint: `/api/billing` (verificar existencia)

---

## Validación

### Tests Requeridos

- [ ] Tests de navegación entre tabs
- [ ] Tests de rutas anidadas
- [ ] Tests de formularios (account, persona, sponsor, billing)
- [ ] Tests de integración con APIs
- [ ] Tests de visibilidad por plan
- [ ] Tests de feature flags

### GDD Validations

- [ ] `node scripts/validate-gdd-runtime.js --full`
- [ ] `node scripts/score-gdd-health.js --ci` (>=87)
- [ ] Actualizar nodos: `persona`, `cost-control`, `roast`
- [ ] Añadir "Agentes Relevantes" en nodos

### Coverage

- [ ] Coverage >=90% para nuevos componentes
- [ ] Coverage Source: auto (NUNCA manual)

---

## Agentes a Invocar

- **FrontendDev** - Implementación de componentes UI
- **TestEngineer** - Tests unitarios e integración
- **Guardian** - Validación de seguridad (GDPR, auth, billing)

---

## Receipts Requeridos

- `docs/agents/receipts/epic-1052-frontend.md`
- `docs/agents/receipts/epic-1052-test-engineer.md`
- `docs/agents/receipts/epic-1052-guardian.md`

---

## Notas Técnicas

### Adaptación de Next.js a React Router

Las issues mencionan rutas como `app/(app)/app/settings/page.tsx` (sintaxis Next.js), pero el proyecto usa React Router. Adaptación:

- Next.js: `app/(app)/app/settings/page.tsx` → React Router: `frontend/src/pages/settings/SettingsLayout.jsx`
- Next.js: `app/(app)/app/settings/account/page.tsx` → React Router: `frontend/src/pages/settings/AccountSettingsPage.jsx`

### Sincronización URL-Tabs

Usar `useLocation` y `useNavigate` para sincronizar tabs con URL:

```javascript
const location = useLocation();
const navigate = useNavigate();
const activeTab = location.pathname.split('/').pop() || 'account';

const handleTabChange = (value) => {
  navigate(`/app/settings/${value}`);
};
```

---

## Estimación

- **Issue #1053:** 4-6 horas
- **Issue #1054:** 6-8 horas
- **Issue #1055:** 8-10 horas
- **Issue #1056:** 6-8 horas
- **Total:** 24-32 horas (3-4 días)

---

**Última actualización:** 2025-01-27

