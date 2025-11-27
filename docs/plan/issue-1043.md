# Plan de Implementación: EPIC 1043 - User App Home

**Epic:** #1043 - User App Home  
**Fecha:** 2025-01-27  
**Status:** 🟡 En progreso

---

## 📋 Resumen

Implementar página principal de la app de usuario (`/app`) con:
1. Widgets de análisis y consumo mensual (#1044)
2. Bloque de redes disponibles para conectar (#1045)
3. Tabla de cuentas conectadas con navegación (#1046)

---

## 🎯 Issues Incluidas

### Issue #1044: Widgets de análisis
- **Descripción:** Widgets de consumo mensual (análisis y roasts) con barras de progreso
- **Endpoint:** `/api/usage/current`
- **Componentes:** `usage-widgets.tsx`, `progress.tsx`, `card.tsx`

### Issue #1045: Bloque de redes disponibles
- **Descripción:** Botones para conectar redes sociales con OAuth
- **Endpoint:** `/api/accounts/connect/:platform`
- **Componentes:** `connect-network-card.tsx`, `button.tsx`, `card.tsx`

### Issue #1046: Tabla de cuentas conectadas
- **Descripción:** Tabla clickable con cuentas conectadas
- **Endpoint:** `/api/accounts`
- **Componentes:** `accounts-table.tsx`, `table.tsx`

---

## 🏗️ Arquitectura

### Estructura de Archivos

```
frontend/src/
├── pages/
│   └── app/
│       └── home.tsx              # Página principal /app (NEW)
├── components/
│   └── app/
│       └── home/
│           ├── usage-widgets.tsx      # Issue #1044 (NEW)
│           ├── connect-network-card.tsx # Issue #1045 (NEW)
│           └── accounts-table.tsx     # Issue #1046 (NEW)
└── components/ui/                 # shadcn/ui components (EXISTING)
    ├── card.tsx
    ├── progress.tsx
    ├── button.tsx
    └── table.tsx
```

### Rutas

```javascript
// App.js
<Route path="/app" element={<AuthGuard><AppShell /></AuthGuard>}>
  <Route index element={<Home />} />  // NEW - Issue #1043
  <Route path="dashboard" element={<Dashboard />} />
  // ... otras rutas
</Route>
```

---

## 🔧 Implementación

### FASE 1: Setup y Dependencias

- [x] Verificar shadcn/ui configurado
- [x] Verificar Tailwind CSS v4
- [ ] Instalar componentes shadcn necesarios (progress, table si faltan)

### FASE 2: Issue #1044 - Widgets de Análisis

**Componente:** `components/app/home/usage-widgets.tsx`

**Features:**
- Widget 1: "Análisis este mes" (X/Y análisis)
- Widget 2: "Roasts este mes" (X/Y roasts)
- Barras de progreso visuales
- Porcentaje de consumo
- Responsive (móvil/tablet/desktop)

**API Integration:**
```javascript
// GET /api/usage/current
{
  analysis: { used: 45, limit: 100 },
  roasts: { used: 12, limit: 50 }
}
```

**Comando MCP:**
```bash
/cui Create usage widgets showing monthly consumption with progress bars for analysis and roasts
```

### FASE 3: Issue #1045 - Redes Disponibles

**Componente:** `components/app/home/connect-network-card.tsx`

**Features:**
- Botones por red social (X/Twitter, Instagram, etc.)
- Texto "X/Y" (cuentas actuales/máximo del plan)
- Botones deshabilitados si alcanzó máximo
- OAuth flow (iniciar → callback → actualizar)

**API Integration:**
```javascript
// GET /api/accounts/connect/:platform
// POST /api/accounts/connect/:platform (iniciar OAuth)
```

**Comando MCP:**
```bash
/cui Create a social networks connection card with buttons for each platform showing current/max accounts
```

### FASE 4: Issue #1046 - Tabla de Cuentas

**Componente:** `components/app/home/accounts-table.tsx`

**Features:**
- Columnas: Red social, Handle, Estado, Roasts emitidos, Intercepciones shield
- Filas clickables → navegar a `/app/accounts/[accountId]`
- Responsive (scroll horizontal en móvil)

**API Integration:**
```javascript
// GET /api/accounts
[
  {
    id: "acc_123",
    platform: "twitter",
    handle: "@user",
    status: "active",
    roasts_count: 45,
    shield_interceptions: 12
  }
]
```

**Comando MCP:**
```bash
/cui Create a clickable accounts table with social network, handle, status, roasts count, and shield interceptions columns
```

### FASE 5: Página Home Principal

**Archivo:** `pages/app/home.tsx`

**Layout:**
```tsx
<AppShell>
  <div className="space-y-6">
    <UsageWidgets />           {/* Issue #1044 */}
    <ConnectNetworkCard />      {/* Issue #1045 */}
    <AccountsTable />           {/* Issue #1046 */}
  </div>
</AppShell>
```

---

## ✅ Acceptance Criteria

### Issue #1044
- [ ] Ruta `/app` funcionando (Home)
- [ ] Widget 1: "Análisis este mes" con X/Y y porcentaje
- [ ] Widget 2: "Roasts este mes" con X/Y y porcentaje
- [ ] Barras de progreso visuales
- [ ] Datos de `/api/usage/current`
- [ ] 100% responsive

### Issue #1045
- [ ] Bloque de redes disponibles visible
- [ ] Botones por red con texto "X/Y"
- [ ] Botones deshabilitados si máximo alcanzado
- [ ] OAuth flow funcional
- [ ] Toast de confirmación

### Issue #1046
- [ ] Tabla de cuentas visible
- [ ] Columnas: Red, Handle, Estado, Roasts, Shield
- [ ] Filas clickables → `/app/accounts/[accountId]`
- [ ] Datos de `/api/accounts`
- [ ] 100% responsive

---

## 🧪 Testing

### Unit Tests
- [ ] `usage-widgets.test.tsx` - Renderizado, datos, progreso
- [ ] `connect-network-card.test.tsx` - Botones, estados, OAuth
- [ ] `accounts-table.test.tsx` - Tabla, navegación, datos

### Integration Tests
- [ ] API calls mockeados
- [ ] Navegación funcional
- [ ] OAuth flow completo

### E2E Tests (Playwright)
- [ ] Página `/app` carga correctamente
- [ ] Widgets muestran datos
- [ ] Conexión de red funciona
- [ ] Tabla navega a detalle

---

## 📚 Dependencies

### Backend Endpoints Requeridos
- `GET /api/usage/current` - Uso actual del mes
- `GET /api/accounts` - Lista de cuentas conectadas
- `POST /api/accounts/connect/:platform` - Iniciar OAuth

### Frontend Dependencies
- shadcn/ui components (card, progress, button, table)
- React Router (navegación)
- Supabase Client (auth, API calls)

---

## 🎨 Design System

### Componentes shadcn/ui
- `Card` - Contenedores de widgets
- `Progress` - Barras de progreso
- `Button` - Botones de acción
- `Table` - Tabla de cuentas
- `Badge` - Estados (activo/inactivo)

### Tema
- Claro/oscuro/sistema (sistema por defecto)
- Colores consistentes con design system
- Responsive breakpoints (sm, md, lg, xl)

---

## 🚀 Deployment

### Pre-requisitos
- [ ] Backend endpoints implementados y testeados
- [ ] OAuth flow configurado en backend
- [ ] Feature flags configurados (si aplica)

### Checklist Pre-Merge
- [ ] Tests pasando (unit + integration)
- [ ] Coverage >= 90%
- [ ] CodeRabbit = 0 comentarios
- [ ] GDD nodes actualizados
- [ ] Receipts generados
- [ ] Evidencias visuales (screenshots)

---

## 📝 Notas

- Usar MCP shadcn-studio para generar componentes base
- Customizar para conectar con APIs reales de Roastr.AI
- Seguir patrones existentes en `frontend/src/components/`
- Mantener consistencia con design system shadcn/ui

---

**Agentes Relevantes:**
- FrontendDev (implementación UI)
- TestEngineer (tests unitarios e integración)
- UIDesigner (validación visual)

**Nodos GDD:**
- `roast` - Para contexto de roasts
- `shield` - Para intercepciones shield
- `queue-system` - Para contexto de workers

