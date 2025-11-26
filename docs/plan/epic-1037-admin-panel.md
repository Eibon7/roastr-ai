# Epic #1037: Admin Panel - Plan de Implementación

**Status:** En progreso  
**Owner:** FrontendDev  
**Priority:** High  
**Creado:** 2025-11-26

---

## 📋 Resumen de la Epic

Implementar panel completo de administración con gestión de usuarios, configuración, y métricas usando shadcn/ui + React.

### Issues Relacionadas

| Issue | Título                                                 | Prerequisitos | Status |
| ----- | ------------------------------------------------------ | ------------- | ------ |
| #1036 | Crear estructura de layouts (auth, admin, app)         | #1033, #1034  | 🔶     |
| #1063 | Implementar guards de rutas (admin, auth)              | #1059         | 🔶     |
| #1038 | Implementar página de usuarios (/admin/users)          | #1036         | ⏸️     |
| #1039 | Gestión de feature flags (/admin/config/feature-flags) | #1036         | ⏸️     |
| #1040 | Configuración de planes (/admin/config/plans)          | #1036         | ⏸️     |
| #1041 | Gestión de tonos (/admin/config/tones)                 | #1036         | ⏸️     |
| #1042 | Panel de métricas (/admin/metrics)                     | #1036, #1038  | ⏸️     |

---

## 🎯 Estado Actual

### Arquitectura Existente

**Backend:**

- Express.js en `src/index.js`
- API endpoints en `src/routes/`
- Auth con JWT (Supabase)
- Multi-tenant con RLS

**Frontend:**

- HTML estático en `public/`
- JS vanilla en `public/js/`
- CSS custom en `public/css/`
- NO usa React actualmente

**Panel Admin Actual:**

- `public/admin.html` - HTML estático con secciones
- `public/js/admin.js` - Lógica en vanilla JS (733 líneas)
- `public/css/admin.css` - Estilos custom

### Dependencias Disponibles

**En package.json:**

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.8.0",
  "tailwindcss": "^4.1.17"
}
```

**⚠️ Problemas:**

- React NO está configurado (no hay build process)
- No hay Vite/Webpack/CRA configurado
- No hay shadcn/ui instalado
- No hay estructura de componentes React

---

## 🚀 Estrategia de Implementación

### Opción 1: React SPA con Vite (RECOMENDADA)

**Ventajas:**

- ✅ Desarrollo moderno con HMR
- ✅ shadcn/ui funciona perfectamente
- ✅ TypeScript support
- ✅ Build optimizado para producción

**Desventajas:**

- ⏱️ Setup inicial (30-60 min)
- 🔄 Migración progresiva de páginas

**Estructura propuesta:**

```
frontend/               # Nueva carpeta Vite
  ├── src/
  │   ├── components/
  │   │   ├── ui/           # shadcn components
  │   │   ├── layout/       # Layouts (AdminShell, AppShell, AuthLayout)
  │   │   ├── admin/        # Admin-specific components
  │   │   └── app/          # User app components
  │   ├── lib/
  │   │   ├── api.ts        # API client
  │   │   └── utils.ts      # Helpers
  │   ├── pages/
  │   │   ├── admin/
  │   │   │   ├── users.tsx
  │   │   │   ├── metrics.tsx
  │   │   │   ├── config/
  │   │   │   │   ├── feature-flags.tsx
  │   │   │   │   ├── plans.tsx
  │   │   │   │   └── tones.tsx
  │   │   ├── app/          # User routes
  │   │   └── auth/         # Auth routes
  │   ├── App.tsx           # Main router
  │   └── main.tsx          # Entry point
  ├── index.html
  ├── vite.config.ts
  ├── tailwind.config.ts
  └── components.json       # shadcn config
```

### Opción 2: Hybrid (HTML + Progressive React islands)

**Ventajas:**

- 🚀 Rápido para empezar
- 🔄 Migración muy gradual

**Desventajas:**

- ❌ shadcn/ui difícil de usar
- ❌ Sin HMR ni DX moderno
- ❌ Complejidad de gestionar dos mundos

### ✅ Decisión: **Opción 1 - Vite SPA**

Vamos a crear un SPA moderno que reemplace progresivamente las páginas estáticas.

---

## 📐 Fases de Implementación

### 🔵 FASE 0: Setup Inicial (COMPLETADA)

- [x] GDD activation
- [x] Leer nodos resueltos (cost-control, multi-tenant, plan-features)
- [x] Leer coderabbit-lessons.md
- [x] Crear worktree dedicado
- [x] Crear `.issue_lock`

---

### 🟢 FASE 1: Configuración Base Vite + shadcn (Issue #1033 prerequisite)

**Goal:** Setup completo de Vite + React + Tailwind + shadcn/ui

**Tasks:**

1. **Inicializar Vite project**

   ```bash
   npm create vite@latest frontend -- --template react-ts
   cd frontend
   npm install
   ```

2. **Configurar Tailwind**

   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

3. **Instalar shadcn/ui**

   ```bash
   npx shadcn-ui@latest init
   # Configurar:
   # - TypeScript: Yes
   # - Style: Default
   # - Base color: Slate
   # - CSS variables: Yes
   # - Tailwind config: Yes
   # - Import alias: @/
   ```

4. **Configurar rutas y estructura**
   - Crear carpetas según estructura propuesta
   - Configurar React Router
   - Configurar proxy a backend en `vite.config.ts`

5. **ThemeProvider setup**
   - Instalar `next-themes`
   - Configurar provider en `App.tsx`
   - Crear `ThemeToggle` component

**Entregables:**

- [ ] `frontend/` folder con Vite configurado
- [ ] shadcn/ui funcionando
- [ ] Tema claro/oscuro/sistema operativo
- [ ] Hot reload funcionando
- [ ] Proxy a `http://localhost:3000` (backend)

**Validation:**

```bash
cd frontend
npm run dev
# Abrir http://localhost:5173
# Verificar que carga sin errores
# Toggle tema funciona
```

---

### 🟡 FASE 2: Layouts Base (Issue #1036)

**Goal:** Implementar estructura de layouts reutilizable

**Tasks:**

1. **AuthLayout (minimal)**
   - Sin sidebar ni navegación
   - Centrado vertical
   - Logo + branding
   - Para `/login`, `/register`, `/recover`

2. **AdminShell (sidebar + topbar)**
   - Sidebar con navegación admin:
     - Dashboard
     - Users
     - Config (con submenu: Plans, Feature Flags, Tones)
     - Metrics
     - Logs
   - Topbar con:
     - Search bar
     - Theme toggle
     - User menu (con logout)
   - Sheet/Drawer para móvil
   - Responsive (collapse sidebar en tablet)

3. **AppShell (topbar only)**
   - Topbar con:
     - Logo
     - Navegación: Home, Accounts, Settings
     - Theme toggle
     - User menu
   - Sin sidebar
   - Responsive con hamburger menu

**Componentes shadcn necesarios:**

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add avatar
```

**Usar MCP Commands:**

```bash
# Para AdminShell
/cui Create an admin layout with a collapsible sidebar showing Dashboard,
    Users, Config (submenu), Metrics, and Logs. Include a topbar with search,
    theme toggle, and user dropdown menu. Add mobile drawer for responsive design.

# Para AppShell
/cui Create a user app layout with a topbar showing logo, Home/Accounts/Settings
    navigation links, theme toggle, and user menu. Responsive with hamburger menu
    for mobile.

# Para AuthLayout
/cui Create a minimal centered auth layout with logo, heading, description,
    and a card for the auth form. Clean and modern design.
```

**Entregables:**

- [ ] `src/components/layout/auth-layout.tsx`
- [ ] `src/components/layout/admin-shell.tsx`
- [ ] `src/components/layout/app-shell.tsx`
- [ ] `src/components/layout/main-nav.tsx`
- [ ] `src/components/layout/mobile-nav.tsx`
- [ ] `src/components/layout/user-menu.tsx`
- [ ] `src/components/layout/theme-toggle.tsx`
- [ ] Responsive en móvil/tablet/desktop

**Validation:**

- [ ] Layouts renderizan correctamente
- [ ] Navegación funciona
- [ ] Theme toggle cambia tema
- [ ] Mobile drawer abre/cierra
- [ ] Sidebar collapse funciona
- [ ] User menu despliega opciones

**Tests:**

- [ ] `tests/components/layout/admin-shell.test.tsx` (rendering + interactions)
- [ ] `tests/components/layout/app-shell.test.tsx`
- [ ] `tests/components/layout/theme-toggle.test.tsx`

**Visual Evidence:**

- [ ] Screenshots en claro/oscuro
- [ ] Screenshots en móvil/tablet/desktop
- [ ] Video de navegación (opcional)

---

### 🔵 FASE 3: Auth Guards & Routing (Issue #1063)

**Goal:** Proteger rutas con auth + admin guards

**Tasks:**

1. **AuthProvider setup**
   - Context para auth state
   - Token management (localStorage)
   - User data caching
   - Auto-refresh token

2. **AuthGuard component**
   - Verifica si usuario autenticado
   - Redirige a `/login` si no
   - Muestra loading mientras verifica

3. **AdminGuard component**
   - Verifica `isAdmin` flag
   - Redirige a `/app` si no es admin
   - Hereda de AuthGuard

4. **Protected Routes setup**

   ```tsx
   <Routes>
     <Route path="/login" element={<LoginPage />} />

     <Route
       path="/app/*"
       element={
         <AuthGuard>
           <AppShell>
             <Routes>
               <Route index element={<HomePage />} />
               <Route path="accounts" element={<AccountsPage />} />
               <Route path="settings" element={<SettingsPage />} />
             </Routes>
           </AppShell>
         </AuthGuard>
       }
     />

     <Route
       path="/admin/*"
       element={
         <AdminGuard>
           <AdminShell>
             <Routes>
               <Route index element={<DashboardPage />} />
               <Route path="users" element={<UsersPage />} />
               <Route path="metrics" element={<MetricsPage />} />
               <Route path="config/plans" element={<PlansPage />} />
               <Route path="config/feature-flags" element={<FeatureFlagsPage />} />
               <Route path="config/tones" element={<TonesPage />} />
             </Routes>
           </AdminShell>
         </AdminGuard>
       }
     />
   </Routes>
   ```

**Entregables:**

- [ ] `src/lib/auth-context.tsx` (AuthProvider)
- [ ] `src/lib/guards/auth-guard.tsx`
- [ ] `src/lib/guards/admin-guard.tsx`
- [ ] `src/App.tsx` con rutas protegidas
- [ ] API client en `src/lib/api.ts`

**Validation:**

- [ ] Login redirige a `/app` o `/admin` según rol
- [ ] Usuario no admin no puede acceder `/admin`
- [ ] Usuario no autenticado redirige a `/login`
- [ ] Token refresh funciona automáticamente

**Tests:**

- [ ] `tests/lib/guards/auth-guard.test.tsx`
- [ ] `tests/lib/guards/admin-guard.test.tsx`
- [ ] Integration test de flujo completo

---

### 🟠 FASE 4: Admin Users Page (Issue #1038)

**Goal:** Implementar `/admin/users` con CRUD completo

**MCP Command:**

```bash
/cui Create an admin users table with columns for Name, Email, User ID,
    and Status (active/inactive with badge). Include a search bar at the top
    for filtering by name or email, action buttons in each row for Edit and Delete,
    and a floating "Add User" button. Add dialogs for add/edit user forms
    and a confirmation dialog for delete. Include pagination at the bottom.
```

**Componentes shadcn adicionales:**

```bash
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add input
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add alert-dialog
```

**Tasks:**

1. **UsersTable component**
   - Columnas: Name, Email, User ID, Status, Actions
   - Search bar (debounced)
   - Badge para status (verde=active, gris=inactive)
   - Action buttons: Edit, Delete, Impersonate
   - Pagination

2. **AddUserDialog**
   - Form con validación (Zod)
   - Campos: Name, Email, Password, Plan (dropdown), isAdmin (checkbox)
   - Validation en tiempo real
   - Submit a `/api/admin/users`

3. **EditUserDialog**
   - Pre-poblado con datos existentes
   - Campos: Name, Plan, Status, isAdmin
   - NO permitir editar Email/UserID
   - Update a `/api/admin/users/:id`

4. **DeleteConfirmation**
   - AlertDialog con mensaje de confirmación
   - Mostrar User ID y Email
   - Botón destructivo "Delete"
   - DELETE a `/api/admin/users/:id`

5. **Impersonate feature**
   - Botón "Enter as User" (solo visible si NOT current user)
   - Genera token temporal de impersonation
   - Redirige a `/app` con nuevo token

**Entregables:**

- [ ] `src/pages/admin/users.tsx`
- [ ] `src/components/admin/users-table.tsx`
- [ ] `src/components/admin/add-user-dialog.tsx`
- [ ] `src/components/admin/edit-user-dialog.tsx`
- [ ] `src/components/admin/delete-user-dialog.tsx`

**API Endpoints necesarios (backend):**

- `GET /api/admin/users?search=&page=&limit=`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/impersonate`

**Validation:**

- [ ] Search filtra correctamente
- [ ] Pagination funciona
- [ ] Add user crea correctamente
- [ ] Edit user actualiza datos
- [ ] Delete user elimina con confirmación
- [ ] Impersonate cambia de usuario
- [ ] NO muestra datos sensibles (persona, sponsors)

**Tests:**

- [ ] Unit tests de cada componente
- [ ] Integration test de flujo CRUD
- [ ] E2E con Playwright

**Visual Evidence:**

- [ ] Screenshots de tabla con datos
- [ ] Screenshots de dialogs (add, edit, delete)
- [ ] Video de flujo CRUD completo

---

### 🟣 FASE 5: Admin Config Pages (Issues #1039, #1040, #1041)

#### 5.1 Feature Flags Page (#1039)

**MCP Command:**

```bash
/cui Create a feature flags configuration table with columns for Flag Name,
    Description, Enabled Status (toggle switch), and Last Modified.
    Include a search bar for filtering flags, an "Add Flag" button,
    and action buttons for Edit and Delete in each row.
```

**Entregables:**

- [ ] `src/pages/admin/config/feature-flags.tsx`
- [ ] `src/components/admin/feature-flags-table.tsx`
- [ ] CRUD dialogs

#### 5.2 Plans Configuration (#1040)

**MCP Command:**

```bash
/cui Create a plans configuration form with sections for each plan
    (Starter Trial, Starter, Pro, Plus). Each section shows plan name,
    monthly price, max roasts, max analysis, max platforms, and feature toggles
    (RQC, Shield, Brand Safety, Custom Styles). Include Save Changes button.
```

**Entregables:**

- [ ] `src/pages/admin/config/plans.tsx`
- [ ] `src/components/admin/plan-config-card.tsx`

#### 5.3 Tones Configuration (#1041)

**MCP Command:**

```bash
/cui Create a tones management table with columns for Tone Name,
    Description, Example, and Status. Include Add Tone button and
    Edit/Delete actions per row. Add a dialog for creating/editing tones
    with fields for name, description, example, and prompt instructions.
```

**Entregables:**

- [ ] `src/pages/admin/config/tones.tsx`
- [ ] `src/components/admin/tones-table.tsx`
- [ ] CRUD dialogs

**Componentes shadcn adicionales:**

```bash
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add select
```

---

### 🔴 FASE 6: Admin Metrics Page (Issue #1042)

**Goal:** Dashboard de métricas agregadas

**MCP Command:**

```bash
/cui Create an admin metrics dashboard with card widgets showing:
    Total Análisis (with monthly growth %), Total Roasts (with growth %),
    Active Users (with growth %), Average Análisis per User, Average Roasts per User.
    Include a User Distribution by Plan section showing percentage cards
    for Starter/Pro/Plus. Add Cost Metrics section with Average Cost per Analysis,
    Average Tokens per Analysis, Average Cost per Roast, and Average Tokens per Roast.
    Use a responsive grid layout.
```

**Componentes shadcn adicionales:**

```bash
npx shadcn-ui@latest add card
npx shadcn-ui@latest add progress
```

**Tasks:**

1. **MetricsOverview component**
   - Cards de totales con growth %
   - Iconos apropiados (lucide-react)
   - Colores por métrica

2. **UserDistribution component**
   - Cards con % por plan
   - Progress bars
   - Total count

3. **FeatureUsage component**
   - % con Roastr persona
   - % con sponsor configurado
   - % con tono custom

4. **CostMetrics component**
   - Coste medio/análisis
   - Tokens medios/análisis
   - Coste medio/roast
   - Tokens medios/roast

**Entregables:**

- [ ] `src/pages/admin/metrics.tsx`
- [ ] `src/components/admin/metrics-overview.tsx`
- [ ] `src/components/admin/user-distribution.tsx`
- [ ] `src/components/admin/feature-usage.tsx`
- [ ] `src/components/admin/cost-metrics.tsx`

**API Endpoint necesario:**

- `GET /api/admin/metrics` → Devuelve todas las métricas agregadas

**Backend Implementation:**

```javascript
// src/routes/admin/metrics.js
router.get('/metrics', requireAdmin, async (req, res) => {
  const metrics = await adminMetricsService.getAggregatedMetrics();
  res.json(metrics);
});
```

**Validation:**

- [ ] Datos cargan correctamente
- [ ] Números formateados (separadores de miles)
- [ ] Percentages correctos
- [ ] Responsive layout
- [ ] Refresh button funciona

**Tests:**

- [ ] Unit test de cada component
- [ ] Snapshot tests de cards
- [ ] Integration test de API call

**Visual Evidence:**

- [ ] Screenshots del dashboard completo
- [ ] Screenshots responsive (móvil/tablet/desktop)

---

## 🧪 FASE 7: Testing Completo

### Unit Tests

**Targets:**

- Componentes UI (todos)
- Guards (AuthGuard, AdminGuard)
- API client
- Utils

**Coverage objetivo:** ≥90%

### Integration Tests

**Scenarios:**

- Login flow completo
- Admin CRUD de usuarios
- Config changes (plans, flags, tones)
- Guards redirigen correctamente

### E2E Tests (Playwright)

**Critical Paths:**

1. Login como admin → acceso a `/admin/users`
2. Crear usuario → verificar en tabla
3. Editar usuario → verificar cambios
4. Eliminar usuario → confirmar eliminación
5. Login como usuario regular → NO acceso a `/admin`

**Playwright tests:**

```typescript
// tests/e2e/admin-panel.spec.ts
test('admin can manage users', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'admin@roastr.ai');
  await page.fill('[name=password]', 'admin123');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL('/admin');

  await page.click('a[href="/admin/users"]');
  await expect(page).toHaveURL('/admin/users');

  await page.click('button:has-text("Add User")');
  // ... rest of test
});
```

### Visual Validation con Playwright MCP

**Tasks:**

- [ ] Capturar screenshots de todas las páginas
- [ ] Verificar en claro/oscuro
- [ ] Verificar responsive (móvil/tablet/desktop)
- [ ] Guardar en `docs/test-evidence/epic-1037/`

---

## ✅ FASE 8: Validación GDD

**Pre-Merge Checklist:**

```bash
# 1. Tests al 100%
npm test

# 2. Coverage ≥90%
npm run test:coverage

# 3. GDD validation
node scripts/validate-gdd-runtime.js --full

# 4. GDD health score ≥87
node scripts/score-gdd-health.js --ci

# 5. GDD drift <60
node scripts/predict-gdd-drift.js --full

# 6. Linter passing
npm run lint

# 7. Build success
cd frontend && npm run build

# 8. E2E tests passing
npm run test:e2e
```

**Actualizar nodos GDD afectados:**

- `docs/nodes/cost-control.md` - Si tocamos métricas de coste
- `docs/nodes/multi-tenant.md` - Si tocamos gestión de usuarios
- `docs/nodes/plan-features.md` - Si tocamos configuración de planes

**Añadir "Agentes Relevantes":**

- FrontendDev
- TestEngineer
- UIDesigner (si usamos MCP shadcn-studio)
- Orchestrator

---

## 📦 FASE 9: Build & Deploy

### Build para producción

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

### Integración con Express

**Servir frontend desde Express:**

```javascript
// src/index.js
const path = require('path');

// Servir frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// SPA fallback (todas las rutas no-API)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});
```

### Actualizar scripts

```json
// package.json
{
  "scripts": {
    "frontend:dev": "cd frontend && npm run dev",
    "frontend:build": "cd frontend && npm run build",
    "frontend:preview": "cd frontend && npm run preview",
    "dev:full": "concurrently \"npm run dev\" \"npm run frontend:dev\"",
    "build": "npm run frontend:build"
  }
}
```

---

## 🔐 FASE 10: CodeRabbit Review + PR

### Pre-PR Checklist

- [ ] Todos los tests pasando (100%)
- [ ] Coverage ≥90%
- [ ] GDD health ≥87
- [ ] Linter sin errores
- [ ] Build success
- [ ] E2E tests passing
- [ ] Visual evidence generada
- [ ] Receipts de agentes generados

### CodeRabbit Review

```bash
npm run coderabbit:review
```

**Meta:** 0 comentarios pendientes

### PR Description Template

```markdown
## Epic #1037: Admin Panel - React + shadcn/ui

### 🎯 Objetivo

Implementar panel completo de administración usando React + shadcn/ui

### ✅ Implementado

- [x] Setup Vite + React + TypeScript + shadcn/ui
- [x] Layouts (AdminShell, AppShell, AuthLayout)
- [x] Auth guards + protected routes
- [x] Admin Users page (CRUD completo)
- [x] Admin Config pages (Plans, Feature Flags, Tones)
- [x] Admin Metrics dashboard
- [x] Theme claro/oscuro/sistema
- [x] Responsive móvil/tablet/desktop

### 📊 Métricas

- Tests: 100% passing
- Coverage: 92%
- GDD Health: 89
- E2E Tests: 15/15 passing

### 🖼️ Visual Evidence

Ver `docs/test-evidence/epic-1037/`

### 🧪 Testing

- Unit tests: 85 tests
- Integration tests: 12 tests
- E2E tests: 15 scenarios

### 📋 Checklist

- [x] Todos los AC completados
- [x] Tests pasando
- [x] Coverage ≥90%
- [x] GDD validado
- [x] CodeRabbit = 0 comentarios
- [x] Visual evidence generada
- [x] Receipts de agentes

### 🔗 Issues cerradas

Closes #1036, #1038, #1039, #1040, #1041, #1042, #1063
```

---

## 📝 Notas de Implementación

### Decisiones de Diseño

**1. Por qué Vite en lugar de CRA:**

- Vite es más rápido (HMR instantáneo)
- Build más ligero
- Mejor DX
- Vite es el futuro (CRA está deprecated)

**2. Por qué TypeScript:**

- Mejor DX con autocompletado
- Menos bugs en runtime
- shadcn/ui está en TS

**3. Por qué shadcn/ui:**

- Componentes accesibles (a11y)
- Customizable (no library lock-in)
- Tema integrado
- Mejor UX que componentes custom

**4. Por qué MCP Commands:**

- Genera código base rápido
- Reduce boilerplate
- Consistencia visual
- Menos errores

### Migración Progresiva

**Fase 1:** Admin panel (esta Epic)
**Fase 2:** User app (`/app/*`)
**Fase 3:** Auth pages (`/login`, `/register`)
**Fase 4:** Landing page

**Coexistencia temporal:**

- Backend Express sirve ambos:
  - `/admin/*` → React SPA (nuevo)
  - `/dashboard`, `/platforms`, etc → HTML estático (legacy)
- Migramos página por página
- Al final, eliminamos `public/` completo

### Performance

**Bundle size targets:**

- Initial bundle: <300KB
- Per-route chunks: <100KB
- Total (admin): <1MB

**Optimizaciones:**

- Code splitting por ruta
- Lazy loading de dialogs
- Memoization de components pesados
- Virtual scrolling para tablas grandes (si >1000 rows)

---

## 🚨 Riesgos y Mitigaciones

### Riesgo 1: Compatibilidad con backend actual

**Impacto:** Alto  
**Probabilidad:** Medio

**Mitigación:**

- API client centralizado con interceptors
- Mantener contratos de API existentes
- Tests de integración backend ↔ frontend

### Riesgo 2: Auth token management

**Impacto:** Crítico  
**Probabilidad:** Bajo

**Mitigación:**

- AuthProvider robusto con refresh automático
- Guards testeados exhaustivamente
- Fallback a login si token inválido

### Riesgo 3: Build process + deployment

**Impacto:** Medio  
**Probabilidad:** Bajo

**Mitigación:**

- Script de build automatizado
- Express sirve correctamente dist/
- SPA fallback configurado
- CI/CD valida build

### Riesgo 4: Bundle size

**Impacto:** Medio  
**Probabilidad:** Medio

**Mitigación:**

- Code splitting agresivo
- Tree shaking de librerías
- Lazy loading de rutas
- Monitoring de bundle size en CI

---

## 📚 Referencias

**Epic Principal:** #1037  
**Documento base:** `docs/plan/ui-migration-github-issues.md`  
**Reglas shadcn:** `.cursor/rules/shadcn-ui-migration.mdc`  
**GDD Nodes:** cost-control, multi-tenant, plan-features  
**CodeRabbit Lessons:** `docs/patterns/coderabbit-lessons.md`

**Shadcn/UI:**

- [Documentation](https://ui.shadcn.com/docs)
- [Themes](https://ui.shadcn.com/themes)

**MCP Shadcn-Studio:**

- Commands: `/cui`, `/rui`, `/iui`, `/ftc`
- See `.cursor/rules/shadcn-ui-migration.mdc` for examples

**React Router:**

- [Documentation](https://reactrouter.com/en/main)

---

## ✨ Próximos Pasos

Después de cerrar esta Epic:

1. **Epic #1057: Auth** - Migrar páginas de login/register a React
2. **Epic #1032: User App** - Migrar dashboard y accounts
3. **Epic #1060: Feature Flags** - Implementar sistema completo
4. **Epic #1064: Métricas** - Gráficos interactivos con Recharts

---

**Última actualización:** 2025-11-26  
**Owner:** FrontendDev  
**Status:** 🟢 En progreso (FASE 1)
