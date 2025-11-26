# Guía de Migración UI: MUI → shadcn/ui

**Epic:** #1032  
**Fecha:** 2025-11-26  
**Status:** En progreso

## Inventario de Componentes

### Componentes Dashboard Existentes

| Componente Actual | Ubicación | Usa MUI | Migración a shadcn | Status |
|-------------------|-----------|---------|-------------------|---------|
| StatusCard | `src/components/dashboard/StatusCard.tsx` | ✅ Card, Typography | Card | ✅ MIGRADO |
| BaseTag | `src/components/dashboard/BaseTag.tsx` | ✅ Chip | Badge | ✅ MIGRADO |
| ActionTag | `src/components/dashboard/ActionTag.tsx` | ✅ Chip | Badge | ✅ MIGRADO |
| SeverityTag | `src/components/dashboard/SeverityTag.tsx` | ✅ Chip | Badge | 🔄 PENDIENTE |
| NodeChip | `src/components/dashboard/NodeChip.tsx` | ✅ Chip | Badge | 🔄 PENDIENTE |
| DiffModal | `src/components/dashboard/DiffModal.tsx` | ✅ Dialog, Typography | Dialog | 🔄 PENDIENTE |
| CaseCard | `src/components/dashboard/CaseCard.tsx` | ✅ Card, Typography | Card | 🔄 PENDIENTE |
| Overview | `src/components/dashboard/Overview.tsx` | ✅ Grid, Box | div + Tailwind | 🔄 PENDIENTE |
| NodeExplorer | `src/components/dashboard/NodeExplorer.tsx` | ✅ Box, Typography | div + Tailwind | 🔄 PENDIENTE |
| DependencyGraph | `src/components/dashboard/DependencyGraph.tsx` | ❌ SVG puro | Mantener | ⏸️ NO MIGRAR |
| ReportsViewer | `src/components/dashboard/ReportsViewer.tsx` | ✅ Typography | div + Tailwind | 🔄 PENDIENTE |
| ActivityLogItem | `src/components/dashboard/ActivityLogItem.tsx` | ✅ Typography | div + Tailwind | 🔄 PENDIENTE |
| CornerSeparator | `src/components/dashboard/CornerSeparator.tsx` | ✅ Box | Separator | 🔄 PENDIENTE |
| GovernanceReports | `src/components/dashboard/GovernanceReports.tsx` | ✅ Box | Card | 🔄 PENDIENTE |

### Componentes shadcn/ui Instalados

✅ **Instalados:**
- `button` - Buttons con variants
- `dropdown-menu` - Menús desplegables
- `card` - Cards con header/content/footer
- `badge` - Badges/tags
- `tabs` - Componente de pestañas
- `dialog` - Modales/dialogs
- `input` - Inputs de formulario
- `table` - Tablas con sorting

## Mapeo MUI → shadcn/ui

### Layout Components

| MUI Component | shadcn Equivalent | Notes |
|---------------|-------------------|-------|
| `Box` | `<div className="...">` | Usar Tailwind directamente |
| `Container` | `<div className="container">` | Tailwind container utility |
| `Grid` | `<div className="grid ...">` | Tailwind grid utilities |
| `Stack` | `<div className="flex flex-col">` | Flexbox con Tailwind |

### Data Display

| MUI Component | shadcn Equivalent | Props Mapping |
|---------------|-------------------|---------------|
| `Card` | `Card` | Estructura similar |
| `Typography` | Native HTML + Tailwind | `variant="h1"` → `<h1 className="text-4xl">` |
| `Chip` | `Badge` | `variant="filled"` → `variant="default"` |
| `Divider` | `Separator` | Orientación similar |

### Inputs

| MUI Component | shadcn Equivalent | Props Mapping |
|---------------|-------------------|---------------|
| `TextField` | `Input` | `variant="outlined"` → estándar |
| `Select` | `Select` | API similar |
| `Button` | `Button` | `variant="contained"` → `variant="default"` |

### Feedback

| MUI Component | shadcn Equivalent | Props Mapping |
|---------------|-------------------|---------------|
| `Dialog` | `Dialog` | Estructura similar con trigger |
| `Alert` | `Alert` | Severity mapping similar |
| `Snackbar` | `Toast` | Usar react-hot-toast o sonner |

## Guía de Migración Paso a Paso

### 1. Card Component

**Antes (MUI):**
```tsx
import { Card, CardContent, Typography } from '@mui/material';

<Card>
  <CardContent>
    <Typography variant="h5">Title</Typography>
    <Typography variant="body2">Content</Typography>
  </CardContent>
</Card>
```

**Después (shadcn):**
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">Content</p>
  </CardContent>
</Card>
```

### 2. Chip/Badge Component

**Antes (MUI):**
```tsx
import { Chip } from '@mui/material';

<Chip 
  label="Active" 
  color="success" 
  variant="filled" 
  size="small"
/>
```

**Después (shadcn):**
```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="default" className="bg-green-500">
  Active
</Badge>
```

### 3. Dialog Component

**Antes (MUI):**
```tsx
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

<Dialog open={open} onClose={handleClose}>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>Content</DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
  </DialogActions>
</Dialog>
```

**Después (shadcn):**
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <div>Content</div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Variantes de Color

### MUI Colors → Tailwind

| MUI Color | Tailwind Equivalent | shadcn Variant |
|-----------|---------------------|----------------|
| `primary` | `bg-primary` | `variant="default"` |
| `secondary` | `bg-secondary` | `variant="secondary"` |
| `success` | `bg-green-500` | Custom className |
| `error` / `destructive` | `bg-destructive` | `variant="destructive"` |
| `warning` | `bg-yellow-500` | Custom className |
| `info` | `bg-blue-500` | Custom className |

## Typography Mapping

| MUI Variant | shadcn/Tailwind Equivalent |
|-------------|---------------------------|
| `h1` | `<h1 className="text-4xl font-bold">` |
| `h2` | `<h2 className="text-3xl font-semibold">` |
| `h3` | `<h3 className="text-2xl font-semibold">` |
| `h4` | `<h4 className="text-xl font-semibold">` |
| `h5` | `<h5 className="text-lg font-medium">` |
| `h6` | `<h6 className="text-base font-medium">` |
| `body1` | `<p className="text-base">` |
| `body2` | `<p className="text-sm">` |
| `caption` | `<span className="text-xs text-muted-foreground">` |

## Spacing & Layout

### MUI sx → Tailwind

| MUI sx | Tailwind Equivalent |
|--------|---------------------|
| `sx={{ p: 2 }}` | `className="p-2"` (0.5rem) |
| `sx={{ m: 2 }}` | `className="m-2"` |
| `sx={{ display: 'flex' }}` | `className="flex"` |
| `sx={{ flexDirection: 'column' }}` | `className="flex-col"` |
| `sx={{ gap: 2 }}` | `className="gap-2"` |
| `sx={{ alignItems: 'center' }}` | `className="items-center"` |

## Theme Variables

### Dark Cyber Theme → shadcn CSS Variables

```css
/* Antes (darkCyberTheme.ts) */
background: '#0A0E27'
paper: '#141B3D'
primary: '#00FFA3'

/* Después (index.css - dark mode) */
--background: oklch(0.145 0 0);      /* Dark navy */
--card: oklch(0.205 0 0);             /* Slightly lighter */
--primary: oklch(0.922 0 0);          /* Cyan green */
```

## Checklist por Componente

Antes de considerar un componente migrado:

- [ ] Imports de MUI eliminados
- [ ] Componente shadcn importado
- [ ] Props mapeados correctamente
- [ ] Estilos aplicados con Tailwind
- [ ] Tema claro/oscuro funciona
- [ ] Tipos TypeScript correctos
- [ ] Visual regression test pasando

## Componentes NO Migrar

Algunos componentes deben mantenerse como están:

1. **DependencyGraph** - Gráfico D3 custom, no requiere migración
2. **Componentes con lógica compleja** - Migrar solo UI, mantener lógica

## Referencias

- shadcn/ui docs: https://ui.shadcn.com/
- Tailwind CSS: https://tailwindcss.com/
- MUI → Tailwind migration: https://tailwindcss.com/docs/hover-focus-and-other-states

---

**Última actualización:** 2025-11-26  
**Mantenido por:** Frontend Dev Team

