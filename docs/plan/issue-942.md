# Plan de Implementación - Issue #942

**Título:** Migrar endpoints de Persona a Zod (P0 - Crítico)
**Prioridad:** 🟥 P0 - Crítico
**Labels:** enhancement, high-priority, backend, Security
**Fecha:** 2025-11-23

---

## Estado Actual

### Validación Existente (express-validator)

**Archivo:** `src/routes/persona.js` (líneas 16, 24-45, 136-147)

**Campos validados actualmente:**
- `lo_que_me_define` - Optional, string, max 300 chars, escaped
- `lo_que_no_tolero` - Optional, string, max 300 chars, escaped
- `lo_que_me_da_igual` - Optional, string, max 300 chars, escaped

**Endpoints afectados:**
- `POST /api/persona` - Validación con `validatePersonaInput` middleware
- `PUT /api/persona` - No existe actualmente (POST hace create/update)
- `PATCH /api/persona` - No existe actualmente

**Formato de error actual (express-validator):**
```javascript
{
  success: false,
  errors: [
    {
      msg: "lo_que_me_define must be a string",
      param: "lo_que_me_define",
      location: "body"
    }
  ],
  code: "VALIDATION_ERROR"
}
```

### Por Qué Esta Migración es P0

1. **Datos sensibles encriptados** - Mala validación → datos corruptos → embeddings inválidos
2. **Sistema de persona es crítico** - Afecta generación de roasts personalizada (Issue #595, #615)
3. **GDPR compliance** - Datos personales requieren validación estricta
4. **AES-256-GCM encryption** - Input malformado puede romper encriptación
5. **OpenAI embeddings** - Genera embeddings semánticos, input inválido → embeddings inútiles

---

## Objetivo

Migrar validación de express-validator a Zod manteniendo:
- ✅ Formato de API contracts consistente (sin breaking changes)
- ✅ Mensajes de error comprensibles para frontend
- ✅ Validación profunda de tipos y constraints
- ✅ Seguridad mejorada (sanitization, length limits, XSS protection)

---

## Pasos de Implementación

### 1. Crear Esquemas Zod (src/validators/zod/persona.schema.js)

**Esquemas a crear:**
- `personaFieldSchema` - Schema base para cada campo (string, trim, max 300)
- `createPersonaSchema` - Schema para POST (at least 1 field required)
- `updatePersonaSchema` - Schema para PATCH (partial, at least 1 field)

**Validaciones a incluir:**
- `z.string()` - Tipo string obligatorio
- `.trim()` - Remover espacios
- `.min(1, { message: "Field cannot be empty" })` - No vacío si presente
- `.max(300, { message: "Field must be 300 characters or less" })` - Límite tamaño
- `.refine()` - Validaciones custom (XSS detection, character blacklist)

**Ejemplo estructura:**
```javascript
const { z } = require('zod');

const personaFieldSchema = z.string()
  .trim()
  .min(1, { message: "Field cannot be empty" })
  .max(300, { message: "Field must be 300 characters or less" })
  .refine(
    (val) => !/<script|javascript:|onerror=/i.test(val),
    { message: "Field contains potentially unsafe content" }
  );

const createPersonaSchema = z.object({
  lo_que_me_define: personaFieldSchema.optional(),
  lo_que_no_tolero: personaFieldSchema.optional(),
  lo_que_me_da_igual: personaFieldSchema.optional()
}).refine(
  (data) => data.lo_que_me_define || data.lo_que_no_tolero || data.lo_que_me_da_igual,
  { message: "At least one persona field must be provided" }
);
```

### 2. Crear Helper de Formateo de Errores (src/validators/zod/formatZodError.js)

**Propósito:** Convertir errores de Zod al formato consistente de la API

**Input (Zod error):**
```javascript
{
  issues: [
    {
      code: "too_big",
      maximum: 300,
      path: ["lo_que_me_define"],
      message: "Field must be 300 characters or less"
    }
  ]
}
```

**Output (formato API):**
```javascript
{
  success: false,
  errors: [
    {
      field: "lo_que_me_define",
      message: "Field must be 300 characters or less",
      code: "TOO_BIG"
    }
  ],
  code: "VALIDATION_ERROR"
}
```

**Estructura del helper:**
```javascript
function formatZodError(zodError) {
  return {
    success: false,
    errors: zodError.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code.toUpperCase()
    })),
    code: 'VALIDATION_ERROR'
  };
}
```

### 3. Migrar POST /api/persona

**Cambios en src/routes/persona.js:**
- Remover `const { body, validationResult } = require('express-validator');`
- Remover `validatePersonaInput` middleware (líneas 24-45)
- Añadir `const { createPersonaSchema } = require('../validators/zod/persona.schema');`
- Añadir `const { formatZodError } = require('../validators/zod/formatZodError');`
- Reemplazar validación en handler POST (líneas 139-147):

**Antes:**
```javascript
const errors = validationResult(req);
if (!errors.isEmpty()) {
  return res.status(400).json({
    success: false,
    errors: errors.array(),
    code: 'VALIDATION_ERROR'
  });
}
```

**Después:**
```javascript
try {
  const validatedData = createPersonaSchema.parse(req.body);
  // Continue with validated data...
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json(formatZodError(error));
  }
  throw error; // Re-throw non-Zod errors
}
```

### 4. Tests Unitarios (tests/unit/validators/persona.schema.test.js)

**Test cases a cubrir:**
- ✅ Valid persona data (1 field, 2 fields, 3 fields)
- ✅ Invalid: empty strings
- ✅ Invalid: exceeds 300 characters
- ✅ Invalid: XSS attempts (`<script>`, `javascript:`, `onerror=`)
- ✅ Invalid: all fields missing
- ✅ Edge case: exactly 300 characters (valid)
- ✅ Edge case: 301 characters (invalid)
- ✅ Trim whitespace correctly

**Estructura:**
```javascript
describe('Persona Zod Schema', () => {
  describe('createPersonaSchema', () => {
    it('should validate with one field provided', () => {
      const input = { lo_que_me_define: 'Soy developer' };
      expect(() => createPersonaSchema.parse(input)).not.toThrow();
    });

    it('should reject empty field', () => {
      const input = { lo_que_me_define: '   ' };
      expect(() => createPersonaSchema.parse(input)).toThrow();
    });

    it('should reject field exceeding 300 chars', () => {
      const input = { lo_que_me_define: 'a'.repeat(301) };
      expect(() => createPersonaSchema.parse(input)).toThrow();
    });

    it('should detect XSS attempts', () => {
      const input = { lo_que_me_define: '<script>alert(1)</script>' };
      expect(() => createPersonaSchema.parse(input)).toThrow();
    });

    it('should require at least one field', () => {
      const input = {};
      expect(() => createPersonaSchema.parse(input)).toThrow();
    });
  });
});
```

### 5. Tests de Integración (tests/integration/persona-api-zod.test.js)

**Test cases a cubrir:**
- ✅ POST /api/persona con datos válidos → 200
- ✅ POST /api/persona con campo vacío → 400 + error message
- ✅ POST /api/persona con campo demasiado largo → 400 + error message
- ✅ POST /api/persona sin fields → 400 + error message
- ✅ POST /api/persona con XSS attempt → 400 + error message
- ✅ Verificar formato de error consistente con API contracts

**Estructura:**
```javascript
describe('POST /api/persona with Zod validation', () => {
  it('should accept valid persona data', async () => {
    const response = await request(app)
      .post('/api/persona')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ lo_que_me_define: 'Developer sarcástico' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject empty field with proper error format', async () => {
    const response = await request(app)
      .post('/api/persona')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ lo_que_me_define: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors[0].field).toBe('lo_que_me_define');
  });
});
```

---

## Archivos Afectados

**Nuevos archivos:**
- `src/validators/zod/persona.schema.js` - Esquemas Zod
- `src/validators/zod/formatZodError.js` - Helper de formateo (si no existe)
- `tests/unit/validators/persona.schema.test.js` - Tests unitarios

**Archivos modificados:**
- `src/routes/persona.js` - Remover express-validator, añadir Zod
- `tests/integration/persona-api.test.js` - Actualizar tests (si es necesario)
- `package.json` - Verificar Zod instalado (ya está según issue)

**Archivos a NO modificar:**
- `src/services/PersonaService.js` - La lógica de negocio NO cambia
- `database/schema.sql` - La estructura de DB NO cambia

---

## Validación Pre-Merge

### Tests
- [ ] `npm test -- tests/unit/validators/persona.schema.test.js` - 100% passing
- [ ] `npm test -- tests/integration/persona-api.test.js` - 100% passing
- [ ] `npm test -- tests/unit/routes/persona.test.js` - 100% passing (si existe)
- [ ] `npm run test:coverage` - Coverage ≥90%

### Code Quality
- [ ] `npm run coderabbit:review` - 0 comentarios
- [ ] Sin console.logs en código de producción
- [ ] JSDoc añadido a funciones nuevas
- [ ] logger.js usado en lugar de console

### GDD
- [ ] `node scripts/validate-gdd-runtime.js --full` - HEALTHY
- [ ] `node scripts/score-gdd-health.js --ci` - ≥87
- [ ] Nodo `persona.md` actualizado con "Agentes Relevantes"
- [ ] Coverage Source: auto (NO manual)

### Seguridad
- [ ] Sin credenciales hardcoded
- [ ] Validación XSS funciona correctamente
- [ ] Character limits enforced
- [ ] Error messages no exponen información sensible

---

## Agentes Involucrados

**Triggers identificados:**
- **TestEngineer** - Tests unitarios + integración (obligatorio para cambios en src/)
- **Guardian** - Audit de seguridad (datos sensibles + validación)
- **TaskAssessor** - AC ≥3 (6 AC en esta issue) + P0 (SKIPPED - ya con plan inline)

**Receipts esperados:**
- `docs/agents/receipts/cursor-test-engineer-[timestamp].md`
- `docs/agents/receipts/cursor-guardian-[timestamp].md`
- `docs/agents/receipts/cursor-task-assessor-SKIPPED-[timestamp].md` (plan inline ya creado)

---

## Riesgos y Mitigaciones

### Riesgo 1: Breaking changes en formato de error

**Mitigación:**
- Helper `formatZodError` mantiene formato idéntico al actual
- Tests de integración verifican formato de respuesta
- Frontend no debería requerir cambios

### Riesgo 2: Validaciones más estrictas rompan casos existentes

**Mitigación:**
- Revisar datos existentes en DB para patrones comunes
- XSS refine es advisory, no bloqueante total (puede ajustarse)
- Tests con datos reales del sistema

### Riesgo 3: Performance de Zod vs express-validator

**Mitigación:**
- Zod es más rápido que express-validator en benchmarks
- Validación ocurre pre-encryption, no es bottleneck
- Monitorizar latencia post-deploy (debe ser igual o mejor)

---

## Referencias

- **Issue #595** - Persona encryption system (implementación original)
- **Issue #615** - Persona-Roast Integration
- **Nodo GDD:** `docs/nodes/persona.md`
- **Zod docs:** https://zod.dev/
- **API Contracts:** `docs/plan/issue-595.md`

---

**Creado por:** Orchestrator (Cursor)
**Fecha:** 2025-11-23
**Status:** ✅ Plan completo → Proceder a implementación

