# GDD Node — Motor de Análisis v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Motor determinista que analiza cada comentario usando Perspective API, Roastr Persona y reincidencia para calcular un severity_score y decidir la acción: publicar normal, respuesta correctiva (Strike 1), roast, Shield moderado o Shield crítico. Es el núcleo del sistema de protección y respuesta de Roastr.

---

## 2. Responsibilities

### Funcionales:

- Calcular toxicidad base con Perspective API
- Fallback con clasificador IA barato (GPT-4o-mini) si Perspective falla
- Detectar insult density (N_DENSIDAD ≥ 3 insultos)
- Aplicar ajustes de Roastr Persona (líneas rojas, identidades, tolerancias)
- Aplicar factor de reincidencia (strikes 90 días)
- Calcular severity_score final
- Decidir acción según thresholds (τ_roast_lower, τ_shield, τ_critical)
- Forzar Shield crítico en amenazas e identity attacks

### No Funcionales:

- Determinismo total (mismo input → mismo output)
- Auditable (todos los pasos loggeados)
- Sin prompt injection
- Barato de ejecutar
- Seguro contra fugas de Roastr Persona

---

## 3. Inputs

- **Comentario normalizado**:
  ```typescript
  {
    (id, platform, accountId, userId, authorId, text, timestamp, metadata);
  }
  ```
- **Roastr Persona** (cifrado): identidades, líneas rojas, tolerancias
- **Ofensor**: strikeLevel (0, 1, 2, "critical"), lastStrike
- **Thresholds** (SSOT): τ_roast_lower, τ_shield, τ_critical
- **Weights** (SSOT): lineaRoja, identidad, tolerancia, strike1, strike2, critical
- **Créditos**: analysis_remaining

---

## 4. Outputs

- **Decisión**:
  ```typescript
  type AnalysisDecision =
    | 'publicar'
    | 'correctiva'
    | 'roast'
    | 'shield_moderado'
    | 'shield_critico';
  ```
- **Metadata**: severity_score, matched_red_line, flags (identity_attack, threat, insult_density)
- **Logs** (sin texto crudo): decisión, score, bucket, timestamp

---

## 5. Rules

### Pre-condición CRÍTICA:

**Si analysis_remaining = 0**:

- ❌ NO hay ingestión
- ❌ NO se llama a Perspective
- ❌ NO actúa el Motor de Análisis
- ❌ NO hay Shield
- ❌ NO hay Roasts
- ✅ Solo se muestra histórico en UI

### Pipeline de Análisis:

**1. Toxicidad Base (Perspective API)**:

```typescript
score_base ∈ [0, 1]
flags = {
  has_identity_attack,
  has_threat,
  has_insult,
  ...
}
```

Si Perspective falla:

- Retry según política
- Si sigue fallando → **fallback IA barato (GPT-4o-mini)**
  - Produce: `toxicity_level` (low/medium/high/critical)
  - Mapeo: low→0.20, medium→0.45, high→0.75, critical→0.95
- Si ambos fallan → `score_base` = τ_shield (conservador)

**2. Insult Density**:
Si `insults_count >= N_DENSIDAD` (default 3):

```typescript
score_base = 1.0; // Fuerza Shield Crítico
```

**3. Ajuste por Roastr Persona**:

```typescript
let score_persona = score_base;

// Línea roja
if (matchesLineaRoja) {
  score_persona *= weights.lineaRoja; // 1.15
}

// Identidad propia
if (matchesIdentidad) {
  score_persona *= weights.identidad; // 1.10
}

// Tolerancias (solo si score_base < τ_shield)
if (matchesTolerancia && score_base < τ_shield) {
  score_persona *= weights.tolerancia; // 0.95 (reduce)
}
```

**Regla de Tolerancias**:

- Pueden convertir **roasteable** → **publicación normal**
- Pueden convertir **Shield moderado** → **roasteable**
- ❌ **NUNCA** convierten **Shield crítico** en nada más benigno

**4. Ajuste por Reincidencia**:

```typescript
let score_final = score_persona;

switch (offender.strikeLevel) {
  case 1:
    score_final *= weights.strike1;
    break; // 1.10
  case 2:
    score_final *= weights.strike2;
    break; // 1.25
  case 'critical':
    score_final *= weights.critical;
    break; // 1.50
}

score_final = min(score_final, 1.0);
```

**5. Overrides Duros**:

```typescript
if (has_identity_attack) return 'shield_critico';
if (has_threat) return 'shield_critico';
if (insults_count >= N_DENSIDAD) return 'shield_critico';
if (strikeLevel >= 2 && insultos_fuertes) return 'shield_critico';
```

**6. Threshold Routing**:

```typescript
// 1️⃣ Shield Crítico (máxima prioridad)
if (score_final >= τ_critical) return 'shield_critico';

// 2️⃣ Shield Moderado
if (score_final >= τ_shield) return 'shield_moderado';

// 3️⃣ Zona Correctiva (Strike 1)
if (
  score_final < τ_shield &&
  score_final >= τ_roast_lower &&
  insultLevePeroArgumentoValido &&
  offender.strikeLevel <= 1
) {
  return 'correctiva';
}

// 4️⃣ Zona Roasteable
if (score_final >= τ_roast_lower) return 'roast';

// 5️⃣ Publicación Normal
return 'publicar';
```

### Zona Correctiva (Strike 1):

Condiciones:

- `score_final < τ_shield`
- `score_final >= τ_roast_lower`
- `insultLevePeroArgumentoValido === true`
- `offender.strikeLevel <= 1`

Acción:

- Genera **Respuesta Correctiva** (no usa tonos configurados)
- Estilo serio, institucional
- Mensaje estándar: "Este es tu Strike 1"
- Consume **1 crédito de roast**
- Asigna `strikeLevel = 1`

### Thresholds (SSOT):

```typescript
type Thresholds = {
  roastLower: number; // τ_roast_lower
  shield: number; // τ_shield
  critical: number; // τ_critical
};
```

### Weights (SSOT):

```typescript
type Weights = {
  lineaRoja: number; // 1.15
  identidad: number; // 1.10
  tolerancia: number; // 0.95
  strike1: number; // 1.10
  strike2: number; // 1.25
  critical: number; // 1.50
};
```

### Roastr Persona:

```typescript
type PersonaProfile = {
  identidades: string[]; // "Lo que me define"
  lineasRojas: string[]; // "Lo que no tolero"
  tolerancias: string[]; // "Lo que me da igual"
};
```

- Almacenado **cifrado** (AES-256-GCM)
- ❌ **NUNCA** en prompts de IA
- ❌ **NUNCA** visible en Admin Panel
- Borrado inmediato al eliminar cuenta

### Reincidencia (90 días):

```typescript
type OffenderProfile = {
  strikeLevel: 0 | 1 | 2 | 'critical';
  lastStrike: string | null;
};
```

- Strike 1 → insulto inicial + argumento válido
- Strike 2 → reincidencia
- Critical → reincidencia con insultos fuertes / amenazas / identity attack
- Auto-purga a los 90 días

---

## 6. Dependencies

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
