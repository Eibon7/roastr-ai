# GDD Node — Panel de Usuario (Frontend v2)

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`roasting-engine`](./06-motor-roasting.md)
- [`shield-engine`](./07-shield.md)
- [`observabilidad`](./observabilidad.md)
- [`integraciones-redes-sociales`](./04-integraciones.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`analysis-engine`](./05-motor-analisis.md)
- [`billing`](./billing.md)

- [`roasting-engine`](./06-motor-roasting.md)
- [`shield-engine`](./07-shield.md)
- [`observabilidad`](./observabilidad.md)
- [`integraciones-redes-sociales`](./04-integraciones.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`analysis-engine`](./05-motor-analisis.md)
- [`billing`](./billing.md)

Este nodo depende de los siguientes nodos:

- [`roasting-engine`](./06-motor-roasting.md)
- [`shield-engine`](./07-shield.md)
- [`observabilidad`](./observabilidad.md)
- [`integraciones-redes-sociales`](./04-integraciones.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`analysis-engine`](./05-motor-analisis.md)
- [`billing`](./billing.md)

---

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

## 11. Related Nodes

Este nodo está relacionado con los siguientes nodos:

- Ningún nodo relacionado

---

## 12. SSOT References

Este nodo usa los siguientes valores del SSOT (vía backend API):

- `plan_limits` - Límites de análisis y roasts por plan
- `plan_capabilities` - Capacidades por plan (cuentas, features)
- `feature_flags` - Flags de features habilitadas
- `roast_tones` - Tonos disponibles para roasts
- `shield_thresholds` - Thresholds de Shield para configuración
- `subscription_states` - Estados de suscripción para UI

**Nota:** Este nodo no accede directamente al SSOT, lo hace a través del backend API.

---
