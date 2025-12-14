# GDD Node — Panel de Administración v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`ssot-integration`](./15-ssot-integration.md)
- [`billing`](./billing.md)

- [`ssot-integration`](./15-ssot-integration.md)
- [`billing`](./billing.md)

Este nodo depende de los siguientes nodos:

- [`ssot-integration`](./15-ssot-integration.md)
- [`billing`](./billing.md)

---

### Backend API:

- `GET /admin/users` - Lista usuarios
- `GET /admin/users/:id` - Detalle usuario
- `POST /admin/users` - Crear usuario
- `PUT /admin/users/:id` - Editar usuario
- `DELETE /admin/users/:id` - Eliminar
- `POST /admin/impersonate/:userId` - Iniciar impersonación
- `GET /admin/feature-flags` - Lista flags
- `PUT /admin/feature-flags/:key` - Toggle flag
- `GET /admin/plans` - Lista planes
- `PUT /admin/plans/:planId` - Editar límites
- `GET /admin/tones` - Lista tonos
- `PUT /admin/tones/:toneId` - Editar tono
- `GET /admin/metrics/usage` - Métricas uso
- `GET /admin/metrics/business` - Métricas negocio
- `GET /admin/dlq` - DLQ jobs
- `POST /admin/dlq/:jobId/retry` - Reintentar job
- `POST /admin/dlq/:jobId/discard` - Descartar job
- `GET /admin/logs` - Admin logs

### Supabase:

- Tabla `admin_settings` (SSOT)
- Tabla `admin_logs`
- Tabla `admin_impersonation_logs`
- RLS estricto (solo superadmin)

### Nodos Relacionados:

- `02-autenticacion-usuarios.md` (Roles, sesiones)
- `11-feature-flags.md` (Gestión flags)
- `15-ssot-integration.md` (Edición SSOT)

---

## 7. Edge Cases

1. **Admin intenta impersonar sin ser superadmin**:
   - Rechazado
   - Log de intento

2. **Impersonación > 5 min**:
   - Token expira
   - Logout automático

3. **Flag crítico sin doble confirmación**:
   - UI bloquea cambio
   - Requiere confirmación

4. **Tono desactivado con usuarios activos**:
   - Usuarios hacen fallback a Balanceado
   - Banner en UI

5. **Edición límites durante ciclo activo**:
   - Por defecto, solo aplica en ciclos futuros
   - Superadmin puede marcar "Aplicar inmediatamente" para recalcular ciclo actual

6. **DLQ job sin datos suficientes**:
   - Marca como no procesable
   - Log específico

7. **Cursor reset en cuenta activa**:
   - Pausar workers
   - Reset cursor
   - Reactivar workers

8. **Admin inactivo > 4h**:
   - Logout automático
   - Requiere re-login

9. **Cambio flag global mientras hay jobs**:
   - Workers respetan flag en siguiente ejecución
   - No afecta jobs en curso

10. **Metrics API falla**:
    - Muestra último snapshot
    - Botón "Reintentar"

---

## 8. Acceptance Criteria

### Usuarios:

- [ ] Tabla usuarios con búsqueda
- [ ] Crear usuario manualmente
- [ ] Editar plan/estado
- [ ] Pausar cuenta
- [ ] Eliminar (soft-delete + 30d retención)
- [ ] NO ver Persona/sponsors en claro

### Impersonación:

- [ ] Iniciar impersonación → ve UI usuario
- [ ] Puede ejecutar acciones usuario
- [ ] Token 5 min
- [ ] Logs etiquetados
- [ ] NO ve Persona/tokens en claro

### Feature Flags:

- [ ] Lista 15 flags oficiales
- [ ] Todos los flags editables por superadmin
- [ ] Toggle ON/OFF
- [ ] Cambios en caliente (cache 5–30s)
- [ ] Logs automáticos
- [ ] Doble confirmación obligatoria en flags críticos

### Planes:

- [ ] Editar límites (análisis, roasts, cuentas) sin restricciones
- [ ] Editar features por plan
- [ ] Editar trial días
- [ ] Opción "Aplicar inmediatamente" disponible (recalcula ciclo actual)
- [ ] Precio solo lectura (Polar)
- [ ] Logs before/after

### Tonos:

- [ ] Lista tonos
- [ ] Crear nuevos tonos sin restricciones
- [ ] Editar prompt base sin restricciones
- [ ] Cambiar modelo IA
- [ ] Desactivar/habilitar tonos
- [ ] Validación prompt técnica (sin insultos/explícito)

### Métricas Uso:

- [ ] Análisis totales/mes
- [ ] Roasts totales/mes
- [ ] Shield activado
- [ ] Media por usuario/plan
- [ ] % con Persona/Sponsors/Auto-approve

### Métricas Negocio:

- [ ] Usuarios por plan
- [ ] MRR, ARPU, churn
- [ ] Coste estimado IA
- [ ] Margen por plan

### DLQ:

- [ ] Lista jobs fallados
- [ ] Ver detalle (sin texto sensible)
- [ ] Reintentar job
- [ ] Descartar job
- [ ] Logs de acciones

### Cursors:

- [ ] Lista cursors por cuenta
- [ ] Reset cursor
- [ ] Marcar inactive
- [ ] Logs

### Admin Logs:

- [ ] Lista ordenada desc
- [ ] Filtros: admin_id, tipo, fechas
- [ ] Muestra before/after

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Hooks admin
- ✅ Validación de prompts
- ❌ NO testear: Componentes UI simples

### E2E Tests (Playwright):

- ✅ Login admin → Admin Panel
- ✅ Lista usuarios
- ✅ Crear usuario
- ✅ Editar usuario (plan/estado)
- ✅ Impersonar usuario → ve UI usuario
- ✅ Feature flag toggle → cambio aplicado
- ✅ Editar límites plan → guardado
- ✅ Editar tono → validación pasa
- ✅ Métricas uso visibles
- ✅ Métricas negocio visibles
- ✅ DLQ: reintentar job
- ✅ DLQ: descartar job
- ✅ Cursor reset
- ✅ Admin logs filtrados
- ✅ Logout tras 4h inactividad

---

## 10. Implementation Notes

### Admin Layout:

```typescript
// apps/frontend-v2/app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default async function AdminLayout({ children }) {
  const user = await getUser();

  if (user.role !== 'superadmin') {
    redirect('/dashboard');
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
```

### Impersonation:

```typescript
// apps/backend-v2/src/services/impersonationService.ts

export async function startImpersonation(
  adminId: string,
  userId: string
): Promise<{ token: string; expiresAt: string }> {
  // Verificar admin
  const admin = await getUser(adminId);
  if (admin.role !== 'superadmin') {
    throw new Error('Unauthorized');
  }

  // Generar token temporal
  const token = await generateImpersonationToken(adminId, userId);

  // Log
  await logImpersonation({
    admin_id: adminId,
    user_id: userId,
    action: 'impersonation_start'
  });

  return {
    token,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  };
}
```

### Feature Flags Editor:

```typescript
// apps/frontend-v2/app/admin/settings/feature-flags/page.tsx

export default function FeatureFlagsPage() {
  const { data: flags } = useFeatureFlags();

  const handleToggle = async (key: string, value: boolean) => {
    // Doble confirmación si crítico
    if (isCriticalFlag(key)) {
      const confirmed = await confirm('¿Estás seguro?');
      if (!confirmed) return;
    }

    await updateFlag(key, value);
  };

  return (
    <Table>
      {flags.map(flag => (
        <Row key={flag.key}>
          <Cell>{flag.key}</Cell>
          <Cell>{flag.description}</Cell>
          <Cell>
            <Switch checked={flag.value} onChange={(v) => handleToggle(flag.key, v)} />
          </Cell>
        </Row>
      ))}
    </Table>
  );
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 10)
- SSOT: `docs/SSOT/roastr-ssot-v2.md`

## 11. Related Nodes

Este nodo está relacionado con los siguientes nodos:

- Ningún nodo relacionado

---

## 12. SSOT References

Este nodo usa y edita los siguientes valores del SSOT:

- `feature_flags` - Gestión de feature flags (ON/OFF)
- `plan_limits` - Edición de límites y capacidades de planes
- `roast_tones` - Edición de tonos (prompts, modelos)
- `shield_thresholds` - Edición de thresholds de Shield

**Nota:** Este nodo es el único que puede editar el SSOT (requiere role=superadmin).

---

## Related Nodes

- ssot-integration (depends_on)
- billing-integration (depends_on)
