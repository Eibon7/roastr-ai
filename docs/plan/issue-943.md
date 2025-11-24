# Plan de Implementación: Issue #943

**Título:** Migrar endpoints de Config (Roast/Shield Level) a Zod (P0 - Crítico)  
**Prioridad:** P0 - Crítico  
**Labels:** enhancement, high-priority, backend, Security  
**Created:** 2025-11-23  
**Nodos GDD:** shield, queue-system, roast, multi-tenant

---

## Estado Actual

### Endpoints Afectados

- `PUT /api/config/:platform` (líneas 113-273 en `src/routes/config.js`)
  - Validación manual inline para `roast_level` (líneas 165-173)
  - Validación manual inline para `shield_level` (líneas 175-183)
  - Validación de plan-based access via `levelConfigService.validateLevelAccess()` (líneas 186-203)

### Validaciones Actuales (Manual)

```javascript
// Roast level validation (líneas 166-173)
if (roast_level !== undefined) {
  if (typeof roast_level !== 'number' || roast_level < 1 || roast_level > 5) {
    return res.status(400).json({
      success: false,
      error: 'Roast level must be a number between 1 and 5'
    });
  }
}

// Shield level validation (líneas 176-183)
if (shield_level !== undefined) {
  if (typeof shield_level !== 'number' || shield_level < 1 || shield_level > 5) {
    return res.status(400).json({
      success: false,
      error: 'Shield level must be a number between 1 and 5'
    });
  }
}
```

### Servicios Relacionados

- `src/services/levelConfigService.js` - Lógica de validación de plan-based access
- `src/routes/config.js` - Endpoints que necesitan migración

### Nota Importante

- **NO hay express-validator** en estos endpoints (validación manual)
- Zod v3.25.76 ya instalado
- Directorio `src/validators/` NO existe aún

---

## Pasos de Implementación

### 1. Crear Estructura de Validadores Zod

**Archivos a crear:**

- `src/validators/zod/config.schema.js` - Esquemas de validación
- `src/validators/zod/helpers.js` - Helper para formatear errores Zod

**Esquemas necesarios:**

- `roastLevelSchema` - Validar roast_level (1-5, number)
- `shieldLevelSchema` - Validar shield_level (1-5, number)
- `platformConfigSchema` - Schema completo para PUT /api/config/:platform

### 2. Migrar Validaciones en config.js

**Cambios en `src/routes/config.js`:**

- Importar esquemas Zod
- Reemplazar validaciones manuales (líneas 165-183) con Zod
- Mantener validación de plan-based access (líneas 186-203) - NO cambiar
- Usar helper para formatear errores Zod

**Ejemplo de implementación:**

```javascript
const { platformConfigSchema } = require('../validators/zod/config.schema');
const { formatZodError } = require('../validators/zod/helpers');

router.put('/:platform', async (req, res) => {
    try {
        // Validar con Zod
        const validation = platformConfigSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: formatZodError(validation.error)
            });
        }

        // Continuar con plan-based validation (NO CAMBIAR)
        const { roast_level, shield_level } = validation.data;
        // ... resto de lógica
    }
});
```

### 3. Tests Unitarios

**Archivo:** `tests/unit/validators/config.schema.test.js`

**Test cases:**

- ✅ Roast level válido (1-5)
- ❌ Roast level < 1
- ❌ Roast level > 5
- ❌ Roast level no numérico
- ✅ Shield level válido (1-5)
- ❌ Shield level < 1
- ❌ Shield level > 5
- ❌ Shield level no numérico
- ✅ Combinaciones válidas
- ❌ Tipos inválidos (string, null, undefined)

### 4. Tests de Integración

**Archivo:** `tests/integration/routes/config-zod.test.js`

**Test cases:**

- ✅ PUT /api/config/:platform con roast_level válido
- ✅ PUT /api/config/:platform con shield_level válido
- ❌ PUT /api/config/:platform con roast_level inválido → 400
- ❌ PUT /api/config/:platform con shield_level inválido → 400
- ✅ Validación de plan-based access aún funciona
- ✅ Errores Zod formateados correctamente

### 5. Validar Propagación a Workers

**Verificar:**

- Workers leen configuración correctamente
- Cambios en roast_level/shield_level se propagan
- No breaking changes en flujo de workers

**Workers afectados:**

- `src/workers/GenerateReplyWorker.js` - Lee roast_level
- `src/workers/ShieldActionWorker.js` - Lee shield_level

---

## Agentes Involucrados

### TestEngineer (OBLIGATORIO)

- **Trigger:** Cambios en `src/routes/config.js`, `src/validators/zod/`
- **Workflow:** Composer → @tests/ @src/routes/config.js → "Generate tests siguiendo test-generation-skill"
- **Output:** Tests unitarios + integración
- **Receipt:** `docs/agents/receipts/cursor-test-engineer-[timestamp].md`

### Guardian (OBLIGATORIO)

- **Trigger:** Cambios en config crítico, Security label, P0
- **Workflow:** `node scripts/guardian-gdd.js --full` + manual audit
- **Verificar:** No breaking changes, RLS OK, validación correcta
- **Receipt:** `docs/agents/receipts/cursor-guardian-[timestamp].md`

### TaskAssessor (OPCIONAL - Skipped)

- **Trigger:** AC ≥3, P0
- **Razón Skip:** Plan ya creado manualmente, no requiere agent
- **Receipt:** `docs/agents/receipts/cursor-task-assessor-SKIPPED.md`

---

## Archivos Afectados

### Nuevos

- `src/validators/zod/config.schema.js` (✨ NUEVO)
- `src/validators/zod/helpers.js` (✨ NUEVO)
- `tests/unit/validators/config.schema.test.js` (✨ NUEVO)
- `tests/integration/routes/config-zod.test.js` (✨ NUEVO)

### Modificados

- `src/routes/config.js` (🔧 MODIFICADO - líneas 165-183)

### Verificados (Sin cambios)

- `src/services/levelConfigService.js` (✅ VERIFICAR - plan-based validation)
- `src/workers/GenerateReplyWorker.js` (✅ VERIFICAR - propagación)
- `src/workers/ShieldActionWorker.js` (✅ VERIFICAR - propagación)

---

## Validación Pre-Merge

### Tests

```bash
npm test -- tests/unit/validators/config.schema.test.js
npm test -- tests/integration/routes/config-zod.test.js
npm test  # All tests must pass
npm run test:coverage  # Coverage >=90%
```

### GDD Validation

```bash
node scripts/validate-gdd-runtime.js --full  # Must pass
node scripts/score-gdd-health.js --ci  # Must >=87
```

### CodeRabbit

```bash
npm run coderabbit:review  # Must 0 comentarios
```

### Manual Verification

- [ ] roast_level validation works (1-5)
- [ ] shield_level validation works (1-5)
- [ ] Plan-based access still enforced
- [ ] Error messages are clear
- [ ] Workers read config correctly
- [ ] No breaking changes in API contracts

---

## Acceptance Criteria (Issue #943)

- [ ] Todos los endpoints de config usan Zod
- [ ] express-validator eliminado de estos endpoints (N/A - no había)
- [ ] Tests pasando al 100%
- [ ] Validación de valores permitidos (enum 1-5)
- [ ] Validación de rangos numéricos
- [ ] No breaking changes en API contracts

---

## Riesgos y Mitigaciones

### Riesgo 1: Breaking Changes en API

**Mitigación:** Tests de integración verifican compatibilidad backward

### Riesgo 2: Errores de formato diferentes

**Mitigación:** Helper `formatZodError()` mantiene formato consistente

### Riesgo 3: Workers no reciben cambios

**Mitigación:** Tests verifican propagación, inspección manual

---

## Referencias

- Issue #943: https://github.com/roastr-ai/roastr/issues/943
- Zod docs: https://zod.dev/
- CodeRabbit Lessons: `docs/patterns/coderabbit-lessons.md`
- Nodos GDD: shield.md, queue-system.md, roast.md, multi-tenant.md

---

**Status:** ✅ Plan completo, listo para implementación  
**Siguiente paso:** Crear estructura de validadores Zod (todo 943-2)
