# 10. Panel de Administración (v3) — Phase 2

*(Documentado para referencia. No se implementa en MVP.)*

> **MVP:** Gestión via Supabase Dashboard + queries directas. Este documento define la spec completa para cuando se construya el Admin Panel.

El Panel de Administración es accesible únicamente para usuarios con rol `superadmin` (y `admin` cuando se implemente).

---

## 10.1 Gestión de usuarios

### Vista principal

Tabla con:

| Columna | Contenido |
|---|---|
| Email | email del usuario |
| user_id | UUID |
| Plan | Starter / Pro / Plus |
| Estado | active / paused / canceled |
| Fecha de alta | created_at |

Búsqueda por email o user_id.

### Acciones

- **Crear usuario** manualmente (alta directa sin checkout)
- **Editar:** plan, estado, flags internos (solo los de SSOT)
- **Pausar cuenta** (soporte o fraude)
- **Eliminar cuenta:** soft-delete con retención 90 días → purga definitiva (§12)

### Restricciones de seguridad

- **Roastr Persona** de cada usuario: no visible ni editable
- **Sponsors:** solo estadísticas agregadas, no detalle
- Cada cambio genera entrada en `admin_logs`

---

## 10.2 Impersonación segura

Permite al superadmin entrar en el Panel de Usuario como si fuera el propio usuario.

### Alcance

**Puede:**

- Ver la UI exactamente como el usuario (dashboard, accounts, settings)
- Ejecutar las mismas acciones: conectar/desconectar cuentas, cambiar Shield settings, cambiar tono, toggle auto-approve, pausar cuentas, gestionar billing via Polar portal

**No puede:**

- Ver Roastr Persona en texto claro
- Ver tokens OAuth en claro
- Ver datos de tarjeta

### Implementación

```typescript
interface ImpersonationToken {
  adminId: string;
  userId: string;
  expiresAt: string;    // máx 5 minutos
  scope: 'user_panel';  // limitado a rutas de usuario
}
```

Todas las acciones en impersonación se etiquetan en logs:

```sql
CREATE TABLE admin_impersonation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  route       TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 10.3 Métricas globales

### A) Métricas de uso (producto)

- Análisis totales / mes
- Shield activaciones (moderado / crítico)
- Roasts totales / mes (si módulo activo)
- Media por usuario y por plan
- Distribución Starter / Pro / Plus
- % usuarios con: Persona configurado, auto-approve ON, cuentas pausadas

### B) Métricas de negocio

- Usuarios activos por plan
- Nuevos usuarios / día
- Churn mensual
- MRR y ARPU
- Ingresos proyectados vs. reales (desde Polar)
- Margen por plan (coste IA estimado vs. ingreso)

El backend expone `/admin/costs/summary` que calcula internamente:
- Análisis usados, roasts usados, tokens IA consumidos
- Ingestiones por red, coste IA según precios en SSOT

---

## 10.4 Feature Flags (UI)

Tabla de flags con:

| Columna | Contenido |
|---|---|
| Nombre | flag_key |
| Categoría | core / shield / ux / experimental |
| Estado | ON / OFF toggle |
| Activado desde | Timestamp |
| Descripción | Texto |

### Reglas

- Cambios se aplican en caliente (siguiente carga, cache TTL 5min)
- Se registran en `admin_logs`
- No se pueden borrar flags en producción, solo desactivar
- Flags "peligrosos" requieren doble confirmación: `kill_switch_autopost`, `enable_shield` global, `enable_nsfw_tone`

Ver lista completa de flags en §11.

---

## 10.5 Gestión de tonos

Tabla:

| Columna | Contenido |
|---|---|
| Nombre | "Flanders", "Balanceado", "Canalla" |
| Idioma | Principal |
| Prompt base | Textarea editable |
| Modelo IA | Select (GPT-4o-mini, etc.) |
| Estado | Activo / Inactivo |

### Acciones

- Añadir tono nuevo
- Editar prompt base
- Cambiar modelo IA
- Desactivar tono (usuarios con ese tono → fallback a Balanceado)

### Validación al guardar

- No puede contener insultos directos
- No puede incluir contenido explícito
- No puede anular disclaimers IA
- No puede desactivar reglas de seguridad

Tonos se guardan en SSOT → `admin_settings` con key `roast_tones`.

---

## 10.6 Gestión de límites por plan

Campos editables por plan (Starter / Pro / Plus):

| Campo | Tipo |
|---|---|
| `analysis_per_month` | number |
| `roasts_per_month` | number |
| `max_accounts_per_platform` | number |
| Shield incluido | boolean |
| Roastr Persona incluido | boolean |
| Tono personal incluido | boolean |
| Sponsors incluido | boolean |
| Duración trial (días) | number |
| Precio | readonly (referencia desde Polar) |

Cambios impactan **solo ciclos futuros** (no se recalculan ciclos en curso). Cada cambio genera log con valores antes/después.

---

## 10.7 Uso de recursos / costes

### Vista "Uso de recursos"

- Análisis totales, roasts totales, correctivas
- Tokens IA consumidos (por modelo)
- Ratio de prompt cache hits
- Llamadas a Perspective, Polar, YouTube, X
- Ingestiones por red y por plan

### Vista "Costes estimados" (solo lectura)

- Coste IA estimado (usage × precios SSOT)
- Coste por plan (agregado, nunca por usuario individual)

---

## 10.8 Logs administrativos

Se registra en `admin_logs` cada:

- Cambio de límites de plan
- Cambio de tono
- Toggle de feature flag
- Impersonación
- Cambio de estado de usuario
- Acción manual sobre DLQ/cursores

```sql
CREATE TABLE admin_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Tipos de acción: `plan_limits_update`, `feature_flag_toggle`, `tone_update`, `user_status_change`, `impersonation_start`, `dlq_retry_job`, `dlq_discard_job`, `cursor_reset`, `force_resync_polar`, `force_recount_usage`.

---

## 10.9 Herramientas de mantenimiento

### DLQ (Dead Letter Queue)

Tabla de jobs fallidos:

| Columna | Contenido |
|---|---|
| job_id | ID del job |
| worker | Nombre del worker |
| user_id / account_id | Tenant |
| Reintentos | Nº |
| Error | Código final |
| Timestamp | Último intento |

Acciones:
- **Reintentar** → reencola en cola original + log `dlq_retry_job`
- **Descartar** → marca como descartado + log `dlq_discard_job`

### Cursores de ingestión

Por cuenta + plataforma: cursor actual, último fetch exitoso, errores recientes.

Acciones:
- **Reset parcial** del cursor (últimas 24h) + log `cursor_reset`
- **Marcar inactive** si errores persistentes

### Sincronización Polar / usage

- `force_resync_polar(user_id)` → reconsulta estado de suscripción
- `force_recount_usage(user_id)` → recalcula usage desde eventos

Ambas requieren doble confirmación + se loggean.

---

## 10.10 Seguridad

1. Solo `superadmin` accede a `/admin/*`
2. Cada petición pasa por: auth middleware → role check → RLS
3. El Admin Panel **nunca** puede ver: Persona en claro, tokens OAuth, datos de tarjeta, sponsors detallados
4. Impersonación: todas las acciones etiquetadas en logs
5. Acciones de alto impacto: doble confirmación + log obligatorio
6. No existe endpoint para actuar directamente en redes sociales desde Admin — todo pasa por los workers normales

---

## 10.11 Dependencias

- **Auth (§2):** Roles `admin` / `superadmin` en profiles.
- **SSOT (`admin_settings`):** Todas las configuraciones editables.
- **Billing (§3):** Métricas de negocio, force_resync_polar.
- **Workers (§8):** DLQ inspection, cursor management.
- **Feature Flags (§11):** UI de toggles.
