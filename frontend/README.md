# Roastr.ai Frontend - Admin Panel

Frontend moderno para el panel de administración de Roastr.ai construido con React, TypeScript, Vite, Tailwind CSS y shadcn/ui.

## 🚀 Inicio Rápido

### Instalar dependencias

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

El servidor de desarrollo se iniciará en `http://localhost:5173`

### Build para producción

```bash
npm run build
```

### Preview del build

```bash
npm run preview
```

## 📁 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes shadcn/ui
│   │   └── layout/          # Layouts principales
│   │       ├── auth-layout.tsx
│   │       ├── admin-shell.tsx
│   │       ├── app-shell.tsx
│   │       └── theme-toggle.tsx
│   ├── lib/
│   │   ├── api.ts           # Cliente API
│   │   ├── auth-context.tsx # Context de autenticación
│   │   ├── guards/          # Guards de rutas
│   │   │   ├── auth-guard.tsx
│   │   │   └── admin-guard.tsx
│   │   └── utils.ts
│   ├── pages/
│   │   ├── admin/           # Páginas de administración
│   │   │   ├── dashboard.tsx
│   │   │   ├── users.tsx
│   │   │   ├── metrics.tsx
│   │   │   └── config/
│   │   │       ├── feature-flags.tsx
│   │   │       ├── plans.tsx
│   │   │       └── tones.tsx
│   │   ├── app/             # Páginas de usuario
│   │   │   └── home.tsx
│   │   └── auth/            # Páginas de autenticación
│   │       └── login.tsx
│   ├── App.tsx              # Router principal
│   └── main.tsx             # Entry point
├── components.json          # Configuración shadcn/ui
├── tailwind.config.js       # Configuración Tailwind
└── vite.config.ts           # Configuración Vite
```

## 🎨 Layouts

### AuthLayout
Layout minimal para páginas de autenticación (login, register, recover).

**Ubicación:** `src/components/layout/auth-layout.tsx`

**Características:**
- Centrado vertical y horizontal
- Logo y branding
- Card contenedor para formularios
- Footer simple

### AdminShell
Layout completo para el panel de administración con sidebar y topbar.

**Ubicación:** `src/components/layout/admin-shell.tsx`

**Características:**
- Sidebar con navegación organizada:
  - Principal (Dashboard)
  - Gestión (Usuarios)
  - Configuración (Planes, Feature Flags, Tonos)
  - Métricas (Panel, Logs)
- Topbar con búsqueda, theme toggle y user menu
- Sheet para móvil (hamburger menu)
- Responsive (desktop sidebar, mobile drawer)
- Estados activos de rutas

### AppShell
Layout para usuarios regulares con topbar.

**Ubicación:** `src/components/layout/app-shell.tsx`

**Características:**
- Topbar con logo y navegación
- Navegación horizontal para desktop
- Hamburger menu para móvil
- Theme toggle y user menu
- Sticky header

## 🔐 Autenticación y Guards

### AuthProvider
Contexto de autenticación que gestiona el estado del usuario.

**Ubicación:** `src/lib/auth-context.tsx`

**Features:**
- Token management (localStorage)
- User data caching
- Auto-refresh token
- Login/logout functions

### Guards

**AuthGuard** (`src/lib/guards/auth-guard.tsx`):
- Protege rutas que requieren autenticación
- Redirige a `/login` si no autenticado
- Muestra loading state

**AdminGuard** (`src/lib/guards/admin-guard.tsx`):
- Protege rutas que requieren admin
- Redirige a `/app` si no es admin
- Hereda de AuthGuard

## 📄 Rutas

### Públicas
- `/login` - Página de login

### Protegidas (AuthGuard)
- `/app/*` - Páginas de usuario
  - `/app` - Home
  - `/app/accounts` - Gestión de cuentas
  - `/app/settings` - Configuración

### Admin (AdminGuard)
- `/admin/*` - Páginas de administración
  - `/admin` - Dashboard
  - `/admin/users` - Gestión de usuarios
  - `/admin/metrics` - Panel de métricas
  - `/admin/config/plans` - Configuración de planes
  - `/admin/config/feature-flags` - Feature flags
  - `/admin/config/tones` - Gestión de tonos
  - `/admin/logs` - Logs del sistema

## 🎨 Tema

El proyecto usa `next-themes` para gestionar el tema claro/oscuro/sistema.

**Ubicación:** `src/lib/theme-provider.tsx`

**Configuración:**
- Almacenado en localStorage (`roastr-theme`)
- Soporta: `light`, `dark`, `system`
- Cambio automático según preferencias del sistema

## 🛠️ Componentes shadcn/ui Instalados

- Button
- Card
- Dialog
- AlertDialog
- Table
- Badge
- Input
- Label
- Select
- Sheet
- Dropdown Menu
- Separator
- Scroll Area
- Avatar

## 📦 Dependencias Principales

- **React** 19.2.0
- **React Router** 7.8.0
- **TypeScript** 5.7.2
- **Vite** 6.0.5
- **Tailwind CSS** 3.4.1
- **next-themes** 0.4.4
- **Radix UI** - Componentes base
- **Lucide React** - Iconos

## 🔧 Configuración

### Variables de Entorno

Crear archivo `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### Proxy

El proxy a `/api` está configurado en `vite.config.ts` para redirigir a `http://localhost:3000`.

## 📱 Responsive

Todos los layouts son responsive:
- **Desktop:** Sidebar visible (AdminShell), navegación horizontal (AppShell)
- **Tablet:** Sidebar colapsable, navegación adaptativa
- **Móvil:** Hamburger menu, drawer/sheet lateral

## 🧪 Próximos Pasos

- [ ] Conectar APIs reales (reemplazar mocks)
- [ ] Agregar tests unitarios
- [ ] Agregar tests E2E con Playwright
- [ ] Completar páginas de configuración
- [ ] Implementar panel de métricas completo

## 📚 Documentación

- [Plan de Implementación](../../docs/plan/epic-1037-admin-panel.md)
- [Progreso](../../docs/EPIC-1037-PROGRESS.md)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Vite Docs](https://vitejs.dev)

---

**Epic:** #1037  
**Status:** 🟢 En desarrollo  
**Última actualización:** 2025-11-26

