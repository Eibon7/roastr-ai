# Epic #1032: Migración UI → shadcn/ui - Plan Completo

**Fecha:** 2025-11-26
**Worktree:** `/Users/emiliopostigo/roastr-ai/roastr-ai-worktrees/epic-1032`
**Rama:** `feature/epic-1032-shadcn-migration`

## Objetivo

Migrar completamente la UI de Roastr.AI a shadcn/ui eliminando MUI y styled-components.

## Estado Actual

**Admin Dashboard** (`admin-dashboard/`):

- Stack actual: Vite + React + Material-UI + styled-components
- Páginas: GDD Dashboard, Shield Settings, Shield Validation, Workers
- Componentes custom en `src/components/dashboard/`
- Tema: Dark Cyber Theme personalizado

**Frontend** (`frontend/`):

- Stack actual: React + CSS custom
- Mixto de CSS modules y estilos inline

## Issues y Orden de Ejecución

### ✅ Fase 1: Setup y Configuración (Issue #1033)

**AC:** 7 acceptance criteria
**Prioridad:** HIGH - Base para todo lo demás
**Tiempo estimado:** 4-6h

**Tareas:**

1. Instalar shadcn/ui CLI y dependencias
2. Configurar Tailwind con `darkMode: "class"`
3. Crear `components/ui/` estructura
4. Implementar ThemeProvider con `next-themes`
5. Crear `theme-toggle.tsx`
6. Migrar theme variables (dark cyber → CSS variables shadcn)
7. Probar en claro/oscuro/sistema

**Dependencias:** Ninguna
**Bloquea:** #1034, #1035, #1036, #1038

---

### 🔄 Fase 2: Migración de Componentes (Issue #1034)

**AC:** 5 acceptance criteria  
**Prioridad:** HIGH  
**Tiempo estimado:** 8-10h

**Tareas:**

1. Inventario completo de componentes MUI usados
2. Instalar componentes shadcn equivalentes:
   - Button → `npx shadcn-ui@latest add button`
   - Card → `npx shadcn-ui@latest add card`
   - Dialog → `npx shadcn-ui@latest add dialog`
   - Input → `npx shadcn-ui@latest add input`
   - Table → `npx shadcn-ui@latest add table`
   - Tabs → `npx shadcn-ui@latest add tabs`
   - Badge → `npx shadcn-ui@latest add badge`
   - Switch → `npx shadcn-ui@latest add switch`
   - Dropdown → `npx shadcn-ui@latest add dropdown-menu`
3. Migrar PoC (3 componentes):
   - StatusCard → Card
   - ActionTag/BaseTag → Badge
   - DiffModal → Dialog
4. Crear guía de migración en `docs/ui-migration-guide.md`
5. Documentar mapeo MUI → shadcn

**Dependencias:** #1033 completada
**Bloquea:** #1035

---

### 🧹 Fase 3: Limpieza CSS Legacy (Issue #1035)

**AC:** 5 acceptance criteria  
**Prioridad:** MEDIUM  
**Tiempo estimado:** 4-6h

**Tareas:**

1. Auditar `src/theme/globalStyles.ts` y `darkCyberTheme.ts`
2. Eliminar imports de MUI theme
3. Buscar y eliminar styled-components:
   ```bash
   grep -r "styled\." admin-dashboard/src/
   ```
4. Migrar CSS modules si existen
5. Limpiar `index.css` dejando solo Tailwind + shadcn vars
6. Eliminar imports de @emotion/react y @emotion/styled

**Dependencias:** #1034 completada (al menos 50%)
**Bloquea:** Ninguna

---

### 🏗️ Fase 4: Layouts (Issue #1036)

**AC:** 6 acceptance criteria  
**Prioridad:** MEDIUM  
**Tiempo estimado:** 6-8h

**Tareas:**

1. Analizar estructura de routing actual
2. Crear layouts con shadcn:
   - Admin layout: Sidebar + topbar
   - App layout: Topbar simple
   - Auth layout: Minimal (si aplica)
3. Implementar navegación responsive:
   - Desktop: Sidebar visible
   - Mobile: Sheet/Drawer
4. Crear componentes layout:
   - `components/layout/admin-shell.tsx`
   - `components/layout/main-nav.tsx`
   - `components/layout/mobile-nav.tsx`
   - `components/layout/theme-toggle.tsx`

**Dependencias:** #1033 completada
**Bloquea:** #1038

---

### 📊 Fase 5: Página Admin Users (Issue #1038)

**AC:** 8 acceptance criteria  
**Prioridad:** HIGH - Feature completa nueva  
**Tiempo estimado:** 8-10h

**Tareas:**

1. Generar con MCP Shadcn:
   ```bash
   /cui Create an admin users table with columns for name, email, user ID,
       and status (active/inactive). Include a search bar for filtering by
       name or email, and action buttons for add user (opens dialog),
       edit user (opens dialog), delete user (with confirmation),
       and impersonate user.
   ```
2. Conectar a `/api/admin/users`
3. Implementar lógica de impersonation
4. Añadir guards de admin-only
5. Tests E2E con Playwright
6. Responsive design (mobile cards)

**Dependencias:** #1033, #1036 completadas
**Bloquea:** Ninguna

---

## Testing Strategy

### Por Issue

**#1033 (Setup):**

- Probar theme toggle funciona
- Verificar CSS variables aplicadas
- Screenshot claro/oscuro/sistema

**#1034 (Components):**

- Tests unitarios para cada componente migrado
- Comparación visual antes/después
- Verificar props mapping correcto

**#1035 (Cleanup):**

- Verificar 0 imports de MUI
- Verificar 0 styled-components
- Bundle size comparison

**#1036 (Layouts):**

- Tests de navegación responsive
- Screenshot mobile/tablet/desktop
- Verificar theme toggle en layouts

**#1038 (Users Page):**

- Tests E2E completos:
  - CRUD operations
  - Search/filter
  - Impersonation
- Tests de accesibilidad
- Performance tests

### Suite Completa

Ejecutar al final de cada fase:

```bash
cd admin-dashboard
npm run typecheck
npm run lint
npm test:e2e
npm run test:a11y
```

---

## Checklist de Calidad (Por Issue)

### Pre-Implementation

- [ ] Leer `docs/patterns/coderabbit-lessons.md`
- [ ] Crear plan en `docs/plan/issue-{id}.md`
- [ ] Identificar agentes necesarios

### During Implementation

- [ ] Commits pequeños y atómicos
- [ ] No commitear sin tests
- [ ] Documentar decisiones de diseño

### Pre-Merge

- [ ] Tests 100% passing
- [ ] Coverage >=90%
- [ ] CodeRabbit: 0 comentarios
- [ ] Screenshots de evidencia
- [ ] Receipts de agentes generados
- [ ] GDD health >=87
- [ ] Sin conflictos con main

---

## Agentes Involucrados

### Por Issue

**#1033:** FrontendDev, TestEngineer
**#1034:** FrontendDev, UIDesigner, TestEngineer  
**#1035:** FrontendDev  
**#1036:** FrontendDev, UIDesigner, TestEngineer  
**#1038:** FrontendDev, UIDesigner, TestEngineer, Guardian (API integration)

### Receipts Requeridos

Generar al completar cada issue:

```
docs/agents/receipts/epic-1032-{agent}-issue-{id}.md
```

---

## Archivos Clave a Modificar

### Issue #1033

- `admin-dashboard/package.json` - Añadir shadcn deps
- `admin-dashboard/tailwind.config.js` - Configurar darkMode
- `admin-dashboard/src/main.tsx` - Wrap con ThemeProvider
- `admin-dashboard/src/components/ui/` - Crear estructura
- `admin-dashboard/src/components/layout/theme-toggle.tsx` - Nuevo

### Issue #1034

- Todos los archivos en `src/components/dashboard/` - Migrar
- `src/components/ui/` - Añadir componentes shadcn
- `docs/ui-migration-guide.md` - Crear guía

### Issue #1035

- `src/theme/globalStyles.ts` - Eliminar
- `src/theme/darkCyberTheme.ts` - Eliminar
- `src/theme/SnakeEaterThemeProvider.tsx` - Eliminar
- `src/main.tsx` - Limpiar imports

### Issue #1036

- `src/components/layout/` - Crear todos
- Estructura de routing si necesita ajustes

### Issue #1038

- `src/pages/AdminUsers/` - Crear completo
- `src/api/adminUsersApi.ts` - Crear API layer

---

## Métricas de Éxito

### Técnicas

- ✅ 0 imports de @mui/material
- ✅ 0 imports de @emotion/react
- ✅ 0 imports de styled-components
- ✅ Bundle size reducido >30%
- ✅ Tests 100% passing
- ✅ Coverage >=90%

### Funcionales

- ✅ Tema claro/oscuro/sistema funcionando
- ✅ 100% responsive
- ✅ Accesibilidad a11y passing
- ✅ Performance Lighthouse >90

### Proceso

- ✅ 0 comentarios CodeRabbit
- ✅ GDD health >=87
- ✅ Todos los receipts generados
- ✅ Documentación completa

---

## Contingencias

### Si Issue #1033 falla

- **Blocker completo** - No se puede continuar
- Rollback y debug antes de avanzar

### Si Issue #1034 toma >10h

- Priorizar solo 3 componentes PoC
- Dejar resto para iteración 2

### Si Issue #1035 revela problemas

- No bloquea #1036 ni #1038
- Puede hacerse en paralelo

### Si Issue #1038 es muy compleja

- Simplificar a tabla básica primero
- Añadir features avanzadas después

---

## Notas de Implementación

### Shadcn/UI vs MUI - Diferencias Clave

**MUI:**

```tsx
import { Button } from '@mui/material';
<Button variant="contained" color="primary">
  Click
</Button>;
```

**Shadcn:**

```tsx
import { Button } from '@/components/ui/button';
<Button variant="default">Click</Button>;
```

**Key changes:**

- Props diferentes (variant names)
- Import path personalizado (@/components/ui/)
- Styling con Tailwind classes
- No más ThemeProvider de MUI

### Dark Cyber Theme → Shadcn Variables

Mapeo de colores actuales a CSS variables de shadcn:

```css
/* darkCyberTheme.ts (ACTUAL) */
background: '#0A0E27'
paper: '#141B3D'
primary: '#00FFA3'

/* shadcn variables (NUEVO) */
--background: 222.2 84% 4.9%; /* dark navy */
--foreground: 210 40% 98%;
--primary: 142.1 76.2% 36.3%; /* cyan green */
--accent: 210 40% 96.1%;
```

---

## Calendario Estimado

**Día 1:** Issue #1033 (Setup) - 4-6h  
**Día 2:** Issue #1034 (Componentes) - Primera mitad  
**Día 3:** Issue #1034 (Componentes) - Completar + Issue #1035 (Cleanup)  
**Día 4:** Issue #1036 (Layouts) - 6-8h  
**Día 5:** Issue #1038 (Admin Users) - Primera mitad  
**Día 6:** Issue #1038 (Admin Users) - Completar + Tests  
**Día 7:** Testing global + Validación + PR

**Total estimado:** ~40-50h (1-2 semanas)

---

## Status Tracking

| Issue | Status     | Progress | Blockers              |
| ----- | ---------- | -------- | --------------------- |
| #1033 | 🟡 PENDING | 0%       | -                     |
| #1034 | 🟡 PENDING | 0%       | Requiere #1033        |
| #1035 | 🟡 PENDING | 0%       | Requiere #1034        |
| #1036 | 🟡 PENDING | 0%       | Requiere #1033        |
| #1038 | 🟡 PENDING | 0%       | Requiere #1033, #1036 |

**Actualizar este documento al completar cada issue.**

---

**Última actualización:** 2025-11-26  
**Siguiente review:** Al completar Issue #1033
