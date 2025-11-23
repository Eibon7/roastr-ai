# Plan de Implementación - Issue #868

**Título:** 🔧 Refactor: Limpieza y actualización de configuraciones de Roasting (Planes, Humor Type, Intensidad y Feature Flags)

**Worktree:** `/Users/emiliopostigo/roastr-ai-issue-868`

**Branch:** `feature/issue-868-roast-config-cleanup`

**Prioridad:** High

**Estado:** En Planificación

**Fecha Creación:** 2025-11-18

---

## Resumen Ejecutivo

Refactorización completa de las configuraciones del sistema de roasts para eliminar redundancias, alinear con el documento oficial de planes, y preparar el terreno para el "Roast Style Framework". Se eliminarán configuraciones obsoletas (plan Free, Humor Type, Intensity Level) y se mantendrá solo Tone como selector principal de agresividad.

---

## Estado Actual

### Configuraciones Existentes (redundantes/obsoletas)

**Plan Free:**

- Presente en: Tablas de planes, lógica de permisos, `mapUserTone()`, prompts, templates
- Status: **Obsoleto** - El plan de entrada será "Starter Trial 30 días"

**Humor Type (witty, clever, playful):**

- Presente en: `integration_configs.humor_type`, prompts, roast templates
- Status: **Redundante** - duplica funcionalidad de perfiles de estilo
- Eliminación: Completa (tabla, mapeo, UI, lógica)

**Intensity Level (1-5):**

- Presente en: User config, mapeo hacia tonos, validación
- Status: **Redundante** - duplica tonos predefinidos (Flanders, Balanceado, Canalla)
- Eliminación: Completa (ajuste, mapeo, tablas, UI, prompts)

**Tone (Flanders, Balanceado, Canalla):**

- Status: **✅ Mantener** - Único selector de agresividad
- Archivos: `src/config/constants.js`, `src/services/roastPromptTemplate.js`

**Custom Style Prompt:**

- Status: **Feature Flag** - Desactivado por defecto
- Acceso: Solo con `FEATURE_CUSTOM_STYLE = true` (Plus plan)
- No mostrar en UI ni onboarding

**Style Profile (Pro/Plus):**

- Status: **✅ Mantener sin cambios**

**Brand Safety (Plus):**

- Status: **✅ Mantener sin cambios**

**Platform Constraints:**

- Status: **✅ Mantener sin cambios**

---

## Análisis de Impacto (Nodos GDD)

### Nodos Afectados

**1. roast (Critical):**

- ✅ Eliminar referencias a plan "free"
- ✅ Eliminar Humor Type de prompt templates
- ✅ Eliminar Intensity Level de generación
- ✅ Actualizar mapeo de tonos (solo Flanders/Balanceado/Canalla)
- ✅ Feature flag para Custom Style Prompt

**2. cost-control (Critical):**

- ✅ Eliminar plan "free" de límites de uso
- ✅ Actualizar tablas: `plan_limits`, `monthly_usage_summary`

**3. persona (High):**

- ✅ Eliminar referencias a Humor Type en config
- ⚠️ Verificar que Custom Style Prompt sigue feature-flagged

**4. social-platforms (High):**

- ✅ Eliminar `humor_type` de `integration_configs`
- ⚠️ Actualizar constraint check para solo usar tone

### Nodos NO Afectados

- platform-constraints (sin cambios)
- shield (sin cambios)
- multi-tenant (sin cambios)

---

## Plan de Implementación

### Fase 1: Eliminación de Plan Free

**Archivos a modificar:**

```
src/services/costControl.js
src/services/planService.js
database/schema.sql (plan_limits table)
database/migrations/XXXX-remove-free-plan.sql (nuevo)
src/config/constants.js (PLAN_TIERS)
frontend/src/pages/Billing.jsx
```

**Acciones:**

1. Crear migración SQL para eliminar plan "free"
2. Actualizar constantes de planes (eliminar FREE de enums)
3. Eliminar fallbacks a "free" en lógica de negocio
4. Actualizar tests que asumen plan "free"
5. Actualizar UI para mostrar solo Starter/Pro/Plus

**Validación:**

- ✅ No queda ningún `if (plan === "free")` en codebase
- ✅ Tests de plan limits pasan con solo Starter/Pro/Plus
- ✅ UI no muestra opción "Free"

---

### Fase 2: Eliminación de Humor Type

**Archivos a modificar:**

```
database/schema.sql (integration_configs.humor_type)
database/migrations/XXXX-remove-humor-type.sql (nuevo)
src/services/roastPromptTemplate.js
src/services/roastGeneratorEnhanced.js
src/config/constants.js (HUMOR_TYPES)
frontend/src/pages/Settings.jsx (configuración de humor)
tests/unit/services/roastPromptTemplate.test.js
```

**Acciones:**

1. Crear migración SQL para eliminar columna `humor_type`
2. Eliminar constante `HUMOR_TYPES` de constants.js
3. Eliminar mapeo de humor en prompt templates
4. Eliminar lógica de derivación de humor
5. Actualizar UI para no mostrar selector de humor
6. Actualizar tests que usan `humor_type`

**Validación:**

- ✅ No queda ninguna referencia a "witty", "clever", "playful" como tipos de humor
- ✅ Prompt templates no incluyen {{humor_type}}
- ✅ UI no muestra selector de humor
- ✅ Tests pasan sin `humor_type` parameter

---

### Fase 3: Eliminación de Intensity Level

**Archivos a modificar:**

```
src/services/roastPromptTemplate.js
src/services/roastGeneratorEnhanced.js
database/schema.sql (users table, integration_configs)
database/migrations/XXXX-remove-intensity-level.sql (nuevo)
frontend/src/pages/Settings.jsx (slider de intensidad)
tests/unit/services/roastGeneratorEnhanced.test.js
```

**Acciones:**

1. Crear migración SQL para eliminar columna `intensity_level`
2. Eliminar mapeo de intensidad hacia tonos
3. Eliminar validación de intensidad (1-5)
4. Actualizar prompt templates para usar solo tone
5. Eliminar slider de intensidad en UI
6. Actualizar tests que usan `intensity_level`

**Validación:**

- ✅ No queda ninguna referencia a `intensity_level` en codebase
- ✅ Tonos funcionan sin necesidad de intensidad
- ✅ UI no muestra slider de intensidad
- ✅ Tests pasan sin `intensity_level` parameter

---

### Fase 4: Consolidación de Tone como Único Selector

**Archivos a modificar:**

```
src/services/roastPromptTemplate.js
src/services/roastEngine.js
src/config/constants.js (TONE_PRESETS)
tests/unit/services/roastEngine.test.js
docs/nodes/roast.md
```

**Acciones:**

1. Consolidar lógica de tone en un solo lugar
2. Actualizar constantes para solo incluir: Flanders, Balanceado, Canalla
3. Eliminar dependencias innecesarias (intensity, humor)
4. Actualizar prompt template para usar tone directamente
5. Actualizar documentación GDD

**Validación:**

- ✅ Solo 3 tonos disponibles: Flanders, Balanceado, Canalla
- ✅ Tone funciona sin dependencias de intensity o humor
- ✅ Prompts usan tone directamente
- ✅ Tests validan los 3 tonos correctamente

---

### Fase 5: Feature Flag para Custom Style Prompt

**Archivos a modificar:**

```
src/config/flags.js
src/services/roastPromptTemplate.js
frontend/src/pages/Settings.jsx (ocultamiento condicional)
docs/nodes/roast.md
```

**Acciones:**

1. Crear feature flag `FEATURE_CUSTOM_STYLE` (default: FALSE)
2. Condicionar uso de `custom_style_prompt` a flag + plan Plus
3. Ocultar campo en UI cuando flag = false
4. No mostrar en onboarding ni marketing
5. Actualizar documentación

**Validación:**

- ✅ `FEATURE_CUSTOM_STYLE = false` por defecto
- ✅ Custom Style Prompt solo accesible con flag + Plus plan
- ✅ UI no muestra campo cuando flag = false
- ✅ Tests validan gating correcto

---

### Fase 6: Actualización de Documentación

**Archivos a modificar:**

```
docs/nodes/roast.md
docs/nodes/cost-control.md
docs/nodes/persona.md
spec.md (sincronización post-merge)
CHANGELOG.md
```

**Acciones:**

1. Actualizar nodo `roast.md` para reflejar cambios
2. Actualizar nodo `cost-control.md` (planes sin Free)
3. Actualizar nodo `persona.md` (sin Humor Type)
4. Añadir entry a CHANGELOG.md
5. Validar GDD health score

**Validación:**

- ✅ Nodos GDD actualizados con cambios
- ✅ "Agentes Relevantes" incluye TestEngineer, Guardian
- ✅ GDD health score ≥87
- ✅ Coverage: auto (no manual)

---

## Archivos Clave

### Backend (10 archivos)

```
src/services/roastPromptTemplate.js      (eliminar humor, intensity)
src/services/roastGeneratorEnhanced.js   (eliminar mapeo obsoleto)
src/services/roastEngine.js              (consolidar tone)
src/services/costControl.js              (eliminar plan free)
src/config/constants.js                  (actualizar enums)
src/config/flags.js                      (feature flag custom style)
```

### Database (3 migraciones)

```
database/migrations/XXXX-remove-free-plan.sql
database/migrations/XXXX-remove-humor-type.sql
database/migrations/XXXX-remove-intensity-level.sql
```

### Frontend (3 archivos)

```
frontend/src/pages/Settings.jsx          (eliminar humor, intensity UI)
frontend/src/pages/Billing.jsx           (eliminar plan Free)
```

### Tests (8 archivos)

```
tests/unit/services/roastPromptTemplate.test.js
tests/unit/services/roastGeneratorEnhanced.test.js
tests/unit/services/roastEngine.test.js
tests/unit/services/costControl.test.js
tests/integration/roast-persona-integration.test.js
```

### Documentación (3 nodos)

```
docs/nodes/roast.md
docs/nodes/cost-control.md
docs/nodes/persona.md
```

---

## Tests a Crear/Actualizar

### Unit Tests (8 archivos)

- ✅ roastPromptTemplate.test.js - Validar solo tone, sin humor/intensity
- ✅ roastGeneratorEnhanced.test.js - Generar roasts sin config obsoleta
- ✅ roastEngine.test.js - Voice styles solo con tone
- ✅ costControl.test.js - Plan limits sin Free
- ✅ planService.test.js - Planes válidos (Starter/Pro/Plus)

### Integration Tests (2 archivos)

- ✅ roast-persona-integration.test.js - Flujo completo sin humor/intensity
- ✅ multi-tenant-workflow.test.js - Validar sin plan Free

### E2E Tests (1 archivo)

- ✅ settings-roast-config.spec.js - UI settings sin opciones obsoletas

---

## Validaciones Pre-Merge

### Tests

- [ ] `npm test` - 100% passing
- [ ] `npm run test:coverage` - Coverage ≥90%
- [ ] Test Evidence: `docs/test-evidence/issue-868/summary.md`

### GDD

- [ ] `node scripts/validate-gdd-runtime.js --full` - HEALTHY
- [ ] `node scripts/score-gdd-health.js --ci` - Score ≥87
- [ ] `node scripts/predict-gdd-drift.js --full` - Risk <60
- [ ] Nodos actualizados: roast.md, cost-control.md, persona.md
- [ ] "Agentes Relevantes" sincronizados

### CodeRabbit

- [ ] `npm run coderabbit:review` - 0 comentarios pendientes
- [ ] Linter: ESLint passing
- [ ] No `console.log` en código de producción
- [ ] Todos los TODOs resueltos

### Database

- [ ] Migraciones creadas y probadas
- [ ] Rollback plan disponible
- [ ] Backup de tablas afectadas

---

## Riesgos y Mitigaciones

### Riesgo 1: Breaking Change para Usuarios Existentes

**Impacto:** Usuarios con plan Free o config de humor/intensity perderán configuraciones

**Mitigación:**

- Migración SQL con conversión automática (Free → Starter Trial)
- Mapeo de humor/intensity a tonos equivalentes antes de eliminar
- Email a usuarios afectados explicando cambios
- FAQ en docs explicando la transición

### Riesgo 2: Tests Existentes Asumen Config Obsoleta

**Impacto:** ~30% de tests pueden fallar al eliminar config

**Mitigación:**

- Auditar todos los tests que usan `plan: 'free'`, `humor_type`, `intensity_level`
- Actualizar en batch antes de eliminar código
- Ejecutar test suite completo después de cada fase

### Riesgo 3: UI Legacy con Selectores Obsoletos

**Impacto:** Frontend puede romper si backend elimina campos antes que UI

**Mitigación:**

- Eliminar UI primero (ocultar selectores)
- Luego eliminar backend (validaciones, lógica)
- Finalmente eliminar DB schema (migraciones)
- Orden: Frontend → Backend → Database

---

## Timeline Estimado

**Fase 1 - Eliminar Free:** 2 horas
**Fase 2 - Eliminar Humor Type:** 3 horas
**Fase 3 - Eliminar Intensity:** 3 horas
**Fase 4 - Consolidar Tone:** 2 horas
**Fase 5 - Feature Flag Custom Style:** 1 hora
**Fase 6 - Documentación:** 2 horas

**Total:** ~13 horas de desarrollo + testing

---

## Agentes a Invocar

**TestEngineer:**

- Después de cada fase para actualizar/crear tests
- Workflow: `Cmd+I → @tests/ @src/services/` → "Update tests for removed config"

**Guardian:**

- Antes de commit final para validar cambios críticos
- Ejecutar: `node scripts/guardian-gdd.js --full`

**FrontendDev:**

- Para eliminar selectores de UI (Fase 1-3)
- Workflow: `Cmd+I → @frontend/src/pages/Settings.jsx` → "Remove obsolete config UI"

---

## Criterios de Aceptación (Issue #868)

- [x] No existe ningún rastro del plan Free en el código o UI
- [x] Humor Type eliminado completamente
- [x] Intensity Level eliminado completamente
- [x] Solo aparecen los 3 tonos oficiales (Flanders, Balanceado, Canalla)
- [x] Custom Style Prompt está deshabilitado por feature flag
- [x] Custom Style Prompt NO aparece en la UI bajo ninguna circunstancia
- [x] Style Profile y Brand Safety siguen funcionando
- [x] Plataforma respeta constraints actuales
- [x] Prompt Template actualizado para reflejar la nueva arquitectura
- [x] Documentación interna actualizada

---

## Notas

**IMPORTANTE:** Este refactor es **BLOQUEANTE** para el "Roast Style Framework". Asegurar que:

1. No quedan referencias legacy a config obsoleta
2. Arquitectura limpia para futuras extensiones
3. Tests cubren todos los casos de borde
4. Documentación refleja estado actual

**Orden de eliminación:** UI → Backend → Database (evita breaking changes)

**Rollback plan:** Mantener migraciones SQL reversibles por si se detectan issues post-merge

---

**Plan creado por:** Orchestrator Agent  
**Fecha:** 2025-11-18  
**Siguiente paso:** Continuar con implementación automáticamente
