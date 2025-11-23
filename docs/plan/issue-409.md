# Plan de Implementación - Issue #409

**Issue:** [Integración] Generación – tono preseleccionado; 2 variantes iniciales en manual; 1 variante tras elección
**Priority:** P0
**Type:** test:integration
**Area:** area:ui
**Epic:** #403 - Testing MVP
**Assessment:** ENHANCE (ver `docs/assessment/issue-409.md`)

---

## 🔍 FASE 0: Task Assessment (COMPLETADA ✅)

### Recomendación del Task Assessor Agent

**ENHANCE** - Implementación parcial con cobertura E2E sólida, requiere mejoras estratégicas.

**Estado Actual:**

- ✅ **E2E tests PASSING** (5/5) en `tests/e2e/manual-flow.test.js`
- ✅ **Implementación funcional** en `roastEngine.js`, `roastGeneratorEnhanced.js`
- ✅ **Sistema de tonos centralizado** en `src/config/tones.js`
- ✅ **API endpoint operativo** en `POST /api/roast/engine`

**Gaps Críticos:**

1. ❌ No hay archivo de integration test dedicado para Issue #409
2. ❌ AC5 (Calidad y coherencia) débilmente testeada
3. ❌ Falta validación a nivel de base de datos
4. ❌ Falta validación de aislamiento multi-usuario
5. ❌ Falta validación explícita de enforcement de tono a nivel API

**Cobertura Actual:** 65% (3.5/5 AC completamente cubiertas)

**Referencia Completa:** Ver assessment en `docs/assessment/issue-409.md` (697 líneas)

---

## 📋 Criterios de Aceptación

### AC1: Respeta tono del perfil de usuario

- **Estado:** ✅ Implementado, ⚠️ Tests parciales (solo E2E)
- **Gap:** Falta validación a nivel API e integration tests

### AC2: Genera exactamente 2 variantes iniciales en modo manual

- **Estado:** ✅ Implementado, ⚠️ Tests parciales (solo E2E)
- **Gap:** Falta validación de persistencia en DB

### AC3: Tras selección, genera exactamente 1 variante adicional

- **Estado:** ✅ Implementado, ⚠️ Tests parciales (solo E2E)
- **Gap:** Falta validación de DB (3 variantes total)

### AC4: Validaciones previas ejecutadas antes de publicar

- **Estado:** ✅ Implementado, ✅ Tests buenos (E2E + Unit)
- **Gap:** Ninguno crítico

### AC5: Calidad y coherencia de variantes generadas

- **Estado:** ⚠️ Implementación implícita en RQC, ❌ Tests débiles
- **Gap:** Falta validación explícita de métricas de calidad

---

## 🎯 Estrategia de Implementación

### Overview de Fases

| Fase        | Prioridad | Esfuerzo | Descripción                 |
| ----------- | --------- | -------- | --------------------------- |
| **Phase 1** | P0        | 12-17h   | Integration Tests dedicados |
| **Phase 2** | P1        | 4-6h     | Mejoras E2E + multi-user    |
| **Phase 3** | P2        | 3-4h     | Unit tests complementarios  |
| **Phase 4** | P2        | 2-4h     | Documentación + evidencias  |

**Total Estimado:** 21-31 horas (3-4 días)

---

## 🔧 Phase 1: Integration Tests (Priority P0)

**Objetivo:** Crear archivo de integration test dedicado con 15 test cases cubriendo los 5 AC.

### 1.1 Crear Archivo Base

**Archivo:** `tests/integration/generation-issue-409.test.js`

**Estructura:**

```javascript
/**
 * Integration Tests for Issue #409
 * [Integración] Generación – tono preseleccionado; 2 variantes iniciales en manual; 1 variante tras elección
 *
 * Priority: P0
 * Epic: #403 - Testing MVP
 *
 * Validates 5 Acceptance Criteria:
 * - AC1: Respeta tono del perfil de usuario (3 tests)
 * - AC2: Genera exactamente 2 variantes iniciales en modo manual (4 tests)
 * - AC3: Tras selección, genera exactamente 1 variante adicional (3 tests)
 * - AC4: Validaciones previas ejecutadas antes de publicar (3 tests)
 * - AC5: Calidad y coherencia de variantes generadas (2 tests)
 */
```

### 1.2 AC1: Tone Enforcement (3 tests)

**Tests:**

1. `should respect user tone preference in all variants`
   - Request a `/api/roast/engine` con `tone: 'balanceado'`
   - Validar que las 2 variantes respetan el tono
   - Verificar en metadata: `variant.style === 'balanceado'`

2. `should fallback to default tone when user has no preference`
   - Usuario sin `tone_preference` configurado
   - Validar que se usa tono por defecto (`'balanceado'`)

3. `should reject invalid tone parameter`
   - Request con `tone: 'invalid_tone'`
   - Validar error 400 con mensaje claro

**Archivos a leer:**

- `src/config/tones.js` (101 líneas)
- `src/routes/roast.js` (líneas 824-1020)
- `tests/helpers/testUtils.js` (helpers)

**Assertions Clave:**

```javascript
expect(response.body.variants).toHaveLength(2);
expect(response.body.variants[0].style).toBe(testUser.tone_preference);
expect(response.body.variants[1].style).toBe(testUser.tone_preference);
```

### 1.3 AC2: Initial 2 Variants Generation (4 tests)

**Tests:**

1. `should generate exactly 2 variants in manual mode`
   - Request con `mode: 'manual'`, `phase: 'initial'`
   - Validar `variants.length === 2`

2. `should persist 2 variants to database`
   - Tras generación, query a DB: `SELECT * FROM roasts WHERE comment_id = ...`
   - Validar count === 2
   - Validar `created_at`, `user_id`, `org_id`

3. `should associate variants with correct user and org`
   - Verificar `variant.user_id === testUser.id`
   - Verificar `variant.org_id === testUser.org_id`
   - Validar RLS (Row Level Security)

4. `should generate different variant texts`
   - Validar `variants[0].text !== variants[1].text`
   - Validar longitud mínima (>10 caracteres)

**Archivos a leer:**

- `src/services/roastEngine.js` (líneas 1-400+)
- `database/schema.sql` (esquema `roasts_metadata`)

**Assertions Clave:**

```javascript
const { data: variants } = await supabaseServiceClient
  .from('roasts_metadata')
  .select('*')
  .eq('comment_id', commentId)
  .eq('phase', 'initial');

expect(variants).toHaveLength(2);
expect(variants[0].user_id).toBe(testUser.id);
expect(variants[0].text).not.toBe(variants[1].text);
```

### 1.4 AC3: Post-Selection 1 Additional Variant (3 tests)

**Tests:**

1. `should generate exactly 1 additional variant after selection`
   - Request con `phase: 'post_selection'`, `baseVariant: selectedVariant.id`
   - Validar `variants.length === 1`

2. `should base additional variant on selected variant`
   - Validar que la variante adicional referencia `baseVariant`
   - Verificar metadata: `variant.base_variant_id === selectedVariant.id`

3. `should persist 3 total variants to database`
   - Query total de variantes para el comment
   - Validar count === 3 (2 initial + 1 post-selection)

**Archivos a leer:**

- `src/services/roastEngine.js` (lógica post-selection)
- `tests/e2e/manual-flow.test.js` (líneas 303-339 - referencia)

**Assertions Clave:**

```javascript
const { data: totalVariants } = await supabaseServiceClient
  .from('roasts_metadata')
  .select('*')
  .eq('comment_id', commentId);

expect(totalVariants).toHaveLength(3);

const postSelectionVariant = totalVariants.find((v) => v.phase === 'post_selection');
expect(postSelectionVariant.base_variant_id).toBe(selectedVariant.id);
```

### 1.5 AC4: Pre-Publication Validations (3 tests)

**Tests:**

1. `should execute transparency disclaimer validation`
   - Request con `autoApprove: true`
   - Validar que se aplica transparency disclaimer
   - Verificar `result.transparency_applied === true`

2. `should consume credits before generation`
   - Mock de `costControl.checkAndConsumeCredits()`
   - Validar que se llama ANTES de generación
   - Verificar `credits_before - credits_after === cost`

3. `should validate platform constraints`
   - Request para plataforma con límite (Twitter, 280 chars)
   - Validar que variantes respetan límite
   - Verificar `variant.text.length <= 280`

**Archivos a leer:**

- `src/services/transparencyService.js` (validación)
- `src/services/costControl.js` (créditos)
- `src/config/platforms.js` (constraints)

**Assertions Clave:**

```javascript
expect(costControlSpy).toHaveBeenCalledBefore(roastEngineSpy);
expect(response.body.transparency_applied).toBe(true);
expect(response.body.variants[0].text.length).toBeLessThanOrEqual(280);
```

### 1.6 AC5: Quality & Coherence (2 tests)

**Tests:**

1. `should validate quality score above threshold`
   - **IMPORTANTE:** Definir métrica de calidad explícita
   - Opciones:
     - RQC score (si disponible)
     - OpenAI moderation score
     - Custom quality scoring
   - Validar `variant.quality_score >= 0.7` (threshold a definir)

2. `should ensure coherence with original comment`
   - Validar que el roast hace referencia al comentario original
   - Métrica: similarity score o keyword matching
   - Validar `coherence_score >= 0.6`

**⚠️ ACCIÓN REQUERIDA:**

- **Definir métricas de calidad explícitas** (consultar stakeholders si necesario)
- **Documentar thresholds** en `docs/nodes/roast.md`

**Archivos a leer:**

- `src/services/rqcService.js` (RQC system)
- `src/services/roastGeneratorEnhanced.js` (quality logic)

**Assertions Clave (propuestas):**

```javascript
// Option 1: RQC-based
expect(response.body.variants[0].rqc_score).toBeGreaterThanOrEqual(0.7);

// Option 2: Custom quality scoring
const qualityScore = await calculateQualityScore(variant, originalComment);
expect(qualityScore).toBeGreaterThanOrEqual(0.7);

// Option 3: Basic validation
expect(variant.text.length).toBeGreaterThan(10);
expect(variant.text.toLowerCase()).toContain(keywordFromComment);
```

### 1.7 Helpers y Setup

**Crear helpers en `tests/helpers/testUtils.js`:**

```javascript
/**
 * Create test user with tone preference
 */
async function createTestUserWithTone(tonePreference = 'balanceado') {
  const user = await createTestUser({
    tone_preference: tonePreference,
    plan: 'pro' // Pro plan for full features
  });
  return user;
}

/**
 * Query variants from database
 */
async function getVariantsFromDB(commentId, phase = null) {
  let query = supabaseServiceClient
    .from('roasts_metadata')
    .select('*')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: true });

  if (phase) {
    query = query.eq('phase', phase);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Calculate quality score (custom implementation)
 */
async function calculateQualityScore(variant, originalComment) {
  // Implementation TBD - define quality metrics
  // Could use:
  // - Text length validation
  // - Keyword matching with original comment
  // - OpenAI moderation API
  // - RQC score if available
  return 0.8; // Placeholder
}

module.exports = {
  createTestUserWithTone,
  getVariantsFromDB,
  calculateQualityScore
};
```

**Esfuerzo Estimado Phase 1:** 12-17 horas

---

## 🧪 Phase 2: E2E Enhancements (Priority P1)

**Objetivo:** Fortalecer tests E2E existentes con validaciones adicionales.

### 2.1 Enhance manual-flow.test.js

**Archivo:** `tests/e2e/manual-flow.test.js` (346+ líneas)

**Mejoras a implementar:**

1. **Add explicit quality assertions (AC5)**
   - Línea ~239: Añadir validación de quality score

   ```javascript
   // Current:
   expect(variant.text.length).toBeGreaterThan(10);

   // Enhanced:
   expect(variant.text.length).toBeGreaterThan(10);
   expect(variant.quality_score).toBeGreaterThanOrEqual(0.7); // NEW
   ```

2. **Add database persistence validation (AC2, AC3)**
   - Tras generación de variantes, query DB para confirmar

   ```javascript
   const variantsInDB = await getVariantsFromDB(testComment.id);
   expect(variantsInDB).toHaveLength(2); // Initial
   // ... after post-selection
   expect(variantsInDB).toHaveLength(3); // Total
   ```

3. **Add multi-user concurrency test**
   - Nuevo test case: "should handle concurrent variant generation from multiple users"
   - Simular 3 usuarios generando roasts simultáneamente
   - Validar aislamiento de datos (RLS)

4. **Add error recovery test**
   - Nuevo test case: "should retry generation on API failure"
   - Simular fallo de OpenAI API
   - Validar retry logic (max 3 intentos)
   - Validar fallback a mock generator

**Esfuerzo Estimado Phase 2:** 4-6 horas

---

## 🔬 Phase 3: Unit Tests (Priority P2)

**Objetivo:** Añadir unit tests complementarios para componentes clave.

### 3.1 roastEngine.test.js - Version Control Logic

**Archivo:** `tests/unit/services/roastEngine.test.js` (nuevo o enhance existing)

**Tests a añadir:**

1. `should generate 1 version when ROAST_VERSIONS_MULTIPLE flag is OFF`
2. `should generate 2 versions when ROAST_VERSIONS_MULTIPLE flag is ON`
3. `should respect manual mode phase parameter`
4. `should use correct voice style based on tone preference`

**Esfuerzo:** 1.5-2 horas

### 3.2 tones.test.js - Tone Validation

**Archivo:** `tests/unit/config/tones.test.js` (nuevo)

**Tests a añadir:**

1. `should normalize tone (case-insensitive)`
2. `should validate tone against TONE_DEFINITIONS`
3. `should return null for invalid tone`
4. `should freeze TONE_DEFINITIONS to prevent mutation`

**Esfuerzo:** 1-1.5 horas

### 3.3 GenerateReplyWorker.test.js - Manual Mode Logic

**Archivo:** `tests/unit/workers/GenerateReplyWorker.test.js` (enhance existing)

**Tests a añadir:**

1. `should generate 2 variants in manual initial phase`
2. `should generate 1 variant in manual post-selection phase`
3. `should pass tone preference to roastEngine`

**Esfuerzo:** 0.5-1 hora

**Esfuerzo Estimado Phase 3:** 3-4 horas

---

## 📚 Phase 4: Documentation (Priority P2)

**Objetivo:** Actualizar documentación y generar evidencias de tests.

### 4.1 Update Node Docs

**Archivos a actualizar:**

1. **`docs/nodes/roast.md`** (629 líneas)
   - Añadir sección "Variant Generation"
   - Documentar lógica 2 initial + 1 post-selection
   - Documentar quality metrics (AC5)
   - Añadir ejemplos de API usage

2. **`docs/nodes/tone.md`** (302 líneas)
   - Añadir sección "Tone Enforcement"
   - Documentar flujo completo: perfil → API → generación
   - Documentar fallback behavior

3. **`docs/nodes/persona.md`** (717 líneas)
   - Actualizar sección "Integration with Roast Generation"
   - Añadir referencia a Issue #409

**Esfuerzo:** 1-2 horas

### 4.2 Generate Test Evidence (Playwright)

**Según CLAUDE.md reglas:**

> "Invocar siempre al Test Engineer Agent tras cambios en src/ o en documentos de diseño para generar tests + evidencias visuales con Playwright."

**Acción:**

- Invocar Test Engineer Agent para generar evidencias visuales
- Capturar screenshots de:
  - UI de selección de variantes
  - UI de tono preseleccionado
  - UI post-selección (1 variante adicional)
- Guardar en `docs/test-evidence/issue-409/`

**Esfuerzo:** 1-2 horas

**Esfuerzo Estimado Phase 4:** 2-4 horas

---

## 🗂️ Archivos Afectados

### Nuevos Archivos a Crear

1. ✅ `docs/assessment/issue-409.md` - Assessment report (CREADO por Task Assessor Agent)
2. ✅ `docs/plan/issue-409.md` - Plan de implementación (ESTE ARCHIVO)
3. ⏳ `tests/integration/generation-issue-409.test.js` - Integration tests (15 tests)
4. ⏳ `tests/unit/config/tones.test.js` - Unit tests de tonos (4 tests)
5. ⏳ `docs/test-evidence/issue-409/` - Evidencias visuales Playwright

### Archivos a Modificar

1. ⏳ `tests/e2e/manual-flow.test.js` - Añadir 4 mejoras (calidad, DB, multi-user, retry)
2. ⏳ `tests/unit/services/roastEngine.test.js` - Añadir 4 tests de version control
3. ⏳ `tests/unit/workers/GenerateReplyWorker.test.js` - Añadir 3 tests de manual mode
4. ⏳ `tests/helpers/testUtils.js` - Añadir 3 helpers
5. ⏳ `docs/nodes/roast.md` - Actualizar sección "Variant Generation"
6. ⏳ `docs/nodes/tone.md` - Actualizar sección "Tone Enforcement"
7. ⏳ `docs/nodes/persona.md` - Actualizar referencia a Issue #409

**Total Archivos:** 5 nuevos + 7 modificados = 12 archivos

---

## 🎯 Subagentes a Usar

### Phase 1: Integration Tests

- **Back-end Dev** - Implementación de tests
- **Test Engineer** - Revisión de test structure

### Phase 2: E2E Enhancements

- **Back-end Dev** - Mejoras a manual-flow.test.js
- **Test Engineer** - Validación de multi-user tests

### Phase 3: Unit Tests

- **Back-end Dev** - Unit tests complementarios
- **Test Engineer** - Cobertura report

### Phase 4: Documentation

- **Documentation Agent** - Actualización de nodos GDD
- **Test Engineer** - Evidencias visuales Playwright
- **UI Designer** - Validación de UI screenshots (si necesario)

---

## ✅ Criterios de Validación

### Definition of "DONE"

1. ✅ Archivo `tests/integration/generation-issue-409.test.js` creado con 15 tests
2. ✅ Los 15 integration tests PASSING
3. ✅ Tests E2E en `manual-flow.test.js` mejorados con 4 nuevas validaciones
4. ✅ Unit tests añadidos (11 tests total):
   - 4 en `roastEngine.test.js`
   - 4 en `tones.test.js`
   - 3 en `GenerateReplyWorker.test.js`
5. ✅ Validación a nivel de DB implementada (persistencia de variantes)
6. ✅ Validación de enforcement de tono a nivel API
7. ✅ Métricas de calidad (AC5) definidas y documentadas
8. ✅ Multi-user isolation test implementado
9. ✅ Helpers en `testUtils.js` añadidos (3 funciones)
10. ✅ Todos los tests PASSING (unit + integration + E2E)
11. ✅ Cobertura >80% para servicios afectados:
    - `roastEngine.js` >85%
    - `tones.js` >90%
    - `roastGeneratorEnhanced.js` >75%
12. ✅ Documentación actualizada:
    - `roast.md` con sección "Variant Generation"
    - `tone.md` con sección "Tone Enforcement"
    - `persona.md` con referencia a Issue #409
13. ✅ Evidencias visuales generadas con Playwright en `docs/test-evidence/issue-409/`
14. ✅ Validación GDD pasando: `node scripts/resolve-graph.js --validate`
15. ✅ Sección "Agentes Relevantes" actualizada en nodos afectados

### Success Metrics

| Métrica                             | Target  | Actual |
| ----------------------------------- | ------- | ------ |
| **Test Count (Integration)**        | 15      | TBD    |
| **Test Count (Unit)**               | 11      | TBD    |
| **Test Count (E2E enhancements)**   | 4       | TBD    |
| **Total New Tests**                 | 30      | TBD    |
| **Coverage roastEngine.js**         | >85%    | TBD    |
| **Coverage tones.js**               | >90%    | TBD    |
| **Coverage GenerateReplyWorker.js** | >70%    | TBD    |
| **All Tests Passing**               | 100%    | TBD    |
| **Integration Test Time**           | <30s    | TBD    |
| **GDD Validation**                  | ✅ PASS | TBD    |

---

## 🚨 Riesgos y Mitigaciones

### Riesgo 1: AC5 Quality Metrics Undefined

**Probabilidad:** ALTA
**Impacto:** MEDIO

**Mitigación:**

- Definir métricas explícitas al inicio de Phase 1
- Opciones:
  1. RQC score (si disponible) - threshold: 0.7
  2. OpenAI moderation score - threshold: 0.6
  3. Custom scoring (length + keyword matching) - threshold: 0.7
- Documentar decisión en `docs/nodes/roast.md`

### Riesgo 2: Database Schema Incomplete

**Probabilidad:** MEDIA
**Impacto:** ALTO

**Mitigación:**

- Revisar `database/schema.sql` ANTES de escribir tests DB
- Verificar campos: `phase`, `base_variant_id`, `quality_score`
- Si faltan, añadir migración antes de Phase 1.3

### Riesgo 3: Integration Tests Reveal Implementation Gaps

**Probabilidad:** MEDIA
**Impacto:** ALTO

**Mitigación:**

- Ejecutar smoke tests early (AC1, AC2 first)
- Si falla → documentar gap → añadir a plan
- No bloquear: usar feature flags para deshabilitar temporalmente

### Riesgo 4: Timeline Overrun (21-31h estimate)

**Probabilidad:** MEDIA
**Impacto:** MEDIO

**Mitigación:**

- Priorizar Phase 1 (P0) - crítico
- Phase 2 y 3 pueden demorarse si necesario
- Phase 4 puede hacerse en paralelo con otras issues

---

## 📅 Timeline Estimado

### Day 1 (8 horas)

- ✅ **FASE 0 completada** - Task Assessment (2h)
- ✅ **Planning completado** - Este plan (2h)
- ⏳ **Phase 1.1-1.3** - Crear archivo base + AC1 + AC2 (4h)

### Day 2 (8 horas)

- ⏳ **Phase 1.4-1.6** - AC3 + AC4 + AC5 (6h)
- ⏳ **Phase 1.7** - Helpers y setup (2h)
- ⏳ **Run integration tests** - Validar PASSING

### Day 3 (6-8 horas)

- ⏳ **Phase 2** - E2E enhancements (4-6h)
- ⏳ **Phase 3** - Unit tests (2h)

### Day 4 (4-6 horas)

- ⏳ **Phase 4** - Documentation + evidencias (2-4h)
- ⏳ **Validación final** - Run all tests, coverage report (1h)
- ⏳ **GDD validation** - `node scripts/resolve-graph.js --validate` (0.5h)
- ⏳ **PR creation** - Changelog + evidencias (0.5-1h)

**Total:** 26-30 horas (dentro del rango 21-31h estimado)

---

## 🔗 Referencias

### Assessment

- **Reporte Completo:** `docs/assessment/issue-409.md` (697 líneas)
- **Recomendación:** ENHANCE
- **Cobertura Actual:** 65% (3.5/5 AC)

### Contexto GDD (10 nodos cargados)

1. **roast.md** (629 líneas) - Sistema de generación
2. **tone.md** (302 líneas) - Mapeo de tonos
3. **persona.md** (717 líneas) - Configuración de personalidad
4. **plan-features.md** - Feature gates por plan
5. **multi-tenant.md** - RLS y aislamiento
6. **queue-system.md** - Workers y jobs
7. **cost-control.md** - Créditos y billing
8. **social-platforms.md** - Integraciones
9. **platform-constraints.md** - Límites por plataforma
10. **shield.md** - Moderación automatizada

### Epic & Issue

- **Epic #403:** Testing MVP
- **Issue #409:** Generación con tono + variantes (P0)
- **Issue Original:** https://github.com/Eibon7/roastr-ai/issues/409

### Código Relevante

- **Implementation:**
  - `src/services/roastEngine.js` (líneas 1-400+)
  - `src/services/roastGeneratorEnhanced.js`
  - `src/config/tones.js` (101 líneas)
  - `src/routes/roast.js` (líneas 824-1020)

- **Tests Existentes:**
  - `tests/e2e/manual-flow.test.js` (346+ líneas, 5/5 PASSING)
  - `tests/integration/roast.test.js` (14,586 bytes)
  - `tests/unit/routes/roast-regeneration.test.js` (90 líneas)

---

## 📝 Notas de Implementación

### Convenciones de Tests

**Naming:**

- Integration tests: `tests/integration/generation-issue-409.test.js`
- Test suites: `describe('[Integration] Roast Generation - Issue #409', ...)`
- Test cases: `test('should [action] [expected result]', ...)`

**Structure:**

```javascript
describe('[Integration] Feature - Issue #XXX', () => {
  describe('AC1: Acceptance Criteria Title', () => {
    test('should validate specific behavior', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**Mocking Strategy:**

- Mock OpenAI API cuando sea necesario (para tests rápidos)
- Usar `ENABLE_REAL_OPENAI=false` en test environment
- Mock `costControl` para evitar side effects
- NO mock de database (usar test DB real con fixtures)

### Feature Flags para Tests

```javascript
// In test environment
process.env.ROAST_VERSIONS_MULTIPLE = 'true'; // Enable 2-version mode
process.env.ENABLE_REAL_OPENAI = 'false'; // Use mock generator
process.env.NODE_ENV = 'test'; // Test environment
```

### Database Cleanup

```javascript
afterEach(async () => {
  // Clean up test data
  await supabaseServiceClient.from('roasts_metadata').delete().eq('user_id', testUser.id);
});
```

---

## 🎬 Next Steps (Post-Planning)

### Immediate Actions (ahora)

1. **Validar plan con usuario** - Confirmar antes de implementar
2. **Definir quality metrics (AC5)** - Consultar si necesario
3. **Revisar schema DB** - Confirmar campos disponibles

### Post-Approval Actions (Day 1)

1. **Crear archivo integration test** - `tests/integration/generation-issue-409.test.js`
2. **Implementar AC1 tests** - Tone enforcement (3 tests)
3. **Implementar AC2 tests** - Initial 2 variants (4 tests)

### Continuous Actions

- **Update todo list** - Marcar tasks como in_progress/completed
- **Run tests frequently** - `npm test -- generation-issue-409`
- **Document gaps** - Si aparecen issues, documentar en plan

---

## ✅ Checklist Pre-Commit (Antes de Cerrar)

**GDD Validation:**

- [ ] Leí `spec.md` y archivos `.md` de nodos afectados
- [ ] Revisé sección "Agentes Relevantes" en nodos modificados
- [ ] Añadí agentes efectivamente usados (no estaban listados)
- [ ] Eliminé agentes ya no relevantes
- [ ] Ejecuté `node scripts/resolve-graph.js --validate` → no errors
- [ ] Confirmé tabla global nodos-agentes sincronizada en `spec.md`
- [ ] Generé reporte: `node scripts/resolve-graph.js --report`

**Tests:**

- [ ] Todos los tests PASSING (unit + integration + E2E)
- [ ] Cobertura >80% para servicios afectados
- [ ] Integration tests run en <30 segundos
- [ ] No test interdependencies (cada test independiente)

**Documentation:**

- [ ] Nodos GDD actualizados (roast.md, tone.md, persona.md)
- [ ] Evidencias visuales generadas con Playwright
- [ ] Changelog detallado en PR
- [ ] Assessment + Plan incluidos en PR description

**Code Quality:**

- [ ] No hay código comentado (cleanup)
- [ ] No hay console.logs (usar logger)
- [ ] No hay TODOs sin issue asociado
- [ ] Feature flags documentados

---

**Plan Creado:** 2025-10-03
**Autor:** Orchestrator (Workflow GDD completo)
**Próximo Paso:** Validar plan → Implementar Phase 1
**Estimated Completion:** Day 4 (26-30 horas)
