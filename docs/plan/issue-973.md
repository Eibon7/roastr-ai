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

1. [ ] Create `src/constants/tones.js` with centralized tone definitions ➜ **YA EXISTE como `src/config/tones.js`**
2. [ ] Replace all hard-coded tone enums with imports from constants
3. [ ] Update Zod schema to use centralized enum
4. [ ] Update config routes to use centralized enum
5. [ ] Update services to use centralized enum
6. [ ] Add test to verify tone consistency (all modules use same source)
7. [ ] Update documentation with tone definitions
8. [ ] No breaking changes to API
9. [ ] All tests passing

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

## Archivos a Modificar

| Archivo | Acción |
|---------|--------|
| `src/config/tones.js` | Añadir aliases y exports adicionales |
| `src/validators/zod/config.schema.js` | Importar constantes centralizadas |
| `src/routes/config.js` | Eliminar VALID_TONES local, importar |
| `tests/unit/config/tones.test.js` | NUEVO - Test de consistencia |
| `docs/nodes/roast.md` | Actualizar documentación |

## Validación

```bash
npm test -- tests/unit/config/tones.test.js
npm test -- tests/unit/validators/zod/config.schema.test.js
npm test -- tests/integration/config.test.js
node scripts/validate-gdd-runtime.js --full
```

## Breaking Changes

**NINGUNO** - Los tonos válidos no cambian, solo se centraliza la fuente.

