# Plan: Issue #892 - Fix Supabase Mock Pattern

## Objetivo

Fix el patrón de mocking de Supabase que está causando ~75 errores en 8 suites de tests.

## Estado Actual

**Patrón Roto:**

```javascript
// ❌ BROKEN: Reasignación en beforeEach después de module resolution
jest.mock('../../src/config/supabase');
beforeEach(() => {
  supabaseServiceClient.from = jest.fn(); // Falla silenciosamente
});
```

**Patrón Correcto:**

```javascript
// ✅ CORRECT: Crear mock ANTES de jest.mock()
const mockSupabase = createSupabaseMock({...});
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));
```

## Archivos Afectados (8 suites, ~75 errors)

1. `tests/unit/workers/ShieldActionWorker.test.js` - **19 errors**
2. `tests/unit/workers/FetchCommentsWorker.test.js` - **15 errors**
3. `tests/unit/workers/AnalyzeToxicityWorker.test.js` - **6 errors**
4. `tests/unit/services/referralService.test.js` - **13 errors** (no existe, buscar alternativo)
5. `tests/unit/services/usageService.test.js` - **10 errors**
6. `tests/unit/services/shieldService.test.js` - **8 errors**
7. `tests/unit/services/commentService.test.js` - **2 errors**
8. `tests/unit/services/tokenRefreshService.test.js` - **2 errors**

## Herramientas Disponibles

- `tests/helpers/supabaseMockFactory.js` - Factory helper para crear mocks consistentes
- `tests/templates/service.test.template.js` - Template con patrón correcto
- Referencia: `tests/integration/roast.test.js` (lines 59-108) - Implementación correcta

## Pasos de Implementación

### Fase 1: Identificación

- [x] Verificar archivos mencionados en issue
- [ ] Identificar archivos reales con patrón roto
- [ ] Ejecutar tests para verificar errores actuales

### Fase 2: Fix por Archivo (Orden de Impacto)

1. **ShieldActionWorker.test.js** (19 errors)
   - Leer archivo completo
   - Identificar uso de supabaseServiceClient
   - Reemplazar con patrón correcto usando factory
   - Ejecutar tests y verificar

2. **FetchCommentsWorker.test.js** (15 errors)
   - Mismo proceso

3. **AnalyzeToxicityWorker.test.js** (6 errors)
   - Mismo proceso

4. **usageService.test.js** (10 errors)
   - Mismo proceso

5. **shieldService.test.js** (8 errors)
   - Mismo proceso

6. **commentService.test.js** (2 errors)
   - Mismo proceso

7. **tokenRefreshService.test.js** (2 errors)
   - Mismo proceso

8. **referralService.test.js** (13 errors)
   - Buscar archivo alternativo o verificar si existe con otro nombre

### Fase 3: Validación

- [ ] Ejecutar todos los tests: `npm test -- <archivos>`
- [ ] Verificar 0 errores en cada suite
- [ ] Verificar que coverage no baja
- [ ] Ejecutar tests completos para asegurar no romper nada

### Fase 4: Documentación

- [ ] Actualizar coderabbit-lessons.md si se identifica nuevo patrón
- [ ] Generar receipt de TestEngineer
- [ ] Actualizar GDD nodes si aplica

## Acceptance Criteria

- [ ] Todos los 8 suites pasando 100%
- [ ] ~75 errores resueltos
- [ ] Patrón correcto aplicado en todos los archivos
- [ ] Tests ejecutados y verificados
- [ ] Documentación actualizada si necesario

## Estimación

**Esfuerzo:** 4-6 horas
**Prioridad:** P0 (ALTA)
**Impacto:** ~75 errores resueltos, 8 suites pasando
