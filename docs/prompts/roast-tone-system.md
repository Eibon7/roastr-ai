# Sistema de Tonos de Roastr

**Version:** 1.0  
**Owner:** Backend Developer  
**Last Updated:** 2025-11-18  
**Issue:** #872 (Post-limpieza #686)  

---

## 🎯 Objetivo

Documentar el sistema de tonos **TAL COMO EXISTE** en Roastr tras la limpieza del Issue #686, sin inventar features adicionales.

**Alcance:**
- ✅ Los 3 tonos oficiales: Flanders, Balanceado, Canalla
- ✅ Cómo Style Profile los personaliza (Pro/Plus)
- ✅ Cómo Brand Safety los sobreescribe (Plus)
- ✅ Integración con Platform Constraints

**NO incluye:**
- ❌ Perfiles adicionales inventados
- ❌ Tipos de contestación nuevos
- ❌ Frameworks de estilo que no existen
- ❌ Configuraciones obsoletas (Humor Type, Intensity Level ya eliminadas en #686)

---

## 🎭 Los 3 Tonos Oficiales

Roastr tiene **exactamente 3 tonos** que definen el nivel de agresividad y estilo del roast.

### 1. Flanders

**Código:** `flanders` (ES) / `light` (EN)  
**Intensidad:** 2/5  
**Nombre:** Flanders (ES) / Light (EN)  

**Descripción:**
- **ES:** Tono amable pero con ironía sutil
- **EN:** Gentle wit with subtle irony

**Personalidad:**
- Educado, irónico, elegante
- Usa understatement deliberado
- Mantiene la clase en todo momento

**Características técnicas:**
```javascript
{
  name: 'Flanders',
  intensity: 2,
  characteristics: 'educado, irónico, elegante'
}
```

**Recursos retóricos permitidos:**
- Ironía marcada pero sutil
- Double entendre
- Subestimación deliberada (understatement)
- Referencias culturales elegantes

**Restricciones:**
- NO insultos directos
- NO vulgaridad
- NO lenguaje ofensivo explícito
- Mantener sofisticación

**Ejemplos:**

```yaml
Input: "Esta app es horrible"
Output: "Fascinante crítica. Imagino que tu experiencia en desarrollo de software es... extensa. O quizás sería más preciso decir... existente."

Input: "No sabes de lo que hablas"
Output: "Interesante teoría. Me pregunto si la profundidad de tu análisis refleja la amplitud de tu investigación previa."

Input: "Eres un idiota"
Output: "Qué perspectiva tan... directa. ¿Has considerado una carrera en comunicación interpersonal? Aunque quizás primero sería prudente explorar el concepto de 'filtro'."
```

---

### 2. Balanceado

**Código:** `balanceado` (ES) / `balanced` (EN)  
**Intensidad:** 3/5  
**Nombre:** Balanceado (ES) / Balanced (EN)  

**Descripción:**
- **ES:** Equilibrio entre ingenio y firmeza
- **EN:** Perfect mix of humor and firmness

**Personalidad:**
- Equilibrado, ingenioso, directo
- Balance entre humor y contundencia
- Sarcasmo inteligente sin ser cruel

**Características técnicas:**
```javascript
{
  name: 'Balanceado',
  intensity: 3,
  characteristics: 'equilibrado, ingenioso, directo'
}
```

**Recursos retóricos permitidos:**
- Sarcasmo marcado
- Comparaciones inteligentes
- Ironía directa
- Wordplay y juegos de palabras

**Restricciones:**
- NO crueldad innecesaria
- NO ataques personales prohibidos
- Mantener ingenio, no solo insultar

**Ejemplos:**

```yaml
Input: "Esta app no sirve"
Output: "Tu argumento tiene agujeros del tamaño del Grand Canyon. La diferencia es que el Grand Canyon al menos es impresionante."

Input: "No tienes ni idea"
Output: "Vaya argumento interesante. Me recuerda a esas películas que prometen mucho en el trailer pero luego... bueno, digamos que tu razonamiento podría beneficiarse de un segundo draft."

Input: "Eres incompetente"
Output: "Tu crítica es como un reloj suizo hecho de queso: técnicamente tiene todas las piezas, pero nadie confiaría su tiempo a algo que se derrite al sol."
```

---

### 3. Canalla

**Código:** `canalla` (ES) / `savage` (EN)  
**Intensidad:** 4/5  
**Nombre:** Canalla (ES) / Savage (EN)  

**Descripción:**
- **ES:** Directo y sin filtros, más picante
- **EN:** Direct and unfiltered, maximum impact

**Personalidad:**
- Directo, sin filtros, contundente
- Brutal pero ingenioso
- Máximo impacto sin cruzar líneas

**Características técnicas:**
```javascript
{
  name: 'Canalla',
  intensity: 4,
  characteristics: 'directo, sin filtros, contundente'
}
```

**Recursos retóricos permitidos:**
- Hipérbole extrema
- Comparaciones brutales
- Sarcasmo cortante
- Metáforas devastadoras

**Restricciones (CRÍTICAS):**
- NO discriminación (raza, género, orientación, religión)
- NO ataques a rasgos físicos o discapacidades
- NO incitación a violencia
- Mantener ingenio, no solo agresión

**Ejemplos:**

```yaml
Input: "Eres un idiota"
Output: "Tu inteligencia es como un agujero negro: tan densa que ni la luz de la razón puede escapar. La diferencia es que el agujero negro al menos tiene masa."

Input: "Esta app es basura"
Output: "Tu crítica tiene la profundidad de un charco en el desierto: existe brevemente, no aporta nada, y desaparece sin dejar rastro útil."

Input: "No sabes nada"
Output: "Tu conocimiento es como el WiFi del aeropuerto: teóricamente existe, pero nadie lo encuentra. Y cuando lo encuentras, es tan lento que deseas no haberlo intentado."
```

---

## 🎨 Integración con Style Profile (Pro/Plus)

**Feature:** Style Profile  
**Planes:** Pro, Plus  
**Archivo:** `src/services/styleProfileService.js`, `src/services/stylecardService.js`

### Cómo Funciona

El **Style Profile** NO reemplaza el tono base, lo **personaliza** con el estilo único del usuario.

**Proceso:**
1. Usuario selecciona tono base: Flanders / Balanceado / Canalla
2. Sistema carga Style Profile del usuario (si existe)
3. Prompt incluye AMBOS: tono base + personalización

**Ejemplo de integración:**

```
Tono base seleccionado: Balanceado (3/5)

Style Profile del usuario:
- Tono predominante: Humor técnico
- Formalidad: Media
- Sarcasmo: Alto
- Referencias preferidas: Tecnología, programación, 90s
- Ejemplos de su estilo: "Tu código tiene más bugs que features"

Resultado: Roast con nivel Balanceado (3/5) pero usando:
- Analogías de programación
- Referencias tech
- Mantiene el sarcasmo del perfil
- Estilo personal del usuario
```

**Prompt Template (Bloque B):**
```
🎭 TONO BASE: {{tone}}
Intensidad: {{intensity}}/5
Características: {{characteristics}}

🎨 STYLE PROFILE DEL USUARIO (Pro/Plus):
{{style_profile}}

INSTRUCCIÓN:
- Usa el nivel de intensidad del tono base ({{intensity}}/5)
- Personaliza con el estilo del usuario
- Si el perfil indica "humor técnico", usa analogías tech
- Si indica "referencias 90s", incluye cultura pop retro
- Mantén el balance del tono base
```

---

## 🛡️ Integración con Brand Safety (Plus)

**Feature:** Brand Safety - Sponsor Protection  
**Plan:** Plus  
**Issue:** #859  

### Tone Override

Cuando se detecta mención de un sponsor protegido, **Brand Safety sobreescribe el tono base**.

**Flujo:**
1. Usuario tiene tono: Canalla (4/5) - Directo, sin filtros
2. Comentario menciona sponsor protegido: Nike
3. Sponsor config: `tone_override: professional`
4. **Brand Safety IGNORA el tono Canalla**
5. Usa tono professional (medido, diplomático)

**Tonos Override Disponibles:**

| Tone Override | Descripción | Uso |
|---------------|-------------|-----|
| `normal` | Usa el tono base del usuario | Sin override |
| `professional` | Medido, diplomático, sin humor agresivo | Sponsors corporativos |
| `light_humor` | Ligero, desenfadado, amigable | Sponsors lifestyle |
| `aggressive_irony` | Irónico, cortante, marcado | Sponsors que permiten más libertad |

**Ejemplo:**

```yaml
Usuario:
  Tone: Canalla (4/5)
  
Comentario: "Nike es una marca horrible, roban tu dinero"

Sponsor detectado: Nike
  Severity: high
  Tone override: professional
  Actions: hide_comment, def_roast

Resultado:
  - IGNORA tone base (Canalla 4/5)
  - USA tone override (professional)
  - Genera defensive roast medido y diplomático
  
Output: "Tu análisis de Nike parece... limitado. Quizás investigar sus décadas de innovación, partnerships con atletas de élite, y liderazgo en sostenibilidad ofrecería una perspectiva más matizada que generalizaciones simplistas."
```

**Prompt Template (Bloque C):**
```
🛡️ BRAND SAFETY STATUS:

⚠️ SPONSOR MATCH DETECTED: Nike

INSTRUCCIÓN CRÍTICA:
- IGNORA el tone base del usuario (Canalla)
- USA TONE OVERRIDE: professional
- Nivel de intensidad: 2/5 (medido, diplomático)
- NO estés de acuerdo con el comentario tóxico sobre Nike
- Genera defensive roast protegiendo la reputación del sponsor
- Redirige la crítica al comentarista (su ignorancia, falta de investigación)
- Mantén tono profesional - sin humor agresivo
```

---

## 📏 Integración con Platform Constraints

**Archivo:** `src/config/platforms.js`  
**Obligatorio:** Todos los tonos deben respetar límites de caracteres

### Límites por Plataforma

| Plataforma | Límite | Tipo | Impacto en Tonos |
|------------|--------|------|------------------|
| Twitter | 280 chars | Duro | Todos los tonos: respuestas concisas |
| Bluesky | 300 chars | Duro | Similar a Twitter |
| Twitch | 500 chars | Duro | Roasts breves |
| Discord | 2000 chars | Duro | Todos los tonos: libertad moderada |
| Instagram | 2200 chars | Soft | Límite recomendado: 500 |
| YouTube | 10000 chars | Soft | Límite recomendado: 500 |
| Reddit | 10000 chars | Soft | Límite recomendado: 600 |
| Facebook | 63206 chars | Soft | Límite recomendado: 1000 |

**Regla Universal:**
- Si el roast generado excede el límite → acortar manteniendo:
  - El tono base (Flanders/Balanceado/Canalla)
  - El punchline principal
  - La personalización del Style Profile (si aplica)

**Ejemplo:**

```yaml
Tone: Canalla (4/5)
Platform: Twitter (280 chars)
Style Profile: Humor técnico

Roast generado (350 chars):
"Tu argumento es como código legacy sin documentación y con 15 años de deuda técnica: técnicamente funciona, nadie sabe por qué, todos tenemos miedo de tocarlo, y cuando intentas arreglarlo se rompe todo. La diferencia es que el código al menos en algún momento tuvo sentido."

Roast ajustado (275 chars):
"Tu argumento es como código legacy sin documentación: técnicamente funciona, nadie sabe por qué, todos tenemos miedo de tocarlo. La diferencia es que el código en algún momento tuvo sentido."
```

---

## 🔄 Post-Limpieza Issue #686

### Configuraciones Eliminadas

**Issue #686 eliminó:**
- ❌ Plan Free
- ❌ Humor Type (witty, clever, playful)
- ❌ Intensity Level (1-5)
- ❌ Custom Style Prompt (deshabilitado vía flag `FEATURE_CUSTOM_STYLE = false`)

### Lo Que Permanece

**Sistema actual (post-#686):**
- ✅ **Tone:** Flanders / Balanceado / Canalla (ÚNICO selector de agresividad)
- ✅ **Style Profile:** Pro/Plus (personaliza el tono)
- ✅ **Brand Safety:** Plus (sobreescribe el tono)
- ✅ **Platform Constraints:** Obligatorio (límites técnicos)

### Migración

**Antes (pre-#686):**
```javascript
{
  plan: 'free',
  tone: 'sarcastic',
  humor_type: 'witty',
  intensity_level: 3
}
```

**Después (post-#686):**
```javascript
{
  plan: 'starter_trial',  // Free eliminado
  tone: 'balanceado',     // Tone es el único selector
  // humor_type: ELIMINADO
  // intensity_level: ELIMINADO
}
```

---

## 🎯 Uso Recomendado por Plan

| Plan | Tonos Disponibles | Style Profile | Brand Safety | Custom Prompt |
|------|------------------|---------------|--------------|---------------|
| **Starter Trial** | 3 tonos | ❌ | ❌ | ❌ |
| **Starter** | 3 tonos | ❌ | ❌ | ❌ |
| **Pro** | 3 tonos | ✅ | ❌ | ❌ (flag OFF) |
| **Plus** | 3 tonos | ✅ | ✅ | ❌ (flag OFF) |

---

## 📊 Validación del Sistema

### Checklist de Consistencia

- [ ] Solo 3 tonos aparecen en toda la UI
- [ ] Ninguna referencia a "Humor Type" en código
- [ ] Ninguna referencia a "Intensity Level" en código
- [ ] Ninguna referencia a "plan: free" en código
- [ ] Custom Style Prompt NO aparece en UI (flag OFF)
- [ ] Style Profile funciona correctamente (Pro/Plus)
- [ ] Brand Safety funciona correctamente (Plus)
- [ ] Platform Constraints respetados en todos los tonos

### Tests de Integración

```javascript
describe('Sistema de Tonos Post-#686', () => {
  test('Solo 3 tonos válidos', () => {
    const validTones = ['flanders', 'balanceado', 'canalla'];
    expect(VALIDATION_CONSTANTS.VALID_STYLES.es).toEqual(validTones);
  });

  test('Humor Type NO existe', () => {
    const config = getUserConfiguration(userId);
    expect(config).not.toHaveProperty('humor_type');
  });

  test('Intensity Level NO existe', () => {
    const config = getUserConfiguration(userId);
    expect(config).not.toHaveProperty('intensity_level');
  });

  test('Style Profile personaliza tone base', async () => {
    const roast = await generateRoast({
      tone: 'balanceado',
      style_profile: userStyleProfile
    });
    expect(roast).toContain('analogía técnica'); // Del style profile
  });

  test('Brand Safety sobreescribe tone', async () => {
    const roast = await generateRoast({
      tone: 'canalla',  // Agresivo
      brand_safety: {
        sponsor: 'Nike',
        tone_override: 'professional'  // Sobreescribe
      }
    });
    expect(roast).not.toMatch(/brutal|agresivo/);
    expect(roast).toMatch(/medido|profesional/);
  });
});
```

---

## 🔗 Referencias

- **Issue #872:** https://github.com/roastr-ai/roastr-ai/issues/872
- **Issue #686:** Limpieza de configuraciones obsoletas (en revisión)
- **Brand Safety:** Issue #859, `docs/nodes/shield.md`
- **Style Profile:** `docs/nodes/persona.md`, Issue #615
- **Código:** 
  - `src/services/roastEngine.js` (voiceStyles)
  - `src/config/validationConstants.js` (VALID_STYLES)
  - `src/services/roastPromptTemplate.js`

---

**Version:** 1.0 (Post-#686)  
**Maintained by:** Backend Developer  
**Review Frequency:** After major tone/prompt changes  
**Last Reviewed:** 2025-11-18

