# GDD Node — Motor de Análisis v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`infraestructura`](./14-infraestructura.md)

- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`infraestructura`](./14-infraestructura.md)

Este nodo depende de los siguientes nodos:

- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)
- [`infraestructura`](./14-infraestructura.md)

---

Este nodo depende de los siguientes nodos:

- [`billing`](./billing.md) - Límites de análisis y créditos
- [`observabilidad`](./observabilidad.md) - Logging estructurado
- [`ssot-integration`](./15-ssot-integration.md) - Thresholds, weights, algoritmos
- [`infraestructura`](./14-infraestructura.md) - Colas y base de datos

### Servicios Externos:

### Servicios Externos:

- **Google Perspective API**: Análisis de toxicidad principal
- **OpenAI (GPT-4o-mini)**: Fallback clasificador barato
- **Supabase**: Tablas `offenders`, `profiles` (Roastr Persona cifrado)

### SSOT:

- Thresholds: `τ_roast_lower`, `τ_shield`, `τ_critical`
- Weights: `lineaRoja`, `identidad`, `tolerancia`, strikes
- N_DENSIDAD (default: 3)
- Flag: `enable_perspective_fallback_classifier`

### Workers:

- `AnalyzeToxicity`: Ejecuta este motor
- `GenerateCorrectiveReply`: Si decisión = "correctiva"
- `GenerateRoast`: Si decisión = "roast"
- `ShieldAction`: Si decisión = "shield_moderado" o "shield_critico"

### Nodos Relacionados:

- `03-billing-polar.md` (Créditos de análisis)
- `06-motor-roasting.md` (Generación de roasts)
- `07-shield.md` (Acciones de Shield)
- `08-workers.md` (Worker AnalyzeToxicity)

---

## 7. Edge Cases

1. **Perspective API falla**:
   - Retry según política
   - Si persiste → fallback GPT-4o-mini
   - Si ambos fallan → `score_base` = τ_shield

2. **Sarcasmo que toca línea roja**:
   - Shield Moderado por defecto
   - Opcional: manual review (si flag ON)

3. **Idioma no soportado por Perspective**:
   - Fallback GPT-4o-mini
   - Clasificación aproximada

4. **Insult density alta (≥3)**:
   - Fuerza `score_base` = 1.0
   - Shield Crítico garantizado

5. **Tolerancias en caso crítico**:
   - No aplican
   - Shield Crítico no se puede rebajar

6. **Strike 2 + insultos fuertes**:
   - Fuerza Shield Crítico
   - Ignorando score numérico

7. **Brigading (ataque coordinado)**:
   - El Shield eleva temporalmente la aggressiveness a 1.00 como override del análisis.
   - No modifica la configuración permanente del usuario.
   - Registra un evento de alerta.

8. **Análisis agotados (remaining = 0)**:
   - Motor NO ejecuta
   - No hay ingestión
   - Solo UI histórica

9. **Edición de comentario**:
   - No se reevalúa
   - Acción original se mantiene
   - Log adicional si API comunica cambio

---

## 8. Acceptance Criteria

### Pre-condición:

- [ ] Si `analysis_remaining = 0` → motor NO ejecuta
- [ ] UI muestra solo histórico si análisis agotados

### Toxicidad:

- [ ] Perspective API calcula `score_base`
- [ ] Si Perspective falla → fallback GPT-4o-mini
- [ ] Si ambos fallan → `score_base` = τ_shield
- [ ] Insult density ≥ 3 → fuerza Shield Crítico

### Roastr Persona:

- [ ] Líneas rojas incrementan score (×1.15)
- [ ] Identidades incrementan score (×1.10)
- [ ] Tolerancias reducen score (×0.95) solo si < τ_shield
- [ ] Tolerancias NO aplican en Shield Crítico

### Reincidencia:

- [ ] Strike 1 → ×1.10
- [ ] Strike 2 → ×1.25
- [ ] Critical → ×1.50
- [ ] Strikes purgan tras 90 días

### Overrides:

- [ ] Identity attack → Shield Crítico (siempre)
- [ ] Amenaza → Shield Crítico (siempre)
- [ ] Insult density ≥ 3 → Shield Crítico
- [ ] Strike 2 + insultos fuertes → Shield Crítico

### Decisiones:

- [ ] score ≥ τ_critical → "shield_critico"
- [ ] τ_shield ≤ score < τ_critical → "shield_moderado"
- [ ] Insulto leve + argumento → "correctiva"
- [ ] τ_roast_lower ≤ score < τ_shield → "roast"
- [ ] score < τ_roast_lower → "publicar"

### Logs:

- [ ] ❌ NO guardar texto crudo
- [ ] ✅ Guardar: score, decisión, bucket, timestamp, matched_red_line

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Cálculo score_persona (líneas rojas, identidades, tolerancias)
- ✅ Cálculo score_final (reincidencia)
- ✅ Threshold routing (τ_roast_lower, τ_shield, τ_critical)
- ✅ Override identity attack
- ✅ Override amenaza
- ✅ Override insult density
- ✅ Zona correctiva (insulto leve + argumento)
- ✅ Tolerancias NO aplican en crítico
- ✅ Fallback score cuando Perspective falla
- ❌ NO mockear Perspective (integration test)

### Integration Tests (Supabase Test):

- ✅ Comentario ofensivo → Shield Crítico
- ✅ Comentario con línea roja → score aumentado
- ✅ Comentario con tolerancia → score reducido
- ✅ Reincidencia Strike 2 → score aumentado
- ✅ Identity attack → Shield Crítico (override)
- ✅ Amenaza → Shield Crítico (override)
- ✅ Insult density ≥ 3 → Shield Crítico
- ✅ Insulto leve + argumento → Correctiva
- ✅ Score bajo → Publicar
- ✅ Análisis remaining = 0 → motor NO ejecuta

### E2E Tests (Playwright):

- ✅ Flujo completo: comentario ofensivo → análisis → Shield
- ✅ Flujo completo: comentario roasteable → análisis → roast
- ✅ Flujo completo: insulto leve + argumento → correctiva
- ✅ UI muestra decisión correcta
- ✅ Límite análisis agotado → banner en UI

---

## 10. Implementation Notes

### Motor de Análisis (Reducer Puro):

```typescript
// apps/backend-v2/src/services/analysisEngine.ts

export function analysisReducer(input: {
  text: string;
  persona: PersonaProfile | null;
  offender: OffenderProfile | null;
  thresholds: Thresholds;
  weights: Weights;
  remainingAnalysis: number;
  perspectiveScore: number | null;
  insultDensity: number | null;
  hasIdentityAttack: boolean;
  hasThreat: boolean;
}): AnalysisDecision {
  // 0) Precondición
  if (input.remainingAnalysis <= 0) {
    return 'publicar'; // No hay servicio
  }

  // Nota: Dentro del reducer, cuando remainingAnalysis = 0 se devuelve "publicar"
  // porque el motor no debería haberse ejecutado. En la arquitectura real,
  // AnalyzeToxicity nunca se llama si remainingAnalysis = 0, por lo que no hay
  // ingestión ni análisis.

  // 1) Fallback si Perspective falla
  if (input.perspectiveScore === null) {
    if (input.insultDensity === null) return 'publicar';
    if (input.insultDensity > HIGH_DENSITY) return 'shield_critico';
    return 'publicar';
  }

  let adjusted = input.perspectiveScore;

  // 2) Ajuste por Persona
  if (input.persona?.matchesLineaRoja) {
    adjusted *= input.weights.lineaRoja;
  }
  if (input.persona?.matchesIdentidad) {
    adjusted *= input.weights.identidad;
  }
  if (input.persona?.matchesTolerancia && adjusted < input.thresholds.shield) {
    adjusted *= input.weights.tolerancia;
  }

  // 3) Ajuste por Reincidencia
  switch (input.offender?.strikeLevel) {
    case 1:
      adjusted *= input.weights.strike1;
      break;
    case 2:
      adjusted *= input.weights.strike2;
      break;
    case 'critical':
      adjusted *= input.weights.critical;
      break;
  }

  adjusted = Math.min(adjusted, 1.0);

  // 4) Overrides
  if (input.hasIdentityAttack) return 'shield_critico';
  if (input.hasThreat) return 'shield_critico';
  if (input.insultDensity && input.insultDensity >= N_DENSIDAD) {
    return 'shield_critico';
  }

  // 5) Threshold routing
  if (adjusted >= input.thresholds.critical) return 'shield_critico';
  if (adjusted >= input.thresholds.shield) return 'shield_moderado';

  // Correctiva
  if (
    adjusted < input.thresholds.shield &&
    adjusted >= input.thresholds.roastLower &&
    insultLevePeroArgumentoValido(input.text) &&
    (input.offender?.strikeLevel ?? 0) <= 1
  ) {
    return 'correctiva';
  }

  if (adjusted >= input.thresholds.roastLower) return 'roast';

  return 'publicar';
}
```

### Perspective API Client:

```typescript
// apps/backend-v2/src/integrations/perspectiveClient.ts
import { google } from 'googleapis';

export async function analyzeToxicity(text: string): Promise<number> {
  const perspective = google.discoverAPI(
    'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1'
  );

  const response = await perspective.comments.analyze({
    key: process.env.PERSPECTIVE_API_KEY,
    resource: {
      comment: { text },
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        IDENTITY_ATTACK: {},
        THREAT: {},
        INSULT: {}
      }
    }
  });

  return response.data.attributeScores.TOXICITY.summaryScore.value;
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 5)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 4)
- Perspective API: https://developers.perspectiveapi.com/

## 11. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `analysis_algorithms` - Algoritmos de análisis de toxicidad
- `analysis_limits` - Límites de análisis por plan
- `analysis_thresholds` - Umbrales de decisión (τ_roast_lower, τ_shield, τ_critical)
- `fallback_classifier_mapping` - Mapeo de fallback a GPT-4o-mini
- `gatekeeper` - Configuración de Gatekeeper
- `gatekeeper_detection_rules` - Reglas de detección de Gatekeeper
- `persona_encryption` - Configuración de cifrado de Persona
- `persona_matching_algorithm` - Algoritmo de matching de Persona
- `persona_matching_thresholds` - Umbrales de matching de Persona
- `persona_structure` - Estructura de datos de Persona
- `score_base_formula` - Fórmula base de severity score

---

## 12. Related Nodes
