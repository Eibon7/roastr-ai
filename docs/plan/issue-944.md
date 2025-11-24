# Plan de Implementación - Issue #944

**Título:** Migrar endpoints de Toggle (Roasting/Shield) a Zod (P0 - Crítico)

**Prioridad:** 🟥 P0 - Crítico

**Fecha de creación:** 2025-11-23

**Estado:** En progreso

## Estado Actual

### Contexto

Los endpoints de toggle (`POST /api/roasting/toggle` y `POST /api/shield/toggle`) actualmente usan express-validator o validación manual. Estos endpoints son críticos porque:

1. **Cambian estado del sistema en tiempo real** - Workers dependen de estos estados
2. **Afectan procesamiento de colas** - Los valores se propagan a Redis y controlan jobs
3. **Multi-tenant crítico** - Deben validar organization_id correctamente
4. **Seguridad alta** - Valores corruptos pueden romper workers y procesamiento

### Problema

- express-validator es inconsistente con el resto del proyecto
- No hay validación de tipos estricta (boolean vs string "true")
- Falta validación de UUIDs y formatos específicos
- No hay helper centralizado para errores de validación
- Riesgo de valores inválidos propagándose a workers

### Nodos GDD Relevantes

Según auto-activación GDD:
- `shield` - POST /api/shield/toggle
- `queue-system` - Propagación a Redis y workers
- `roast` - POST /api/roasting/toggle  
- `multi-tenant` - Validación organization_id

## Análisis de Endpoints Afectados

### 1. POST /api/roasting/toggle

**Ubicación estimada:** `src/routes/roasting.js` o `src/routes/roast.js`

**Datos a validar:**
- `enabled` (boolean) - Estado on/off del roasting
- `organization_id` (UUID) - Multi-tenant isolation
- Posibles parámetros adicionales de configuración

**Impacto:** Workers de generación de roasts consultan este estado

### 2. POST /api/shield/toggle

**Ubicación estimada:** `src/routes/shield.js`

**Datos a validar:**
- `enabled` (boolean) - Estado on/off del shield
- `organization_id` (UUID) - Multi-tenant isolation
- Posibles thresholds o configuración

**Impacto:** Workers de Shield consultan este estado para moderación automática

## Pasos de Implementación

### Paso 1: Investigación y Análisis ✅

**Objetivo:** Encontrar archivos exactos y estructura actual

**Acciones:**
```bash
# Buscar archivos de rutas
grep -r "POST.*toggle" src/routes/

# Buscar validación actual
grep -r "express-validator" src/routes/roasting.js src/routes/shield.js

# Buscar uso de estado en workers
grep -r "roasting.*enabled\|shield.*enabled" src/workers/
```

**Output esperado:**
- Ruta exacta de archivos
- Validación actual (express-validator o manual)
- Cómo se consume el estado en workers

### Paso 2: Crear Esquemas Zod

**Archivo:** `src/validators/zod/toggle.schema.js`

**Esquemas a crear:**

```javascript
const { z } = require('zod');

// Esquema base para toggle
const toggleBaseSchema = z.object({
  enabled: z.boolean({
    required_error: 'enabled is required',
    invalid_type_error: 'enabled must be a boolean'
  }),
  organization_id: z.string().uuid({
    message: 'organization_id must be a valid UUID'
  })
});

// Esquema específico para roasting toggle
const roastingToggleSchema = toggleBaseSchema.extend({
  // Posibles campos adicionales después de investigación
});

// Esquema específico para shield toggle
const shieldToggleSchema = toggleBaseSchema.extend({
  // Posibles campos adicionales después de investigación
});

module.exports = {
  toggleBaseSchema,
  roastingToggleSchema,
  shieldToggleSchema
};
```

**Validaciones clave:**
- Boolean estricto (no acepta "true" string)
- UUID válido para organization_id
- Mensajes de error claros en español/inglés

### Paso 3: Crear Helper de Errores Zod

**Archivo:** `src/validators/zod/formatZodError.js`

**Propósito:** Formatear errores de Zod en formato consistente con API

```javascript
/**
 * Format Zod validation errors into API-friendly format
 * @param {import('zod').ZodError} zodError
 * @returns {Object} Formatted error response
 */
function formatZodError(zodError) {
  const errors = zodError.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));

  return {
    success: false,
    error: 'Validation failed',
    validation_errors: errors
  };
}

module.exports = { formatZodError };
```

### Paso 4: Migrar Endpoint POST /api/roasting/toggle

**Archivo:** `src/routes/roasting.js` (o el correcto después de investigación)

**Cambios:**

1. Importar esquema Zod y helper
2. Reemplazar express-validator middleware
3. Añadir validación Zod en handler
4. Mantener lógica de negocio intacta

**Estructura del handler:**

```javascript
const { roastingToggleSchema } = require('../validators/zod/toggle.schema');
const { formatZodError } = require('../validators/zod/formatZodError');

router.post('/toggle', async (req, res) => {
  try {
    // Validar con Zod
    const validated = roastingToggleSchema.parse(req.body);
    
    // Lógica de negocio existente (mantener intacta)
    // ...
    
    res.json({ success: true, data: validated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(formatZodError(error));
    }
    
    logger.error('Error toggling roasting:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### Paso 5: Migrar Endpoint POST /api/shield/toggle

**Archivo:** `src/routes/shield.js`

**Cambios:** Misma estructura que Paso 4, usando `shieldToggleSchema`

### Paso 6: Tests Unitarios

**Archivo:** `tests/unit/validators/zod/toggle.schema.test.js`

**Test cases:**

```javascript
describe('Toggle Schemas - Zod Validation', () => {
  describe('roastingToggleSchema', () => {
    it('should validate correct roasting toggle data', () => {
      const valid = {
        enabled: true,
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => roastingToggleSchema.parse(valid)).not.toThrow();
    });
    
    it('should reject non-boolean enabled', () => {
      const invalid = {
        enabled: 'true', // String instead of boolean
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => roastingToggleSchema.parse(invalid)).toThrow();
    });
    
    it('should reject invalid UUID', () => {
      const invalid = {
        enabled: true,
        organization_id: 'not-a-uuid'
      };
      
      expect(() => roastingToggleSchema.parse(invalid)).toThrow();
    });
    
    it('should reject missing organization_id', () => {
      const invalid = { enabled: true };
      
      expect(() => roastingToggleSchema.parse(invalid)).toThrow();
    });
  });
  
  describe('shieldToggleSchema', () => {
    // Mismos tests para shield
  });
});
```

**Cobertura esperada:** ≥90%

### Paso 7: Tests de Integración

**Archivo:** `tests/integration/toggle-endpoints.test.js`

**Test cases:**

```javascript
describe('Toggle Endpoints Integration', () => {
  describe('POST /api/roasting/toggle', () => {
    it('should toggle roasting with valid data', async () => {
      const response = await request(app)
        .post('/api/roasting/toggle')
        .send({
          enabled: true,
          organization_id: testOrgId
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should return 400 for invalid boolean', async () => {
      const response = await request(app)
        .post('/api/roasting/toggle')
        .send({
          enabled: 'true', // String
          organization_id: testOrgId
        });
      
      expect(response.status).toBe(400);
      expect(response.body.validation_errors).toBeDefined();
    });
    
    it('should propagate to Redis correctly', async () => {
      // Verificar que el cambio se propaga a workers
      await request(app)
        .post('/api/roasting/toggle')
        .send({ enabled: true, organization_id: testOrgId });
      
      // Verificar estado en Redis
      const redisState = await redis.get(`roasting:${testOrgId}:enabled`);
      expect(redisState).toBe('true');
    });
  });
  
  describe('POST /api/shield/toggle', () => {
    // Mismos tests para shield
  });
});
```

### Paso 8: Validación de Propagación a Workers

**Objetivo:** Asegurar que workers reciben datos válidos

**Verificaciones:**

1. **GenerateReplyWorker** consulta estado de roasting
2. **ShieldActionWorker** consulta estado de shield
3. Redis keys actualizadas correctamente
4. No breaking changes en contracts

**Archivos a verificar:**
- `src/workers/GenerateReplyWorker.js`
- `src/workers/ShieldActionWorker.js`
- `src/services/queueService.js`

## Archivos Afectados

### Nuevos
- `src/validators/zod/toggle.schema.js`
- `src/validators/zod/formatZodError.js`
- `tests/unit/validators/zod/toggle.schema.test.js`
- `tests/integration/toggle-endpoints.test.js`

### Modificados
- `src/routes/roasting.js` (o equivalente)
- `src/routes/shield.js` (o equivalente)
- Posibles ajustes en workers si consumen el estado

## Agentes a Usar

### TestEngineer
**Trigger:** Cambios en src/ requieren tests

**Workflow:**
```
Cmd+I → @tests/ @src/validators/zod/
"Generate comprehensive tests for Zod schemas following test-generation-skill"
```

**Receipt:** `docs/agents/receipts/issue-944-TestEngineer.md`

### Guardian (Opcional)
**Trigger:** Cambios en seguridad crítica (validación de inputs)

**Workflow:** Manual audit después de implementación

**Receipt:** `docs/agents/receipts/issue-944-Guardian.md` (o SKIPPED)

## Validación Requerida

### Pre-Flight Checklist

- [ ] Tests unitarios pasando al 100%
- [ ] Tests de integración pasando
- [ ] Coverage ≥90% en archivos nuevos
- [ ] No breaking changes en API contracts
- [ ] Workers reciben datos válidos (verificado con tests)
- [ ] express-validator completamente eliminado de endpoints afectados
- [ ] GDD nodes actualizados (shield, roast, queue-system)

### GDD Validations

```bash
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # Debe ≥87
```

### Test Suite

```bash
npm test -- tests/unit/validators/zod/
npm test -- tests/integration/toggle-endpoints.test.js
npm run test:coverage
```

## Acceptance Criteria (6)

- [ ] **AC1:** Todos los endpoints de toggle usan Zod
- [ ] **AC2:** express-validator eliminado de endpoints afectados
- [ ] **AC3:** Tests pasando al 100%
- [ ] **AC4:** Validación de tipos correcta (boolean, UUID, etc.)
- [ ] **AC5:** Workers reciben datos válidos (verificado)
- [ ] **AC6:** No breaking changes en API contracts

## Riesgos y Mitigación

### Riesgo 1: Breaking Changes en API
**Probabilidad:** Media  
**Impacto:** Alto  
**Mitigación:** Tests de integración exhaustivos, verificar contratos existentes

### Riesgo 2: Workers dejan de funcionar
**Probabilidad:** Baja  
**Impacto:** Crítico  
**Mitigación:** Verificar propagación a Redis, tests específicos para workers

### Riesgo 3: Tipos string "true" vs boolean true
**Probabilidad:** Alta  
**Impacto:** Medio  
**Mitigación:** Zod es estricto, tests cubren este caso, considerar coercion si necesario

## Notas de Implementación

### Consideraciones de Zod

- Zod v3.25.76 ya instalado
- Usar `.parse()` para validación estricta (lanza error)
- Usar `.safeParse()` si necesitas manejo manual de errores
- Considerar `.transform()` si necesitas coercion de tipos

### Consideraciones de Multi-Tenant

- Siempre validar organization_id como UUID
- Verificar RLS en queries después de validación
- No confiar solo en Zod para security (defense in depth)

### Consideraciones de Propagación

- Verificar que Redis keys siguen mismo formato
- Confirmar que workers parsean correctamente
- Logging adecuado para debugging

## Timeline Estimado

- **Investigación:** 15 min
- **Esquemas Zod:** 30 min
- **Migración endpoints:** 45 min
- **Tests:** 60 min
- **Validación y receipts:** 30 min

**Total estimado:** 3 horas

## Referencias

- Zod docs: https://zod.dev/
- Issue #944: https://github.com/roastr-ai/roastr-ai/issues/944
- Nodos GDD: shield.md, queue-system.md, roast.md, multi-tenant.md
- CodeRabbit Lessons: docs/patterns/coderabbit-lessons.md

---

**Creado por:** Orchestrator (Cursor)  
**Fecha:** 2025-11-23  
**Issue:** #944  
**Worktree:** /Users/emiliopostigo/roastr-ai-worktrees/issue-944

