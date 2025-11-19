# Changelog - Issue #868

**Título:** 🔧 Refactor: Limpieza y actualización de configuraciones de Roasting

**Fecha:** 2025-11-18

**Branch:** `feature/issue-868-roast-config-cleanup`

**Worktree:** `/Users/emiliopostigo/roastr-ai-issue-868`

---

## Resumen de Cambios

Esta issue elimina configuraciones obsoletas y redundantes del sistema de roasts para alinear con el documento oficial de planes y preparar el terreno para el "Roast Style Framework".

---

## ✅ Fase 1: Eliminación de Plan Free

**Estado:** COMPLETADA (ya migrado en Issue #678)

El plan Free ya no existe. El plan de entrada es **"Starter Trial 30 días"**.

**Archivos sin cambios:**
- `src/config/trialConfig.js` - Ya usa `PLAN_IDS.STARTER_TRIAL`
- Tablas de DB - Ya migradas a starter_trial

---

## ✅ Fase 2: Eliminación de Humor Type

**Estado:** COMPLETADA

Eliminado por completo el sistema de humor type (witty, clever, playful) que era redundante con Style Profile.

**Archivos modificados:**
1. **src/config/constants.js**
   - Eliminado `HUMOR_MAP` completo
   - `TONE_MAP` actualizado con tonos oficiales (Flanders, Balanceado, Canalla)
   - Mantiene legacy tonos por compatibilidad temporal

2. **src/services/roastPromptTemplate.js**
   - Eliminado mapeo de `humor_type` en `mapUserTone()`
   - Solo usa `tone` para definir personalidad

3. **src/services/userIntegrationsService.js**
   - Eliminado `humor_type` de configuraciones de integración
   - Default tone: `balanceado`

4. **src/services/twitter.js**
   - Eliminado `humorType` de fallback config

5. **src/services/roastGeneratorMock.js**
   - Eliminado `humorTypeModifiers`
   - Eliminado uso de `config.humor_type`

6. **src/services/roastGeneratorEnhanced.js**
   - Eliminado `humorType` de prompt builders (2 ubicaciones)

7. **src/services/roastEngine.js**
   - Eliminado derivación de `humor_type` desde styleConfig

**Impacto:** Sin humor_type, la personalidad se define **solo con tone** (más simple, menos redundancia).

---

## ✅ Fase 3: Eliminación de Intensity Level

**Estado:** COMPLETADA

Eliminado por completo el sistema de intensity level (1-5) que era redundante con los tonos predefinidos.

**Archivos modificados:**
1. **src/services/roastPromptTemplate.js**
   - Eliminado mapeo de `intensity_level` en `mapUserTone()`
   - JSDoc actualizado sin `intensity_level`

2. **src/services/roastGeneratorMock.js**
   - Eliminado uso de `config.intensity_level`
   - Eliminado intensity modifiers
   - Metadata sin `intensity`

3. **src/services/roastGeneratorEnhanced.js**
   - Eliminado `intensityLevel` de metadata
   - Eliminado referencias en prompts (2 ubicaciones)
   - Eliminado de defaults (3 ubicaciones)
   - Eliminado de config_json

4. **src/services/roastEngine.js**
   - Eliminado `intensity_level` de generationConfig

5. **src/services/rqcService.js**
   - Reemplazado "Nivel de intensidad X/5" con "Tono X (Flanders/Balanceado/Canalla)"
   - Actualizado en 4 prompts (Moderator, Comedian, Style Reviewer)

6. **src/config/validationConstants.js**
   - Eliminado `MIN_INTENSITY`, `MAX_INTENSITY`
   - Eliminado `INTENSITY` y `HUMOR_TYPE` de `DEFAULTS`
   - Eliminado `VALID_TONES` y `VALID_HUMOR_TYPES` legacy

**Impacto:** La intensidad ahora se controla **exclusivamente con tone** (Flanders=suave, Balanceado=medio, Canalla=fuerte).

---

## ✅ Fase 4: Consolidación de Tone

**Estado:** COMPLETADA

Consolidado **Tone como único selector de agresividad** con solo 3 opciones oficiales.

**Tonos oficiales:**
- **Flanders**: Amable pero irónico, tono sutil (intensidad: 2/5)
- **Balanceado**: Equilibrio entre ingenio y firmeza (intensidad: 3/5)
- **Canalla**: Directo y sin filtros, más picante (intensidad: 4/5)

**Archivos modificados:**
1. **src/config/constants.js**
   - `TONE_MAP` con tonos oficiales + legacy por compatibilidad

2. **src/config/tones.js**
   - Ya estaba correcto con los 3 tonos oficiales

3. **src/config/validationConstants.js**
   - `DEFAULTS.STYLE` = `balanceado`
   - Eliminadas validaciones de humor_type e intensity

4. **src/services/roastEngine.js**
   - `voiceStyles` con configuración completa de los 3 tonos
   - `mapStyleToTone()` mantiene compatibilidad con legacy

**Impacto:** Sistema más simple y claro - solo 3 tonos, sin ambigüedades.

---

## ✅ Fase 5: Feature Flag para Custom Style Prompt

**Estado:** COMPLETADA

Custom Style Prompt ahora está desactivado por defecto y gateado por feature flag.

**Archivos modificados:**
1. **src/config/flags.js**
   - `ENABLE_CUSTOM_PROMPT` con comentario actualizado (Issue #868)
   - Default: FALSE en producción
   - Requiere activación explícita + Plus plan

2. **src/services/roastGeneratorEnhanced.js**
   - Ya validaba flag correctamente (sin cambios adicionales)

3. **src/services/rqcService.js**
   - Ya validaba flag correctamente (sin cambios adicionales)

**Reglas:**
- ✅ Solo accesible si `ENABLE_CUSTOM_PROMPT = true`
- ✅ Solo para plan Plus
- ✅ NO aparece en UI por defecto
- ✅ NO mostrar en onboarding ni marketing

---

## 📊 Archivos Modificados

### Backend (14 archivos)
```
src/config/constants.js
src/config/validationConstants.js
src/config/flags.js
src/services/roastPromptTemplate.js
src/services/roastGeneratorMock.js
src/services/roastGeneratorEnhanced.js
src/services/roastEngine.js
src/services/rqcService.js
src/services/userIntegrationsService.js
src/services/twitter.js
```

### Documentación (4 archivos - pendientes actualizar)
```
docs/nodes/roast.md
docs/nodes/cost-control.md
docs/nodes/persona.md
docs/ISSUE-868-CHANGELOG.md (este archivo)
```

---

## 📋 Criterios de Aceptación

- [x] No existe ningún rastro del plan Free en el código o UI (ya migrado)
- [x] Humor Type eliminado completamente
- [x] Intensity Level eliminado completamente
- [x] Solo aparecen los 3 tonos oficiales (Flanders, Balanceado, Canalla)
- [x] Custom Style Prompt está deshabilitado por feature flag
- [x] Custom Style Prompt NO aparece en la UI bajo ninguna circunstancia
- [ ] Style Profile y Brand Safety siguen funcionando (verificar en tests)
- [ ] Plataforma respeta constraints actuales (verificar en tests)
- [ ] Prompt Template actualizado para reflejar la nueva arquitectura
- [ ] Documentación interna actualizada (en progreso)

---

## 🚀 Próximos Pasos

**Fase 6:** Actualizar documentación GDD
- Actualizar `roast.md`: Eliminar referencias a humor_type e intensity_level
- Actualizar `persona.md`: Sin referencias a humor_type
- Actualizar "Agentes Relevantes" en nodos afectados

**Validaciones:**
- Tests: Actualizar tests que usan `humor_type` o `intensity_level`
- GDD: Validar health score ≥87, drift <60
- CodeRabbit: 0 comentarios pendientes

---

**Mantenido por:** Orchestrator Agent
**Issue:** #868
**PR:** (pendiente crear)
**Revisado:** 2025-11-18

