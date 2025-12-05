# GDD Node — SSOT Integration v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Sistema de Single Source of Truth (SSOT) que centraliza TODOS los valores configurables de Roastr v2 en `admin_settings`, eliminando valores hardcoded. Incluye planes, límites, thresholds, weights, tonos, prompts, feature flags, disclaimers, cadencias y reglas de comportamiento. Es la autoridad máxima del sistema.

---

## 2. Responsibilities

### Funcionales:

- Centralizar configuración en `admin_settings` (Supabase)
- Cargar valores en runtime (backend + frontend)
- Edición desde Admin Panel con efecto inmediato
- Versionado y rollback de configuraciones
- Validación de consistencia SSOT
- Fallback a valores por defecto si carga falla
- Logs de todos los cambios
- Enforcement de reglas SSOT (Cursor rule)

### No Funcionales:

- Consistencia: única fuente de verdad
- Seguridad: solo superadmin edita
- Performance: cache 5-30s
- Auditoría: todos los cambios loggeados

---

## 3. Inputs

- Valores de configuración desde Admin Panel
- Valores por defecto (fallback)
- Requests de backend/frontend pidiendo configuración

---

## 4. Outputs

- Configuración cargada en runtime
- Cache actualizado
- Logs de cambios
- Valores aplicados en sistema
- Bloqueos cuando hay discrepancias con código

---

## 5. Rules

### Regla de Oro:

> **Si el SSOT y el código/GDD discrepan, el SSOT gana.**
>
> **Si se detecta discrepancia → DETENER y comunicar inmediatamente.**

### Alcance del SSOT:

**Define**:

- Identificadores oficiales (plan IDs, feature flags, tipos, estados)
- Reglas de comportamiento (no se pueden inventar ni alterar sin actualizar SSOT)
- Límites funcionales (Starter: 1 cuenta/red, etc.)

**NO contiene**:

- Prompts completos de IA (solo estructura)
- Copys de marketing
- Textos legales extensos
- Códigos de error exhaustivos

### Valores SSOT v2:

**1. Planes y Límites**:

```typescript
type PlanId = 'starter' | 'pro' | 'plus';
// ❌ PROHIBIDO: "free", "basic", "creator_plus" (legacy v1)
```

**2. Feature Flags** (15 oficiales):

- Core (6): autopost_enabled, manual_approval_enabled, custom_prompt_enabled, sponsor_feature_enabled, personal_tone_enabled, nsfw_tone_enabled
- Shield (4): kill_switch_autopost, enable_shield, enable_roast, enable_perspective_fallback_classifier
- UX (2): show_two_roast_variants, show_transparency_disclaimer
- Experimental (3): enable_style_validator, enable_advanced_tones, enable_beta_sponsor_ui

**3. Thresholds Shield**:

```typescript
{
  (roastLower, shield, critical);
}
```

**4. Weights**:

```typescript
{
  lineaRoja: 1.15,
  identidad: 1.10,
  tolerancia: 0.95,
  strike1: 1.10,
  strike2: 1.25,
  critical: 1.50
}
```

**5. Tonos**:

```typescript
['flanders', 'balanceado', 'canalla', 'personal'];
// ❌ nsfw bloqueado
```

**6. Plataformas**:

```typescript
['x', 'youtube'];
// Futuras (NO legacy): Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky
```

**7. Workers** (9 oficiales):

```typescript
[
  'FetchComments',
  'AnalyzeToxicity',
  'GenerateRoast',
  'GenerateCorrectiveReply',
  'ShieldAction',
  'SocialPosting',
  'BillingUpdate',
  'CursorReconciliation',
  'StrikeCleanup'
];
```

**8. Estados Billing**:

```typescript
[
  'trialing',
  'expired_trial_pending_payment',
  'payment_retry',
  'active',
  'canceled_pending',
  'paused'
];
```

### Validación Pre-Implementación:

**ANTES de implementar cualquier feature v2**:

1. ✅ Cargar `docs/SSOT/roastr-ssot-v2.md`
2. ✅ Identificar secciones relevantes
3. ✅ Validar que cambio está alineado con SSOT
4. ✅ Si discrepancia → **STOP + comunicar**

**PROHIBIDO**:

- ❌ Inventar planes, límites, feature flags
- ❌ Inventar tonos, plataformas, webhooks, workers
- ❌ Usar elementos legacy v1 (`free`, `basic`, Stripe, SendGrid)
- ❌ Modificar comportamiento sin actualizar SSOT primero

**Si violación detectada**:

```
🚨 DETENCIÓN INMEDIATA
Esto requiere actualización del SSOT primero.

Discrepancia detectada:
- SSOT define: [valor del SSOT]
- Código/tarea propone: [valor propuesto]

¿Qué hacemos?
1. Actualizar SSOT (si la propuesta es correcta)
2. Corregir código/tarea (si el SSOT es correcto)
```

---

## 6. Dependencies

### Servicios:

- **Supabase**: Tabla `admin_settings`
- **Backend**: `settingsLoader.ts`

### Tablas:

- `admin_settings.feature_flags`
- `admin_settings.plan_limits`
- `admin_settings.shield_thresholds`
- `admin_settings.roast_tones`
- `admin_settings.disclaimer_pool`
- `admin_settings.platform_config`

### Cursor Rule:

- `.cursor/rules/ssot-enforcement.mdc`

### Documentos:

- `docs/SSOT/roastr-ssot-v2.md` (documento maestro)
- `docs/SSOT/README.md` (guía rápida)
- `CLAUDE.md` (sección "SSOT — MÁXIMA PRIORIDAD")

### Nodos Relacionados:

- TODOS los nodos (todos consumen SSOT)
- `10-panel-administracion.md` (UI para editar SSOT)
- `11-feature-flags.md` (Flags en SSOT)

---

## 7. Edge Cases

1. **SSOT y código discrepan**:
   - SSOT gana
   - Código debe actualizarse

2. **SSOT falta valor**:
   - No se inventa
   - Se marca como TBD
   - Se abre tarea

3. **Admin edita SSOT durante ejecución**:
   - Workers respetan cambio en siguiente ejecución
   - Cache invalida (5-30s)

4. **SSOT corrupto**:
   - Fallback a valores por defecto
   - Alerta crítica
   - Rollback a versión anterior

5. **Valor SSOT fuera de rango**:
   - Validación rechaza
   - Error claro en Admin Panel

6. **Legacy v1 referenciado en código v2**:
   - CI detecta + rechaza
   - Cursor rule bloquea

7. **Feature nueva sin SSOT**:
   - CI bloquea
   - Requiere actualización SSOT primero

8. **Agent intenta inventar valores SSOT**:
   - Cursor rule bloquea
   - Output: "This requires SSOT update first"

---

## 8. Acceptance Criteria

### Documento SSOT:

- [ ] `docs/SSOT/roastr-ssot-v2.md` creado
- [ ] Cursor rule `.cursor/rules/ssot-enforcement.mdc` activa
- [ ] CLAUDE.md referencia SSOT
- [ ] Regla de oro implementada

### Valores Centralizados:

- [ ] Planes: starter, pro, plus (NO free, basic)
- [ ] Límites por plan en SSOT
- [ ] Feature flags (15) en SSOT
- [ ] Thresholds Shield en SSOT
- [ ] Weights Persona en SSOT
- [ ] Tonos en SSOT
- [ ] Disclaimers en SSOT
- [ ] Cadencias en SSOT

### Backend:

- [ ] `settingsLoader.ts` carga desde SSOT
- [ ] ❌ NO valores hardcoded
- [ ] Cache 5-30s
- [ ] Fallback a defaults

### CI:

- [ ] Validación SSOT pre-merge
- [ ] Bloquea valores hardcoded
- [ ] Bloquea legacy v1 en v2
- [ ] Bloquea features sin SSOT

### Admin Panel:

- [ ] UI para editar SSOT
- [ ] Validación de valores
- [ ] Logs de cambios
- [ ] Rollback disponible

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Settings loader
- ✅ SSOT validator
- ✅ Fallback defaults
- ✅ Cache management
- ❌ NO testear: SSOT directamente

### Integration Tests (Supabase Test):

- ✅ Cargar SSOT completo
- ✅ Editar valor → guardado
- ✅ Valor inválido → rechazado
- ✅ Cache invalidado tras cambio
- ✅ SSOT corrupto → fallback defaults
- ✅ Rollback SSOT → versión anterior

### E2E Tests (Playwright):

- ✅ Admin edita plan limit → worker usa nuevo
- ✅ Admin edita threshold → motor aplica nuevo
- ✅ Admin toggle flag → sistema responde
- ✅ Validación rechaza threshold inválido
- ✅ Logs cambios visibles

---

## 10. Implementation Notes

### Settings Loader:

```typescript
// apps/backend-v2/src/services/settingsLoader.ts

interface SSOTConfig {
  plans: PlanConfig[];
  thresholds: Thresholds;
  weights: Weights;
  tones: ToneConfig[];
  featureFlags: FeatureFlag[];
  disclaimers: DisclaimerPool[];
  cadences: CadenceConfig;
  platforms: PlatformConfig[];
}

const configCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL = 30_000; // 30s

export async function loadSSOT(): Promise<SSOTConfig> {
  if (configCache.has('ssot')) {
    const cached = configCache.get('ssot')!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }
  }

  try {
    const { data, error } = await supabase.from('admin_settings').select('*').single();

    if (error) throw error;

    const config = parseSSOT(data);
    validateSSOT(config);

    configCache.set('ssot', {
      value: config,
      timestamp: Date.now()
    });

    return config;
  } catch (error) {
    logger.error('ssot_load_failed', { error });
    return getDefaultSSOT();
  }
}
```

### Validación SSOT:

```typescript
// apps/backend-v2/src/services/ssotValidator.ts

export function validateSSOT(config: SSOTConfig): void {
  // Planes
  const validPlans = ['starter', 'pro', 'plus'];
  for (const plan of config.plans) {
    if (!validPlans.includes(plan.id)) {
      throw new Error(`Invalid plan: ${plan.id}`);
    }
  }

  // Feature Flags (15 oficiales)
  const validFlags = [
    'autopost_enabled',
    'manual_approval_enabled',
    'custom_prompt_enabled',
    'sponsor_feature_enabled',
    'personal_tone_enabled',
    'nsfw_tone_enabled',
    'kill_switch_autopost',
    'enable_shield',
    'enable_roast',
    'enable_perspective_fallback_classifier',
    'show_two_roast_variants',
    'show_transparency_disclaimer',
    'enable_style_validator',
    'enable_advanced_tones',
    'enable_beta_sponsor_ui'
  ];

  for (const flag of config.featureFlags) {
    if (!validFlags.includes(flag.key)) {
      throw new Error(`Unauthorized flag: ${flag.key}`);
    }
  }

  // Thresholds
  if (config.thresholds.roastLower >= config.thresholds.shield) {
    throw new Error('Invalid thresholds: roastLower must be < shield');
  }
  if (config.thresholds.shield >= config.thresholds.critical) {
    throw new Error('Invalid thresholds: shield must be < critical');
  }
}
```

### Referencias:

- SSOT: `docs/SSOT/roastr-ssot-v2.md`
- Spec v2: `docs/spec/roastr-spec-v2.md`
- Cursor Rule: `.cursor/rules/ssot-enforcement.mdc`
- Integration Summary: `docs/SSOT-INTEGRATION-SUMMARY.md`
- CLAUDE.md: Sección "SSOT — MÁXIMA PRIORIDAD"
