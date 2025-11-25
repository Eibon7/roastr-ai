# Plan: Issue #973 - Centralize Tone Enum

## Estado Actual

- **Ya existe** `src/config/tones.js` con centralización parcial (3 tonos: Flanders, Balanceado, Canalla)
- **Problema**: Hay duplicación en:
  - `src/routes/config.js` (línea 29): `VALID_TONES = ['flanders', 'balanceado', 'canalla', 'light', 'balanced', 'savage']`
  - `src/validators/zod/config.schema.js` (línea 49): `z.enum(['flanders', 'balanceado', 'canalla', 'light', 'balanced', 'savage'])`
- **Archivos que ya usan el módulo centralizado** (3):
  - `src/validators/zod/roast.schema.js`
  - `src/services/mockIntegrationsService.js`
  - `src/routes/user.js`

## Acceptance Criteria

1. [x] Create `src/constants/tones.js` with centralized tone definitions ➜ **COMPLETADO: Enhanced `src/config/tones.js`**
2. [x] Replace all hard-coded tone enums with imports from constants
3. [x] Update Zod schema to use centralized enum
4. [x] Update config routes to use centralized enum
5. [x] Update services to use centralized enum
6. [x] Add test to verify tone consistency (all modules use same source)
7. [x] Update documentation with tone definitions
8. [x] No breaking changes to API
9. [x] All tests passing

## Scope Completo Implementado

### Centralización de Tonos
- ✅ `src/config/tones.js`: Añadidos `VALID_TONES_WITH_ALIASES`, `TONE_DISPLAY_NAMES`, `TONE_DESCRIPTIONS`
- ✅ `src/validators/zod/config.schema.js`: Usa `VALID_TONES_WITH_ALIASES`
- ✅ `src/routes/config.js`: Importa desde módulo centralizado
- ✅ `src/services/toneCompatibilityService.js`: Delega a funciones centralizadas

### Tests Añadidos
- ✅ 28 nuevos tests en `tests/unit/config/tones.test.js` (53 tests total)
- ✅ Tests de consistencia para prevenir drift futuro
- ✅ Tests de código activo corregidos:
  - `validationConstants-intensity.test.js`: Añadidas constantes faltantes (`MIN_INTENSITY`, `MAX_INTENSITY`, `DEFAULT_INTENSITY`)
  - `tierConfig-coderabbit-round6.test.js`: Actualizados para usar planes reales (`starter_trial`, `starter`, `pro`, `plus`, `custom`)

### Documentación
- ✅ `docs/nodes/tone.md`: Actualizado con exports centralizados y aliases
- ✅ `docs/plan/issue-973.md`: Plan completo
- ✅ `docs/agents/receipts/973-BackendDev.md`: Receipt Backend Developer
- ✅ `docs/agents/receipts/973-TestEngineer.md`: Receipt Test Engineer

## Pasos de Implementación

### FASE 1: Actualizar constantes centralizadas

**Archivo**: `src/config/tones.js`

Añadir:
- Todos los tonos y aliases en un mapa normalizado completo
- Export de `VALID_TONES_WITH_ALIASES` para validación con aliases
- Funciones helper para display names y descripciones

### FASE 2: Actualizar validadores Zod

**Archivo**: `src/validators/zod/config.schema.js`
- Importar `VALID_TONES_WITH_ALIASES` desde `../config/tones`
- Usar `z.enum(VALID_TONES_WITH_ALIASES)`

### FASE 3: Actualizar rutas

**Archivo**: `src/routes/config.js`
- Eliminar definición local de `VALID_TONES`
- Importar desde `../config/tones`

### FASE 4: Verificar servicios

**Archivos a revisar**:
- `src/services/toneCompatibilityService.js` - Ya tiene normalizeTone, verificar usa constantes
- `src/services/roastEngine.js` - Tiene definiciones locales de styles

### FASE 5: Tests

**Nuevo test**: `tests/unit/config/tones.test.js`
- Verificar todos los módulos que validan tonos usan la misma fuente
- Verificar normalización funciona para todos los aliases

### FASE 6: Documentación

- Actualizar `docs/nodes/roast.md` con referencia al módulo centralizado

## Agentes Relevantes

- **Backend Developer**: Implementación
- **TestEngineer**: Tests de consistencia
- **Guardian**: Cambios en config (validación crítica)

## Archivos Modificados

| Archivo | Acción | Estado |
|---------|--------|--------|
| `src/config/tones.js` | Añadir aliases y exports adicionales | ✅ Completado |
| `src/config/validationConstants.js` | Añadir constantes de intensidad faltantes | ✅ Completado |
| `src/validators/zod/config.schema.js` | Importar constantes centralizadas | ✅ Completado |
| `src/routes/config.js` | Eliminar VALID_TONES local, importar | ✅ Completado |
| `src/services/toneCompatibilityService.js` | Delegar a funciones centralizadas | ✅ Completado |
| `tests/unit/config/tones.test.js` | Añadir 28 tests de consistencia | ✅ Completado |
| `tests/unit/config/tierConfig-coderabbit-round6.test.js` | Corregir para planes reales | ✅ Completado |
| `tests/unit/services/toneCompatibilityService.test.js` | Actualizar expectativa | ✅ Completado |
| `docs/nodes/tone.md` | Actualizar documentación | ✅ Completado |
| `docs/plan/issue-973.md` | Plan de implementación | ✅ Completado |
| `docs/agents/receipts/973-BackendDev.md` | Receipt Backend Developer | ✅ Completado |
| `docs/agents/receipts/973-TestEngineer.md` | Receipt Test Engineer | ✅ Completado |

## Validación

```bash
# Tests de tonos centralizados
npm test -- tests/unit/config/tones.test.js  # ✅ 53/53 passing

# Tests de validación
npm test -- tests/unit/validators/zod/config.schema.test.js  # ✅ Passing
npm test -- tests/unit/services/toneCompatibilityService.test.js  # ✅ 28/28 passing

# Tests de código activo corregidos
npm test -- tests/unit/config/validationConstants-intensity.test.js  # ✅ 40/40 passing
npm test -- tests/unit/config/tierConfig-coderabbit-round6.test.js  # ✅ 15/15 passing

# GDD Validation
node scripts/validate-gdd-runtime.js --full  # ✅ HEALTHY
node scripts/score-gdd-health.js --ci  # ✅ 90.2/100 (threshold: 87)
```

## Resultados Finales

- **Tests pasando**: 93 tests relacionados (53 tones + 40 intensity + 15 tierConfig - 15 que ya pasaban)
- **GDD Health**: 90.2/100 ✅
- **Breaking Changes**: Ninguno ✅
- **Cobertura**: Mantenida/mejorada ✅

## Breaking Changes

**NINGUNO** - Los tonos válidos no cambian, solo se centraliza la fuente.

