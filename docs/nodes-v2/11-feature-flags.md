# GDD Node — Feature Flags v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`ssot-integration`](./15-ssot-integration.md)



- [`ssot-integration`](./15-ssot-integration.md)



Este nodo depende de los siguientes nodos:

- [`ssot-integration`](./15-ssot-integration.md)

---

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

## 11. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `feature_flags` - Definición de todos los feature flags del sistema

---

## 12. Related Nodes

Este nodo está relacionado con los siguientes nodos:

- Ningún nodo relacionado

---

