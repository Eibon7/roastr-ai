# GDD Node — Panel de Administración v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Panel completo para superadmins que permite gestionar usuarios, editar SSOT (planes, tonos, flags), impersonar usuarios de forma segura, ver métricas globales (uso y negocio), gestionar DLQ, cursors, y mantener logs administrativos. Es el orquestador central del sistema.

---

## 2. Responsibilities

### Funcionales:

- Gestión de usuarios (crear, editar, pausar, eliminar)
- Impersonación segura (view-only, sin acceso a Persona/sponsors)
- Edición de SSOT:
  - Feature flags (ON/OFF)
  - Planes (límites, capacidades, trials)
  - Tonos (prompts, modelos)
  - Thresholds Shield
  - Disclaimers IA
- Métricas de uso (análisis, roasts, Shield, engagement)
- Métricas de negocio (MRR, ARPU, churn, costes)
- Herramientas de mantenimiento:
  - DLQ (reintentar/descartar jobs)
  - Cursors (reset)
  - Sincronización Polar
  - Reconteo de uso
- Logs administrativos (auditoría completa)

### No Funcionales:

- Seguridad: solo role=superadmin
- Sesión: 24h, logout tras 4h inactividad
- Auditoría: todos los cambios loggeados
- Protección: doble confirmación en acciones críticas

---

## 3. Inputs

- Admin autenticado (role=superadmin)
- JWT token con permisos elevados
- SSOT actual (admin_settings)
- Métricas globales (backend)
- DLQ jobs
- Admin logs

---

## 4. Outputs

- SSOT actualizado
- Usuarios gestionados
- Flags modificados
- Planes editados
- Tonos configurados
- Jobs DLQ procesados
- Cursors reseteados
- Logs administrativos

---

## 5. Rules

### Rutas Admin:

```
/admin/users
/admin/users/:id
/admin/settings/feature-flags
/admin/settings/plans
/admin/settings/tones
/admin/metrics/usage
/admin/metrics/business
```

### Acceso:

- Solo `role = 'superadmin'`
- Middleware server-side + RLS
- Sesión: 24h
- Inactividad > 4h → logout automático
- ❌ NO magic link

### Autoridad del Superadmin:

**Principio general**:

- El superadmin puede modificar absolutamente cualquier parte del SSOT, sin excepciones.
- Los valores críticos (thresholds del Shield, parámetros del Style Validator, flags legales y de seguridad) solo requieren un paso adicional de doble confirmación para evitar cambios accidentales.
- No existen valores del SSOT que estén bloqueados para el superadmin.
- El superadmin puede modificar thresholds legales o de seguridad, siempre que pase la doble confirmación obligatoria.

**Aplicación de cambios**:

- Cambios en flags y configuraciones → aplican en caliente (cache 5–30s)
- Cambios en planes → aplican a ciclos futuros por defecto (con opción "Aplicar inmediatamente")
- Todos los cambios quedan registrados en `admin_logs` con before/after

### Gestión de Usuarios:

**Vista**:

- Tabla: email, user_id, plan, estado (active/paused), fecha alta
- Búsqueda: email, user_id

**Acciones**:

- Crear usuario manualmente
- Editar: plan, estado, flags internos
- Pausar cuenta (soporte/fraude)
- Eliminar: soft-delete + retención 30 días → purga

**Restricciones**:

- ❌ NO ver Roastr Persona en texto claro
- ❌ NO ver sponsors detallados
- ✅ Solo métricas agregadas

### Impersonación Segura:

**Alcance**:

- Ver UI exactamente como usuario
- Ejecutar **mismas acciones** que usuario:
  - Conectar/desconectar cuentas
  - Cambiar Shield, tono, auto-approve
  - Pausar cuentas
  - Gestionar plan desde Billing UI
  - Cancelar suscripción
  - Actualizar método de pago (vía Polar)
- ❌ NO ver: Persona en claro, datos tarjeta, tokens OAuth

**Técnico**:

- Token temporal: 5 min validez
- Scope: solo rutas User Panel
- Logs etiquetados: `admin_impersonation_logs`

**Logs impersonación**:

```typescript
{
  (id,
    admin_id,
    user_id,
    action, // "impersonation_start" | "click" | "update_setting"
    route,
    metadata,
    timestamp);
}
```

### Feature Flags:

**Vista**:

- Tabla: nombre, categoría, descripción, estado (ON/OFF), timestamp activación
- Cambios → aplican en caliente (cache 5-30s)
- Logs automáticos en `admin_logs`

**Autoridad del superadmin**:

- Todos los feature flags son editables por el superadmin.
- Los flags críticos (kill switches, fallback globales, bypasses de seguridad) requieren doble confirmación.
- Los cambios entran en vigor en caliente (cache 5–30s).

**Flags críticos** (requieren doble confirmación):

- `kill_switch_autopost`
- Tonos experimentales
- Fallback IA global
- Flags que afecten Shield Crítico
- Flags que afecten Style Validator
- Flags que afecten restricciones legales (disclaimers IA)

### Gestión de Planes:

**Autoridad del superadmin**:

- El superadmin puede editar límites de plan, capacidades, trial days y activar/desactivar features sin restricciones.
- Los precios siguen siendo solo lectura, ya que dependen directamente de Polar.
- Los cambios afectan a ciclos futuros salvo que el superadmin marque explícitamente la opción "Aplicar inmediatamente", que forzará un recálculo del ciclo actual.

**Campos editables por plan**:

- `analysis_per_month`
- `roasts_per_month`
- `max_accounts_per_platform`
- Features: Shield, Persona, Tono Personal, Sponsors (Plus)
- Trial días: Starter (30), Pro (7), Plus (0)
- Precio (solo lectura desde Polar)

**Reglas**:

- Cambios impactan **ciclos futuros** por defecto
- Opción "Aplicar inmediatamente" disponible para superadmin (recalcula ciclo actual)
- Log en `admin_logs` con before/after

### Gestión de Tonos:

**Autoridad del superadmin**:

- El superadmin puede crear nuevos tonos, editar prompts base, asignar modelos, habilitar o deshabilitar tonos.
- No hay restricciones excepto aquellas derivadas de las validaciones internas (no insultos, no contenido explícito).
- Un tono desactivado provoca fallback automático a "balanceado".

**Vista**:

- Tabla: nombre, idioma, prompt base, modelo, estado

**Acciones**:

- Añadir tono
- Editar prompt base
- Cambiar modelo IA
- Desactivar tono

**Validación prompt** (restricciones técnicas internas):

- ❌ NO insultos directos
- ❌ NO contenido explícito
- ❌ NO anular disclaimers IA
- ❌ NO desactivar reglas seguridad

**Fallback**:

- Si tono desactivado → usuarios usan Balanceado

### Métricas de Uso:

- Análisis totales/mes
- Roasts totales/mes
- Shield activado (moderado/crítico)
- Media por usuario y plan
- Uso por plan (Starter/Pro/Plus)
- % usuarios con: Persona, Sponsors, Auto-approve
- % cuentas pausadas

### Métricas de Negocio:

- Usuarios activos por plan
- Nuevos usuarios/día
- Churn (mensual)
- Ingresos proyectados vs reales (Polar)
- ARPU, MRR
- Margen por plan:
  - Análisis usados
  - Roasts usados
  - Tokens IA
  - Coste estimado (SSOT)

### DLQ (Dead Letter Queue):

**Vista**:

- Tabla: job_id, worker, user_id, account_id, reintentos, error, timestamp

**Acciones por job**:

- Ver detalle (payload sin texto sensible)
- Reintentar → reencola + log `dlq_retry_job`
- Descartar → marca descartado + log `dlq_discard_job`

### Cursors de Ingestión:

**Vista**:

- Por cuenta: account_id, plataforma, last_cursor, last_fetch, errores

**Acciones**:

- Reset parcial a punto seguro
- Marcar inactive si errores persistentes
- Log: `cursor_reset`

### Logs Administrativos:

**Qué se loggea**:

- Cambios límites plan
- Cambios tonos
- Feature flags toggle
- Impersonación
- Estado usuario modificado
- Acciones DLQ/cursors

**Estructura**:

```typescript
{
  (id,
    admin_id,
    action_type, // "plan_limits_update", "feature_flag_toggle", etc.
    payload, // before/after, ids afectados
    created_at);
}
```

**UI**:

- Listado ordenado desc
- Filtros: admin_id, tipo acción, fechas

---

## 6. Dependencies

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
