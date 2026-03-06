# 11. Feature Flags (v3)

*(Versión actualizada para Shield-first, NestJS, SSOT via admin_settings)*

El sistema de Feature Flags controla qué funcionalidades están activas, para quién, y en qué momento. Permite despliegues seguros y cambios de comportamiento sin nuevos deploys.

---

## 11.1 Arquitectura

Todos los flags se almacenan en SSOT (`admin_settings` table en Supabase):

```
Admin Panel (Phase 2)  →  admin_settings  →  Backend (NestJS)  →  Frontend (React Query)
      o Supabase Dashboard (MVP)
```

### Tipos de flags

- **Runtime flags (SSOT)** — Guardados en DB, editables sin deploy. Usados para producto y UX.
- **Build-time flags (env vars)** — Solo para infra y seguridad crítica. No visibles al usuario.

### Implementación

```typescript
// Backend: NestJS service
@Injectable()
export class FeatureFlagService {
  private cache: Map<string, any> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 min cache

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.getFlag(key);
    return flag?.value === true;
  }

  async getFlag(key: string): Promise<FeatureFlag | null> {
    // Check cache → if miss, read from admin_settings → cache
  }
}

// Frontend: React hook
function useFeatureFlag(key: string): boolean {
  const { data } = useQuery({
    queryKey: ['feature-flags', key],
    queryFn: () => api.get(`/flags/${key}`),
    staleTime: 30_000, // 30s cache
  });
  return data?.enabled ?? false;
}
```

---

## 11.2 Reglas globales

1. **SSOT obligatorio** — Ningún flag hardcoded en código.
2. **Efecto inmediato** — Cambios aplican en < 5 min (cache TTL).
3. **Fallback seguro** — Si un flag falla o no se puede leer → valor por defecto.
4. **Logs obligatorios** — Toda modificación genera registro en `admin_logs`.
5. **Seguridad inviolable** — Ningún flag puede:
   - Desactivar Shield Crítico
   - Desactivar Style Validator interno
   - Desactivar disclaimers obligatorios (DSA/AI Act)
   - Alterar restricciones legales de plataformas

---

## 11.3 Flags oficiales

### A) Core del producto

| Key | Tipo | Actor | Descripción | Default |
|---|---|---|---|---|
| `roasting_enabled` | boolean | admin | Activa/desactiva módulo de Roasting globalmente | `true` |
| `autopost_enabled` | boolean | usuario (per account) | Auto-publish roasts sin revisión manual | `false` |
| `personal_tone_enabled` | boolean | admin | Habilita Tono Personal (Pro/Plus) | `false` |
| `multi_version_enabled` | boolean | admin | Genera 2 variantes de roast en vez de 1 | `false` |
| `sponsor_feature_enabled` | boolean | admin | Activa módulo Sponsors (Plus, Phase 2) | `false` |

### B) Shield / Seguridad

| Key | Tipo | Actor | Descripción | Default |
|---|---|---|---|---|
| `enable_shield` | boolean | usuario (per account) | Activar/desactivar Shield para la cuenta | `true` |
| `kill_switch_autopost` | boolean | admin | Desactiva TODOS los autoposts del sistema | `false` |
| `enable_perspective_fallback` | boolean | admin | Activa LLM fallback cuando Perspective falla | `true` |
| `manual_review_enabled` | boolean | admin | Habilita cola de revisión manual para casos ambiguos | `false` |

> **Regla:** Shield Crítico no puede desactivarse via `enable_shield`. Amenazas e identity attacks siempre se procesan.

### C) UX / UI

| Key | Tipo | Actor | Descripción | Default |
|---|---|---|---|---|
| `show_transparency_disclaimer` | boolean | admin | Muestra texto educativo sobre IA en UI | `true` |
| `enable_magic_links_user` | boolean | admin | Permite login via magic link para users | `false` |
| `onboarding_skip_allowed` | boolean | admin | Permite saltar pasos del onboarding | `false` |

### D) Experimentales (ocultos, no visibles en UI)

| Key | Tipo | Descripción | Default |
|---|---|---|---|
| `enable_nsfw_tone` | boolean | Tono NSFW (requiere modelo dedicado) | `false` |
| `enable_advanced_tones` | boolean | UI para tonos adicionales | `false` |
| `enable_hall_of_fame` | boolean | UI de roasts destacados | `false` |
| `enable_brigading_detection` | boolean | Detección de ataques coordinados | `false` |

---

## 11.4 Schema

```sql
-- Feature flags live inside admin_settings as JSONB
-- Key format: 'flag:{flag_key}'

-- Example entries:
INSERT INTO admin_settings (key, value) VALUES
  ('flag:roasting_enabled', '{"enabled": true, "description": "Global roasting module", "category": "core"}'),
  ('flag:enable_shield', '{"enabled": true, "description": "Shield per-account toggle", "category": "shield"}'),
  ('flag:kill_switch_autopost', '{"enabled": false, "description": "Emergency autopost kill switch", "category": "shield"}');

-- Admin logs for flag changes
CREATE TABLE admin_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,      -- 'flag_updated', 'setting_changed', etc.
  key         TEXT NOT NULL,
  old_value   JSONB,
  new_value   JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY logs_admin_only ON admin_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );
```

---

## 11.5 Flags legacy

Los siguientes flags de v1/v2 **no existen en v3**:

- `ENABLE_REAL_X`, `ENABLE_REAL_YOUTUBE` → plataformas siempre reales
- `ENABLE_INSTAGRAM_UI`, `ENABLE_FACEBOOK_UI` → Phase 3
- Flags de créditos antiguos → billing reducer
- Flags del antiguo Shield UI → Shield siempre activo
- Flags de debug → env vars de desarrollo, no SSOT

---

## 11.6 Dependencias

- **SSOT (`admin_settings`):** Storage de todos los runtime flags.
- **Admin Panel (Phase 2):** UI para editar flags. Hasta entonces: Supabase Dashboard.
- **Backend (NestJS):** `FeatureFlagService` con cache TTL 5 min.
- **Frontend (React):** `useFeatureFlag()` hook con React Query (staleTime 30s).
