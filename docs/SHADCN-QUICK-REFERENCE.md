# Shadcn-Studio MCP - Quick Reference

**Para desarrollo UI en Roastr.AI**

🔗 **Reglas completas:** `.cursor/rules/shadcn-ui-migration.mdc`  
🔗 **Issues UI:** `docs/plan/ui-migration-github-issues.md`

---

## 🎯 Comandos MCP

### `/cui` - Create UI (MÁS USADO)

**Cuándo:** Reutilizar estructura de block con contenido custom.

**Template:**

```bash
/cui Create a [tipo de componente] with [columnas/campos/elementos],
    [features adicionales], and [interacciones]
```

**Ejemplos rápidos:**

```bash
# Tablas
/cui Create a users table with name, email, status columns, search bar, and edit/delete actions

# Widgets
/cui Create a metric card showing count, label, and trend percentage

# Forms
/cui Create a settings form with toggles, dropdowns, and save button

# Layouts
/cui Create a dashboard layout with sidebar navigation and content area
```

---

### `/rui` - Refine UI

**Cuándo:** Ajustar algo ya generado.

**Ejemplos:**

```bash
/rui Add pagination to the table
/rui Make the form validation stricter
/rui Add a search filter to the dropdown
/rui Make the card responsive for mobile
```

---

### `/iui` - Inspire UI (Pro only)

**Cuándo:** Diseños completamente únicos.

**Ejemplos:**

```bash
/iui Create an innovative toxicity indicator with visual threat levels
/iui Design a unique roast preview card with animations
```

---

### `/ftc` - Figma to Code (Requiere Figma MCP)

**Cuándo:** Convertir diseños completos de Figma.

---

## 📋 Checklist por Issue

### 1. Planning

- [ ] Leer AC de la issue
- [ ] Identificar componentes necesarios
- [ ] Decidir comando MCP (`/cui` para 90% de casos)

### 2. Implementación

- [ ] Ejecutar comando MCP con prompt específico
- [ ] Revisar código generado
- [ ] Customizar para Roastr.AI:
  - [ ] Conectar a endpoints reales (`/api/...`)
  - [ ] Aplicar feature flags si aplica
  - [ ] Aplicar visibilidad por plan si aplica
  - [ ] Añadir validación (zod)

### 3. Testing

- [ ] Probar en modo claro
- [ ] Probar en modo oscuro
- [ ] Verificar sistema es default
- [ ] Probar en móvil (375px)
- [ ] Probar en tablet (768px)
- [ ] Probar en desktop (1920px)

### 4. Tests automatizados

- [ ] Rendering tests (light + dark)
- [ ] Interaction tests
- [ ] Accessibility tests

### 5. Documentación

- [ ] Comentar comando MCP usado en PR
- [ ] Documentar customizaciones
- [ ] Screenshots si aplica

---

## 🎨 Componentes Shadcn Comunes

### Instalación individual

```bash
npx shadcn-ui@latest add [component]
```

### Más usados en Roastr.AI

| Componente | Uso                                   |
| ---------- | ------------------------------------- |
| `button`   | Botones de acción                     |
| `card`     | Widgets, métricas                     |
| `dialog`   | Modals de confirmación, forms         |
| `table`    | Listados (users, accounts, roasts)    |
| `tabs`     | Settings, navegación                  |
| `switch`   | Toggles (feature flags, auto-approve) |
| `select`   | Dropdowns (planes, tonos, shields)    |
| `input`    | Forms                                 |
| `toast`    | Notificaciones                        |
| `progress` | Barras de uso                         |
| `badge`    | Estados (activo/pausado)              |
| `sheet`    | Navigation móvil                      |

---

## 🏗️ Estructura de Carpetas

```
src/
  components/
    ui/                          # Componentes shadcn (generados)
    layout/
      admin-shell.tsx            # Layout admin con sidebar
      app-shell.tsx              # Layout user app con topbar
      theme-toggle.tsx           # Selector de tema
      mobile-nav.tsx             # Navigation móvil (Sheet)
    admin/
      users-table.tsx            # Issue #1038
      feature-flags-table.tsx    # Issue #1039
      plan-config-table.tsx      # Issue #1040
      tones-table.tsx            # Issue #1041
      metrics-overview.tsx       # Issue #1042
    app/
      home/
        usage-widgets.tsx        # Issue #1044
        connect-network-card.tsx # Issue #1045
        accounts-table.tsx       # Issue #1046
      accounts/
        account-header.tsx       # Issue #1048
        account-settings-dialog.tsx # Issue #1049
        roasts-table.tsx         # Issue #1050
        shield-accordion.tsx     # Issue #1051
      settings/
        account-settings-form.tsx  # Issue #1054
        persona-settings-form.tsx  # Issue #1055
        billing-panel.tsx          # Issue #1056
```

---

## 🎯 Tips Rápidos

### DO ✅

```tsx
// Usar componentes shadcn
import { Button } from "@/components/ui/button"

// Tailwind para layout
<div className="flex gap-4 p-6">

// Variables de tema
<div className="bg-primary text-primary-foreground">

// Conectar a API centralizada
import { api } from "@/lib/api"
const users = await api.users.list()
```

### DON'T ❌

```tsx
// NO crear componentes custom si shadcn lo provee
const MyButton = styled.button`...` // ❌

// NO hardcodear colores
<div className="bg-blue-500"> // ❌

// NO usar fetch directo
const data = await fetch('/api/users') // ❌

// NO crear estilos custom
import styles from './Component.module.css' // ❌
```

---

## 📞 API Endpoints (Referencia)

### Admin

- `GET /api/admin/users` - Lista usuarios
- `POST /api/admin/users` - Crear usuario
- `PATCH /api/admin/users/:id` - Editar usuario
- `DELETE /api/admin/users/:id` - Borrar usuario
- `GET /api/admin/metrics` - Métricas agregadas
- `GET /api/admin/feature-flags` - Lista feature flags
- `PATCH /api/admin/feature-flags/:name` - Toggle flag
- `GET /api/admin/config/plans` - Config de planes
- `PATCH /api/admin/config/plans/:plan` - Editar plan
- `GET /api/admin/tones` - Lista tonos
- `POST /api/admin/tones` - Crear tono

### User App

- `GET /api/usage/current` - Consumo del mes
- `GET /api/accounts` - Cuentas conectadas
- `GET /api/accounts/:id` - Detalle de cuenta
- `PATCH /api/accounts/:id/settings` - Config cuenta
- `GET /api/accounts/:id/roasts` - Roasts de cuenta
- `GET /api/accounts/:id/shield` - Shield de cuenta
- `GET /api/persona` - Roastr persona
- `PATCH /api/persona` - Actualizar persona
- `GET /api/sponsor` - Config sponsor
- `PATCH /api/sponsor` - Actualizar sponsor
- `GET /api/billing` - Info billing

### Auth

- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/reset-password` - Reset contraseña
- `GET /api/gdpr/export` - Exportar datos

---

## 🚀 Workflow Típico

### Ejemplo: Issue #1038 (Admin Users Page)

```bash
# 1. Generar con MCP
/cui Create an admin users table with columns for name, email, user ID,
    and status. Include search bar, and buttons for add, edit, delete,
    and impersonate user.

# 2. Revisar código generado
# MCP crea: components/admin/users-table.tsx

# 3. Customizar
# - Conectar a /api/admin/users
# - Implementar search logic
# - Añadir dialogs de add/edit
# - Implementar impersonation (redirect a /app)
# - Guard de admin-only

# 4. Probar
npm run dev
# Probar en /admin/users
# Verificar claro/oscuro/sistema
# Verificar responsive

# 5. Tests
npm test -- components/admin/users-table.test.tsx

# 6. PR
# Documentar comando usado + customizaciones
```

---

## 🎨 Tema

### Variables disponibles

```css
/* Claro */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 222.2 47.4% 11.2%;
--secondary: 210 40% 96.1%;
--muted: 210 40% 96.1%;
--accent: 210 40% 96.1%;
--destructive: 0 84.2% 60.2%;

/* Oscuro */
--background: 222.2 84% 4.9%;
--foreground: 210 40% 98%;
--primary: 210 40% 98%;
--secondary: 217.2 32.6% 17.5%;
--muted: 217.2 32.6% 17.5%;
--accent: 217.2 32.6% 17.5%;
--destructive: 0 62.8% 30.6%;
```

### Uso

```tsx
// Usar clases de tema, NO colores directos
<Button className="bg-primary text-primary-foreground">
<Card className="bg-card border-border">
<Alert className="bg-destructive text-destructive-foreground">
```

---

## 📚 Recursos

- **Reglas completas:** `.cursor/rules/shadcn-ui-migration.mdc`
- **Issues:** `docs/plan/ui-migration-github-issues.md`
- **Shadcn Docs:** https://ui.shadcn.com
- **Tailwind Docs:** https://tailwindcss.com
- **Epic Principal:** #1032

---

**Última actualización:** 2025-11-26  
**Versión:** 1.0.0
