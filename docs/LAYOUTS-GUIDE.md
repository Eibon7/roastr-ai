# Guía de Layouts - Epic #1037

## 🎨 Cómo Ver los Layouts

### 1. Iniciar el Servidor de Desarrollo

```bash
cd /Users/emiliopostigo/roastr-ai/roastr-ai-worktrees/epic-1037/frontend
npm run dev
```

El servidor se iniciará en `http://localhost:5173`

### 2. Ver Layouts

#### AuthLayout (Login)

**URL:** `http://localhost:5173/login`

**Características visibles:**

- Layout centrado vertical y horizontal
- Logo de Roastr.ai con icono Shield
- Card blanco/gris con formulario de login
- Footer con copyright
- Tema claro/oscuro aplicable

**Interacción:**

- El formulario tiene validación básica
- Los campos están listos para conectar con el backend

---

#### AdminShell (Panel Admin)

**URL:** `http://localhost:5173/admin` (requiere autenticación)

**Características visibles:**

**Desktop:**

- **Sidebar izquierdo:**
  - Logo "Roastr.ai Admin"
  - Grupos de navegación:
    - Principal: Dashboard
    - Gestión: Usuarios
    - Configuración: Planes, Feature Flags, Tonos
    - Métricas: Panel de Métricas, Logs
  - Estados activos (highlight del item actual)

- **Topbar:**
  - "Panel de Administración" (solo desktop)
  - Theme toggle (sol/luna)
  - Avatar con dropdown menu (user info, logout)

- **Área de contenido:**
  - Dashboard con cards de métricas
  - Container con padding responsivo

**Móvil/Tablet:**

- Hamburger menu (botón en topbar)
- Sheet lateral que se desliza desde la izquierda
- Sidebar colapsa automáticamente

**Funcionalidades:**

- Navegación entre secciones
- Theme toggle funciona
- User menu dropdown
- Responsive design

---

#### AppShell (Panel Usuario)

**URL:** `http://localhost:5173/app` (requiere autenticación)

**Características visibles:**

**Desktop:**

- **Topbar:**
  - Logo "Roastr.ai"
  - Navegación horizontal: Inicio, Cuentas, Configuración
  - Theme toggle
  - Avatar con dropdown menu

- **Área de contenido:**
  - Home page con cards informativos
  - Container con padding responsivo

**Móvil/Tablet:**

- Hamburger menu
- Sheet con navegación vertical
- Topbar sticky

---

### 3. Probar Responsive

**Chrome DevTools:**

1. Abre DevTools (F12)
2. Click en icono de dispositivo móvil
3. Selecciona diferentes viewports:
   - iPhone SE (375x667)
   - iPad (768x1024)
   - Desktop (1920x1080)

**Características a verificar:**

- ✅ Sidebar colapsa en móvil (AdminShell)
- ✅ Hamburger menu aparece en móvil
- ✅ Navegación se adapta
- ✅ Cards se reorganizan en grid
- ✅ Padding y spacing se ajustan

---

### 4. Probar Tema Claro/Oscuro

**Theme Toggle:**

1. Click en el icono sol/luna en el topbar
2. Selecciona:
   - **Claro** - Tema claro
   - **Oscuro** - Tema oscuro
   - **Sistema** - Sigue preferencias del sistema

**Verificar:**

- ✅ Colores cambian correctamente
- ✅ Contraste adecuado en ambos temas
- ✅ Iconos se adaptan (sol/luna)
- ✅ Preferencia se guarda en localStorage

---

## 📸 Screenshots Sugeridos

### AuthLayout

- Login page en tema claro
- Login page en tema oscuro
- Responsive (móvil)

### AdminShell

- Dashboard completo (desktop, claro)
- Dashboard completo (desktop, oscuro)
- Sidebar destacado
- Mobile drawer abierto
- Navegación activa

### AppShell

- Home page (desktop, claro)
- Home page (desktop, oscuro)
- Mobile navigation
- User menu dropdown

---

## 🔍 Páginas Disponibles

### Admin

- ✅ `/admin` - Dashboard con métricas
- ✅ `/admin/users` - CRUD completo de usuarios
- ✅ `/admin/metrics` - Panel de métricas (placeholder)
- ✅ `/admin/config/plans` - Configuración de planes (placeholder)
- ✅ `/admin/config/feature-flags` - Feature flags (placeholder)
- ✅ `/admin/config/tones` - Gestión de tonos (placeholder)

### User App

- ✅ `/app` - Home page
- ⏸️ `/app/accounts` - Gestión de cuentas (placeholder)
- ⏸️ `/app/settings` - Configuración (placeholder)

### Auth

- ✅ `/login` - Login page completa

---

## 🚨 Notas Importantes

### Autenticación Mock

Actualmente, los guards están implementados pero **requieren un backend funcionando** para verificar tokens. Para ver los layouts sin backend:

1. **Opción 1:** Comentar temporalmente los guards en `App.tsx`
2. **Opción 2:** Mockear el contexto de auth
3. **Opción 3:** Esperar a conectar con backend real

### API Endpoints

Todas las páginas tienen **mocks de datos** por ahora. Los TODOs indican dónde conectar con APIs reales.

### Guards Funcionando

Los guards están completamente implementados y funcionarán cuando:

- Backend esté corriendo en `localhost:3000`
- Endpoints `/api/auth/me` y `/api/auth/login` estén disponibles
- Tokens JWT se generen correctamente

---

## 🎯 Próximos Pasos para Completar

1. **Conectar Backend:**
   - Actualizar `src/lib/api.ts` con URLs correctas
   - Conectar login con endpoint real
   - Conectar página de usuarios con APIs reales

2. **Completar Páginas:**
   - Feature Flags page completa
   - Plans Configuration completa
   - Tones Management completa
   - Metrics Dashboard con gráficos

3. **Tests:**
   - Unit tests de componentes
   - E2E tests con Playwright
   - Tests de guards

---

**Última actualización:** 2025-11-26  
**Worktree:** `/roastr-ai-worktrees/epic-1037`  
**Branch:** `feature/epic-1037-admin-panel`
