# GDD Node — Motor de Roasting v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Motor que genera respuestas inteligentes y seguras (roasts o correctivas) usando LLM, arquitectura de prompts A/B/C cacheados, tonos configurables, Style Validator rule-based, y disclaimers IA. Opera bajo principios de seguridad, consistencia y auditoría.

---

## 2. Responsibilities

### Funcionales:

- Generar roasts en 4 tonos: flanders, balanceado, canalla, personal (rule-based)
- Generar respuestas correctivas (Strike 1) con tono institucional
- Construir prompts con bloques A/B/C cacheados (50-70% ahorro)
- Validar contenido con Style Validator (rule-based, sin IA)
- Añadir disclaimers IA obligatorios siempre que auto-approve esté ON
- Generar 1 o 2 variantes según flag `show_two_roast_variants`
- Permitir regeneración (consume 1 crédito)
- Aplicar smart delays por plataforma
- Respetar límites de longitud por plataforma

### No Funcionales:

- Seguridad: nunca usa Roastr Persona en prompts
- Consistencia: mismo tono → mismo tipo de respuesta
- Auditoría: logs sin texto crudo
- Coste: prompt caching (50-70% ahorro)
- Legal: disclaimers obligatorios en UE

---

## 3. Inputs

- **RoastGenerationRequest**:
  ```typescript
  {
    commentId,
    accountId,
    userId,
    platform,
    text,
    tone: "flanders" | "balanceado" | "canalla" | "personal",
    styleProfileId?: string,  // solo Pro/Plus
    autoApprove: boolean,
    analysis_score_final,
    analysis_bucket
  }
  ```
- **SSOT**: tonos, modelos LLM, disclaimers, límites plataforma
- **Créditos**: roasts_remaining

---

## 4. Outputs

- **RoastCandidate(s)**:
  ```typescript
  {
    (text, tone, disclaimers_applied, score_confidence, blocked_by_style_validator);
  }
  ```
- **Roast final** (si auto-approve ON):
  ```typescript
  {
    (final_text, published_at, platform_message_id, analysis_score_final, decision_bucket);
  }
  ```
- Logs sin texto crudo

---

## 5. Rules

### Tonos Oficiales:

```typescript
type RoastTone = 'flanders' | 'balanceado' | 'canalla' | 'personal';
```

**flanders**: amable, diminutivos, humor blanco  
**balanceado**: sarcasmo suave, elegante (tono estándar)  
**canalla**: humor afilado, ironía, límites estrictos  
**personal**: rule-based del estilo del usuario (solo Pro/Plus, badge Beta)

❌ **nsfw**: Bloqueado (flag `nsfw_tone_enabled` = false por defecto)

### Tono Personal:

- Rule-based (NO embeddings, NO análisis psicológico)
- Basado en: longitud típica, sarcasmo usual, emojis, expresiones comunes, formalidad
- Cifrado
- No visible
- No se puede borrar (solo desactivar seleccionando otro tono)

### Arquitectura de Prompts A/B/C:

**Block A — Global (cache 24h)**:

- Reglas de seguridad
- Reglas de humor seguro
- Anti-inyección
- Restricciones por plataforma
- Normativa IA/DSA

**Block B — Usuario/Cuenta (cache 24h)**:

- Tono elegido
- Tono personal (si aplica)
- Preferencias del usuario
- Idioma
- Modelo LLM asignado
- Disclaimers por región

**Block C — Dinámico (sin caché)**:

- Comentario original
- Contexto del hilo
- Reincidencia
- Metadata de plataforma

**Ahorro esperado**: 50-70% en tokens

### Flujos:

**1. Manual Review (auto-approve OFF)**:

1. Worker genera 1 o 2 versiones (según flag `show_two_roast_variants`)
2. Muestra al usuario
3. Usuario puede:
   - Enviar → pasa por Style Validator → publica
   - Regenerar → consume 1 crédito
   - Descartar
4. Si aprobación manual → NO añade disclaimer automático

**2. Auto-Approve ON**:

1. Genera 1 roast
2. Style Validator
3. Si OK → publica automáticamente
4. **Disclaimer IA obligatorio** (regiones UE con DSA/AI Act)

**3. Respuesta Correctiva (Strike 1)**:

- Usa **tono único "Correctiva"** (no los tonos de humor)
- Mensaje serio, institucional
- Ejemplo: "Apreciamos el debate sin insultos. Para mantener la conversación en buen tono, aplicamos un sistema de avisos. Este es tu Strike 1. Puedes seguir conversando con respeto. — Roastr.ai"
- Disclaimer IA obligatorio
- Consume **1 crédito de roast**

### Style Validator (Rule-Based):

❌ **NO permite**:

- Insultos
- Ataques identitarios
- Contenido explícito
- Spam (200+ chars repetidos, 50+ emojis seguidos, 200+ "ja...")
- Textos vacíos
- Textos > límite plataforma
- Falsos disclaimers IA
- Lenguaje incoherente con tono (excepto Personal Beta)

✅ **Si pasa**: OK  
❌ **Si falla**: error claro, **crédito ya consumido no se devuelve**

### Disclaimers IA:

**Obligatorios cuando**:

- `autoApprove === true`

**NO obligatorios cuando**:

- el usuario aprueba manualmente el roast (auto-approve OFF)

**Pool configurable** (SSOT):

```typescript
type DisclaimerPool = {
  tone: RoastTone | 'corrective';
  variants: string[]; // 3-5 por tono
};
```

Ejemplos (orientativos, configurables en SSOT):

- "Tu asistente IA acaba de actuar por ti 👀"
- "Un troll menos. No hace falta que me des las gracias 😇"
- "Roastr actuó: moderación con chispita digital."

### Límites por Plataforma:

**X (Twitter)**:

- Máx 280 chars
- Delay: 10-15s entre respuestas
- Ventana de edición → autopost retrasado 30 min
- Anti-bot: máx 4 respuestas/hora al mismo usuario

**YouTube**:

- Sin límite estricto de chars
- Delay: 2-3s entre respuestas
- Visibilidad no inmediata

### Consumo de Créditos:

| Acción               | Crédito |
| -------------------- | ------- |
| Roast generado       | 1 roast |
| Regenerar roast      | 1 roast |
| Respuesta correctiva | 1 roast |
| Validación estilo    | 0       |
| Publicación          | 0       |

---

## 6. Dependencies

### Servicios Externos:

- **OpenAI**: LLM por tono (GPT-4 Turbo para flanders, GPT-5 mini para balanceado/canalla/personal según SSOT)
- **Supabase**: Tablas `roasts`, `user_style_profiles` (cifrados)

### SSOT:

- Tonos: `roast_tones` (nombre, modelo, prompt base, estado)
- Disclaimers: `disclaimer_pool`
- Límites plataforma: `platform_constraints`
- Flags: `show_two_roast_variants`, `personal_tone_enabled`, `nsfw_tone_enabled`

**Modelos IA por Tono (SSOT-mandated)**:

El Motor de Roasting DEBE utilizar exactamente los modelos definidos en SSOT:

- `flanders` → GPT-4 Turbo
- `balanceado` → GPT-5 mini
- `canalla` → GPT-5 mini
- `personal` → GPT-5 mini

**Reglas**:

- No se permite fallback a otros modelos.
- No se permite usar modelos no declarados en SSOT.
- Todos los workers deben cargar el modelo desde SSOT en cada job.

### Workers:

- `GenerateRoast`: Genera roasts
- `GenerateCorrectiveReply`: Genera correctivas
- `SocialPosting`: Publica roasts/correctivas
- `BillingUpdate`: Consume créditos

### Nodos Relacionados:

- `03-billing-polar.md` (Créditos de roasts)
- `05-motor-analisis.md` (Decisión "roast" o "correctiva")
- `08-workers.md` (Workers GenerateRoast, SocialPosting)
- `11-feature-flags.md` (Flags relacionados)

---

## 7. Edge Cases

1. **Edición del comentario original (X)**:
   - Autopost retrasado 30 min
   - Shield puede actuar antes

2. **Edición del roast con insultos**:
   - Bloqueado por Style Validator
   - Crédito ya consumido

3. **Spam en roast editado**:
   - Bloqueado

4. **Tono personal produce irregulares**:
   - Fallback a Tono Balanceado

5. **Cambio de tono con roast pendiente**:
   - Usa tono inicial (no el nuevo)

6. **Error de API (OpenAI)**:
   - 3 retries + backoff
   - Si persiste → DLQ

7. **Mensaje demasiado largo**:
   - Rechazado ANTES de llamar IA
   - Ahorro de tokens

8. **Límite roasts = 0**:
   - No genera roasting
   - UI muestra "Límite alcanzado"

9. **Límite análisis = 0**:
   - No hay roasting (tampoco análisis)

10. **Cuenta pausada/billing paused**:
    - Workers OFF
    - No genera roasts

11. **Sponsor con reglas propias** (Plus):
    - Usa configuración específica del sponsor

---

## 8. Acceptance Criteria

### Tonos:

- [ ] 4 tonos implementados: flanders, balanceado, canalla, personal
- [ ] Tono personal solo Pro/Plus + badge Beta
- [ ] nsfw bloqueado (flag OFF)
- [ ] Tonos cargados desde SSOT

### Prompts A/B/C:

- [ ] Block A cacheado 24h
- [ ] Block B cacheado 24h
- [ ] Block C dinámico
- [ ] Ahorro 50-70% tokens

### Generación:

- [ ] 1 variante si flag OFF
- [ ] 2 variantes si flag ON
- [ ] Regeneración consume 1 crédito
- [ ] Consume 1 crédito por generación

### Style Validator:

- [ ] Bloquea insultos
- [ ] Bloquea ataques identitarios
- [ ] Bloquea contenido explícito
- [ ] Bloquea spam (200+ chars repetidos, 50+ emojis)
- [ ] Bloquea textos vacíos
- [ ] Bloquea longitud > límite plataforma
- [ ] Bloquea falsos disclaimers

### Disclaimers:

- [ ] Añadido si auto-approve ON
- [ ] NO añadido si aprobación manual
- [ ] Pool configurable (SSOT)
- [ ] 3-5 variantes por tono

### Flujos:

- [ ] Auto-approve ON → genera → valida → publica + disclaimer
- [ ] Auto-approve OFF → genera → muestra usuario → aprueba → valida → publica (sin disclaimer automático)
- [ ] Correctiva → tono institucional + disclaimer + Strike 1

### Límites:

- [ ] X: máx 280 chars
- [ ] X: delay 10-15s
- [ ] X: ventana edición → delay 30 min
- [ ] YouTube: delay 2-3s

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Prompt builder A/B/C
- ✅ Style Validator (todos los checks)
- ✅ Disclaimer selection (pool)
- ✅ Tono personal (rule-based)
- ✅ Límites por plataforma
- ❌ NO testear: OpenAI directamente

### Integration Tests (Supabase Test):

- ✅ Roast generado guardado en BD
- ✅ Auto-approve ON → publicado automáticamente
- ✅ Auto-approve OFF → pending review
- ✅ Regeneración consume crédito
- ✅ Style Validator bloquea roast inválido
- ✅ Correctiva generada con tono institucional
- ✅ Disclaimer añadido (auto-approve ON)
- ✅ NO disclaimer (aprobación manual)

### E2E Tests (Playwright):

- ✅ Generar roast → aprobar → publicar
- ✅ Generar roast → regenerar → publicar
- ✅ Generar roast → descartar
- ✅ Auto-approve genera y publica automáticamente
- ✅ Disclaimer visible en auto-approve
- ✅ Límite roasts agotado → no genera

---

## 10. Implementation Notes

### Prompt Builder:

```typescript
// apps/backend-v2/src/services/promptBuilder.ts

export function buildRoastPrompt(
  blockA: string, // Global, cached 24h
  blockB: string, // User, cached 24h
  blockC: string // Dynamic, no cache
): string {
  return `${blockA}\n\n${blockB}\n\n${blockC}`;
}
```

### Style Validator:

```typescript
// apps/backend-v2/src/services/styleValidator.ts

export function validateRoast(
  text: string,
  platform: Platform
): {
  valid: boolean;
  reason?: string;
} {
  // Checks:
  if (containsInsults(text)) return { valid: false, reason: 'insultos' };
  if (containsIdentityAttack(text)) return { valid: false, reason: 'ataque identitario' };
  if (containsExplicitContent(text)) return { valid: false, reason: 'contenido explícito' };
  if (isSpam(text)) return { valid: false, reason: 'spam' };
  if (text.length === 0) return { valid: false, reason: 'texto vacío' };
  if (exceedsPlatformLimit(text, platform)) return { valid: false, reason: 'demasiado largo' };
  if (containsFakeDisclaimer(text)) return { valid: false, reason: 'falso disclaimer' };

  return { valid: true };
}
```

### Disclaimer Selection:

```typescript
// apps/backend-v2/src/services/disclaimerService.ts

export function selectDisclaimer(
  tone: RoastTone | 'corrective',
  autoApprove: boolean
): string | null {
  if (!autoApprove) return null;

  const pool = getDisclaimerPool(tone);
  if (!pool || pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)];
}
```

### OpenAI Client (con caching):

```typescript
// apps/backend-v2/src/integrations/openaiClient.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateRoast(prompt: string, model: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.8
  });

  return response.choices[0].message.content!;
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 6)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 6)
- OpenAI Docs: https://platform.openai.com/docs
