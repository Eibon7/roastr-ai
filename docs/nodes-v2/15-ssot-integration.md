# GDD Node — SSOT Integration v2

---
version: "2.0"
node_id: ssot-integration
status: production
priority: critical
owner: Product Owner
last_updated: 2025-12-05
coverage: 100
coverage_source: auto
required_by:
  - roasting-engine
  - analysis-engine
  - shield-engine
  - integraciones-redes-sociales
  - billing-integration
  - frontend-user-app
  - frontend-admin
  - settings-loader-and-feature-flags
ssot_references:
  - plans_and_limits
  - billing-integration_polar
  - feature_flags
  - shield_thresholds
  - shield_weights
  - tones_roasting
  - integrations
  - workers
  - gdpr_retention
  - testing
  - plan_limits
  - roast_tones
subnodes:
  - settings-loader
  - feature-flags
  - plans-and-limits
  - shield-thresholds
  - shield-weights
  - tones-roasting
  - billing-integration-polar
  - workers-config
  - integrations-config
  - gdpr-retention
  - ssot-validator
  - cache-management
---


**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

Este nodo depende de los siguientes nodos:

- Ninguna dependencia directa

---

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

### Agentes Relevantes:

- Guardian
- TestEngineer

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

## 8. SSOT References

Este nodo ES el integrador del SSOT, por lo tanto referencia TODAS las secciones principales:

- `plans_and_limits` - Planes y límites de v2
- `billing_polar` - Configuración de Polar
- `feature_flags` - Feature flags globales
- `shield_thresholds` - Umbrales de Shield
- `shield_weights` - Pesos de Shield
- `tones_roasting` - Tonos de roasting
- `integrations` - Configuración de integraciones
- `workers` - Configuración de workers
- `gdpr_retention` - Reglas GDPR
- `testing` - Configuración de testing

---

## 9. Acceptance Criteria

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

## 11. Related Nodes

- analysis-engine (required_by)
- billing-integration (required_by)
- workers (required_by)
- frontend-admin (required_by)
- settings-loader-and-feature-flags (required_by)
- roasting-engine (required_by)
- shield-engine (required_by)
- integraciones-redes-sociales (required_by)
- frontend-user-app (required_by)
