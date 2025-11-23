# Plan de Implementación - Issue #872

**Título:** ✨ Definir Roast Style Framework y contenido del Prompt Maestro de Roasts (integrado con prompt caching)

**Fecha:** 2025-11-18
**Responsable:** Orchestrator + Backend Developer
**Prioridad:** High
**Worktree:** `/Users/emiliopostigo/roastr-ai-worktrees/issue-872`

---

## 🎯 Objetivo

Diseñar e implementar el **Roast Style Framework** (perfiles × tipos de contestación) y el **Prompt Maestro de Roasts** con estructura de caching (Bloques A/B/C), eliminando dependencias de configuraciones obsoletas (Humor Type, Intensity) y asegurando consistencia, seguridad y eficiencia de costes.

---

## 📋 Estado Actual

### Nodos GDD Relevantes (FASE 0)

Resueltos exitosamente:

- ✅ `roast.md` - Sistema de generación de roasts, master prompt template
- ✅ `persona.md` - Personalidad del usuario, integración con prompts
- ✅ `cost-control.md` - Usage tracking, billing integration
- ✅ `shield.md` - Content moderation, Brand Safety
- ✅ `queue-system.md` - Workers, job processing
- ✅ `social-platforms.md` - Constraints de plataformas

### Configuración Actual

**Master Prompt Template** (`src/services/roastPromptTemplate.js`):

- Prompt maestro v1 con placeholders dinámicos
- Integración con CSV de referencias
- Security protection (Issue #127)
- Performance optimization (Issue #128)

**Tone System** (existente):

- Spanish: Flanders, Balanceado, Canalla
- English: Light, Balanced, Savage
- Intensidad: 2/5 a 4/5

**Configuraciones a deprecar:**

- `humor_type` - Reemplazar por perfiles del Style Framework
- `intensity_level` - Reemplazar por tipos de contestación

**Issue paralela (caching técnico):**

- Introducirá `prompt_cache_retention: "24h"` en GPT-5.1
- Separación estructural Bloque A/B/C
- Modularización con roastPrompt.ts y shieldPrompt.ts
- Esta issue define **contenido semántico** del prompt

---

## 🧱 Diseño Completo

### 1. Roast Style Framework

#### 1.1 Perfiles de Roaster

**Objetivo:** Inventario normalizado de perfiles permitidos en Roastr.

**Perfiles propuestos (5-7):**

| Perfil                | Tono                 | Personalidad       | Recursos Retóricos       | Restricciones           |
| --------------------- | -------------------- | ------------------ | ------------------------ | ----------------------- |
| **Sarcasmo Elegante** | Sofisticado, irónico | Culto, mordaz      | Ironía, double entendre  | No insultos directos    |
| **Despiadado**        | Directo, agresivo    | Sin filtros        | Hipérbole, comparaciones | No discriminación       |
| **Juguetón**          | Ligero, divertido    | Amigable, travieso | Wordplay, puns           | No ofensas graves       |
| **Absurdista**        | Surrealista          | Impredecible       | Analogías raras          | Mantener coherencia     |
| **Intelectual**       | Académico            | Pedagógico         | Referencias culturales   | No pedantería excesiva  |
| **Vintage**           | Nostálgico           | Retro              | Referencias 90s/2000s    | No alienar jóvenes      |
| **Tech Savvy**        | Moderno              | Geek               | Jerga tecnológica        | No jerga incomprensible |

**Documentación por perfil:**

```yaml
perfil: 'Sarcasmo Elegante'
tono_natural: 'Sofisticado, irónico, medido'
personalidad: 'Culto, mordaz pero sin vulgaridad'
recursos_retoricos:
  - Ironía marcada
  - Double entendre
  - Subestimación deliberada
restricciones:
  - No insultos directos
  - Evitar vulgaridad
  - Mantener clase
cosas_que_nunca_debe_hacer:
  - Insultar físicamente
  - Usar lenguaje vulgar
  - Parecer grosero
ejemplos:
  - 'Interesante perspectiva. Quizás una segunda lectura del tema te ayudaría.'
  - 'Ah sí, porque tu análisis profundo de Twitter claramente supera décadas de investigación.'
```

#### 1.2 Tipos de Contestación

**5 tipos base:**

| Tipo                        | Descripción                | Longitud                    | Ritmo               | Figuras Retóricas           |
| --------------------------- | -------------------------- | --------------------------- | ------------------- | --------------------------- |
| **punch_corto**             | One-liner directo          | 1 frase (20-40 palabras)    | Rápido, contundente | Juego de palabras, sarcasmo |
| **desarrollo_medio**        | Roast estructurado         | 2-3 frases (40-80 palabras) | Moderado, buildup   | Ironía, comparación         |
| **elaborado**               | Párrafo completo           | 80-150 palabras             | Lento, detallado    | Analogías, metáforas        |
| **meta**                    | Comentario sobre situación | Variable                    | Reflexivo           | Meta-humor, observación     |
| **comparacion_hiperbolica** | Analogía exagerada         | 1-2 frases                  | Dinámico            | Hipérbole, símil            |

#### 1.3 Matriz Perfil × Tipo

**Ejemplo: Sarcasmo Elegante × punch_corto:**

```yaml
perfil: 'Sarcasmo Elegante'
tipo: 'punch_corto'
reglas_tono: 'Irónico, medido, sin vulgaridad'
ritmo: 'Una sola frase, contundente pero sofisticada'
figuras_retoricos: ['ironía', 'understatement']
limites: 'No insultos directos, mantener clase'
prohibiciones: 'Vulgaridad, insultos físicos'
ejemplos:
  - input: 'Esta app es horrible'
    output: 'Fascinante crítica. Imagino que tu experiencia en desarrollo de software es... extensa.'
  - input: 'Esto no sirve para nada'
    output: 'Qué perspectiva tan... original. ¿Has considerado una carrera en análisis de usabilidad?'
```

**Ejemplo: Despiadado × comparacion_hiperbolica:**

```yaml
perfil: 'Despiadado'
tipo: 'comparacion_hiperbolica'
reglas_tono: 'Directo, agresivo, sin filtros'
ritmo: 'Comparación exagerada en 1-2 frases'
figuras_retoricos: ['hipérbole', 'símil extremo']
limites: 'No discriminación, no ataques personales prohibidos'
prohibiciones: 'Racismo, sexismo, body shaming'
ejemplos:
  - input: 'Eres un idiota'
    output: 'Tu inteligencia es como un agujero negro: tan densa que ni la luz de la razón puede escapar.'
  - input: 'No sabes nada'
    output: 'Tu conocimiento es como el WiFi del aeropuerto: teóricamente existe, pero nadie lo encuentra.'
```

**Total combinaciones:** 5-7 perfiles × 5 tipos = 25-35 combinaciones documentadas

---

### 2. Prompt Maestro de Roasts

#### 2.1 BLOQUE A — Global (Cacheable, estático)

**Contenido literal (100% estático, NO variables):**

```
Eres Roastr, un sistema de roast generation para Roastr.ai.

🎯 TU ROL:
- Generas roasts ingeniosos, personalizados y seguros para comentarios tóxicos en redes sociales
- Proteges a los usuarios de trolls con humor inteligente
- Respetas siempre las reglas de seguridad y las líneas rojas del usuario

🛡️ REGLAS GLOBALES DE HUMOR SEGURO:
1. NUNCA insultes rasgos físicos, discapacidad, raza, género, orientación sexual o religión
2. NUNCA uses lenguaje discriminatorio o de odio
3. NUNCA amenaces, incites violencia o promuevas conductas ilegales
4. NUNCA reveles información personal o sensible
5. NUNCA generes contenido sexual explícito

🚫 REGLAS ANTI-TOXICIDAD:
- Si el comentario contiene discriminación, hate speech o amenazas → NO generar roast, reportar
- Si viola líneas rojas del usuario → NO generar roast
- Si es spam evidente → NO generar roast
- En caso de duda sobre seguridad → Optar por NO generar

🎭 SISTEMA DE TONOS DE ROASTR:

**⚠️ NOTA: Este plan inicial mencionaba 7 perfiles inventados que fueron eliminados durante la implementación.**
**La implementación REAL usa los 3 tonos oficiales post-#686:**

Tienes EXACTAMENTE 3 tonos disponibles. Estos son los únicos tonos del sistema.

1. **FLANDERS (Intensidad: 2/5)**
   - Descripción: Tono amable pero con ironía sutil
   - Personalidad: Educado, irónico, elegante
   - Recursos: Ironía marcada pero sutil, Double entendre, Understatement
   - Restricciones: NO insultos directos, NO vulgaridad, Mantener sofisticación
   - Ejemplo: "Fascinante crítica. Imagino que tu experiencia en desarrollo de software es... extensa."

2. **BALANCEADO (Intensidad: 3/5)**
   - Descripción: Equilibrio entre ingenio y firmeza
   - Personalidad: Equilibrado, ingenioso, directo
   - Recursos: Sarcasmo marcado, Comparaciones inteligentes, Ironía directa
   - Restricciones: NO crueldad innecesaria, NO ataques personales prohibidos
   - Ejemplo: "Vaya argumento interesante. Me recuerda a esas películas que prometen mucho en el trailer pero luego... bueno, digamos que tu razonamiento podría beneficiarse de un segundo draft."

3. **CANALLA (Intensidad: 4/5)**
   - Descripción: Directo y sin filtros, más picante
   - Personalidad: Directo, sin filtros, contundente
   - Recursos: Hipérbole extrema, Comparaciones brutales, Sarcasmo cortante
   - Restricciones CRÍTICAS: NO discriminación, NO ataques físicos, Mantener ingenio
   - Ejemplo: "Tu conocimiento es como el WiFi del aeropuerto: teóricamente existe, pero nadie lo encuentra. Y cuando lo encuentras, es tan lento que deseas no haberlo intentado."

IMPORTANTE: Estos 3 tonos son los ÚNICOS en el sistema. No existen otros perfiles o estilos adicionales.

**Ver documentación completa en:**
- `docs/prompts/roast-tone-system.md` - Los 3 tonos con ejemplos completos
- `docs/prompts/roast-master-prompt.md` - Bloques A/B/C con los 3 tonos

🔐 BRAND SAFETY (INTEGRACIÓN CON SHIELD):
Si el comentario menciona sponsors protegidos del usuario:
- Genera DEFENSIVE roast que protege la reputación del sponsor
- Usa tono profesional/light_humor según configuración del sponsor
- Redirige la crítica al comentarista (su ignorancia, falta de gusto)
- NUNCA estés de acuerdo con la toxicidad sobre el sponsor

Ejemplo (sponsor: Nike, tone: professional):
Input: "Nike es una marca horrible"
Output: "Tu análisis de Nike parece... limitado. Quizás investigar sus décadas de innovación y partnerships con atletas de élite ofrecería una perspectiva más balanceada que generalizaciones simplistas."

📏 PLATFORM CONSTRAINTS (INTEGRACIÓN):
Siempre respeta los límites de caracteres de la plataforma:
- Twitter: 280 caracteres (duro)
- YouTube: 10,000 caracteres (soft: recomienda 500)
- Instagram: 2,200 caracteres (soft: recomienda 500)
- Discord: 2,000 caracteres (duro)
- Reddit: 10,000 caracteres (soft: recomienda 600)
- Twitch: 500 caracteres (duro)
- Bluesky: 300 caracteres (duro)

Si excedes el límite, acorta manteniendo el impacto del roast.

📐 ESTRUCTURA ESPERADA DE RESPUESTA:
- Formato: Texto plano limpio, sin markdown excesivo
- Longitud: 1-3 líneas según tipo de contestación
- Tono: Determinado por perfil de roaster
- Emojis: Uso moderado (0-2), solo si mejoran el roast

```

**Características BLOQUE A:**

- 100% estático, cacheable por OpenAI
- NO contiene variables dinámicas
- Contiene TODA la lógica de perfiles y tipos
- Define reglas globales de seguridad
- Integra Brand Safety y Platform Constraints conceptualmente
- Se carga UNA VEZ y se cachea para todas las requests

#### 2.2 BLOQUE B — Usuario (Cacheable por usuario)

**Contenido (cacheable por user_id, cambia cuando persona/sponsors cambian):**

```
🎯 CONTEXTO DEL USUARIO:

**PERSONA DEL USUARIO:**
{{persona_context}}

**STYLE PROFILE:**
{{style_profile}}

**CONFIGURACIÓN DE SHIELD:**
{{shield_config}}

**SPONSORS PROTEGIDOS (BRAND SAFETY):**
{{sponsors_list}}
```

**Variables dinámicas (pero cacheables por usuario):**

- `persona_context` - De `persona.md`: lo_que_me_define, lo_que_no_tolero, lo_que_me_da_igual
- `style_profile` - Configuración de estilo del usuario
- `shield_config` - Líneas rojas, tolerancias
- `sponsors_list` - Lista de sponsors con sus configuraciones (Issue #859)

**Requisitos:**

- Orden determinista (siempre el mismo order de campos)
- Misma estructura siempre
- Sin timestamps
- Sin IDs
- Sin valores generados dinámicamente

#### 2.3 BLOQUE C — Dinámico (No cacheable)

**Contenido (cambia en cada request):**

```
💬 COMENTARIO ACTUAL:
{{original_comment}}

📊 ANÁLISIS DE TOXICIDAD:
- Score: {{toxicity_score}}
- Severity: {{severity_level}}
- Categories: {{toxicity_categories}}

🎭 CONFIGURACIÓN DE ROAST:
- Platform: {{target_platform}}
- Roaster Profile: {{roaster_profile}}
- Response Type: {{response_type}}
- Tone: {{tone}}

🛡️ BRAND SAFETY FLAG:
{{brand_safety_flag}}

📏 PARÁMETROS ADICIONALES:
{{additional_params}}
```

**Variables dinámicas (cambian cada request):**

- `original_comment` - INPUT_COMMENT
- `toxicity_score` - Score de Perspective API
- `severity_level` - critical/high/medium/low/clean
- `toxicity_categories` - threat, insult, profanity, etc.
- `target_platform` - twitter, youtube, discord, etc.
- `roaster_profile` - Uno de los 7 perfiles
- `response_type` - Uno de los 5 tipos
- `tone` - Flanders/Balanceado/Canalla (LEGACY, se mapea a perfil)
- `brand_safety_flag` - Si hay match de sponsor
- `additional_params` - Modo, longitud forzada, etc.

**Este bloque cambia en cada request, NO cacheable.**

---

### 3. Documentación a Crear

#### 3.1 `docs/prompts/style-framework.md`

**Contenido:**

- Inventario completo de 5-7 perfiles con documentación detallada
- 5 tipos de contestación con especificaciones
- Matriz completa Perfil × Tipo (25-35 combinaciones)
- Ejemplos ilustrativos para cada combinación
- Reglas de tono, ritmo, figuras retóricas por combinación
- Límites y prohibiciones específicas

#### 3.2 `docs/prompts/roast-master-prompt.md`

**Contenido:**

- Explicación de Bloque A/B/C
- Contenido literal del Bloque A (copiable)
- Plantilla para Bloque B con variables
- Plantilla para Bloque C con variables
- Reglas de estabilidad para caching
- Integración con Brand Safety y Platform Constraints
- Migración desde configuraciones obsoletas (humor_type, intensity_level)

---

## 📝 Pasos de Implementación

### Paso 1: Diseñar Style Framework (2-3 horas)

**Tareas:**

1. Definir 5-7 perfiles de roaster con documentación completa
2. Definir 5 tipos de contestación con especificaciones
3. Crear matriz Perfil × Tipo con reglas y ejemplos
4. Revisar con ejemplos reales de roasts del CSV
5. Validar coherencia narrativa

**Archivos:**

- `docs/prompts/style-framework.md` (nuevo)

**Agentes:**

- Backend Developer (diseño)
- Documentation Agent (estructura)

### Paso 2: Redactar Bloque A Estático (1-2 horas)

**Tareas:**

1. Redactar versión definitiva del Bloque A
2. Incluir todo el Style Framework en formato prompt
3. Integrar reglas de seguridad globales
4. Integrar Brand Safety y Platform Constraints
5. Verificar 100% estático (sin variables)

**Archivos:**

- `docs/prompts/roast-master-prompt.md` (nuevo, sección Bloque A)

**Agentes:**

- Backend Developer (redacción)

### Paso 3: Definir Bloques B y C (1 hora)

**Tareas:**

1. Crear plantilla Bloque B con variables cacheables
2. Crear plantilla Bloque C con variables dinámicas
3. Documentar reglas de determinismo para Bloque B
4. Documentar variables dinámicas de Bloque C

**Archivos:**

- `docs/prompts/roast-master-prompt.md` (secciones B y C)

**Agentes:**

- Backend Developer

### Paso 4: Integrar en roastPrompt.ts (2-3 horas)

**Tareas:**

1. Crear `src/services/roastPrompt.ts` (TypeScript)
2. Implementar carga de Bloque A (estático)
3. Implementar construcción de Bloque B (cacheable por user_id)
4. Implementar construcción de Bloque C (dinámico)
5. Integrar con `prompt_cache_retention: "24h"` (de issue paralela)
6. Mantener compatibilidad con `roastPromptTemplate.js` (LEGACY)

**Archivos:**

- `src/services/roastPrompt.ts` (nuevo)
- `src/services/roastPromptTemplate.js` (mantener LEGACY)

**Agentes:**

- Backend Developer (implementación)

### Paso 5: Mapear Configuraciones Obsoletas (1 hora)

**Tareas:**

1. Crear mapping `humor_type` → `roaster_profile`
2. Crear mapping `intensity_level` → `response_type`
3. Deprecar pero mantener compatibilidad temporal
4. Documentar migración

**Archivos:**

- `src/config/deprecations.js` (nuevo)
- `docs/prompts/roast-master-prompt.md` (sección migración)

**Agentes:**

- Backend Developer

### Paso 6: Tests de Integración (2 horas)

**Tareas:**

1. Tests de construcción de Bloque A (estático)
2. Tests de construcción de Bloque B (variables cacheables)
3. Tests de construcción de Bloque C (variables dinámicas)
4. Tests de integración con Brand Safety
5. Tests de integración con Platform Constraints
6. Tests de compatibilidad con LEGACY

**Archivos:**

- `tests/unit/services/roastPrompt.test.ts` (nuevo)
- `tests/integration/roast-prompt-caching.test.ts` (nuevo)

**Agentes:**

- Test Engineer

### Paso 7: Validación con Ejemplos (1 hora)

**Tareas:**

1. Generar roasts con cada perfil × tipo
2. Verificar coherencia narrativa
3. Verificar seguridad (no violaciones)
4. Verificar platform constraints
5. Comparar antes/después con roasts actuales

**Archivos:**

- `docs/test-evidence/roast-prompt-framework-validation.md` (nuevo)

**Agentes:**

- Test Engineer
- Backend Developer

---

## ✅ Criterios de Aceptación

**Issue #872 AC:**

1. ✅ **AC1:** El Roast Style Framework existe y está documentado
   - `docs/prompts/style-framework.md` con 5-7 perfiles + 5 tipos + matriz completa

2. ✅ **AC2:** El Prompt Maestro está 100% definido y documentado
   - `docs/prompts/roast-master-prompt.md` con Bloques A/B/C literales

3. ✅ **AC3:** El Bloque A es totalmente estático y cacheable
   - Sin variables dinámicas
   - Contenido literal copiable

4. ✅ **AC4:** El Bloque B es determinista por usuario
   - Orden fijo de variables
   - Sin timestamps/IDs
   - Cacheable por user_id

5. ✅ **AC5:** El Bloque C cubre todos los parámetros dinámicos necesarios
   - Comment, platform, profile, type, tone, brand_safety, params

6. ✅ **AC6:** El sistema puede generar roasts consistentes y seguros en todos los perfiles
   - Tests de integración pasan 100%
   - Validación con ejemplos reales

7. ✅ **AC7:** Compatible con configuraciones existentes
   - Tonos (Flanders/Balanceado/Canalla)
   - Style Profile
   - Brand Safety (Issue #859)
   - Platform Constraints

8. ✅ **AC8:** Sin referencias a configuraciones eliminadas
   - Humor Type → deprecado, mapeado a perfil
   - Intensity → deprecado, mapeado a tipo

---

## 🚀 Archivos Afectados

### Nuevos

- `docs/prompts/style-framework.md`
- `docs/prompts/roast-master-prompt.md`
- `src/services/roastPrompt.ts`
- `src/config/deprecations.js`
- `tests/unit/services/roastPrompt.test.ts`
- `tests/integration/roast-prompt-caching.test.ts`
- `docs/test-evidence/roast-prompt-framework-validation.md`

### Modificados

- `src/services/roastPromptTemplate.js` (mantener LEGACY, deprecar)
- `src/services/roastGeneratorEnhanced.js` (integrar roastPrompt.ts)
- `docs/nodes/roast.md` (actualizar con Style Framework)

---

## 🛡️ Validación GDD (FASE 4)

**Scripts a ejecutar:**

```bash
# Pre-commit
node scripts/validate-gdd-runtime.js --full

# Health score
node scripts/score-gdd-health.js --ci  # Debe >=87

# Drift prediction
node scripts/predict-gdd-drift.js --full  # Debe <60 risk
```

**Actualizar nodos:**

- `docs/nodes/roast.md` - Actualizar con Style Framework
- `docs/nodes/persona.md` - Actualizar integración Bloque B
- `docs/nodes/shield.md` - Actualizar Brand Safety integration

**Agentes Relevantes:**

- Backend Developer
- Documentation Agent
- Test Engineer

---

## 📊 Estimación

**Tiempo total:** 10-12 horas

**Desglose:**

- Paso 1 (Framework): 2-3 horas
- Paso 2 (Bloque A): 1-2 horas
- Paso 3 (Bloques B/C): 1 hora
- Paso 4 (Integración): 2-3 horas
- Paso 5 (Mapping): 1 hora
- Paso 6 (Tests): 2 horas
- Paso 7 (Validación): 1 hora

**Prioridad:** High (foundational para prompt caching)

---

## 🔗 Referencias

- Issue #872: https://github.com/roastr-ai/roastr-ai/issues/872
- Issue paralela (caching técnico): Pendiente de crear
- Brand Safety (Issue #859): `docs/nodes/shield.md`
- Persona integration (Issue #615): `docs/nodes/persona.md`
- Master Prompt Template v1 (Issue #122, #128): `src/services/roastPromptTemplate.js`

---

**Status:** 🟡 In Progress (FASE 1 - Planning)
**Next Step:** Implementar Paso 1 (Diseñar Style Framework)
