# Plan de Implementación - Issue #718

**Issue:** Platform Constraints Validation - Add tests for character limits and platform rules  
**Fecha:** 2025-11-16  
**Prioridad:** 🟡 MEDIA  
**Estimación:** 3-4 días

## 📋 Estado Actual

**Código existente:**

- `src/config/platforms.js` - Funciones de validación y configuración de plataformas
- `src/config/constants.js` - Límites de caracteres por plataforma (PLATFORM_LIMITS)
- `tests/unit/config/platformLimits.test.js` - Test básico (solo verifica Twitter maxLength)

**Cobertura actual:** Muy baja (solo 1 test básico)

**Funciones a testear:**

- `validateRoastForPlatform(roast, platformName)` - Validación principal
- `getPlatformLimit(platformName)` - Obtener límite de caracteres
- `getPlatformConfig(platformName)` - Obtener configuración completa
- `getPlatformStyle(platformName)` - Obtener guía de estilo
- `platformSupports(platformName, feature)` - Verificar soporte de features
- `getPreferredLength(platformName)` - Obtener longitud preferida

## 🎯 Acceptance Criteria

- [x] Tests for character limits per platform (9 plataformas)
- [ ] Validation of formatting rules (hashtags, mentions, etc.)
- [ ] Edge case testing (emoji handling, special characters)
- [ ] Tests for each of 9 platforms
- [ ] Tests ≥80% coverage
- [ ] CI integration

## 📝 Pasos de Implementación

### FASE 1: Tests de Character Limits (AC 1)

**Archivo:** `tests/unit/config/platformConstraints.test.js` (nuevo)

**Tests a implementar:**

1. `validateRoastForPlatform` - Validación básica por plataforma
   - Test para cada una de las 9 plataformas
   - Verificar límites exactos (280, 2200, 63206, etc.)
   - Verificar truncamiento cuando excede límite
   - Verificar preservación de límites de palabras

2. `getPlatformLimit` - Obtener límites
   - Test para cada plataforma
   - Test para plataforma inválida (debe retornar default)
   - Test para null/undefined

3. `getPreferredLength` - Longitud preferida
   - Test para cada plataforma
   - Verificar valores correctos (240 para Twitter, 150 para Instagram, etc.)

### FASE 2: Tests de Formatting Rules (AC 2)

**Tests a implementar:**

1. `platformSupports` - Verificar soporte de features
   - Hashtags: Twitter ✅, Instagram ✅, YouTube ✅, etc.
   - Mentions: Twitter ✅, Discord ✅, Reddit ✅, etc.
   - Emojis: Twitter ✅, Instagram ✅, TikTok ✅, etc.
   - Markdown: Discord ✅, Reddit ✅, etc.
   - Threading: Twitter ✅, Bluesky ✅, etc.

2. `getPlatformStyle` - Guías de estilo
   - Verificar tone por plataforma
   - Verificar emojiUsage (moderate, heavy, light)
   - Verificar hashtagLimit

3. `getPlatformConfig` - Configuración completa
   - Verificar estructura completa para cada plataforma
   - Verificar formatting rules (lineBreaks, bulletPoints, etc.)

### FASE 3: Edge Cases (AC 3)

**Tests a implementar:**

1. **Emoji handling:**
   - Roast con emojis que excede límite
   - Emojis en diferentes posiciones (inicio, medio, final)
   - Emojis multi-byte (UTF-8)

2. **Special characters:**
   - Hashtags (#hashtag)
   - Mentions (@username)
   - URLs (https://...)
   - Markdown (\*\*, \_, `, etc.)

3. **Boundary conditions:**
   - Texto exactamente en el límite
   - Texto 1 carácter sobre el límite
   - Texto muy por debajo del límite
   - Texto vacío
   - Texto null/undefined

4. **Invalid inputs:**
   - Plataforma inválida
   - Plataforma null/undefined
   - Roast null/undefined
   - Roast no-string

### FASE 4: Coverage y CI (AC 4, 5, 6)

**Verificaciones:**

1. Ejecutar `npm run test:coverage` y verificar ≥80% coverage
2. Verificar que todos los tests pasan
3. Verificar integración CI (tests se ejecutan automáticamente)

## 🔧 Archivos a Modificar/Crear

**Nuevos:**

- `tests/unit/config/platformConstraints.test.js` - Suite completa de tests

**Modificar:**

- `tests/unit/config/platformLimits.test.js` - Puede eliminarse o integrarse en el nuevo archivo

## 🧪 Estructura de Tests

```javascript
describe('Platform Constraints Validation', () => {
  describe('validateRoastForPlatform', () => {
    describe('Character Limits - All Platforms', () => {
      // Tests para cada una de las 9 plataformas
    });

    describe('Truncation Logic', () => {
      // Tests de truncamiento
    });

    describe('Edge Cases', () => {
      // Tests de edge cases
    });
  });

  describe('getPlatformLimit', () => {
    // Tests de límites
  });

  describe('getPlatformStyle', () => {
    // Tests de estilos
  });

  describe('platformSupports', () => {
    // Tests de features
  });

  describe('getPlatformConfig', () => {
    // Tests de configuración
  });
});
```

## ✅ Validación

**Pre-merge checklist:**

- [ ] Todos los tests pasan (`npm test`)
- [ ] Coverage ≥80% (`npm run test:coverage`)
- [ ] Tests cubren las 9 plataformas
- [ ] Tests cubren formatting rules
- [ ] Tests cubren edge cases
- [ ] CI passing
- [ ] GDD nodes actualizados (platform-constraints)

## 📊 Agentes Relevantes

- **Test Engineer** - Implementación de tests
- **Backend Developer** - Revisión de lógica de validación

## 🔗 Referencias

- Issue: #718
- Nodo GDD: `docs/nodes/platform-constraints.md`
- Código fuente: `src/config/platforms.js`
- Constantes: `src/config/constants.js`
