# GDD Node — Panel de Usuario (Frontend v2)

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Aplicación frontend completa para usuarios (role=user) con Dashboard, gestión de cuentas sociales, detalle de cuenta, roasts, Shield logs, configuración de Roastr Persona, billing, y settings. Implementada con Next.js App Router, React 19, shadcn/ui y TailwindCSS.

---

## 2. Responsibilities

### Funcionales:

- Dashboard con widgets de uso (análisis, roasts)
- Tabla de cuentas conectadas
- Añadir/desconectar cuentas (respetando límites por plan)
- Detalle de cuenta: roasts, Shield logs, settings
- Configuración de Roastr Persona
- Sponsors (solo Plus)
- Billing: método de pago, plan, cancelación
- Onboarding wizard multi-paso
- Tema claro/oscuro/sistema

### No Funcionales:

- Responsive (mobile-first)
- Accesibilidad (Radix primitives)
- Performance (React Query)
- Seguridad: JWT validation, RLS

---

## 3. Inputs

- Usuario autenticado (role=user)
- JWT token de Supabase
- Datos de backend vía React Query:
  - Cuentas conectadas
  - Límites y uso actual
  - Roasts pendientes/publicados
  - Shield logs
  - Configuraciones
- SSOT (vía backend API)

---

## 4. Outputs

- UI completa del User App
- Acciones de usuario:
  - Conectar/desconectar cuentas
  - Aprobar/regenerar/descartar roasts
  - Configurar Roastr Persona
  - Cambiar tono, auto-approve, Shield aggressiveness
  - Gestionar billing (upgrade, cancelar)
- Navegación entre rutas

---

## 5. Rules

### Rutas Principales:

```
/dashboard
/accounts
/accounts/:id
/settings/profile
/settings/roastr
/settings/sponsors   (Plus only)
/settings/billing
```

### Stack Frontend:

- **Next.js App Router**
- **React 19**
- **shadcn/ui** (base UI)
- **TailwindCSS**
- **Radix primitives** (accesibilidad)
- **React Query** (sync con backend)

### Tema:

- Default: **Sistema** (respeta preferencia OS)
- Alternativas: Claro, Oscuro
- Persistencia: localStorage

### Dashboard - Widgets:

**1. Widget Análisis**:

- Barra progreso: `{{used}} / {{limit}}`
- Colores:
  - Normal → azul
  - Warning (>80%) → amarillo
  - Limit reached → rojo
- Badge: "Análisis agotados"
- CTA: "Mejorar Plan"

**2. Widget Roasts**:

- Igual que análisis
- Badge: "Roasts agotados"
- Nota si roasts agotados pero análisis no: "Shield sigue activo"

**3. Tabla de Cuentas**:

- Columnas: icono red, handle, estado, roasts mes, intercepciones Shield
- Estados:
  - 🟢 active
  - 🟡 paused
  - 🔴 inactive
  - ⚫ sin análisis
- Clic en fila → `/accounts/:id`

### Detalle de Cuenta (`/accounts/:id`):

**Header**:

- Icono red + handle + badge estado
- Botón "Settings"

**Resumen (widgets)**:

- Análisis usados por cuenta
- Roasts generados
- Intercepciones Shield
- Estado auto-approve

**Tabla Roasts**:

- Columnas: comentario original (truncado), roast generado, estado
- Estados: publicado, pendiente aprobación, enviado manualmente
- Acciones: regenerar, enviar, descartar
- Histórico: máx 90 días (GDPR)

**Shield (acordeón)**:

- Estado Shield
- Tabla: id anon, link comentario, acción (badge), timestamp
- Botón "Ver en red" (si plataforma permite)

**Settings (modal)**:

- Auto-approve ON/OFF + texto legal transparencia
- Pausar cuenta
- Shield aggressiveness: 90% / 95% / 98% / 100%
- Selector tono: flanders, balanceado, canalla, personal (Pro/Plus)
- Preview de tono (roast ejemplo en vivo)

### Añadir Cuenta:

- Cards por red: X, YouTube
- Botón "Conectar cuenta (1/1)" (Starter) o "(1/2)" (Pro/Plus)
- Si límite alcanzado → disabled

### Settings Usuario (`/settings/*`):

**Profile**:

- Email
- Cambiar contraseña
- Descargar mis datos
- Logout

**Roastr**:

- Transparencia IA (texto educativo, no editable)
- Roastr Persona:
  - Lo que me define
  - Líneas rojas
  - Lo que me da igual
  - Límite: 200 chars cada campo
  - ❌ NO visible para admins
  - Sin reset ni borrado

**Sponsors** (Plus only):

- Tabla: nombre, estado, URL, tags, tono, aggressiveness Shield
- Botón "Añadir Sponsor"
- Independiente de Roastr Persona

**Billing**:

- Método de pago
- Plan activo
- Próximo cobro
- Si cancelado: "Roastr seguirá activo hasta {{current_period_end}}"
- Botones: Upgrade, Cancelar, Editar método de pago

### Estados UI:

**Empty states**:

- Sin cuentas → card "Añadir cuenta"
- Sin roasts → "Aún no hay roasts este mes"
- Sin Shield events → "Sin intercepciones"

**Loading**: Skeletons shadcn

**Error**: Alert con "Reintentar"

**Pausado**: Badge + explicación

**Inactivo**: Badge + CTA "Reconectar"

### Responsive:

**Escritorio**:

- 2-3 columnas
- Tablas normales
- Widgets horizontales

**Móvil**:

- Cards apiladas
- Tablas → accordions
- Modales → sheets
- Navegación simplificada

### Accesibilidad:

- Roles ARIA (Radix)
- Focus-visible
- Contraste garantizado
- Texto legible dark/light

### Onboarding Wizard:

Estados:

```typescript
type OnboardingState =
  | 'welcome'
  | 'select_plan'
  | 'payment'
  | 'persona_setup'
  | 'connect_accounts'
  | 'done';
```

Flujo:

1. welcome → Introducción
2. select_plan → Starter/Pro/Plus
3. payment → Añadir método de pago
4. persona_setup → Roastr Persona (recomendado, NO obligatorio)
   - CTA "Omitir por ahora" disponible
   - Si se omite → se crea Roastr Persona vacía (sin identidades, sin líneas rojas, sin tolerancias)
   - El análisis funcionará sin ajustes persona-based (comportamiento más conservador)
   - El usuario puede configurarlo más tarde desde Settings → Roastr
5. connect_accounts → X o YouTube
6. done → Dashboard

Se reanuda donde se quedó.

**Reglas persona_setup**:

- persona_setup es recomendado, pero NO obligatorio
- El usuario puede saltarlo mediante CTA "Omitir por ahora"
- Si se omite → se crea una Roastr Persona vacía (sin identidades, sin líneas rojas, sin tolerancias)
- El análisis funcionará sin ajustes persona-based (comportamiento más conservador)
- El usuario puede configurarlo más tarde desde Settings → Roastr
- El flujo del onboarding continúa a connect_accounts aunque persona_setup no se complete
- El onboarding se considera completado (state="done") una vez se conecta al menos una cuenta o el usuario decide continuar sin conectar ninguna

---

## 6. Dependencies

### Backend API:

- `GET /api/accounts` - Lista cuentas
- `GET /api/accounts/:id` - Detalle cuenta
- `POST /api/accounts/connect` - OAuth flow
- `DELETE /api/accounts/:id` - Desconectar
- `GET /api/roasts/:accountId` - Lista roasts
- `POST /api/roasts/:id/regenerate` - Regenerar
- `POST /api/roasts/:id/approve` - Aprobar
- `GET /api/shield/:accountId` - Shield logs
- `GET /api/usage` - Análisis y roasts usados
- `GET /api/settings/persona` - Roastr Persona
- `PUT /api/settings/persona` - Actualizar Persona
- `GET /api/billing` - Estado suscripción
- `POST /api/billing/upgrade` - Upgrade plan
- `POST /api/billing/cancel` - Cancelar

### Supabase:

- Supabase Auth (client-side)
- RLS para proteger datos

### Componentes shadcn/ui:

- Button, Card, Badge, Alert
- Table, Sheet, Dialog, Accordion
- Progress, Skeleton
- Select, Input, Textarea
- Tabs, Tooltip

### Nodos Relacionados:

- `02-autenticacion-usuarios.md` (Auth, onboarding)
- `03-billing-polar.md` (Billing UI)
- `04-integraciones.md` (Conectar cuentas)
- `15-ssot-integration.md` (SSOT vía API)

---

## 7. Edge Cases

1. **Análisis agotados**:
   - Widget rojo
   - Banner "Mejora tu plan"
   - Solo histórico visible

2. **Roasts agotados pero análisis no**:
   - Shield sigue funcionando
   - Nota: "Shield sigue activo"

3. **Límite cuentas alcanzado**:
   - Botón "Conectar" disabled

4. **Cuenta inactive**:
   - Badge rojo
   - Botón "Reconectar"

5. **Billing paused**:
   - Todas las cuentas → paused
   - Banner global
   - CTA "Actualizar método de pago"

6. **Roast pendiente aprobación**:
   - Botones: Enviar, Regenerar, Descartar
   - Preview del roast

7. **Regeneración sin créditos**:
   - Botón disabled
   - Tooltip "Sin créditos"

8. **Onboarding incompleto**:
   - Wizard se muestra automáticamente
   - Reanuda en paso actual

9. **Persona setup omitido**:
   - CTA "Omitir por ahora" disponible en paso persona_setup
   - Si se omite → se crea Roastr Persona vacía (sin identidades, sin líneas rojas, sin tolerancias)
   - El análisis funcionará sin ajustes persona-based (comportamiento más conservador)
   - El usuario puede configurarlo más tarde desde Settings → Roastr
   - El flujo continúa a connect_accounts normalmente

10. **Tema cambiado**:

- Aplica inmediatamente
- Persiste en localStorage

11. **Mobile view**:
    - Tablas → accordions
    - Modales → sheets

---

## 8. Acceptance Criteria

### Dashboard:

- [ ] Widgets de análisis y roasts visibles
- [ ] Barras de progreso con colores correctos
- [ ] Badges cuando límite alcanzado
- [ ] Tabla de cuentas con estados
- [ ] Botón "Añadir cuenta" (respeta límites)

### Detalle Cuenta:

- [ ] Header con icono + handle + badge
- [ ] Widgets resumen
- [ ] Tabla roasts (histórico 90 días)
- [ ] Shield logs (acordeón)
- [ ] Settings modal funcional

### Settings:

- [ ] Roastr Persona editable (3 campos, 200 chars c/u)
- [ ] Cambio de tono funcional
- [ ] Shield aggressiveness configurable
- [ ] Auto-approve toggle funcional
- [ ] Sponsors (Plus only)
- [ ] Billing: upgrade, cancelar, método pago

### Onboarding:

- [ ] 6 pasos implementados
- [ ] Se reanuda donde se quedó
- [ ] Persona setup opcional con CTA "Omitir por ahora"
- [ ] Si se omite persona_setup → se crea Roastr Persona vacía
- [ ] El flujo continúa a connect_accounts aunque persona_setup no se complete
- [ ] Redirect a dashboard al finalizar

### Responsive:

- [ ] Mobile: cards apiladas, accordions
- [ ] Tablet: 2 columnas
- [ ] Desktop: 3 columnas
- [ ] Breakpoints: 375px, 768px, 1920px

### Tema:

- [ ] Sistema (default)
- [ ] Claro
- [ ] Oscuro
- [ ] Persiste en localStorage
- [ ] Aplica inmediatamente

### Accesibilidad:

- [ ] Roles ARIA
- [ ] Focus-visible
- [ ] Contraste adecuado
- [ ] Texto legible en ambos temas

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Hooks (useSettings, useAccounts, useAnalysisUsage)
- ✅ Transformaciones de datos
- ❌ NO testear: Componentes UI simples

### E2E Tests (Playwright):

- ✅ Login → Dashboard
- ✅ Conectar cuenta X (mock OAuth)
- ✅ Conectar cuenta YouTube (mock OAuth)
- ✅ Límite alcanzado → botón disabled
- ✅ Dashboard widgets muestran datos correctos
- ✅ Detalle cuenta: roasts + Shield logs
- ✅ Aprobar roast → publicado
- ✅ Regenerar roast → nuevo generado
- ✅ Configurar Roastr Persona
- ✅ Cambiar tono → preview actualizado
- ✅ Shield aggressiveness → guardado
- ✅ Billing: upgrade plan (mock Polar)
- ✅ Billing: cancelar suscripción
- ✅ Onboarding completo
- ✅ Tema claro/oscuro/sistema
- ✅ Responsive (375px, 768px, 1920px)

---

## 10. Implementation Notes

### Next.js App Router:

```typescript
// apps/frontend-v2/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Dashboard:

```typescript
// apps/frontend-v2/app/dashboard/page.tsx
export default function Dashboard() {
  const { data: usage } = useAnalysisUsage();
  const { data: accounts } = useAccounts();

  return (
    <div className="container">
      <UsageWidgets usage={usage} />
      <AccountsTable accounts={accounts} />
      <AddAccountButton />
    </div>
  );
}
```

### React Query Setup:

```typescript
// apps/frontend-v2/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000 // 5 min
    }
  }
});
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 9)
- SSOT: `docs/SSOT/roastr-ssot-v2.md`
- shadcn/ui: https://ui.shadcn.com/
