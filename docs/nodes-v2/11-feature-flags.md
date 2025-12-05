# GDD Node — Feature Flags v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Sistema de feature flags que controla funcionalidades activas, para quién y cuándo. Permite deploys seguros, pruebas progresivas y cambios de comportamiento sin nuevos deploys. Usa flags dinámicos (runtime) en SSOT y flags estáticos (build-time) solo para infraestructura crítica.

---

## 2. Responsibilities

### Funcionales:

- Gestionar 15 flags oficiales v2
- Flags dinámicos en `admin_settings.feature_flags` (SSOT)
- Edición desde Admin Panel con efecto inmediato
- Flags estáticos (env vars) solo para infra crítica
- Logs automáticos de cambios
- Fallback seguro si flag falla

### No Funcionales:

- Consistencia: valores desde SSOT, nunca hardcoded
- Seguridad: flags no pueden desactivar protecciones legales
- Auditoría: todos los cambios loggeados
- Performance: cache 5-30s

---

## 3. Inputs

- Feature flag key
- Nuevo valor (boolean | percent | enum)
- Admin ID (para logs)
- Scope: global / por cuenta / por usuario / admin

---

## 4. Outputs

- Flag actualizado en SSOT
- Cambio aplicado en tiempo real (backend + frontend)
- Log en `admin_logs`
- Cache invalidado

---

## 5. Rules

### Flags Oficiales v2 (15 ÚNICOS):

**Core Producto (6)**:

1. `autopost_enabled` (user/account) - Auto-approve de roasts
2. `manual_approval_enabled` (user/account) - Requiere aprobación manual
3. `custom_prompt_enabled` (admin, Plus) - UI prompt personalizado (post-MVP)
4. `sponsor_feature_enabled` (admin) - Módulo sponsors (Plus only)
5. `personal_tone_enabled` (admin) - Tono personal (Pro/Plus)
6. `nsfw_tone_enabled` (admin) - Tono NSFW (futuro, bloqueado)

**Shield / Seguridad (4)**:

7. `kill_switch_autopost` (admin) - Apaga todos los autopost globalmente
8. `enable_shield` (user/account) - Activa/desactiva Shield
9. `enable_roast` (user/account) - Permite desactivar Roasts (solo Shield)
10. `enable_perspective_fallback_classifier` (admin) - Clasificador backup GPT-4o-mini

**UX / UI (2)**:

11. `show_two_roast_variants` (admin) - 2 variantes vs 1
12. `show_transparency_disclaimer` (admin) - Texto educativo IA (no afecta disclaimer legal)

**Despliegue / Experimentales (3)**:

13. `enable_style_validator` (admin) - UI del Style Validator
14. `enable_advanced_tones` (admin) - Extensiones futuras tonos
15. `enable_beta_sponsor_ui` (admin) - UI beta sponsors

**Categoría: Experimental (deshabilitada en v2)**:

Estos flags existen únicamente para compatibilidad futura, pero **NO pueden activarse**, NI utilizarse para experimentos A/B de momento.

```json
["enable_style_validator", "enable_advanced_tones", "enable_beta_sponsor_ui"]
```

**Reglas estrictas**:

- No se pueden activar en producción ni staging.
- No se pueden usar para experimentos A/B.
- Requieren doble confirmación incluso para visualización.
- Permanecen en SSOT solo para evitar invención de flags nuevos.

❌ **Cualquier flag fuera de esta lista** = no autorizado → bug o actualización SSOT requerida

### Reglas de Seguridad:

**Autoridad del Superadmin**:

- El superadmin puede modificar absolutamente cualquier feature flag del sistema, sin excepciones.
- Los flags críticos requieren un paso adicional de doble confirmación para evitar activaciones accidentales.
- Modificar un flag nunca debe romper protecciones legales obligatorias (disclaimers, Style Validator, Shield Crítico).

**Flags críticos (doble confirmación obligatoria)**:

- `kill_switch_autopost`
- `enable_shield`
- `enable_roast`
- `enable_perspective_fallback_classifier`
- `enable_style_validator`
- Cualquier flag que afecte directamente a cumplimiento legal (disclaimers IA)

**Salvaguardas del Sistema**:

Los flags pueden modificar comportamientos del sistema, pero:

- ❌ NO pueden desactivar Style Validator interno.
- ❌ NO pueden desactivar Shield Crítico.
- ❌ NO pueden permitir publicación de contenido ilegal.
- ❌ NO pueden eliminar disclaimers IA obligatorios en regiones reguladas.

Incluso si el superadmin activa un flag peligroso, el sistema mantiene salvaguardas de seguridad/legalidad.

### Fallback Seguro:

Si un flag:

- no existe en SSOT,
- tiene formato incorrecto,
- falla al cargar desde cache,

→ El sistema usa siempre el valor por defecto del SSOT  
→ Se genera log de advertencia  
→ El servicio sigue funcionando con seguridad intacta

### Estructura Flag:

Cada flag incluye:

```typescript
{
  key: string;
  description: string;
  category: string;
  actors: "admin" | "user" | "account" | "global";
  type: "boolean" | "percent" | "enum";
  defaultValue: any;
  dependencies?: string[];
}
```

### Scope Multinivel:

Cada flag puede tener scope:

- **global** - Afecta a todo el sistema
- **por usuario** - Configuración individual del usuario
- **por cuenta** - Configuración por cuenta social conectada
- **por admin** - Solo visible/editable en panel admin

**Prioridad de resolución**: `user > account > admin > global`

**Restricciones**:

- Los usuarios NO pueden modificar flags globales.
- Solo flags con scope `user`/`account` pueden ser ajustados por usuarios.
- Todos los cambios globales solo pueden ser realizados por superadmin.

### Efecto Inmediato:

**Cache de flags**:

- Duración entre 5 y 30 segundos (configurable por SSOT)
- Invalida automáticamente tras cambios
- Workers leen flags en cada job (no requieren restart)

**Propagación de cambios**:

- Admin Panel actualiza flag
- Backend cache invalidado inmediatamente
- Frontend recarga flags (siguiente query)
- Workers respetan flag en siguiente ejecución

### Logs Automáticos:

Todo cambio genera:

```typescript
{
  (admin_id, flag_key, old_value, new_value, timestamp);
}
```

---

## 6. Dependencies

### Servicios:

- **Supabase**: Tabla `admin_settings.feature_flags`
- **Backend**: `featureFlagService.ts`
- **Frontend**: Hook `useFeatureFlags()`

### SSOT:

- Tabla `admin_settings.feature_flags`
- Valores por defecto

**Integración con SSOT**:

- El SSOT es la única fuente válida de truth para flags.
- Si existe discrepancia entre código y SSOT → el worker o servicio debe detenerse y loggear error.
- Todos los flags deben estar definidos en SSOT antes de ser usados en código.

### Nodos Relacionados:

- `10-panel-administracion.md` (UI de flags)
- `15-ssot-integration.md` (SSOT como fuente)

---

## 7. Edge Cases

1. **Flag no existe en SSOT**:
   - Usa valor por defecto
   - Log warning

2. **Flag corrupto (formato)**:
   - Usa valor por defecto
   - Alerta admin

3. **Flag crítico toggleado accidentalmente**:
   - Doble confirmación previene
   - Si confirmado → log + aplicar

4. **Cache desincronizado**:
   - TTL máx 30s
   - Revalida automáticamente

5. **Flag desactivado con feature en uso**:
   - UI oculta feature
   - Backend rechaza requests
   - Logs de intento

6. **Flag experimental activado en prod**:
   - Bloqueado (no-op)
   - Log de intento + alerta
   - Visible en métricas de seguridad

7. **Admin sin permisos intenta editar**:
   - Rechazado (solo superadmin)

8. **Frontend lee flag antes de carga**:
   - Usa valor por defecto
   - Revalida después

---

## 8. Acceptance Criteria

### Sistema:

- [ ] 15 flags oficiales implementados
- [ ] Flags en `admin_settings.feature_flags` (SSOT)
- [ ] ❌ NO flags hardcoded en código
- [ ] Documentados en `docs/architecture/sources-of-truth.md`

### Admin Panel:

- [ ] Tabla flags con ON/OFF
- [ ] Descripción y categoría visibles
- [ ] Cambios aplican en caliente
- [ ] Doble confirmación en críticos
- [ ] Logs automáticos

### Backend:

- [ ] `featureFlagService.ts` carga desde SSOT
- [ ] Cache 5-30s
- [ ] Fallback a valor por defecto si falla
- [ ] Workers respetan flags

### Frontend:

- [ ] `useFeatureFlags()` hook funcional
- [ ] UI responde a flags
- [ ] Cache sincronizado

### Seguridad:

- [ ] Flags NO pueden desactivar Shield Crítico
- [ ] Flags NO pueden desactivar Style Validator interno
- [ ] Flags NO pueden alterar disclaimers obligatorios
- [ ] Solo superadmin puede editar

### Logs:

- [ ] Todos los cambios en `admin_logs`
- [ ] before/after values
- [ ] admin_id registrado

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Flag loading desde SSOT
- ✅ Fallback a valor por defecto
- ✅ Validación de flag structure
- ❌ NO testear: SSOT directamente

### Integration Tests (Supabase Test):

- ✅ Cambio flag → guardado en SSOT
- ✅ Cambio flag → log creado
- ✅ Flag desactivado → feature oculta
- ✅ Flag corrupto → usa default
- ✅ Cache invalidado tras cambio

### E2E Tests (Playwright):

- ✅ Admin toggle flag → cambio aplicado
- ✅ Doble confirmación flag crítico
- ✅ Flag OFF → UI feature oculta
- ✅ Flag ON → UI feature visible
- ✅ Logs de cambios visibles

---

## 10. Implementation Notes

### Feature Flag Service:

```typescript
// apps/backend-v2/src/services/featureFlagService.ts

const flagCache = new Map<string, any>();
const CACHE_TTL = 30_000; // 30s

export async function getFlag(key: FeatureFlagKey): Promise<boolean | number | string> {
  // 1. Check cache
  if (flagCache.has(key)) {
    const cached = flagCache.get(key);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }
  }

  try {
    // 2. Load from SSOT
    const { data } = await supabase.from('admin_settings').select('feature_flags').single();

    const flag = data.feature_flags.find((f) => f.key === key);

    if (!flag) {
      return getDefaultValue(key);
    }

    // 3. Cache
    flagCache.set(key, { value: flag.value, timestamp: Date.now() });

    return flag.value;
  } catch (error) {
    // 4. Fallback
    logger.warn('flag_load_failed', { key, error });
    return getDefaultValue(key);
  }
}

export async function updateFlag(key: FeatureFlagKey, value: any, adminId: string): Promise<void> {
  const oldValue = await getFlag(key);

  // Update SSOT
  await supabase.from('admin_settings').update({
    feature_flags: updateFlagInArray(key, value)
  });

  // Invalidate cache
  flagCache.delete(key);

  // Log
  await logAdminAction({
    admin_id: adminId,
    action_type: 'feature_flag_toggle',
    payload: { key, old_value: oldValue, new_value: value }
  });
}
```

### Frontend Hook:

```typescript
// apps/frontend-v2/hooks/useFeatureFlags.ts
import { useQuery } from '@tanstack/react-query';

export function useFeatureFlag(key: FeatureFlagKey) {
  return useQuery({
    queryKey: ['feature-flag', key],
    queryFn: () => fetchFlag(key),
    staleTime: 30_000, // 30s
    refetchInterval: 30_000
  });
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 11)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 3)
