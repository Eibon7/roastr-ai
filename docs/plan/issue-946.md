# Plan de Implementación - Issue #946

**Título:** Migrar endpoint de Roast Creation a Zod (P2 - Conveniente)

**Prioridad:** 🟨 P2 - Conveniente

**Labels:** enhancement, backend, tech-debt, low-priority

**Fecha:** 2025-11-23

---

## Estado Actual

El endpoint `POST /api/roast` actualmente usa validación manual inline con funciones como `validateRoastRequest()` y constantes de validación importadas de `validationConstants.js`.

**Validación actual:**

- Función `validateRoastRequest()` con checks manuales
- Constantes en `src/config/validationConstants.js`
- No usa express-validator realmente (comentario en issue es histórico)
- Validación dispersa a lo largo del endpoint

**Problemas actuales:**

- Validación manual propensa a errores
- No hay type safety
- Mensajes de error genéricos
- Código repetitivo en múltiples endpoints
- Difícil de mantener cuando se añaden nuevos campos

---

## Objetivos

1. ✅ Migrar validación a Zod (esquemas declarativos)
2. ✅ Mejorar mensajes de error (específicos y útiles)
3. ✅ Eliminar código de validación manual
4. ✅ Mantener 100% compatibilidad con API contracts
5. ✅ Tests 100% passing con ≥90% coverage

---

## Pasos de Implementación

### 1. Crear Esquemas Zod (`src/validators/zod/roast.schema.js`)

**Archivos a crear:**

- `src/validators/zod/roast.schema.js`

**Contenido:**

```javascript
const { z } = require('zod');
const { VALIDATION_CONSTANTS } = require('../../config/validationConstants');

// Esquema base para validación de texto
const textSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.MIN_COMMENT_LENGTH, 'Text cannot be empty')
  .max(
    VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH,
    `Text must be less than ${VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH} characters`
  )
  .trim();

// Esquema para tone (enum)
const toneSchema = z.enum(VALIDATION_CONSTANTS.VALID_TONES, {
  errorMap: () => ({
    message: `Tone must be one of: ${VALIDATION_CONSTANTS.VALID_TONES.join(', ')}`
  })
});

// Esquema para platform (enum)
const platformSchema = z.enum(VALIDATION_CONSTANTS.VALID_PLATFORMS, {
  errorMap: () => ({
    message: `Platform must be one of: ${VALIDATION_CONSTANTS.VALID_PLATFORMS.join(', ')}`
  })
});

// Esquema para styleProfile (objeto opcional)
const styleProfileSchema = z.object({}).passthrough().optional();

// Esquema para persona (string opcional)
const personaSchema = z.string().optional();

// Esquema completo para POST /api/roast/preview
const roastPreviewSchema = z.object({
  text: textSchema,
  tone: toneSchema.default('balanceado'),
  styleProfile: styleProfileSchema,
  persona: personaSchema,
  platform: platformSchema.default('twitter')
});

// Esquema para POST /api/roast/generate
const roastGenerateSchema = z.object({
  text: textSchema,
  tone: toneSchema.default('balanceado')
});

// Esquema para POST /api/roast/engine
const roastEngineSchema = z.object({
  comment: textSchema,
  style: toneSchema.default('balanceado'),
  language: z.enum(VALIDATION_CONSTANTS.VALID_LANGUAGES).default('es'),
  autoApprove: z.boolean().default(false),
  platform: platformSchema.default('twitter'),
  commentId: z.string().optional().nullable()
});

// Esquema para POST /api/roast/:id/validate
const roastValidateSchema = z.object({
  text: textSchema,
  platform: platformSchema.default('twitter')
});

module.exports = {
  roastPreviewSchema,
  roastGenerateSchema,
  roastEngineSchema,
  roastValidateSchema
};
```

### 2. Crear Middleware de Validación Zod (`src/middleware/zodValidation.js`)

**Archivos a crear:**

- `src/middleware/zodValidation.js`

**Contenido:**

```javascript
const { logger } = require('../utils/logger');

/**
 * Middleware para validar request body con esquemas Zod
 * @param {ZodSchema} schema - Esquema Zod a aplicar
 * @returns {Function} Express middleware
 */
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      // Validar y parsear el body con Zod
      const parsed = schema.parse(req.body);

      // Reemplazar req.body con el resultado parseado (con defaults aplicados)
      req.body = parsed;

      next();
    } catch (error) {
      // Zod error - formatear para el cliente
      if (error.name === 'ZodError') {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        logger.warn('Zod validation failed', {
          errors: formattedErrors,
          endpoint: req.path,
          userId: req.user?.id
        });

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors,
          timestamp: new Date().toISOString()
        });
      }

      // Error inesperado
      logger.error('Unexpected validation error', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: 'Validation error',
        timestamp: new Date().toISOString()
      });
    }
  };
}

module.exports = { validateRequest };
```

### 3. Actualizar `src/routes/roast.js`

**Cambios:**

1. Importar esquemas Zod y middleware:

```javascript
const { validateRequest } = require('../middleware/zodValidation');
const {
  roastPreviewSchema,
  roastGenerateSchema,
  roastEngineSchema,
  roastValidateSchema
} = require('../validators/zod/roast.schema');
```

2. Eliminar función `validateRoastRequest()` (líneas 115-150)

3. Eliminar función `validateRoastEngineRequest()` (líneas 1038-1082)

4. Aplicar middleware Zod a cada endpoint:

```javascript
// POST /api/roast/preview
router.post(
  '/preview',
  authenticateToken,
  roastRateLimit,
  validateRequest(roastPreviewSchema),
  async (req, res) => {
    // Eliminar líneas 434-443 (validación manual)
    // El body ya está validado y parseado
  }
);

// POST /api/roast/generate
router.post(
  '/generate',
  authenticateToken,
  roastRateLimit,
  validateRequest(roastGenerateSchema),
  async (req, res) => {
    // Eliminar líneas 633-642 (validación manual)
  }
);

// POST /api/roast/engine
router.post(
  '/engine',
  authenticateToken,
  roastRateLimit,
  validateRequest(roastEngineSchema),
  async (req, res) => {
    // Eliminar líneas 832-840 (validación manual)
  }
);

// POST /api/roast/:id/validate
router.post(
  '/:id/validate',
  authenticateToken,
  roastRateLimit,
  validateRequest(roastValidateSchema),
  async (req, res) => {
    // Eliminar líneas 1210-1216 (validación manual de text)
    // Mantener validación de roastId (línea 1217-1224) - es de params, no body
  }
);
```

### 4. Tests Unitarios

**Archivos a crear:**

- `tests/unit/validators/zod/roast.schema.test.js`
- `tests/unit/middleware/zodValidation.test.js`

**Tests para `roast.schema.test.js`:**

- [ ] Validación de text: mínimo, máximo, trim
- [ ] Validación de tone: valores válidos, inválidos, default
- [ ] Validación de platform: valores válidos, inválidos, default
- [ ] Validación de styleProfile: objeto válido, null, undefined
- [ ] Validación de persona: string válido, null, undefined
- [ ] Esquemas completos: preview, generate, engine, validate

**Tests para `zodValidation.test.js`:**

- [ ] Middleware valida correctamente
- [ ] Middleware aplica defaults
- [ ] Middleware formatea errores Zod
- [ ] Middleware maneja errores inesperados
- [ ] Middleware reemplaza req.body con parsed

### 5. Tests de Integración

**Archivos a actualizar:**

- `tests/integration/roast.test.js`

**Tests a verificar:**

- [ ] POST /preview con datos válidos (200)
- [ ] POST /preview con text vacío (400)
- [ ] POST /preview con text demasiado largo (400)
- [ ] POST /preview con tone inválido (400)
- [ ] POST /preview con platform inválido (400)
- [ ] POST /generate con datos válidos (200)
- [ ] POST /generate con validación fallida (400)
- [ ] POST /engine con datos válidos (200)
- [ ] POST /engine con validación fallida (400)
- [ ] POST /:id/validate con datos válidos (200)
- [ ] POST /:id/validate con validación fallida (400)

**Verificar:**

- Formato de error consistente con Zod
- Mensajes de error específicos y útiles
- Defaults aplicados correctamente
- No breaking changes en respuestas

---

## Archivos Afectados

### Nuevos

- `src/validators/zod/roast.schema.js` ✨
- `src/middleware/zodValidation.js` ✨
- `tests/unit/validators/zod/roast.schema.test.js` ✨
- `tests/unit/middleware/zodValidation.test.js` ✨

### Modificados

- `src/routes/roast.js` (eliminar validación manual, añadir middleware Zod)
- `tests/integration/roast.test.js` (verificar formato de errores Zod)

### Sin cambios

- `src/config/validationConstants.js` (se sigue usando como fuente de verdad)

---

## Validación de Completitud

### Tests

- [ ] `npm test -- tests/unit/validators/zod/roast.schema.test.js` (100% passing)
- [ ] `npm test -- tests/unit/middleware/zodValidation.test.js` (100% passing)
- [ ] `npm test -- tests/integration/roast.test.js` (100% passing)
- [ ] `npm run test:coverage` (≥90% coverage)

### API Contracts

- [ ] POST /preview: respuesta idéntica a antes
- [ ] POST /generate: respuesta idéntica a antes
- [ ] POST /engine: respuesta idéntica a antes
- [ ] POST /:id/validate: respuesta idéntica a antes
- [ ] Formato de errores: `{ success: false, error: string, details: array, timestamp: string }`

### Documentación

- [ ] Actualizar nodo `roast.md` con nueva validación Zod
- [ ] Añadir ejemplo de uso en `roast.md`
- [ ] Actualizar changelog con migración

### GDD

- [ ] Ejecutar `node scripts/validate-gdd-runtime.js --full` (HEALTHY)
- [ ] Ejecutar `node scripts/score-gdd-health.js --ci` (≥87)
- [ ] Coverage Source: `auto` en nodo roast.md

---

## Agentes Relevantes

- **Backend Developer** - Implementación de esquemas Zod y middleware
- **Test Engineer** - Generación de tests unitarios e integración
- **Guardian** - Validación de no breaking changes en API contracts
- **Orchestrator** - Coordinación y documentación

---

## Riesgos y Mitigaciones

### Riesgo 1: Breaking changes en API

**Mitigación:** Mantener formato de respuesta idéntico, tests de integración exhaustivos

### Riesgo 2: Mensajes de error diferentes

**Mitigación:** Mapear errores Zod a formato existente, verificar con tests

### Riesgo 3: Defaults no aplicados

**Mitigación:** Tests específicos para defaults (tone, platform, language)

---

## Criterios de Éxito

✅ **AC1:** Endpoint de roast usa Zod
✅ **AC2:** express-validator eliminado (en realidad, validación manual eliminada)
✅ **AC3:** Tests pasando al 100%
✅ **AC4:** Validación mejorada de inputs
✅ **AC5:** No breaking changes en API contracts

**Meta de calidad:**

- Tests: 100% passing (0 failing)
- Coverage: ≥90%
- GDD Health: ≥87
- CodeRabbit: 0 comentarios

---

**Estado:** 📝 Planning Complete - Ready for Implementation

**Siguiente paso:** Implementar esquemas Zod + middleware
